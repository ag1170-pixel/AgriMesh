# AgriMesh

Offline-first crop-disease detection → pesticide routing over SMS. The phone's
AI reads the leaf; only an ~11-byte decision crosses the network (works on 2G).
The image never travels — so the "can't fit a photo in an SMS" wall never applies.

## Run the demo (1 command)

```bash
cd backend && npm install && npm start
# open http://localhost:3000   (app)   ·   /admin.html   (admin, pw: admin123)
```

Runs fully in-memory — no database, no keys, no phone needed. A **demo classifier**
stands in until the real model is trained, so the whole flow is clickable now.

## What's here

| Path | What |
|---|---|
| `model/normalize.py` | 134 messy folders → 107 clean classes (`class_map.csv`) |
| `model/train.py` | MobileNetV2 transfer-learning, **run on Colab** → browser model |
| `model/labels.json` | model output index → disease + D-code (the contract) |
| `backend/core.js` | payload parse · geohash · **stock-aware Dijkstra** · SMS reply |
| `backend/server.js` | Express API + serves the frontend |
| `backend/test.js` | `node backend/test.js` → runnable proof of the routing |
| `frontend/` | app (upload → classify → map) + admin panel, no build step |
| `payload_demo.py` | proof the SMS math fits (11 bytes in, 1-segment reply out) |

## Train the real model (Colab, ~30–60 min on free GPU)

1. Upload `archive (1)/dataset_clean_final/` + `model/class_map.csv`
2. `pip install tensorflow tensorflowjs && python model/train.py`
3. `tensorflowjs_converter --input_format keras model/saved_model.keras frontend/models/`
4. Refresh the app — it auto-detects `model.json`, no code change.

## Demo script for judges

1. Upload a leaf → disease + confidence (offline, on-device).
2. Pick a village → **map draws the route** to the nearest center *with stock*.
3. Open `/admin.html` → set that center's stock to 0 → re-run → **Dijkstra reroutes**
   to the next stocked center. Live proof the routing is dynamic, not hardcoded.
4. Show the `SMS → R:1Q C:A D:5.5`: 11 bytes in, one SMS out. No image ever sent.
