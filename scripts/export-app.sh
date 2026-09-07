#!/usr/bin/env bash
# Build the DeenLink web app for a self-hosted subdomain (https://app.deenlink.org).
# Unlike export-web.sh (GitHub Pages, base /deenapp/), this serves from the web
# root (base /) and talks to the SAME origin's /api (no CORS), so it can live
# inside the deenlink-api repo for one-pull deploys.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${EXPO_PUBLIC_API_URL:-https://app.deenlink.org}"

rm -rf dist-app
EXPO_PUBLIC_API_URL="$API_URL" npx expo export --platform web --clear --output-dir dist-app

# SPA fallback for Apache (cPanel) so deep links like /tools/quiz resolve, plus
# hardening: the deenlink-api repo root also ships api.zip/admin.zip/the SQL dump/
# storage/ — none of those may be publicly downloadable.
cat > dist-app/.htaccess <<'HT'
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
</IfModule>

# Never serve repo dumps, archives, docs, or internal dirs.
<FilesMatch "\.(sql|zip|md|log|token|ya?ml)$">
  Require all denied
</FilesMatch>
RedirectMatch 404 ^/storage/
RedirectMatch 404 ^/\.
HT

cp dist-app/index.html dist-app/404.html

echo "✅ Export ready in dist-app/ → copy into the deenlink-api repo (docroot) and git pull on the server."
