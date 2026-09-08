# Pass 83-9 — DM "⚠ not sent" Mystery SOLVED (SHIPPED)

- **deenlink-api main: `c4f7f99`** = bundle **entry-d9878dea4c1066ef90389b622cbd2629.js** (raw-URL verified)
- **deenapp master: `dfe99a7`**

## Owner report
"Clicked Message → DM opens now, but the message shows not sent; even an ayah won't go."

## Root cause (REPRODUCED on replica, not guessed)
DMs to users who **don't follow you back** open as message **requests** (pass-74 design): the server allows **3 messages** until they accept, then answers `403 code=request_limit` ("You can send up to 3 messages until they accept your request.").

Replica transcript: `start_username → conversation_status:"request"`, sends 1–3 `success`, send 4 `403 request_limit`.

The client's only explanation was `Alert.alert` — which is **a no-op on web** (react-native-web). So on the PWA every blocked send showed a bare "⚠ not sent" with zero explanation. After 3 tests, every further message looks broken. The first 3 messages **were actually delivered** — they sit in the recipient's Message Requests.

Ruled out by live/replica evidence along the way: charset (all chat CREATE TABLEs are explicitly utf8mb4 — verified by recreating tables under a latin1-default DB), schema drift (chat_schema self-heals + runs fine on live: unauth probe returned 401, not 500), chat_notify crash (wrapped in try), CSRF (chat endpoints are JWT-only).

## Fix (client, 3 files)
1. `chatSend` now returns the server's error `code` + `message`; `chatStartDMByUsername` returns `{ cid, status }`.
2. **The reason renders in the bubble itself** (works on web): `⚠ not sent — request pending · max 3 messages until @user accepts` (also `conversation closed`, `blocked`, or the server message).
3. Request state is recorded the moment a conversation is created → the "Message request · 3-message limit" banner shows immediately, and the Alert fires on native.
4. `resolveCid` retries once after 1.2 s (transient shared-hosting 5xx must not look like a dead chat).
5. `SendToFriends` adapted to the new return shape.

## Verification (entry-d9878dea on replica, latin1-default DB like cPanel)
E1 request banner on fresh thread PASS · E3/E4 bubble marked + text kept PASS · **E5 bubble shows "⚠ not sent — request pending · max 3 messages until @fx91b accepts" PASS** · E7 first-3 delivered messages visible PASS · accept-request → **active send succeeds (id 4)** PASS · tsc clean · 0 pageerrors.

## For the owner
- Pull deenlink-api on cPanel, hard-refresh, confirm `entry-d9878dea`.
- The messages you "sent" to that user probably DID arrive — ask them to check **Message Requests** (or have them accept; then everything flows normally).
- If a send still fails after this pull, the bubble now says exactly why — tell me the text.
