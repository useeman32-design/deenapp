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

# ══ 2026-09-11 — PASS 83-36: OWNER BATCH 2 (final social pass) ══ READ FIRST ══
# deenapp master = 4daacef · dlapi main = eb990b3 (api+admin+RAW web root merged) · gh-pages = 4e3484f.
#
# FIXES → WHERE:
#  1. Delete own post not showing on HOME: ownership test compared int vs string ids → now
#     String(id)===String(id) OR username match (home + community + group).
#  2. Tapping YOUR OWN name/avatar on posts (all FeedCards) or your own reel: NO navigation.
#     Inside a group, the group name on a post no longer re-navigates.
#  3. Video posting toggle: admin → Videos Management top card "Allow users to post videos in
#     Community & Groups" (default OFF). Server rejects video uploads in feed/groups create_post
#     (403 with pointer to videos page); composers hide the button. Videos page unaffected; reels
#     still mirror into community. Flip the toggle when ready.
#  4. Currency: get_profile_counts.php returns donations total converted to the PROFILE OWNER's
#     country currency (pay_country_to_currency + FX). Profile tab Charity shows real total with
#     the right symbol (was ₦ + 0). Public profile charity now real via user_summary.php
#     (viewer's currency) — was hard-coded "₦ 12.4k".
#  5. Instant tabs: login()/adoptSession() prefetch feed+groups; index.tsx/Groups.tsx consume the
#     promises on mount.
#  6. Image-post freeze: 60ms paint-yield before compression; web skips canvas re-encode for
#     images ≤1600px (web manipulator runs on the main thread — that was the 2s freeze).
#  7. YouTube inline: native WebView got baseUrl=https://deenlink.org (null origin → YouTube
#     blocked playback). yt-link row opens instantly. Web iframe unchanged (plays inline).
#  8. ffmpeg: api/lib/video_process.php — 720p H.264 CRF26 + img/logo.png watermark bottom-right
#     (55% opacity) applied to EVERY uploaded video (videos page + community + group when
#     re-enabled). SELF-DISABLES if the host has no ffmpeg or exec() is disabled — check with
#     `which ffmpeg` in cPanel terminal; without it videos upload unchanged (never broken).
#  9. Group progress pill moved to screen root — byte-identical to community's.
# JOIN REQUESTS (owner asked how): (a) SITE ADMIN → admin/groups.html "Group Members" → pending
#     list with Approve/Reject (api/admin/groups/list.php + decide.php). (b) GROUP OWNER/ADMIN
#     in-app → group page → members section → request queue (members.php approve/decline).
# ⚠ WORKSPACE IS A SHALLOW CLONE — see 83-35 notes (gh-pages needs explicit depth-1 fetch).
# ═════════════════════════════════════════════════════════════════════════════════════

