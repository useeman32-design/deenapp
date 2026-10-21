/**
 * pass 111 — native content pack.
 *
 * WHY THIS EXISTS
 * ---------------
 * In EAS/gradle RELEASE builds of this app, every metro-bundled asset ends up
 * flattened under `res/` with 2–3-character obfuscated names instead of the
 * `assets/raw/…` + `assets/drawable-{dpi}/…` layout that React Native's
 * AssetSourceResolver expects next to the JS bundle. The result: in release
 * APKs every `require()`d image renders blank, expo-font faces fail, and
 * expo-asset's `localUri` points at files that do not exist — Qur'an/hadith
 * content, fonts and icons all break, while the web export (plain files on
 * disk) is unaffected. Two cloud builds (0c4d6cdc, e519fb7c) proved this
 * cannot be fixed from the JS/metro side.
 *
 * So native release builds no longer rely on packaged assets at all:
 *
 *  1. `scripts/build-native-pack.py` zips assets/{content,img,images,avatars,
 *     shop} + src/fonts into ONE pack hosted at
 *     app.deenlink.org/native-pack/pack.zip (served out of the deenlink-api
 *     checkout — the same repo public_html runs).
 *  2. On first release launch `ensurePack()` downloads it once (~33 MB,
 *     3 retries), inflates it with fflate entry-by-entry (peak memory stays
 *     at the largest single file) and writes it under
 *     `documentDirectory/native-pack/`, then stamps a version marker.
 *     Later launches are a marker check — instant.
 *  3. `installNativeAssetPack()` registers RN's custom asset source
 *     transformer: every numeric `require()` resolves to
 *     `file://…/native-pack/<httpServerLocation>/<name>[@Nx].<type>` — the
 *     pack mirrors project-relative paths, so the mapping is direct. All 165
 *     require() sites in src/ are covered without touching them.
 *  4. fonts.ts and content.ts read their files straight from the pack.
 *  5. expo-image bypasses RN's resolver, so its call sites wrap sources with
 *     `imgSource()` (lazy — resolved at render, after the pack has landed).
 *
 * Dev builds (__DEV__, Expo Go) and web are untouched: ensurePack resolves
 * immediately, getPackDir() stays null, and every consumer falls back to the
 * Asset.fromModule path that already works there.
 */
import { Platform, PixelRatio, type ImageSourcePropType } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { unzip, strFromU8 } from 'fflate';
import { PACK_URL, PACK_VERSION, PACK_BYTES } from './packMeta';

let packDir: string | null = null;
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

/** Extensions written as raw bytes; everything else is written as UTF-8 text. */
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
    /* fflate's async unzip inflates entry-by-entry — peak memory stays at the
     * largest single file (~1–2MB) instead of the whole 40MB tree. */
    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(zipBytes, (err, data) => (err ? reject(err) : resolve(data)));
    });
    const names = Object.keys(files);
    if (names.length < 50) throw new Error(`pack: only ${names.length} entries`);
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
      delete files[rel]; // let GC reclaim as we go
    }
    const m = markerFile();
    if (!m.exists) m.create();
    m.write(PACK_VERSION);
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
 * Ensure the pack is on disk. Resolves true when usable; false only when all
 * three retries failed (the app still boots — text degrades and images stay
 * blank, exactly like the broken builds, but nothing crashes). Concurrent
 * callers share one promise. No-op on web/dev.
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

/* eslint-disable @typescript-eslint/no-var-requires */
function resolverModule(): { default: (mod: number) => unknown; setCustomSourceTransformer?: (fn: (r: unknown) => unknown) => void } | null {
  try {
    return require('react-native/Libraries/Image/resolveAssetSource');
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-var-requires */

/** Map a registered asset onto its file inside the pack, or null. */
export function packUriForAsset(asset: PackagerAsset): string | null {
  if (!packDir || !asset.httpServerLocation || !asset.name || !asset.type) return null;
  const scale = pickScale(asset.scales ?? [1], PixelRatio.get());
  const suffix = scale === 1 ? '' : '@' + scale + 'x';
  const base = asset.httpServerLocation.replace(/^\.\//, '');
  /* packDir already carries the file:// scheme + trailing slash (Directory.uri) */
  return packDir + base + '/' + asset.name + suffix + '.' + asset.type;
}

/**
 * Register the custom source transformer. Called once at module scope of the
 * root layout (native release only). While the pack is still downloading,
 * resolution falls back to RN's default (blank images during the splash —
 * components re-render with real file URIs once the pack lands).
 */
export function installNativeAssetPack(): void {
  if (Platform.OS === 'web' || __DEV__) return;
  const m = resolverModule() as unknown as {
    default?: { setCustomSourceTransformer?: (fn: (r: never) => unknown) => void };
  } | null;
  const set = m?.default?.setCustomSourceTransformer;
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

/**
 * Resolve a require()'d asset module id to its pack file URI, or null when
 * the pack is unavailable (web/dev/not-yet-downloaded). Used by content.ts
 * for the txt/gz datasets.
 */
export function resolvePackModule(mod: number): string | null {
  if (Platform.OS === 'web' || __DEV__ || !packDir) return null;
  const m = resolverModule() as unknown as { default?: (id: number) => { uri?: string } | null } | null;
  try {
    const r = m?.default?.(mod);
    return r?.uri?.startsWith('file://') ? r.uri : null;
  } catch {
    return null;
  }
}

/**
 * expo-image does not go through resolveAssetSource for numeric requires, so
 * its call sites wrap sources with this AT RENDER time (not module scope —
 * the pack may not be on disk yet when modules import):
 *   source={imgSource(isDark ? patternDark : patternLight)}
 * Non-numeric sources (remote uri strings/objects) pass through untouched.
 */
export function imgSource(src: unknown): ImageSourcePropType {
  if (Platform.OS === 'web' || __DEV__ || typeof src !== 'number') return src as ImageSourcePropType;
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
