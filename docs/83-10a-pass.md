# Pass 83-10a — Group Photo Posts (SHIPPED)

- **deenlink-api main: `1603251`** = bundle **entry-158a85ced39cb5dcbe0c74124e7cfc83.js**
- **deenapp master: `43682dc`**

## Server (restored from pass-82 `b778024`, re-verified)
- `api/groups/create_post.php` (23 → 158 lines): multipart upload — up to 5 photos (GD-resized to 1080 + 360 JPEG), optional audio clip (≤25 MB, mime allowlist), optional poll (2–6 options), legacy JSON text posts still work, **20 posts / 10 min per user rate limit**, membership enforced, transactional.
- `api/groups/posts.php` (35 → 105 lines): feed parity — every post carries `media[]`, `audio_url`, `poll {options, votes, my_vote}`, real like/comment counts, author card.
- `Schema::ensurePostMediaAudio` added (post_media enum gains 'audio' — needed for 83-10c voice notes).

## Client
- `client.ts`: `groupCreatePost` sends multipart when photos are attached (blob → File on web, `{uri}` parts native — same proven recipe as the feed uploader); `groupPosts` normalizes server shapes (poll `{label}`→`{text}`, `image_url_1080`→`{url, thumb_url}`) so FeedCard renders them untouched.
- `group.tsx`: photo button in the composer (web `<input type=file>`, native lazy `expo-image-picker` per correction 61), attachment chip with preview + remove, **server posts now render INTACT** — the old code flattened them into demo rows and invented fake like counts (`8 + at%40`); composer visible to owner/admin too.

## Verification (replica, entry-158a85ce)
API: photo post → resized 1080+360 files on disk, poll post → options returned, rate limit present. UI: G1 group loads · G2 server posts listed · **G3 photo renders** · **G4 poll options render** · G5 composer + file input for members (correctly hidden for non-members) · **G6 optimistic post appears** · **G7 persists after reload** · **G8 both photos render** · 0 pageerrors · tsc clean.

## Note
A "G5 fail" mid-test turned out to be correct behavior: the test user wasn't a member (the group had been created by the other test account through a shared curl session) — composer hidden as designed.

## Next
83-10b polls UI in composer (server ready) → 83-10c voice notes + SVG/canvas cassette player.
