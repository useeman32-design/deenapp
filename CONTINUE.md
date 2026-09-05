# CONTINUE — pass 42 handoff (2026-09-02)

# ── pass 44 (2026-09-02) — 13-item user pass + safe-area + real tsc gate ──
All pushed to master (b19735e safe-area/tsc; then 44b/44c/44d; final batch
after). Gates: tsc --noEmit exit 0 (REAL this time), export-web.sh exit 0.

- SAFE AREA: TopBar hardcoded paddingTop: 12 -> Math.max(insets.top, 12)
  (fixes 13 screens; none double-applied). qibla.tsx header same.
- ADHAN: 3 designs rendered a literal backslash-n (JSX text \n) -> {'\n'}.
- LEARNING HUB: banner fixed-height 96 + real cross-fade (fade out/swap/fade in,
  useNativeDriver) + dots per pool; Short-Lessons card got marginHorizontal 16.
- QIBLA: back (rear) needle now per-design; "Change compass" button reworked
  (compass icon, theme-aware colour, centred, shows active design).
- HOME CAMPAIGNS: Learning Hub NEW + first (assets/img/campaign-learning.jpg),
  Finish-Qur'an second, Videos removed.
- QUICK ACCESS: 'Learning'->'Learning Hub'; editor add-row plus was a nested
  Pressable with no handler (swallowed taps) -> pointerEvents=none circle.
- TODAY'S GOAL: auto-detected only (modal read-only); 8 rotating sets picked by
  day hash; wired markGoal into quiz/charity/hadith/names.
- EMOJIS: added ﷺ and سُبْحَانَهُ وَتَعَالَى to post + comment pickers (adaptive font).
- AI: system prompt now answers capability/general questions directly (no
  "no source in library" preface) + conservative anti-hallucination (cross-check
  specific claims vs library; say "not certain" instead of inventing).
- PRAYER MONTH export: logo swapped logo-badge.png (old) -> logo-export.png
  (288px PNG converted from the current logo.webp) in both SVG + canvas paths.

INFRA (pass 43-44): deenapp-backup (private, full mirror + pack), deenlink-api
(private, empty), gh-pages content/content.zip restored (fresh clones self-heal),
HANDOFF-PROMPT.md de-tokened (reads .token). tsc gate was silently never running
before (typescript absent from node_modules) — fixed 4 pre-existing TS2488.
KNOWN: deenapp CANNOT go private on Free plan (Pages 422). Expo Go users may see
stale bundles (misbaha complaint was a stale cache, not code). pages-cap-test
empty repo needs manual deletion.

# ── pass 43 — infra recovery + backup (DONE, pushed) ──
Local only, UNPUSHED — the GitHub PAT in HANDOFF-PROMPT.md is DEAD (see below),
so nothing in this section has reached origin yet.

## BLOCKER — the push token is dead
`ghp_E3OyMu…5ens` (in HANDOFF-PROMPT.md) returns **401 Bad credentials** from
BOTH `GET /user` and `GET /rate_limit` (no scope needed → conclusive), as
`token` and as `Bearer`. It is exactly 40 chars, correct classic-PAT shape.
Anonymous clone still works (repo is public), so `git ls-remote` "succeeding"
does NOT prove write access — do not be fooled by that.
=> Need a fresh token before ANY push (master, gh-pages, or backup).
=> Upside: the token leaked into a PUBLIC repo is already inert.

## Root-cause found: the content pack was unrecoverable on a fresh clone
- `assets/content.zip` is gitignored AND absent; its only documented source
  `https://useeman32-design.github.io/deenapp/content/content.zip` returns **404**
  (verified; gh-pages has no `content/` dir at all).
- `src/lib/content.ts` hard-requires **147** files under `assets/content/**`,
  **29 of them `hadith/*.txt.gz`**.
- `npm ci` → `postinstall` → `unpack-content.mjs` → `packPresent()` false →
  `downloadPack()` → 404 → `process.exit(1)`.
  **The HANDOFF-PROMPT setup instructions fail at `npm ci`.** Reproduced.

