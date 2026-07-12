# AgriMesh

Offline-first crop-disease detection → pesticide routing over SMS. The phone's
AI reads the leaf; only an ~11-byte decision crosses the network (works on 2G).
The image never travels — so the "can't fit a photo in an SMS" wall never applies.

> **New here / taking over the project?** Read **[HANDOFF.md](HANDOFF.md)** — it has
> the full status (done / left), architecture, how to deploy, and how to retrain.

## Run the demo (1 command)

```bash
cd backend && npm install && npm start
# App:   http://localhost:3000      Admin: http://localhost:3000/admin.html  (pw: admin123)
```

Runs fully in-memory — no database, no keys, no phone needed. The **trained model
is committed** (`frontend/models/`), so the AI works right after clone.
Tests: `node backend/test.js`.

## What works today

- **On-device AI** — MobileNetV2, 107 crop/disease classes, **90.2% val / 91.2% unseen**, runs in-browser (TensorFlow.js).
- **Confidence gate (0.85)** — low confidence → "consult officer", never a risky wrong answer.
- **Top-3 candidates** when uncertain (useful for look-alike classes like rice).
- **Leaf-damage %** + "how much to cut" advice (canvas color analysis, EN/HI).
- **Stock-aware Dijkstra routing** — skips empty centers automatically; live re-route in the admin panel.
- **SMS layer** — TextBee / Fast2SMS / logged-mock (env-switch) + inbound webhook.
- **Admin panel** — inventory edit, "Simulate SMS" full round-trip, reports.

## Repo map

| Path | What |
|---|---|
| `backend/server.js` | Express API + serves the frontend (in-memory store) |
| `backend/core.js` | payload parse · geohash · **stock-aware Dijkstra** · SMS reply |
| `backend/sms.js` | `sendSMS()` — TextBee / Fast2SMS / mock |
| `backend/test.js` | `node backend/test.js` → runnable proof |
| `frontend/` | app + admin panel, no build step; `models/` holds the trained model |
| `model/agrimesh_train.ipynb` | training notebook (**Kaggle** or Colab) |
| `model/build_notebook.py` | generates the notebook — **edit here**, not the .ipynb |
| `payload_demo.py` | proof the SMS math fits (11 bytes in, 1-segment reply out) |

## What's next

See **[HANDOFF.md §4](HANDOFF.md)** — prioritized: deploy (Railway) · pesticide
mapping · DB persistence · real SMS · PWA offline. Retraining is optional; the
model is already solid.

## Demo script for judges

1. Upload a leaf → disease + confidence + **damage % and cut advice** (offline, on-device).
2. Pick a village → **map draws the route** to the nearest center *with stock*.
3. `/admin.html` → set that center's stock to 0 → re-run → **Dijkstra reroutes**. Live, not hardcoded.
4. Show `SMS → R:1Q C:A D:5.5`: 11 bytes in, one SMS out. No image ever sent.
