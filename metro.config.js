/* Metro config (pass 18) — ship the user's content datasets as assets.
 * The content pack lives in assets/content/** renamed to .txt so Metro
 * treats each file as a separate asset instead of inlining megabytes of
 * JSON into the JS bundle. */
const { getDefaultConfig } = require('expo/metro-config');

const cfg = getDefaultConfig(__dirname);

// .txt must be an asset extension for require('...*.txt') to resolve.
if (!cfg.resolver.assetExts.includes('txt')) cfg.resolver.assetExts.push('txt');
// pass 33: hadith books ship gzipped (.txt.gz, 87MB → 16MB) — Metro must
// treat .gz as an asset too.
if (!cfg.resolver.assetExts.includes('gz')) cfg.resolver.assetExts.push('gz');

// NOTE (pass 110): do NOT set cfg.transformer.assetRegistryPath here. The old
// 'react-native/Libraries/Image/AssetRegistry' path no longer exists in this RN
// version; overriding it made metro emit asset registrations into a module that
// is not in the bundle graph, so EVERY require()'d asset (icons, images, fonts,
// content txt/gz) failed to resolve at runtime on Android (APK 0c4d6cdc).
// Expo's default registry is correct; only assetExts needs extending.

module.exports = cfg;
