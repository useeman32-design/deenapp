#!/usr/bin/env node
/* Extract the app's BUNDLED course content (CURRICULUM lessons + QUIZZES banks,
 * both plain object literals inside src/app/tools/courses.tsx) into JSON so the
 * server-side seeder can import it into the DB.
 *
 * Why: the owner's rule is that the admin/DB is the source of truth. The
 * original seven courses only ever lived in the app, which is why their lesson
 * counts looked stuck at 3 and why the admin quiz page showed nothing for
 * them. Importing the bundled set makes them editable and countable, and lets
 * the seeder top every course up to a real length.
 *
 * Usage: node scripts/extract-bundled-courses.mjs <outDir>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src/app/tools/courses.tsx';
const outDir = process.argv[2] || '.';

/** Slice a balanced { … } literal that starts at `open`, honouring strings. */
function literalAt(src, open) {
  if (src[open] !== '{' && src[open] !== '[') throw new Error('not an opener at ' + open);
  const close = { '{': '}', '[': ']' }[src[open]];
  let depth = 0;
  let i = open;
  let str = null;
  while (i < src.length) {
    const c = src[i];
    if (str) {
      if (c === '\\') { i += 2; continue; }
      if (c === str) str = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e + 1; continue; }
    if (c === src[open]) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(open, i + 1); }
    i++;
  }
  throw new Error('unbalanced literal starting at ' + open);
}

function grab(name) {
  const src = readFileSync(SRC, 'utf8');
  const re = new RegExp(`const ${name}\\s*(?::[^=]*)?=\\s*`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`${name} not found in ${SRC}`);
  const open = m.index + m[0].length;
  const text = literalAt(src, open);
  /* the literals are plain JS (types live on the declaration line), so a single
   * evaluation in a fresh scope is enough — no bundler, no React, no native. */
  const value = new Function(`"use strict"; return (${text});`)();
  return value;
}

const curriculum = grab('CURRICULUM');
const quizzes = grab('QUIZZES');

mkdirSync(outDir, { recursive: true });
const lessonsOut = {};
for (const [slug, lessons] of Object.entries(curriculum)) {
  if (!Array.isArray(lessons)) continue;
  lessonsOut[slug] = lessons.map((l) => ({
    title: String(l.title || ''),
    minutes: Number(l.minutes || 6),
    kind: l.kind === 'reading' ? 'reading' : 'lecture',
    paragraphs: Array.isArray(l.body) ? l.body.map((p) => String(p)) : [],
  }));
}
const quizOut = {};
for (const [slug, rows] of Object.entries(quizzes)) {
  if (!Array.isArray(rows)) continue;
  quizOut[slug] = rows.map((q) => ({
    q: String(q.q || ''),
    a: Array.isArray(q.a) ? q.a.map((x) => String(x)) : [],
    correct: Number(q.correct || 0),
    why: String(q.why || ''),
  }));
}
writeFileSync(join(outDir, 'bundled_curriculum.json'), JSON.stringify(lessonsOut, null, 1));
writeFileSync(join(outDir, 'bundled_quizzes.json'), JSON.stringify(quizOut, null, 1));
const slugs = new Set([...Object.keys(lessonsOut), ...Object.keys(quizOut)]);
console.log(`bundled courses: ${slugs.size} slug(s) · ${Object.values(lessonsOut).reduce((n, a) => n + a.length, 0)} lessons · ${Object.values(quizOut).reduce((n, a) => n + a.length, 0)} questions`);
console.log([...slugs].join(', '));
