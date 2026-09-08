# Pass 83-8 — Security: Rate Limits Restored (SHIPPED, server-only)

- **deenlink-api main: `7592c88`** — bundle unchanged (`entry-c7f5ecde`), no app pull needed for this one; just the cPanel API pull.
- deenapp master: `bf16e80` (unchanged this pass)

## What was restored from pass-82 (`b778024`)
| Endpoint | Limit | Response when exceeded |
|---|---|---|
| `auth/login.php` | 30 attempts / 15 min per IP | 429 "Too many login attempts…" |
| `auth/register.php` | 5 sign-ups / hour per IP | 429 "Too many sign-ups…" |
| `auth/request_password_reset.php` | 3 / 10 min per IP | 429 "Too many reset requests…" |
| `auth/resend_verification.php` | 3 / 10 min per IP | 429 "Too many requests…" |
| `payments/flutterwave/init_deenpoints.php` | 10 inits / 10 min per USER | 429 "Too many purchase attempts…" |

- `api/config/rate_limit.php`: DB-backed fixed-window limiter, auto-creates `rate_limits` table, **fail-open** (a limiter error can never take the app down).
- Already present and untouched: login account lockout, username/name change limits, CSRF double-submit + session rotation, CORS allowlist, session fixation regeneration.

## Replica verification (live PHP + MariaDB)
- Normal login still succeeds ✓
- pwreset: requests #1–#3 → 200, **#4 → 429** ✓
- login: attempts 1–29 pass the limiter, **attempt 30 → 429** with the friendly message ✓
- `rate_limits` rows observed: `rl:login:ip:… cnt=30`, `rl:pwreset:ip:… cnt=3` ✓
- `php -l` clean on all six files ✓

## Also completed this turn: queue item ② verified
Charity/Donations screen balance is **REAL** — the DeenPoints chip showed exactly the server balance (115 for fx83a; demo default would be 1,250). Wired since pass 69/72; now proven with a fresh browser test. No code change was needed.

## Repo note (owner observation)
deenapp on GitHub IS current (`bf16e80` = 83-7b docs; deenpoints.tsx contains the new cards/pagination code — spot-checked via raw URL). The live app is served from **deenlink-api**, so pulls of deenapp are optional/backup only; if a deenapp pull hangs it doesn't affect the live site.

## Queue next
④ group posts photo/video/poll/audio + rotating SVG/canvas cassette player (the big one).
