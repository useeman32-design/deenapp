# CONTINUE — pass 36 handoff (2026-09-01)

## Pass 36 SHIPPED (master 64a91a3, gh-pages f0899b4, probe35 ALL PASS, android .hbc OK)

### User-reported bugs FIXED this pass
1. **Misbaha restored** — user wanted the BACKGROUND removed, not the misbaha.
   `assets/img/misbaha-transparent.png` = original photo with the dark-green bg
   flood-filled out from the borders (bead shading preserved, feathered alpha).
   BEAD_PATH re-fitted to the beads ACTUALLY in the photo (29 bead centroids
   extracted from the alpha channel → ellipse fit cx .500 cy .499 rx .434
   ry .415, 33 beads arc-length-spaced, bead 0 at −100°). Glow layer renders
   UNDER the image; lit-bead dots + pulsing halo on the active bead.
2. **Month timetable page-death** — ROOT CAUSE: a local `function G` (React
   fragment wrapper) was used as a child INSIDE `<Svg>`; react-native-svg
   cannot take arbitrary components → crash on mount (the export SVG mounts
   immediately, so the whole page died). Fixed: import `G` from
   react-native-svg, delete the alias. VERIFIED at runtime (60 rows incl. the
   hidden export surface, hijri column populated).
3. **Hijri in the month table** — API hijri_date when present, else device
   Intl 'en-GB-u-ca-islamic-umalqura' (localHijri helper, works on Hermes).
4. **Fatwa "only a few"** — list was hard-capped at 30. Now ALL 1,325 load
   incrementally (pages of 40, auto-triggered 420px before scroll end +
   "Load more" fallback + "all N loaded" footer). Counter shows the real count.
5. **Splash logo tall-narrow** — both splash configs now use square 512px
   assets generated from logo-360.webp: `splash-icon.png` (transparent, 86%
   art) + `splash-full.png` (opaque brand bg); plugin imageWidth 76→220.
6. **Adhan preview buttons all lit** — was global isAdhanPlaying(); now
   per-voice `preview` state, only the playing voice shows pause; switching
   voices stops the previous; a real adhan firing resets preview.

### Groups (redesigned per user's sketch)
- **`/tools/group?id=…` — full-screen group profile** like a user profile:
  cover + medallion header, member/post chips, join/leave, 3 tabs —
  Posts (member posts as FeedCards + composer), Members (avatar stack +
  Connect), About (desc + info rows). GroupsRail cards push here (modal gone).
- Groups.tsx exports shared helpers: `loadGroups/saveGroups/SEED/gradFor/
  catIcon/GROUP_KEY/ME/groupPostAsFeed` — rail, screen and connections
  Groups tab all use them (stay in sync via dl.groups.v1).
- **Feed group posts are normal FeedCards** with a new `groupLabel` chip
  (emerald users-icon chip in the header row) — GroupFeedPosts in community.
- Create-group sheet upgraded: live card preview, 4 cover styles, category
  picker, open/by-request toggle.

### Loaders (slow-network pass)
- community feed: pages in 3 at a time with loader footer + auto-trigger
  (feedLimit state, resets on tab change)
- CommentsModal: 3-row shimmer + spinner on open (550ms)
- courses: 4-card skeleton + spinner while api.courses() resolves
- prayer-month: skeleton rows + "Building the month timetable…"
- fatwa: skeleton on first load + paging loader
- scholars/ruqyah already had spinners (verified)

### Learning hub — REDESIGNED (learning.tsx rewrite)
mecca hero banner w/ gradient + stat pills → QUICK PLAY gradient rail
(Quiz/Riddles/Jokes) → THE LIBRARY compact rows (Courses/Seerah/Prophets/
Articles/Fatwa) → gold About box.

### STILL OPEN (device verification, Expo Go)
- ~80% zoom fix + Display size S/M/L/XL (pass 35) — needs user confirm
- qibla, fullscreen cancel, adhan pause, video restart (pass 35 fixes)
- wallpapers save, share-card SVG export, prayer-month JPG export on device
- mic features stay Expo Go typed-fallback (hard limit)

### Standing facts
- Storage keys: + dl.ui.scale, dl.fatwa.saved. Groups = dl.groups.v1
  (SEED default g1/g2/g3; joined state lives inside the group objects).
- FeedCard new optional prop: `groupLabel` (chip next to username row).
- Onboarding sits BETWEEN auth and the app on first run — test flows must
  Sign In → Skip onboarding → Sign In again (probe35 handles it; raw dbg
  scripts must too).
- Sandbox reset notes: node_modules + playwright browser + apt libs are wiped
  — restore with `npm ci`, `node node_modules/playwright-core/cli.js install
  chromium-headless-shell`, `apt-get install -y libnspr4 libnss3
  libasound2t64 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1
  libpango-1.0-0 libcairo2`. Also .git remote is dropped → re-add with token
  from `.token`. Kill the pages server with `fuser -k 3996/tcp` (pkill -f
  matches your own shell).
- Deploy: bash scripts/export-web.sh → depth-1 clone gh-pages → wipe → cp
  dist/. . → commit → push. Local gate: pages-server on dist, port 3996,
  prefix /deenapp, then `node scripts/probe35.mjs` (ALL PASS at 64a91a3).
- scripts/ prune: dbg-learn.mjs + dbg36*.mjs deleted; diagNN.mjs + probe32-35
  remain (harmless).