## Recovery performed
Recovered the pack from git history (needs a FULL clone — the shallow repo
cannot see these blobs):
| blob | path | bytes | hadith | verdict |
|---|---|---|---|---|
| `162e59f35e978a359547642ddd4e0e5ad7756f95` | content/content.zip | 17188371 | .txt.gz | **CORRECT (pass 42 master)** |
| `9fbd4e7c0456c8bce8ecdc4221b8d7d5de73bc71` | assets/content.zip | 17182745 | .txt | WRONG — pre-pass-33 |
| `2a105ad28461574d825c9eef051a77a926ad0ba9` | deenlink-content-pack.zip | 18454421 | — | 161 entries, different |
TRAP: `9fbd4e7` extracts 147 files too and LOOKS right. Grepping require paths
with a pattern ending in `\.txt` silently truncates `.txt.gz` and reports a
false "all present". Match `require\('\.\./\.\./assets/content/[^']+'\)` instead.

## Fixes made this pass
- `scripts/unpack-content.mjs`: header comment no longer claims the zip is
  tracked in git (it is not — `.gitignore:52`); `PACK_URL` → `PACK_URLS`
  fallback LIST (gh-pages, then `deenapp-backup/content-pack/content.zip`);
  `downloadPack` tries each and on total failure prints both 404s + the exact
  `git cat-file blob <sha>` recovery recipe. Verified: normal path exit 0
  ("pack already present — ok"), failure path exit 1 with the new message.
- `.gitignore:49`: extracted pack is **20MB** since the pass-33 gz corpus, not
  88MB. (The 88MB figure lived in .gitignore, NOT CONTINUE.md.)
- `scripts/backup-and-upload.sh` NEW: idempotent 6-step script that creates the
  PRIVATE `deenapp-backup` repo, `push --mirror`s full history + gh-pages +
  tags, archives `content-pack/content.zip` there, and restores
  `content/content.zip` on gh-pages. Token comes from `$DL_TOKEN` or `.token`
  (gitignored) — never hardcoded. Guards verified: exit 2 no token, exit 3 dead
  token. NOT YET RUN (needs a live token).

## Workspace budget, corrected numbers
Full clone `.git` = 157MB → breached the 128MB cap on its own. Re-cloned
`--depth 1` (`.git` = 29MB), carrying the pack across.
Eligible set now ≈ **108MB** (79MB worktree + 29MB .git). node_modules 647MB and
dist 59MB are snapshot-excluded. `assets/content` is 20MB, not 88MB — the old
budget notes are calibrated to the wrong figure.

## Gates re-run after the fixes
`npm ci` → 632 packages, postinstall short-circuits · `npx tsc --noEmit` →
exit 0 · `bash scripts/export-web.sh` → exit 0, all routes bundled.
NOTE: `tsc` does NOT validate the content requires (`require()` types as `any`)
— the export is the only gate that proves the pack resolves.

## TODO for pass 43 (all blocked on a live token)
1. `bash scripts/backup-and-upload.sh` (with `DL_TOKEN=`) → creates the private
   backup, mirrors everything, uploads the zip to gh-pages AND to the backup.
2. Verify: gh-pages `content/content.zip` → 200; `deenapp-backup` → 404
   anonymously (proves private); live app entry → 200.
3. Then and only then: safe to start pass 44 feature work.

# ── pass 42 SHIPPED (master bc6634e, gh-pages efbc94b, probe35 24/24 + probe42 11/11 ALL PASS, live entry 200) ──

# ── pass 42 — 10-item UI/feature pass ──
Sandbox was RESET at fa46369 (npm ci + chromium + `sudo apt-get libnspr4 libnss3 …`
needed again — run `bash scripts/browser-env.sh` first if probes fail to launch).
git identity must be set per-repo after a reset (done): user.name useeman32-design.

What shipped (all 10 items):
- TAFSIR TOOL /tools/tafsir (NEW src/lib/tafsir.ts + tafsir.tsx): surah picker modal +
  ayah strip + 3-book selector (Ibn Kathir/Maarif Ul Quran/Tazkirul Quran, persisted
  dl.tafsir.book); arabic/english from bundled corpus (loadSurah — content.ts ayahs are
  {ayah, arabic, english, hausa}!); tafsir fetched live from quranapi.pages.dev
  GET /api/tafsir/{surah}_{ayah}.json → tafsirs[author].content (markdown-lite '## '
  headings). 'Ask DeenLink AI' link on the screen.
