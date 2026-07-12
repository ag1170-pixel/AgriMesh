# AgriMesh — How it works, in plain English

Written so anyone can understand it *and* explain it to a judge. No jargon needed.
(Technical to-do list is in [HANDOFF.md](HANDOFF.md); this file is the "why & how".)

---

## 1. The story it solves

A farmer sees dark spots on his crop. He doesn't know the disease. He has a cheap
phone with **almost no internet** — one bar of 2G on a good day. The nearest expert
is a day away. So he waits, the disease spreads, and the crop dies. The cure — a
₹200 pesticide — was sitting in a shop 5 km away the whole time.

He didn't lose the crop because the cure didn't exist. He lost it because
**the right information didn't reach him in time.**

**AgriMesh closes that gap:** photograph the leaf → the phone itself tells you the
disease and where the medicine is → the answer comes back as a normal text message.

---

## 2. The one big idea (say this to judges)

Everyone else tries to send the **photo** to a server for analysis. But a photo is
about a **million bytes**, and one SMS holds only **140 bytes**. You cannot squeeze
a photo through an SMS — that's a law of math, not a coding problem.

So AgriMesh flips it:

> **We don't move the data (the photo). We move the decision (the answer).**

The AI runs **on the phone**. After it reads the leaf, all that needs to travel is
"disease #10, at this location" — about **11 bytes**. That fits in one SMS with
room to spare.

**Analogy:** A doctor examines you for an hour, then writes one small prescription
slip. You don't carry the X-ray machine to the pharmacy — you carry the slip. The
photo is the X-ray; our 11-byte SMS is the slip.

That single insight is why AgriMesh works where every cloud app fails — in places
with no internet.

---

## 3. The journey of one leaf (step by step)

### Step 1 — The phone reads the leaf (offline)
The farmer opens a web link (no app-store download) and takes a photo. A small AI
model — **already downloaded once, ~9 MB** — looks at it and says, e.g., *"Potato
Late Blight, 99% sure."* This happens **on the phone, with no internet**, in about
a second.

- **Why on the phone?** Because the farmer has no internet in the field. We put the
  "doctor" inside the phone instead of in the cloud.
- **What is the AI?** A trained image classifier (MobileNetV2). It learned from
  ~50,000 leaf/crop photos across **107 disease types** and is right **~90%** of the time.

### Step 2 — It also measures how bad it is
Using simple color analysis (green = healthy, brown/yellow = damaged), the app
estimates **what % of the leaf is diseased** and gives advice — *"15% damage,
Moderate — prune the affected leaves."* This is the "how much to cut" feature.

- **Why color analysis and not more AI?** It's instant, runs offline, and needs no
  extra model. It's a reasonable estimate, clearly labelled "approximate."

### Step 3 — It builds a tiny 11-byte message
The app turns the result into a short code:

```
D0A ttnfu8r
```
- `D0A` = the disease code
- `ttnfu8r` = the GPS location, packed into 7 characters (a "geohash")
- The farmer's phone number? We **don't send it** — the SMS already carries the
  sender's number in its header, for free. Same for the time (the server stamps it).

**Why so short?** So it fits in a single SMS and travels on 2G. 11 bytes out of 140.

### Step 4 — The server understands the message
A backend receives the SMS. It reads the code (`D0A` → "Late Blight"), checks it's a
real disease, and saves it. Over time these saved messages quietly build a **live
map of disease outbreaks** across the region — a bonus product.

### Step 5 — It finds the nearest shop *with the medicine in stock*
This is the clever routing part. The server knows the villages, the roads between
them, and which supply center has which pesticide in stock. It runs **Dijkstra's
algorithm** (the same "shortest path" idea inside Google Maps) — but with one twist:

> **A shop with zero stock is treated as if it doesn't exist.**

So if the closest shop is empty but a slightly farther one has the medicine, the
route **skips the empty one** and goes to the stocked one.

**Analogy:** You need an ambulance. The nearest hospital has no bed; the next one
does. A dumb system sends you to the near-but-useless one. Ours sends you where
you'll actually get help. *Near* means nothing without *available*.

