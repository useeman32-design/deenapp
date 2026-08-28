#!/usr/bin/env bash
# Restore headless chromium after a sandbox reset (turn boundary).
# The lib stash uses REAL files named as sonames (symlinks do not survive snapshots).
set -e
cd "$(dirname "$0")/.."
if [ ! -x /home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell ]; then
  npx playwright-core install chromium-headless-shell
fi
D=/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu
CHROME=/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
if LD_LIBRARY_PATH=$D ldd "$CHROME" 2>/dev/null | grep -q "not found"; then
  sudo apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libxdamage1 libxkbcommon0 libasound2 libatspi2.0-0 >/dev/null
  python3 - << 'PY'
import glob, os, shutil
D = '/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu'
os.makedirs(D, exist_ok=True)
for p in ['libnspr4.so*','libnss3.so*','libnssutil3.so*','libplc4.so*','libplds4.so*','libatk-1.0.so*','libatk-bridge-2.0.so*','libXdamage.so*','libxkbcommon.so*','libasound.so*','libatspi.so*','libgio-2.0.so*','libglib-2.0.so*','libgmodule-2.0.so*','libgobject-2.0.so*']:
    for f in glob.glob(f'/usr/lib/x86_64-linux-gnu/{p}'):
        base = os.path.basename(f); dst = os.path.join(D, base)
        if not os.path.exists(dst): shutil.copyfile(os.path.realpath(f), dst)
PY
fi
LD_LIBRARY_PATH=$D "$CHROME" --version
echo "chromium ready — run tests with: LD_LIBRARY_PATH=$D node scripts/smoke13.mjs"