# ⚠ WORKSPACE IS A SHALLOW CLONE (storage budget): .git was rebuilt with
#   fetch --depth=3 (master only). gh-pages ref is NOT fetched by default —
#   before any gh-pages deploy run: git fetch --depth=1 origin gh-pages
#   (then worktree add as usual). Pushes from shallow work fine (verified).
#   NEVER run `git gc --aggressive` here (it ballooned the pack to 144 MB and
#   died mid-repack). Full history lives on GitHub — re-clone if ever needed.
#   deenlink_db (9).sql was deleted from the workspace (canonical copies are in
#   the dlapi repo). avatar.zip KEPT (avatars restore pack).
# ══ 2026-09-11 — PASS 83-35: OWNER BATCH (videos-page reels, zen, group chips, YT inline, admin join requests) ══ READ FIRST ══
# deenapp master = 93153a0 · dlapi main = 5862cd0 (api + admin + RAW WEB ROOT merged — ONE cPanel pull ships everything) · gh-pages = 53ff722.
# OWNER: ONE dlapi pull in cPanel ships api + admin + the 83-35 web root (boot-tested on the merged tree). Live was 83-33.
# Native rebuild still owed (audio picker '*/*' ships in the JS bundle; iOS Files fix needs the dev build).
#
# WHAT SHIPPED (owner's 15-point batch):
#  1. HOME delete-own-post (FeedCard onDelete → api.deletePost; community already had it).
#  2. In-post fullscreen REMOVED. Expand button pauses + opens /videos?start=<post id> (reels view).
#  3. Videos page pinch-IN = zen: video + back button only; scroll to another reel or pinch OUT restores.
#  4. Group videos in reels carry a group chip (name) → tapping opens the group page.
#  5. Reels posted on the videos page are MIRRORED server-side into the community feed
#     (videos/upload.php → hardlink/copy into uploads/posts/YYYY/MM + posts/post_media; best-effort).
#  6. Videos search now matches caption + @user + display name + scholar fields + group name.
#  7. Videos STOP at end (loop=false everywhere; replay seeks 0) and pause on tab/push navigation
#     (videos.tsx screenFocused gate + FeedCard useFocusEffect pause).
#  8. Optimistic rows are TEXT-ONLY in community AND group — no media until the post lands.
#  9. Group composer pill = EXACT community pill (insets.top+54, "Posting… N%", 6px #1F8F5C).
# 10. Videos-page upload pill renamed "Posting… N%" (same style).
# 11. Audio picker → '*/*' on Android AND iOS (validateAudio still guards; iOS needs dev rebuild to verify).
# 12. COMPRESSION ANSWER: images ARE compressed (client: ≤1600px JPEG q0.78 via expo-image-manipulator;
#     server: GD re-encode 1080/360). VIDEOS are NOT compressed/transcoded (shared hosting has no ffmpeg);
#     caps: 250 MB reels, 50 MB community/group video. The new reel mirror is a HARDLINK (zero extra storage).
# 13. Group YouTube-only posts: root cause = $multipart decided by !empty($_FILES) → a YT-only multipart
#     body fell into the JSON branch → empty fields → "Post text required". Now detected by CONTENT TYPE.
# 14. Admin join requests: api/admin/groups/list.php + decide.php + admin/groups.html (owner UI clone);
#     "Group Members" sidebar link added to ALL admin pages.
# 15. YouTube plays INLINE (modal gone); yt_url rows link out directly. Daily-videos library keeps its modal.
#
# CLIENT RECOVERY: client.ts had LOST exports to a rollback (groupJoinRich/groupJoinRequests/
# groupJoinDecide/activeAnnouncement/AnnouncementItem/groupMembers denial) — restored by contract
# from the server endpoints; tsc is 0 across the app.
# VIDEO REELS DATA: server community/group video posts now feed the reels list (reel id = post id,
# deduped against library uploads by file basename). Local-only commReels still ride along.
# DEPLOY: RAW root artifact ONLY via bash scripts/export-raw.sh (slashguard now honors BASE='' —
#   it silently GH-prefixed the root build once this pass; CHECK-RAW caught it) + check-raw.mjs + boot test.
#   gh-pages via scripts/export-web.sh (now injects the PWA manifest link + rewrites manifest paths).
#   dist/ holds whichever flavor was built LAST — always rebuild before copying.
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-34: GROUP POSTING + VIDEOS (owner scope lock) ══ READ FIRST ══
# deenapp master = a6b015b · dlapi main = 0caae0f (backend hardening 7979d2d + raw web export) · gh-pages = 5efdebd.
# OWNER: PULL dlapi in cPanel (API + web root both updated). Native app: rebuild needed for UTI fix.
# DIAGNOSES → FIXES:
#  1. "Group post says failed, appears after refresh" — TWO stacked causes:
#     (a) server: a PHP warning ahead of the JSON breaks JSON.parse → client saw failure while the
#         post COMMITTED (tx commits before json_out). display_errors now off + json_out wipes
#         buffered output (groups+feed create_post.php).
#     (b) client: on mobile the upload can complete server-side while the RESPONSE is lost
#         (screen lock, network switch) → XHR error → false failure. New verify-after-failure:
#         refetch the group feed; newest row matching our text/media ⇒ SUCCESS (reconcile+refresh).
#         parseLooseJson salvages polluted bodies. Server-SAID errors (rate limit/membership) stay real failures.
#  2. iOS audio greyed in Files: '*/*' is not a UTI → ['public.audio','public.data'] (NEEDS DEV REBUILD).
#  3. "loading video" on fullscreen open: web = <video> REMOUNTED (inline unmounted into modal) —
#     now the SAME element flips to position:fixed (zero reload). Native keeps the modal swap
#     (re-attach is instant there) — VideoLoader now needs 700ms PERSISTENT loading + real play
#     intent before showing, so attach blips never read as stuck.
#  4. "loading" after video ends / on videos-page return: loop-restart + VideoView remount per
#     swipe — reels keep their VideoView mounted once active (everActive); loader gate covers restarts.
#  5. Seek bars unified (renderBar) — inline/web-fullscreen/native-modal share one implementation.
# BUILD NOTE: '*/*'-style sequences inside block comments TERMINATE the comment (broke the build
#   twice this pass — group.tsx + FeedCard). Never write star-slash inside /* */ comments.
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — INCIDENT 83-33b: ROOT SHIPPED GH-FLAVOR (3rd occurrence) — FIXED + GUARDED ══ READ FIRST ══
# BLANK SCREEN ROOT CAUSE (owner-reported): 1f311b1 copied dist/ to the cPanel root AFTER
#   export-web.sh had rebuilt dist as the GH flavor → root index.html referenced
#   /deenapp/_expo/… → white screen. FORENSICS: e99ac46 (the "83-32 raw" push) was ALSO the GH
#   flavor — since that pull the root actually ran the OLD 83-31 bundle via the /deenapp/ SPA
#   fallback (masked, not broken). Admin/ + api/ pushes were never affected.
# FIX (OWNER: PULL AGAIN — final head ae2e0a6): root = genuine RAW flavor (fresh export-raw.sh),
#   poisoned chunks purged (incl. stale entry-07a8d97e + the 1f311b1 additions), 404.html = raw
#   index. Verified: check-raw gate 0 /deenapp/ refs on the MERGED tree + puppeteer boot 0 errors
#   / 0 failed requests. Live stays blank until the owner pulls.
# ══ IRON RULES (made structural — repeat = inexcusable) ══
#  1. dist/ for the ROOT may only be produced by:  bash scripts/export-raw.sh
#     (export + BASE='' slashguard + scripts/check-raw.mjs gate, fails hard on ANY /deenapp/ ref,
#     missing entry, or missing manifest). Copy to root IMMEDIATELY after — nothing in between.
#  2. gh-pages flavor: bash scripts/export-web.sh — and push gh-pages IMMEDIATELY after.
#     After a GH build, dist/ is POISON for the root until export-raw.sh runs again.
#  3. After ANY root copy: node scripts/check-raw.mjs <root-dir>  (NO pipe — pipes swallow the
#     exit code; that bit me during the hotfix) + boot-test the MERGED tree (not a side copy):
#     serve the repo dir, run pptr boot.js against it.
#  4. /deenapp/ SUBDIR at the root = intentional legacy-flavor home for incident-window cached
#     pages — check-raw skips it; NEVER delete it casually (cached 83-31/83-32 windows still use it).
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-33: ADMIN DASHBOARD REBUILT ON OWNER UI (SHIPPED) ══ READ FIRST ══
# deenlink-api main = 1f311b1 — OWNER: PULL IN cPanel (admin APIs rebuilt + this raw web export incl. the app announcements modal). gh-pages=d284552, deenapp master=65cf355. Boot-tested 0/0.
# WHAT OWNER COMPLAINED → WHAT WAS DONE:
#  · "two headers glitching" = my pass-80/83-30 shell (shell2.js) DELETED his sidebar and injected
#    its own chrome → header duplication. FIXED: chrome files DELETED (assets/nav.js, shell*.js/css),
#    every original page restored BYTE-EXACT from admin.zip (the owner's real UI, real logo).
#  · "not using real deenlink logo" = chrome drew an SVG mark; his pages use ../img/logo.png ✓ restored.
#  · "admin name/title not showing" = new assets/dl-identity.js fills his OWN sidebar profile tag
#    (name, email, gold rank badge Super Admin/Content Manager/Moderator/…) via auth/me.php.
#    NOT a shell — pure enhancement, injected on every page before report-bell.js.
#  · "new modules display errors, not working" = ROOT CAUSE: events/learning/defaults endpoints were
#    FATAL pre-auth (bare require_admin() call + phantom $pdo — stale helper contract; 500 with
#    empty body, even the 401 never printed). All 8 rewritten on the campaigns pattern
#    (declare + method guard + db_conn + require_admin($pdo) + try/catch). Gate: _check_calls OK.
#  · "roles & permissions page is bad" = my chrome did this; original roles.html RESTORED (works:
#    roles/get.php + save.php + CSRF all live-verified shapes).
#  · 9 module pages (campaigns, events, learning, athkar, names, prophets, defaults, chat, push)
#    REBUILT from HIS announcement.html template: same sidebar/header/cards/modals/status badges/
#    round edit-delete buttons; stats row + search + add/edit/delete wired to real APIs.
#    Render-tested with puppeteer + mocked APIs: 17/17 pages PASS (1 sidebar, 0 chrome, name+rank,
#    logo loads, 0 JS errors). Screenshots: /home/user/admin-campaigns.png, admin-dashboard.png.
#  · CSRF: require_post_with_csrf() added to all 15 admin POST endpoints missing it.
#  · api/admin/auth/commonn.php orphan (bare require_admin() inside an include!) deleted.
#  · img/deenPoints.png restored (user-management referenced it, was missing).
#  · ANNOUNCEMENTS → APP: api/announcements/active.php was ALREADY complete (targeting by country/
#    user-type, schedule, media, dismiss_key, 30s cache) but the APP never called it — client.ts
#    announcement() reads wrong keys → always null. NEXT: home modal on index.tsx w/ media+CTA +
#    storage dismissal by dismiss_key (backend needs NO changes).
# ADS (answered to owner): AdMob = NATIVE apps only (Android+iOS; Expo dev build OK via
#    react-native-google-mobile-ads, test unit IDs in dev). AdMob must NOT go in the PWA/web.
#    AdSense = web + installed PWA (app.deenlink.org). Running both simultaneously is allowed
#    (separate products/accounts). Do NOT wrap the PWA in a TWA with AdSense (Play policy).
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-32: posting reliability + share overhaul + PWA/quiz/videos (SHIPPED) ══ READ FIRST ══
# deenlink-api main = 57dd492 (df3f091 83-32a + 57dd492 83-32b) — OWNER PULLED df3f091 already
#   (live verified: create_post.php/posts.php/send_test_expo.php all return clean JSON, no fatals).
#   ⚠️ OWNER: pull AGAIN in cPanel for 57dd492 (test push → dual channel web-push+Expo).
# deenapp master = 03b390b · gh-pages = 566342a (both pushed; Pages redeploys automatically).
# RAW export for cPanel web root: dist/ (built+slashguard'd with BASE='' — root-safe since the
#   slashguard BASE-empty guard; boot-tested 0 errors). GH flavor: scripts/export-web.sh + slashguard
#   (default /deenapp), boot-tested 0 errors.
# WHAT SHIPPED (owner's 14 items):
#   1. Group posting: backend root cause (lost gp_* helpers) fixed in df3f091 + LIVE; client
#      group.tsx draft snapshot/restore + explicit "Unable to post" + loader stop.
#   2/7. Composer (community) same treatment: optimistic post rolls back on failure + Alert.
#   3/4. PWA: manifest.json + icons (public/), manifest link+theme-color injected by slashguard;
#      iOS A2HS sheet now waits 6.5s; test-push button asks permission + subscribes web-push ON
#      THE TAP (user gesture) — server send_test_expo.php fans out via push_notification (both channels).
#   5. Repost removed everywhere (FeedCard chip + share sheet); share sheet = classic "Share as post"
#      + Copy link (clipboard URL, no JSON file).
#   6/8. Share-as-image: feather-style stroke icons, verified badge only for green/gold/blue.
#   9. Courses: EVERY quiz (13 sets incl. default fallback) now 10 questions.
#   10. Videos page: REEL_COMMENTS dummy seeds removed; CommentsModal has live-video mode
#       (videoId) + composer hidden on demo content (no more demo-account comments).
#   11. Profile: posts loader runs on every focus (10s throttle) — image/video posts appear instantly.
#   12. Deleted post viewer: "This post was deleted or is no longer available."
#   13. Videos processing-block + fullscreen perf: fullscreen single-render pass (83-31) + seek
#       throttle shipped earlier; processing gate needs server is_processed flag surfaced (NEXT).
# QUIZ DATA NOTE: courses.tsx QUIZZES patched programmatically — lesson bodies untouched (68 body:).
# ═════════════════════════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — HOTFIX 83-31c: cPanel white-screen REAL root cause (WRONG BUILD FLAVOR) ══ READ FIRST ══
# deenlink-api main = 41b9bb0 (owner: pull AGAIN in cPanel) · deenapp master = dist-root(raw) + docs
# ROOT CAUSE (reproduced in headless Chrome): the 83-31 deploy copied the GH-PAGES-flavored export
# (slashguard BASE=/deenapp → every asset URL prefixed /deenapp/) into the app.deenlink.org ROOT.
# Those paths don't exist there → the SPA fallback served index.html for each .js request (200!) →
# "Unexpected token '<'" → white screen for everyone (fresh AND cached). The earlier prune theory
# (83-31b) was only a secondary hazard — the flavor was the killer.
# FIX (41b9bb0): ROOT = RAW export (entry-f6de6092, src="/_expo/..."); the broken flavor moved under
# /deenapp/ (incident-window cached pages keep booting); sw.js+favicon exist at BOTH scopes; 83-30
# chunks (entry-431a29ee) still present for cached 83-30 index.html.
# ⚠️ STANDING RULES (both in force):
#   1. app.deenlink.org (dlapi root) gets the RAW export — NEVER slashguard'd.
#      gh-pages gets the /deenapp slashguard flavor. dist-root in this repo = RAW snapshot.
#   2. Serving roots MERGE on deploy — never delete existing chunks (cached index.html safety).
#   3. BOOT-TEST before shipping web: puppeteer (workspace pptr/boot.js) against the merged layout —
#      rootHtmlLen must be big + zero PAGEERROR. Status codes alone CANNOT catch this (200-HTML fallback).
# ═════════════════════════════════════════════════════════════════════════════════════
# ══ 2026-09-11 — HOTFIX 83-31b: cPanel blank-white-screen after pull (MY deploy bug) ══ READ FIRST ══
# deenlink-api main = fd970a5 (owner: pull AGAIN in cPanel) · deenapp master = docs update
# ROOT CAUSE: the 83-31 web mirror PRUNED everything not in the fresh export — it deleted .htaccess,
# share.php, branding/logo.png, docs/zips/sql AND the previous hashed bundles (entry-431a29ee).
# Every returning browser held a cached index.html → requested the deleted old entry → 404 →
# blank white screen. Server itself was healthy (index/entry/APIs all 200).
# FIX: restored all 17 missing paths from bba164f (git ls-tree diff → checkout) + pushed fd970a5.
# ⚠️ STANDING RULE — deploys MERGE, never prune:
#   - copy new dist over the web root / gh-pages;
#   - NEVER delete existing files that aren't in the new export (old hashed chunks MUST stay so
#     cached index.html keeps working; each deploy costs ~5-8MB of old chunks — purge manually
#     every few months if needed);
#   - the earlier "python3 mirror-prune" recipe in these docs is WRONG for dlapi web root and
#     gh-pages — superseded by this rule.
# ═════════════════════════════════════════════════════════════════════════════════════
# ══ 2026-09-11 — PASS 83-31 SHIPPED (reposts, share-sheet rework, in-app fullscreen, like-state truth, group-post fix) ══ READ FIRST ══
# deenapp master = 47ebae3 (client) · gh-pages = 3b85505 (entry-29086947, LIVE-verified 200 + sw.js 200)
# deenlink-api main = 559bd6f (backend bba164f + web root entry-29086947) — ⚠️ CPANEL PULL PENDING (owner)
# WHAT CHANGED (owner's 18-item pass; all 6 PHP files lint clean, tsc 0 errors):
#  1. GROUP POSTING FIXED (server): api/groups/create_post.php had LOST its youtube parsing block →
#     $youtubeInput undefined → null !== '' always true → EVERY group post 400'd "Please enter a valid
#     YouTube link". Block restored + youtube_id_from_url() helper mirrored (AFTER declare(strict_types=1)).
#  2. REPOSTS (replaces "share as post" for feed posts): posts.repost_of BIGINT NULL auto-healed;
#     feed/create_post.php accepts repost_of (multipart/JSON, validates original, caption-only);
#     get_posts.php + get_user_posts.php flag post_repost_of (schema-flags cache STILL v2 — v3 bump NOT
#     needed, cache is per-filename + new key rides existing file... NOTE: 6h memo → new flag appears
#     within 6h of deploy or touch storage/cache/feed_schema_flags_v2.json), SELECT repost_of, and embed
#     `repost: {id, content_text, youtube_url/embed, created_at, time_ago, gone, image_url, like_count,
#     comment_count, user{name,username,profile_image_url,user_type}}` via batched IN() queries (post_likes
#     + post_comments is_deleted=0). Client: ContentShareSheet Repost row (server createPost(repostOf),
     offline fallback addUserPost); FeedCard renders REPOSTED tag + framed ORIGINAL box (author photo,
#     name, @username, badge, content, first photo, video row, counts) + gone-state.
#  3. SHARE-AS-IMAGE REWORK: sheet no longer GROWS — "Share as image" swaps the whole sheet to the
#     preview with Share / Save / Cancel. Post image = faithful post-card replica (avatar, name,
#     @username+badge, content, photo, like+comment counts) + DeenLink logo strip + QR (post link).
#     Web: generatePostShareCard() canvas in lib/shareCard.ts. Native: components/PostShareCardSvg.tsx
#     (1080×1280 fixed canvas, rasterized via svgRefToPng {width:1080,height:1280}).
#  4. VIDEO FULLSCREEN: ONE path on every platform — the opaque in-app Modal with custom controls
#     (browser requestFullscreen/webkitEnterFullscreen AND expo enterFullscreen REMOVED; owner: never
#     the browser native player). Inline VideoView stays mounted; modal binds the SAME player → no reload.
#     Double-container: FeedCard media for image blocks now filters media_type==='image' only (video in
#     media[] used to paint a second block).
#  5. GROUP FEED "could not load": loadServerPosts retries once silently (900ms), rejections now land in
#     the same handler (skeleton no longer breathes forever), posts call gets timeout 45000 (new
#     per-request opts.timeout in client request()).
#  6. LIKE STATE TRUTH: profile/[username].tsx seeds likedPosts from server liked_by_me (get_user_posts
#     returns it, line 301→398) + new shared src/lib/likeStore.ts overrides; count adjusts by DELTA vs
#     server state (no double counting). Community feed seeds the same way; toggles write likeStoreSet.
#  7. POSTS SLOW TO REFLECT: community feed paints from dl.feed.cache.v1 (storage) instantly, silently
#     refetches on tab focus (15s throttle). Profile breathing skeleton ALREADY existed (BreathingContent,
#     shows while profile fetch pending) — verified, left as is.
#  8. DEMO COMMENTS REMOVED ENTIRELY: community.tsx CommentsModal seed={[]} + MOCK_COMMENTS import gone.
#  9. ZAKAT CTA: charity.tsx "Calculate my zakat" → router.push('/tools/zakat') (main calculator).
# 10. CURRENCY: zakat.tsx quotes NGN→viewer currency via NEW fxQuoteFor('NGN') (server fx_quote.php now
#     accepts ?base=NGN — direct rate, else via-USD, honest 0/unavailable) and formats all amounts in the
#     viewer's Flutterwave currency (NGN fallback when no rate). Courses: client courses() MERGES server
#     list + bundled MOCK_COURSES (server-only replace made owner see 1; server filter is
#     status=published AND visibility=public + audience-match — data-side cause documented).
# 11. CHAT SCROLL RESTORE: CommunityInbox tracks per-thread scrollTop (onThreadScroll) and RESTORES it
#     after load when returning mid-thread (was: unconditional scrollToEnd → jump to top).
# 12. iOS PWA PROMPT: components/IosPwaPrompt.tsx (mounted in _layout) — iPhone/iPad Safari, not
#     standalone → dismissable "Add to Home Screen" sheet (30-day persistence via storage).
# 13. TEST BUTTONS: notifications screen "Send test notification" (client sendTestPush() →
#     api/notifications/send_test_expo.php; web local Notification preview). Prayer page "Test adhan
#     notification" (lib/adhanNotify.ts scheduleAdhanTest(5s) — real local notification on the adhan
#     channel; lock screen/call shows draw-over with the dev build).
# 14. DRAW-OVER COMPLETE (dev builds): plugins/withAdhanFullScreen.js config plugin (app.json) patches
#     AndroidXNotificationsChannelManager.java at prebuild → 'adhan' channel gets setFullScreenIntent
#     (launch intent), + ensures USE_FULL_SCREEN_INTENT in the manifest. Requires a NEW DEV BUILD.
# 15. SEARCH TOP TAB: matched group (name/category) renders as "Top group" row between accounts and post.
# 16. WATERMARK QUALITY: videos/download.php re-encode crf 23→20, veryfast→medium (posted-video mushiness
#     on downloads). Playback is the raw upload (no client compression exists).
# NEXT UP: owner cPanel pull for dlapi (backend fixes go LIVE then: group posting + reposts + fx base),
#  new Android dev build for draw-over + adhan tests, admin-subdomain advice delivered (see reply).

# ══ 2026-09-11 — PASS 83-30 SHIPPED (donations currency, hijri, streaks, adhan lock-screen, admin SPA v2) ══ READ FIRST ══
# deenapp master = f7e668c (client) · gh-pages = 4bce7bc (entry-431a29ee, LIVE-verified 200 + sw.js 200)
# deenlink-api main = 062073d (admin shell v2 + web root entry-431a29ee) — ⚠️ CPANEL PULL PENDING (owner)
# WHAT CHANGED:
#  1. DONATIONS: "Support DeenLink" no longer shows the recipient picker (was "Choose at least one
#     recipient"); replaced with a short what-your-donation-funds note. ONE shared searchable currency
#     picker (components/CurrencyPicker.tsx) on ALL 3 donation screens: USD/NGN/EUR/GBP pinned on top,
#     full Flutterwave-chargeable list below (SAR/AED REMOVED — payout-only, checkout rejects them).
#  2. HIJRI CALENDAR: the long "About these dates" description card at the bottom — removed (owner).
#  3. STREAKS: the home "Quran Streak" card is now tappable → opens the Qur'an screen.
#  4. ADHAN WHEN APP IS CLOSED (native): lib/adhanNotify.ts schedules LOCAL notifications (next 72h,
#     exact date triggers) on a MAX-importance "Adhan" channel from the same settings/engine as the
#     prayer screen; rebuilt on every app start + whenever adhan settings change. Phone in use →
#     heads-up notification; screen off → sound/vibration (full draw-over needs the dev-build channel
#     tweak — USE_FULL_SCREEN_INTENT + SCHEDULE_EXACT_ALARM + VIBRATE + WAKE_LOCK + POST_NOTIFICATIONS
#     already added to app.json). Tapping the notification opens the prayer screen WITH the adhan modal
#     up (?ring=Param), and the modal has a "Turn off adhan alerts" action (disables + cancels schedule).
#     ⚠️ Requires a DEV BUILD (Expo Go can't do exact alarms/full-screen reliably).
#  5. BROWSER NOTIFICATIONS: public/sw.js (push + notificationclick) + lib/push.ts web branch — VAPID
#     key from api/notifications/web_push_public_key.php, subscribe on user gesture, saved via
#     web_push_subscribe.php. Server push_notification() already fans out to BOTH web-push and Expo
#     tokens on every event notification (nothing to change server-side).
#  6. ADMIN SPA v2 (deenlink-api /admin): ONE chrome + ONE design for ALL modules — admin/assets/
#     shell2.css + shell2.js (grouped sidebar + search, glass topbar, light/dark, toasts, PA pjax
#     router: fetch → swap .main-content/.dl-main, adopt <style>+scripts, DOMContentLoaded replay,
#     fallback to full load on any error). nav.js + shell.js are now thin bootstraps → all 31 admin
#     pages get the new UI with zero page edits. Menu now includes Videos + Courses + Wallpapers.
#     index2/settingss/video-management_1/verification.html.bak left out of the menu (duplicates).
#     All 409 api PHP files lint clean; wallpapers admin page wired (api/admin/wallpapers/*).
#     KNOWN GAP: hadith-management.html is a static placeholder — no hadith admin API exists (app
#     hadith content ships via content packs); build a hadith CMS next pass if wanted.
#  7. Reward-ads (Google AdMob) setup guide → REWARDED-ADS-SETUP.md in the repo root.
# tsc exit 0 · node --check ok.
# ══════════════════════════════════════════════════════════════════

# ══ 2026-09-11 — PASS 83-29 SHIPPED (owner "Fix these I will test it together", 12 items) ══ READ FIRST ══
# deenapp master = da5536b (client) · gh-pages = a16dded (entry-20ea9c0a, LIVE-verified 200 + content.zip 200/17.2MB)
# deenlink-api main = 44e5916 (backend + web root entry-6400e40c) — ⚠️ CPANEL PULL PENDING (owner)
# WHAT CHANGED (item → fix):
#  1. INBOX CARDS "shared 0 with you": conversations.php now also emits last_sender (+ last_body already
#     there); CommunityInbox threads carry last {text, mine} → preview shows the real last message,
#     "You: " prefix when it was mine; share-fallback only when no message ever.
#  2. PRAYER MOON ROLLBACK: SunPath parks the marker at arc END after Isha+45m until next-day Fajr —
#     never moves backward; waits at next prayer (only-forward preserved).
#  3. TASBEEH: 99 beads (radius 0.0195 when >66) + attached head assembly (ring bead + stub + gold
#     collar + imam ellipse + 5-strand fan tassel) + settings sheet maxHeight 78% with ScrollView(430).
#  4. ZIKR CHALLENGE: athkar.ts REWRITTEN — 18 entries with COMPLETE duas (full declarations, full
#     Ayat al-Kursi, 3-part Raditu, full Ibrahim salawat) + new a17 Hasbiyallahu x7, a18 Bismika
#     Allahumma + `meaning` on every entry (modal shows it); section emoji → FA5 icons (sun/moon/mosque/ring).
#  5. FATWA: Ask a Scholar removed (source entry, JSX branch, all ask states + sendQuestion, ASK_CATEGORIES,
#     unused imports). Direct Fatwas + IslamQA untouched.
#  6. QURAN SCREEN: Shazam card + ReciteSearchModal + heard-effect + bottom Seerah/Courses/Quiz row removed.
#  7. COURSES: catalog grown 7 → 20; TEN professional slugs with real curricula (4-5 lessons each, lecture/
#     reading) + 5-question quizzes each: hadith-sciences, ulum-quran, arabic-grammar, halal-finance,
#     muslim-family, dawah-skills, prophetic-productivity, public-speaking, teaching-islam, study-research.
#     lessonsFor/quizFor 'default' fallbacks still cover the other 10.
#  8. NATIVE VOICE (no code): lib/speech.ts already uses expo-speech-recognition (package ^57 + app.json
#     plugin). Answer: needs a DEV BUILD (npx expo run:android / eas build --profile dev) — Expo Go can't
#     load native modules. Until a dev build is installed, native falls back to web-style input.
#  9. PRIVACY — ALLOW GROUP ADDING: settings sheet toggle (priv.groupAdd → dl.priv + setAllowGroupAdd →
#     NEW api/users/group_privacy.php, self-heals users.allow_group_add TINYINT DEFAULT 1);
#     members.php action=add returns 403 {code:'no_group_add', username, full_name} (fails OPEN if the
#     column is missing); group.tsx accumulates denials → "Cannot add @u Full Name" /
#     "Cannot add @a, @b and @c" + grey "Can't add" row state. NOTE: dl.priv alone was device-local —
#     the server column is what binds OTHER admins' clients.
# 10. INBOX/DM STATUS BAR: CommunityInbox header + ⋮ dropdown now ALWAYS pad insets.top+8 (modal
#     variants on native sat flush under the status bar).
# 11. FAKE CHARITY ₦12.4k: removed. New client.userDonationSummary() → api/donations/user_summary.php
#     (public, per-user, viewer currency) → profile Charity stat shows the real total once loaded, 0 while
#     loading/offline. NOTE: get_profile_counts.php does NOT return donations (profileCounts().donations
#     is always 0) — user_summary.php is the live source.
# tsc exit 0 · node --check on both bundles ok.
# ══════════════════════════════════════════════════════════════════

# ══ 2026-09-10 — PASS 83-28 SHIPPED (owner bug-report pass, 20 items) ══ READ FIRST ══
# deenapp master = 7c7f6d4 (client) · gh-pages = 182aec7 (entry-df6b6e97, LIVE-verified 200 + content.zip intact)
# deenlink-api main = da558b1 (backend fixes + web root entry-c2139646) — ⚠️ CPANEL PULL PENDING (owner)
# ROOT CAUSES FIXED (highlights):
#  - WEB PHOTO-POST CRASH: createPost dynamic-imported expo-image-manipulator (not in web bundle;
#    Metro reportFatalError fired before try/catch). Web now compresses via canvas (compressImageWeb).
#  - VIDEO POSTS "EMPTY" from other accounts: feed/create_post stored video basename but file lives
#    under uploads/posts/YYYY/MM/ → URL 404'd into SPA fallback HTML. Stored path now dated; read-time
#    glob heal covers old rows (post 105 heals itself). groups/posts.php SELECT was missing p.user_id
#    + youtube_url → PHP warnings printed INTO the JSON → every group screen froze + posts "failed".
#  - CHATS LEAKING ACROSS ACCOUNTS: inbox cache key dl.inbox.v2 was GLOBAL → dl.inbox.v3.<uid>.
#  - SECURITY QUESTIONS: /me never returned them (change-email said "not set"); email-change verify
#    used password_verify against columns nothing wrote → now sha256(mb_strtolower) scheme (+bcrypt fallback).
#  - NOTIFICATIONS: expire after 30 days (list filter + 32-day purge). Tabs were already gone (83-26).
#  - HADITH ?h= BACK-LOOP: auto-entry re-fired on every back → one-shot ref.
#  - AUDIO PICKER iOS: 'audio/*' hid m4a/aac → public.audio + concrete UTIs.
#  - WATERMARK DIAGNOSTIC: HEAD download.php now returns X-Deenlink-Ffmpeg: 1|0 — curl -I after the
#    cPanel pull; a 0 means the HOST lacks ffmpeg (downloads stream unwatermarked by fallback design).
# ALSO: real share-to-friends on videos page · real account on video uploads · player pauses on
# unmount/blur/background (feed + reels; no more overlapping audio) · real browser fullscreen on web
# video · gallery preview opens at tapped slide · group composer two-row redesign · feed composer
# thumbnails · groups searchable (search tab) · join requests UI · group post errors carry server
# message + retry state · dark profile skeleton re-themed · edit-profile spacing + answer-saved hints.
# NOTE: a tool call once printed the api origin URL INCLUDING the token — consider rotating the token.
# ══════════════════════════════════════════════════════════════════

# ══ 2026-09-10 — CPANEL PULL DONE — 83-25/83-26 LIVE, VERIFIED ══ READ FIRST ══
# Owner pulled deenlink-api on cPanel (now main 9ba1ca8: backend 4dd9133+0965cf9+0d1f265 + web entry-f6ed812c).
# LIVE-VERIFIED via curl on app.deenlink.org (all six markers green):
#   1. / serves entry-f6ed812c6dd26696c1ffa9d59eb14a63.js (83-26 web build)
#   2. /api/videos/download.php HEAD → 400 "Missing video_id" (was 405) — 0d1f265 live
#   3. /img/logo.png → 200, 2535B (exact commit size) — watermark mark live
#   4. /api/notifications/list.php → 401 JSON "Not logged in" — endpoint live
#   5. /api/chat/common.php → 200 empty = correct (require-only bootstrap, not an endpoint)
#   6. /share.php?t=group&id=srv1 → "Markaz Ibn Taimiyya — DeenLink Group" (real-name enrichment, 0965cf9 live)
# Outstanding owner tests (hands-on): web notif de-dummy/DeenLink actor · video download w/ watermark
# (needs ffmpeg on host — if unwatermarked, check ffmpeg) · share deep-links · groups roster/roles/search/
# video posts · quiz/riddle/group common chats · skeletons · group posted pill. Phone: git pull + expo start -c (83-27).
# NOTE: chat/common.php is require-only — do not "fix" its empty 200 for guests.
# ══════════════════════════════════════════════════════════════════

# ══ 2026-09-10 — HOTFIX 83-27 (source-only, no web rebuild) ══ READ FIRST ══
# deenapp master = 575981e (DefaultAvatar raw <svg>/<circle> -> react-native-svg; fixes Expo Go native crash on Home)
# api/pages UNCHANGED (9ba1ca8 / 3510035 entry-f6ed812c) — web renders both forms fine; next pass carries this into bundles
# cPanel pull STILL PENDING (owner) · backup2 one pass behind (refresh needs owner OK)
# ══════════════════════════════════════════════════════════════════

# ══ 2026-09-10 — PASS 83-26 SHIPPED ══ READ FIRST ══
# deenapp master = 68bccf4 (83-26 client: notif de-dummy, share-tap, live quiz/riddle/group shares, watermarked downloads, skeletons, group pill)
# deenlink-api main = 9ba1ca8 (83-26 backend 0d1f265: NULL-actor=>DeenLink, kinds +quiz/riddle/group, download HEAD + web entry-f6ed812c)
# gh-pages = 3510035 (entry-f6ed812c, content pack intact) · LIVE-verified 200 on new entry
# app.deenlink.org still serves entry-019f22bd (OLD) + download.php HEAD 405 (OLD) — cPanel pull STILL PENDING (owner):
#   one pull brings backend 4dd9133/0965cf9/0d1f265 + web build 9ba1ca8 live (watermark needs img/logo.png from that pull)
# deenapp-backup2 one pass behind — refresh needs OWNER OK per standing rule
# - THE BACKUP IS deenapp-backup2 (old deenapp-backup DEPRECATED). Snapshot-style:
#   master = app tree snapshot · deenlink-api-main = api tree snapshot ·
#   content-pack/content.zip at master root (owner-recoverable; raw needs a token
#   since backup2 is PRIVATE). unpack-content.mjs fallback = public release asset.
# - CLONE RULE (owner): fresh agent setup = workspace pull AND asset restore
#   (content pack + avatars + articles check) — a code-only clone cannot bundle
#   (6 source files require assets/content/**). Restore commands: HANDOFF-PROMPT.md.
# - Docs lag: passes 83-14..83-26 exist only as commit messages (docs/ ends at 83-13).
# ══════════════════════════════════════════════════════════════════

# ══ 2026-09-10 — PASS 83-25 SHIPPED ══ READ FIRST ══
# deenapp master = 944b78c (pass 83-25 client: groups complete + videos upload)
# deenlink-api main = b6bcb74 (pass 83-25 backend 4dd9133 + share/logo 0965cf9 + web build)
# gh-pages = c80a9e8 (entry-e209625d, content pack @ content/content.zip) · api web = entry-2e1458ea
# cPanel pull STILL PENDING (owner): pulls backend 4dd9133/0965cf9 + web build b6bcb74 live
# deenapp-backup2 one pass behind (fd0dbfc/73fe90a) — refresh needs OWNER OK per standing rule
# - THE BACKUP IS deenapp-backup2 (old deenapp-backup DEPRECATED). Snapshot-style:
#   master = app tree snapshot · deenlink-api-main = api tree snapshot ·
#   content-pack/content.zip at master root (owner-recoverable; raw needs a token
#   since backup2 is PRIVATE). unpack-content.mjs fallback = public release asset;
#   gh-pages content.zip restored — BOTH previous pack URLs 404'd on 2026-09-10,
#   so fresh clones could not self-restore until this fix.
# - CLONE RULE (owner): fresh agent setup = workspace pull AND asset restore
#   (content pack + avatars + articles check) — a code-only clone cannot bundle
#   (6 source files require assets/content/**). Restore commands: HANDOFF-PROMPT.md.
# - Docs lag: passes 83-14..83-25 exist only as commit messages (docs/ ends at 83-13).
# ══════════════════════════════════════════════════════════════════

# CONTINUE — pass 42 handoff (2026-09-02)

# ══ CURRENT STATE — PASS 83 SHIPPED (2026-09-08, overnight) ══ READ FIRST ══
# STAGED FOR DEPLOY (owner pulls in cPanel when awake; site docroot was found EMPTY
# at ~05:50 — host default page — owner must fix docroot/re-deploy FIRST):
#   deenlink-api main = 4b0356c → PWA bundle entry-a297822c (pass-81b base + passes 83-1..6)
#   deenapp master    = 5c41170 (source). gh-pages NOT updated (still entry-a41a90b9).
#   deenapp-backup2: master 8fb2789 (snapshot @69ba838, pre-83-6) + deenlink-api-main dc060d2
#   — OWNER APPROVES backup updates; ask before refreshing (currently one pass behind).
# PASSES SHIPPED IN THIS BUNDLE (each replica-verified, zero pageerrors):
#   83-1 login: live domain NEVER mints demo sessions on network error — "Network error —
#        check your connection and try again" + 20s timeout (was 9s). Verified by aborting
#        login.php mid-request: stays on /login with retry message.
#   83-2 uploads on WEB use plain <input type=file> (src/lib/webfile.ts): group photo +
#        register proof/letter. expo-image-picker NEVER evaluated on web (fixes the live
#        group-photo crash). Native keeps lazy expo imports. Verified via filechooser event.
#   83-3 profile: REAL bio or honest "No bio" (fake 'DeenLink community member.' gone);
#        ⋮ dropdown backdrop no longer overflows viewport (no more screen shake/shrink).
#   83-4 inbox: IN-APP ONLY pill removed; empty state added. Chat core was already WORKING
#        in 81b (verified: profile Message → thread, request shelf → accept → chat list,
#        send works). Owner's "blank inbox" was empty state + stale cached broken bundle.
#   83-5 DM/UX round 2 (owner-reported): profile Message opens the DIRECT DM even when the
#        inbox was already mounted (initialFriend sync effect); mutual-follow suggestions
#        under "No messages yet" (getConnections('following') filtered by follows_me — no
#        server change); iOS input-focus zoom killed via injected style (#dl-no-ios-zoom:
#        touch-device inputs 16px — iOS auto-zooms <16px inputs; user-scalable=no is ignored
#        by iOS so font-size is the only real fix). Verified: t5 B1/C1 (fresh + pre-mounted
#        repro), A1-A3 suggestions->thread, Z1 style, t2 picker, t12 battery, 0 pageerrors.
#   83-6 GUEST FREE-BROWSE (shipped): gates removed on Home/Community/Videos/Quran; guest
#        Skip lands on Home; worship tools + Quran/Hadith fully functional; account actions
#        (like/comment/post/repost/save/follow/+Create group) pop the new LoginModalHost
#        modal (src/components/LoginModal.tsx — RN Alert.alert is a NO-OP on web, which is
#        why pass-80 guestBlock alerts never showed in the PWA; guestBlock now routes to the
#        host via setLoginModalHandler). Profile tab keeps GuestProfilePrompt ("Not signed
#        in" card -> login). Verified: t6 G1-G9, t6q quran/hadith open, t12 battery (S3 now
#        guest->Home PASS), t2 picker, 0 pageerrors.
#   83-7 DeenPoints screen (real rewards verify, reward modal, price packages + real DP
#        image, history pagination) · 83-8 charity balances real · 83-9 server rate limits
#        (anti-spam; pass-82 server code exists in history at b778024) · 83-10 group posts
#        full media + cassette player (SVG/canvas, biggest — last)
# AFTER OWNER PULLS: verify page source shows entry-a297822c, CLEAR SERVICE WORKER
#   (phone: Site settings → app.deenlink.org → Clear & reset; desktop: DevTools →
#   Application → Service Workers → Unregister + Ctrl+Shift+R), then confirm passes.
# REMIND OWNER: ask "update deenapp-backup2?" (currently at pre-pass-83 snapshot).
# ══════════════════════════════════════════════════════════════════

# ── PASS 68 (2026-09-06) — REALTIME CHAT + live notifications + search upgrade ──
**Backend (deenlink-api main, harness 24/24 on local PHP+MariaDB):**
- `chat/typing.php` (NEW): POST {conversation_id, typing:0|1} → `chat_typing` row
  (self-creating table in chat_schema), expires NOW()+6s; typing=0 deletes.
- `chat/messages.php`: +`since_id`/`since_share_id` light-poll mode (only newer
  rows; reactions always full), +`peer_typing` +`peer_read_at` on EVERY response.
- `chat/send.php`: inserts `chat_message` notification for the other participant
  (chat_notify_message in chat/common.php — ONE unread row per
  (recipient,sender,conversation), refreshed not stacked; wrapped in try/catch so
  a failed notify never breaks sending) + clears sender's typing row.
- `feed/search_posts.php` (NEW): public LIKE search (logged-out OK), get_posts-
  compatible rows (user/counts/media/badge), group posts excluded, q≥2 chars.
- Harness gotchas re-confirmed: db.php `getenv('DB_PASS') ?: '..'` — EMPTY env
  falls back to literal '..' (set the mariadb root password to '..' instead);
  register requires `aqeedah` + letters-only full_name (no digits);
  create_post reads $_POST form-encoded ONLY; search_accounts lives at
  api/users/; register returns 201 + logged_in when verification disabled.

**Client (this repo, tsc 0, headless probe green on both builds):**
- `client.ts`: chatThread(cid, since?) + peer_typing/peer_read_at; chatTyping;
  searchPosts; notificationsList + notificationsMarkAllRead (NotifRow type).
- `CommunityInbox`: 3s poll while a live thread is open (skipped when tab
  hidden; busy-guard; since-cursors) → appends deduped rows, rebuilds reaction
  maps, applies read watermark to ✓✓, auto-read throttle 10s; typing pings
  throttled 2.5s from setDraft, cleared on send; TypingDot ×3 bubble under the
  last row while peer_typing; smoothRef/atBottomRef so the interval never uses
  stale closures.
- `tools/notifications.tsx`: live mode — real rows (chat_message → 'chat' kind,
  MESSAGES chip), 30s poll, mark-all-read on open; chat notif taps open
  `/tools/inbox?u=<actor>`. Demo keeps the SEED mock.
- `(tabs)/index.tsx`: bell badge = real unread count (30s poll + on focus),
  replaces the old always-on orange dot.
- `tools/search.tsx`: account rows get Follow (toggleFollow, optimistic revert)
  + Message (→ /tools/inbox?u=) buttons; debounced (320ms) server post search
  merged ahead of local matches; "breathing" Skeleton per tab shape
  (Breathe opacity loop); RowIn stagger; FadeSlide on tab/query change.

**HEADS:** deenlink-api main `d61c6ae` (backend 5248f6e + pass-68 web build —
user pulls ONCE for both) · deenapp master `877e9ac` · gh-pages `d1559f8`
(content.zip intact) · backup `2556147` (mirror + content-pack PRESENT).

**Realtime architecture note:** short-poll over HTTP by design — shared hosting
(10 entry processes) cannot hold websockets/long-polls. Thread poll 3s,
conversations 60s, notifications 30s, presence 60s.

# ── PASS 67 (2026-09-06) — white-screen post-mortem + chat scroll + backs + search screen ──
**LIVE WHITE SCREEN (fixed, root-caused, verified):** user pulled `94d1561` on cPanel →
app.deenlink.org blank. Diagnosis: all assets 200; headless probe → root DOM = 0 with
`SecurityError: replaceState … URL 'https:'`. Root cause: `scripts/export-root.sh` patched
`appendBaseUrl`'s default from `n=""` to `n="/"`; EVERY bundle call site omits the 2nd arg, so
the template collapsed to `"/"+""+t` → root route path `"/"` became `"//"` → expo-router's
useLinking sync calls `history.replaceState({},'', '//')` on boot → protocol-relative →
cross-origin SecurityError → React never mounts. Reproduced EXACTLY via `replaceState('//')`
in the live page (same message). gh-pages unaffected (n="/deenapp" never collapses).
FIX: export-root.sh now uses `BASE=""` (guard stays on `t` only — still prevents
missing-slash paths). Rebuilt, local probe: boot DOM 27,230 B, 0 pageerrors, 0 bad
replaceState urls, /onboarding + /tools/search + /community all render. Deployed as
deenlink-api main `810977f` — **user must git pull again to recover.**

Pass-67 client work (in this repo, master `39f9c8d`):
1. Chat scroll: `CommunityInbox.webScrollNode()` resolves `[data-testid="chat-thread-list"]`
   FIRST (old tallest-scrollable heuristic picked the wrong node on live → silent no-ops).
2. Back dead-ends: `src/lib/navigation.ts` `goBack()` (router.canGoBack() ? back : home);
   all 25 `router.back()` sites in 22 files patched.
3. Profile header full name wraps (no ellipsis) in `profile/[username].tsx`.
4. `searchAccounts()` + `AccountResult` in client.ts (search_accounts.php?q=&limit=).
5. NEW screens: `tools/search.tsx` (idle: 5 recent posts + See more; on query: lazy
   Top/Users/Videos/Hashtags tabs; Top = mixed best account/post/video/hashtag rows),
   `tools/hashtag.tsx` (posts via FeedCard + tagged videos), `tools/post.tsx` (single-post
   viewer + CommentsModal). Home 🔍 → /tools/search; old overlay removed from (tabs)/index.
6. Gates: tsc EXIT 0 (twice + post-merge); headless boot/NAV probe green on fixed root build.

HEADS after pass 67: deenlink-api main `810977f` (fixed live build — PULL NEEDED) ·
deenapp master `39f9c8d` · gh-pages `6dbd721` (pass-67 build; entry-78bafc65… 200,
content.zip 206) · deenapp-backup master `3208266` (mirror of 39f9c8d + content-pack
blob 162e59f PRESENT).

**Go-live checklist for user:** cPanel `git pull` (recovers site + ships pass 67) →
set `email.verification.enabled = 1` (OTP gate) → live-test chat likes/comments:
two accounts → thread → long-press msg → emoji react (persists under bubble); Community
post → Comments → comment → nested reply → like both → reload: server tables keep state.

# ── NIGHT PASS (2026-09-06) — OTP gate + live posts/comments/polls/groups + AI cloud key ──
Backend (deenlink-api main 4446b02, PUSHED — needs cPanel git pull):
- OTP GATE: register never logs in (needs_verification:true, zero cookies);
  login 403s unverified; me.php kills stale sessions; verify_otp mints session
  (account_status via user_moderation_status — users.account_status is NOT a
  column; fixed after harness caught the fatal).
- deenai/status.php: connected probe (ai_provider_keys) — app hides the API-key
  field when cloud AI is connected.
- POLLS: create_post poll_options (2-6); get_posts attaches poll payload;
  poll_vote.php / poll_get.php (one vote per poll, vote moves). Tables
  post_poll_options/post_poll_votes self-create (DDL runs PRE-transaction —
  implicit-commit bug found by harness).
- GROUPS: api/groups/ (community_groups + group_members self-creating schema,
  posts.group_id column): list/get/join/create/posts/create_post. Harness 20/20.
- feed/link_preview.php: server og-scrape (SSRF-guarded, 64KB range, 6s timeout).
- notifications.php get_bool_setting now function_exists-guarded.

Client (this commit):
- register/login/OtpVerify: cancel NEVER logs in; verified OTP adopts session;
  login path handles needsVerification with the same modal.
- CommentsModal: live threads (get_comments/add_comment/add_reply/comment+reply
  likes) — server reply ids namespaced +1e9; feed + community like toggles call
  toggle_like and rebase counts; composer publishes via create_post (text,
  YouTube, poll options, image) and swaps in the real post id.
- FeedCard polls: server-voted state + votePoll sync.
- Groups: loadGroups merges server rows (srv<id> keys); create/join/leave/post
  hit the API on live; group screen pulls real posts.
- Connections + public profile: real follow graph (get_connections,
  toggle_follow, get_user_profile); live values win over mock.
- LinkPreview card: chat bubbles with URLs unfold og-preview cards.
- routine.ts markGoal: only counts modules actually in today's rotation.
- ai.tsx: cloud-connected banner replaces the key field when status says connected.
Gates: tsc --noEmit exit 0; backend harness 20/20 (php -S 8201 + mariadb 3311,
register→OTP→post→poll→comment→reply→likes→groups→connections→preview→ai).


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

---
## FRESH-CLONE GAPS (verified against the GitHub API, not local git)

`git ls-files`/`git cat-file` are **unusable** in this sandbox — `.git` disappears between turns, so always
verify repo state with the API:
`curl -s -H "Authorization: Bearer $(cat deenapp/.token)" https://api.github.com/repos/useeman32-design/deenapp/contents/<path>?ref=master`

Remote `assets/` contains ONLY: `expo.icon`, `images`, `img`, `vid`.
**Missing from the repo:** `assets/content/` (20 MB extracted datasets), `assets/content.zip` (17 MB),
`assets/avatars/`. Six source files depend on them:
`src/data/hadithBooks.ts`, `src/data/hadithDaily.ts`, `src/data/names99.ts` + 3 more (`grep -rl 'assets/content' src/`).

**Remedy now in place:** `content.zip` is published as a release asset on `v0.1.1-preview`
(17,196,993 bytes) → https://github.com/useeman32-design/deenapp/releases/download/v0.1.1-preview/content.zip
Download it and run `node scripts/unpack-content.mjs` before any build. See the START HERE block in
`HANDOFF-PROMPT.md`.

Also gitignored and therefore absent from a clone: `.token`, `.expo-token` (both 40-byte files, user-supplied).

---
## SHALLOW CLONE — intentional, with one correction

`git clone --depth 1 --single-branch` is **deliberate**, not an accident: `.git` counts toward the 128 MB
workspace snapshot cap, and a full clone's history pushed it over (that overflow is what silently dropped
660 files). A depth-1 clone keeps `.git` at ~33 MB.

