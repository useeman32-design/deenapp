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
