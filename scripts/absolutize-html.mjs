/**
 * ABSOLUTE-PATH PASS (pass 88) — RAW / cPanel-root flavor only.
 *
 * The Expo export is built with `experiments.baseUrl = "."` so every exported
 * page references its assets RELATIVE to itself (`src="./_expo/…"`,
 * `href="./assets/…"`). At the site root that is harmless, but refreshing a
 * deep link (app.deenlink.org/tools/courses) resolved them to
 * /tools/_expo/… → 404 → a BLANK WHITE page until the owner navigated back to
 * app.deenlink.org (their exact report). The root artifact is served from a
 * known absolute root, so make every reference absolute.
 *
 * gh-pages (export-web.sh) must KEEP the relative form — it is served under the
 * /deenapp/ subpath — so this script deliberately runs only for the raw flavor.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] || 'dist';
/* prefix for this flavor: '' for the cPanel root, '/deenapp' for GitHub Pages */
const PREFIX = (process.argv[3] || '').replace(/\/+$/, '');
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

let changed = 0;
for (const f of walk(dist)) {
  if (!/\.html$/.test(f)) continue;
  const before = readFileSync(f, 'utf8');
  let s = before;
  /* "./_expo/…", "./assets/…", "./manifest.json" … → "/_expo/…", "/assets/…" */
  s = s.replace(/(src|href)="\.\/+/g, `$1="${PREFIX}/`);
  /* the export also emits root-relative-less refs like href="manifest.json" */
  s = s.replace(/(src|href)="(manifest\.json|favicon\.ico)"/g, `$1="${PREFIX}/$2"`);
  if (s !== before) {
    writeFileSync(f, s);
    changed++;
  }
}
console.log(`ABSOLUTE-PASS OK — ${changed} html file(s) now reference ${PREFIX || ''}/_expo and ${PREFIX || ''}/assets absolutely`);
