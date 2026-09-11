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
node scripts/check-raw.mjs dist
echo "✅ RAW export ready in dist/ → ship to app.deenlink.org ROOT (merge, never prune)."
