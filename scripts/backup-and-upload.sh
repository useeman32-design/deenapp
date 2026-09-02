#!/usr/bin/env bash
# pass 43: create the PRIVATE deenapp-backup repo, mirror-push everything to it,
# and restore content/content.zip on gh-pages so fresh clones can npm ci.
#
# The token is NEVER stored here. Supply it one of two ways:
#   DL_TOKEN=ghp_xxx bash scripts/backup-and-upload.sh
#   echo -n 'ghp_xxx' > .token && bash scripts/backup-and-upload.sh   # .token is gitignored
#
# Safe to re-run: repo creation is idempotent, mirror push is a force-update.
set -euo pipefail
cd "$(dirname "$0")/.."

TOK="${DL_TOKEN:-$( [ -f .token ] && cat .token || true )}"
if [ -z "${TOK// /}" ]; then
  echo "ERROR: no token. Use DL_TOKEN=... or write it to .token (gitignored)." >&2
  exit 2
fi

OWNER="useeman32-design"
SRC="$OWNER/deenapp"
BAK="$OWNER/deenapp-backup"
API="https://api.github.com"
AUTH=(-H "Authorization: token $TOK" -H "Accept: application/vnd.github+json")
mask() { sed -E "s/$TOK/<TOKEN>/g"; }

echo "== 1/6 verify token =="
LOGIN=$(curl -sS "${AUTH[@]}" "$API/user" 2>/dev/null | grep -m1 '"login"' | sed -E 's/.*: *"([^"]+)".*/\1/' || true)
if [ -z "${LOGIN:-}" ]; then echo "ERROR: token rejected by $API/user — it is expired/revoked." >&2; exit 3; fi
echo "   authenticated as: $LOGIN"

echo "== 2/6 ensure private backup repo exists =="
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$API/repos/$BAK")
if [ "$CODE" = "200" ]; then
  echo "   $BAK already exists"
else
  curl -sS "${AUTH[@]}" -X POST "$API/user/repos" \
    -d "{\"name\":\"deenapp-backup\",\"private\":true,\"description\":\"Private mirror of deenapp — full history + content pack. Safety backup.\"}" \
    | grep -E '"(full_name|private)"' | mask || true
  echo "   created $BAK"
fi
echo "   visibility: $(curl -sS "${AUTH[@]}" "$API/repos/$BAK" 2>/dev/null | grep -m1 '"private"' | sed -E 's/.*: *([a-z]+).*/\1/' || true)"

echo "== 3/6 mirror clone (full history + gh-pages + tags) into /tmp =="
rm -rf /tmp/dl-mirror
git clone --mirror "https://$OWNER:$TOK@github.com/$SRC.git" /tmp/dl-mirror 2>&1 | mask | tail -3
echo "   refs: $(git -C /tmp/dl-mirror for-each-ref | wc -l)  size: $(du -sh /tmp/dl-mirror | cut -f1)"

echo "== 4/6 push mirror to backup =="
git -C /tmp/dl-mirror remote add backup "https://$OWNER:$TOK@github.com/$BAK.git"
git -C /tmp/dl-mirror push --mirror backup --force 2>&1 | mask | tail -8

echo "== 5/6 store the content pack in the backup (matches unpack-content.mjs fallback URL) =="
rm -rf /tmp/dl-pack
git clone --depth 1 -b master "https://$OWNER:$TOK@github.com/$BAK.git" /tmp/dl-pack 2>&1 | mask | tail -2
mkdir -p /tmp/dl-pack/content-pack
cp assets/content.zip /tmp/dl-pack/content-pack/content.zip
git -C /tmp/dl-pack config user.name "$OWNER"
git -C /tmp/dl-pack config user.email "$OWNER@users.noreply.github.com"
git -C /tmp/dl-pack add content-pack/content.zip
git -C /tmp/dl-pack commit -m "pass 43: archive content pack (17MB) — survives gh-pages loss" 2>&1 | tail -2
git -C /tmp/dl-pack push origin master 2>&1 | mask | tail -3

echo "== 6/6 restore content/content.zip on gh-pages =="
rm -rf /tmp/dl-gh
git clone --depth 1 -b gh-pages "https://$OWNER:$TOK@github.com/$SRC.git" /tmp/dl-gh 2>&1 | mask | tail -2
mkdir -p /tmp/dl-gh/content
cp assets/content.zip /tmp/dl-gh/content/content.zip
printf '' > /tmp/dl-gh/.nojekyll
git -C /tmp/dl-gh config user.name "$OWNER"
git -C /tmp/dl-gh config user.email "$OWNER@users.noreply.github.com"
git -C /tmp/dl-gh add content/content.zip .nojekyll
git -C /tmp/dl-gh commit -m "pass 43: restore content pack for unpack-content.mjs (was 404)" 2>&1 | tail -2
git -C /tmp/dl-gh push origin gh-pages 2>&1 | mask | tail -3

echo
echo "== verify =="
sleep 20
curl -s -o /dev/null -w '   gh-pages content.zip -> %{http_code}\n' \
  https://$OWNER.github.io/deenapp/content/content.zip
curl -s -o /dev/null -w '   backup is private   -> %{http_code} (404 anonymously = private OK)\n' \
  https://github.com/$BAK
curl -s -o /dev/null -w '   live app entry      -> %{http_code}\n' \
  https://$OWNER.github.io/deenapp/

rm -rf /tmp/dl-mirror /tmp/dl-pack /tmp/dl-gh
echo "done."
