# AgriMesh — Handoff Guide

Everything you need to continue this project. Read top to bottom once, then keep
it open as a map.

---

## 1. What AgriMesh is (30-second version)

A farmer photographs a diseased leaf. The **AI runs on the phone** (offline) and
identifies the disease + how badly the leaf is damaged. Only an **~11-byte text
decision** crosses the network (works on 2G) — the image never travels. A backend
receives it, runs **stock-aware routing (Dijkstra)** to the nearest supply center
that actually has the pesticide, and texts the answer back.

**The core insight:** we don't move data (a megabyte photo), we move a *decision*
(11 bytes). That's why the "can't fit a photo in an SMS" wall never applies.

---

## 2. Run it right now (1 command, nothing to set up)

```bash
cd backend && npm install && npm start
# App:   http://localhost:3000
# Admin: http://localhost:3000/admin.html   (password: admin123)
```

No database, no API keys, no phone needed. The trained model **is in the repo**
(`frontend/models/`), so the AI works immediately after clone.

Run the tests: `node backend/test.js` → should print `all pass`.

---

## 3. Status — what is DONE ✅

| Area | Done | Notes |
|---|---|---|
| **AI model** | ✅ | MobileNetV2, 107 crop/disease classes, **90.2% val / 91.2% unseen**. Committed at `frontend/models/model.json` (+ shards). |
| **Image → diagnosis** | ✅ | Runs in-browser (TensorFlow.js, WebGL), offline after first load. |
| **Confidence gate** | ✅ | Below **0.85** → "consult officer" instead of a risky wrong answer. |
| **Top-3 candidates** | ✅ | When uncertain, shows ranked possibilities (useful for hard classes like rice). |
| **Leaf damage %** | ✅ | Canvas color analysis → severity band + "how much to cut" advice (EN/HI). |
| **SMS payload** | ✅ | `D<code> <geohash>` = 11 bytes, 1 SMS. Phone# = sender header (not sent). |
| **Routing** | ✅ | Stock-aware Dijkstra (min-heap). Empty centers are skipped automatically. |
| **Backend API** | ✅ | Express, in-memory store, serves the frontend. See §5 for endpoints. |
| **Admin panel** | ✅ | Login, live inventory edit, "Simulate SMS" (full round-trip), reports table. |
| **SMS gateway layer** | ✅ | TextBee / Fast2SMS / logged-mock, switch by env var. Inbound webhook works. |
| **Tests** | ✅ | `backend/test.js` (routing + SMS mock). Integration verified in-browser. |
| **Bilingual** | ⚠️ partial | Core UI + SMS + damage advice are EN/HI. Some strings still English-only. |

---

## 4. Status — what is LEFT ❌ (priority order + how to do it)

### P1 — Deploy to a live URL  *(most important; ~1–2 hrs)*
The backend is a **stateful Express server** (reports live in memory), so it
does **not** fit Vercel serverless cleanly. Use **Railway or Render** instead —
they run the Express process as-is.

