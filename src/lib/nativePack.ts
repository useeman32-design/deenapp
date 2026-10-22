/**
 * pass 111/112 — native content pack.
 *
 * WHY THIS EXISTS
 * ---------------
 * In EAS/gradle RELEASE builds of this app, every metro-bundled asset is
 * flattened into `res/` with 2–3-character obfuscated names instead of the
 * `assets/raw/…` / `assets/drawable-*…` layout that React Native's
 * AssetSourceResolver expects next to the JS bundle. So no `require()`d image,
 * font or data file can be read from the APK (web export is unaffected).
 *
 * The app therefore downloads ONE zip on first release launch and reads every
 * asset from disk instead:
 *
 *   scripts/build-native-pack.py → native-pack/pack.zip on the API domain
 *   ensurePack()  → download + inflate into documentDirectory/native-pack/
 *   installNativeAssetPack() → custom RN asset source transformer
 *   fonts.ts / content.ts → read pack files directly
 *
 * PASS 112 — why pass 111 still showed blank icons/readers:
 * metro records `httpServerLocation` with a DOUBLED prefix — e.g.
 * './assets/assets/content/quran' — while the pack stores 'assets/content/quran'.
 * Pass 111 concatenated them literally, so every computed lookup missed (fonts
 * worked only because that path was hardcoded). Resolution now normalizes the
 * recorded path and validates it against the pack's REAL entry list, trying
 * scaled variants and both prefix forms. If a file still cannot be found
 * locally, callers can fall back to an HTTP fetch of the same file.
 *
 * Web, Expo Go and __DEV__ builds behave exactly as before.
 */
import { Platform, PixelRatio, type ImageSourcePropType } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { unzip, strFromU8 } from 'fflate';
import { PACK_URL, PACK_VERSION, PACK_BYTES } from './packMeta';

/** Base URL the pack is served from, with a trailing slash. */
export const PACK_BASE_URL = PACK_URL.replace(/\/[^/]*$/, '/');

let packDir: string | null = null;
let packEntries: Set<string> | null = null;
let ensurePromise: Promise<boolean> | null = null;

/** Absolute file:// dir (trailing slash) of the unpacked pack, or null. */
export function getPackDir(): string | null {
  return packDir;
}

function packRoot(): Directory {
  return new Directory(Paths.document, 'native-pack');
}
function markerFile(): File {
  return new File(Paths.document, 'native-pack.version');
}
function entriesFile(): File {
  return new File(Paths.document, 'native-pack.entries.json');
}

const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'ttf', 'otf', 'gz', 'zip',
  'mp3', 'mp4', 'wav', 'm4a', 'ico',
]);

async function unpackOnce(): Promise<void> {
  const root = packRoot();
  if (!root.exists) root.create({ intermediates: true });
  const tmp = new File(Paths.cache, 'dl-pack-' + Date.now() + '.zip');
  try {
    await File.downloadFileAsync(PACK_URL, tmp);
    const zipBytes = await tmp.bytes();
    if (zipBytes.length < 1024) throw new Error('pack: download too small');
    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(zipBytes, (err, data) => (err ? reject(err) : resolve(data)));
    });
    const names = Object.keys(files);
    if (names.length < 50) throw new Error(`pack: only ${names.length} entries`);

    const written: string[] = [];
    for (const rel of names) {
      if (rel.endsWith('/')) continue;
      const segs = rel.split('/');
      const fname = segs.pop() as string;
      const dir = segs.length ? new Directory(root, ...segs) : root;
      if (!dir.exists) dir.create({ intermediates: true });
      const f = new File(dir, fname);
      if (!f.exists) f.create();
      const ext = (fname.split('.').pop() ?? '').toLowerCase();
      f.write(BINARY_EXT.has(ext) ? files[rel] : strFromU8(files[rel]));
      written.push(rel);
      delete files[rel]; // let GC reclaim as we go
    }

    /* Record the real entry list: asset resolution validates candidates
     * against it instead of trusting metro's httpServerLocation blindly. */
    const ef = entriesFile();
    if (!ef.exists) ef.create();
    ef.write(JSON.stringify(written));

    const m = markerFile();
    if (!m.exists) m.create();
    m.write(PACK_VERSION);

    packEntries = new Set(written);
    packDir = root.uri.endsWith('/') ? root.uri : root.uri + '/';
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {
      /* cache cleanup is best-effort */
    }
  }
}

/**
 * Ensure the pack is on disk. Resolves true when usable; false when all three
 * retries failed (the app still boots and content falls back to HTTP). Safe to
 * call repeatedly; concurrent callers share one promise. No-op on web/dev.
 */
export function ensurePack(): Promise<boolean> {
  if (Platform.OS === 'web' || __DEV__) return Promise.resolve(true);
  if (packDir) return Promise.resolve(true);
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    try {
      const m = markerFile();
      if (m.exists && (await m.text()).trim() === PACK_VERSION) {
        const root = packRoot();
        packDir = root.uri.endsWith('/') ? root.uri : root.uri + '/';
        try {
          const ef = entriesFile();
          if (ef.exists) packEntries = new Set(JSON.parse(await ef.text()) as string[]);
        } catch {
          packEntries = null;
        }
        return true;
      }
    } catch {
      /* no marker — fresh install or version bump */
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await unpackOnce();
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return false;
  })();
  return ensurePromise;
}

/* ---------- asset source transformer ---------- */

type PackagerAsset = {
  httpServerLocation?: string;
  name?: string;
  type?: string;
  scales?: number[];
  width?: number;
  height?: number;
};

