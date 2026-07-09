// AgriMesh API. Wraps the routing core, serves the frontend, and gives the
// admin panel its live controls. In-memory store = zero DB setup for the demo
// (swap `reports`/inventory for MongoDB later; the route logic doesn't change).
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { route } = require("./core");
const { INVENTORY, NODES } = require("./graph");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "agrimesh-demo-2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "agrimesh-admin-token";

// code -> display label, from the trained-model contract
const labels = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "model", "labels.json"), "utf-8"));
const LABEL = Object.fromEntries(labels.map((l) => [l.code, l.label]));

const reports = []; // { code, label, farmer, start, center, distanceKm, ts }

const app = express();
app.use(cors());
app.use(express.json());

const admin = (req, res, next) =>
  req.get("authorization") === `Bearer ${ADMIN_TOKEN}`
    ? next()
    : res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

app.get("/api/health", (_req, res) => res.json({ ok: true, reports: reports.length }));

// main farmer endpoint: parse payload -> route -> log
app.post("/api/route", (req, res) => {
  if ((req.query.key || req.body.key) !== API_KEY)
    return res.status(401).json({ ok: false, error: "BAD_KEY" });
  try {
    const r = route(req.body.payload, req.body.from || "web-user");
    if (r.ok) reports.unshift({ code: r.code, label: LABEL[r.code] || r.code,
      farmer: r.farmer, start: r.start, center: r.center, distanceKm: r.distanceKm,
      ts: new Date().toISOString() });
    res.json({ ...r, label: LABEL[r.code] || r.code });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/admin/login", (req, res) =>
  req.body.password === ADMIN_PASSWORD
    ? res.json({ ok: true, token: ADMIN_TOKEN })
    : res.status(401).json({ ok: false, error: "BAD_PASSWORD" }));

app.get("/api/admin/reports", admin, (_req, res) => res.json({ ok: true, reports }));

app.get("/api/admin/inventory", admin, (_req, res) =>
  res.json({ ok: true, inventory: INVENTORY, labels: LABEL }));

// live stock edit — the "watch Dijkstra re-route" demo moment
app.put("/api/admin/inventory", admin, (req, res) => {
  const { centerId, code, stockKg } = req.body;
  if (!INVENTORY[centerId]) return res.status(400).json({ ok: false, error: "NO_CENTER" });
  INVENTORY[centerId][code] = Math.max(0, Number(stockKg) || 0);
  res.json({ ok: true, inventory: INVENTORY });
});

// TextBee fallback: run the exact same pipeline without a physical SMS
app.post("/api/admin/simulate", admin, (req, res) => {
  try {
    const r = route(req.body.payload, req.body.from || "sim");
    res.json({ ...r, label: LABEL[r.code] || r.code });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/api/nodes", (_req, res) => res.json(NODES)); // map needs coords

// serve the static frontend from one origin (no CORS headaches in demo)
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => console.log(`AgriMesh on http://localhost:${PORT}`));
