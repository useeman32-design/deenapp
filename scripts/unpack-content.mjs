#!/usr/bin/env node
/* Unpack assets/content.zip -> assets/content/** (the user's dataset pack).
 * Pure Node (works on Windows/macOS/Linux — no python/unzip needed).
 * The zip is tracked in git; the extracted .txt files are what Metro bundles.
 * Runs automatically via `npm install` (postinstall) and export-web.sh. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';

const ZIP = 'assets/content.zip';
const OUT = 'assets/content';

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

if (!existsSync(ZIP)) {
  if (existsSync(join(OUT, 'quran', 'surah_1.txt'))) {
    console.log('unpack-content: already unpacked (zip absent) — ok');
    process.exit(0);
  }
  console.error(`unpack-content: ${ZIP} not found — it must be tracked in git.`);
  process.exit(1);
}

const n = unzip(ZIP, OUT);
console.log(`unpack-content: extracted ${n} files -> ${OUT}/`);
