# ══ 2026-09-12 — PASS 83-39 BATCH 2: LEARNING HUB MODULES (lessons · riddles · fatwa · tafsir — admin-editable → app) ══
# deenapp master = 395aa55 · dlapi main = ef7549d · gh-pages = 33fc31f.
# OWNER ACTION: ONE dlapi cPanel pull (same as batch 1) — ships api + admin + new web root. Hard refresh.
# ── NEW ADMIN MODULES (each = its own management screen, linked from Learning Hub) ──
#  • Short Lessons (admin/lessons-management.html + api/admin/content/lessons.php): the 8 bundled
#    micro-lessons (tawhid, salah, wudu, ramadan, halal, dua, hijri, janazah) seeded; full CRUD —
#    points are plain lines "Heading | Body". App fetches /api/content/lessons.php (bundled fallback).
#  • Riddles (admin/riddles-management.html + .../riddles.php): 16 seeded; CRUD; app fetches
#    /api/content/riddles.php.
#  • Tafsir Library (admin/tafsir-management.html + .../tafsirs.php): enable/disable + order the 3
#    editions (Ibn Kathir / Ma'arif / Tazkirul); the app's picker follows the admin list.
#  • Fatwa & Rulings (admin/fatwa-management.html + .../fatwa.php): publish YOUR OWN rulings — they
#    appear FIRST in the app's Fatwa archive (the 1,080-entry islamqa base stays as the library).
#  • Learning Hub page = real hub now: module-grid of 14 cards, each opens ITS OWN management screen
#    (quiz/riddles/jokes/courses/tafsir/lessons/fatwa/articles/prophets/athkar+zikr/names/quran/
#    hadith/wallpapers); the sections CRUD stays below.
#  • Sidebar updated with the 4 new Content entries (single shared menu).
# ── APP (deenapp) ──
#  • src/lib/liveContent.ts: one store for lessons/riddles/tafsir/fatwa overlays (server-first,
#    bundled fallback, fail-open). client.ts exports publicGet() for no-auth content reads.
#  • zikr-challenge/duas were ALREADY admin-wired in 83-37 (useAllAthkar → /api/athkar/list.php).
# GATES: tsc clean · CHECK-RAW OK (128 files) · boot root 200 / assets 0 bad / unauth 401 ·
# every new endpoint round-trip verified on sandbox MariaDB (create→public visible→cleanup).
# NEXT (83-39 continues): donations app↔admin complaint polish, AI mgmt cleanup + clear-old-data,
#   wallpapers/avatar upload wiring (avatar.zip sets), verification & premium, backups restore test,
#   reports real-data sweep, seerah/ruqyah management screens.

# ══ 2026-09-12 — PASS 83-39: ADMIN OVERHAUL BATCH 1 (videos fix · shop · articles · jokes · boost · module toggles) ══
# deenapp master = 0ad58fd · dlapi main = 601d386 · gh-pages = e5a8229.
# OWNER ACTION: ONE dlapi cPanel pull ships everything (api + admin + RAW web root) → hard refresh.
# gh-pages updated automatically. THEN add ONE cPanel cron for the boost drip (every minute):
#   php /home/<user>/public_html/api/admin/boost/cron.php >/dev/null 2>&1
#   (without cron, boosts still drip whenever an admin opens Account Boosting — just slower).
# ── FIXED ──
#  • VIDEOS "failed to load management data": 4 files required ../admin/videos/common.php (missing
#    path → 500) + the seeder inserted account_id=1 with an EMPTY video_accounts (FK 1452 → 500).
#    Fixed both; verified 200 with content on a fresh DB.
#  • REPLY-TO-COMPLAINT 500 (owner-reported): endpoint read $_SESSION['user_id'] (admin sessions
#    store admin_user_id) → FK violation fk_complaints_admin on every reply. Fixed + hardened
#    (NULL when admin id is not a users row). Verified: reply saved, status resolved.
# ── NEW MODULES (admin) ──
#  • Shop Management (admin/shop.html + api/admin/shop/{products,orders,stats}.php): stats cards,
#    products CRUD, orders + status flow; seeded 13 real products. App reads the same tables.
#  • Islamic Articles (admin/articles-management.html) + Islamic Jokes (admin/jokes-management.html)
#    + api/admin/content/{articles,jokes}.php — seeded from the app's bundled content (6 / 10).
#    App now fetches /api/content/{articles,jokes}.php (server-first, bundled fallback) via
#    src/lib/articlesStore.ts — admin edits REACH the app.
#  • Account Boosting (admin/boost.html + api/admin/boost/*): 12 dummy ACTOR accounts (real
#    profile images from avatar.zip → img/profile/actors/, distinct names, varied follower counts,
#    viewable profiles); orders drip ~3/min (rate 1–10) with a push/in-app notification PER EVENT;
#    likes hit community/group posts + videos; pause/resume/cancel; progress bars; actor pool view.
#  • SINGLE SHARED SIDEBAR: admin/assets/sidebar.js (one menu, active item from URL) injected into
#    ALL 33 admin pages + nav-section CSS in perms.css — fixes the menu-jumping bug. Pages to
#    create earlier (articles/jokes/shop/boost) now exist.
# ── WIRED/EDITABLE ──
#  • App Defaults: seeded 6 rotating goal sets + 6 quick-access defaults (admin defaults.html is
#    editable; app reads /api/defaults/get.php). Prophets (25) / Duas&Athkar (32) / Names (99)
#    admin lists now return content (list.php aliases + seed-on-empty from app data).
#  • Module on/off toggles: System Settings → "App Modules" — 12 NEW keys (shop boost learning
#    quiz articles jokes chat wallpapers events names athkar prophets) + existing 8. Off = app
#    shows "Under maintenance" gate (src/app/tools/_layout.tsx + src/lib/maintenance.ts; fails OPEN).
#  • DeenPoints: "Clear old data" danger-zone button (api/admin/deenpoints/purge.php, master pin
#    230720 — same as donations reset) wipes ledger + one-time reward markers only.
# ── APP (deenapp) ──
#  • Comment report: tiny red flag next to every comment → reason picker → report_comment.php
#    (flows into admin Reports & Moderation).
#  • Charity balance REMOVED from profile (quick button) + edit-profile (hide-charity toggle gone).
#  • Shop: demo order/cart fabrication REMOVED (LIVE = real data only; explicit "unable to place
#    order" when server unreachable).
# GATES: tsc clean · CHECK-RAW OK (128 files, 0 /deenapp/ refs) · boot root 200/assets 0 bad ·
# unauth shared_with_me 401 · quiz bank 166 · every new endpoint 200-verified on sandbox MariaDB.
# INCIDENT: sandbox recycle rolled deenapp .git back to 83-37 (snapshot file-cap dropped objects).
#   Working tree was intact → re-anchored: fetch origin (token URL from CONTINUE.md:91) →
#   git reset 5e492d4 → only true 83-39 diffs remained → commit. gh-pages got one empty push
#   (56656e0) mid-repair, restored in e5a8229 (475 files) — no force-push used.
# NEXT (83-39 continues): Learning Hub per-module click-through screens polish, donations app↔admin
#   complaint flow polish, AI mgmt cleanup, wallpapers/avatar admin upload wiring, prophets public
#   API for app, verification & premium wiring, backups restore test, reports real-data sweep.

