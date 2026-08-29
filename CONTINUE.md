# DeenLink — Pass-23 handoff (deployed)

Live: https://useeman32-design.github.io/deenapp — entry-b34416f0a901f94408ec03fa576e71d6.js
master @ 80ce358 · gh-pages @ fa0b6f8 · diag23: **22/22 green** (scripts/diag23.mjs)

## Shipped this pass
- Zakat calculator `/tools/zakat`: nisab (gold 87.48g / silver 612.36g + live price inputs), assets/liabilities rows, 2.5% hero result, quick-access tile added. API hook point: metal prices are manual — swap for user's API later.
- Qibla: REAL animated globe (`GlobeMap.tsx`) — web = srcDoc iframe w/ globe.gl CDN (earth texture, Kaabah+YOU pins, animated dashed great-circle, auto-rotate); offline postMessage → `globe-fail` → RouteMap fallback; native branch uses react-native-webview (v13 has NO web impl — that's why the iframe). Compass chevrons bigger/bolder.
- Splash fully redesigned: no video — real logo scale-in + glow + pulse rings + wordmark + BISMILLAH loader bar, 2.4s. splash-anim.gif/mp4 DELETED.
- Icons: icon/favicon/splash-icon/android-foreground regenerated from the real transparent logo (old expo template art + logo.png/logo-glow.png/react-logo/expo-badge/tutorial-web DELETED). export-web.sh now rewrites "/favicon.ico → /deenapp/favicon.ico".
- Dua/athkar player bars: `compact` (reader already had it).
- Homepage hero: confirmed real location (resolveLocation) + hijri+gregorian dates — was already wired.

## From pass-23 earlier in session (all live)
switch-surah prompt · ayah bookmarks below filters · bigger mushaf basmallah + swipe capture fix · reader hero basmallah · honest audio loading (mediaProbe 350ms poll) · universal CommunityInbox (videos + main app) · 99-names EN|AR pill + share, no bar · notifications screen + community bell/inbox split · home-style suggest cards · connections from profile stats · comments 660/capture-drag/GIFs · hadith opens on chapters · FeedCard fullscreen seek · prayer engine+screen (12 methods, madhab, ±adj, adhan; dl.prayer.settings.v1) · calendar hijri grid + occasions · tasbeeh screen (daily reset dl.tasbeeh.daily, beads/digital).

## Gotchas for pass 24
- Sandbox resets wipe node_modules + playwright chromium (`npx playwright-core install chromium-headless-shell`) and roll git back — verify `git log`, restore = fetch + reset --hard, npm install, `node scripts/unpack-content.mjs`.
- pages-server.mjs now defaults: root `dist`, prefix `/deenapp` (export output is dist root, NOT dist/deenapp). Stale servers hold port 3996 → `fuser -k 3996/tcp`; do NOT pkill -f pages-server (kills own shell).
- diag selectors: aria-labels added — `tasbeeh-deck` (tasbeeh.tsx), `Settings` (prayer.tsx gear). Arabic regex must allow diacritics between letters.
- assets 104MB total (content 88M unzipped, content.zip deleted to fit snapshot cap — re-zip if needed). Pruned 35+ stale diag/smoke scripts.
- Open items user may raise: zakat API (metal prices), qibla globe needs network (falls back offline), splash acceptance not yet confirmed by user.
