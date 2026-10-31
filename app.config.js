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
  /* Either source is accepted, because they suit different repos:
   *   · a real ./google-services.json in the project root — Expo's documented
   *     setup, fine when the repo is private (the file holds public-facing
   *     Firebase identifiers, not secrets); or
   *   · GOOGLE_SERVICES_JSON, the EAS *file* environment variable, which EAS
   *     materialises and exposes as a path at build time. That keeps the file out
   *     of git entirely, which is what this project wants after the .env incident.
   * The env var must win when set: inside an EAS build the repo copy does not
   * exist, so existsSync alone would silently ship a build with no FCM. */
  const envPath = process.env.GOOGLE_SERVICES_JSON;
  const localPath = path.join(__dirname, 'google-services.json');
  const resolved = envPath || (fs.existsSync(localPath) ? './google-services.json' : null);
  const hasFcm = Boolean(resolved);
  if (hasFcm) {
    cfg.android = { ...(cfg.android || {}), googleServicesFile: resolved };
  }
  cfg.extra = { ...(cfg.extra || {}), push: { fcmConfigured: hasFcm } };
  return base.expo ? { ...base, expo: cfg } : cfg;
};
