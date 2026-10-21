#!/usr/bin/env bash
# build-android.sh — produce the Play-ready AAB, or tell you precisely why not.
#
# Usage:
#   EXPO_TOKEN=... bash scripts/build-android.sh            # token in env
#   bash scripts/build-android.sh /path/to/expo_token_file  # or token in a file
#
# Deliberately does NOT call `eas submit`: submitting needs a Google service
# account JSON, and the first upload is a two-minute drag-and-drop in Play
# Console anyway. It prints the AAB artifact URL at the end.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${EXPO_TOKEN:-}" ]; then
  TOKEN="$EXPO_TOKEN"
elif [ -n "${1:-}" ] && [ -f "${1}" ]; then
  TOKEN="$(cat "$1")"
else
  echo "ERROR: no Expo token."
  echo "  export EXPO_TOKEN=...   or   bash scripts/build-android.sh /path/to/token_file"
  echo "  The previous token was pasted into a chat and must be treated as revoked."
  exit 2
fi

# Never let the token leak into the log or into a committed file.
export EXPO_TOKEN="$TOKEN"

echo "== 1. sanity: the content pack must be present or the cloud build fails =="
for m in assets/content/quran/surah_1.txt \
         assets/content/quran/surah_114.txt \
         assets/content/hadith/buhari.txt.gz \
         assets/content/hadith/nawawi40.txt.gz \
         assets/content/hadith/meta_buhari.txt.gz \
         assets/content/islamic/dua.txt \
         assets/content/islamic/seera_events_en.txt; do
  [ -f "$m" ] || { echo "  MISSING $m (see .easignore header)"; exit 3; }
done
echo "  all 7 unpack markers present"

echo "== 2. sanity: .easignore must NOT exclude the content pack =="
if [ ! -f .easignore ]; then
  echo "  MISSING .easignore - the cloud build would exclude assets/content and fail"
  exit 4
fi
if grep -qE '^\s*content/?\s*$|assets/content' .easignore; then
  echo "  .easignore excludes the content pack - fix it before building"
  exit 5
fi
echo "  ok"

echo "== 3. typecheck before spending a cloud build =="
./node_modules/.bin/tsc --noEmit || { echo "  tsc failed - fix before building"; exit 6; }
echo "  tsc clean"

PROFILE="${PROFILE:-production}"
echo "== 4. EAS build (profile: $PROFILE) =="
echo "  If this fails on SDK 57, first try experiments.reactCompiler=false in app.json."
npx eas-cli build --platform android --profile "$PROFILE" --non-interactive

echo
echo "== done =="
echo "  Take the .aab URL printed above, download it, and upload it in"
echo "  Play Console -> Testing -> Closed testing -> Create release."
echo "  Then add 14-15 testers (not 12 - people flake) and send the opt-in link."
