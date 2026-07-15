# AgriMesh — Security & Hardening Notes

This documents the security/refactor pass applied on top of the working demo.
Read this before deploying anywhere real users will hit the API.

## What changed, and why

### 1. No more hardcoded secret defaults
`ADMIN_PASSWORD`, the old static `ADMIN_TOKEN`, and the SMS provider keys are
**public** — the values previously shipped as fallback defaults in `server.js`
and `.env.example` are visible in this repo's Git history forever, so treat
them as compromised, not as a safety net.

- `backend/config.js` is now the single place that reads `process.env`.
- In `NODE_ENV=production`, missing/weak (`< 12` chars) `ADMIN_PASSWORD`
  **throws at boot** instead of silently falling back to `admin123`.
- In development, a random per-run value is generated and printed to the
  console so `npm start` still works with zero setup.
- `API_KEY` is explicitly documented as **not a secret** (see below).

### 2. Admin auth: random, expiring sessions instead of a static token
The old `/api/admin/login` returned the *same* `ADMIN_TOKEN` string to every
caller, forever — a single leaked value (or the one already public on GitHub)
grants permanent admin access with no way to revoke it short of redeploying.

- `backend/middleware.js` now issues a random 32-byte session token per
  successful login (`issueSession()`), held in memory with a 12h TTL
  (`ADMIN_SESSION_TTL_MS`), and expired sessions are swept periodically.
- Password and token comparisons use `crypto.timingSafeEqual` (`safeEqual()`)
  instead of `===`, closing a (minor but free-to-fix) timing side channel.

### 3. Rate limiting on every write/abuse-prone endpoint
There was no rate limiting anywhere. Two concrete abuse paths this closes:

- **Brute-forcing the admin password** — `loginLimiter` caps failed attempts
  per IP (default 5/min); successful logins don't count against the limit.
- **Using AgriMesh as a free SMS-bombing relay** — `/api/route` accepts an
  arbitrary `phone` and fires a real SMS if a gateway is configured. Nothing
  stopped a script from hammering it with different `phone` values to spam
  a third party. `smsAbuseGuard` now rate-limits **by the target phone
  number itself** (default 5/min), not just by caller IP, so spreading the
  requests across many IPs/proxies doesn't help an attacker.
- A `generalLimiter` and `routeLimiter` bound everything else per IP.

All limits are configurable via env vars (see `.env.example`); defaults are
conservative for a low-traffic pilot, not tuned for scale.

### 4. CORS: allow-listed, not wildcard-open
`app.use(cors())` with no options allows **any** origin to call the API.
`config.allowedOrigins` (from `ALLOWED_ORIGINS`, comma-separated) now drives
this; leaving it blank restricts the API to same-origin requests only, which
is what the shipped frontend actually needs.

### 5. Input validation before object-key lookups
`DISEASES[req.params.code]` and `INVENTORY[centerId][code]` used the raw
request value as an object key with no validation — a request with
`code=__proto__` or similar is a classic prototype-pollution-adjacent smell
even where it isn't directly exploitable today. `isValidCode()` now enforces
the real code shape (`/^D[0-9A-Z]{2}$/`) and explicitly rejects
`__proto__`/`constructor`/`prototype` before any lookup. Phone numbers get a
similar `isValidPhone()` check before being handed to the SMS provider.

### 6. Errors no longer leak internals to the client
Route handlers returned `e.message` directly in a few places, which can
include file paths, provider HTTP bodies, or (for the SMS providers)
fragments of request headers. `safeError()` logs the real error server-side
and returns a stable error code to the client instead.

### 7. Standard security headers, bounded request size
- `helmet()` adds the usual baseline headers (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.).
- `express.json({ limit: "1mb" })` bounds request body size against naive
  payload-flood DoS.
- `app.set("trust proxy", 1)` so rate limiting sees the real client IP behind
  Vercel/Railway/Render rather than the proxy's IP.
- The in-memory `reports` array is now capped (`MAX_REPORTS = 5000`) so a
  long-running process can't be grown unbounded.

