# AgriMesh

Offline-first crop-disease detection → pesticide routing over SMS. The phone's
AI reads the leaf; only an ~11-byte decision crosses the network (works on 2G).
The image never travels — so the "can't fit a photo in an SMS" wall never applies.

> **New here / taking over the project?**
> - **[EXPLAIN.md](EXPLAIN.md)** — how it works & why, in plain English (start here).
> - **[HANDOFF.md](HANDOFF.md)** — full status (done / left), architecture, deploy, retrain.
> - **[SECURITY.md](SECURITY.md)** — auth, rate limiting, secrets, and the location-safety fix (read before deploying).
> - **[AgriMesh_Pitch.pptx](AgriMesh_Pitch.pptx)** — the judge pitch deck.

## Run the demo (1 command)

```bash
cd backend && npm install && npm start
# App:   http://localhost:3000      Admin: http://localhost:3000/admin.html
```

Runs fully in-memory — no database, no phone needed. The **trained model
is committed** (`frontend/models/`), so the AI works right after clone. In
development, leaving `ADMIN_PASSWORD` unset is fine — the server prints a
random one-time password to the console on boot. Set a real one before
deploying (see [SECURITY.md](SECURITY.md)).
Tests: `node backend/test.js`.

## What works today

- **On-device AI** — MobileNetV2, 107 crop/disease classes, **90.2% val / 91.2% unseen**, runs in-browser (TensorFlow.js).
- **Invalid-capture guard** — heuristic detects non-leaf photos ("Couldn't detect a leaf, recenter"); background class queued for next retrain.
- **Confidence gate (0.70)** + **visible confidence %** — low confidence → "consult officer"; raw % shown to 1 decimal on every diagnosis.
- **Top-3 candidates** when uncertain (useful for look-alike classes like rice).
- **Disease details panel** — 107-entry `diseases.json` (symptoms + management, EN/HI). Auto-shown after confident diagnosis.
- **Disease library** — `library.html`: browse/search all 107 diseases with crop filter chips, expandable detail cards.
- **Camera vs. gallery** — two explicit buttons: "Take Photo" and "Choose from Gallery."
- **Leaf-damage %** + "how much to cut" advice (canvas color analysis, EN/HI).
- **Damage tuning (admin)** — admin sliders for HSV thresholds; "Copy tuned URL" for field staff.
- **Stock-aware Dijkstra routing** — skips empty centers automatically; live re-route in the admin panel.
- **Location-safety guard** — GPS outside the pilot district's road network is rejected explicitly instead of snapping to a fabricated "nearest" village (see [SECURITY.md](SECURITY.md)).
- **Dedicated Send SMS control** — send the routed result to an Indian mobile number, clearly marked demo-mode until a paid SMS gateway is connected.
- **SMS layer** — TextBee / Fast2SMS / logged-mock (env-switch) + inbound webhook.
- **Admin panel** — random expiring session tokens, rate-limited login, inventory edit, "Simulate SMS" full round-trip, reports, damage-tuning sliders.
- **Bilingual EN/HI** — full parity across all UI, SMS, details, library.
- **No emoji anywhere in the shipped app** — plain text/icons only, by design.

## Repo map

| Path | What |
|---|---|
| `backend/server.js` | Express API + serves the frontend (in-memory store) |
| `backend/config.js` | Centralized env/secret loading; fails fast on weak secrets in production |
| `backend/middleware.js` | Rate limiting, admin sessions, input validation, safe error responses |
| `backend/core.js` | payload parse · geohash · **stock-aware Dijkstra** · out-of-area guard · SMS reply |
| `backend/diseases.json` | 107-entry disease encyclopedia (name/symptoms/management/pesticide, EN+HI) |
| `backend/sms.js` | `sendSMS()` — TextBee / Fast2SMS / mock, with phone-masking in logs |
| `backend/test.js` | `node backend/test.js` → runnable proof |
| `frontend/` | app + admin + library, no build step; `models/` holds the trained model |
| `model/agrimesh_train.ipynb` | training notebook (**Kaggle** or Colab) |
| `model/build_notebook.py` | generates the notebook — **edit here**, not the .ipynb |
| `payload_demo.py` | proof the SMS math fits (11 bytes in, 1-segment reply out) |
| `SECURITY.md` | what's hardened, why, and what's still a known limitation |

## What's next

See **[HANDOFF.md §4](HANDOFF.md)** — prioritized: deploy (Railway) · DB persistence ·
real SMS · PWA offline. Retraining is optional; the model is already solid.

## Demo script for judges

1. Upload a leaf → disease + **confidence %** + **symptoms & management** + **damage % and cut advice** (offline, on-device).
2. Browse the **Disease Library** — search/filter all 107 diseases.
3. Pick a village → **map draws the route** to the nearest center *with stock*.
4. `/admin.html` → set that center's stock to 0 → re-run → **Dijkstra reroutes**. Live, not hardcoded.
5. **Damage tuning sliders** (admin) → "Copy tuned URL" for field staff calibration.
6. Show `SMS → R:1Q C:A D:5.5`: 11 bytes in, one SMS out. No image ever sent.
