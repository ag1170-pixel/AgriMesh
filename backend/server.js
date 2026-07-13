// AgriMesh API. Wraps the routing core, serves the frontend, and gives the
// admin panel its live controls. In-memory store = zero DB setup for the demo
// (swap `reports`/inventory for MongoDB later; the route logic doesn't change).
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { route } = require("./core");
const { sendSMS } = require("./sms");
const { INVENTORY, NODES } = require("./graph");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "agrimesh-demo-2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "agrimesh-admin-token";

// code -> label / pesticide. Loaded from local files if present (dev / full deploy),
// else fetched once from the CDN mirror of the repo — so a lightweight serverless
// deploy that ships no data files still resolves names. Lazy so the CDN fetch
// never blocks module load / cold start.
const CDN = "https://cdn.jsdelivr.net/gh/ag1170-pixel/AgriMesh@main";
let LABEL = {}, PESTICIDE = {}, dataReady = false;
async function ensureData() {
  if (dataReady) return;
  let labelsArr, pestText;
  try { labelsArr = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "model", "labels.json"), "utf-8")); }
  catch { labelsArr = await fetch(CDN + "/frontend/models/labels.json").then((r) => r.json()); }
  try { pestText = fs.readFileSync(path.join(__dirname, "pesticides.csv"), "utf-8"); }
  catch { pestText = await fetch(CDN + "/backend/pesticides.csv").then((r) => r.text()); }
  LABEL = Object.fromEntries(labelsArr.map((l) => [l.code, l.label]));
  PESTICIDE = Object.fromEntries(pestText.trim().split(/\r?\n/).slice(1)
    .map((line) => { const [code, en, hi] = line.split(","); return [code, { en, hi }]; }));
  dataReady = true;
}
const enrich = (r) => ({ ...r, label: LABEL[r.code] || r.code, pesticide: PESTICIDE[r.code] });

const reports = []; // { code, label, farmer, start, center, distanceKm, ts }
const logReport = (r) => reports.unshift({
  code: r.code, label: LABEL[r.code] || r.code, farmer: r.farmer, start: r.start,
  center: r.center, distanceKm: r.distanceKm, ts: new Date().toISOString(),
});

const app = express();
app.use(cors());
app.use(express.json());

const admin = (req, res, next) =>
  req.get("authorization") === `Bearer ${ADMIN_TOKEN}`
    ? next()
    : res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

app.get("/api/health", (_req, res) => res.json({ ok: true, reports: reports.length }));

// main farmer endpoint (web app): parse payload -> route -> log.
// Optional `phone` also fires the reply SMS (mock unless a gateway is configured).
app.post("/api/route", async (req, res) => {
  if ((req.query.key || req.body.key) !== API_KEY)
    return res.status(401).json({ ok: false, error: "BAD_KEY" });
  try {
    await ensureData();
    const r = route(req.body.payload, req.body.from || "web-user");
    if (r.ok) logReport(r);
    const sms = r.ok && req.body.phone ? await sendSMS(req.body.phone, r.reply) : undefined;
    res.json({ ...enrich(r), sms });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Inbound SMS webhook — a real gateway (TextBee) POSTs here when a farmer texts in,
// OR the admin "Simulate incoming SMS" button posts here. Same path either way:
// parse -> route -> log -> send the reply back over SMS to the sender.
app.post("/api/sms/inbound", async (req, res) => {
  if ((req.query.key || req.body.key) !== API_KEY)
    return res.status(401).json({ ok: false, error: "BAD_KEY" });
  const from = req.body.from || "unknown";
  try {
    await ensureData();
    const r = route(req.body.message ?? req.body.payload, from);
    if (r.ok) logReport(r);
    const sms = r.ok ? await sendSMS(from, r.reply) : { ok: false, skipped: "NO_ROUTE" };
    res.json({ ...enrich(r), sms });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/admin/login", (req, res) =>
  req.body.password === ADMIN_PASSWORD
    ? res.json({ ok: true, token: ADMIN_TOKEN })
    : res.status(401).json({ ok: false, error: "BAD_PASSWORD" }));

app.get("/api/admin/reports", admin, (_req, res) => res.json({ ok: true, reports }));

app.get("/api/admin/inventory", admin, async (_req, res) => {
  await ensureData();
  res.json({ ok: true, inventory: INVENTORY, labels: LABEL });
});

// live stock edit — the "watch Dijkstra re-route" demo moment
app.put("/api/admin/inventory", admin, (req, res) => {
  const { centerId, code, stockKg } = req.body;
  if (!INVENTORY[centerId]) return res.status(400).json({ ok: false, error: "NO_CENTER" });
  INVENTORY[centerId][code] = Math.max(0, Number(stockKg) || 0);
  res.json({ ok: true, inventory: INVENTORY });
});

// TextBee fallback: run the exact same pipeline without a physical inbound SMS.
// If a `from` phone is given, it also fires the reply (mock unless a gateway is set),
// so the panel demonstrates the full round-trip — the reliable, phone-free demo path.
app.post("/api/admin/simulate", admin, async (req, res) => {
  try {
    await ensureData();
    const r = route(req.body.payload, req.body.from || "sim");
    if (r.ok) logReport(r);
    const sms = r.ok && req.body.from ? await sendSMS(req.body.from, r.reply) : undefined;
    res.json({ ...enrich(r), sms });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/api/nodes", (_req, res) => res.json(NODES)); // map needs coords

// serve the static frontend from one origin (no CORS headaches in demo)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Run a real server locally (npm start); on Vercel the app is imported as a
// serverless function instead. ponytail: in-memory state persists within a warm
// instance — fine for a demo; add MongoDB (HANDOFF §P3) for true persistence.
if (require.main === module) {
  app.listen(PORT, () => console.log(`AgriMesh on http://localhost:${PORT}`));
}
module.exports = app;