- DAILY ZIKR CHALLENGE /tools/zikr-challenge (NEW): tasbeeh 99 / istighfar 100 /
  salawat 100, tap-to-count, 40-dot ring + pulse + '+1' float; persists
  dl.zikr.<YYYY-MM-DD> {tasbeeh,istighfar,salawat,rewarded}; completing any =
  markGoal('dhikr')+markActive; all 3 → RewardModal +25 DP once/day.
- SHORT LESSONS /tools/lessons (NEW): TOPICS extracted from learning.tsx; search +
  list + bottom-sheet reader. 8 topics · 34 key points.
- LEARNING HUB REWORK: BackButton; auto-shuffle banner (4.2s, QUICK+LIBRARY pool,
  5 dots) under QUICK PLAY; 'Ask a Scholar' row REMOVED; 'Athkar' → Daily Zikr
  Challenge; Tafsir Library + Short Lessons rows in LIBRARY.
- ADHAN MODAL: 5 UNIQUE designs (praying=card+photo header, mecca=full-bleed 560px
  centered, kaabah=split row, medina=strip header+overlap avatar, mosque=double
  frame), maxWidth 396, Style switcher inside the alert.
- QIBLA: per-design back arrow (spec table: classic ring chevron / minimal square
  arrow / night glowing pill double-chevron solid / royal soft-square solid arrow /
  bedouin squircle solid chevron / digital sharp neon-border chevron) from ds.dot.
- TASBEEH: misbaha now DRAWN in SVG (33 beads true circle cy=0.55h r=0.335min,
  bead r=0.0315min; passed=green, active=glow+halo, specular dot; silk ring +
  gold tassel collar/threads). Photo + hand-fitted BEAD_PATH REMOVED (alignment
  now exact by construction). MISBAHA_AR now 1.44.
- COURSE QUIZZES: QUIZZES bank 5 Q per curriculum (tajwid/fiqh/seerah/default),
  launcher card in the player, Q→A with instant correct/incorrect + explanation,
  dots progress, result card w/ trophy; best score persists dl.courses.quiz.v1
  {best,tries}. Exit order: quiz → lesson → close.
- SCHOLARS Q&A IDENTITIES: answered questions now show asker row (avatar + name +
  asked publicly/privately) AND scholar bubble (gold-ring avatar + title·madhhab·
  institute from MOCK_SCHOLARS via scholarOf/scholarAv helpers; seeds have asker
  {name,av}). Both MY + PUBLIC tabs.
- HOME TODAY'S GOAL MODAL: card (aria today-goal) opens bottom-sheet: big % +
  ProgressRing + 4-goal checklist (tap toggles, gold done state, strikethrough).
  routine.ts gained setGoal(key,val) (full toggle; markGoal still exists).
  NB: routine imports in index.tsx are ALIASED (fetchGoal/setGoalItem) — the
  useState setter is also called setGoal.
- UNIVERSAL VIDEOS (community↔reels): UserPost gained {video?, reelId?};
  community video composer posts ALSO addUserPost(kind 'video'); videos composer
  cross-posts via addUserPost(..., {video, reelId}); Videos feed injects
  userPosts video&&!reelId as reels (ids 1_000_000+at%1e6, username abdalrahman).
  De-dup both directions by reelId.
- AI: Ibn Kathir tafsir auto-fed to sys prompt on N:N verse matches
  (tafsirContextFor in src/lib/tafsir.ts, regex /\b(\d{1,3})\s*[:.]\s*(\d{1,3})\b/);
  NAV leak stripped (ai.tsx bubble NAV strip + CommentsModal extracts NAV: lines
  into an 'Open …' chip; mocks SampleComment.nav). NAV_LABELS map lives in
  src/lib/ai.ts.
- probe42.mjs ADDED (11 checks) — run alongside probe35 (24) after every export.
- STILL WAITING: user's PRIVATE PHP backend repo was never uploaded (asked every
  pass since 39). API-key answer repeated in the final reply.

# ── pass 41 SHIPPED (see below for details) ──

# ── pass 41 (2026-09-02) — signup rebuild + 16 UI/data items ──

CRITICAL lesson this pass: ALWAYS build with `bash scripts/export-web.sh`, NEVER raw
`npx expo export --platform web` — the raw export skips the router base-URL patch, so
EVERY deep link falls into the catch-all → /login. Symptom: probe fails everything while
the same dist works on gh-pages.

