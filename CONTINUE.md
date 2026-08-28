# DeenLink — Agent Handoff / Continue Instructions

Read this file FIRST if you are a new agent picking up this project. It is the single source of continuity.
Also in the workspace root: `/home/user/.session-memory.md` — chronological pass-by-pass log with extra test gotchas and exact hashes (older entries supersede in favor of this file if they conflict).
Workspace: `deenlink-app/` (this repo). Repo: `github.com/useeman32-design/deenapp` (NOT deenlink-app).
Web (GitHub Pages): https://useeman32-design.github.io/deenapp/ — live build = whatever is on branch `gh-pages`.
Native: users run via **Expo Go** (Expo SDK 57). Windows dev machine: `C:\Projects\deenapp`.

## Current state (last verified)
- master = pass 11 (`b44d246`). gh-pages = "Deploy pass 11" (117 files).
- **`FORCE_DEMO = true` in `src/api/client.ts`** — the app is MOCK-ONLY right now (user's request, "for now").
  Zero network calls; every endpoint resolves to bundled data (`src/api/mocks.ts`); signed-in user is always `MOCK_USER` (photo = asset `p1`).
  Flip the constant to `false` to go live against `https://deenlink.org` (PHP API; session-cookie + CSRF auth, already implemented in `client.ts`).
- Pass 11 also fixed: native crash in Community tab (HTML `<b>` tags in the ACTIVITY list — replaced with bold `<Text>`), and a shared
  `src/components/VideoModal.tsx` (web = YouTube iframe; native = player-style thumbnail preview + explicit "Watch on YouTube" button)
  wired into both Home and Community.

## User & working style
- Based in Badagry, Lagos (NG). Runs the native app on his phone via Expo Go (a standing constraint — no dev builds).
- Wants **short replies**, and **deliver → verify → deploy fast**. Do not over-explain; show results.
- Premium dark forest / emerald / gold aesthetic is non-negotiable. Light theme must also work (bottom nav, modals, comments sheet all theme-aware).
- Spec style: he sends numbered change lists ("passes"). Re-sent spec = "finish it now".

## Standing requirements (from all passes — still in force)
- 5 bottom tabs: Home, Quran, Community, Tools, Profile. (Community replaced old Learning; Community screen = search (posts + accounts), Trending chips, sticky **For you / Following / Scholars** tabs, FAB (+) → post composer with poll builder (2–4 options) + "Posting… just a moment" progress, recent activity list.)
- Home: Mecca hero image, prayer countdown, Qibla, **sun-path arc** (keeps moving past the last prayer — wrap formula in `(tabs)/index.tsx`: `sunT = nowMs <= end ? max(nowMs, fajr) : fajr + (nowMs - end)`; moon icon stays after sunset), campaign banners (field chip mandatory on posts), Daily Videos (header button "Watch more"), Daily Ayah/Hadith cards (premium, share → generated image card with logo + QR, 4 designs, dynamic height).
- Feed = Instagram-style `FeedCard` (`src/components/FeedCard.tsx`): double-tap heart burst on ALL post types, ••• menu = Report + "Not interested" (with report modal — no outer flag), image posts → tap opens full preview, polls with vote + % bars, scholar Q&A cards, hashtags, field chips.
- Comments = IG-style bottom sheet (`CommentsModal.tsx`): emoji row (IG-style), **no @handle prefill** when replying (only "Replying to X" chip), typed @mentions render **bold + emerald** in text, likes fill, nested replies, theme-aware.
- Public profile screen: `src/app/profile/[username].tsx` — photo, badges, fields of knowledge, Posts/Followers/Following/Charity stats, Follow + Share, Posts / Questions / About tabs, answered questions for scholars. Tapping any name/avatar/account opens it.
- All text inputs `fontSize: 16` (anti iOS auto-zoom) + `width: 0` where in a flex row (RNW input min-width pushes siblings off-screen).
- Haptics: `src/lib/haptics.ts` (expo-haptics, Platform-guarded no-op on web).
- Real community profile photos: `assets/img/profiles/p1..p7.jpg` (mocks reference them as asset ids; `profile_image_url` can be number (asset) | string (url) | null — `AvatarImage` in FeedCard handles all three).

## Key code mechanics (do not regress)
- **Burst animation (double-tap)**: `Animated.sequence([timing(420, Easing.out(Easing.back(1.9))), delay(140), timing(260, Easing.in(ease))])`, scale interp [0,0.6,1]→[0.22,1.02,1.3], opacity [0,0.12,0.72,1]→[0,0.95,0.95,0], heart 96px, `anim.start(() => burst.setValue(0))` guarantees clean end (no residual shade).
- **Pattern/decorative overlays** must have `pointerEvents="none"` (home hero, community, profile, onboarding, ayah/hadith card) — they silently swallow taps.
- **RNW ScrollView defaults to flex:1** — any emoji/row ScrollView inside a fixed-height sheet needs `height: 36, flexGrow: 0, flexShrink: 0`.
- **Mock data ids** (`src/api/mocks.ts`): posts 101, 102–104, 105 (image), 106 (youtube `hwWpWoOtsBY`), 107 (long), 108, 109, 110 (poll: 132/97/61 votes). `MOCK_COMMENTS` keyed by post id (fallback → 101). `MOCK_FOLLOWED = ['alameen','salamatu_b','kunfai_ibrahim','usman_ahmad']`. `MOCK_TRENDING` tags (#Tawbah #Seerah #DailyDhikr #Tajweed #Istikhara #Halaqah). `MOCK_PROFILES` (7 accounts; `photo` IS the asset id — use directly, do NOT re-map through MOCK_PHOTOS). Daily videos: `0R1LKPRwxR4`, `ta_tTZrarE0`, `tlG38jgInLc` (oEmbed-verified 2026-08-27).
- Sticky community tabs: show when `scrollY > 165`, translateY -58↔0, `pointerEvents: 'none'` when hidden.
- Composer simulated publish: 1600ms "Posting…" then post lands locally (with poll if ≥2 options filled).
- Web-only bits: `YouTubeFrame` (iframe) in FeedCard is `Platform.OS === 'web'`-gated; native gets the VideoModal preview instead. **Expo Go CANNOT embed a live YouTube player** (react-native-webview not in Expo Go) — do not try; true in-app video needs a dev build (EAS).

## Testing (headless, in this sandbox)
- Chromium: `/home/user/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`, always with `LD_LIBRARY_PATH=/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu`.
- Local server: dist must be served UNDER `/deenapp/` (bundle base path): `mkdir -p /tmp/serve2 && ln -sfn <repo>/dist /tmp/serve2/deenapp && cd /tmp/serve2 && python3 -m http.server 8152`. Kill by PID via `ss -ltnp` — never `pkill -f` (matches your own shell).
- `scripts/smoke11.mjs` = 36-check pass-10/11 web suite (run: `LD_LIBRARY_PATH=… node scripts/smoke11.mjs`). `scripts/livecheck.mjs` = renders the LIVE site's profile deep link. `scripts/dbg15–34.mjs` = historical probes (read for technique: elementFromPoint hit-testing, RNW quirks).
- Hard-won web-test gotchas: expo-router Tabs keeps ALL tab screens in the DOM (home first, hidden) → hit-test with elementFromPoint + prefer in-viewport y, or you grab hidden home copies; FA5 icons render as text-glyph divs (no svg); headless rAF throttling lags animated DOM ~300ms → verify end-state, not mid-frames; RN inputs set value via native setter + `input` event; video thumbs: center covered by play icon → click a corner and accept ancestor containing 'Surah'.
- **Web passing ≠ native safe**: HTML-like lowercase tags (`<b>`, `<i>`…) render as divs on web but CRASH native ("View config getter for component `x` must be a function"). After any pass: `grep -rnE "<(b|i|em|strong|small|span|br|u|s|sub|sup|mark|font|center)\b" src/`.
- Typecheck: `./node_modules/.bin/tsc --noEmit` (plain `npx tsc` grabs a fake package).

## Deploy recipe (proven, use exactly this)
```
cd deenlink-app
bash scripts/export-web.sh            # exports to dist/ at repo root (NOT dist/deenapp)
node scripts/slashguard.mjs           # rewrites routes for the /deenapp/ Pages base
rm -rf /tmp/pages-out && mkdir -p /tmp/pages-out && cp -r dist/. /tmp/pages-out/
git fetch origin                      # ALWAYS — stale local refs have shipped an old site before
git checkout --orphan deploy-tmp
git rm -rq --cached .
git clean -fdq -e .gitignore
cp -r /tmp/pages-out/. .
git add -A
git add -f assets/node_modules        # CRITICAL: repo .gitignore's "node_modules/" matches at any depth and would skip the site's own expo FA fonts / router images (36 files) → all icons break
git commit -m "Deploy pass N"
git push --force origin deploy-tmp:gh-pages
git checkout master && git branch -D deploy-tmp
```
- Then verify: `curl` the live home, extract the `entry-*.js` hash from index.html, curl it (200), grep 2–3 pass markers in the bundle, and run `node scripts/livecheck.mjs` (profile deep link renders). Pages propagates ~1–2 min; if the old bundle hash still serves, wait and re-check.
- Force-push master whenever history diverges (it has before — an env reset once rewound local master).
- **NEVER `git add -A` on a branch without .gitignore present** (gh-pages has no .gitignore) — it committed 36k node_modules files once.

## Sandbox / git environment (read before touching git)
- The sandbox **resets at every user-turn boundary**: wipes `node_modules/`, `dist/`, `.cache/` (chromium), apt-installed /usr libs, and **`.git/config`** (identity + token-bearing remote — that file is excluded from persistence). Workspace files under /home/user persist.
- Per-turn restore ritual:
  1. `git config user.name "DeenLink Dev" && git config user.email "dev@deenlink.org"`
  2. `git remote add origin https://<user>:<TOKEN>@github.com/useeman32-design/deenapp.git` — **token: ask the user** (it was pasted mid-project; do not store it in repo files — the repo is public).
  3. `npm install && npm i --no-save playwright-core`
  4. `npx playwright-core install chromium-headless-shell`
  5. If chromium ldd-missing libs: `sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libxdamage1 libxkbcommon0 libasound2 libatspi2.0-0` and copy the .so files into `/home/user/.chromium-libs/usr/lib/x86_64-linux-gnu/`.
  6. `git fetch origin` before trusting any local ref (a stale `.git` once made the deploy checkout an old pass-6 site).
- git gc after history surgery: `git gc --prune=now` (also update stale remote-tracking refs with `git fetch` first, or old objects stay reachable).

## Storage audit (2026-08-28)
- In-scope workspace ≈ **86 MB / ~400 files** of the 128 MB / 10,000-file snapshot budget (67% bytes, 4% files). Healthy.
- `node_modules/`, `dist/`, `.cache/` are EXCLUDED from snapshots (free).
- Breakdown: `.git` pack 37 MB (legit history incl. 18.4 MB `deenlink-content-pack.zip` from early passes — removable only by rewriting user's master history), zips 21 MB, app images ~10 MB, chromium libs ~12 MB, user uploads 3.5 MB, source small.
- If budget pressure ever appears: first ask about the content-pack zip history rewrite; do NOT delete user uploads or .chromium-libs without asking.

## Pass history (one-liners)
1–5. Foundation: auth (login/register, session+CSRF), home, Quran, Tools suite (athkar/dua/names/calendar/qibla/prayer/hadith/courses/events/charity), profile/settings, onboarding, theme system (dark forest/emerald/gold + light).
6. Home pass 6 (hero, campaign banners, daily ayah/hadith + share-card generator, daily videos w/ YouTube embed, accounts-to-follow).
7–8. Community tab (IG-style feed, comments sheet, report flow, double-tap burst, image preview, in-post YouTube), Tools learning move, Learning→Tools.
9. Live API wiring + demo fallback, real profile photos, video modal polish, share-card extra designs + dynamic height, name ellipsis, light-theme nav.
10. Community v2 (stats cards removed; search posts+accounts; Trending; sticky For you/Following/Scholars; FAB composer + poll builder + Posting… progress), reply flow (no @prefill; Replying-to chip; bold-emerald mentions), IG emoji rows, polls postable (post 110), public profile screen, image preview height fix, burst redesign (clean end-state), haptics, sun-path night wrap, video modal (no "Open in YouTube", "Watch more"), 16px anti-zoom inputs.
11. FORCE_DEMO mock-only mode; native Community crash fix (`<b>` tags); shared VideoModal (player preview on native + explicit Watch on YouTube; iframe on web) wired to Home + Community; demo user photo.
- Audio wiring: deferred by user ("note this, finish homepage first") — still open if he ever asks.

## Next likely asks (context)
- Switching back to live API (flip FORCE_DEMO) + reconciling mock vs live shapes.
- Any pass-12 spec. If native YouTube in-app is ever truly required: EAS dev build + a webview/youtube-iframe library — explain the trade-off before attempting.
- He runs the phone build from his own clone: after every master push, tell him `git fetch origin && git reset --hard origin/master && npx expo start --clear`.
