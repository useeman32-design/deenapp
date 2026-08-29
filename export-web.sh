#!/bin/bash
# DeenLink web export for GitHub Pages (base path /deenapp/)
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist

# the user's dataset pack: extract the tracked zip before bundling
[ -f assets/content/quran/surah_1.txt ] || node scripts/unpack-content.mjs

npx expo export --platform web --output-dir dist/deenapp

BASE=/deenapp

# GitHub Pages: disable Jekyll so underscore dirs (_expo) are served
touch dist/deenapp/.nojekyll

# SLASHGUARD — prefix absolute references with the GitHub Pages subpath
# (asset uris, router base default, base-stripping for route matching, HTML tags)
node scripts/slashguard.mjs

node --check dist/deenapp/_expo/static/js/web/entry-*.js
echo "export-web ok: $(ls dist | tr '\n' ' ')"

# SPA fallback for deep links (/deenapp/read/55 etc.) — GitHub Pages 404.html
cp dist/deenapp/index.html dist/deenapp/404.html
echo "404 fallback installed"