### 8. Frontend
- A `Content-Security-Policy` meta tag scopes script/style/connect sources to
  what the app actually uses, instead of no policy at all.
- Every dynamic string written via `innerHTML` now goes through an `esc()`
  helper (defense in depth — today's data is our own trusted `diseases.json`,
  but this means a future data source, or a compromised CDN mirror, can't
  inject markup).
- The public `API_KEY` sent from the client is explicitly commented as **not
  a secret** — it ships in readable JS, so real abuse protection is the
  server-side rate limiting above, not this string.
- The seedling-emoji PWA icon (hosted on a third-party emoji CDN) was
  replaced with a local `icon.svg` — one less third-party dependency, and no
  emoji anywhere in the shipped app (see below).

### 9. Location honesty: no more fabricated routes for out-of-range GPS
`backend/core.js` used to snap ANY lat/lng — including a real device GPS
reading from anywhere on Earth — to "whichever of the 15 hardcoded demo
villages happens to be nearest," with no distance sanity check. That means a
user hundreds or thousands of km outside the pilot district still got a
confident-looking route, distance, and SMS reply. That is worse than an
error: it looks correct.

`snap()` now returns the distance to the nearest node, and `route()` rejects
anything farther than `SERVICE_AREA_MAX_KM` (15 km, generous relative to the
graph's own ~6 km span) with an explicit `OUT_OF_SERVICE_AREA` result instead
of silently fabricating a plausible-but-meaningless route. Covered by a new
test in `backend/test.js` (a Mumbai coordinate against the Delhi-area demo
graph). The frontend shows a clear message and falls back to the village
dropdown rather than trusting an out-of-range GPS fix.

### 10. Dedicated "Send SMS" flow, India-scoped
Added a standalone Send SMS control on the route result (separate from the
optional phone field earlier in the flow) so a farmer can text themselves or
someone else the result after seeing the route. It:
- Validates the number client-side against Indian mobile format
  (`+91`/`91` optional, then 10 digits starting 6-9) before allowing a send.
- Re-runs the same server-side `/api/route` path (not a new free-text relay)
  so all existing rate-limiting, abuse-guarding, and validation apply
  unchanged — no new attack surface was added for this feature.
- Displays a persistent, plain-language disclaimer that real delivery
  (TextBee) isn't wired up yet because it's a paid service still being
  connected, and that the current response is always demo/mock output. This
  is true today and should be removed only once a real gateway is live.

## Known limitations / explicitly out of scope for this pass

- **SRI hashes were not added** for the Leaflet CDN `<link>`/`<script>` tags.
  This repo has no build step to compute and pin them safely, and a wrong
  hash silently breaks the map for every user. Add them once there's a small
  build/verify step, or vendor Leaflet into the repo.
- **In-memory storage is still in-memory.** Rate-limit counters, admin
  sessions, and reports/inventory all reset on restart and don't share state
  across multiple server instances. Fine for a single-instance pilot; move to
  Redis (rate limits/sessions) and MongoDB (reports/inventory, already
  tracked in `HANDOFF.md` §P3) before scaling horizontally.
- **The public `API_KEY` provides no real access control**, by design — it
  can't, since it ships in client JS. Don't add "security" features that
  assume otherwise.
- **TextBee/Fast2SMS credentials** are still plain env vars, which is normal
  for this class of secret, but rotate them if `.env` is ever committed by
  accident (it's gitignored, but mistakes happen — check `git log -p -- .env`
  periodically).

## Before deploying to production

1. Set `NODE_ENV=production`.
2. Set a real `ADMIN_PASSWORD` (12+ chars, unique, never reused from this repo
   or any screenshot/doc).
3. Set `ALLOWED_ORIGINS` to your actual frontend origin(s).
4. Review the rate-limit env vars against your expected real traffic.
5. Run `npm install` in `backend/` to pick up `helmet` and
   `express-rate-limit` (added to `package.json`).