**Correction (verified 2026-09-05):** because only 1 commit is present, the previously documented rollback
command `git checkout <old-sha> -- <paths>` fails with `fatal: invalid reference: <sha>`.
- `git fetch --depth 1 origin <sha>` → **fails** (`couldn't find remote ref`) — do not use.
- `git fetch --deepen 40 origin master` → **works**: 1 → 41 commits, `e47a726` reachable, `.git` 33 MB → 35 MB.

So: stay shallow for normal work, and `--deepen` only when you need to recover an older revision.

---
## ASSET BACKUP MAP (all three verified 2026-09-05)

| Local path | Files | Size | Backup | Restore |
|---|---|---|---|---|
| `assets/content/` | 147 | 20 MB | release asset `content.zip` (17,196,993 B) | `node scripts/unpack-content.mjs` |
| `assets/avatars/` | 62 | 5.8 MB | **`avatar.zip` — tracked in git** | unzip, then `profile/*` → `assets/avatars/` (layout differs) |
| `assets/img/articles/` | 6 | 2.0 MB | release asset `img-articles.zip` (2,044,683 B) | unzip into `assets/img/` |

Release `v0.1.1-preview` (id `383117057`) now holds three assets:
`deenlink-preview.apk`, `content.zip`, `img-articles.zip`.

