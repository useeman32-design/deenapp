/**
 * pass 119 — dynamic Expo config.
 *
 * It exists for exactly one field. Android push needs `android.googleServicesFile`
 * pointing at Firebase's google-services.json, and naming a file that is not in
 * the repo fails EVERY build (locally and on EAS). So the field is set only when
 * the file is actually present: drop it into the project root (or add it as an
 * EAS file env var) and remote push switches on with no other code change.
 *
 * Everything else still comes from app.json untouched.
 */
const fs = require('fs');
const path = require('path');

module.exports = () => {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
  const cfg = base.expo || base;
  /* pass 123 — an EAS file env var must work too: `eas env:create --name
   * GOOGLE_SERVICES_JSON --type file --value ./google-services.json` writes the
   * file to an absolute path and exports that path, it does not put it in the
   * repo root. Without this branch the config comment promised an env var that
   * nothing read, and the build silently shipped without FCM. */
  const envPath = process.env.GOOGLE_SERVICES_JSON;
  const localPath = path.join(__dirname, 'google-services.json');
  const googleServicesFile = envPath || (fs.existsSync(localPath) ? './google-services.json' : null);
  if (googleServicesFile) {
    cfg.android = { ...(cfg.android || {}), googleServicesFile };
  }
  const hasFcm = !!googleServicesFile;
  cfg.extra = { ...(cfg.extra || {}), push: { fcmConfigured: hasFcm } };
  return base.expo ? { ...base, expo: cfg } : cfg;
};