function pickScale(scales: number[], deviceScale: number): number {
  if (!scales.length) return 1;
  const sorted = [...scales].sort((a, b) => a - b);
  for (const s of sorted) if (s >= deviceScale) return s;
  return sorted[sorted.length - 1];
}

/**
 * pass 112 — metro records e.g. './assets/assets/content/quran' while the pack
 * stores 'assets/content/quran'. Collapse the duplicate segment and drop the
 * leading './' so both forms agree.
 */
function normalizeRel(p: string): string {
  let s = p.replace(/^\.\//, '').replace(/\\/g, '/').replace(/^\/+/, '');
  while (s.startsWith('assets/assets/')) s = 'assets/' + s.slice('assets/assets/'.length);
  return s.replace(/\/+$/, '');
}

/** Candidate pack-relative paths for an asset, best first. */
function relCandidates(asset: PackagerAsset): string[] {
  if (!asset.httpServerLocation || !asset.name || !asset.type) return [];
  const bases = new Set<string>();
  const norm = normalizeRel(asset.httpServerLocation);
  bases.add(norm);
  /* tolerate a missing or extra leading 'assets/' */
  if (norm.startsWith('assets/')) bases.add(norm.slice('assets/'.length));
  else bases.add('assets/' + norm);

  const scales = asset.scales ?? [1];
  const deviceScale = PixelRatio.get();
  const order = [pickScale(scales, deviceScale), 1, ...scales].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const out: string[] = [];
  for (const base of bases) {
    for (const sc of order) {
      const suffix = sc === 1 ? '' : '@' + sc + 'x';
      out.push(base + '/' + asset.name + suffix + '.' + asset.type);
    }
  }
  return out;
}

/** Resolve an asset record to a real path inside the pack, or null. */
export function resolveAssetRel(asset: PackagerAsset): string | null {
  const cands = relCandidates(asset);
  if (!cands.length) return null;
  if (packEntries) {
    for (const c of cands) if (packEntries.has(c)) return c;
    return null;
  }
  /* no manifest (dev/web or a corrupt marker) — trust the normalized first form */
  return cands[0];
}

/* eslint-disable @typescript-eslint/no-var-requires */
function registry(): { getAssetByID: (id: number) => PackagerAsset | null } | null {
  try {
    return require('react-native/Libraries/Image/AssetRegistry');
  } catch {
    return null;
  }
}
function resolverModule(): {
  default?: { setCustomSourceTransformer?: (fn: (r: never) => unknown) => void };
} | null {
  try {
    return require('react-native/Libraries/Image/resolveAssetSource');
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-var-requires */

/** Absolute file:// URI for an asset record, or null. */
export function packUriForAsset(asset: PackagerAsset): string | null {
  if (!packDir) return null;
  const rel = resolveAssetRel(asset);
  return rel ? packDir + rel : null;
}

/**
 * Register the custom source transformer. Called once at module scope of the
 * root layout (native release only). While the pack is still downloading,
 * resolution falls back to RN's default (blank images during the splash —
 * components re-render with real file URIs once the pack lands).
 */
export function installNativeAssetPack(): void {
  if (Platform.OS === 'web' || __DEV__) return;
  const set = resolverModule()?.default?.setCustomSourceTransformer;
  if (!set) return;
  set(((resolver: { asset: PackagerAsset; defaultAsset: () => unknown }) => {
    const uri = packUriForAsset(resolver.asset);
    if (!uri) return resolver.defaultAsset();
    const asset = resolver.asset;
    return {
      __packager_asset: true,
      width: asset.width ?? null,
      height: asset.height ?? null,
      uri,
      scale: pickScale(asset.scales ?? [1], PixelRatio.get()),
    };
  }) as never);
}

/** Local file URI for a `require()`d data file, or null when unavailable. */
export function resolvePackModule(mod: number): string | null {
  if (Platform.OS === 'web' || __DEV__ || !packDir) return null;
  const asset = registry()?.getAssetByID(mod) ?? null;
  return asset ? packUriForAsset(asset) : null;
}

/**
 * HTTP fallback for a `require()`d data file: same path the pack would use,
 * served from the API domain. Lets the Qur'an/hadith readers work even when
 * the pack download failed (text files are small; fetched on demand).
 */
export function resolvePackRemote(mod: number): string | null {
  if (Platform.OS === 'web' || __DEV__) return null;
  const asset = registry()?.getAssetByID(mod) ?? null;
  if (!asset) return null;
  const cands = relCandidates(asset);
  if (!cands.length) return null;
  const rel = packEntries ? resolveAssetRel(asset) : cands[0];
  return rel ? PACK_BASE_URL + rel : null;
}

/**
 * expo-image bypasses RN's resolver for numeric requires, so its call sites
 * wrap sources with this AT RENDER time (not module scope — the pack may not
 * be on disk yet when modules import). Non-numeric sources pass through.
 */
export function imgSource(src: unknown): ImageSourcePropType {
  if (Platform.OS === 'web' || __DEV__ || typeof src !== 'number') return src as ImageSourcePropType;
  try {
    const asset = registry()?.getAssetByID(src) ?? null;
    const uri = asset ? packUriForAsset(asset) : null;
    if (uri) return { uri };
  } catch {
    /* fall through to the default source */
  }
  const m = resolverModule() as unknown as { default?: (id: number) => { uri?: string } | null } | null;
  try {
    const resolved = m?.default?.(src);
    return (resolved?.uri ? resolved : src) as ImageSourcePropType;
  } catch {
    return src as ImageSourcePropType;
  }
}

/** Human-readable pack size for progress copy. */
export function packSizeLabel(): string {
  return (PACK_BYTES / 1048576).toFixed(1) + ' MB';
}