# ══ 2026-09-13 — PASS 83-38d: OWNER DESIGN — Quran page cleanup (permanent this time) ══
# deenapp master = 6f3f680 · dlapi main = 56e010d · gh-pages = c790e02.
# OWNER pulled in cPanel, saw the removed design come back: he had hand-removed Quran Shazam +
# the Seerah/Courses/Quiz shortcut buttons on the Qur'an & Hadith page, and had added a
# notifications demo button — OUTSIDE the repos. Hand edits on the server are wiped by every
# deploy (the app pages are compiled from the repos, not editable HTML). LESSON for owner:
# any design change must be made IN THE REPO — tell the agent, never edit server files.
# DONE (now permanent in source):
#  • Quran & Hadith page (src/app/(tabs)/quran/index.tsx): Quran Shazam block + shazam state/
#    modal/import removed; Seerah/Courses/Quiz shortcuts row removed (-70 lines; tsc clean).
#  • Notifications demo button: SKIPPED — owner confirmed it was only to test push (worked),
#    no longer needed.
#  RECOVERY again (stale restore trimmed history mid-pass): salvage pattern — commit existed
#  locally on wrong base; soft copy of the one changed file onto reset --hard origin/master.
#  GATES: tsc clean · CHECK-RAW OK (222 files) · boot root 200/assets ok. gh-pages pushed (PWA
#  already live). OWNER: one dlapi cPanel pull for the root; hard-refresh browser (cache).
# ══ 2026-09-12 — PASS 83-38c: VIDEO SHARING IS REAL (+ "no shared videos yet" explained) ══
# deenapp master = 828466e · dlapi main = ceb46c1 (api+admin+RAW web root merged) · gh-pages = 45a28e0.
# OWNER ASKED what "No shared videos yet" meant. Truth found while answering:
#  • The old Videos-page "shared with you" inbox was DEMO (5 fake friends, fake shares) AND its
#    component was DEAD CODE (never rendered). The quick "SEND TO" row + friends modal faked
#    success (toast "Sent to @x" WITHOUT sending anything).
#  FIX (shipped):
#  • Share sheet SEND TO + friends-modal send now REALLY deliver: chatStartDMByUsername →
#    chatSendShare(kind 'reel', payload {sub, route /videos?start=<id>}) — the recipient gets a
#    real share card in the DM (CommunityInbox) and long-press routes back to the video.
#    Failures toast "Unable to send…" (never fake success).
#  • Dead InboxOverlay deleted (~280 lines). Recipients see shares in their DM inbox (real).
#  • NEW api/chat/shared_with_me.php (GET ?kind=reel): every share actually sent/received in my
#    DMs (group + deleted excluded; peer identity + payload). SQL verified on seeded MariaDB
#    (group/deleted filtered, both directions). 401 unauth. Ready if owner wants a dedicated
#    "videos shared with me" screen later; client helper chatSharedWithMe() ships in client.ts.
#  GATES: tsc clean · _check_calls 5 vendor-only · CHECK-RAW OK (221 files) · boot root 200/assets ok.
#  Commits: dlapi a45c0cb (endpoint) + ceb46c1 (web merge); deenapp 828466e; gh-pages 45a28e0.

# ══ 2026-09-12 — PASS 83-38b: LAUNCH CLEANUP TOOL + FINAL DEMO SCRUB ══ READ FIRST ══
# deenapp master = cc3783b · dlapi main = da8eb50 (api+admin+RAW web root merged) · gh-pages = 5a20167.
# OWNER REPEATED "remove every demo data in the live" → TWO MORE THINGS SHIPPED:
#  1. LAUNCH CLEANUP (admin dashboard card, under the stats grid): one click per section —
#     Community posts / Videos / Notifications / Chat / Starter courses (83-37) / Learning
#     modules (83-37). Backend: api/admin/launch_cleanup.php (admin session + CSRF; 401 unauth;
#     money/users/settings/quiz-bank NEVER touched). PURGED SEEDS STAY PURGED: purge flips
#     seeds.courses_disabled / seeds.learning_disabled in system_settings; seed_defaults.php
#     checks the switch (verified E2E on a real MariaDB: purge+hit→0, switch off→7 return).
#     phpMyAdmin alternative unchanged: scripts/purge-demo-content.sql.
#  2. FINAL DEMO SCRUB in the app (deep sweep): demo DM threads (CommunityInbox SEED — legacy
#     cached demo chats scrubbed by name), demo notifications (SEED), demo scholar Q&A
#     ([username] ANSWERED), video-share demo threads (videos INBOX_THREADS → honest empty state),
#     demo persona names ("Abdulrahman Al-Harbi"/"abdalrahman" → You/me), ALL pravatar.cc avatars
#     → real photos or initials (AvatarImage). grep-clean: zero demo strings remain.
#  SANDBOX E2E (real MariaDB): /api/learning/list → 15 modules · /api/courses/list → 7 courses ·
#  /api/quiz/bank.php → 166 · launch_cleanup unauth → 401 · seed kill-switch verified.
#  NOTE: api/config/config.php is GITIGNORED (live secrets) — fresh clones need it from the host;
#  the owner's cPanel tree already has it. learning/list.php fatals without it (by design).
#  GATES: tsc clean · php -l · _check_calls (5 known vendor only) · CHECK-RAW OK (220 files) ·
#  boot root+gh 200/assets ok. RECOVERY (2 stale restores this pass): soft-reset onto origin
#  kept history clean — never force-push.

