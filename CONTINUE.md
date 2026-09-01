# CONTINUE — pass 37 handoff (2026-09-01)

## Pass 37 SHIPPED (master 683cbe7, gh-pages 26d78fb, probe35 ALL PASS, android .hbc OK)

### Splash — square + animated
- SplashGate REBUILT: explicit square logo card (width=height=148, no
  aspectRatio), glow bloom → breathing halo behind logo, spring+rotate-in,
  "DeenLink / STRENGTHEN YOUR DEEN…" wordmark fade-up, shimmer sweep over the
  loader bar. Verified on web: logo box 146×146 (square), wordmark shows.
- OS splash unified: classic splash AND expo-splash-screen plugin both use
  assets/images/splash-icon.png (square 512 transparent, plugin imageWidth 200).
  splash-full.png still exists but unused. **If user still reports a wide OS
  splash in Expo Go, ask for a screenshot — in-app gate is verified square.**

### Prophets — complete 25 + themed + bilingual + progress
- 6 NEW chapters in public/prophets/: lut, shuayb, harun, sulaiman, ilyas,
  al-yasa (Quran-based, 6-11 paras each). index.json rebuilt: 25 chapters in
  canonical order (Yaqub inside ishaq's chapter; daniel extra). ALL 25
  Quran-named prophets now covered.
- src/data/prophetThemes.ts: per-slug { g:[colors], icon, motif, ar (arabic
  name), ayah {ar,en,ref}, ha:[hausa paragraphs] } — drives everything.
- Reader redesigned: themed gradient hero (icon medallion + motif + arabic
  name), key-ayah quote card, drop-cap first paragraph, progress bar card,
  EN/HA pill (HA = "Tausayin Labari" Hausa summary), skeleton loader.
- Hub: hero CONTINUE card (last opened via dl.prophets.last.v1 + % progress,
  themed like the Qur'an reader) + "Your journey: X of 25" row + per-chapter
  progress bars + themed icon chips + skeleton.
- Storage: dl.prophets.read.v1 (existing, paragraph counts) + NEW
  dl.prophets.last.v1 (last slug).

### Prayer-month — the REAL native crash fix
- Previous fragment-G fix was NOT the whole story. Pass 37:
  1. The 1240×1754 export SVG now mounts ONLY while exporting (exportOn state,
     450ms settle, unmount after) — it no longer lives offscreen forever.
  2. ZERO toLocale*/Intl in render: static MONTHS/MONTHS_LONG arrays, fmtHM
     hand-rolled AM/PM, localHijri = tabular (arithmetic) Islamic calendar —
     no Intl dependency on Hermes at all.
  3. Offline fallback computes per-day in try/catch (bad day skipped).
- Verified web: 30 rows + hijri column + export surface hidden until export.
  **Needs user confirm in Expo Go.**

### Share — native sheet for all, save is a privilege
- svgExport.canSaveImages(): native = MediaLibrary.getPermissionsAsync()
  already granted; web = false. ContentShareSheet hides the Save button unless
  canSave; Share always available (expo-sharing native sheet / web
  navigator.share→download). Wallpapers/prayer-month still request permission
  on first Save tap (native dialog).

### SunPath glitch — fixed
- Cause: mounted at default w=338, then onLayout snapped to real width on every
  remount (navigate back → adjust+snap). Fix: module-level `cachedW` — remounts
  start at the last measured width.

### Sandbox-reset survival notes (IMPORTANT — hit twice this pass)
- Resets wipe: node_modules, /home/user/.cache (playwright browser), apt libs,
  .git/config (remote + user identity). Restore:
  `npm ci` · `node node_modules/playwright-core/cli.js install chromium-headless-shell`
  · `apt-get install -y libnspr4 libnss3 libasound2t64 libatk1.0-0
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2`
  · re-add remote with .token + `git config user.name/email`.
- The LOCAL .git can ALSO roll back commits (snapshot of .git is not
  guaranteed current). Recovery used this pass: fetch origin → reset --soft
  origin/master (worktree keeps the real state) → commit → if history
  diverged, rebase onto origin/master resolving conflicts with
  `git checkout --theirs` (theirs = the new work).

### Standing facts (unchanged unless noted)
- Deploy: bash scripts/export-web.sh → clone gh-pages → wipe → cp dist/. . →
  commit → push. Local gate: pages-server on dist (port 3996, prefix
  /deenapp; kill with `fuser -k 3996/tcp`), then `node scripts/probe35.mjs`.
- dbg37.mjs deleted after use. probe32-35 + diagNN still in scripts/ (harmless).
- Still open for device verification: ~80% zoom + Display size, qibla,
  fullscreen cancel, adhan pause, video restart, wallpapers/share-card/month
  JPG exports on device, NEW: month screen in Expo Go, splash in Expo Go.
- IslamicAPI key: EXPO_PUBLIC_ISLAMIC_API_KEY in .env (revocable, public).
- DeenPoints ₦1.5/pt; donations CATS DeenLink→Zakat→Sadaqah (probe-locked);
  never buy fatwas.
