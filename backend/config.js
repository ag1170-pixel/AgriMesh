// Centralized secret/config loading. Single source of truth so server.js never
// touches process.env directly. Fails loudly instead of silently falling back
// to a well-known default — the old defaults ("agrimesh-demo-2026", "admin123",
// "agrimesh-admin-token") are PUBLIC (they were committed to a public repo), so
// treat them as compromised, not as a safety net.
const crypto = require("crypto");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// Generates a random secret for local/dev runs so `npm start` still works with
// zero setup, but the value is different every boot and never checked in.
// In production this path is never taken — see the throw below.
function randomSecret(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function required(name, { minLength = 12 } = {}) {
  const val = process.env[name];
  if (val && val.length >= minLength) return val;
  if (IS_PROD) {
    throw new Error(
      `[config] ${name} is missing or too short (min ${minLength} chars). ` +
      `Set a strong, random value in the environment before starting in production.`
    );
  }
  const dev = randomSecret();
  console.warn(
    `[config] ${name} not set — using a random dev-only value for this run: ${dev}\n` +
    `          Set ${name} in .env (or your host's env vars) before deploying.`
  );
  return dev;
}

const config = {
  nodeEnv: NODE_ENV,
  isProd: IS_PROD,
  port: Number(process.env.PORT) || 3000,

  // Shared "key" the frontend sends on /api/route and /api/sms/inbound. NOTE:
  // this is NOT a real access-control boundary — it ships in client-side JS,
  // so anyone can read it in view-source. Its only purpose is to deter naive
  // bots hitting the endpoint directly; real abuse protection is rate limiting
  // (see middleware.js). Never treat this as an auth secret.
  apiKey: process.env.API_KEY || "public-demo-key",

  adminPassword: required("ADMIN_PASSWORD"),

  // Allow-listed origins for CORS. Comma-separated env var; empty = same-origin
  // only (safe default). Set to "*" explicitly (not recommended) to allow all.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean),

  // Admin session tokens are now random-per-login (see middleware.js) with a
  // TTL, rather than one static token baked into source and env forever.
  adminSessionTtlMs: Number(process.env.ADMIN_SESSION_TTL_MS) || 12 * 60 * 60 * 1000, // 12h

  rateLimit: {
    windowMs: 60 * 1000,
    routeMax: Number(process.env.RATE_LIMIT_ROUTE) || 20,      // /api/route per IP/min
    smsMax: Number(process.env.RATE_LIMIT_SMS) || 5,           // real SMS sends per phone/min
    loginMax: Number(process.env.RATE_LIMIT_LOGIN) || 5,       // admin login attempts per IP/min
    generalMax: Number(process.env.RATE_LIMIT_GENERAL) || 120, // everything else per IP/min
  },
};

module.exports = config;