**Rule going forward:** any new asset tree that code `require()`s must be committed to git OR published as a
release asset in the same session. Untracked assets are the one thing this git-centric workflow does NOT protect.

---
## REVIEW-GATE WORKFLOW — `new-agent-update/` (agreed 2026-09-05)

Two chats now work the same codebase. To stop them clobbering each other:

**The other agent (the "new chat") may ONLY write inside `new-agent-update/` at the repo root of
`deenapp`, on `master`.** It must not touch `src/`, must not deploy to gh-pages, and must not touch
`deenlink-api`. Nothing in that folder is imported by the app, so it is inert until reviewed.

### What the other agent must do
1. `git pull` latest `master` FIRST, so it is not editing a stale copy (pass 52 changed
   `routine.ts`, `learning.tsx`, `tools.tsx`, `ai.tsx`, `CommentsModal.tsx`, `profile.tsx`).
2. Mirror the real paths inside the folder — `new-agent-update/src/app/tools/zikr-challenge.tsx`,
   not `new-agent-update/zikr-challenge.tsx`. Path-for-path mirroring is what makes review a diff.
3. Add `new-agent-update/CHANGES.md` listing: the user request addressed, each file changed and why,
   what it verified (tsc? which command?), and anything it could NOT verify.
4. Commit + push. Do not deploy.

