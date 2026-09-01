# CONTINUE — pass 34 handoff (2026-08-31)

## Pass 34d — FRESH-CLONE npm install FIXED (master 1f972bb, gh-pages 53c1480)
User hit: `npm install` → postinstall unpack-content.mjs → "assets/content.zip
not found". Root cause: the ENTIRE assets/content tree is gitignored (the
`content/` .gitignore pattern matches at any depth) and content.zip was
deleted in pass 33 → fresh clones have NO content pack at all (no quran txt,
no hadith gz, no islamic packs) → Metro would fail next.
Fix:
- content pack (147 files, 17.2MB zip) hosted at STABLE URL
  https://useeman32-design.github.io/deenapp/content/content.zip
  (pushed to gh-pages /content/ — survives every deploy: deploys are
  non-destructive adds; local public/ NOT used, so snapshot stays lean).
- unpack-content.mjs rewritten: MARKERS check (quran surah_1+surah_114,
  buhari+nawawi40+meta gz, dua, seera) → exit 0 if pack present; else
  download PACK_URL (env DL_CONTENT_URL overridable, Node18+ fetch) to
  assets/content.zip (now gitignored) → existing unzip.
- TESTED fresh-clone simulation: download+extract 147 files, md5 identical
  to sandbox originals, second run exits 0 fast.
- gh-pages CDN lags a few minutes after push (404→200); raw.githubusercontent
  verifies branch HEAD immediately.

## Pass 34c — NATIVE MIC (master 74592e3, gh-pages a55dd60, probe35 ALL PASS)
User: mic features are VERY important. Why they die in Expo Go: speech.ts
used the browser Web Speech API; Expo Go is a fixed native binary with no
speech engine and no way to add one. Fix = expo-speech-recognition
(v57.0.0, matches SDK 57) — REAL on-device engine, but only in compiled
builds (dev client / APK / IPA), never inside Expo Go.
- speech.ts: `nativeSpeechProbe()` LAZY `require('expo-speech-recognition')`
  in try/catch — NEVER a top-level import (requireNativeModule throws at
  import time inside Expo Go). If present → `new ExpoWebSpeechRecognition()`
  is a DROP-IN Web-Speech-shaped object, so dictateArabic / reciteEngine /
  ContentSearchOverlay / ReciteSearchModal all work unchanged.
- `ensureMicPermission()` — requestPermissionsAsync up-front (getRecognition
  fires it; dictateArabic awaits it, rejects MIC_NOT_ALLOWED when denied).
- reciteEngine permission-denied copy: "device settings" not "browser".
- app.json plugin: expo-speech-recognition w/ microphonePermission +
  speechRecognitionPermission strings. eas.json ADDED (development =
  dev-client APK+simulator, preview/production = APK).
- Verified: android .hbc bundles clean, tsc clean, web probe35 19/19.
- On phone: Expo Go → typed fallback (expected); **dev build or APK → full
  mic**: Quran Shazam, recite-to-search, Recite Mode scoring.