### Step 6 — The answer comes back as a text
The farmer gets one SMS: *"Late Blight confirmed. **Mancozeb** at Center B, 4.2 km."*
It even names the **exact pesticide** to ask for. On the app, this route is drawn on
a map that **follows the real roads** (not a straight line across fields).

That's the whole loop: **photo in → text out → cure located.**

---

## 4. Why each technology was chosen (the "why" behind the "what")

| Choice | Why this one |
|---|---|
| **AI on the phone (TensorFlow.js)** | Farmers have no internet in the field. On-device = works offline. |
| **A web app, not a mobile app** | Opens from a link in 2 seconds — no app-store, works on any phone. |
| **Send a code, not the photo** | 140-byte SMS can't hold a photo. The *decision* is tiny; the photo is huge. |
| **Geohash for location** | Packs GPS into 7 characters instead of a long "28.61, 77.20". |
| **Phone number from the SMS header** | It's already there — sending it again would waste bytes. |
| **Dijkstra with a stock check** | Finds the nearest center that can *actually help*, not just the nearest dot. |
| **Confidence gate (85%)** | If unsure, it says "consult an officer" instead of risking wrong advice. |
| **Top-3 guesses when unsure** | Look-alike diseases (like rice) still give the officer useful options. |
| **Real-road map (OSRM)** | The route visually follows streets, so it looks and feels real. |
| **Everything free / in-memory** | $0 to run: free model, free hosting, an old Android as the SMS gateway. |

---

## 5. The parts of the system (what talks to what)

```
[ Farmer's phone ]                        [ Backend server ]
  web app (frontend/)                       Express (backend/)
  • take photo                              • read the SMS code
  • AI reads it (offline)   ── 11-byte ──►  • check it's valid
  • measure damage %          SMS / API     • find nearest stocked center (Dijkstra)
  • show disease + advice   ◄── reply ────  • name the pesticide
  • draw route on a map                     • text the answer back
                                            • admin panel: edit stock, simulate SMS
```

- **frontend/** — what the farmer sees (upload, result, map). Plain HTML/JS, no build step.
- **backend/** — the brain: parses the code, runs the routing, sends the reply.
- **model/** — how the AI was trained (a Kaggle notebook) + the label list.
- The **SMS layer** can use a real gateway (TextBee, via an Android phone) or a
  built-in **mock** for demos — so it works even with no phone.

---

## 6. How to run it (30 seconds)

```bash
cd backend && npm install && npm start
# App:   http://localhost:3000
# Admin: http://localhost:3000/admin.html   (password: admin123)
```

Nothing else to set up — the trained AI is included, the database is in-memory,
no keys needed.

---

## 7. How to demo it to judges (the wow moments)

1. **Upload a leaf** → disease + confidence + damage % + which pesticide, **all offline**.
2. **Pick a village** → the map draws the route to the nearest stocked center, **following real roads**.
3. **Open the admin panel** → set that center's stock to **0** → run again → the route
   **jumps to the next stocked center**. This proves the routing is smart and live, not hardcoded.
4. **Show the SMS:** `R:1Q C:A D:5.5` — 11 bytes out, one text back. The photo never left the phone.

**The line to land it:** *"Everyone else moves data. We move decisions — so a
megabyte of photo becomes 11 bytes of meaning, and it works where the internet doesn't."*

---

## 8. Honest limits (good to know, shows maturity)

- **Rice diseases** (brown spot vs leaf blast) genuinely look alike — the model is
  weaker there, so it shows top-3 guesses and defers rather than risk a wrong call.
- **Damage %** is a color estimate, accurate on clean leaf photos, rough on messy
  field/soil backgrounds. A future segmentation model would make it exact.
- **The map** needs internet (like any map); the *diagnosis* and the *SMS* do not.
- **Data resets on restart** (in-memory) — fine for a demo; a real deployment adds a database.

---

That's the whole thing. If you can tell the story in Section 1, say the one idea in
Section 2, and walk the 6 steps in Section 3, you can explain AgriMesh to anyone. 🌱
