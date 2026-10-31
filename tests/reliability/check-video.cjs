// Focused mocked tests. These do NOT test Android playback or YouTube network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.cwd();
function load(rel, deps = {}) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const scope = { module: mod, exports: mod.exports, require: (n) => { if (n in deps) return deps[n]; throw Error('Missing mock: ' + n); }, console, setTimeout, clearTimeout, setInterval, clearInterval };
  vm.runInNewContext(js, scope, { filename: rel });
  return mod.exports;
}
const { youtubeId, youtubeEmbedUrl } = load('src/lib/youtube.ts');
const id = 'dQw4w9WgXcQ';
for (const input of [id, `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?feature=share&v=${id}&x=1`, `https://m.youtube.com/shorts/${id}?foo=1`, `https://youtu.be/${id}`, `https://www.youtube-nocookie.com/embed/${id}`]) assert.equal(youtubeId(input), id, input);
for (const input of ['', 'https://evil-youtube.com/watch?v=' + id, 'https://youtube.com.evil.test/embed/' + id, 'https://youtube.com/embed/<script>', 'https://example.com/video.mp4', 'https://youtube.com/watch?v=short']) assert.equal(youtubeId(input), null, input);
assert.equal(youtubeEmbedUrl(`https://youtu.be/${id}`), `https://www.youtube.com/embed/${id}`);
console.log('PASS YouTube IDs, supported URL formats, host and identifier validation');
const bus = load('src/lib/mediaBus.ts', {
  react: {}, 'react-native': { AppState: {}, Dimensions: {}, Platform: {} }, 'expo-router': {},
});
let events = [];
const offA = bus.registerMediaStop('reel:A', () => events.push('stop-A'));
const offB = bus.registerMediaStop('yt:B', () => events.push('stop-B'));
const unsubscribe = bus.subscribeMedia(k => events.push('owner:' + k));
bus.claimMedia('reel:A'); bus.claimMedia('yt:B'); bus.releaseMedia('reel:A');
assert.equal(bus.mediaHolder(), 'yt:B');
assert.equal(events.indexOf('stop-A') < events.indexOf('owner:yt:B'), true, 'old player stops synchronously before new ownership notification');
bus.silenceMedia(); assert.equal(bus.mediaHolder(), null); assert.equal(events.includes('stop-B'), true);
offA(); offB(); unsubscribe();
let safe = false;
bus.registerMediaStop('x', () => { throw Error('simulated stop failure'); });
bus.registerMediaStop('x', () => { safe = true; });
bus.claimMedia('x'); bus.claimMedia('y'); assert.equal(safe, true); assert.equal(bus.mediaHolder(), 'y'); bus.silenceMedia();
console.log('PASS single media owner, immediate stop, stale release and failure isolation');
const reels = fs.readFileSync(path.join(root,'src/app/videos.tsx'),'utf8');
assert.match(reels, /i !== index/); assert.match(reels, /YouTubeReelItem/); assert.doesNotMatch(reels, /REEL_PRELOAD_AHEAD|onViewableItemsChanged=/);
assert.equal((reels.match(/player\.play\(\)/g) || []).length, 1);
const feed = fs.readFileSync(path.join(root,'src/components/FeedCard.tsx'),'utf8');
assert.equal((feed.match(/player\.play\(\)/g) || []).length, 1);
assert.match(feed, /inView && screenFocusedRef\.current && holdsMedia/);
const modal = fs.readFileSync(path.join(root,'src/components/VideoModal.tsx'),'utf8');
assert.equal((modal.match(/player\.play\(\)/g) || []).length, 1); assert.match(modal,/wantsPlayback && holdsMedia/);
const yt = fs.readFileSync(path.join(root,'src/components/YouTubePlayer.tsx'),'utf8');
assert.match(yt, /https:\/\/org\.deenlink\.app/); assert.match(yt, /strict-origin-when-cross-origin/);
console.log('PASS source-level active-player and YouTube identity checks');
console.log('\n3 focused mocked/static groups passed. Physical Android video testing still required.');