# ══ 2026-09-12 — PASS 83-38: REAL DATA ONLY (all demo content removed) ══ READ FIRST ══
# deenapp master = 4acc2e6 · dlapi main = eb06b44 (api+admin+RAW web root merged) · gh-pages = 462661c.
# OWNER: "remove every demo data in the live — posts and everything, videos samples too — we only
# serve real data now." DONE ON BOTH SIDES:
#   APP BUILD (never fabricates anything anymore):
#    • client.ts: feed/videos/courses/scholars/events/userPosts fall back to EMPTY — no mock fill.
#    • mocks.ts gutted to types + preview-only MOCK_USER (FORCE_DEMO never runs on app domains) +
#      bundled wallpapers (real shipped feature). All fake posts/accounts/comments/videos/reels/
#      trending/followed/profiles/scholars/courses/events deleted.
#    • Videos page: sample clips GONE from create studio (library/file pick only); reels feed plays
#      server reels only; offline posting shows "Unable to post — you appear to be offline" (no demo
#      persona reel); reels/community cross-post lists use the REAL follow graph (getConnections).
#    • Community/Home/Search/Hashtag: no demo feed fill; account search = api.searchAccounts;
#      Following tab = real follow graph; TRENDING renders only with real data (empty now).
#    • Mentions (CommentsModal), Share/Send-to-friends, DM forward list, new-chat → real connections.
#    • Notifications: no mock actor enrichment. Post deep-link: server-only ("missed" if absent).
#    • Scholars page: roster from api.scholars() (server); demo public Q&A removed.
#    • Profile pages: no fabricated profiles — real server profile or honest "not found".
#   DATABASE (owner-run, in dlapi scripts/purge-demo-content.sql):
#    • CHECK counts + labelled optional purges: posts(+media/likes/comments/replies/polls/reports),
#      videos(+likes/comments/views/reposts), notifications, chat, and opt-out for 83-37 seeds
#      (starter courses + learning modules). Money/points/accounts NEVER touched.
#   KEPT (not demo): 166-question quiz bank, seeded learning modules + 7 starter courses
#    (owner-editable in admin — say the word and they go), wallpapers, quiz/riddles/jokes packs.
#   GATES: tsc clean (6.0.3) · CHECK-RAW OK on merged dlapi (212 files) · boot :8086 root + :8087 gh
#   (200, assets 0 bad, bank 166) · pushed: deenapp 4acc2e6, dlapi eb06b44, gh-pages 462661c.
#   OWNER: one dlapi cPanel pull = new build + purge script; run the SQL for the sections wanted.

# ══ 2026-09-12 — PASS 83-37: ADMIN DATA + QUIZ BANK + ADS KEYS + PROFILE SYNC ══ READ FIRST ══
# deenapp master = 7093ba8 · dlapi main = c1c3770 (api+admin+RAW web root merged) · gh-pages = 4e22e35.
# RECOVERY NOTE: /tmp was wiped AND the workspace restored a stale snapshot mid-pass (deenapp back at
# 731b84b, .git/config gone). Recovery that worked (do this, never force-push):
#   git remote add origin "https://$(cat .token)@github.com/useeman32-design/deenapp.git"  (config is
#   NOT snapshotted — always re-add after a restore) → git reset --hard origin/master → re-apply
#   uncommitted edits (they survive in the snapshot) → dlapi: clone
#   https://x-access-token:$(cat .token)@github.com/useeman32-design/deenlink-api.git (branch main).
#
# OWNER ISSUES 83-37 → FIXES:
#  1. "Admin modules return zero contents": tables existed but EMPTY. New api/lib/seed_defaults.php
#     self-seeds on FIRST list hit, COUNT(*)=0-guarded (never overwrites admin edits):
#     learning_sections ← the 15 modules the app ships (quiz/riddles/jokes + 12 library, icon/grad/
#     chip/cta/href mirror learning.tsx); courses ← 7 starter courses (= app MOCK_COURSES; 1 module +
#     3 article lessons each, intro is_preview=1, published+public, pointer HTML → admin editor).
#     Wired into api/{learning,admin/learning,courses,admin/courses}/list.php.
#  2. Quizzes add/adjust/remove: bank file learning/data/quiz_questions.json CREATED (166 questions
#     compiled from src/data/quiz.ts QUIZ_POOL+EXTRA via local tsc; {question,options,correct,
#     explanation,category,multiCorrect?}). Admin → Quiz Management list/save now has real data.
#  3. App quiz = admin's bank: new public GET /api/quiz/bank.php (reads the bank file, empty-safe);
#     client.ts quizBank(); quiz.tsx plays server bank when non-empty, bundled set = offline fallback;
#     header/chip counts follow the ACTIVE pool. Admin edits reach devices on next quiz open.
#  4. Posting → profile instant: lib/userPosts.ts markProfileDirty()/consumeProfileDirty();
#     community.tsx + group.tsx (incl. salvage path) mark on success; profile.tsx useFocusEffect
#     refetches userPosts+profileCounts when dirty. No pull-to-refresh, no wait.
#  5. Real charity balance: done in 83-36 (owner-currency totals) — unchanged, still live.
#  6. Ads keys: admin → Donations & Monetizations → new "Adverts Setup — Your Keys" card (AdSense
#     client+slot = web/PWA, AdMob app/banner/interstitial/rewarded = native; per policy AdMob never
#     serves the PWA). Stored via admin settings get/save (ads.* whitelisted), exposed publicly via
#     settings/public.php ads.* for the app to consume. NOTE: admin settings/get.php was missing
#     posting.community_video (83-36 toggle didn't round-trip in the UI) — added with ads.*.
#  7. DeenLink AI page: FOUND ALREADY WIRED (admin/deenlinkai-live.js does overview/datasets/
#     provider-keys against api/deenai/admin/*; chat.php uses ai_provider_keys). Owner just opens
#     Admin → DeenLink AI → saves a Groq/Gemini/OpenRouter/HuggingFace key → app AI answers.
#     api/admin/quiz/common.php now preserves category on saves (app tabs keep working).
#
# GATES: tsc --noEmit clean (local 6.0.3) · php -l all touched · _check_calls (5 known vendor
# imap/idn only) · check-raw OK on merged dlapi tree (204 files) · boot tests :8084 root + :8085 gh
# (index 200, assets 0 bad, bank.php = 166). OWNER: ONE dlapi cPanel pull ships 83-37 (api+admin+web).
# Verify after pull: Learning hub modules list + open → contents; Courses show 7 starters + lessons;
# Quiz plays; Quiz Management lists 166; Adverts Setup card saves; AI page after adding a key.

