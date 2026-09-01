# CONTINUE — pass 35 handoff (2026-08-31)

## Pass 35 SHIPPED (master bec515c, gh-pages 7b71134, probe35 ALL PASS, android .hbc export OK)

### B — IslamicAPI.com (key moved to env)
- `.env` now has `EXPO_PUBLIC_ISLAMIC_API_KEY=1Hms…L3Ssdq` (revocable, public
  by design). `src/lib/islamicApi.ts` reads it via `process.env.EXPO_PUBLIC_ISLAMIC_API_KEY`
  with the old literal as fallback so bare `expo export` still works.
- Prayer times (method dropdown via apiMethod, school = madhab), zakat nisab
  (donations calculator + offline fallback ₦520,000 silver), Ruqyah screen
  (`/tools/ruqyah` — recite 3 programs + learn 13 topics; QuickGrid tile +
  theme tiles/tilesDark entries).

### A-bugs addressed this pass
- ~80% native zoom → FIXED IN CODE: `<T>` now sets `allowFontScaling={false}`
  (Android font-scale could shrink ALL text) + new `src/context/UIScale.tsx`
  (UIScaleProvider in _layout) + Profile → "Display size" S/M/L/XL (key
  `dl.ui.scale`). NEEDS USER CONFIRM ON DEVICE.
- Hero bg centering → home + charity heroes switched to expo-image
  `contentFit="cover"` (RN Image cover mis-anchors on some Android builds).
- Ayah search → corpus loader now 8-way parallel (114 serial fetches made the
  first Shazam/text search look dead). Chain q→initialQuery→auto-scan verified.
- prayer-month MonthTableSvg today-row → the `if (isToday) <Rect/>;` dead
  element is now `{isToday ? <Rect/> : null}` INSIDE the row `<G>`; unused
  SvgImage import dropped. Still needs a device/web check of the JPG export.
- tasbeeh → photo replaced by TRANSPARENT drawn SVG misbaha (arc-length-even
  33 beads, gold tassel); lit-bead dots + pulsing glow layer render UNDER the
  SVG; in-SVG radial under-glow on active bead. imgH now = imgW/(SV_W/SV_H).
- share-as-image → NEW `src/components/ShareCardSvg.tsx` (1080-wide classic
  design, QR rendered as SVG rects from `qrcode`'s create()). ContentShareSheet:
  web keeps canvas path; native renders the SVG + Share/Save via lib/svgExport.
  ShareCardSvg needs runtime verify (QR + arabic wrap) on device.
- assets CONFIRMED present: assets/img/mecca.jpg (1200×670), logo-360.webp.

### C — features this pass
- Groups: facebook-style profile modal (mecca cover + gradient, gold-bordered
  logo medallion, members/posts/connections chips, members avatar stack,
  composer + posts kept), `GroupFeedPosts` sample member posts in community
  feed, Groups tab in /tools/connections.
- Wallpapers REBUILT: 6 live-SVG designs (1080×1920) — grid preview, fullscreen,
  save-to-gallery + share via svgExport everywhere.
- Donations: hero ayah 2:261 + Muslim 1631 at top; DeenPoints chip → buy modal;
  zakat calculator bottom-sheet (live nisab); ReceiptCard redesign
  (logo-360.webp band, rotated DEENLINK watermark, fee% visible).
- Scholars: category grid browse + catScreen; AskSheet category multi-select
  (max 3, joined ' · '); DPIcon on balance/max-pledge rows.
- Check-in +5 DP (RewardModal) on profile. formatHijri "AH AH" fixed.

### STILL OPEN (verify on device, in Expo Go)
1. qibla fused-compass fix + fullscreen z-fix + adhan pause — applied earlier,
   need user repro/confirm.
2. Videos restart-after-pause — wanted-guard applied, needs repro.
3. Native runtime check of: ruqyah screen, zakat sheet, wallpapers save,
   share-card SVG export, prayer-month JPG export, Display size setting.
4. Mic features stay Expo Go typed-fallback only (hard limit, standing).

### Standing facts (unchanged)
- Storage keys: dl.prayer.settings.v1, dl.donations.v1, dl.scholars.questions.v1,
  dl.groups.v1, dl.saved.posts.v1, dl.prophets.read.v1, dl.courses.progress.v1,
  dl.checkin.date, dl.deenpoints (DP_DEFAULT 1250), + NEW dl.ui.scale.
- DeenPoints: ₦1.5/pt, packs 100/500(+25)/1000(+100)/5000(+750), never buy fatwas.
- Donations CATS order DeenLink→Zakat→Sadaqah (probe-locked). Kaaba icon fa-kaaba.
- Deploy: `bash scripts/export-web.sh` → clone gh-pages → wipe → `cp dist/. .` →
  commit → push. Local gate: `node scripts/pages-server.mjs <dist dir>` port
  3996 prefix /deenapp, then `node scripts/probe35.mjs` (ALL PASS as of bec515c).
- NOTE for sandbox resets: chromium needs `apt-get install -y libnspr4 libnss3
  libasound2t64` before probe35 runs; pages-server must serve the DIST dir
  itself (prefix stripping expects site root), and kill it with
  `fuser -k 3996/tcp` — pkill -f pages-server kills your own shell (cmdline match).
- git remote is NOT persisted (.git/config excluded from snapshots): re-add with
  token from `.token` before pushing (`https://x-access-token:<TOK>@github.com/useeman32-design/deenapp.git`).
- dbg52.mjs deleted this pass. scripts/ still has older diagNN.mjs + probe32-34
  (harmless; can prune next pass).
