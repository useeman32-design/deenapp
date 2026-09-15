#!/usr/bin/env bash
# Build the DeenLink web app for the LIVE site (app.deenlink.org serves it from
# the deenlink-api repo ROOT, so asset URLs stay "/…"). Same router patch as
# export-web.sh but with BASE "/" — keeps the slash-guard so expo-router never
# mangles paths like "/onboarding" into "/deenapponboarding"-style bugs.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-dist-root}"
# ROOT deploy: expo's own base is "" — do NOT rewrite the bundle default to "/",
# because every appendBaseUrl() call site omits the arg and n="/" collapses to
# "//"+path → replaceState('//') → SecurityError white screen (verified live).
# The slash-guard on `t` alone is safe and still prevents missing-slash paths.
BASE=""

rm -rf "$OUT"
npx expo export --platform web --clear --output-dir "$OUT"

SLASHGUARD='t=String(t);if(!t.startsWith("/"))t="/"+t;'
for f in "$OUT"/_expo/static/js/web/entry-*.js; do
  node -e '
    const fs = require("fs");
    const [f, base, guard] = process.argv.slice(1);
    let s = fs.readFileSync(f, "utf8");
    const rep = (m, r) => r + "URLFN" + "=function(t,n=\"" + base + "\"){" + guard;
    s = s.replace(/([A-Za-z_$][\w$]*)\.getUrlWithReactNavigationConcessions=function\(t,n="[^"]*"\)\{/g, (m, r) => r + ".getUrlWithReactNavigationConcessions=function(t,n=\"" + base + "\"){" + guard);
    s = s.replace(/([A-Za-z_$][\w$]*)\.appendBaseUrl=function\(t,n="[^"]*"\)\{/g, (m, r) => r + ".appendBaseUrl=function(t,n=\"" + base + "\"){" + guard);
    fs.writeFileSync(f, s);
  ' "$f" "$BASE" "$SLASHGUARD"
  grep -q 'startsWith("/"))t="/"+t' "$f" || { echo "ERROR: router patch failed on $f" >&2; exit 1; }
done

cp "$OUT/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"

echo "✅ Root-base export ready in $OUT/ → deploy as the web root of deenlink-api."