# ══ 2026-09-11 — PASS 83-36 (latest state) ══
# deenapp 4daacef · dlapi eb990b3 (OWNER PULL = api + admin + web root) · gh-pages 4e3484f.
# Scope: delete fix (string-id compare), no self-profile nav, admin video toggle (posting.community_video, default OFF),
# real donation totals + country currency (profile tab + public), login prefetch (instant tabs),
# image-post freeze fix (paint-then-compress, web small-image skip), YT inline fix (WebView baseUrl),
# group pill = screen-root byte-identical, ffmpeg compress+watermark lib (self-disabling).
# VERIFY AFTER PULL: delete own post on HOME; toggle in Admin → Videos Management; Charity shows
# your currency; post an image (no freeze); tap a YouTube post (plays); which ffmpeg on the host.
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-35 (latest state) ══
# deenapp 93153a0 · dlapi 5862cd0 (OWNER PULL — api/ + admin/ + web root, all in-repo) · gh-pages 53ff722 (live for PWA users once Pages CDN settles).
# Scope: owner's 15-point batch — delete-own-post on HOME, video expand → videos-page reels (NO in-card fullscreen),
# pinch-in zen reels, group chips on reels + tap-to-group, reels mirrored to community, working search,
# stop-on-end + stop-on-navigate, text-only optimistic rows, exact community pill in group + videos composers,
# '*/*' audio picker, YT inline (modal gone), group YT-only "Post text required" fix (multipart by CONTENT TYPE),
# admin join-request accept/reject page + sidebar links on every admin screen.
# COMPRESSION: images compressed (≤1600px JPEG q0.78 client + GD 1080/360 server); videos NOT transcoded (no ffmpeg on host).
# VERIFY AFTER PULL: reel mirror on /videos upload; admin/groups.html approve flow; group YT-only post; audio pick on a REAL device.
# Native dev build still owed (iOS audio via Files).
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-34 (latest state) ══
# deenapp a6b015b · dlapi 0caae0f (OWNER PULL) · gh-pages 5efdebd. Scope was group posting + videos only.
# Native dev build required for the iOS audio UTI fix. See CONTINUE.md header for the diagnose→fix map.
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — HOTFIX 83-33b (latest state) ══
# deenlink-api main = ae2e0a6 — OWNER MUST PULL (live still blank until then; 1f311b1 shipped GH-flavor to root, 3rd occurrence of the 83-31c mistake).
# ROOT IS NOW: genuine RAW (export-raw.sh + check-raw.mjs gate, merged-tree boot-tested 0/0).
# RULES: root artifact ONLY via scripts/export-raw.sh; gh via export-web.sh + push immediately; gate with NO pipes; boot-test the merged tree. See CONTINUE.md header.
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-33 SHIPPED (latest state) ══
# deenlink-api main = 1f311b1 (owner: PULL — admin rebuilt on his admin.zip UI + 8 fatal endpoints fixed + CSRF) · deenapp master = 83-32 client (c2b0afd) · gh-pages = 566342a.
# Admin render-tested 17/17 via pptr admin-test.js (mocked APIs). Build script preserved: /tmp/build_admin.py (workspace-volatile — the committed pages are the artifact).
# NEXT: announcements modal in app home (client-side only), then owner device tests.
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-32 SHIPPED (latest state) ══
# deenlink-api main = 57dd492 (83-32a backend helpers restore df3f091 LIVE-VERIFIED + 83-32b dual-channel test push — owner pull AGAIN) · deenapp master = 03b390b · gh-pages = 566342a.
# Raw cPanel export in dist/ (BASE='' slashguard run — root-safe). GH flavor via export-web.sh.
# Everything from the owner's 14-item list is addressed; see CONTINUE.md header for the item map.
# Remaining/next: video processing gate (needs is_processed surfaced in list.php), owner test of
# group posting + PWA push after pulling 57dd492, iOS audio picker re-test on device.
# ═════════════════════════════════════════════════════════════════════════════════════

