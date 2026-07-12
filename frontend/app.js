// AgriMesh frontend. Works TODAY with a mock classifier; the moment a real
// TensorFlow.js model is dropped in /models/model.json it uses that instead.
const $ = (s) => document.querySelector(s);
let lang = "en", labels = [], model = null, current = null, mapObj = null, nodes = {};
const DEMO_CODES = ["D1Q", "D1O", "D2N"]; // Potato Late/Early Blight, Tomato Late Blight — seeded in inventory
// Below this confidence we escalate to "consult officer" instead of naming a disease.
// 0.85 (not 0.80) because rice sub-classes confuse at ~0.83; better to defer than misadvise.
const CONF_MIN = 0.85;

// ---- geohash encode (matches backend/core.js decoder) ----
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohash(lat, lng, p = 7) {
  let latR = [-90, 90], lngR = [-180, 180], even = true, bit = 0, ch = 0, out = "";
  while (out.length < p) {
    if (even) { const m = (lngR[0] + lngR[1]) / 2; if (lng > m) { ch = (ch << 1) | 1; lngR[0] = m; } else { ch <<= 1; lngR[1] = m; } }
    else { const m = (latR[0] + latR[1]) / 2; if (lat > m) { ch = (ch << 1) | 1; latR[0] = m; } else { ch <<= 1; latR[1] = m; } }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

function t(k) { return (window.T[lang][k]) ?? k; }
function applyLang() {
  document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
  $("#lang").textContent = t("langBtn");
  document.documentElement.lang = lang;
}

// ---- model load: real if present, else deterministic mock ----
async function loadModel() {
  labels = await fetch("models/labels.json").then((r) => r.json());
  try {
    const head = await fetch("models/model.json", { method: "HEAD" });
    if (head.ok) {
      await import("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
      // accept either format the converter produces: LayersModel or GraphModel
      model = await tf.loadLayersModel("models/model.json")
        .catch(() => tf.loadGraphModel("models/model.json"));
      $("#modelStatus").textContent = "AI model ready ✓";
    } else throw 0;
  } catch {
    model = "mock";
    $("#modelStatus").textContent = "Demo model ready ✓ (drop real model.json to go live)";
  }
  $("#analyze").disabled = true; // enabled after an image is chosen
}

async function classify(imgEl, file) {
  if (model && model !== "mock") {
    const tf = window.tf;
    const x = tf.tidy(() => tf.browser.fromPixels(imgEl).resizeBilinear([224, 224]).toFloat().expandDims());
    const probs = await model.predict(x).data(); x.dispose();
    const top3 = [...probs.keys()].sort((a, b) => probs[b] - probs[a]).slice(0, 3)
      .map((i) => ({ label: labels[i], conf: probs[i] }));
    return { label: top3[0].label, conf: top3[0].conf, top3 };
  }
  // mock: deterministic by file size so the same photo always gives the same result
  const h = (file.size + file.name.length) % DEMO_CODES.length;
  const code = DEMO_CODES[h];
  const label = labels.find((l) => l.code === code) || labels[0];
  return { label, conf: 0.9 + ((file.size % 9) / 100), top3: [{ label, conf: 0.9 }] };
}

// ---- leaf-damage estimate: color analysis on canvas, runs offline, no model ----
// This is the "high-pass / edge" image processing the pitch promised — used for
// SEVERITY, not classification. Green = healthy leaf, brown/yellow = lesion.
// ponytail: color-threshold heuristic; the HSV bands are the calibration knob.
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function estimateDamage(img) {
  const N = 200, c = document.createElement("canvas"); c.width = c.height = N;
  c.getContext("2d").drawImage(img, 0, 0, N, N);
  const px = c.getContext("2d").getImageData(0, 0, N, N).data;
  let green = 0, diseased = 0;
  for (let i = 0; i < px.length; i += 4) {
    const [h, s] = rgb2hsv(px[i], px[i + 1], px[i + 2]);
    if (s < 0.15) continue;                    // gray/white background — skip
    if (h >= 55 && h <= 175) green++;          // healthy green tissue
    else if (s > 0.18) diseased++;             // saturated non-green = lesion (brown/yellow/red)
  }
  const leaf = green + diseased;
  // Need a real green leaf to anchor the estimate. Skips fruit / non-leaf frames
  // (e.g. a healthy apple is ~all fruit, no green) so we never invent a % there.
  if (green < N * N * 0.12 || leaf < N * N * 0.04) return null;
  const pct = Math.round((100 * diseased) / leaf);
  return { pct, ...severity(pct) };
}
// severity band -> "how much to cut" advice (EN/HI)
function severity(p) {
  if (p < 10) return { color: "#22c55e",
    band: { en: "Mild", hi: "मामूली" },
    action: { en: "No cutting needed. Remove any spotted leaves and monitor for 3–4 days.",
              hi: "काटने की ज़रूरत नहीं। धब्बेदार पत्तियाँ हटाएँ, 3–4 दिन निगरानी करें।" } };
  if (p < 35) return { color: "#eab308",
    band: { en: "Moderate", hi: "मध्यम" },
    action: { en: "Prune the affected leaves now and spray the recommended pesticide.",
              hi: "प्रभावित पत्तियाँ अभी काटें और अनुशंसित दवा छिड़कें।" } };
  if (p < 60) return { color: "#f97316",
    band: { en: "Severe", hi: "गंभीर" },
    action: { en: "Cut back all affected leaves and treat immediately to stop spread.",
              hi: "सभी प्रभावित पत्तियाँ काटें और फैलाव रोकने हेतु तुरंत उपचार करें।" } };
  return { color: "#ef4444",
    band: { en: "Critical", hi: "अत्यधिक गंभीर" },
    action: { en: "Remove badly affected plants to save the rest; consult an officer.",
              hi: "बाकी फ़सल बचाने हेतु बुरी तरह प्रभावित पौधे हटाएँ; अधिकारी से मिलें।" } };
}
function damageHTML(d) {
  const title = lang === "hi" ? "पत्ती क्षति" : "Leaf damage";
  return `<div class="dmg" style="margin-top:10px">
    <div class="conf">${title}: <b>${d.pct}%</b> · <b style="color:${d.color}">${d.band[lang] || d.band.en}</b></div>
    <div class="bar"><i style="width:${d.pct}%;background:${d.color}"></i></div>
    <p style="margin:6px 0 0;font-size:.92rem">✂️ ${d.action[lang] || d.action.en}</p>
  </div>`;
}

// ---- image pick ----
function showImage(file) {
  const url = URL.createObjectURL(file);
  const img = $("#preview"); img.src = url; img.hidden = false;
  img.onload = () => ($("#analyze").disabled = false);
  current = { file, img };
  $("#resultCard").hidden = true; $("#routeCard").hidden = true;
}
$("#file").addEventListener("change", (e) => e.target.files[0] && showImage(e.target.files[0]));
const drop = $("#drop");
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => { e.preventDefault(); e.dataTransfer.files[0] && showImage(e.dataTransfer.files[0]); });

// ---- analyze ----
$("#analyze").addEventListener("click", async () => {
  $("#analyze").disabled = true; $("#analyze").textContent = t("analyzing");
  const { label, conf, top3 } = await classify(current.img, current.file);
  $("#analyze").textContent = t("analyze");
  const rc = $("#resultCard"); rc.hidden = false;
  const pct = Math.round(conf * 100);

  if (conf < CONF_MIN) {
    // Uncertain — but still useful: show the top candidates for the officer to confirm.
    const cands = top3.map((c) => `${c.label.label} (${Math.round(c.conf * 100)}%)`).join(" · ");
    const lead = lang === "hi" ? "संभावित" : "Possible";
    $("#result").innerHTML = `<div class="uncertain">⚠️ ${t("uncertain")}<br><small>${lead}: ${cands}</small></div>`;
    $("#locBox").hidden = true; return;
  }
  const healthy = label.healthy || label.condition === "rotten";
  $("#result").innerHTML = `
    <div class="diag"><span class="emoji">${healthy ? "✅" : "🦠"}</span>
      <div><h2>${label.label}</h2><div class="conf">${t("confidence") || "Confidence"}: ${pct}%</div></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
  if (healthy) { $("#result").innerHTML += `<p>${t("healthy")}</p>`; $("#locBox").hidden = true; }
  else {
    $("#locBox").hidden = false; current.label = label;
    const dmg = estimateDamage(current.img);        // how much of the leaf is affected + cut advice
    if (dmg) $("#result").innerHTML += damageHTML(dmg);
  }
  rc.scrollIntoView({ behavior: "smooth" });
});

// ---- find route ----
$("#findRoute").addEventListener("click", async () => {
  const v = $("#village").value, n = nodes[v];
  const payload = `${current.label.code} ${geohash(n.lat, n.lng)}`;
  const res = await fetch("/api/route", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload, from: "web", key: "agrimesh-demo-2026" }),
  }).then((r) => r.json());

  const card = $("#routeCard"); card.hidden = false;
  if (!res.ok) { $("#routeInfo").innerHTML = `<div class="uncertain">${t("noStock")}</div>`; drawMap(v, null, []); return; }
  const hindi = expandReply(res);
  const pest = res.pesticide ? (res.pesticide[lang] || res.pesticide.en) : "";
  $("#routeInfo").innerHTML = `
    <p class="pest">💊 <b>${lang === "hi" ? "दवा" : "Pesticide"}:</b> ${pest}</p>
    <div class="route-line">${res.path.map((p) => `<span class="n">${p.replace(/_/g, " ")}</span>`).join(" → ")}</div>
    <p><b>${t("nearest")}:</b> ${res.center.replace("_", " ")} · <b>${t("distance")}:</b> ${res.distanceKm} km · <b>${t("stock")}:</b> ${res.stockKg}kg</p>
    <div class="sms"><b>SMS →</b> ${res.reply}<br><small>${hindi}</small></div>`;
  drawMap(v, res.center, res.path);
  card.scrollIntoView({ behavior: "smooth" });
});

// short code reply -> full local text (this is why the SMS stays 1 segment)
function expandReply(res) {
  const dis = res.label, ctr = res.center.replace("Center_", "");
  const pest = res.pesticide ? (res.pesticide[lang] || res.pesticide.en) : (lang === "hi" ? "दवा" : "pesticide");
  return lang === "hi"
    ? `${dis} की पुष्टि। ${pest} केंद्र ${ctr} पर उपलब्ध (${res.distanceKm} किमी)।`
    : `${dis} confirmed. ${pest} at Center ${ctr} (${res.distanceKm} km).`;
}

// ---- map ----
function drawMap(startName, centerName, pathNames) {
  if (!mapObj) { mapObj = L.map("map"); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© OSM" }).addTo(mapObj); }
  mapObj.eachLayer((l) => l instanceof L.Marker || l instanceof L.Polyline ? mapObj.removeLayer(l) : 0);
  const pts = pathNames.map((p) => [nodes[p].lat, nodes[p].lng]);
  const s = nodes[startName];
  L.marker([s.lat, s.lng]).addTo(mapObj).bindPopup("🧑‍🌾 " + startName);
  if (centerName) {
    const c = nodes[centerName];
    L.marker([c.lat, c.lng]).addTo(mapObj).bindPopup("🏪 " + centerName.replace("_", " "));
    L.polyline(pts, { color: "#1b7a3d", weight: 5 }).addTo(mapObj);
    mapObj.fitBounds(pts, { padding: [30, 30] });
  } else mapObj.setView([s.lat, s.lng], 13);
}

// ---- lang toggle ----
$("#lang").addEventListener("click", () => { lang = lang === "en" ? "hi" : "en"; applyLang(); });

// ---- boot ----
(async () => {
  applyLang();
  nodes = await fetch("/api/nodes").then((r) => r.json());
  const sel = $("#village");
  Object.entries(nodes).filter(([, n]) => !n.center).forEach(([name]) =>
    sel.insertAdjacentHTML("beforeend", `<option value="${name}">${name}</option>`));
  await loadModel();
})();
