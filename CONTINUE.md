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

## Not yet done / next
- REAL Grok test with a live xai- key (streaming + web search) — blocked on user's key.
- Recite Mode on native needs a native speech module (expo-speech-recognition) if we ship apps.
- User's local iOS bundling: tell them `git pull && npm install` (or `node scripts/unpack-content.mjs`).
- Loop counter badge on the mini bar (shows armed state only via gold icon for now).
