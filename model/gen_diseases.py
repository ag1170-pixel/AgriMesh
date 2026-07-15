"""labels.json -> backend/diseases.json  (single source: name, symptoms, management, pesticide).
Rule-based by condition keyword so all 107 classes are covered bilingually without
hand-writing each. Supersedes pesticides.csv (kept for reference). Regenerate:
    python model/gen_diseases.py
"""
import json, os

HERE = os.path.dirname(__file__)
labels = json.load(open(os.path.join(HERE, "labels.json"), encoding="utf-8"))

# pesticide by category (same buckets as gen_pesticides.py)
PEST = {
    "healthy": ("None needed", "कोई ज़रूरत नहीं"),
    "rotten":  ("Discard affected produce", "प्रभावित फल हटा दें"),
    "viral":   ("No cure — remove plants & control insect vector", "कोई इलाज नहीं — पौधे हटाएँ व वाहक कीट नियंत्रित करें"),
    "bacterial": ("Copper + Streptomycin", "कॉपर + स्ट्रेप्टोमाइसिन"),
    "mite":    ("Abamectin (miticide)", "एबामेक्टिन (माइटसाइड)"),
    "insect":  ("Imidacloprid (insecticide)", "इमिडाक्लोप्रिड (कीटनाशक)"),
    "blast":   ("Tricyclazole", "ट्राइसाइक्लाज़ोल"),
    "rust":    ("Propiconazole", "प्रोपिकोनाज़ोल"),
    "powdery": ("Sulfur (wettable)", "गंधक (वेटेबल)"),
    "downy":   ("Mancozeb", "मैंकोज़ेब"),
    "blight":  ("Mancozeb", "मैंकोज़ेब"),
    "scab":    ("Captan", "कैप्टान"),
    "anthracnose": ("Carbendazim", "कार्बेन्डाज़िम"),
    "rot":     ("Copper Fungicide", "ताम्र फफूंदनाशक"),
    "mold":    ("Chlorothalonil", "क्लोरोथैलोनिल"),
    "spot":    ("Copper Oxychloride", "कॉपर ऑक्सीक्लोराइड"),
    "officer": ("Consult agricultural officer", "कृषि अधिकारी से परामर्श करें"),
}