<!-- =====================================================================
     LATEST — 2026-09-11 · PASS 83-31 SHIPPED. *** READ FIRST ***
     deenapp master @ (see git log) · gh-pages @ 3b85505 (entry-29086947, LIVE ✓) · deenlink-api main @ 41b9bb0 (backend bba164f + web ROOT=raw entry-f6de6092 + /deenapp/ compat shim)
     ⚠️ 83-31 web deploy shipped the GH-PAGES flavor (base /deenapp/) to the cPanel ROOT → white screen
     ('Unexpected token <' — .js requests got the SPA-fallback HTML). FIXED in 41b9bb0 + boot-tested.
     RULE: dlapi root = RAW export ONLY; gh-pages = slashguard flavor; serving roots merge, never prune.
     GROUP POSTING FIXED (server youtube block restored — every group post 400'd before) · REPOSTS:
     posts.repost_of healed + create/get embed + FeedCard REPOSTED tag w/ original author box; share
     sheet "Repost" row replaces "share as post" · SHARE-AS-IMAGE: sheet swaps to preview w/ Cancel;
     post replica (avatar/name/@user/content/photo/like+comment counts) + logo + QR (web canvas +
     native SVG 1080×1280) · VIDEO FULLSCREEN: in-app Modal w/ custom controls ONLY (browser/native
     player gone; same-player binding = no reload); single video container (media image-filter) ·
     GROUP FEED: silent retry + 45s timeout + rejections handled · LIKE TRUTH: profile seeds
     liked_by_me + shared likeStore, delta counts · feed SWR cache + focus refresh (15s) · demo
     comments REMOVED · zakat CTA → /tools/zakat · zakat/fx ?base=NGN local currency · courses()
     merges server+bundled 20 · chat scroll restore · iOS PWA add-to-home sheet · test-notification
     button (send_test_expo.php) + 5s adhan-notification test (scheduleAdhanTest) · withAdhanFullScreen
     config plugin (channel setFullScreenIntent; needs NEW dev build) · search Top shows groups ·
     watermark crf20/medium.
     ⚠️ cPanel pull PENDING (owner) — group-post fix + reposts + fx-base go live with it; Android
     dev build required for draw-over/adhan tests.
     ===================================================================== -->

<!-- =====================================================================
     PREVIOUS — 2026-09-11 · PASS 83-30 SHIPPED. *** READ FIRST ***
     deenapp master @ f7e668c · gh-pages @ 4bce7bc (entry-431a29ee, LIVE 200 + sw.js 200) · deenlink-api main @ 062073d (admin shell v2 + web entry-431a29ee)
     Donations: Support-DeenLink recipient picker GONE (what-it-funds note instead); ONE searchable
     currency picker (USD/NGN/EUR/GBP pinned, full Flutterwave-chargeable list; SAR/AED removed) on all
     3 screens · Hijri calendar bottom description removed · home streak card → Qur'an screen ·
     ADHAN WITH APP CLOSED: 72h local schedule on MAX channel, tap opens prayer adhan-modal w/ Turn-off,
     exact-alarm/full-screen permissions added (needs dev build) · browser VAPID push (public/sw.js +
     subscribe) · ADMIN SPA v2: one chrome/design for every module (admin/assets/shell2.*), sidebar
     search, pjax with full-load fallback, all 409 api php lint ok, wallpapers wired; gap: hadith admin
     page is a placeholder (no hadith API — content ships via packs).
     AdMob rewarded-ads setup guide: REWARDED-ADS-SETUP.md (repo root).
     ⚠️ cPanel pull PENDING (owner) — admin v2 + web root go live with it.
     ===================================================================== -->

<!-- =====================================================================
     PREVIOUS — 2026-09-11 · PASS 83-29 SHIPPED (12-item owner fix pass).
     deenapp master @ da5536b · gh-pages @ a16dded (entry-20ea9c0a, LIVE 200) · deenlink-api main @ 44e5916 (backend + web entry-6400e40c)
     Items: inbox last-message previews (+last_sender from conversations.php) · prayer sun night-park
     (no retrace) · tasbeeh 99 beads + attached head + scrollable settings · athkar completed + meanings
     + FA5 section icons · fatwa Ask-a-Scholar removed · quran Shazam + bottom shortcuts removed ·
     20 courses (10 professional w/ curricula+quizzes) · real charity stat via donations/user_summary.php ·
     Allow-group-adding toggle + SERVER enforcement (users/group_privacy.php, members.php 403
     no_group_add, "Cannot add @u Name" / "Cannot add @a, @b and @c") · inbox/DM status-bar padding.
     ITEM 8 ANSWER (native voice): expo-speech-recognition already integrated — needs a DEV BUILD
     (npx expo run:android / eas build), Expo Go cannot load native modules.
     ⚠️ cPanel pull PENDING (owner) — brings 83-29 backend (group_privacy.php, members.php guard,
     conversations.php last_sender) + web root entry-6400e40c live. 83-28 backend rides along if not pulled yet.
     ===================================================================== -->

<!-- =====================================================================
     PREVIOUS — 2026-09-10 · PASS 83-28 SHIPPED (20-item owner bug-report pass).
     deenapp master @ 7c7f6d4 · gh-pages @ 182aec7 (entry-df6b6e97, LIVE 200) · deenlink-api main @ da558b1 (backend + web entry-c2139646)
     ⚠️ cPanel pull PENDING (owner): brings 83-28 backend (groups posts fix, video URL heal, notif expiry,
     join requests, security-question verify, X-Deenlink-Ffmpeg diag) + web root entry-c2139646 live.
     PREVIOUS — HOTFIX 83-27 (575981e, Expo Go svg crash; carried into 83-28 web bundles).
     PREVIOUS — PASS 83-26 SHIPPED.
     deenapp master @ 68bccf4 (notif de-dummy + share-tap + live quiz/riddle/group shares + watermarked downloads + skeletons + group pill)
     gh-pages @ 3510035 (entry-f6ed812c, LIVE-verified 200)
     deenlink-api main @ 9ba1ca8 (backend 0d1f265 + web entry-f6ed812c)
     cPanel pull DONE (2026-09-10): 83-25/83-26 backend+web LIVE on app.deenlink.org, six markers curl-verified · backup2 one pass behind (refresh needs owner OK)
     THE BACKUP IS deenapp-backup2 (snapshot-style: master = app tree,
     deenlink-api-main = api tree, + content-pack/content.zip at master root).
     deenapp-backup (no 2) is DEPRECATED — do not use it.
     CLONE RULE (owner, 2026-09-10): a fresh clone is NOT complete until assets are
     restored too — workspace pull AND content pack AND avatars/articles check
     (exact commands in "A FRESH CLONE IS NOT ENOUGH" below). A code-only clone
     cannot bundle: 6 source files require() assets/content/**.
     unpack-content.mjs fallback = PUBLIC release-asset URL (backup2 is private so its
     raw URL can't serve fresh clones; its content-pack/ copy is owner-recoverable with PAT).
     gh-pages content.zip restored (both previous pack URLs had 404'd).
     Docs lag: passes 83-14..83-26 exist only as commit messages (docs/ ends at 83-13).
     ===================================================================== -->

<!-- =====================================================================
     LATEST HANDOFF — 2026-09-06 · PASS 68.  *** START HERE ***
     Detailed state + pending work: CONTINUE.md (same folder)
     ===================================================================== -->

## Where everything lives
- **RN app (PUBLIC):** `github.com/useeman32-design/deenapp` — branch `master`.
  gh-pages serves the web build at https://useeman32-design.github.io/deenapp/
- **Backend + admin (PRIVATE):** `github.com/useeman32-design/deenlink-api` — branch `main`.
  `deenlink.org` / `app.deenlink.org` are **separate manual `git pull`** deployments. gh-pages has no PHP.
- GitHub token: `deenapp/.token` (gitignored) · Expo token: `deenapp/.expo-token` (gitignored, chmod 600).
  **NEVER commit either.** Do not rotate the GitHub token. Keep `deenapp` public (free Pages requires it).

## Live right now
gh-pages `d1559f8` (pass-68 build; content.zip intact) · deenlink-api main `d61c6ae` (pass-68 backend 5248f6e — realtime typing/notifications/search_posts, harness 24/24 — + pass-68 web build) · deenapp master `877e9ac` (pass 68) · backup mirror + content-pack `2556147`
⚠️ **`app.deenlink.org` needs ONE manual `git pull` in cPanel Terminal** — brings the white-screen fix (pass 67 `810977f`) AND realtime chat + notifications + search (pass 68). Nothing since pass 52 is live there until the user pulls.
⚠️ **export-root.sh rule:** root-base builds must keep `BASE=""` — never patch `appendBaseUrl`'s default to `"/"` (every call site omits the arg; `n="/"` collapses paths to `"//"` → boot crash). The `t`-leading-slash guard alone is safe.
Android APK **v0.1.1-preview**: https://github.com/useeman32-design/deenapp/releases/download/v0.1.1-preview/deenlink-preview.apk

## First commands in a new session
```bash
cd deenapp && npm ci && ./node_modules/.bin/tsc --noEmit     # expect TSC_EXIT 0
# .git and .git/config DO NOT survive between turns — re-add the remote:
git remote add origin "https://x-access-token:$(cat .token)@github.com/useeman32-design/deenapp.git"
```

## 🤝 TWO-CHAT REVIEW GATE
Another agent may be working this repo concurrently. **It writes ONLY inside `new-agent-update/`**
(mirroring real paths, plus a `CHANGES.md`), never `src/`, never a deploy. This chat reviews that folder,
runs `tsc`, re-checks the rollback markers and pass-52 behaviour, and only then integrates + deploys.
Full protocol in `CONTINUE.md` → "REVIEW-GATE WORKFLOW".

## 🔴 A FRESH CLONE IS NOT ENOUGH — restore these first
`assets/content/`, `assets/content.zip` and `assets/avatars/` are **untracked**, so `git clone` will NOT
give them to you — and 6 source files `require()` those datasets, so Metro/EAS will fail to bundle without them.
```bash
cd deenapp
curl -sL -o assets/content.zip https://github.com/useeman32-design/deenapp/releases/download/v0.1.1-preview/content.zip
node scripts/unpack-content.mjs          # extracts hadith/ islamic/ quran/  (~20 MB, 3 top-level dirs)
ls assets/content                        # expect: hadith  islamic  quran
```
Three asset trees the code `require()`s are NOT in git. Restore ALL of them or Metro/EAS will fail:
```bash
REL=https://github.com/useeman32-design/deenapp/releases/download/v0.1.1-preview

# 1. assets/content/ — 147 files, 20 MB (6 source files depend on it)
curl -sL -o assets/content.zip $REL/content.zip && node scripts/unpack-content.mjs
ls assets/content            # expect: hadith  islamic  quran

# 2. assets/avatars/ — 62 files, 5.8 MB (src/data/avatars.ts). Source IS in git as avatar.zip,
#    but it stores them under profile/ — the code expects assets/avatars/. VERIFIED working:
unzip -q avatar.zip -d /tmp/av && mkdir -p assets/avatars && cp -r /tmp/av/profile/* assets/avatars/ && rm -rf /tmp/av
ls assets/avatars            # expect: female  male   (62 files)

# 3. assets/img/articles/ — 6 files, 2 MB (src/data/learn.ts)
curl -sL -o /tmp/ia.zip $REL/img-articles.zip && unzip -qo /tmp/ia.zip -d assets/img/ && rm -f /tmp/ia.zip
ls assets/img/articles       # expect 6 .jpg files
```
Also **not** in the repo (gitignored, must be supplied by the user): `.token` (GitHub PAT) and
`.expo-token` (Expo access token). Without `.token` you cannot push or deploy.

## ⚠️ MANDATORY rollback check before EVERY commit
The sandbox workspace is capped (~128 MB / 10 000 files). When it overflows, files **silently revert**
and a later commit pushes the regression. This already happened once (pass 51 was reverted and re-committed).
```bash
grep -c bootOk src/app/_layout.tsx                 # must be > 0
ls src/components/CrashBoundary.tsx                # must exist
grep -c 'Font.loadAsync' src/lib/fonts.ts          # must be > 0
grep -c groupThousands src/components/DeenPoints.tsx
ls src/lib/useGoalFocus.ts
```
If any is missing, restore from history — but note **this repo is a depth-1 shallow clone**, so old
commits are NOT present and a bare `git checkout <sha> -- <path>` fails with `invalid reference`.
Verified recovery recipe (tested 2026-09-05):
```bash
git fetch --deepen 40 origin master        # 1 -> 41 commits, .git only 33M -> 35M
git checkout <last-good-sha> -- <those paths>
```
`git fetch --depth 1 origin <sha>` does **NOT** work — GitHub answers `couldn't find remote ref <sha>`.
Use `--deepen N` (or `--unshallow` if you need everything).

## Deploy rules (do not skip)
1. Every UI change ships to **BOTH** builds: gh-pages (`baseUrl "/deenapp"`) **and** deenlink-api web (`baseUrl "/"`).
   Two separate `expo export` runs. Never let them drift.
2. gh-pages wipe MUST exclude `.nojekyll`, or every JS chunk 404s → **blank site**:
   `find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.nojekyll' -exec rm -rf {} +`
3. After pushing, `curl` an `_expo/` asset and assert **HTTP 200**. `index.html` 200 is NOT sufficient proof.
4. In deenlink-api, verify **434** `api/|admin/|vendor/` files before and after, and **0** backend files in the diff.
5. **Delete throwaway clones** (`ghp/`, `dlapi/`) when done — they are what overflowed the workspace budget.
6. `dist` builds are NOT shipping. Done = pushed AND verified live.

## Pending work (batch 2) — see CONTINUE.md for full detail
- **Zikr Challenge** `/tools/zikr-challenge` is the REAL "daily dhikr": move the adhkar challenge content into it,
  centre the counter + circular beads, balance the text. `tools/athkar` is to be **removed**.
- **Chat presence / last-seen / read receipts:** client already calls `/api/chat/presence.php` but
  **`api/chat/` does not exist in the backend** — endpoints were never built. Backend work, not UI.
- **Groq key from DB:** DONE (night pass) — `api/deenai/status.php` + `deenai/chat.php` read `ai_provider_keys`; the app hides the key field when connected. Still needs the cPanel `git pull` to go live.
- **99 Names translations (item 6):** blocked — needs an IslamicAPI key (ha/sw/bn/fr, no Yoruba) + a verified Yoruba source.
  Do NOT generate religious text from memory; a previous attempt produced duplicated/wrong entries and was discarded.

---
# DeenLink — fresh-agent handoff prompt

**Copy everything below the line into your new agent chat as the first message.**

---

I'm continuing DeenLink, a mature Expo SDK 57 (React Native + expo-router) Islamic super-app. 42 passes have shipped; the previous chat got too heavy, so you're starting clean. **Read `CONTINUE.md` in the repo first** — it's the running handoff log with everything that shipped, restore commands, deploy procedure, and standing constraints.

Latest (pass 42, master `bc6634e` / gh-pages `efbc94b`): tafsir tool, daily zikr challenge, short lessons screen, learning-hub rework, 5 unique adhan designs, per-design qibla back arrows, drawn SVG misbaha, course quizzes, scholar Q&A asker+scholar identities, home Today's-Goal modal, universal videos (community↔reels), AI tafsir-context + NAV chips. Gates: probe35 24/24 + probe42 11/11.

## 1. Clone & environment

- Repo: `https://github.com/useeman32-design/deenapp` (default branch `master`; the web build deploys from the `gh-pages` branch to https://useeman32-design.github.io/deenapp/)
- **Repo inventory (pass 43):**
  | repo | visibility | purpose |
  |---|---|---|
  | `deenapp` | **public** (must stay — GitHub Pages needs it on the Free plan; making it private returns 422 and kills the live site) | the app |
  | `deenapp-backup` | private | full mirror (master + gh-pages) + `content-pack/content.zip`. Re-run `scripts/backup-and-upload.sh` after each pass |
  | `deenlink-api` | private | the user's PHP + MySQL backend. Upload there; never into `deenapp` |
- `pages-cap-test` is a leftover empty private repo from a Pages-capability
  probe — delete it manually (the PAT has no `delete_repo` scope).
- **GitHub push token: NOT stored in this repo.** This file is committed to a
  PUBLIC repo, so any token pasted here is exposed (a previous one was — it is
  now revoked). Keep it out of git entirely:
  ```bash
  echo -n 'ghp_yourTokenHere' > .token   # .token is gitignored (see .gitignore)
  chmod 600 .token
  ```
  Required scopes: `repo` (full). `delete_repo` is optional — only needed to
  delete repos. Then read it as `$(cat .token)` or `export DL_TOKEN=$(cat .token)`.

Setup:

```bash
# shallow keeps the workspace under the 128 MB snapshot cap — do NOT unshallow
git clone --depth 1 --single-branch -b master https://github.com/useeman32-design/deenapp.git
cd deenapp
git config user.name "useeman32-design" && git config user.email "useeman32-design@users.noreply.github.com"
npm ci                      # postinstall auto-fetches the content pack (see below)

# for pushing, add the tokened remote locally (never committed):
git remote set-url origin "https://useeman32-design:$(cat .token)@github.com/useeman32-design/deenapp.git"
```

**Content pack (pass 43):** `src/lib/content.ts` hard-requires 147 files under
`assets/content/**` (29 of them `hadith/*.txt.gz`). They are gitignored and
fetched on `npm ci` from `gh-pages:/content/content.zip`, with
`deenapp-backup:/content-pack/content.zip` as fallback. If both 404, the error
prints the `git cat-file blob` recovery recipe — blob
`162e59f35e978a359547642ddd4e0e5ad7756f95` (needs a FULL clone to see it).

## 2. Verify before changing anything (all must pass)

```bash
npx tsc --noEmit                                    # → clean, no output
bash scripts/export-web.sh                          # → dist/
node scripts/pages-server.mjs dist 3996 &            # NOTE: args are <dir> <port> — omitting dist serves a bogus dir '3996' and every probe fails
curl -s -o /dev/null -w "%{http_code}" http://localhost:3996/deenapp/   # → 200
# headless browser (sandbox resets wipe it — rerun these two when probe fails to launch;
# the old ~/.chromium-libs stash was removed to fit the 128 MB workspace budget):
node node_modules/playwright-core/cli.js install chromium-headless-shell
bash scripts/browser-env.sh
LD_LIBRARY_PATH=/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu node scripts/probe35.mjs   # → ALL PASS (16)
# native bundles (both platforms):
CI=1 npx expo export --platform android   # → dist/_expo/static/js/android/entry-*.hbc
CI=1 npx expo export --platform ios       # → dist/_expo/static/js/ios/entry-*.hbc
```

## 3. What to know about the repo

- **Stack**: Expo 57 / RN 0.86 / expo-router (src/app), TypeScript strict, Poppins + Amiri fonts, dark+light themes (ThemeContext, `theme.dash` palette on most screens).
- **Key dirs**: `src/app` (routes; tools live in `src/app/tools/`), `src/components`, `src/lib` (prayer.ts engine, islamicApi.ts — IslamicAPI.com client with the key via `EXPO_PUBLIC_ISLAMIC_API_KEY` + literal fallback, storage.ts, svgExport.ts, ruqyahAudio.ts, speech.ts), `public/` (prophets chapters, adhan mp3s, translations), `scripts/` (export-web.sh, pages-server.mjs, probe35.mjs, browser-env.sh), `assets/`.
- **Storage keys** are `dl.*` (groups, deenpoints, qibla design, checkin, location, donations, prophets reading progress…).
- **The web app lives on gh-pages**; the same code runs in Expo Go on Android/iOS (scan from the deployed QR or run `npx expo start`). Native parity is the HIGHEST priority: every feature must work in-app on the phone, not just in the browser preview.
- **Native module status** (audited 2026-09-02, expo-speech added pass 40): everything ships in Expo Go on BOTH platforms except `expo-speech-recognition` (real mic dictation is dev-build/APK/IPA only; Expo Go falls back to typed input by design — the lazy probe in `src/lib/speech.ts` must never become a top-level import or it crashes Expo Go).
- **Audio is globally exclusive** (`src/lib/audioBus.ts`): ruqyah, adhan and every useAudio instance register stoppers — starting one stops the rest. Keep new players registered.
- **@DeenLink mention in comments** triggers an in-thread AI reply (CommentsModal.answerAsDeenLinkAI) — keyed streamLLM with retrieveLocal grounding, composeLocalAnswer fallback.

## 4. Standing rules (from the user — do not drop)

1. Native app parity is the highest priority; no Expo Go crashes; loaders everywhere.
2. Prayer times always AM/PM (12h), never 24h. Real IslamicAPI data wherever the key applies.
3. Share = native share sheet; save-as-image only when the photo permission is already granted.
4. Shared in-app content = generated SVG/canvas art (small files, shuffling designs) with deep links — never big image files.
5. Tasbeeh: never remove the misbaha beads (only photo backgrounds were removed).
6. DeenPoints: ₦1.5/pt, icon everywhere, never buys fatwas; profile icon opens the buy modal; gift-box-opening animation only on check-in.
7. Donations: the "Support DeenLink" card STAYS on the menu (user-ordered pass 40; only the inner donation-purpose selector was removed). Zakat → Sadaqah follow it, % fee shown on receipts, history screen must guard unknown old categories.
8. Groups are owner-managed (roles owner/admin/member, rank badges, group-first post cards mixed into home AND community feeds, gallery uploads for pic/cover).
9. Qibla: satellite map downloaded once then always shown from storage (no offline fallback card), 6 compass designs in a modal, persisted.
10. Mirath: engine was rewritten + verified pass 40 (spouse ½/¼ and ¼/⅛, father residuary, umariyyatan, radd); impossible mixes are blocked AT SELECTION (husband↔wife, son/father exclude siblings), fields start empty, shares bold, report image + An-Nisa 4:11/4:12/4:176 modal. Verify any change against the 14 test cases logged in CONTINUE.md.
11. Workspace cap ~128 MB — `node_modules`, `dist` etc. are excluded from snapshots; sandbox resets wipe them (rerun `npm ci` + playwright install + browser-env.sh).
12. Workspace snapshot cap is 128 MB / 10k files (node_modules/dist/.cache excluded; `.git` counts). Keep the eligible set under ~100 MB, clean /tmp clones after deploying, and PUSH after every green gate — files over budget are silently dropped, which historically rolled the local repo back. The repo is a shallow clone on purpose; if `.git` creeps past ~40 MB: `git fetch --depth 1 origin master && git reflog expire --expire=now --all && git gc --prune=now`. Recovery from any rollback: re-add the tokened remote → `git fetch --depth 1 origin master` → `git reset --hard origin/master`.

## 5. Deploy (after probe35 ALL PASS + both platform exports OK)

```bash
# master
git add -A && git commit -m "pass N: <summary>" && git push origin master

# gh-pages (web build) — token read from gitignored .token, never inlined
TOK=$(cat /path/to/deenapp/.token)
cd /tmp && rm -rf gh-pages-tmp
git clone --depth 1 -b gh-pages "https://useeman32-design:$TOK@github.com/useeman32-design/deenapp.git" gh-pages-tmp
cd gh-pages-tmp
git config user.name "useeman32-design" && git config user.email "useeman32-design@users.noreply.github.com"
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r /path/to/deenapp/dist/. .
git add -A && git commit -m "pass N deploy" && git push origin gh-pages
# verify:
curl -s -o /dev/null -w "%{http_code}" https://useeman32-design.github.io/deenapp/   # → 200 (after ~1 min)
```

## 6. Current state (as of 2026-09-02, pass 40 shipped)

- master `9fa7bd0` (pass-40 code `11bce73`), gh-pages `3dcbae8`, probe35 ALL PASS (donations check updated: Support DeenLink card is expected again), iOS + Android `.hbc` exports verified, live site entry bundle 200.
- All 24 items of the pass-40 list shipped and verified: quiz share redesign (5 palette backgrounds, loader, friend picker, save photo, back), adhan modal with praying.png, month table (balanced + swipable + logo/QR export, no "A4"), compass needle designs + watermark chip, calendar occasion modals + data-source note, unified BackButton, tasbeeh (bead path re-fitted, compact settings, mood removed), 99 Names (dropdown, square share, TTS fallback), share-card QR/logo collision fix, mirath engine rewrite + report + verses, zakat (no islamic-api label, metal indicator, metals under trade goods, loader + scroll), donations (Support DeenLink back, history guard, gradient receipt), AI bubble color + slower streaming, suggested groups + card spacing, post image/video previews, create-group photo pickers, crescent loaders, ruqyah exclusive playback + program player + friends share, learning topics (8 real lessons), riddles/jokes share, home date pill, SunPath wrap + location-name fix, @DeenLink AI comment replies. Full details: `CONTINUE.md` pass-40 section.
- Raw intermediates (praying-raw, misbaha-round-raw, misbaha-circle) were deleted; `assets/img/praying.png` ships. `.chromium-libs` was removed post-verify (rerun browser-env.sh when probing again).

When I give you the next change request, start from there.

---
### Pass 52 checkpoint (latest)
- Batch 1 SHIPPED to gh-pages `34a785f`, deenlink-api `f5b7fa5`, deenapp master `8327b53`. See `CONTINUE.md` for the itemised list.
- Batch 2 PENDING: zikr-challenge rebuild (the REAL daily dhikr — `tools/athkar` is to be removed), chat presence/last-seen/read receipts (backend `api/chat/` does not exist yet), Groq key read from DB.
- **Verify pass-51 files survived the workspace before committing** (`bootOk` in `_layout.tsx`, `CrashBoundary.tsx`, `Font.loadAsync` in `fonts.ts`). A rollback already pushed one regression.
- gh-pages deploys must preserve `.nojekyll`; verify an `_expo/` asset returns 200 after every push.

---
### Pass 56–62 checkpoint (latest) — the CHAT module
One chat interface only: **`src/components/CommunityInbox.tsx`** (`src/app/tools/chat.tsx` was deleted in
pass 60 — it had zero inbound links, which is why pass 57 was invisible). Reached from `community.tsx`,
`tools/inbox.tsx` and `videos.tsx`.

- **Mode:** `const live = isLive() && !!user && !isDemo` — real API on `app.deenlink.org`, bundled
  `SEED`/`MOCK_ACCOUNTS` demo threads on gh-pages. Same codebase, two modes (Correction 32).
- **Row ids:** `s<id>` = chat_messages row, `h<id>` = chat_shares row, anything else = demo/optimistic
  (no server target yet). `targetOf()` maps them back for reactions.
- **Backend:** `api/chat/` (10 files) in `deenlink-api`. `chat_schema()` in `common.php` self-creates every
  chat table on first request — **SQL migrations live inside the PHP** (Correction 28), no phpMyAdmin step.
  Tables: `chat_conversations`, `chat_participants`, `chat_messages`, `chat_presence`,
  `chat_shares`, `chat_reactions`.
- **Endpoints:** `conversations.php` · `messages.php` (returns `messages` + `shares` + `reactions`) ·
  `send.php` · `send_share.php` · `react.php` · `read.php` · `presence.php` · `start.php` (by user id) ·
  `start_username.php` (by username, pass 60) — all gated on `chat_member()`; `chat_target_exists()` stops
  reacting to rows from another conversation.
- **Reactions:** `thread.reactions` = MY emoji, `thread.others` = theirs. Empty emoji = remove.
  `PopEmoji` (pass 61) animates on mount with its OWN Animated.Value — do not go back to a shared `pop`.
- **Harness:** the whole PHP/MariaDB test rig lives in `/tmp` and is wiped every turn. Recipe is in
  `CONTINUE.md` → "pass 56 backend test harness". `deenlink-api` is NOT kept in the workspace (128 MB) —
  clone it fresh: `git clone --depth 1 https://x-access-token:$(cat deenapp/.token)@github.com/useeman32-design/deenlink-api.git`.

**Still open:** Report/Block in the inbox are client-side only (no `api/reports/`, no `user_blocks`).
Pass 72 (Tier 1) + pass 73 (avatar persistence + default art everywhere, multi-send with
search, Android pager control, /profile-refresh 403 fix) shipped — see CONTINUE.md.
Tier 2 shipped (pass 75). Tier 3 shipped (pass 76): server-enforced blocking —
`user_blocks` + `api/users/block_action.php` / `blocks_list.php`, 403 code:'blocked'
on DM send/share/start + follow, search hides both directions, inbox block/report
wired, settings/blocked-accounts screen, unblock reopens DMs as message requests.
Next per the user: admin dashboard audit → iOS/Android store builds.
