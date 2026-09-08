# Pass 83-10b/c — Group Polls + Audio Uploads (2026-09-08)

## 83-10b — Poll builder in the group composer
- Composer gains a **poll toggle** (poll-h icon) opening a 2–6 option editor
  (`+ Add option` up to 6, × removes down to 2, 60-char cap per option).
- Options ride to the server as `poll_options` (JSON array on the JSON body,
  stringified field on multipart) — `create_post.php` already accepted them.
- FeedCard renders the poll and votes through the **existing** `votePoll`
  wiring (`/api/feed/poll_vote.php`) — zero server changes needed.

## 83-10c — Audio FILE uploads (owner correction 63: uploads, NOT voice notes)
- **Web:** hidden `<input type="file" accept="audio/*">` + chip showing the
  file name with × to remove. **Native:** lazy `expo-document-picker`
  (`getDocumentAsync({type:'audio/*'})`) — never loaded on web (correction 61).
- `groupCreatePost(groupId, text, images?, pollOptions?, audio?)` — multipart
  when images/audio present (blob→File on web, `{uri}` part native).
- Feed renders `post.audio_url` with the new **AudioCassette** component:
  react-native-svg shell with two reels that spin via `Animated.loop` while
  playing, expo-video `useVideoPlayer` engine (same as Quran audio — no
  expo-av), 400 ms progress poll, play/pause + mm:ss + progress bar.
- `absMedia()` in client.ts prefixes root-relative `/uploads/…` URLs with
  `API_ORIGIN` so native can resolve group media + audio.

## Verification (replica, bundle entry-0658fb0a89092ba8366de308b8603747.js)
Live mode asserted (`!Aisha Yusuf`). fx93a → group id=2:
P1 poll posts ✓ · P2 options render ✓ · P3 vote registers ✓ ·
audio input present ✓ · A1 audio post appears ✓ · A2 cassette SVG ✓ ·
A3 play tap clean ✓ · A4 audio+poll persist after reload ✓ · 0 pageerrors ✓
Server stored `uploads/audio/2026/09/gpost_94_167a491c32.wav`.
`tsc --noEmit` = 0 errors. expo-document-picker ^57.0.1 added.

## Incident log
- deenapp `.git` remote vanished mid-pass → `checkout -f` hit a stale
  pass-75 ref and wiped uncommitted edits; recovered by re-adding origin,
  resetting to real `4e5c376`, and re-applying all edits. **Always verify
  `git remote -v` + `git fetch` BEFORE any checkout -f.**
- Repo's committed group.tsx (83-10a) is the RN-parity variant (Pressable /
  FontAwesome5 / haptics / dark-mode) — 83-10b/c applied to THAT variant and
  the battery re-run against the rebuilt bundle. Repo source == deployed
  bundle again.
