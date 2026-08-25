# DeenLink — Mobile App (Expo / React Native)

Native Android + iOS app for **deenlink.org**, built with [Expo](https://expo.dev) SDK 57, expo-router and TypeScript.

Your **PHP + MySQL backend stays as-is**. The app talks to a JSON API; every screen already has a
`src/api/client.ts` function ready to call it. Until the API is reachable, the app runs on bundled
**demo data** so it is 100% explorable from day one.

## Quick start

```bash
npm install
npx expo start          # scan QR with Expo Go on your phone, or press w for web
```

- **Web:** `npx expo start --web`
- **Android (Expo Go):** press `a` · **iOS (Expo Go):** press `i`
- **Production builds:** [EAS Build](https://expo.dev/eas) (`eas build -p android --profile preview`)

## Point it at your PHP backend

1. Set the base URL in `.env`:
   ```
   EXPO_PUBLIC_API_URL=https://deenlink.org/api   # ← your real API base
   ```
2. Make sure your PHP endpoints return JSON and send CORS headers:
   ```php
   header('Access-Control-Allow-Origin: *'); // or https://deenlink.org
   header('Access-Control-Allow-Headers: Authorization, Content-Type');
   header('Content-Type: application/json');
   ```
3. Match the route names in `src/api/client.ts` to your code (they're the *expected* contract):

| Function        | Expected endpoint  | Method |
| --------------- | ------------------ | ------ |
| `api.login`     | `/auth/login`      | POST   |
| `api.register`  | `/auth/register`   | POST   |
| `api.feed`      | `/posts?tab=`      | GET    |
| `api.post`      | `/posts/{id}`      | GET    |
| `api.announcement` | `/announcement` | GET    |
| `api.videos`    | `/videos`          | GET    |
| `api.wallpapers`| `/wallpapers`      | GET    |
| `api.events`    | `/events`          | GET    |
| `api.scholars`  | `/scholars`        | GET    |

Data shapes live in `src/api/mocks.ts` (`Post`, `Video`, `Scholar`, `EventItem`, `Wallpaper`) —
mirror them in your PHP `json_encode` output and you're live.

### Auth
The app expects `POST /auth/login` → `{ "token": "...", "user": { "id", "name", "username", "mizhab" } }`.
Use a JWT or random token column; the app stores it (SecureStore on device) and sends
`Authorization: Bearer <token>`. If login fails, the app falls back to **demo mode** (local sign-in)
so testing never blocks you.

## What works right now

- **Prayer times** — computed on-device with [adhan-js](https://batoulapps.github.io/adhan-js/)
  (Muslim World League method, Shafi madhab), location via `expo-location`, fallback to Owerri/Anambra.
  Live countdown, all five prayers + sunrise, Qibla direction. No backend needed, works offline.
- **Hijri calendar** — Umm al-Qura via Intl (falls back to tabular), holiday list with countdowns.
- **Digital Tasbeeh** — bead/progress counter, haptics, per-dhikr counts persisted on device.
- **Athkar** — morning / evening / after-prayer / general, each with its own counter.
- **Duas** — 14 duas with Arabic, transliteration, translation & source, filterable by category.
- **99 Names of Allah** — full list, searchable (Arabic / transliteration / meaning).
- **Quiz** — 10-question deen quiz with scoring.
- **Wallpapers** — demo dhikr art grid + fullscreen view (replace with your image URLs).
- **Feed** — For You / Following / Scholars tabs, likes, comments, compose (local until API wired).
- **Quran** — 114 surahs bundled; full text fetched live from alquran.cloud, offline sample for
  Al-Fatihah, Al-Asr, Al-Ikhlas, Al-Falaq, An-Nas.
- **Videos / Events / Scholars / Charity** — screens + demo data, ready for your endpoints.
- **Auth** — login/register flows with demo-mode fallback.
- **Dark mode** — system / light / dark, persisted.

## Next steps (v1.1)

1. Wire real endpoints (see table above) — remove fallbacks you no longer need.
2. In-app video playback: `npx expo install react-native-video` (self-hosted) + YouTube IFrame for links.
3. Push notifications: `npx expo install expo-notifications` + trigger from PHP (FCM) for prayer reminders.
4. Real profile stats, follows, post images (your `uploads/` URLs work in `<Image>`).
5. Payments: Paystack or Flutterwave SDK for the Charity screen.
6. Real app icon/splash: drop your DeenLink logo into `assets/images/` and update `app.json`.
7. Store release: `eas build` → `eas submit` (Google Play $25 once, Apple Developer $99/yr).

## Project structure

```
src/
  api/          client.ts (fetch + auth) · mocks.ts (demo data + shapes)
  app/          expo-router routes
    (auth)/     login · register
    (tabs)/     home · quran (nested) · tools · videos · profile
    tools/      tasbeeh · athkar · dua · names · prayer · calendar · quiz
                wallpapers · events · scholars · charity
    post/       post detail + comments
  components/   shared UI (PrayerBanner, PostCard, QuickGrid, DhikrCounter, …)
  context/      ThemeContext · AuthContext
  data/         bundled offline data (quran, dua, athkar, names99)
  lib/          prayer.ts (adhan) · location.ts · storage.ts
```
