"""labels.json -> backend/pesticides.csv  (code, pesticide_en, pesticide_hi).
Rule-based by condition keyword (priority order), so all 107 classes are covered
without hand-mapping each. Regenerate after any label change: python model/gen_pesticides.py
"""
import json, csv, os

HERE = os.path.dirname(__file__)
labels = json.load(open(os.path.join(HERE, "labels.json"), encoding="utf-8"))

# pesticide -> (en, hi)
P = {
    "none":    ("None needed",                     "कोई ज़रूरत नहीं"),
    "discard": ("Discard affected produce",        "प्रभावित फल हटा दें"),
    "viral":   ("No cure — remove plants & control insect vector",
                "कोई इलाज नहीं — पौधे हटाएँ व वाहक कीट नियंत्रित करें"),
    "copper":  ("Copper Fungicide",                "ताम्र फफूंदनाशक"),
    "coppox":  ("Copper Oxychloride",              "कॉपर ऑक्सीक्लोराइड"),
    "bact":    ("Copper + Streptomycin",           "कॉपर + स्ट्रेप्टोमाइसिन"),
    "mancozeb":("Mancozeb",                        "मैंकोज़ेब"),
    "propi":   ("Propiconazole",                   "प्रोपिकोनाज़ोल"),
    "sulfur":  ("Sulfur (wettable)",               "गंधक (वेटेबल)"),
    "chloro":  ("Chlorothalonil",                  "क्लोरोथैलोनिल"),
    "carben":  ("Carbendazim",                     "कार्बेन्डाज़िम"),
    "captan":  ("Captan",                          "कैप्टान"),
    "tricy":   ("Tricyclazole",                    "ट्राइसाइक्लाज़ोल"),
    "abamec":  ("Abamectin (miticide)",            "एबामेक्टिन (माइटसाइड)"),
    "imida":   ("Imidacloprid (insecticide)",      "इमिडाक्लोप्रिड (कीटनाशक)"),
    "officer": ("Consult agricultural officer",    "कृषि अधिकारी से परामर्श करें"),
}

def pick(cond):
    c = cond
    has = lambda *k: any(x in c for x in k)
    if c == "healthy": return "none"
    if c == "rotten":  return "discard"
    if has("mosaic", "curl", "streak", "mottle"): return "viral"   # viral, no chemical cure
    if has("bacterial"):        return "bact"
    if has("mite", "spider"):   return "abamec"
    if has("caterpillar", "whitefly", "hispa", "diabrotica"): return "imida"
    if has("blast"):            return "tricy"                      # rice blast
    if has("rust"):             return "propi"
    if has("powdery"):          return "sulfur"
    if has("downy"):            return "mancozeb"
    if has("blight"):           return "mancozeb"
    if has("scab"):             return "captan"
    if has("anthracnose"):      return "carben"
    if has("rot", "measles"):   return "copper"                    # black rot, red rot, black measles
    if has("mold", "target"):   return "chloro"
    if has("spot", "septoria", "cercospora", "scorch", "algal", "bird_eye", "brown_blight"):
        return "coppox"
    return "officer"                                               # yellowish, diseased, red_stripe, unknown

rows = []
for l in labels:
    en, hi = P[pick(l["condition"])]
    rows.append({"code": l["code"], "pesticide_en": en, "pesticide_hi": hi})

out = os.path.join(HERE, "..", "backend", "pesticides.csv")
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["code", "pesticide_en", "pesticide_hi"])
    w.writeheader(); w.writerows(rows)

# quick sanity: no class left unmapped, count distinct treatments
assert all(r["pesticide_en"] for r in rows)
print(f"wrote {len(rows)} rows -> {os.path.relpath(out)}")
print("distinct pesticides:", len(set(r["pesticide_en"] for r in rows)))
