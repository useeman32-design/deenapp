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
  const hasFcm = fs.existsSync(path.join(__dirname, 'google-services.json'));
  if (hasFcm) {
    cfg.android = { ...(cfg.android || {}), googleServicesFile: './google-services.json' };
  }
  cfg.extra = { ...(cfg.extra || {}), push: { fcmConfigured: hasFcm } };
  return base.expo ? { ...base, expo: cfg } : cfg;
};