What shipped (all 17 items):
- REGISTER REBUILT (register.tsx ~780 lines): choose screen (user/scholar + Google) →
  USER form (full name, email, USERNAME with live mock availability ['admin','demo',
  'deenlink','muhammad','ibrahim','aisha','yusuf','maryam','khadijah','usman' are taken],
  gender chips, CountryPicker modal (27 countries), Nigeria → TRIBE chips Hausa/Igbo/
  Yoruba/General, aqeedah radio cards w/ descriptions — Sunni desc appends 'Izala and
  Salafiyya fall under Sunni' ONLY for Nigeria; Sufi 'Tijaniyya and Qadiriyya fall here';
  Other → manual TextInput maxLength 10 — password + confirm with live checkmark list
  [≥6 chars / letter / number / match]). SCHOLAR = 3 steps w/ dots (BASIC→QUALIFICATIONS→
  VERIFICATION): display name, phone, fields-of-knowledge multi-chips + Others manual,
  madhhab, aqeedah, institute, years chips, teachers (opt); step 3 = proof upload +
  recommendation upload (expo-image-picker) + dawah links chips + ONE verification method
  radio (documents/letter/links, chosen method's artifact required) + terms/privacy
  checkbox; scholar app persisted at dl.scholar.app.<username>. GMAIL flow: 'Demo User /
  demo@gmail.com' → 'Complete your info' (username+gender+country+tribe+aqeedah, NO
  password fields, submit uses demo1234).
- AuthField keyboard prop widened ('phone-pad' ok). probe35 scholars block rewritten for
  the selection screen + a pass-41 block (10 new checks — 24 total, ALL PASS).
- Quiz: inspiration card BEFORE the score (58:11 ≥70 / Muslim 2699 40-69 / 20:114 <40);
  saved image quality: svgRefToPng/shareSvgRef/saveSvgRefAsJpg take opts, native save
  rasterizes 1080×1080 (was the 216px preview), web download 1440.
- LOGO RULE enforced: AI empty-state + prayer-month export header use assets/img/
  logo-badge.png (crescent = loader only). Month image: taller header (320) with REAL
  logo + QR IN THE HEADER, table fonts up (20/17/19, colH 22, rowH ≤46), both renderers
  (MonthTableSvg native + monthCanvasDataUrl web, now ASYNC logo preload).
- Adhan alert: 5 selectable designs (praying/mecca/kaabah/medina/mosque, ADHAN_DESIGNS
  in prayer.tsx) persisted at dl.adhan.design; bigger modal (maxWidth 392, 204px art);
  style switcher inside the alert + picker modal with live 'Preview with this style'.
- Qibla: back button follows the selected compass design (shape+colors from ds.dot).
- Prayer page: BackButton added (page had none).
- DeenLink AI: provider/status pill REMOVED from header (header = back/bars/robot/title/
  plus); settings = bottom of history drawer w/ COG icon + capability sub; MODEL chips →
  AI CAPABILITY (m.note only: deep/fast reasoning, balanced, flagship); bubble header +
  footer + sheet label no longer say Groq/xAI; user-bubble paragraph branch now applies
  the passed color (the black-on-green bug) — VERIFIED live rgb(255,255,255) on green.
- Zakat: default standard = GOLD (user correction) + hero copy updated.
- Community: group posts interleaved at pi%4===0 (positions 1,5,9…), 6 sample posts
  (Groups.tsx SAMPLE_FEED) + GROUP_MEMBERS extended — no top clustering.
- Videos: videos.tsx FlatList onScroll guard (index=round(y/VH)) + FeedCard
  VideoPostPlayer measureInWindow poll (450ms) pauses out-of-view video, resumes on
  return (auto-pause only). 
- Ruqyah learning: type=topic returns articles {sub_id,title,section_title,content[]
  blocks header|text|arabic|translation} — RuqyahArticle type + article READER modal
  (was rendering entry fields → empty). Verified live vs API.
- Home dates pill CENTERED. Ask Scholars: selection screen (3 cards) → per-view with
  '‹ Choices' back (content gated on picked != null).
- DeenPoints: DPIcon = assets/img/deenpoints.png image (all callers auto-covered);
  buy modal = 2×2 grid, BEST VALUE tag, bonus pills, check badge, coin in success state.
