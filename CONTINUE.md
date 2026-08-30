### Pass 28 (user's 8-item list) — SHIPPED
Commit after `f31b6c3`. diag28 **16/16** (fonts/stable-URLs, listen STOP toggle, mic auto-restart across session ends — mushaf + reciter, RESET, offline banner, comments 85% + live drag + gif-in-bar, AI ayah cards + no raw markdown).

- **Fonts**: the "same font everywhere" recurrence = stale cached bundle → hashed font URLs 404 after each force-push deploy. Fix: `public/fonts/*.ttf` (STABLE names) + injected `@font-face` rules in `_layout.tsx` for the exact 7 family names (base path derived from `/deenapp` prefix, font-display swap). Hashed expo assets can now 404 harmlessly.
- **reciteEngine**: `keepAlive` ref — `onend` RESTARTS recognition after 260ms while the user is listening (iOS Safari ignores `continuous`; this was the "I keep reciting but nothing detects" bug — sessions died after each pause). `no-speech/aborted` transient, `not-allowed`/`network` surfaced. `reset()` = stop + idx 0 + clear. Restart loop verified E2E with a stub that ends the session after EVERY word.
- **Listen (ReciteMode)**: `listenOn` = audio playing/loading on THIS ayah → button becomes red STOP, tap = `audio.stop()`. Listen plays ONLY that ayah (`playToEnd` now honors `single` mid-surah — it used to roll seamlessly into the next verse); with AUTO-NEXT on, Listen uses `playSurah` (continuous by design).
- **src/lib/net.tsx**: `netBus` (ref-counted slow reporters + online/offline events) + `<NetPill/>` mounted in root layout — "Slow network… still loading" after 1.2s persistent load, red "Network error — check your internet connection" while offline. Wired: QuranAudioContext loading probe, VideoLoader, AI stream (>4s).
- **VideoLoader.tsx**: expo-video status poll → spinner pill overlay + netBus; on reels (`videos.tsx`) + FeedCard inline & expanded.
- **CommentsModal**: default 85% viewport (H_MIN 50 / H_MID 70 / H_TALL 85 / H_MAX 94, snap on release). Sheet's old `flex:1` fought `height` (both flex-split with the backdrop → stuck at 50%) — removed. Drag = REAL DOM pointer listeners via callback ref (`bindHandle`) because this RN-web maps NEITHER PanResponder NOR onPointerDown props reliably; RN responder kept as native fallback. GIFs chip removed from the emoji row; small photo-video icon INSIDE the input bar toggles the picker.
- **searchQuranCorpus**: substring-only search starved natural questions ("a verse about patience" never appears verbatim) — added token ranking (≥2 token-weight score) after exact matches. Fixes AI retrieval AND typed search.
- **AI**: `retrieveLocal(' ')` warm-up on mount (first message used to pay the whole 114-surah + books load); `AnswerText` renderer (headings → bold colored titles, bullets/numbers with gold markers, **bold**/_italic_, [refs], NO raw `##`/`**` ever rendered); `VerseCards` — up to 3 `[Quran S:A]` refs → Amiri Arabic + translation + tap-to-open card from OUR dataset; SYSTEM_PROMPT updated (bold labels not headings, always include Arabic for quoted ayat).
- **Diag gotchas**: headless-shell NOW ships a native SpeechRecognition that never emits — stubs must OVERRIDE unconditionally; the reader has TWO Recite buttons (ayah card + player bar whole-surah) — pick by y-range; `center()` must not clamp y≥60 (top-bar buttons sit at y≈26); drag tests must exceed the snap zone (240px) else the sheet snaps back to H_TALL.

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
