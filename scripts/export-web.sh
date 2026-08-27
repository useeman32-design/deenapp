#!/usr/bin/env bash
# Build the DeenLink web app for GitHub Pages (https://useeman32-design.github.io/deenapp/).
# 1. Static export via Metro
# 2. Rewrite root-absolute asset/JS URLs to the /deenapp/ subpath (Pages serves repos under /<repo>/)
# 3. Patch the router base-URL defaults (this Expo SDK bakes EXPO_BASE_URL out of the bundle)
# 4. Add 404.html fallback so client-side deep links work on Pages
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="/deenapp/"

rm -rf dist
npx expo export --platform web --clear

# This Expo version bakes process.env.EXPO_BASE_URL out of the bundle, so the
# router forgets the Pages subpath. Patch the base-URL defaults in the bundle.
# Patch both the base-URL default AND guard the path arg to always start with a
# slash (expo-router sometimes passes slash-less paths, which mangles the URL
# into e.g. /deenapponboarding).
SLASHGUARD='t=String(t);if(!t.startsWith("/"))t="/"+t;'
for f in dist/_expo/static/js/web/entry-*.js; do
  perl -pi -e "s#e\\.getUrlWithReactNavigationConcessions=function\\(t,n=\"\"\\)\\{#e.getUrlWithReactNavigationConcessions=function(t,n=\"${BASE}\"){${SLASHGUARD}#g; s#e\\.appendBaseUrl=function\\(t,n=\"\"\\)\\{#e.appendBaseUrl=function(t,n=\"${BASE}\"){${SLASHGUARD}#g" "$f"
  grep -q 'startsWith("/"))t="/"+t' "$f" || { echo "ERROR: router patch failed on $f" >&2; exit 1; }
done

# Rewrite absolute URLs in all text assets of the export.
# Metro emits double-quoted refs like uri:"/assets/..." — the leading " is part of the match.
find dist -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.json" -o -name "*.svg" -o -name "*.map" \) -print0 |
  xargs -0 perl -pi -e "s#\"/_expo/#\"${BASE}_expo/#g; s#\"/assets/#\"${BASE}assets/#g"

# SPA fallback for GitHub Pages deep links.
cp dist/index.html dist/404.html

# GitHub Pages runs Jekyll, which drops folders starting with "_" (_expo/ holds the JS).
touch dist/.nojekyll

echo "✅ Export ready in dist/ → deploy to gh-pages branch."