### What THIS chat does on receiving it
1. `git pull`, then diff every file in `new-agent-update/` against its live counterpart in `src/`.
2. Copy into place, run `npm ci && ./node_modules/.bin/tsc --noEmit` — must be 0.
3. Re-run the **rollback check** (`bootOk`, `CrashBoundary.tsx`, `Font.loadAsync`, `groupThousands`,
   `useGoalFocus.ts`) — the other agent will not know these matter.
4. Confirm it did not undo pass 52: stable daily goals (`dl.goal.set.`), hub `?focus=` deep links,
   profile `formatDP`, AI lightbulb, comment AI loader at top, no `@handle` injection.
5. Only then deploy BOTH web builds and verify an `_expo/` asset returns 200.

### Why not a branch?
A branch would be cleaner git-wise, but a folder is safer here: the other agent cannot accidentally
deploy or rewrite history, and the user can see every proposed change in one place before it lands.

---
## ── pass 56–62 (2026-09-05) — the CHAT module, rebuilt and server-backed ──

Shipped: gh-pages `e77036d` (bundle `entry-f0e291bcb7d4404dbacd9042e0804a9f.js`, 200 verified) ·
deenlink-api main `afba407` (backend) then `423cb4e` (web build) · deenapp master `e77f0f4`.
⚠️ `app.deenlink.org` still needs the user's cPanel `git pull` — none of passes 53+ is live there yet.

