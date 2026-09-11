// CHECK-RAW — HARD GATE before anything from dist/ goes to the cPanel ROOT
// (app.deenlink.org). This exists because TWICE (83-31c, 83-33b) the
// GitHub-Pages flavor (base /deenapp/) was copied to the root and the live
// app went white. RULE: the root artifact must contain ZERO /deenapp/ refs.
// Usage: node scripts/check-raw.mjs [distDir=default dist]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] || 'dist';
let bad = 0;
const fail = (msg) => { bad++; console.error('✗ ' + msg); };

if (!existsSync(join(dist, 'index.html'))) fail(`${dist}/index.html missing`);

const index = readFileSync(join(dist, 'index.html'), 'utf8');
if (index.includes('/deenapp/')) fail('index.html contains /deenapp/ refs (GH flavor!)');
const entry = index.match(/src="([^"]*entry-[^"]+\.js)"/);
if (!entry) fail('no entry-*.js referenced in index.html');
else {
  const entryPath = join(dist, entry[1].replace(/^\//, ''));
  if (!existsSync(entryPath)) fail(`entry chunk missing on disk: ${entry[1]}`);
  else {
    const head = readFileSync(entryPath, 'utf8').slice(0, 400000);
    if (head.includes('uri:"/deenapp/') || head.includes('"/deenapp/_expo/')) fail('entry chunk contains /deenapp/ asset refs');
  }
}
if (index.includes('rel="manifest"') === false) fail('manifest link missing (PWA)');

// scan every html + the referenced assets dir for stray prefixes
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    /* the /deenapp/ SUBDIR at the cPanel root is the intentional legacy
     * flavor home (kept for incident-window cached pages) — its prefixed
     * refs are BY DESIGN and are not a root-scope problem. */
    if (statSync(p).isDirectory()) { if (f !== 'deenapp') walk(p, out); }
    else out.push(p);
  }
  return out;
};
let scanned = 0;
for (const f of walk(dist)) {
  if (!/\.(html|js|css|json)$/.test(f)) continue;
  scanned++;
  const s = readFileSync(f, 'utf8');
  if (s.includes('"/deenapp/') || s.includes('href="/deenapp/') || s.includes('src="/deenapp/')) {
    fail(`stray /deenapp/ ref in ${f}`);
    if (bad > 8) break;
  }
}

if (bad) { console.error(`CHECK-RAW FAILED (${bad} problems, ${scanned} files scanned) — DO NOT ship to the cPanel root.`); process.exit(1); }
console.log(`CHECK-RAW OK — ${scanned} files, zero /deenapp/ refs, entry present. Safe for the cPanel root.`);
