#!/usr/bin/env bash
# Build the DeenLink web app for the LIVE site (app.deenlink.org serves it from
# the deenlink-api repo ROOT, so asset URLs stay "/…"). Same router patch as
# export-web.sh but with BASE "/" — keeps the slash-guard so expo-router never
# mangles paths like "/onboarding" into "/deenapponboarding"-style bugs.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-dist-root}"
BASE="/"

rm -rf "$OUT"
npx expo export --platform web --clear --output-dir "$OUT"

SLASHGUARD='t=String(t);if(!t.startsWith("/"))t="/"+t;'
for f in "$OUT"/_expo/static/js/web/entry-*.js; do
  perl -pi -e "s#e\\.getUrlWithReactNavigationConcessions=function\\(t,n=\"\"\\)\\{#e.getUrlWithReactNavigationConcessions=function(t,n=\"${BASE}\"){${SLASHGUARD}#g; s#e\\.appendBaseUrl=function\\(t,n=\"\"\\)\\{#e.appendBaseUrl=function(t,n=\"${BASE}\"){${SLASHGUARD}#g" "$f"
  grep -q 'startsWith("/"))t="/"+t' "$f" || { echo "ERROR: router patch failed on $f" >&2; exit 1; }
done

cp "$OUT/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"

echo "✅ Root-base export ready in $OUT/ → deploy as the web root of deenlink-api."