**Pass 56** fresh chat + AI backend (`api/chat/`, `api/deenai/chat.php`); migrations inside the PHP.
**Pass 57** chat UI → built into `src/app/tools/chat.tsx`, which had **zero inbound links** (invisible).
**Pass 58** ported the whole chat UI into the real screen, `CommunityInbox.tsx`.
**Pass 59** per-conversation drafts, truncated titles, avatar/name → profile, WhatsApp-style send,
"Message" button on the public profile, text no longer leaks between chats.
**Pass 60** ONE chat interface: `tools/chat.tsx` deleted; `live = isLive() && !!user && !isDemo`
(demo on Pages, live on the main site); new `start_username.php` resolves a username → DM server-side.
**Pass 61** `PopEmoji` (per-reaction mount animation) + the ellipsis sweep (Correction 31).
**Pass 62** shares and reactions moved to the server (below).

### Pass 62 — shares + reactions are server-backed now
The user: *"yes I want these in the server too — reels, posts, duas, ayahs, and the emoji reactions."*

**Backend (`deenlink-api`, commit `afba407` + `423cb4e`):**
- `chat_schema()` gained `chat_shares(id, conversation_id, sender_id, kind, title, payload, created_at)`
  and `chat_reactions(id, conversation_id, target_kind, target_id, user_id, emoji, created_at)` with
  `UNIQUE(target_kind, target_id, user_id)` — one emoji per person per target, so reacting again replaces.
- `api/chat/send_share.php` — `POST {conversation_id, kind, title, payload}` → `{id, kind, title, payload, created_at}`.
  `kind` is whitelisted to `post|reel|ayah|hadith|dua|profile`; `payload` keeps **only** `arabic|refLabel|sub|dur`
  (each ≤600 chars, blob ≤2000). No uploads, no external URLs — shares are pointers to in-app content.
