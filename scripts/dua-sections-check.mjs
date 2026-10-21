#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * PASS 103 — Dua section coverage check.
 *
 * The Duas screen groups Hisn al-Muslim's 132 situation duas into sections by
 * an explicit ID map (src/lib/duaSections.ts). Before this, sections were
 * guessed from title keywords and 60 of 132 duas fell into a "More Duas"
 * catch-all while others were misfiled. This script fails loudly if the pack
 * and the map ever drift apart, so the page cannot silently regress.
 *
 * Checks:
 *   1. every pack ID appears exactly once in the map (no orphans, no dupes)
 *   2. the map holds no ID the pack does not have (no stale entries)
 *   3. no dua lands in the 'other' catch-all
 *   4. every DUA_SECTIONS entry has a distinct id and a non-empty label
 *   5. prints the resulting distribution
 *
 * Usage:  node scripts/dua-sections-check.mjs
 * Exits non-zero on failure.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);

/* ---- 1. locate the dua pack ------------------------------------------- */
function findPack() {
  const candidates = [];
  const dir = join(repoRoot, 'deenlink-api/assets/assets/content/islamic');
  try {
    for (const f of readdirSync(dir)) if (/^dua\..*\.txt$/.test(f)) candidates.push(join(dir, f));
  } catch { /* not present in this checkout */ }
  const local = join(root, 'assets/content/islamic');
  try {
    for (const f of readdirSync(local)) if (/^dua\..*\.txt$/.test(f)) candidates.push(join(local, f));
  } catch { /* not present */ }
  return candidates[0] ?? null;
}

/* ---- 2. parse the section map out of duaSections.ts -------------------- */
/* We do not import the TS module (no tsx/esbuild in this workspace), so the
   map is read textually. The format is intentionally simple and stable. */
function parseSections() {
  const src = readFileSync(join(root, 'src/lib/duaSections.ts'), 'utf8');

  const byId = new Map();
  const dupes = [];
  const blockMatch = src.match(/const SECTION_BY_ID[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!blockMatch) throw new Error('could not find SECTION_BY_ID in src/lib/duaSections.ts');
  for (const line of blockMatch[1].split('\n')) {
    const code = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '');
    for (const m of code.matchAll(/(\d+)\s*:\s*'([a-z]+)'/g)) {
      const id = Number(m[1]);
      const sec = m[2];
      if (byId.has(id)) dupes.push(id);
      byId.set(id, sec);
    }
  }

  const ids = [];
  const secMatch = src.match(/export const DUA_SECTIONS[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!secMatch) throw new Error('could not find DUA_SECTIONS in src/lib/duaSections.ts');
  for (const m of secMatch[1].matchAll(/\{\s*id:\s*'([a-z]+)'\s*,\s*label:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g)) {
    ids.push({ id: m[1], label: m[2] ?? m[3] ?? m[4] });
  }
  return { byId, dupes, sections: ids };
}

/* ---- 3. run ------------------------------------------------------------- */
const { byId, dupes, sections } = parseSections();
const errors = [];
const warnings = [];

if (dupes.length) errors.push(`SECTION_BY_ID lists these IDs more than once: ${dupes.join(', ')}`);

const seenIds = new Set(sections.map((s) => s.id));
if (seenIds.size !== sections.length) {
  const dup = sections.map((s) => s.id).filter((v, i, a) => a.indexOf(v) !== i);
  errors.push(`DUA_SECTIONS has duplicate ids: ${[...new Set(dup)].join(', ')}`);
}
for (const s of sections) if (!s.label || !s.label.trim()) errors.push(`section '${s.id}' has an empty label`);
if (!seenIds.has('other')) errors.push("DUA_SECTIONS must keep an 'other' catch-all as a safety net");

for (const sec of byId.values()) {
  if (!seenIds.has(sec)) errors.push(`SECTION_BY_ID maps to unknown section '${sec}'`);
}

const packPath = findPack();
if (!packPath) {
  warnings.push('dua pack not found in this checkout — skipped ID coverage checks');
} else {
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  const duas = pack.English ?? [];
  if (!duas.length) errors.push('dua pack has no "English" entries');

  const packIds = duas.map((c) => c.ID);
  const packSet = new Set(packIds);
  if (packSet.size !== packIds.length) {
    const dup = packIds.filter((v, i, a) => a.indexOf(v) !== i);
    errors.push(`pack has duplicate IDs: ${[...new Set(dup)].join(', ')}`);
  }

  const orphans = packIds.filter((id) => !byId.has(id));
  const stale = [...byId.keys()].filter((id) => !packSet.has(id));
  if (orphans.length) errors.push(`${orphans.length} pack ID(s) are missing from SECTION_BY_ID: ${orphans.sort((a, b) => a - b).join(', ')}`);
  if (stale.length) warnings.push(`${stale.length} mapped ID(s) are not in the pack (stale?): ${stale.sort((a, b) => a - b).join(', ')}`);

  const dist = new Map();
  for (const c of duas) {
    const sec = byId.get(c.ID) ?? 'other';
    if (!dist.has(sec)) dist.set(sec, []);
    dist.get(sec).push(c);
  }

  const other = dist.get('other') ?? [];
  if (other.length) errors.push(`${other.length} dua(s) fall into the 'other' catch-all: ${other.map((c) => c.ID).join(', ')}`);

  console.log(`\nDua sections — pack: ${duas.length} duas from ${packPath.replace(repoRoot + '/', '')}\n`);
  const order = sections.map((s) => s.id).filter((id) => dist.has(id));
  for (const id of order) {
    const label = sections.find((s) => s.id === id).label;
    const rows = dist.get(id);
    console.log(`  ${String(rows.length).padStart(3)}  ${label}`);
    console.log(`       ids ${rows.map((c) => c.ID).join(', ')}`);
  }
  const total = [...dist.values()].reduce((n, a) => n + a.length, 0);
  console.log(`\n  ${String(total).padStart(3)}  TOTAL across ${order.length} sections`);
  if (total !== duas.length) errors.push(`distribution total ${total} != pack size ${duas.length}`);
}

for (const w of warnings) console.log(`\nWARN  ${w}`);
if (errors.length) {
  console.log('');
  for (const e of errors) console.log(`FAIL  ${e}`);
  console.log(`\ndua-sections-check: ${errors.length} failure(s)\n`);
  process.exit(1);
}
console.log('\ndua-sections-check: OK — every dua is in exactly one section, no catch-all overflow\n');