# symptoms + management (list of bullets) per category, EN/HI
INFO = {
 "healthy": {
   "s_en": "Uniform green leaves, no spots, wilting, or discoloration.",
   "s_hi": "एक समान हरी पत्तियाँ, कोई धब्बे, मुरझाना या रंग बदलना नहीं।",
   "m_en": ["No treatment needed.", "Keep monitoring weekly.", "Maintain field hygiene and balanced watering."],
   "m_hi": ["उपचार की आवश्यकता नहीं।", "साप्ताहिक निगरानी करते रहें।", "खेत की सफाई व संतुलित सिंचाई बनाए रखें।"] },
 "rotten": {
   "s_en": "Soft, discolored, decaying tissue — a post-harvest/storage rot, not a field leaf disease.",
   "s_hi": "नरम, बदरंग, सड़ता ऊतक — यह भंडारण की सड़न है, खेत का पत्ती रोग नहीं।",
   "m_en": ["Discard affected produce to stop spread.", "Store in a cool, dry, ventilated place.", "Do not mix rotten with healthy stock."],
   "m_hi": ["फैलाव रोकने हेतु प्रभावित उपज हटा दें।", "ठंडी, सूखी, हवादार जगह भंडारण करें।", "सड़ी उपज को स्वस्थ उपज से अलग रखें।"] },
 "viral": {
   "s_en": "Mottled, curled, yellow-streaked or distorted leaves; stunted growth. Spread by insects (whitefly/aphids).",
   "s_hi": "चितकबरी, मुड़ी, पीली धारीदार या विकृत पत्तियाँ; बौना विकास। कीटों (सफेद मक्खी/माहू) से फैलता है।",
   "m_en": ["No chemical cure — remove and destroy infected plants.", "Control the insect vector (whitefly/aphid).", "Use virus-free seed and resistant varieties."],
   "m_hi": ["कोई रासायनिक इलाज नहीं — संक्रमित पौधे हटाकर नष्ट करें।", "वाहक कीट (सफेद मक्खी/माहू) नियंत्रित करें।", "वायरस-मुक्त बीज व प्रतिरोधी किस्में उपयोग करें।"] },
 "bacterial": {
   "s_en": "Small water-soaked spots that turn brown with yellow halos; may ooze in humid weather.",
   "s_hi": "छोटे जल-भीगे धब्बे जो भूरे व पीले घेरे वाले हो जाते हैं; नमी में रिस सकते हैं।",
   "m_en": ["Spray copper + streptomycin.", "Remove infected debris; avoid overhead irrigation.", "Rotate crops and use clean seed."],
   "m_hi": ["कॉपर + स्ट्रेप्टोमाइसिन छिड़कें।", "संक्रमित अवशेष हटाएँ; ऊपर से सिंचाई न करें।", "फसल चक्र अपनाएँ व स्वच्छ बीज लें।"] },
 "mite": {
   "s_en": "Fine yellow stippling, tiny webbing, and bronzing on the underside of leaves.",
   "s_hi": "पत्तियों की निचली सतह पर बारीक पीले बिंदु, महीन जाला व कांस्य रंगत।",
   "m_en": ["Spray a miticide (abamectin).", "Wash undersides with water; raise humidity.", "Remove heavily infested leaves."],
   "m_hi": ["माइटसाइड (एबामेक्टिन) छिड़कें।", "निचली सतह पानी से धोएँ; नमी बढ़ाएँ।", "अधिक प्रभावित पत्तियाँ हटाएँ।"] },
 "insect": {
   "s_en": "Chewed/holed leaves, visible insects or larvae, and sticky honeydew or sooty patches.",
   "s_hi": "कटी/छिद्रित पत्तियाँ, दिखते कीट या लार्वा, चिपचिपा मधुरस या काली परत।",
   "m_en": ["Spray a recommended insecticide (imidacloprid).", "Set yellow sticky traps.", "Remove weeds that host the pest."],
   "m_hi": ["अनुशंसित कीटनाशक (इमिडाक्लोप्रिड) छिड़कें।", "पीले चिपचिपे ट्रैप लगाएँ।", "कीट को पनाह देने वाले खरपतवार हटाएँ।"] },
 "blast": {
   "s_en": "Spindle-shaped grey lesions with brown borders on leaves; dark rotting at the neck of the panicle.",
   "s_hi": "पत्तियों पर भूरे किनारे वाले धुरी-आकार के धूसर घाव; बाली की गर्दन पर काला सड़न।",
   "m_en": ["Spray tricyclazole at early symptoms.", "Avoid excess nitrogen fertilizer.", "Drain the field periodically; use resistant varieties."],
   "m_hi": ["शुरुआती लक्षण पर ट्राइसाइक्लाज़ोल छिड़कें।", "अधिक नाइट्रोजन खाद से बचें।", "खेत समय-समय पर सुखाएँ; प्रतिरोधी किस्में लें।"] },
 "rust": {
   "s_en": "Reddish-brown to orange powdery pustules on the leaf surface that rub off onto fingers.",
   "s_hi": "पत्ती की सतह पर लाल-भूरे से नारंगी चूर्णी दाने जो उँगली पर लग जाते हैं।",
   "m_en": ["Spray propiconazole.", "Remove and destroy infected leaves.", "Avoid overhead watering; grow resistant varieties."],
   "m_hi": ["प्रोपिकोनाज़ोल छिड़कें।", "संक्रमित पत्तियाँ हटाकर नष्ट करें।", "ऊपर से सिंचाई न करें; प्रतिरोधी किस्में लगाएँ।"] },
 "powdery": {
   "s_en": "White to grey powdery coating on the upper leaf surface; leaves may yellow and dry.",
   "s_hi": "ऊपरी पत्ती सतह पर सफेद-धूसर चूर्णी परत; पत्तियाँ पीली होकर सूख सकती हैं।",
   "m_en": ["Dust or spray wettable sulfur.", "Improve air flow; avoid dense canopy.", "Remove affected leaves early."],
   "m_hi": ["वेटेबल गंधक छिड़कें या भुरकें।", "हवा का प्रवाह बढ़ाएँ; घनी छतरी से बचें।", "प्रभावित पत्तियाँ जल्दी हटाएँ।"] },
 "downy": {
   "s_en": "Pale/yellow patches on top of leaves with greyish fuzzy growth underneath.",
   "s_hi": "पत्तियों के ऊपर पीले धब्बे और नीचे धूसर रोएँदार वृद्धि।",
   "m_en": ["Spray mancozeb.", "Reduce leaf wetness; water at the base early in the day.", "Space plants for good airflow."],
   "m_hi": ["मैंकोज़ेब छिड़कें।", "पत्ती की नमी घटाएँ; दिन में जल्दी जड़ पर सिंचाई करें।", "अच्छी हवा हेतु पौधों में दूरी रखें।"] },
 "blight": {
   "s_en": "Dark brown/black spreading patches on leaves, often with a pale halo; leaves collapse fast in humid weather.",
   "s_hi": "पत्तियों पर गहरे भूरे/काले फैलते धब्बे, अक्सर हल्के घेरे के साथ; नमी में पत्तियाँ तेज़ी से गिरती हैं।",
   "m_en": ["Spray mancozeb without delay.", "Remove and destroy affected leaves.", "Avoid evening irrigation; do not work in wet fields."],
   "m_hi": ["बिना देर मैंकोज़ेब छिड़कें।", "प्रभावित पत्तियाँ हटाकर नष्ट करें।", "शाम की सिंचाई न करें; गीले खेत में काम न करें।"] },
 "scab": {
   "s_en": "Olive-green to brown corky, scab-like lesions on leaves and fruit.",
   "s_hi": "पत्तियों व फल पर जैतूनी-हरे से भूरे कॉर्क जैसे खुरदरे घाव।",
   "m_en": ["Spray captan at bud/early leaf stage.", "Rake and destroy fallen leaves.", "Prune for airflow; use resistant varieties."],
   "m_hi": ["कली/शुरुआती पत्ती अवस्था पर कैप्टान छिड़कें।", "गिरी पत्तियाँ बटोरकर नष्ट करें।", "हवा हेतु छँटाई करें; प्रतिरोधी किस्में लें।"] },
 "anthracnose": {
   "s_en": "Sunken dark lesions with concentric rings on leaves, stems, or fruit.",
   "s_hi": "पत्ती, तने या फल पर संकेंद्रित छल्लों वाले धँसे गहरे घाव।",
   "m_en": ["Spray carbendazim.", "Remove infected plant parts and debris.", "Avoid overhead irrigation."],
   "m_hi": ["कार्बेन्डाज़िम छिड़कें।", "संक्रमित भाग व अवशेष हटाएँ।", "ऊपर से सिंचाई न करें।"] },
 "rot": {
   "s_en": "Dark firm rot on leaves/fruit/stem; tissue shrivels and may show tiny black dots.",
   "s_hi": "पत्ती/फल/तने पर गहरा कठोर सड़न; ऊतक सिकुड़ता व छोटे काले बिंदु दिख सकते हैं।",
   "m_en": ["Spray copper fungicide.", "Prune and destroy infected parts.", "Improve drainage and airflow."],
   "m_hi": ["ताम्र फफूंदनाशक छिड़कें।", "संक्रमित भाग काटकर नष्ट करें।", "जल निकास व हवा बेहतर करें।"] },
 "mold": {
   "s_en": "Pale spots on top with velvety olive-green to brown mold on the underside of leaves.",
   "s_hi": "ऊपर हल्के धब्बे और पत्ती के नीचे मखमली जैतूनी-भूरा फफूंद।",
   "m_en": ["Spray chlorothalonil.", "Lower humidity; increase ventilation.", "Remove affected lower leaves."],
   "m_hi": ["क्लोरोथैलोनिल छिड़कें।", "नमी घटाएँ; हवादारी बढ़ाएँ।", "प्रभावित निचली पत्तियाँ हटाएँ।"] },
 "spot": {
   "s_en": "Round brown/grey spots, often with darker margins or yellow halos, scattered across the leaf.",
   "s_hi": "पत्ती पर बिखरे गोल भूरे/धूसर धब्बे, अक्सर गहरे किनारे या पीले घेरे के साथ।",
   "m_en": ["Spray copper oxychloride.", "Remove spotted leaves and debris.", "Avoid wetting foliage; rotate crops."],
   "m_hi": ["कॉपर ऑक्सीक्लोराइड छिड़कें।", "धब्बेदार पत्तियाँ व अवशेष हटाएँ।", "पत्तियाँ भिगोने से बचें; फसल चक्र अपनाएँ।"] },
 "officer": {
   "s_en": "Symptoms are unclear or overlap with several conditions.",
   "s_hi": "लक्षण अस्पष्ट हैं या कई रोगों से मिलते-जुलते हैं।",
   "m_en": ["Consult your local agricultural officer before treating.", "Take clear close-up photos of affected leaves.", "Avoid random pesticide use."],
   "m_hi": ["उपचार से पहले स्थानीय कृषि अधिकारी से परामर्श करें।", "प्रभावित पत्तियों की स्पष्ट नज़दीकी फोटो लें।", "बिना जाने दवा का प्रयोग न करें।"] },
}

