// Security middleware: rate limiting, constant-time credential checks, and
// input validators. Kept in one file so server.js reads like a route table,
// not a security review.
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const config = require("./config");

// ---- constant-time string compare (defends against timing side-channels on
//      password/token checks; a naive `a === b` leaks length/prefix info via
//      response time under repeated probing). ----
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // still run a comparison of equal length to avoid a short-circuit timing
    // signal on length mismatches specifically
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- admin sessions: random per-login token with expiry, held in memory.
//      Replaces a single static token that (a) never expired and (b) was
//      committed to source/env as a guessable constant. ----
const sessions = new Map(); // token -> expiresAt
function issueSession() {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, Date.now() + config.adminSessionTtlMs);
  return token;
}
function isValidSession(token) {
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}
// periodic sweep so the Map doesn't grow unbounded over a long-running process
setInterval(() => {
  const now = Date.now();
  for (const [tok, exp] of sessions) if (now > exp) sessions.delete(tok);
}, 10 * 60 * 1000).unref();

function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token && isValidSession(token)) return next();
  return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
}

function checkApiKey(req, res, next) {
  const key = req.query.key || req.body?.key;
  if (key && safeEqual(key, config.apiKey)) return next();
  return res.status(401).json({ ok: false, error: "BAD_KEY" });
}

// ---- rate limiters. Keyed by IP by default; the SMS one is ALSO keyed by the
//      target phone number so a botnet can't spread requests across many IPs
//      to spam a single victim's phone. ----
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.generalMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const routeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.routeMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "RATE_LIMITED" },
});

const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "TOO_MANY_ATTEMPTS" },
  skipSuccessfulRequests: true, // only failed logins count toward the limit
});

// SMS abuse guard: rate-limit by phone number (from the request body), not just
// IP, so a real deployment can't be used as a free SMS-bombing relay against a
// third party's number. Falls back to IP if no phone is present yet.
const smsAttempts = new Map(); // phone -> [timestamps]
function smsAbuseGuard(req, res, next) {
  const phone = req.body?.phone || req.body?.from;
  if (!phone) return next();
  const now = Date.now();
  const windowStart = now - config.rateLimit.windowMs;
  const hits = (smsAttempts.get(phone) || []).filter((t) => t > windowStart);
  if (hits.length >= config.rateLimit.smsMax) {
    return res.status(429).json({ ok: false, error: "SMS_RATE_LIMITED" });
  }
  hits.push(now);
  smsAttempts.set(phone, hits);
  next();
}

// ---- input validators ----
// Disease codes are used as object keys (DISEASES[code], INVENTORY[c][code]);
// validating the shape before lookup blocks prototype-pollution-style keys
// (e.g. "__proto__") and keeps error messages meaningful instead of a generic
// "undefined" crash deep in routing.
const CODE_RE = /^D[0-9A-Z]{2}$/;
function isValidCode(code) {
  return typeof code === "string" && CODE_RE.test(code) &&
    code !== "__proto__" && code !== "constructor" && code !== "prototype";
}

// Loose E.164-ish check: leading + optional, 8-15 digits. Good enough to reject
// obvious garbage/injection attempts without rejecting real international numbers.
const PHONE_RE = /^\+?[0-9]{8,15}$/;
function isValidPhone(phone) {
  return typeof phone === "string" && PHONE_RE.test(phone.trim());
}

// Never echo raw error messages (stack traces, file paths, provider errors that
// may embed API keys) to the client. Log the detail server-side, return a safe
// generic code the frontend can branch on.
function safeError(res, status, code, err) {
  if (err) console.error(`[error] ${code}:`, err.message || err);
  return res.status(status).json({ ok: false, error: code });
}

module.exports = {
  safeEqual, issueSession, isValidSession, requireAdmin, checkApiKey,
  generalLimiter, routeLimiter, loginLimiter, smsAbuseGuard,
  isValidCode, isValidPhone, safeError,
};
