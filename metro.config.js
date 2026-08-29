/* Metro config (pass 18) — ship the user's content datasets as assets.
 * The content pack lives in assets/content/** renamed to .txt so Metro
 * treats each file as a separate asset instead of inlining megabytes of
 * JSON into the JS bundle. */
const { getDefaultConfig } = require('expo/metro-config');

const cfg = getDefaultConfig(__dirname);

// .txt must be an asset extension for require('...*.txt') to resolve.
if (!cfg.resolver.assetExts.includes('txt')) cfg.resolver.assetExts.push('txt');

// big JSON-as-.txt assets: raise the inline limits so they are emitted as
// files (web export serves them from /assets) rather than base64-inlined
cfg.transformer.assetRegistryPath = 'react-native/Libraries/Image/AssetRegistry';
cfg.server.rewriteRequestUrl = cfg.server.rewriteRequestUrl;

module.exports = cfg;
