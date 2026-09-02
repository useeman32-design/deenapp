#!/usr/bin/env node
/* Unpack assets/content.zip -> assets/content/** (the user's dataset pack).
 * Pure Node (works on Windows/macOS/Linux — no python/unzip needed).
 * NOTE: the zip is NOT tracked in git (.gitignore line "assets/content.zip").
 * It is fetched on demand, or recovered from git history — see PACK_URLS below.
 * The extracted files are what Metro bundles (src/lib/content.ts requires 147
 * of them, 29 as hadith/*.txt.gz).
 * Runs automatically via `npm install` (postinstall) and export-web.sh. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';

const ZIP = process.env.DL_CONTENT_ZIP ?? "assets/content.zip"; // zip dropped from the repo (size) — re-download the pack if rebuilding from scratch
const OUT = 'assets/content';
/* pass 34d: stable home of the content pack (gh-pages, served verbatim).
 * pass 43: the gh-pages copy 404'd, so this is now a FALLBACK LIST — first 200 wins.
 * npm install downloads it automatically on a fresh clone. */
const PACK_URLS = (process.env.DL_CONTENT_URL ?? [
  'https://useeman32-design.github.io/deenapp/content/content.zip',
  'https://raw.githubusercontent.com/useeman32-design/deenapp-backup/master/content-pack/content.zip',
].join(',')).split(',').map((u) => u.trim()).filter(Boolean);

/* The pack also survives as a git blob in deenapp history (full clone only).
 * This is the last-resort recovery path — printed when every URL fails. */
const PACK_BLOB = '162e59f35e978a359547642ddd4e0e5ad7756f95'; // content/content.zip, 17188371 B, hadith as .txt.gz

/* markers: if all exist the pack is already in place — nothing to do */
const MARKERS = [
  join('quran', 'surah_1.txt'),
  join('quran', 'surah_114.txt'),
  join('hadith', 'buhari.txt.gz'),
  join('hadith', 'nawawi40.txt.gz'),
  join('hadith', 'meta_buhari.txt.gz'),
  join('islamic', 'dua.txt'),
  join('islamic', 'seera_events_en.txt'),
];
const packPresent = () => MARKERS.every((m) => existsSync(join(OUT, m)));

/* download the pack (Node 18+ fetch, works on Windows/macOS/Linux) */
async function downloadPack(dest) {
  const tried = [];
  for (const url of PACK_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) { tried.push(`${url} -> ${res.status}`); continue; }
      const total = +(res.headers.get('content-length') ?? 0);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
      console.log(`unpack-content: downloaded pack ${buf.length} bytes${total ? ` / ${total}` : ''} <- ${url}`);
      return;
    } catch (e) {
      tried.push(`${url} -> ${e?.message ?? e}`);
    }
  }
  throw new Error(
    `unpack-content: content pack unavailable.\n` +
    `  tried:\n    ${tried.join('\n    ')}\n` +
    `  RECOVER FROM GIT HISTORY (requires a FULL, non-shallow clone):\n` +
    `    git cat-file blob ${PACK_BLOB} > ${ZIP}\n` +
    `    node scripts/unpack-content.mjs\n` +
    `  or drop the pack at ${ZIP} manually and re-run.`
  );
}

/* minimal zip reader: walk the central directory (deterministic, no python) */
function unzip(zipPath, outDir) {
  const buf = readFileSync(zipPath);
  const SIG = 0x06054b50; // end-of-central-directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('unpack-content: not a zip (no EOCD)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset
  let n = 0;
  for (let c = 0; c < count; c++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    /* local header: skip its name/extra too */
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? raw : inflateRawSync(raw);
    const dest = join(outDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    n++;
  }
  return n;
}

async function main() {
  if (packPresent()) {
    console.log('unpack-content: content pack already present — ok');
    return;
  }
  let zip = ZIP;
  if (!existsSync(zip)) {
    console.log('unpack-content: pack missing on a fresh clone — downloading…');
    await downloadPack(zip);
  }
  const n = unzip(zip, OUT);
  console.log(`unpack-content: extracted ${n} files -> ${OUT}/`);
}
main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