Process:
1. Push is already done. On [railway.app](https://railway.app) → New Project →
   Deploy from GitHub → pick this repo.
2. Root/Start command: `cd backend && npm install && npm start`. Set `PORT` (Railway
   provides `$PORT` automatically; the server already reads `process.env.PORT`).
3. The frontend is served by the same Express app, so one deploy = whole app.
4. (Optional) On Render free tier, add an UptimeRobot ping to `/api/health` every
   10 min to avoid cold-start sleep.

### P2 — Pesticide / treatment mapping  *(~30–60 min)*
Right now the reply says a generic "pesticide available." Make it name the actual
treatment.
1. Create `backend/pesticides.csv`: `code,pesticide_en,pesticide_hi` (e.g.
   `D1Q,Copper Fungicide,ताम्र फफूंदनाशक`). Codes come from `model/labels.json`.
2. Load it in `backend/server.js` like `labels.json` is loaded (line ~17).
3. Include the pesticide name in the `/api/route` response and in the frontend
   `expandReply()` in `frontend/app.js` (~line 118).

### P3 — Persist data (optional for demo, needed for real use)  *(~1–2 hrs)*
`reports` and `INVENTORY` reset on restart. Swap the in-memory arrays for
**MongoDB Atlas** (free tier). Only `backend/server.js` changes — the routing
core (`core.js`) is storage-agnostic. Collections: `reports`, `inventory`.

### P4 — Real SMS via TextBee  *(needs a spare Android phone)*
1. Install the TextBee app (textbee.dev) on an Android phone, generate an API key
   + device ID.
2. `cp backend/.env.example backend/.env` and fill `TEXTBEE_API_KEY` +
   `TEXTBEE_DEVICE_ID`. Restart. `sendSMS()` auto-switches from mock to real.
3. Point the TextBee inbound webhook at `POST /api/sms/inbound?key=agrimesh-demo-2026`.
No code change — the adapter is already written (`backend/sms.js`).

### P5 — PWA offline polish  *(~1 hr)*
`manifest.json` exists (installable). Add a service worker that caches the app
shell + `models/` so it truly works offline after first load. Keep it simple.

### Stretch / future ML work
- **Leaf-damage on field photos:** the current % is a color heuristic — reliable on
  clean backgrounds, can over-estimate on soil/field backgrounds. A small
  **segmentation model** (leaf mask) would fix this. See §6.
- **Rice accuracy:** rice brown-spot / leaf-blast / healthy genuinely look alike
  (~45% among themselves). A stronger backbone (EfficientNetB0 / MobileNetV3) *might*
  help a few points. See §7 for the exact retrain path. Not required — the gate +
  top-3 already handle it safely.
- **Disease outbreak heatmap** on the admin dashboard (Leaflet.heat over `reports`).

---

## 5. Repo map (where everything lives)

```
backend/
  server.js      Express app, API endpoints, serves frontend, in-memory store
  core.js        payload parse · geohash decode · stock-aware Dijkstra · SMS reply text
  sms.js         sendSMS(phone,text): TextBee / Fast2SMS / mock (env-driven)
  graph.js       hardcoded 15-node road graph + inventory (the demo district)
  test.js        `node backend/test.js` — routing + SMS unit checks
  .env.example   copy to .env for real SMS keys (.env is gitignored)
frontend/
  index.html     the farmer app
  app.js         classify · confidence gate · top-3 · leaf-damage · route · map (no build step)
  admin.html     admin panel (inventory, simulate SMS, reports)
  style.css      styles       translations.js  EN/HI strings
  models/        model.json + *.bin (trained model, COMMITTED) + labels.json (the contract)
model/
  agrimesh_train.ipynb  the training notebook (Kaggle or Colab) — regenerated from build_notebook.py
  build_notebook.py     generator for the .ipynb (edit HERE, then re-run to rebuild the notebook)
  normalize.py          134 folders → 107 classes logic (also inlined in the notebook)
  class_map.csv          folder → canonical class → D-code
  labels.json            model output index → disease + D-code (MUST match frontend/models/labels.json)
  train.py               older standalone script (the notebook supersedes it)
payload_demo.py   proof the SMS byte math fits (11 bytes in, 1-segment reply out)
```

**Backend endpoints** (all JSON):
- `GET  /api/health` — liveness
- `POST /api/route` — `{payload, key}` → route result (web app uses this)
- `POST /api/sms/inbound` — `{from, message, key}` → route + sends reply SMS (real gateway / simulate)
- `POST /api/admin/login` — `{password}` → `{token}`
- `GET  /api/admin/reports` — (Bearer) all reports
- `GET/PUT /api/admin/inventory` — (Bearer) read / edit stock
- `POST /api/admin/simulate` — (Bearer) `{payload, from}` → route + reply (phone-free demo)
- `GET  /api/nodes` — graph node coords (map needs them)

Default secrets (change for production): `API_KEY=agrimesh-demo-2026`,
`ADMIN_PASSWORD=admin123`, `ADMIN_TOKEN=agrimesh-admin-token`.

---

## 6. The dataset (NOT in the repo — it's 55k images)

- The repo intentionally **excludes** the image dataset (`.gitignore`) — too big.
- The **trained model is included**, so you can run/continue the app without it.
- You only need the dataset to **retrain**. It's on Kaggle as `bunny2812/dataset`
  (or the original `archive (1).zip`, 134 folders under `dataset_clean_final/`).

---

## 7. How to (re)train the model — only if you want to improve it

The current model is good (90%+). If you still want to try a better one:

1. Open `model/agrimesh_train.ipynb` on **Kaggle** (Code → Import Notebook → GitHub
   → `ag1170-pixel/AgriMesh`).
2. Add the dataset via **+ Add Input**, enable **GPU T4 x2** in Settings.
3. **Use "Save Version → Save & Run All (Commit)"** — it runs in the background on
   Kaggle's servers, so a closed tab / disconnect can't kill it. (This solved the
   original training pain.)
4. It normalizes 134 folders → 107 classes, trains, runs a **quality gate** (refuses
   to export a broken model), and outputs `web_model.zip`.
5. Unzip its contents into `frontend/models/` (replacing the old files). The app
   auto-detects — no code change.

**To try a stronger backbone** (the one real accuracy lever): in `model/build_notebook.py`,
Cell 6, replace `MobileNetV2` with `EfficientNetB0` (and its `preprocess_input`),
re-run `python model/build_notebook.py` to rebuild the notebook, then retrain.
Expect a small overall gain and *maybe* better rice separation. Not guaranteed.

⚠️ **Edit the notebook via `build_notebook.py`, not the .ipynb directly** — the .ipynb
is generated. If you edit it on Kaggle, that's fine, but keep `build_notebook.py`
in sync or your next regenerate will overwrite your changes.

---

## 8. Gotchas a new dev must know

- **Model is committed** (~9.4 MB in `frontend/models/`). Clone → it just works.
- **Backend is stateful** (in-memory). Restart = reports/inventory reset. Fine for
  demo; use MongoDB for real (P3). This is why Vercel serverless is a poor fit — use
  Railway/Render.
- **`labels.json` is a contract** — `model/labels.json` and `frontend/models/labels.json`
  must match the model's output order. They're generated together by the notebook.
  Don't hand-edit.
- **SMS is mock by default** — no keys = it logs instead of sending. Safe. Real SMS
  needs env vars + an Android phone (P4).
- **Leaf-damage % is a heuristic**, not a measurement — accurate on clean-background
  leaf photos, approximate on field/soil backgrounds. Framed as "approximate" in the UI.
- **Confidence gate is 0.85** (`CONF_MIN` in `app.js`) — deliberately conservative so
  we never confidently misadvise a pesticide.

---

## 9. Demo script (for judges)

1. Upload a leaf → disease + confidence + **leaf-damage % and cut advice** (offline).
2. Pick a village → **map draws the route** to the nearest center *with stock*.
3. In `/admin.html` → set that center's stock to 0 → re-run → **Dijkstra reroutes**
   to the next stocked center. Live proof the routing is dynamic.
4. Show `SMS → R:1Q C:A D:5.5`: 11 bytes in, one SMS out, image never sent.
5. (Optional) Real TextBee SMS to a phone for the "2G authenticity" moment.
