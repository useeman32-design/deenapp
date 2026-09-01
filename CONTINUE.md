# CONTINUE — pass 39 handoff (2026-09-01)

## Pass 39 SHIPPED (master 021cc4e, gh-pages 896c4db, probe35 ALL PASS 16/16, android .hbc OK, live entry bundle 200)

### WORKSPACE BUDGET (2026-09-02) — READ THIS BEFORE BIG BUILDS
- Snapshot cap = 128 MB / 10k files over NON-excluded paths (node_modules,
  dist, .cache etc. don't count; `.git` DOES count). We hit 189.5 MB once →
  78 largest files were silently NOT saved → that is what kept rolling the
  local repo back to pass-34f between turns.
- FIX in place: local `.git` is a SHALLOW clone (`--depth 1 --single-branch
  -b master`, ~27 MB). Push from it works normally. Do NOT `git fetch
  --unshallow` and do NOT fetch gh-pages locally — gh-pages is cloned fresh
  in /tmp at deploy time (procedure below).
- `.chromium-libs` stash (19 MB) REMOVED to fit budget — after a reset run
  `bash scripts/browser-env.sh` (apt-get + reinstall, ~1 min) before probe35.
- Keep the eligible set < ~100 MB: never leave big artifacts outside
  node_modules/dist/.cache; clean /tmp clones right after deploying; push
  after every green gate so nothing lives only in the worktree.
- If .git creeps past ~40 MB: `git fetch --depth 1 origin master && git
  reflog expire --expire=now --all && git gc --prune=now`.
- Rollback recovery with the SHALLOW repo: re-add tokened remote →
  `git fetch --depth 1 origin master` → `git reset --hard origin/master`
  (unpushed work is unrecoverable — hence: push often).

### Post-ship native verification (2026-09-02) — EVERYTHING BELOW RE-RUN ON d548380
- Fresh clone-state audit: `npx tsc --noEmit` CLEAN · `expo export --platform ios`
  → entry-…hbc OK · `--platform android` → entry-…hbc OK (both bundles compile
  from the shipped tree; no type or bundler errors).
- MODULE AUDIT (Expo Go 57, iOS + Android):
  ✓ In Expo Go (both platforms): expo-router, asset, blur, clipboard,
  constants, device, file-system (new File/Paths API), font, glass-effect,
  haptics, image, image-manipulator, image-picker, linear-gradient, linking,
  location, media-library, sensors, sharing, splash-screen, status-bar,
  symbols, system-ui, video, web-browser, @expo/ui, @expo/vector-icons,
  rn-async-storage, gesture-handler, reanimated, safe-area-context, svg,
  webview, worklets. Pure JS: adhan, qrcode, pako.
  ⚠ expo-speech-recognition is the ONLY custom-native dep → real mic
  dictation works in DEV BUILDS / APK / IPA only; Expo Go auto-falls back to
  typed input (lazy probe in src/lib/speech.ts never crashes Go). Plugin
  permission strings already in app.json.
- app.json: scheme `deenlink` (share-art QR deep links), splash/location/
  speech/sharing/video plugins configured; android package + adaptive icon;
  iOS icon + tablet support.
- Sandbox rolled back to pass-34f AGAIN before this check (git + worktree);
  recovered with the standard recipe (re-add tokened remote → fetch →
  reset --hard origin/master). Nothing lost — origin was already correct.

### Qibla (qibla.tsx + QiblaLeaflet.tsx + QiblaNativeSat.tsx NEW)
- Design picker is now a "Change compass" BUTTON → modal (6 cards w/ color
  dots + check, persists dl.qibla.design). Inline pills removed.
- Map is SATELLITE (Esri World Imagery) everywhere; first view DOWNLOADS and
  SAVES tiles (web: localStorage `dl.tile.*` data-URLs via a custom Leaflet
  TileLayer.createTile; native: QiblaNativeSat WebView — self-contained tile
  mosaic, no Leaflet CDN, same localStorage cache inside the webview). Every
  later view paints the SAVED map (chip: SAVED MAP · SATELLITE). The Offline
  world-map fallback + chip are REMOVED. Web map h=196. Verified: 6 tiles
  cached on first load, chip flips to SAVED on reload.

### Zakat calculator (zakat.tsx — full rebuild)
- Metal prices are LIVE + READ-ONLY (IslamicAPI fetchNisab; offline fallback
  constants ₦191,313/g gold, ₦2,862/g silver). You enter GRAMS; value is
  computed (verified: 100g → ₦19,131,342).
- No auto-calc: big CALCULATE ZAKAT button gates the hero (dashes before).
- Nisab value rendered BOLD inside the hero line (nested <Text fontWeight 900>).
- "Money owed to you" (receivable) field REMOVED. Assets: cash, bank, goods;
  liabilities: debts. Gold/silver live in the metals card.
- Quran 9:103 (Arabic Amiri + translation) card at the bottom.
- Donations' zakat sheet (charity.tsx) mirrors this: grams + live read-only
  prices + Calculate button + 9:103; "Pay ₦X zakat now" after calculating.

### Donations (charity.tsx)
- "Donate to DeenLink" category REMOVED (user directive — reverses the old
  probe-locked order). Now: Zakat → Sadaqah. Cat 'deenlink' kept in the type
  for old receipts (receiptText branch intact). probe35 updated accordingly.
- Hero rearranged: icon medallion + "Give for the sake of Allah" title,
  ayah (2:261), divider, bookmarked hadith (Muslim 1631).
- Recipients are MULTI-SELECT ("GIVEN TO — SELECT ALL THAT APPLY", checkmark
  chips, "N recipients selected"); dono.recipient = joined names.
- Form category header: dark LinearGradient (per-cat) + gold 8-point-star
  lattice texture + icon + subtitle (was flat tint background).

### Prayer month IMAGE EXPORT — FIXED (prayer-month.tsx)
- Root cause: react-native-svg refs expose NO toDataURL() on web — every web
  export silently failed. Fix: `monthCanvasDataUrl()` — the same A4 design
  hand-drawn on a <canvas> (gradients, Poppins, gold rules, watermark),
  canvas.toDataURL('image/jpeg', .92) → shareImage. Verified live: 382KB JPEG
  generated (window.__dlMonthExport exposes length for probes). Native keeps
  the svgRef→toDataURL path (works there).

### Groups
- Community tab: the separate "FROM YOUR GROUPS" section is GONE; group posts
  are MIXED into the main feed via <GroupFeedInline/> after the 1st + 3rd
  cards (GroupsRail stays as discovery). Home: feed trimmed 8 → 4 posts,
  group card after the 2nd.
- Gallery uploads: pickGroupPhoto([1,1] / [16,9]) via expo-image-picker
  (base64 JPEG data URI, quality .55). EditGroupSheet: "Upload picture from
  gallery" (profile) + "Upload cover photo from gallery" (cover) + remove
  buttons; cover modal on the group screen too. isGroupImg() = data:/file:/http
  prefix; renders ExpoImage in group screen, rail cards, and FeedCard group
  tile (emoji fallback otherwise).

### Ruqyah AUDIO (src/lib/ruqyahAudio.ts NEW)
- Static MP3s per the API docs (NOT in the JSON): per-surah {n}.mp3 (1,2,7,
  20,109,112,113,114), 'Ayatul Kursi.mp3', total_{brief|med|long}_ruqyah.mp3.
  audioForEntry(title) parses entry titles; audioForProgram(programId).
- Player: web HTMLAudioElement, native expo-video headless (adhan pattern);
  ONE thing plays at a time; onRuqyahAudio listener drives UI.
- Surfaces: "Listen — full program audio" row in the recite tab; speaker icon
  on rows that have audio; play/pause + cloud-download in the entry sheet.

### Learning + Mirath
- learning.tsx LIBRARY += Hadith Library, Duas & Adhkar, Morning & Evening
  Athkar, Names of Allah (99), Ask a Scholar; Ruqyah chip "308 recitations".
- mirath.tsx: Quran 4:11 ayah card at the bottom + explicit al-hajb notes —
  "Brothers/Sisters do NOT inherit here: a male child (son) survives, and a
  son excludes siblings completely (al-hajb)" (+ the father-excludes variant).

### Gotchas this pass
- Sandbox reset AGAIN mid-pass (node_modules wiped + .git rolled back to
  pass-34f while worktree stayed current). Recovery: remote add origin w/
  .token → fetch → reset --soft origin/master → git add -A (worktree wins).
- GroupFeedPosts is now UNUSED in community (kept exported; GroupFeedInline
  is the mixing primitive).
- probe35 donations test now asserts NO DeenLink card + SELECT ALL THAT APPLY
  on the form page.

# ── pass 38 archive ──


## Pass 38 SHIPPED (master 3cd2d7e, gh-pages 1c9fc60, probe35 ALL PASS 16/16, android .hbc OK, live bundles 200)

### Groups — owner-managed suite (src/components/Groups.tsx + src/app/tools/group.tsx)
- Model: `Role = owner|admin|member`, `ROLE_META` (gold crown / green shield /
  neutral), `roleOf(g,name)` (creators own what they made), Group += bio,
  cover (COVER_STYLES id, default emerald), avatar (emoji, AVATARS picker),
  roles map, following[]. Seeds g1-g3 carry bio/cover/avatar/roles.
- Group screen: styled cover + "Change cover" (owner/admin), emoji medallion,
  BIO under the name, Manage-group button → EditGroupSheet (name/bio/desc/
  category/avatar/cover/open-join Switch, persists via saveGroups), Add-members
  sheet (ADDABLE list), per-member ••• menu (Make admin / Remove admin /
  Remove from group), Follow/Following toggles (persisted per group), member
  rows tap → /profile/[username]. Role badge beside every member.
- FeedCard (src/components/FeedCard.tsx): NEW props `group` {name,cat,avatar,
  catIcon} + `rank` + `onOpenGroup` → GROUP-FIRST header (gold group tile +
  name + chevron + time + GROUP chip on top; posting user indented below with
  rank badge). Old groupLabel chip kept only as non-group fallback.
- Home feed MIXES group posts: index.tsx interleaves <GroupFeedInline/> after
  the 2nd and 5th Recent-Posts cards (hasGroups flag). Community tab rail uses
  the same group-first cards.

### Share art — square generated cards (src/components/ScoreShareSheet.tsx)
- ScoreShareSheet + ScoreShareSvg: 1080×1080 SVG, 5 PROCEDURAL backgrounds
  (star lattice / sunburst rays / moroccan tiles / dome scallops / crescent
  field) shuffle on tap — ZERO image files. QR deep-links (deenlink.org/tools/…,
  "SCAN TO PLAY"). Share = native sheet via shareSvgRef; Save only when
  canSaveImages(). Wired: quiz results ("Share art" replaces canvas card),
  tasbeeh (share chip appears after first complete tour, metric = count).
  ScoreCard type: {kind, metric, title, subtitle, link}.

### DeenPoints fixes (src/components/DeenPoints.tsx, profile.tsx)
- BUG FIXED: profile DP chip called doCheckIn() → now opens DeenPointsBuyModal
  (a11y "get deenpoints"; check-in ONLY via the Check In button).
- Buy modal: custom-amount TextInput (min 10, ₦1.5/pt, digits only) overrides
  pack when valid; "WHAT ARE DEENPOINTS?" panel (same clarification as
  scholars: rewards activity, urgency priority, never buys fatwas).
- RewardModal REBUILT as gift box OPENING: box springs in → gold lid flies up
  rotated → deenpoints.png coin rises out w/ glow + 6-petal sparkle burst.

### Prayer (times/month/adhan)
- formatTime deterministic 12h AM/PM (no Intl) + `to12h()` in src/lib/prayer.ts;
  prayer.tsx + PrayerArc use formatTime; month rows via to12h. Verified live:
  AM/PM everywhere, 180 month cells, no 24h leak.
- Month hijri read from NESTED hijri_date.hijri.{day,month.en} (was flat →
  "NaN undefined"); fallback localHijri. Verified clean.
- Adhan preview: "Preview the adhan alert" row on the MAIN screen (above hero)
  AND in settings next to the toggle → setAdhanFor('Dhuhr·preview') shows the
  real popup without audio. Verified fires + dismiss.
- Location (src/lib/location.ts NEW): CHANGE_THRESHOLD_KM=15, distanceKm,
  detectLocationChange() one-shot on open, watchLocation() 120s/15km watcher,
  applyLocation(). Prayer screen shows a BLUE prompt banner "New location
  detected: [name] — Update your prayer times?" with Update/× (never silent;
  Update re-fetches). Needs real GPS movement to trigger on device.

### Qibla / compass (verified: 6 designs, back a11y, pill)
- Compass.tsx 6 palettes (classic/minimal/night/royal/bedouin/digital) via
  QIBLA_DESIGNS, persisted dl.qibla.design. qibla.tsx: TopBar showBack,
  location pill (name + lat/lon), compact raised map (QiblaLeaflet h=168,
  Live/Offline chip). TopBar back now has a11y "back" (all 11 tool screens).
  NOTE: two `{2.6)`/`{0.45)` regex-patch typos in Compass.tsx caused TS1005 —
  fixed; re-check any future regex patch with tsc immediately.

### Zakat + API audit
- zakat.tsx: fetchNisab('ngn') on mount prefills gold/silver per-gram prices
  (₦191k/₦2.9k at ship time) + LIVE NISAB · ISLAMICAPI chip (MANUAL PRICES
  fallback). Verified LIVE chip on device-web. Audit: prayer day+month,
  charity nisab, ruqyah, zakat all wired; zakat-nisab needs `api_key` param
  (NOT key/apikey/header) — client's get() already correct.
- Ruqyah discoverability: QuickGrid + quick-access.ts shortcut + learning row
  ("Ruqyah Shariah · 9 sections") — all three verified.

# ── pass 37 archive ──

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
