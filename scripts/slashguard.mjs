// SLASHGUARD — make the static web export work under the /deenapp/ subpath.
// 1) JS asset uris:   uri:"/assets/..."        -> uri:"/deenapp/assets/..."
// 2) router base:     appendBaseUrl(t, n="")   -> appendBaseUrl(t, n="/deenapp/")
// 3) base stripping:  extractExpoPathFromURL also drops a leading /deenapp/ so
//    route matching + relative anchor hrefs work under the subpath.
// 4) HTML tags:       src="/..." href="/..."   -> prefixed
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE || '/deenapp';
const files = execSync('find dist -type f \\( -name "*.js" -o -name "*.html" \\)').toString().trim().split('\n').filter(Boolean);

const OLD_EXT = 'extractExpoPathFromURL=function(t,n=""){return o(n).replace(/^\\//,\'\')}';
const NEW_EXT = `extractExpoPathFromURL=function(t,n=""){return o(n).replace(/^\\/?deenapp\\//,'').replace(/^\\//,'')}`;

let changed = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  const before = s;
  // idempotent: skip tokens already prefixed with the base
  s = s.replace(/uri:"\/(?!(deenapp)\/)/g, `uri:"${BASE}/`);
  s = s.replace(/src="\/(?!(deenapp)\/)/g, `src="${BASE}/`);
  s = s.replace(/href="\/(?!(deenapp)\/)/g, `href="${BASE}/`);
  // module-export asset strings: exports="/assets/..." -> prefixed
  s = s.replace(/(["'])\/assets\/(?!deenapp)/g, `$1${BASE}/assets/`);
  s = s.split('appendBaseUrl=function(t,n="")').join(`appendBaseUrl=function(t,n="${BASE}/")`);
  s = s.split('appendBaseUrl=function(t,n="/")').join(`appendBaseUrl=function(t,n="${BASE}/")`);
  if (s.includes(OLD_EXT)) s = s.split(OLD_EXT).join(NEW_EXT);
  if (s !== before) {
    changed += 1;
    writeFileSync(f, s);
  }
}
console.log(`slashguard: ${files.length} files scanned, ${changed} modified`);
