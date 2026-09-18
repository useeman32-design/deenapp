#!/usr/bin/env bash
# ══ scripts/ship.sh — one command, the whole verified pass-88 deploy order ══
# WHY THIS EXISTS: pass 88 spent hours re-deriving the sequence and tripping on
# environment churn (node_modules and .git are NOT persisted between sandboxes).
# Everything below is the order that was verified working, with the gates that
# caught real bugs. Run it instead of re-inventing it.
#
#   GH_TOKEN=ghp_xxx EXPO_TOKEN=xxx bash scripts/ship.sh -m "pass 89: what changed"
#   bash scripts/ship.sh --check          # gates only (tsc + php -l), ships nothing
#   bash scripts/ship.sh -m "…" --eas     # also starts the EAS Android build
#   bash scripts/ship.sh -m "…" --api-only|--app-only
#
# Refuses to run if any commit would DELETE files: both hosts are "merge, never
# prune" (gh-pages must keep old chunks; the cPanel docroot is the raw export).
set -uo pipefail
cd "$(dirname "$0")/.."
APP=$PWD
API_DEFAULT="$(cd .. && pwd)/deenlink-api"
DEPLOY=${DEPLOY:-$(cd .. && pwd)/deploy}
MSG=""; DO_EAS=0; MODE=both; CHECK=0
while [ $# -gt 0 ]; do case "$1" in
  -m) MSG=$2; shift 2;; --eas) DO_EAS=1; shift;; --check) CHECK=1; shift;;
  --api-only) MODE=api; shift;; --app-only) MODE=app; shift;;
  *) echo "unknown flag: $1" >&2; exit 2;;