## Pass 34b — EXPO GO SUPPORT (master 722c2dc, gh-pages d58f659, probe35 ALL PASS)
User wants to run the app on a phone via Expo Go. Native audit + fixes:
- **content.ts loadJSON native branch**: Hermes has no fetch(file://) nor
  DecompressionStream → `Asset.fromModule → downloadAsync → new File(
  localUri sans file://).arrayBuffer() → pako.ungzip (hadith .gz) /
  utf8Decode → JSON.parse`. Web path byte-identical.
- **NEW src/lib/gzio.ts** — shared: `utf8Decode` (TextDecoder w/ manual
  fallback), `gunzipBytes` (pako), `publicBase()` (web: /deenapp pathname;
  native: `http://${Constants.expoConfig.hostUri}` — Metro serves public/),
  `fetchGzText(path)` (DecompressionStream web / pako native).
- translations.ts + hadithNum.ts + ai.ts (islamqa corpus) + prophets.tsx now
  load via gzio → work in Expo Go (translations/hadith-num/prophets/adhan/
  islamqa all live in public/, served by the dev server).
- **pako ^3.0.1 + expo-asset ~57.0.15** added via `npx expo install`.
- **adhanPlayer.ts**: native playback via expo-video `createVideoPlayer`
  (mp3 audio through headless player, loop, release on stop) — web unchanged.
- **savedPosts.ts**: persists via AsyncStorage on native (was in-memory).
- **ReciteSearchModal**: `speechSupported()` gate → type-it TextInput
  fallback ("FIND THE VERSE") — native has no Web Speech (Quran Shazam +
  recite-search become typed search there; no crash, no dead mic).
- Already native-safe: storage.ts (AsyncStorage), fonts (expo-font
  useAppFonts in lib/fonts.ts), audio (expo-video), Qibla/GlobeMap/videos
  Platform-guarded, net/ai window-guards.
- **Verified: `npx expo export --platform android AND ios` both bundle
  clean** (5.4MB .hbc). Expo SDK ~57.0.16 / RN 0.86.2 / React 19.2.3 — needs
  a CURRENT Expo Go.
- GitHub Pages CDN staleness AGAIN (raw + pages both lag one deploy; old
  hashed entries keep working since deploys are non-destructive). Branch
  HEAD is the truth: check `api.github.com/.../commits/<sha>` file list,
  NOT raw (raw also caches ~5min, and don't grep only the first 2KB of
  index.html — the entry tag sits at the END).

### How the user runs it (Expo Go)
git pull → npm install → npx expo start → scan QR with Expo Go (same Wi-Fi).
First hadith/Quran open downloads + ungzips assets on device (few seconds).

---

## Pass 34 shipped (master 129e0d2, gh-pages 3b61bf9, probe35 ALL PASS)
1. "Unmatched Route" → catch-all `src/app/[...unmatched].tsx` (spinner 350ms →
   `router.replace('/(tabs)')`). Root cause was stale cached bundles; deploys
   stay non-destructive. NOTE: tab routes have NO /() URL form — '/community'
   etc. now fall into the catch-all → home (graceful, expected).
2. Qibla compass: free FontAwesome5 `kaaba` (size 15) in a 38px ring replaces
   the photo circle (src/components/Compass.tsx).
3. Splash GIFs recompressed (dark 775KB / light 716KB, 29 frames, 480w,
   120-color ADAPTIVE) + SplashGate now a CENTERED rounded card
   `min(W*0.78, 330)` 16:9 instead of full-bleed cover.
4. Hadith: search scans ALL books in parallel (Promise.all, 8/book cap 60
   total, canonical nums + chapter names in hit titles, ?h=N deep links);
   translation moved to a HEADER button (aria 'translation language',
   cycles EN→FR→BN→UR, nawawi40 added to hadithTr EXT_BOOK); share refs
   include chapter name; arabic chapter names fontSize 18.
5. Quran Shazam: mic card on quran hub → Web Speech (hears ANY nearby audio
   incl. other phones) → transcript auto-runs corpus fuzzy search via
   /surah?q= → ContentSearchOverlay prefilled.
6. Mirath redesigned (hero, heir cards w/ person-count steppers, share bars
   + %, distributed total).
7. Donations REBUILT (charity.tsx): CATS order DeenLink → **ZAKAT SECOND** →
   Sadaqah (user explicit; probe asserts t.indexOf('Zakat')<t.indexOf('Sadaqah'));
   asnaf recipient chips (9:60 for zakat), currency chips, simulated pay 1.6s,
   receipt card + share, history + report flag, FEE_PCT=5 visible on receipts,
   DeenLink card shows Quran 2:261 + Muslim 1631. Storage `dl.donations.v1`.
8. Ask Scholars REBUILT (scholars.tsx): Browse (search+field filter) / My
   Questions (processing→answered ~9s sim) / Public (2 seeded + user's
   answered-public); ask sheet w/ title/question/category/urgency DeenPoints
   entry+balance/public-private toggle/photo attach; DeenPoints NEVER buys
   fatwas — clarification card pinned at bottom. Storage
   `dl.scholars.questions.v1`, `dl.deenpoints` default 1250.
9. Groups (facebook-style) rail in community tab: create (open/by-request,
   cat Mosque/School/Organization/Community), join/request, post in group
   page. src/components/Groups.tsx, storage `dl.groups.v1`, 3 seeds.
10. Reciters +4 (QuranAudioContext): Sudais/Shuraim/Ayyub via everyayah
    (`everyayah.com/data/{folder}/{SSS}{AAA}.mp3`, folders
    Abdurrahmaan_As-Sudais_192kbps / Saood_ash-Shuraym_128kbps /
    Muhammad_Ayyoub_128kbps), Maher = islamic.network `ar.mahermuaiqly`.
    "Muhammad Divirov" NOT FOUND anywhere (told user). Monogram avatars
    (PIL gold initials on emerald) in assets/img/reciters/.
11. Onboarding theme slide → pro phone-preview mockups (Dark/Light cards +
    "Match my phone's setting").

### Pass 34 gotchas
- pages-server :3996 must run as `node scripts/pages-server.mjs dist/deenapp
  3996 /deenapp` (root=dist/deenapp; export-web now also writes
  dist/deenapp/404.html). `pkill -f pages-server` can kill your own shell —
  use the stop_process/start_process tools.
- probe ensureAuth v2 (probe35): loop ≤14 — login ('Welcome back!' → tap last
  'Sign In' at y+16) OR onboarding (tap Get Started/Next/Skip) else break;
  after auth the app lands on HOME tab, so re-`goto` real routes
  ('/tools/charity' etc.) or tap the tab bar ('Quran &'+'Hadith' stacked
  labels are TWO spans — tap the LARGEST y>720 'Quran…' node). Fresh-page ≠
  fresh-state (localStorage is per-context): onboarding tests need
  browser.newContext().
- Live CDN can serve a STALE index.html (pointed at old entry-ee95…) right
  after push while the branch HEAD correctly references entry-608c…; old
  hashed files kept working because deploys are non-destructive. Verified:
  entry-608c 200, splash gifs 200 (794KB/734KB at assets/assets/img/…hash.gif),
  adhan/adhan{1,2,3}.mp3 200, all 4 reciter ids in the live bundle.
- Remote is useeman32-design/deenapp (sandbox wipes .git/config → re-set
  identity deenapp-bot <bot@deenlink.org> + remote from .token).
- Snapshot-relevant total ≈113M (git 34 + assets 39 + chromium-libs 19 + rest)
  — still under the ~128M cap. node_modules vanished again this pass.

---

## ROOT CAUSE OF THE "WIPES": workspace exceeded the ~128MB snapshot cap
(.git 81M + assets 126M + public + uploads ≈ 250M) → turn-end snapshots FAILED
→ sandbox kept restoring an old pass-20 state. FIXED this pass:
- .git → shallow depth-1 (43M), gh-pages ref dropped locally
- assets/content/hadith/*.txt → .txt.gz (87M → 16M; DecompressionStream in
  content.ts; NATIVE/APK NEEDS a gunzip step (pako) before .txt.gz works there)
- assets/content.zip (17M) deleted — rebuild the pack via unpack-content.mjs
  with DL_CONTENT_ZIP if ever needed
- uploads/ cleaned. NEVER let the workspace drift over ~120M again.

## Pass 33 shipped
1. Misbaha glow RE-TRACED from the render: real shape is an OVAL loop —
   BEAD_PATH 33 pts in tasbeeh.tsx (was arms+ellipse = wrong).
2. Onboarding slide 4: theme picker (System/Dark/Light, aria 'theme X').
3. Hadith canonical numbers: public/hadith-num/<book>.json maps (233KB,
   generated by text-matching vs AhmedBaset/hadith-json v1.2.0 — 100% match,
   0 fallbacks). [book].tsx shows 'Hadith N' (canonical = sunnah.com number),
   jump ?h=N uses the map, share refs include it. 'unknown' grade labels
   REMOVED (all 55k grades were literally "unknown").
4. lib/ai.ts BUGFIX: retrieval asked loadBook('bukhari') but pack id is
   'buhari' → on-device answers never cited Bukhari. Fixed + canonical nums.
5. AI speed: greeting fast-path (isGreeting → instant reply, no corpus load),
   retrieveLocal returns [] when no content tokens, blocks run in PARALLEL,
   pass-28 corpus prewarm REMOVED (it fetched ~60MB on screen open).
6. Prayer: timeline list w/ NOW (gold current) + NEXT chips, arabic names,
   ADHAN — plays public/adhan/adhan{1,2,3}.mp3 (neutral labels) when a time
   enters while app is open, banner w/ Stop, voice picker in settings.
7. Qibla: Leaflet (unpkg, injected at runtime, no webview) with
   great-circle line you→Kaaba; offline equirect map kept; compass needles
   now START AT THE CENTER DOT (front gold + dashed back).
8. Splash GIFs replaced with the USER'S renders (1BC19BFB=dark luma18,
   D0BD78D2=light luma232); old gif+mp4 files deleted.
9. Mushaf swipe flipped to proper RTL (swipe RIGHT = next page).
10. gh-pages deploys now NON-DESTRUCTIVE (commit on top) so cached HTMLs
    keep their hashed JS (the likely 'Unmatched Route' cause).

### WIPE-RECOVERY GOTCHAS (pass 33 final)
- A MID-TURN snapshot restore can silently revert .git (deep 121M again, stale
  refs), node_modules, /tmp AND the git remote. Recovery: re-add remote →
  fetch → `git reset origin/master` → re-commit the (still-correct) tree → push.
  Then ALWAYS re-trim: `git fetch --depth 1 origin master && git update-ref -d
  refs/remotes/origin/gh-pages && git reflog expire --expire=now --all && git gc --prune=now`.
- Keep snapshot-relevant total (everything except node_modules/dist/.cache/.npm)
  under ~128M: currently ≈110M (git 32 + assets 43 + public 15 + chromium-libs 19).
- Final live check done: entry-ee9586e…js + translations/*.json.gz + hadith-num
  + adhan mp3s all 200. master=da39c70, gh-pages=390a0e9 (non-destructive).

## Pass 33b — TRANSLATIONS (user decision)
- Quran: Hausa+English were already in the pack. ADDED public/translations/
  {yo,fr,bn,ur}.json.gz (~320KB each, 6236 verses "s:a"→text; yo = quran.com
  res 125 Abu Rahimah Aykyuni, fr = Hamidullah, bn = Bengali, ur = Jalandhry).
  Reader chip cycles EN→HA→YO→FR→BN→UR (src/lib/translations.ts, DecompressionStream).
  NO Igbo Quran exists; Hausa x2 + Yoruba are the only Nigerian ones.
- Hadith: NO Nigerian-language dataset exists anywhere (searched) — told user.
  Added FR/BN/UR per-hadith CDN translations (src/lib/hadithTr.ts — fawazahmed0
  jsDelivr, ZERO bundle size) for buhari/muslim/abudawud/tirmidhi/nasai/ibnmajah/malik
  via chips above the hadith list; fetched by canonical number.
- probe34 4/4. NOTE: /tmp + node_modules + .cache can VANISH MID-TURN (snapshot
  restore) — if tsc/chromium/'/tmp/daily29.json' 404, reinstall/regenerate:
  `npm install` · `npx playwright-core install chromium-headless-shell` ·
  regenerate fixture from src/lib/daily.ts (see scripts pattern in bash history).

## Tests: probe32 12/12 · probe33 14/14 (new) · diag29 24/24
## Quran already ships FULL Hausa (6236/6236) + English in the pack.
## Hadith translations available (fawazahmed0): French 9/10 books, Bengali 8,
## Turkish 8, Urdu 7, Indonesian 7, Russian 3, Tamil 2. NO Hausa hadith exists.


### Pass-27b (same day, follow-up)
User feedback fix, commit after `fc4b097`. **MushafPage inline recite v2**: recite mode NO LONGER re-renders the current ayah as WordChips (that re-wrapped the line flow). Now the SAME justified `<Text>` renders one colour `<Text>` span per word — layout byte-identical (diag asserts innerText of `[aria-label="mushaf page content"]` is UNCHANGED across normal → recite → blind → closed). Colours: unrecited = faint accent, ok = full text colour, wrong = #E05252, next-word gold cursor #C9A227 (non-blind only), blind hidden = `transparent` (keeps exact width → ayah numbers ﴿﴾ stay at their exact positions, nothing collides). Blind ALSO hides surah-name pill text + basmallah strip (frames stay to hold layout). Word-tap (ok/wrong words) → speakWord wbw audio. Banner row `paddingLeft: 40` clears the settings gear (top-left x7–37). diag27 now 20/20 (chip/gear box check, arrangement-equality checks, blind transparent-word count, numbers-visible count).
**Sandbox-reset git hazard**: resets can restore a STALE `.git` (pass-20 base) under a CURRENT working tree — `git status` then shows dozens of files and push is rejected (non-fast-forward). Fix: `git fetch origin && git reset --mixed origin/master` (rewrites HEAD+index only, keeps the correct worktree), then commit the real diff. Never `checkout -B` over it (aborts/overwrites).

## Pass 27 — SHIPPED (2026-08-30)
Commit `dbf1c10` on master; gh-pages live entry `_expo/static/js/web/entry-9250677358fe5e021c0da0a99b6053d7.js` (curl 200). diag27 **16/16**, engine unit tests **8/8** (`node scripts/engtest.mjs` after rebuilding `scripts/eng.mjs` via the esbuild alias line inside it).

**Shipped this pass**
- **src/lib/reciteEngine.ts (NEW)** — shared engine. `bare()` normalize+strip harakat; `keepMarks()` light normalize that PRESERVES harakat; `strictEq` (exact or 1 sub at equal length); `align(E,S,EM?,SM?)` → `{states,reached}` with wasl joins k=2..4, skip-ahead wrong-marking, split glue, corrections pass, and a **harakat post-pass**: `marksConflict` flags vowel slips (aamanu→aaminu, kafaru→kufiru) when the transcript carries ≥2 marks/word; final-letter marks ignored (i'rab tolerance); unmarked transcripts stay lenient. `itemWords()` strips basmallah from ayah 1 (surah≠1). `speakWord()` → audio.qurancdn.com/wbw/{sss}_{aaa}_{www}.mp3 (1-based, pad3) → ar-SA TTS → ayah-audio fallback. `useReciteTracker(items,{autoNext})`: realign on EVERY onresult **via `realignRef.current()`** (fixes the stale-closure bug — autoNext-advanced ayahs align against their own words), bare+marked arrays built LOCKSTEP (filter both or neither), settle() marks unspoken wrong, mic auto-stops 250ms after completion, autoNext advances 900ms after PERFECT only.
- **ReciteMode.tsx rebuilt on the engine** — AUTO-NEXT toggle chip (default on for mode='surah'), WordChip (320ms Animated; `masked`, `colorBase`, `faint`, `onPress` props) exported for reuse, verdict card, single-ayah Listen, reset.
- **MushafPage.tsx** — page card borderless full-bleed; RECITE opens **inline** banner (mic/STOP, BLIND toggle, progress bar, idx/total, PERFECT/n-WRONG chip, ×) — the mushaf text itself becomes chips for the current ayah while other ayahs stay shaded in place; blind mode masks unreached words (ayah numbers remain); word-tap → speakWord (wbw CDN). The RECITE pill HIDES while the banner is open (its oversized hit area covered the × — found via elementFromPoint).
- **ReciteSearchModal** — mic static GOLD + 'Tap the mic…' until tapped → GREEN + pulse rings + 'Listening…'. (diag27 injects a FakeSR stub via ctx.addInitScript because headless lacks SpeechRecognition — the chip itself is gated on speechOk.)
- **quranSearch.ts findAyahFuzzy rewritten** — hybrid score 0.34 token-coverage + 0.33 ordered-LCS + 0.33 char-trigram jaccard, `stripBasm` on BOTH query and ayah-1 candidates (kills the basmallah flood that drowned Ikhlas). Battery 5/5 incl. basmallah-prefixed queries.
- **ai.tsx** — `ThinkingDots` (3 staggered bouncing dots, 160ms offsets) replaces the ActivityIndicator; suggestions/inbox icons back to book-open.
- **Icons** — bottom tabs keep ORIGINAL `quran` + `mosque` (FA5Free glyphmap-verified). Icon archaeology: 38545d7 = pass-25 handoff, **cae485d = pass-26a deliberate icon sweep** (the live pre-pass-27 state), so HEAD — not 38545d7 — is the correct restore baseline; hadith.ts/seerah.ts/duaSections.ts/surah.tsx/calendar.tsx/index.tsx restored from HEAD after the greedy pass-27 sweep.

**Gotchas**
- Sandbox resets wipe `.git/config` (identity + remote): re-set `git config user.name/email` (deenapp-bot <bot@deenlink.org>) and re-add origin from `.token` at repo root (token never committed).
- NEVER blanket-replace icon names; enumerate sites + assert anchors.
- gh-pages entry JS lives at `_expo/static/js/web/entry-*.js` — verify with the full path, not just the filename.
- engtest: rebuild `scripts/eng.mjs` with `npx esbuild src/lib/reciteEngine.ts --bundle --format=esm --platform=browser --alias:react-native=./scripts/rnStub.js --alias:@/lib/quranSearch=./scripts/engDepsStub.ts --alias:@/lib/speech=./scripts/engDepsStub.ts --outfile=scripts/eng.mjs` (rnStub/engDepsStub are in scripts/).

# DeenLink — Pass-24 handoff (deployed)

Live: https://useeman32-design.github.io/deenapp — entry-0aa1fb4404cd085f06cc3fce84613a9c.js
master @ d7313ce · diag24 **14/14 green** (scripts/diag24.mjs)

## SECURITY (read first)
- The user pasted what they thought was a Grok key — it was the GITHUB DEPLOY TOKEN (ghp_…, matches .token). It is exposed in chat → user will revoke it. **When revoked, pushes fail: ask user for a fresh PAT (repo contents:write) and write it to /home/user/deenapp/.token (no newline issues).**
- Real Grok keys look like `xai-…` (console.x.ai). The AI page stores the key in localStorage (dl.ai.key.v1) — user enters it in AI → Settings; NEVER hardcode/commit keys.

## Shipped this pass
1. **Local-dev fix**: content.zip restored to git (I deleted it pass-23, breaking fresh clones — "Unable to resolve assets/content/quran/surah_1.txt"). unpack-content.mjs rewritten PURE NODE (no python — Windows-safe, minimal zip reader via zlib). package.json postinstall runs it → `git pull && npm install` just works.
2. **DeenLink AI rewrite** (src/app/tools/ai.tsx + src/lib/ai.ts): full chat UI, persistent chat history (dl.ai.chats.v2, 40 chats × 60 msgs), history sheet (reopen/delete/clear), settings sheet (key + model picker + web-search default), streaming SSE from api.x.ai/v1/chat/completions (models grok-4-fast-reasoning/grok-4/grok-3-mini, search_parameters mode:auto → [web] citations), RAG over OUR datasets (surah-name hits + corpus keyword + bukhari/muslim/abudawud + duas + 99 names + quiz) with clickable source chips, on-device fallback answers when no key, category prompt cards, typing/thinking phases.
3. **Recite-to-find**: mic in ContentSearchOverlay (dictateArabic, ar-SA, Web Speech API) + fuzzy Arabic matcher in quranSearch.ts (findAyahFuzzy: diacritic-stripped normalization + ordered LCS + tolerant word compare, "% match" results) — typed arabic hits the same path.
4. **Memorization loop**: LoopCfg in QuranAudioContext (surah-scoped, from/to range, perAyah ×N/∞, cycles ×N/∞; player.replay() + domEnsurePlay for same-ayah, uri-change reload for range jumps; auto-clears on other-surah play/stop). Reader repeat button (gold when armed) → sheet with steppers/chips.
5. **Recite Mode** (components/ReciteMode.tsx): full-screen mic overlay per ayah (reader "Recite" action + player-bar mic). Words reveal as recited (normalized token alignment, skip-detection marks the skipped word red), red underline + red word on mismatch, Listen/Retry/Next, end-of-ayah score card, tap-to-reveal practice fallback where SpeechRecognition is unsupported (iOS Safari 14.5+ has it; headless chrome has a stub).

## Key knowledge
- RNW multiline TextInput renders <textarea> — playwright selectors must be tag-agnostic (`[placeholder=…]`).
- React #418 hydration pageerror fires app-wide on most loads — benign (React recovers); don't chase it.
- Diag taps: reader buttons may live below the fold — pick elements with getBoundingClientRect inside viewport + scrollIntoView before tapping. Modal close = aria-labels ('close recite mode', 'AI settings', etc).
- pages-server defaults: root dist, prefix /deenapp. Stale server holds :3996 → fuser -k 3996/tcp.
- Sandbox resets: git fetch+reset --hard FETCH_HEAD, npm install (now also unpacks content!), npx playwright-core install chromium-headless-shell.
- Speech: getRecognition/dictateArabic in src/lib/speech.ts; continuous mode leaks if you forget abort() on unmount.

## Pass-24b update — GROQ is the live provider (diag24 18/18 incl. live tests)
- User supplied a GROQ key (gsk_…, kept ONLY in /tmp/groq.key for diag — never in repo; they will revoke it). ai.ts is now multi-provider: detectProvider() by key prefix → PROVIDERS.groq (api.groq.com/openai/v1) | PROVIDERS.xai. Groq models: openai/gpt-oss-120b (default, reasoning_effort low), gpt-oss-20b, qwen/qwen3.8-27b — verified via /v1/models.
- gpt-oss streams chain-of-thought in delta.reasoning → shown as faint "Thinking…" italic + "reasoned Ns" badge (thinkMs>800). Answer = delta.content only.
- Web search = groq/compound (streams its agentic <think>/<tool> blocks as content): cleanAI() strips them, "🔎 researching the web…" state while open. Compound non-stream 400s on free tier ("request_too_large") but STREAMS fine. If compound errors → auto-retry chosen model offline + "⚠️ Web search was unavailable" note. Empty 200-stream (rate-limit artifact) → honest note + library fallback, never a blank bubble.
- Free-tier TPM limits (30k/min) → 429s during heavy diag runs; app surfaces them honestly. Live verified: Yā-Sīn answer streamed; gold-price compound answer with real numbers.
- diag24 section 8 (LIVE) auto-skips when /tmp/groq.key is absent.
- Recite Mode on native needs a native speech module (expo-speech-recognition) if we ship apps.
- User's local iOS bundling: tell them `git pull && npm install` (or `node scripts/unpack-content.mjs`).
- Loop counter badge on the mini bar (shows armed state only via gold icon for now).


# Pass-25 handoff (deployed) — diag25 19/19
Live entry-d0b3e869f6d93aeb7208c25faa0c7979.js · master @ scratch-cleanup after 1f5d0a1

## Shipped
- **Mushaf multi-surah fix**: the old `flex:0` segments rendered ZERO-height → all surah blocks overlapped at the page top (the "merging/unreadable" on pages 602-604). Now: content ALWAYS in a ScrollView, segments auto-height with marginTop 14 separation; basmallah strip is diacritic-insensitive (API harakat differ from our constant). Every surah on a page keeps its name pill + basmallah (never surah 1/9).
- **Loop v2**: per-ayah ∞ replaced by CUSTOM numeric input (placeholder 'custom', 1-100); range cycles keep ∞. Icon repeat→sync-alt (FA5 Pro icons render as '?' — also swapped kaaba/quran/mosque → star-and-crescent/book-open globally). Active loop = gold icon + width-badge "7×" in the player bar.
- **Recite v2** (components/ReciteMode.tsx): items-based `ReciteItem[] {surah, ayah, arabic, label}` — reader per-ayah (mode ayah), player-bar mic = whole surah following (mode surah), mushaf page has top-right RECITE pill = follow the whole PAGE across surahs. WASL tolerance (joined words match 2-4 word runs; carry-buffer for split words), realtime interim cursor (gold current word; reds only from finals), BLIND mode (eye toggle — text masked until ayah completes), tap red/ok word → speakWord() Arabic TTS (speechSynthesis ar-SA, rate .75) w/ ayah-audio fallback. word-audio hosts (words.audios.quran.com etc) unreachable — TTS chosen instead.
- **Recite-search prominence**: surah.tsx + hadith.tsx got big green/gold 'Search or recite' buttons; ContentSearchOverlay mic now shows a large gold live-transcript panel (Arabic, right-aligned) while listening.
- **AI redesign**: glassy bubbles/header (rgba bg + hairline borders), hamburger top-left → Animated left drawer (history: open/delete/clear + New chat), RichText bolds+links `[Quran 2:255]`/`[Bukhari · …]`/`[Dua · …]`/`[web]` (REF_RE; refRoute maps hadith names→book routes), NAV: prompt asks model to end with `NAV: /route` → big 'Open X' button (NAV_LABELS); on-device navAnswer() answers "where is…" without a key; on-device composeLocalAnswer now emits bracketed refs (tappable). Suggestions trimmed to 3 chips.

## Gotchas
- diag25 needs auth BEFORE checking text pages (ensureAuth after goto when session drops) — quran/surah needs corpus load time, poll ~8s.
- FA5 FREE only: repeat/kaaba/quran/mosque/hands/hadith/clock-rotate-left are Pro → '?' glyph. Use sync-alt, star-and-crescent, book-open, hands-helping, history.
- MushafPage always-ScrollView killed the onContentLayout/scrollable machinery (deleted).
- ReciteMode finishAyah ok-count uses states+1 (last word counted optimistically) — fine for UX.


# Pass-26 handoff (deployed) — diag26 11/11
- TAB ORDER ROOT CAUSE: expo-router sorts the quran/ FOLDER after file routes → state.routes order was [index, tools, community, profile, quran] and the custom bar mapped state.routes, so Quran & Hadith rendered LAST. Fix: bar maps TABS order (displayIdx); pos/pill animate by display index; onPress compares route index. Icons: Quran&Hadith=star-and-crescent, Worship Tools=compass (both FA5-free; quran/mosque/kaaba are Pro → '?'). Object-literal icon sweep hit hadith.ts/seerah.ts/duaSections.ts/calendar/surah filters too.
- Mushaf RECITE pill was mounting ReciteMode UNCONDITIONALLY (blocked the page) — now gated on recitePage state.
- ReciteMode v3: idempotent realignment (finals+interim rebuilt each event → align(E,S) recompute; the old incremental stepper double-counted interim tokens). align(): ordered scan (match/wasl-join 2-4/skip-ahead) → split pass (frontier word = two unused tokens glued) → correction pass (red word matching ANY unused token → ok). close() budget scales with word length (1/2/3). WordChip animates opacity/scale on state change; blind mode reveals words up to `reached` (masked ҉ until reached); gold live caption.
- ReciteSearchModal (new): glassy centre card, pulsing gold mic rings, live Amiri-Bold 24 transcript, then 'Analyzing your recitation…' dots 1.1s → onText → results. Mic off-screen bug: search bar row overflowed (x=437 on 390px) — fixed with minWidth:0 on container+input; mic detect post-mount (speechOk state) so it always renders.
- AI input: 16px system font (iOS no-zoom needs ≥16px), glassy bordered container that highlights when typing, clear ×, 46px send/web pills.
- LESSON: commit BEFORE `git reset --hard` after sandbox resets (lost a turn's edits once); the reset rolls the TREE too.