- `api/chat/react.php` — `POST {conversation_id, target_kind, target_id, emoji}` → `{emoji, removed}`.
  `emoji: ""` removes MY reaction (that is the UI's toggle-off). Control chars stripped, ≤8 chars.
- `messages.php` now returns `messages` + `shares` + `reactions` (reactions carry `username`) in ONE call;
  the `messages` array shape is unchanged, so old clients keep working.
- `conversations.php` preview line is the newer of last message / last share, and the list is ordered by
  that same recency, so a share-only conversation no longer looks empty.
- `send.php` + `send_share.php` return the row's real `created_at`.
- `common.php` gained `chat_share_kinds()` and `chat_target_exists()` (a reaction can only target a row
  that belongs to the caller's conversation).

**Frontend (`deenapp`, commit `e77f0f4`):**
- `client.ts`: `chatThread()` (one call for the whole thread), `chatSendShare()`, `chatReact()`;
  `chatSend()` now returns `{id, created_at}`.
- `CommunityInbox.tsx`: opening a live thread replaces the demo cards with the real thread;
  `react()` posts and **reverts** if it fails; `shareBack()` posts and marks the card `⚠ not sent` on
  failure; `resolveCid()` creates the DM by username when there is none yet.
- `ShareItem`/`ChatMsg` gained `at` (server timestamp). `flow` merges shares and messages and sorts by it,
  so a shared ayah appears where it happened instead of above every message. Untimestamped rows sort to
  `'9999'` = last, which keeps the demo seed order byte-identical.
- The two render blocks were extracted verbatim into `renderShare(th, it)` / `renderMsg(th, m)` to make
  that merge possible. `thread.` became `th.` inside them.

**Verified over HTTP against real MariaDB 11.8.6 (22 checks):** share write + read-back · Arabic payload
round-trips (`إِيَّاكَ نَعْبُدُ…`) · two users reacting to one target · replace emoji · toggle-off deletes the
row · 401 unsigned · 403 non-member on BOTH read and react · 404 target from another conversation ·
400 bad kind / empty title / missing conversation_id · payload whitelist drops unknown keys
(`<script>` payload key discarded) · overlong+control-char emoji truncated to 8 · preview flips to
`DUA shared: Test` when the share is newest · `created_at` returned by both send endpoints.
`tsc --noEmit` → 0. **NOT exercised in a browser** — same caveat as passes 60/61.

### pass 56 backend test harness (rebuild it every turn — `/tmp` is wiped)
```bash
sudo apt-get install -y php-cli php-mysql php-mbstring php-curl mariadb-server   # php-curl is separate!
mariadb-install-db --datadir=/tmp/mydata --auth-root-authentication-method=normal
setsid nohup /usr/sbin/mariadbd --datadir=/tmp/mydata --socket=/tmp/myrun/my.sock \
  --pid-file=/tmp/myrun/my.pid --skip-grant-tables --port=3311 >/tmp/mariadb.log 2>&1 </dev/null &
# mariadbd is NOT on PATH; /var/lib/mysql is not writable by `user`
```
Harness = a copy of `api/chat/*` + **empty stubs** for `api/config/{db,cors,session,csrf}.php` and
`api/admin/auth/common.php` (`db.php` returns a PDO on the unix socket, db `deenlink`) + a `router.php`
that fills `$_SESSION` from an `X-Test-User` header, served by `php -S 127.0.0.1:PORT -t <dir> router.php`.
Seed `users(id, username, full_name, profile_image, deleted_at)`.
Never test POST endpoints with `php runner.php` — `php://input` is empty in the CLI SAPI.
Never `pkill -f "php -S"` — it kills the shell (exit -1); use a fresh port.

## ── pass 66 (2026-09-06) — pro full-bleed canvas, shares slide-to-reply, scroll UX ──

Shipped: gh-pages `c98f38e` · deenlink-api main `2a1e096` · master (this commit).

**What landed**
1. `_layout.tsx`: global `user-select:none` + Manrope/Sora `@font-face` RESTORED (pass-65 session had
   clobbered them), then the dark-body hack replaced with the pro approach: `html,body,#root` paint
   `var(--app-bg)` everywhere (overscroll margins, desktop letterbox), `overscroll-behavior:none`,
   and a theme effect writes `--app-bg` + `<meta name="theme-color">` = `theme.background` on every
   theme change. Verified light `#F5F5F5` / dark `#0B0F14` — seamless in both, no white, no mismatch.
2. `NetPill` (lib/net.tsx) now insets by `useSafeAreaInsets().top` so it never sits in the native
   status-bar zone.
3. `CommunityInbox`: share/app-item cards wrapped in `SwipeReply` (slide-to-reply everywhere);
   send-from-top smooth-scrolls via a rAF ease-out animator (`webSmoothToBottom`) because headless
   shells ignore `behavior:'smooth'` AND RN-web's `scrollToEnd` measures at call time;
   `atBottom` tracking + "Latest" jump chip above the composer (measured composer height).
4. `src/api/client.ts` finally carries the pass-63 contract that was missing from master
   (master DID NOT compile!): `ChatMessage.deleted/reply_to`, `ChatShare.deleted`, 3-arg
   `chatSend`, `chatDelete`. Backend already served all of it.
5. Build blockers fixed permanently: `assets/img/articles/*.jpg` (6, procedural, script
   `scripts/make-article-art.py`) and `assets/avatars/{male,female}/*.jpg` (62, randomuser.me
   portraits) were `require()`d by source but NEVER committed — clean clones could not export.
   Both dirs are now committed.

**Quirks discovered (do not re-investigate)**
- RN-web `ScrollView` ref comes back NULL on web in this build (forwarded ref never lands);
  web scroll code must resolve the node from the DOM — see `webScrollNode()`.
- headless chrome-headless-shell ignores `scrollTo({behavior:'smooth'})`; drive scrollTop via rAF.
- `/tmp` AND `node_modules` AND `dist` AND `.cache/ms-playwright` are wiped between turns;
  `dist-root/` is NOT snapshot-excluded → it inflates workspace storage. DELETE it right after the
  deenlink-api deploy. (That plus the 68 new committed images ≈ the storage jump the user saw.)

**probe66 gate (headless, all true):** canvas var/body/root bg == theme · overscroll none ·
theme-color meta · bubble user-select none · input auto + font Manrope · share card mouse-drag →
"Replying to aisha_yusuf" + cancel · chip shows scrolled up, click → gap 0 · send from top →
bubble visible · own hold-menu Reply/Forward/Copy/Info/Delete · Info Delivered + Seen/Not-seen ·
forward screen "Forward to 1" · their menu has no Info/Delete · zero JS errors.

## PASS 69 — Ask Scholars + unified bookmarks + live payments (Flutterwave)

**Backend (deenlink-api `f77cc5f`, harness69 23/23):**
- `api/bookmarks/{common,toggle,list}.php` — one `user_bookmarks` table for EVERY kind
  (hadith, ayah `surah:ayah`, surah, prophet, seerah, fatwa, video, post); payload JSON ≤4 KB.
- `api/deenpoints/history.php` — `{balance, events[]}` for the new ledger screen.
- `init_deenpoints.php` + NEW `init_donation.php`/`init_premium.php` redirect mode
  (`redirect:true` + validated `redirect_url` → server creates the tx with the SECRET key via
  Flutterwave /v3/payments → hosted-checkout link for the native app; 502 on FLW failure).
- verify.php already credits donation/premium/deenpoints by `purpose` — untouched.

**Client (this repo):**
- `src/lib/bookmarks.ts` — module store, local mirror `dl.bookmarks.v1` first, server overwrite
  when live; `useBookmarks(kind)`. `src/lib/savedPosts.ts` upgraded: kind `post` with compact
  snapshot payloads (≤600-char body) so the Saved tab syncs across devices.
- `src/lib/flutterwave.ts` — ONE payment runner: web = v3.js inline + verify; native = redirect
  mode + `dl.flw.pending_tx` settled on focus. Exposes buyDeenPoints / donate / buyPremium.
- `src/app/tools/deenpoints.tsx` — live balance card, presets+custom, quote-driven pricing
  (₦1.5/pt + FX), Flutterwave buy, ledger history. All DeenPoints entry points (settings row,
  profile chip, DeenPointsPill everywhere, charity chip) now route here; the mock buy modal is
  no longer opened.
- `src/app/tools/fatwa.tsx` — Ask Scholars source chip: scholar picker (users.id), categories,
  public/private, DeenPoints bonus, My Questions w/ unread badge; saved rulings now keyed by
  stable `d<id>`/`i<idx>` in the bookmark store.
- Bookmark wiring: hadith reader, Quran favs + saved ayahs (surah list & reader share it),
  seerah, videos saved, prophet stories (NEW star, reader + hub cards), posts (savedStore).
- charity.tsx pays for real when live (inline/hosted), demo fallback kept; settings premium
  sheet shows quote_premium pricing and buys via init_premium.

**Gates:** tsc clean · harness69 23/23 (donation init inline, redirect-scheme 400, quote
premium, premium init dl_pm_*) · web+root exports + headless boot probe before deploy.

## PASS 70 — account discovery + suggested accounts + live video reposts

User report: fresh accounts invisible in search, comment authors not clickable to a
profile, suggested-accounts mocked, video reposts local-only. Root causes found:
- The DEPLOYED site predated pass 68 (old bare `/username` navigation = the errors the
  user saw). Current code routes every profile tap to `/profile/[username]` (verified:
  comments modal, search results, suggestions, notifications).
- `videos()` in client.ts read `r.data.videos` but list.php returns `items` → the app
  NEVER loaded live videos (silent mock fallback since forever). Fixed.
- Backend `videos_update_metric_counts()` never recounted `reposts_count` → repost.php
  always answered 0. Fixed (+ shaper now exposes `reposts` and `repostedByMe`).
- suggestions.tsx was 100% MOCK_ACCOUNTS. Now: get_connections.php?tab=suggestions +
  toggle_follow.php (optimistic, revert on failure), skeleton loader, demo fallback.

**New client wiring:** videos.tsx merges REAL reels (id = 500000+serverId, liveId kept)
into the feed; retweet rail button with live count; toggleRepost → /api/videos/repost.php
(optimistic + revert + toast; owner gets a push notification server-side).
**harness70.py: 18/18 PASS** — register A+B → search by username+name → profile by
username → follow → suggestions include → post → comment (author username exposed) →
chat start-by-username + send + recipient sees conversation → repost toggle/undo/explicit
+ list repostedByMe + own-reel rejected. harness69 re-run: 23/23 (no regression).

## PASS 71 — onboarding Android fix, check-in visibility, real counts, brand polish

1. **Onboarding (Android Chrome)**: images measured at NATURAL size (percentage width +
   aspectRatio inside the pager) → overflow + stretched containers. ImageCard is now an
   explicit pixel box (CARD_W = min(W-52, 460); height 60% or square) and the AI art uses
   `contain` so the full picture shows — never a zoomed crop again.
2. **Check-in**: client read keys the server never sent (`points`/`deenpoints` vs the real
   `points_awarded`/`new_balance`) and the local coin drifted. dailyCheckin() now parses
   the real payload; profile pins the coin via dp.sync(balance); SERVER decides duplicates.
   Backend: daily_checkin writes a ledger row (was silent!) + push_notification;
   award.php + verify.php (purchases) also notify — "+5 DeenPoints · Daily check-in reward"
   lands in the Notifications screen and the DeenPoints history.
   GOTCHA fixed: push_notification runs CREATE TABLE IF NOT EXISTS — MariaDB DDL
   auto-commits, so it must run AFTER $pdo->commit() (a 500 otherwise).
3. **Profile counts were dummy** (hard-coded 3/128/96 fallback): get_profile_counts.php
   REQUIRES ?user_id and answers FLAT — client sent neither/read `counts`. Fixed; zeros
   instead of lies on failure; refetches per user.
4. **Brand**: real four-colour Google "G" (react-native-svg) replaces FontAwesome glyph;
   auth logo now matches the splash tile (17% radius, gold hairline) at 88px (was 116).

**harness71.py: 10/10** (check-in +5, balance, ledger, dup=0, award +3, both notifications
with source text, flat real counts). harness69 23/23 + harness70 18/18 re-run.

## PASS 72 — TIER 1 WIRING (video engagement, courses, donations, qur'an extras)

1. **Video engagement suite** (videos.tsx + CommentsModal + search.tsx): server likes
   (optimistic + revert, authoritative like_count from toggle_like), real comment threads
   (list/add/reply via parent_id/like/delete — CommentsModal takes videoId), saves mirror
   into video_bookmarks (bookmark store stays canonical for the Library), add_view once
   per reel per session (server dedupes 6h), Report + Not Interested hit the real
   endpoints, Videos tab in search uses videos/search.php (debounced, merged with local).
   Backend: admin/videos/common.php now emits savedByMe (+likedByMe/repostedByMe) so the
   rail hydrates on load.
2. **Courses progression** (courses.tsx): courseGet on open → real modules/lessons beat
   the bundled CURRICULUM; deenpoints courses show an UNLOCK gate (cost + balance);
   unlock spends points (dp.sync) + auto-enrolls; complete_lesson records server-side;
   finishing a certificate course surfaces certificate_no + verification_code.
3. **Donation history** (charity.tsx): my_history rows (all devices incl. web checkouts)
   merge into the local receipt list, deduped by tx_ref, server copy wins.
4. **Qur'an extras**: QuranAudioContext pulls admin-managed reciters (reciters.php —
   endpoint emits `key`, normalized to reciter_key client-side) and builds URLs generically
   (absolute_ayah = base/{global}.fmt, surah_ayah = base/SSSAAA.fmt); read screen logs the
   daily streak (streak.php POST on mount, 🔥 chip in the reciter sheet) and premium
   reciters unlock with DeenPoints inline.
5. **Backend bugs fixed in production paths** (would 500 live):
   - videos/search.php + upload.php + download.php called videos_ensure_tables_cached()
     which only existed in the .phpp DECOY → ported into the real common.php.
   - unlock_points.php + unlock_reciter.php died with "no active transaction" when the
     ledger DDL (first run) implicitly committed → commits now guarded by inTransaction().

**harness72.py: 26/26** (likes/comments/threads/comment-likes/saves/flags/views-dedupe/
report/not-interested/search/unlike · course lock→unlock→enroll→complete→certificate ·
donation history+summary · streak log/read + reciter unlock). harness71 10/10, harness70
18/18, harness69 23/23 re-run. probe72 (5 routes) ALL OK on BOTH bases (/deenapp + root).

Heads: deenlink-api main cff76f2 · deenapp master c637754 · gh-pages 34099e9 · backup c637754.
NEXT per user: Tier 2/3 inventory → admin dashboard audit → iOS/Android store builds.

## PASS 73 — user-reported fixes (before Tier 2)

1. **Profile refresh → Forbidden / logged out** (app.deenlink.org): the Expo export ships
   BOTH profile.html AND a profile/ directory; Apache preferred the directory → mod_dir →
   403. New web-root `.htaccess`: extension-less paths resolve to their .html export,
   unknown paths fall back to the SPA (404.html), 403/404 render the app shell.
2. **"That's not my avatar"**: users.profile_image stores a bare FILENAME; auth/me.php +
   login.php returned it raw while every screen reads profile_image_url → uploaded photo
   vanished on refresh (initials shown). me.php now builds the absolute URL (same rules
   as get_user_profile.php) and the client normalizes via hydrateUser() (me + login).
3. **Default profile photo everywhere**: AvatarImage (feed, comments, inbox, profiles,
   pickers) now falls back to the SAME gendered DefaultAvatar SVG as edit-profile (was
   initials) and resolves bare filenames against {API}/uploads/profile/.
4. **Share = multi-select + search**: new SendToFriends.tsx (FriendsPicker) replaces the
   single-tap mock rows in BOTH the post share sheet (ContentShareSheet) and the videos
   "Send to…" sheet. Recent DM peers suggested, real account search (search_accounts),
   mark many, one Send → each picked user gets a server-backed chat share
   (chat/start + chat/send_share) landing in their DeenLink inbox. Demo mode delivers to
   the local inbox store as before.
5. **Android swipe overshoot**: onboarding pager + videos reel list got
   snapToInterval + snapToAlignment + decelerationRate="fast" + disableIntervalMomentum
   → one slide/reel per swipe (fling momentum no longer carries several pages).

**harness73.py: 8/8** (me.php URL build: fresh/uploaded/default · account search · DM
start · post share delivered to recipient thread · reel kind). harness72 26/26 +
harness71 10/10 re-run. probe72 ALL OK on both bases.

WORKSPACE INCIDENT (recovered): the sandbox rolled the repo back mid-turn to de94ef8 and
resurfaced new-agent-update/ (pass-53, never merged per Correction 27 — moved to
/tmp/new-agent-update-old). GitHub was truth: fetch + reset --hard origin/master, then
re-applied pass-73 patches. Also self-inflicted: a python splice truncated client.ts
(`s[:i]+"export "+s[i:end+1]` drops the tail) — use s[:i]+"export "+s[i:] for inserts.

---

## PASS 74 (this pass)

1. **Profile "we couldn't find this account" — FIXED (three stacked bugs)**:
   a) the profile useMemo had deps [username] only — when liveP landed the memo
   never recomputed, so real accounts stayed not-found forever → deps [username, liveP];
   b) the fetch effect deps [username, liveP] re-fired on every setLiveP (endless
   refetch loop) → [username, ready]; plus ready-gating so a hard-nav mount before
   restoreSession no longer skips the fetch;
   c) `useState(shareOpen)` sat BELOW the `if (!profile)` early return → the first
   successful fetch changed the hook count and crashed the screen (React #310),
   which on web fell through the catch-all to `/?username=` → moved up with the hooks.
2. **Search rows**: message button REMOVED (messaging lives on the profile) — Follow kept.
3. **Message requests (end to end)**: start.php + start_username.php open stranger DMs as
   `request` (follow-gated, requested_by set); send.php caps the requester at 3
   (403 request_limit), auto-accepts on recipient reply, declined → 403;
   conversations.php exposes conv_status/requested_by/with_name; NEW request_action.php
   (accept → active + accepter follows requester · block → declined · report → declined +
   account_reports row). Inbox: "Message requests" shelf → panel with Accept & follow /
   Block / Report (Alert confirm); outgoing requests show "3-message limit" header note
   and an Alert when the 4th send fails; ?u= deep link now STARTS the conversation so the
   thread actually opens (was: bare list). acc() mock fallback replaced with real
   with_name/with_photo (live DMs showed a mock person's name).
4. **Nested replies**: get_comments' parent_reply_id now flows through client →
   CommentsModal; "Replying to X" names the DIRECT parent author, optimistic replies
   carry parentId too.
5. **Search empty state**: persisted history (dl.search.history.v1, chips, >7 → Show
   more/less, Clear), Recent posts 5 → 15 with Show less.
6. **Top tab**: up to 3 account matches (users fetch now also runs on the Top tab — it
   never did, so live Top never showed accounts).
7. **Videos**: Repost button beside the "Reposted by" pill (same server-backed onRepost
   as the rail, shows Reposted state).
8. Drive-by: api/defaults/get.php required a non-existent config/config.php → 500 on
   every app boot (live too) → now config/db.php.

Gates: tsc clean · expo export clean · harness70 18/18 · 71 10/10 · 72 26/26 · 73 8/8 ·
74 13/13 (incl. start_username request status) · repro74b E2E 17/17 on
http://app.deenlink.org (same-origin client+API via /tmp/dlrouter.php on port 80):
login · search rows · SPA+hard-nav profiles · history/clear · request note · shelf ·
accept → thread + server follow.

---

## PASS 75 (Tier 2)

**Ask Scholars — scholar side (the missing half):**
- NEW `src/app/tools/scholar-inbox.tsx`: queue tabs (To answer/Answered/Rejected with
  counts), question cards (asker, priority chip, preview), detail sheet with thread
  messages + composer (Publish answer / Ask for details / Reject-with-reason modes).
- Entry: Fatwa & Rulings shows a "Scholar Inbox" card when user.user_type === 'scholar'
  (me.php already resolves approved scholars server-side).
- client.ts: scholarQueue / scholarRespond / questionThread (both roles) +
  ScholarQueueRow/QuestionThreadMessage types.
- Asker side was already live (pass 69); profile Questions tab now loads the scholar's
  real answered questions (public_list.php?scholar_user_id=…, PublicProfile.user_type).

**Wallpapers:** wallpapers.tsx gained a server-backed "DeenLink Gallery" (admin-curated
images, free or DeenPoints-priced): lock badge, unlock (server ledger spends points),
open full size + share. Local SVG generator untouched.

**Account tools:** report-account flag on public profiles (sheet with 5 reasons →
users/report_account.php → account_reports). Avatar gallery already shipped in pass 50
(AvatarPicker, 62 gendered presets).

**Server fixes:** wallpapers/unlock.php threw a 500 AFTER spending points — the ledger
helper's CREATE TABLE IF NOT EXISTS causes an implicit commit, so the final $pdo->commit()
blew up ("no active transaction"); now guarded with inTransaction().

Gates: tsc clean · export clean · harness70 18/18 · 71 10/10 · 72 26/26 · 73 8/8 ·
74 13/13 · **75 18/18** (scholar queue guard → submit → queue → message → answer →
asker my_list/unread/mark-read → public list · wallpaper free/paid unlock, no
double-charge · report row) · **repro75 E2E 12/12** (inbox entry → queue → answer via
UI → answered tab → profile report sheet → gallery section) · repro74b 17/17 re-run.

Heads: deenlink-api main c827b97 · deenapp master d1187e7 · gh-pages 19c1cda.
## PASS 76 (Tier 3 — real block + chat reports, user-selected)
**Backend (deenlink-api, harness76 18/18):**
- NEW `api/lib/blocks.php`: blocks_ensure() (self-creates `user_blocks`
  (blocker_id, blocked_id, created_at) PK both), blocks_between(), blocks_has().
- NEW `api/users/block_action.php`: POST {username, action:block|unblock} →
  {status, blocked}. Block: INSERT IGNORE + all DM conversations between the
  pair → 'declined' (hidden from inbox; chat-table-missing guarded). Unblock:
  DELETE + their 'declined' DMs → 'request' (recipient must re-accept).
  Self-block → 400.
- NEW `api/users/blocks_list.php`: GET → {blocks:[{user_id, username,
  full_name, profile_image_url, blocked_at}]}.
- Enforcement (403 code:'blocked'): chat/common.php +chat_dm_peer/
  +chat_guard_blocked used by send.php (BEFORE pass-74 request rules so
  'blocked' wins), send_share.php, start.php, start_username.php;
  users/toggle_follow.php (after interaction_guard); users/search_accounts.php
  filters BOTH directions via conditional NOT EXISTS (params become
  [$like,$like,$me,$me,$q,$q] when logged in).

**Client (tsc 0, repro76 8/8):**
- client.ts: blockUser(username, block) + myBlocks() + BlockedAccount type.
- CommunityInbox: block-confirm now calls blockUser → hides thread
  (hiddenConvs) + closes it; report sheet submits reportAccount(peer.id,
  "<reason>[: details]") — peerMap now keeps c.peer.id.
- profile/[username].tsx: red user-slash block button beside the report flag
  (user-check + Unblock when active), server-backed toggle + Alert.
- NEW settings/blocked-accounts.tsx (list + one-tap unblock, spinners);
  Privacy & Safety sheet row now routes there (was a stub Alert).

**Gates:** harness 73 8/8 · 74 13/13 · 75 18/18 · 76 18/18 · repro76 8/8 · tsc 0.

**HEADS (pushed):** deenlink-api main `32f40ab` (backend `ad7985e` + web root
rebuild) · deenapp master `f58079f` (code `b157772`; `assets/content.zip`
untracked again — postinstall regenerates it, NEVER `git add -A` it) ·
gh-pages `bec0499` (demo live, bundle entry-264d73546690bac005e6d81b67258ac5.js).
Live pending user cPanel pull: `git fetch origin && git reset --hard origin/main`
in the deenlink-api docroot, then Ctrl+Shift+R; verify page source contains
entry-264d7354.

## PASS 77 — nested comment replies: "Replying to ›" must name the DIRECT parent
User report: A comments → B replies to A → C replies to B ⇒ UI showed
"replying to › A" (root author) instead of B — and after reload C's reply
vanished. Root causes (client; API was already correct — harness77 11/11):
- get_comments.php + videos/list_comments.php return reply TREES (reply-to-
  reply nests inside its parent) but CommentsModal.mapServer mapped only ONE
  level → every deeper reply was dropped on load ("View 1 reply" instead of 2).
- The optimistic row stored the OFFSET id as parentId while the label lookup
  adds REPLY_OFF again → double offset → not found → fallback to the root
  comment author (exactly the reported symptom right after posting).
Fixes (CommentsModal.tsx): mapServer now DFS-flattens the tree keeping
parentId = parent_reply_id ?? parent_id (videos); optimistic child stores
replyingTo.id - REPLY_OFF; feed send guards temp Date.now ids
(< 100_000_000_000) so no garbage parent_reply_id ships; videos reply-to-
reply now passes the REPLY's id as parent_id (was the root comment id).
client.ts: ServerReply + parent_id (videos).
Gates: harness77 11/11 · repro77 9/9 (chip, row, reopen-from-server) ·
harness 73-76 57/57 · repro75 12/12 · repro76 8/8 · tsc 0.

**HEADS (pushed):** deenapp master `911344c` · deenlink-api main `b87d98a`
(web root rebuild — no API change this pass) · gh-pages `3ac0ff5`. New bundle:
entry-85cb5f8f93b34f1ed3550538f617220b.js — live shows it after the user runs
`git fetch origin && git reset --hard origin/main` in the API docroot (live was
still on entry-0d2ee644 = pass 75 when this bug was reported).

## PASS 78 — DeenLink Shop (e-commerce module)
**Backend (api/shop/, harness78 22/22):** shop_ensure() self-creates
shop_products/shop_cart/shop_orders/shop_order_items + seeds 13 products
(9 own drop-ship + 4 affiliate: amazon/aliexpress/jumia/ebay deep links).
Endpoints: products.php (public, ?category=), product.php, search.php (q>=2),
cart.php (GET mine / POST add|remove|qty — affiliate add blocked, qty cap 20),
checkout.php (auth-first, shipping form → order + stock decrement + cart
clear, transaction), orders.php (mine w/ items). Prices in USD cents.

**Client (tsc 0, repro78 16/16):** assets/shop/ 10 generated images (2 promo
banners + 8 products). lib/shop.ts: image_key→require map, DEMO_PRODUCTS
(mirrors seed), SHOP_CATEGORIES/NETWORKS. client.ts: shopProducts/shopProduct/
shopSearch/shopCart/shopCartAction/shopCheckout/shopOrders + types.
app/shop/index.tsx: module w/ OWN bottom menu (Shop | Cart | Orders), promo
carousel, category chips, 2-col grid (sale %, partner badge, free worldwide
shipping), server-backed cart w/ steppers, checkout sheet → success → orders.
app/shop/product/[id].tsx: preview, qty stepper, Add-to-cart (own) or
Buy-on-<Network> deep link (affiliate + commission note), related rail.
app/shop/search.tsx: debounced search, category suggestions, trending.
quick-access.ts: +Shop shortcut, DEFAULT_QUICK starts with shop, QUICK_MAX 7,
storage key v4 (one-time reset so installs pick it up).
PENDING NEXT TURN: generate 5 missing renders (rehal + 4 affiliate shots) and
swap the provisional stand-ins in SHOP_IMAGES.

## PASS 79 — shop payments (Flutterwave) · all-shortcuts quick access · pay-in-app
**Payments answer for the user:** web already used the inline Flutterwave modal
(in-page); NATIVE used the system browser — now opens the IN-APP browser
(expo-web-browser openAuthSessionAsync: Custom Tabs / SFSafariViewController)
with Linking fallback, and verifies immediately on return.
- API: payments purpose ENUM + 'shop' (3 sites); init_shop.php (order-based,
  country FX like premium, auth-before-csrf, records shop_orders.pay_tx_ref);
  verify.php 'shop' branch marks the order paid. shop_ensure adds pay_tx_ref.
- Client: shopPayInit + payShopOrder; order-placed sheet shows
  "Pay $X with Flutterwave" (live only) → verified → paid copy; graceful msg
  when unconfigured/cancelled. Orders list already renders paid/pending chip.
**Quick access (user request):** home rail now lists ALL 20 shortcuts
(scrollable). Storage v5 {order,hidden}; parseQuickPrefs accepts legacy arrays.
Editor = remove(hide)/rearrange only — no more max-6 picker. QUICK_MAX→20.
**Shop art:** remaining 5 renders generated (rehal + 4 affiliate); SHOP_IMAGES
now maps every product to its dedicated image.
**Live diagnosis this pass:** live served entry-f2b33f98 = PASS 73 build —
that's why replying-to + profile-message "bugs" persisted; both fixed in 74/77
and verified via probes on the current build (probe-msg: chat opens; the
pass-74 auto-start effect is intact). User must re-pull (fetch + reset --hard).
Gates: harness79 10/10 · repro79 9/9 (all-shortcuts rail, hide/restore, pay
button graceful, profile-message guard) · repro78 16/16 · harness 73-78 green · tsc 0.

NEXT: admin dashboard audit → iOS/Android store builds.

## Pass 80 — DeenPoints offers · check-in chip fix · local currency · guest mode
- DeenPoints screen: hero banner art, OFFERS (7-day streak +20 · bulk 2500+ +10% ·
  learn&earn), EARN MORE grid routing to the modules, bulk-bonus hint on 2500+.
- Check-in chip bug FIXED: profile chip read the stale auth snapshot; now reads
  the DeenPoints hook. E2E: 100 → tap Check In → 105 (repro80).
- Server offers: daily_checkin.php streak bonus (+20 every 7th consecutive day,
  atomic, ledger+notif) · init_deenpoints.php bulk +10% (charged plain price,
  bonus stored in points column/meta; verify credits it) · award.php quiz 5→10,
  learn 2→20 (markGoal wiring already existed; gated by daily rotation).
- Currency: GET /api/payments/fx_quote.php (user country → Flutterwave ccy, USD
  fallback; live rates cached) + lib/currency.ts useCurrency/fmt — every shop
  price (grid, search, detail, cart, orders, pay buttons) renders local ccy.
  Premium + DeenPoints quotes were already country-aware server-side.
- Guest mode: login Skip → lib/guest.ts flag; (tabs) layout + index let guests
  through; 18 non-tools screens wrapped in LoginRequired popup (Log in/Cancel);
  FeedCard like/comment → guestBlock popup → login. Any login clears the flag.
- Gates: tsc 0 · repro80 14/14 · server: streak day7 +25/bal 155, repeat 0 ·
  bulk 3000→3300pts meta+300 charged ₦4500 · quiz +10 idempotent, learn +20 ·
  fx_quote NGN 1323.32 GHS 11.36 fallback USD.

## Pass 81 — chat/profile fixes · guest hardening · API architecture fix · security
- Message → chat: thread opens directly (?u= flow verified E2E incl. send).
- Inbox: no demo/dummy threads when live (SEED purged); back/X button leaves
  the screen (onClose was a no-op); send button has aria-label.
- Public profile: no "couldn't find" flash (liveLoading guard); Block/Report
  moved OUT of the action row into a top-right ⋮ dropdown.
- Guest: flag read synchronously (no content flash); LoginRequired is an
  opaque absolute overlay; profile tab shows a "Not signed in — tap to sign
  in" prompt in the My-Posts space instead of the popup; guest root → Tools.
- **ARCHITECTURE FIX**: app.deenlink.org is static hosting — same-origin /api
  returned HTML, so the live app silently ran on demo data. client BASE now
  always targets https://deenlink.org (env override for sandbox); CORS on the
  API allowlists https://app.deenlink.org; cookie is host-scoped + same-site.
  Live requires the cPanel API pull for CORS + pass-80/81 endpoints.
- gh-pages: CNAME + .nojekyll restored (rsync --delete had removed them —
  site was dead); old chunks kept so cached clients don't white-screen.
  NEVER rsync --delete gh-pages again.
- Security: dead auth duplicates deleted (logiin/registerr/register_scholarr
  with unvalidated uploads/resend_verificationn); Linking.openURL wrapped in
  safeOpenUrl (http/https/mailto/tel only); qibla webview name sanitization
  hardened. Audited clean: prepared statements, JSON-only output, CORS
  allowlist, bcrypt, lockouts, session regen, httponly/samesite cookies,
  MIME-allowlisted randomized-name uploads, no hardcoded secrets.
- Gates: tsc 0 · repro80 14/14 · repro81 10/10 · chat send E2E verified.

## Pass 81b — live topology corrections (post user-pull diagnosis)
- Live DNS: app.deenlink.org → cPanel (102.209.117.119), whose docroot serves
  BOTH the PWA and a working /api (verified: fx_quote JSON + CORS header live).
  The API pull landed fully (63f59cb). Only the PWA files were stale.
- BASE reverted to same-origin on the app domain (main deenlink.org API
  checkout is older; app subdomain API is current). CRITICAL: the window
  check must lead the ternary — leading with process.env lets the minifier
  constant-fold BASE to deenlink.org at build time (caught via bundle grep).
- CommunityInbox: persisted threads (dl.inbox.v2) could resurrect demo rows
  from older sessions — filtered against SEED_NAMES on restore when live.
- Sandbox: port-80 replica now runs PHP_CLI_SERVER_WORKERS=8 (single worker
  dropped connections under E2E load).
- Gates: tsc 0 · repro80 14/14 · repro81 10/10.