esac; done
if [ "$CHECK" != 1 ]; then [ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN is required (never stored in the repo)" >&2; exit 2; }; fi
say(){ printf '\n\033[1m▶ %s\033[0m\n' "$*" >&2; }   # stderr on purpose: sync_clone echoes a PATH through $( )
fail(){ printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
PHP=${PHP_BIN:-$(command -v php || command -v php8.4 || echo "")}
[ -n "$PHP" ] || { sudo apt-get update -qq >/dev/null 2>&1; sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq php8.4-cli >/dev/null 2>&1; PHP=$(command -v php8.4 || command -v php); }
[ -n "$PHP" ] || fail "no php — apt install php8.4-cli failed, set PHP_BIN=…"
[ -x "$PHP" ] || { [ -f "$PHP" ] && chmod +x "$PHP" 2>/dev/null; } || fail "no usable php binary (set PHP_BIN=…)"

say "0/6 npm ci (node_modules is not persisted between sandboxes)"
[ -d node_modules/react ] || npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
[ -d node_modules/react ] || fail "npm install did not produce node_modules"

say "1/6 tsc --noEmit"
./node_modules/.bin/tsc --noEmit -p tsconfig.json || fail "typecheck failed"
echo "   typecheck clean"

say "2/6 php -l over the API repo"
bad=0; n=0
while IFS= read -r f; do n=$((n+1)); "$PHP" -l "$f" >/dev/null 2>&1 || { echo "   LINT FAIL: $f"; bad=$((bad+1)); }; done \
  < <(find "$API_DEFAULT" -name '*.php' -not -path '*/node_modules/*' 2>/dev/null)
echo "   linted $n php files, $bad failures"
[ "$bad" = 0 ] || fail "php -l failures"
[ "$CHECK" = 1 ] && { say "gates only — nothing shipped"; exit 0; }
[ -n "$MSG" ] || fail "pass -m \"message\" (or use --check)"

sync_clone(){ # slug branch ; echoes the clone path (re-clones when .git was wiped)
  # one `local` per assignment: `local a=$1 b="$a--x"` reads the OUTER a under set -u
  local slug=$1
  local br=$2
  local dir="$DEPLOY/${slug}--${br}"
  if [ ! -d "$dir/.git" ]; then
    say "cloning $slug ($br) — the sandbox drops .git between sessions"
    rm -rf "$dir"; mkdir -p "$DEPLOY"
    GIT_ASKPASS=echo git clone -q --branch "$br" "https://x-access-token:${GH_TOKEN}@github.com/useeman32-design/${slug}.git" "$dir" \
      || fail "clone failed for $slug ($br)"
  fi
  ( cd "$dir" && git fetch -q origin "$br" && git checkout -q "$br" 2>/dev/null; git reset -q --hard "origin/$br" ) || fail "fetch/reset failed for $slug ($br)"
  echo "$dir"
}
commit_push(){ # dir branch message [repo-slug]  → refuses any commit that deletes files
  local dir=$1
  local br=$2
  local m=$3
  local slug=${4:-$(basename "$dir")}
  slug=${slug%%--*}
  [ -d "$dir/.git" ] || fail "commit_push: $dir is not a git clone (sync_clone failed earlier)"
  ( cd "$dir" && git add -A . && \
    { d=$(git diff --cached --diff-filter=D --name-only | wc -l); [ "$d" = 0 ] || { echo "   refusing: $d staged DELETIONS (merge, never prune)"; git reset -q; exit 1; }; } && \
    if git diff --cached --quiet; then echo "   $slug@$br: no changes to commit"; else \
      GIT_AUTHOR_NAME="DeenLink Dev" GIT_AUTHOR_EMAIL="dev@deenlink.org" GIT_COMMITTER_NAME="DeenLink Dev" GIT_COMMITTER_EMAIL="dev@deenlink.org" \
      git commit -q -m "$m" && GIT_ASKPASS=echo git push -q "https://x-access-token:${GH_TOKEN}@github.com/useeman32-design/${slug}.git" "HEAD:$br" && echo "   pushed $slug@$br $(git log --oneline -1 | cut -c1-40)"; fi ) \
    || fail "commit/push failed in $dir"
}

if [ "$MODE" != app ]; then
  say "3/6 raw export → cPanel docroot (CHECK-RAW gate is inside)"
  bash scripts/export-raw.sh 2>&1 | tee /tmp/ship-raw.log | tail -3
  grep -q "CHECK-RAW OK" /tmp/ship-raw.log || fail "raw export gate did not pass — refusing to ship"
  DL=$(sync_clone deenlink-api main)
  [ -d "$DL/.git" ] || fail "no API clone to ship into (DL=$DL)"
  cp -a "$APP/dist/." "$DL/"
  commit_push "$DL" main "$MSG" deenlink-api
fi
SRC=""
if [ "$MODE" != api ]; then
  say "4/6 app SOURCE push (deenapp@master — the repo EAS and cPanel builds come from)"
  SRC=$(sync_clone deenapp master)
  [ -d "$SRC/.git" ] || fail "no deenapp source clone (SRC=$SRC)"
  rsync -a --exclude 'node_modules/' --exclude '.expo/' --exclude 'dist/' --exclude 'android/' \
        --exclude '.git/' --exclude '*.log' --exclude 'web-build/' "$APP/" "$SRC/"
  commit_push "$SRC" master "$MSG" deenapp
  say "5/6 web export → gh-pages overlay (old chunks kept, no CNAME, never --delete)"
  bash scripts/export-web.sh 2>&1 | tail -2
  GH=$(sync_clone deenapp gh-pages)
  [ -d "$GH/.git" ] || fail "no gh-pages clone (GH=$GH)"
  cp -a "$APP/dist/." "$GH/"; rm -f "$GH/CNAME"
  commit_push "$GH" gh-pages "$MSG (gh-pages build)" deenapp
fi

say "6/6 live verification (both hosts must agree on the new entry hash)"
ENTRY=$(grep -o 'entry-[a-f0-9]*\.js' "$APP/dist/index.html" | head -1)
for host in "https://app.deenlink.org" "https://useeman32-design.github.io/deenapp"; do
  got=$(curl -s -m 30 "$host/" | grep -o 'entry-[a-f0-9]*\.js' | head -1)
  deep=$(curl -s -m 30 -o /dev/null -w '%{http_code}' "$host/tools/courses.html")
  printf '   %-42s entry=%s deep-link-page=HTTP %s %s\n' "$host" "${got:-none}" "$deep" "$([ "$got" = "$ENTRY" ] && echo ✓ || echo '← not published yet')"
done
[ -n "$SRC" ] && echo "   deenapp source: $(git -C "$SRC" log --oneline -1 2>/dev/null | cut -c1-40)"
if [ "$DO_EAS" = 1 ]; then
  say "EAS Android build (detached; log: /tmp/ship-eas.log)"
  EDIR="$SRC"
  [ -d "$EDIR" ] || EDIR="$DEPLOY/deenapp--master"
  [ -d "$EDIR" ] || fail "no deenapp source clone to build from — run without --app-only"
  [ -e "$EDIR/node_modules" ] || ln -sfn "$APP/node_modules" "$EDIR/node_modules"
  ( cd "$EDIR" && EXPO_TOKEN="${EXPO_TOKEN:-}" nohup npx --yes eas-cli@latest build --platform android --profile production --non-interactive > /tmp/ship-eas.log 2>&1 & )
  echo "   started from $EDIR — tail /tmp/ship-eas.log"
fi
say "done. Reminder: a cPanel push is NOT automatic — Git Version Control → Update from Remote → Deploy HEAD, then Admin → Course Tests → Professional 10."
