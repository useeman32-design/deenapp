#!/usr/bin/env bash
# Build the DeenLink web app for GitHub Pages (https://useeman32-design.github.io/deenapp/).
# 1. Static export via Metro
# 2. Rewrite root-absolute asset/JS URLs to the /deenapp/ subpath (Pages serves repos under /<repo>/)
# 3. Add 404.html fallback so client-side deep links work on Pages
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="/deenapp/"

rm -rf dist
npx expo export --platform web

# Rewrite absolute URLs in all text assets of the export.
find dist -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.json" -o -name "*.svg" -o -name "*.map" \) -print0 |
  xargs -0 perl -pi -e '
    s{"/_expo/}{"'"$BASE"'_expo/}g;
    s{'"'"'/_expo/}{'"'"$BASE"'_expo/}g;
    s{"/assets/}{"'"$BASE"'assets/}g;
    s{'"'"'/assets/}{'"'"$BASE"'assets/}g;
  '

# SPA fallback for GitHub Pages deep links.
cp dist/index.html dist/404.html

echo "✅ Export ready in dist/ → deploy to gh-pages branch."
