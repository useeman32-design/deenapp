#!/bin/bash
# Restore the headless-browser runtime after a sandbox reset:
#  - install chromium headless shell (if missing)
#  - recreate soname symlinks in the persisted .chromium-libs dir
#  - recreate /tmp/serve -> dist
LIBS=/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu
[ -d "$LIBS" ] || { echo "missing $LIBS"; exit 1; }
for pair in "libXdamage.so.1:libXdamage.so.1.1.0" "libasound.so.2:libasound.so.2.0.0" "libatk-1.0.so.0:libatk-1.0.so.0.25611.1" "libatk-bridge-2.0.so.0:libatk-bridge-2.0.so.0.0.0" "libatspi.so.0:libatspi.so.0.0.1" "libxkbcommon.so.0:libxkbcommon.so.0.0.0"; do
  soname=${pair%%:*}; ver=${pair##*:}
  [ -e "$LIBS/$soname" ] || ln -s "$LIBS/$ver" "$LIBS/$soname"
done
if [ ! -x /home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell ]; then
  (cd /home/user/deenlink-app && npx playwright-core install chromium-headless-shell) || exit 1
fi
ln -sfn /home/user/deenlink-app/dist /tmp/serve
echo "browser env ready"