- CommentsModal: typing '@' → mention picker (DeenLink AI first, then MOCK_ACCOUNTS
  search); MentionText now renders [Quran x:y]/[Bukhari · n]/[Dua · …] as tappable
  gold links → /read/n, /tools/hadith, /tools/dua (AI replies' sources are deeplinks).
- DB: user has NOT added the schema .sql yet (checked again this pass — none in repo).
  API keys: recommend a PRIVATE GitHub repo + fine-grained PAT; keys fetched at build/
  runtime, NEVER committed to deenapp (public).

# ── pass 40 SHIPPED (master 11bce73, gh-pages 3dcbae8, probe35 ALL PASS, ios+android .hbc OK, live entry 200) ──

All 24 user items. Highlights future passes must know:

- ScoreShareSheet REWORK: 5 palettes (emerald/midnight/royal/cream/maroon) with
  distinct motifs, QR bottom-LEFT + label under it, footer right (collision fix),
  parametric LogoMark (evenodd crescent + star), Save photo primary (web download
  via svgWebDownload on nativeID dl-score-preview; native gallery), optional
  `friends` prop → ShareWithFriends multi-select picker delivering into inbox
  threads (dl.inbox.v2). Metric auto-shrinks for arabic/long text.
- ShareWithFriends.tsx (new): shared friend picker + deliverShareToFriends().
- CrescentLoader.tsx (new): animated crescent+star; used in quiz/exports/video
  buffering/zakat/mirath.
- BackButton.tsx (new, onDark prop): used by TopBar, PageHero, dua, tasbeeh,
  calendar, quiz (setup+results). Old "‹" glyphs gone.
- MIRATH ENGINE REWRITTEN (verified against 14 classical cases in-node):
  correct spouse shares (husband ½/¼, wife ¼/⅛ — old code had ¼/⅛ and ⅛/1/16),
  father residuary when no son (father-only = 100%; was the reported bug),
  umariyyatan mother, radd to non-spouse sharers, sisters as pure residuaries,
  hajb blocked at selection time (husband↔wife exclusive, son/father exclude
  siblings) with on-chip explanations. Fields start EMPTY. Shares bold.
  Report image (ReportSvg, nativeID dl-mirath-report) + An-Nisa 4:11/4:12/4:176
  modal. AI: mirath system prompt + NAV route + navAnswer keywords.
- 99 Names: language dropdown modal, ScoreShareSheet square share (arabic name
  as metric), play button ALWAYS visible (no-audio entries use expo-speech TTS
  ar → transliteration fallback; expo-speech added to package.json).
- Prayer month: fixed-width swipable table (minWidth 660), bigger fonts, export
  has DeenLink logo mark + QR bottom-right (both SVG and canvas paths), label
  "Share as image" (no A4).
- Adhan modal (prayer.tsx): praying.png illustration, crescent loader, Go to
  Prayer (scrolls top) / Cancel; preview button opens it too.
- Calendar: occasions have desc; gold days + upcoming rows open a detail modal;
  "About these dates" note (tabular calendar, auto month roll, no moon-sighting
  wait — confirm Ramadan/Eid locally); back button.
- Compass: per-design needles (thin/glow/diamond/dashed/tech) + faint compass
  watermark on the selected design chip.
- Zakat: islamicapi label gone; "which metal drives the calc" reflective line;
  gold+silver gram inputs moved under Trade goods; Calculate shows crescent
  loader then scrolls to result.
- Charity: Support DeenLink card is BACK (probe asserts it now; the pass-39
  "no DeenLink card" check was obsolete and updated); history screen guarded
  against unknown old categories (white-screen fix); receipt header = dark
  green gradient + star lattice texture.
- AI chat: user bubble paragraphs/bullets now inherit white (were theme-black
  on green in light mode); streamLLM paces deltas every 70ms.
- Community: GroupsSuggestStrip interleaved every 3rd card (accounts strip
  every 5th); FeedCard carries its own marginBottom 14 (cards can never touch);
  composer shows real image/video PREVIEW cards (video: web <video> + play
  badge) instead of chips; CreateGroupModal has gallery photo pickers for
  avatar + cover (photos win over emoji/style; group page already editable).
- audioBus.ts (new): registerAudioStop/claimExclusiveAudio — ruqyah, adhan and
  every useAudio instance are mutually exclusive (playing one stops others).
- Ruqyah: full-program card = our player (play/pause, seekable progress bar,
  time labels) + ruqyahPosition/seekRuqyahFrac; program + entry share use
  ShareWithFriends (no image generation).
- Learning hub: TOPICS rail with 8 real written lessons (tawhid, salah, wudu,
  ramadan, halal earnings, dua, hijri, janazah) opening an in-app sheet.
- Riddles/Jokes:Friends + image (ScoreShareSheet) buttons alongside post.
- Home: hijri+gregorian in ONE pill top-right above hero (compact gregorian,
  single occurrence; old inline dates removed from greeting).
- SunPath: night RETRACES the arc from Isha back to Fajr (no more walking past
  Subh + snap). location.ts re-geocodes cached placeholder names ("Your
  location"/coordinates) once — that was the incognito-vs-normal discrepancy.
- CommentsModal: @DeenLink (or leading @ai) in a comment → AI replies in-thread
  (keyed: streamLLM grounded on retrieveLocal ctx; fallback composeLocalAnswer),
  badge green, ~90 words, verify-then-answer prompt.

Gotchas hit this pass:
- pages-server.mjs signature is `<dir> <port>` — starting it with just the port
  serves a dir named "3996" and every probe fails with 500s. Always:
  `node scripts/pages-server.mjs dist 3996`.
- react-native-svg web toDataURL returns BARE base64 (svgRefToPng now re-adds
  the data: prefix) and its viewBox math uses viewport size — that's why web
  "save photo" rasterizes the DOM node itself (svgWebDownload).
- expo-speech added (works in Expo Go; not in the old module audit).

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

---
## Pass 52 — status (batch 1 SHIPPED, batch 2 PENDING)

**LIVE:** gh-pages `34a785f` (bundle `entry-42b1b458…js`, markers verified: crash screen + ANSWER MODE + `dl.goal.set.`) · deenlink-api main `f5b7fa5` (backend 434 files, 0 touched) · deenapp master `8327b53`.
**APK:** v0.1.1-preview — https://github.com/useeman32-design/deenapp/releases/download/v0.1.1-preview/deenlink-preview.apk

### Shipped in batch 1
1. **Daily goals bug FIXED.** Root cause: `daySet()` was recomputed on every read and the admin override (`setsCache`) arrives asynchronously, so the four visible goals swapped mid-day — activities done against the first set looked "counted" against the second. The set is now persisted per day (`dl.goal.set.<date>`); `markGoal()` also rejects unknown keys.
2. **Goals now teach navigation.** Tapping a goal opens its HUB with `?focus=<key>`; `src/lib/useGoalFocus.ts` smoothly scrolls to that card and flashes a gold ring (2.8 s). e.g. Tafsir → Learning Hub → scroll+highlight; Prayer → Worship Tools tab → highlight.
3. **Profile DeenPoints** now uses the shared `formatDP` (was a local `fmt` that only did `k`, no commas/M).
4. **AI screen:** globe → **lightbulb**; tapping opens an ANSWER MODE menu (Library only / Library + Web).
5. **AI typing indicator in comments moved to the TOP** of the thread.
6. **`@handle` is no longer injected** into the comment text field.

### ⚠️ WORKSPACE ROLLBACK — check after every turn
Five pass-51 files silently reverted in the working tree (boot watchdog, CrashBoundary, resilient fonts, lazy push, intl-free `formatDP`) and one commit pushed that regression before it was caught. Restored via `git checkout e47a726 -- <files>` in `8327b53`.
**Rule: before committing, verify pass-51 markers still exist** — `grep -c bootOk src/app/_layout.tsx`, `ls src/components/CrashBoundary.tsx`, `grep -c Font.loadAsync src/lib/fonts.ts`. All must be non-zero.

### Batch 2 — NOT STARTED (next turn)
- **Zikr Challenge** (`/tools/zikr-challenge`) is the real "daily dhikr" — move the adhkar challenge content INTO it; centre the counter + circular beads; balance the text. (`tools/athkar` is to be REMOVED per the user.)
- **Chat presence/last-seen/read receipts:** client already calls `/api/chat/presence.php` but **`api/chat/` does not exist in the backend** — the endpoints were never built. That is why nothing ever reflected.
- **Groq key from DB:** read the admin-stored key server-side so the AI works with no manual key entry.
- Still open: item 6 (99 Names translations) blocked on an IslamicAPI key + a Yoruba source.

### Deploy rules that must not be forgotten
- gh-pages wipe MUST exclude `.nojekyll` (`! -name '.nojekyll'`) or every JS chunk 404s → blank site.
- Always finish a deploy by curling an `_expo/` asset and asserting **200**.
- `.git` and `.git/config` do NOT survive between turns — re-clone or `git remote add origin` each time.

---
## WHY FILES SOMETIMES DON'T REFLECT — workspace snapshot budget (root cause)

The sandbox persists the workspace only up to **~128 MB / 10 000 files**. This session created
**553.6 MB across 2 766 files → 660 files were NOT saved.** Consequences, both observed:
1. Files silently revert to an older state between turns. Five pass-51 files did exactly that
   (`_layout.tsx` boot watchdog, `CrashBoundary.tsx`, `fonts.ts`, `push.ts`, `DeenPoints.tsx`) and one
   commit pushed the regression before it was caught. Restored in `8327b53`.
2. `.git` and `.git/config` are excluded from snapshots, so `origin` disappears — `git fetch` fails
   and, if chained with `&&`, silently skips the rest of the command.

**Note:** the *deployed* sites are never affected by this (they live on GitHub / the PHP server).
The risk is only that the sandbox hands back stale source, which can then be committed.

**What was eating the budget:** throwaway deploy clones `dlapi/` (35 MB) and `ghp/` (24 MB).
**Both are now deleted.** Re-clone them on demand and delete them again at the end of the session.

### Budget hygiene rules
- Never leave `ghp/`, `dlapi/`, `dist-web/`, `dist-root/`, `apkx*/`, or `*.apk` in the workspace.
- `deenapp/assets/content.zip` (17 MB) and `avatar.zip` (5.6 MB) must stay — EAS needs content.zip un-ignored.
- After any cleanup, re-run the rollback check above before committing.

---
## BATCH 2 — execution notes (so the next session does not re-investigate)

### 1. Zikr Challenge — the REAL daily dhikr
- Screen: `src/app/tools/zikr-challenge.tsx` (13 KB) + `src/lib/zikrChallenge.ts` (2.5 KB).
- The user's "daily dhikr" is HERE, **not** `src/app/tools/athkar.tsx` / `src/data/athkar.ts`.
  `tools/athkar` is to be **removed** (the user has asked twice).
- Work: move the adhkar *challenge* content into zikr-challenge; **centre** the counter and the
  circular bead ring; **balance** the surrounding text (it currently reads lopsided).
- Before deleting `tools/athkar`, grep for inbound links and re-point them:
  `grep -rn "tools/athkar" src/` — note `GOAL_META.athkar` / `GOAL_ROUTES.athkar` in `src/lib/routine.ts`
  and any Learning Hub entry.

### 2. Chat presence / last seen / read receipts
- Client side already exists: `src/api/client.ts:584`
  `chatPresence()` → `POST /api/chat/presence.php`; also `chatConversations`, `chatMessages`, `chatSend`, `chatRead`.
- **Backend gap (verified):** `deenlink-api` has **no `api/chat/` directory at all**. Every one of those
  calls 404s, which is exactly why nothing ever reflected in the UI.
- Build in `deenlink-api/api/chat/`: `conversations.php`, `messages.php`, `send.php`, `read.php`, `presence.php`.
  Follow the existing conventions: `api/lib/` helpers, and remember admin `json_out` is
  **`(int $code, array $payload)`** — two args, code first.
- No chat/conversation tables exist yet in the DB — they must be created (see the table list in BRIEFING.md).
- UI files: `src/app/tools/chat.tsx`, `src/components/CommunityInbox.tsx`.

### 3. Groq key from DB
- The key was saved once in the admin panel and lives in the database. Wire the AI to read it
  **server-side** so the user never types a key.
- Client: `src/app/tools/ai.tsx` (~54 KB), `src/lib/ai.ts`. Backend: `api/ai/*`, `ai_provider_keys` table exists.
- Related: `EXPO_PUBLIC_ISLAMIC_API_KEY` is exported by the build env (seen in the EAS log).

### 4. Also already done this pass, do not redo
Stable daily goals (`dl.goal.set.<date>`) · hub deep-link highlight (`src/lib/useGoalFocus.ts`,
`?focus=<key>` on Learning Hub + Worship Tools) · profile uses shared `formatDP` ·
AI lightbulb + ANSWER MODE menu · AI typing indicator at top of comments · no `@handle` injection.
