import { Platform } from "react-native";

/**
 * pass 85 — offline Qur'an recitation audio (native only).
 *
 * Downloads the per-ayah mp3s of one surah (for the selected reciter) into
 * <documents>/quran-audio/<reciter>/<surah>/NNN.mp3 plus an index.json, so
 * the reader plays from disk afterwards — works with the app closed and with
 * no network. A synchronous in-memory registry (key `${reciter}/${surah}`)
 * is what the audio provider consults BEFORE any CDN lookup; it is rebuilt
 * at boot and mutated by save/remove. Web: everything is a silent no-op.
 *
 * Fails safe by design: a missing/corrupt file simply falls back to the
 * remote URL — an interrupted download never mutes the reader.
 */

const DIR = "quran-audio";

type Entry = { count: number; dirUri: string };
const saved = new Map<string, Entry>();
let booted = false;

const key = (reciter: string, surah: number) => `${reciter}/${surah}`;

export const isOfflineCapable = () =>
  Platform.OS === "android" || Platform.OS === "ios";

/* dynamic import keeps web bundles from touching native FS bindings */
async function fs() {
  return await import("expo-file-system");
}

function has(o: unknown): boolean {
  try {
    return !!(o as { exists?: boolean } | null)?.exists;
  } catch {
    return false;
  }
}

/** uri when surah+ayah are downloaded for this reciter, else null */
export function localAyahUri(
  reciter: string,
  surah: number,
  ayah: number,
): string | null {
  if (!saved.size) return null;
  const e = saved.get(key(reciter, surah));
  if (!e || ayah < 1 || ayah > e.count) return null;
  const a3 = String(ayah).padStart(3, "0");
  return `${e.dirUri}/${a3}.mp3`;
}

/** number of locally cached ayahs (0 = none) */
export function isSurahSaved(reciter: string, surah: number): number {
  return saved.get(key(reciter, surah))?.count ?? 0;
}

/** rebuild the sync registry from disk (called once at module load) */
export async function loadRegistry(): Promise<void> {
  if (!isOfflineCapable() || booted) return;
  booted = true;
  try {
    const { Directory, File, Paths } = await fs();
    const root = new Directory(Paths.document, DIR);
    if (!has(root)) return;
    for (const rec of root.list()) {
      try {
        const recName = String(rec.name ?? "");
        if (!recName) continue;
        const recDir = new Directory(root, recName);
        for (const s of recDir.list()) {
          const surahName = String(s.name ?? "");
          if (!/^\d{1,3}$/.test(surahName)) continue;
          try {
            const idx = new File(recDir, surahName, "index.json");
            if (!has(idx)) continue;
            const meta = JSON.parse(idx.textSync() || "{}");
            const count = Math.max(0, Math.min(287, Number(meta?.count) || 0));
            const surah = Number(surahName);
            if (count > 0 && surah >= 1 && surah <= 114)
              saved.set(key(recName, surah), {
                count,
                dirUri: `${recDir.uri}/${surahName}`,
              });
          } catch {
            /* one bad surah folder must not break the scan */
          }
        }
      } catch {
        /* unreadable reciter folder — skip */
      }
    }
  } catch {
    /* no FS access (Expo Go limitation on old SDKs, weird perms): remote-only */
  }
}

/**
 * Downloads surah 1..ayahCount mp3s for `reciter`. `urlFor` receives the
 * provider-built per-ayah URL (same one playback uses, minus the local
 * lookup — the caller in QuranAudioContext exports the remote builder).
 */
export async function saveSurah(
  reciter: string,
  surah: number,
  ayahCount: number,
  urlFor: (ayah: number) => string,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  if (!isOfflineCapable())
    throw new Error("offline saves are a device feature");
  if (!(ayahCount > 0) || ayahCount > 287) throw new Error("invalid ayah count");
  const { File, Directory, Paths } = await fs();
  const dir = new Directory(Paths.document, DIR, reciter, String(surah));
  dir.create({ intermediates: true, overwrite: false });
  for (let a = 1; a <= ayahCount; a++) {
    const dest = new File(dir, `${String(a).padStart(3, "0")}.mp3`);
    if (!has(dest)) await File.downloadFileAsync(urlFor(a), dest);
    onProgress(a, ayahCount);
  }
  new File(dir, "index.json").write(
    JSON.stringify({ reciter, surah, count: ayahCount, at: Date.now() }),
  );
  saved.set(key(reciter, surah), { count: ayahCount, dirUri: dir.uri });
}

export async function removeSurah(
  reciter: string,
  surah: number,
): Promise<void> {
  if (!isOfflineCapable()) return;
  try {
    const { Directory, Paths } = await fs();
    const dir = new Directory(Paths.document, DIR, reciter, String(surah));
    if (has(dir)) dir.delete();
  } catch {
    /* best effort */
  }
  saved.delete(key(reciter, surah));
}

/* kick the registry off as soon as the bundle loads (no-op on web) */
void loadRegistry();