def category(cond):
    c = cond
    has = lambda *k: any(x in c for x in k)
    if c == "healthy": return "healthy"
    if c == "rotten":  return "rotten"
    if has("mosaic", "curl", "streak", "mottle"): return "viral"
    if has("bacterial"):        return "bacterial"
    if has("mite", "spider"):   return "mite"
    if has("caterpillar", "whitefly", "hispa", "diabrotica"): return "insect"
    if has("blast"):            return "blast"
    if has("rust"):             return "rust"
    if has("powdery"):          return "powdery"
    if has("downy"):            return "downy"
    if has("blight"):           return "blight"
    if has("scab"):             return "scab"
    if has("anthracnose"):      return "anthracnose"
    if has("rot", "measles"):   return "rot"
    if has("mold", "target"):   return "mold"
    if has("spot", "septoria", "cercospora", "scorch", "algal", "bird_eye", "brown_blight"): return "spot"
    return "officer"

out = {}
for l in labels:
    cat = category(l["condition"])
    info, pest = INFO[cat], PEST.get(cat, PEST["officer"])
    out[l["code"]] = {
        "name_en": l["label"],
        "name_hi": l["label"],  # labels are EN; HI name shown alongside in UI where needed
        "crop": l["crop"], "condition": l["condition"], "healthy": l["healthy"],
        "symptoms_en": info["s_en"], "symptoms_hi": info["s_hi"],
        "management_en": info["m_en"], "management_hi": info["m_hi"],
        "pesticide_en": pest[0], "pesticide_hi": pest[1],
    }

dest = os.path.join(HERE, "..", "backend", "diseases.json")
json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# sanity
assert len(out) == len(labels)
assert all(out[c]["symptoms_en"] and out[c]["management_en"] for c in out)
cats = {}
for l in labels: cats[category(l["condition"])] = cats.get(category(l["condition"]), 0) + 1
print(f"wrote {len(out)} diseases -> {os.path.relpath(dest)}")
print("category spread:", dict(sorted(cats.items(), key=lambda x: -x[1])))
