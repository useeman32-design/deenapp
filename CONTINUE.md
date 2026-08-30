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
