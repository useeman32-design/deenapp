#!/usr/bin/env bash
# export-raw.sh — the ONLY sanctioned way to produce the artifact for the
# cPanel ROOT (app.deenlink.org). Builds the RAW flavor (no /deenapp/ base),
# runs the CHECK-RAW gate, and fails loudly. Never copy dist/ to the root
# unless THIS script printed "CHECK-RAW OK" as its last line.
#   (gh-pages artifact = scripts/export-web.sh — different flavor, different target.)
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
npx expo export --platform web --clear
BASE= node scripts/slashguard.mjs
# pass 83-35 — the PWA manifest link was only ever hand-added to gh-pages; the
# root artifact must have it too (A2HS install on app.deenlink.org).
node -e "const{readFileSync,writeFileSync}=require('node:fs');let h=readFileSync('dist/index.html','utf8');if(!h.includes('rel=\"manifest\"')){h=h.replace('</head>','<link rel=\"manifest\" href=\"/manifest.json\"/></head>');writeFileSync('dist/index.html',h);console.log('manifest link injected');}"
node scripts/check-raw.mjs dist
echo "✅ RAW export ready in dist/ → ship to app.deenlink.org ROOT (merge, never prune)."
