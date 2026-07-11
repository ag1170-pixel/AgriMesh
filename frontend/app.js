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
    let bi = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bi]) bi = i;
    return { label: labels[bi], conf: probs[bi] };
  }
  // mock: deterministic by file size so the same photo always gives the same result
  const h = (file.size + file.name.length) % DEMO_CODES.length;
  const code = DEMO_CODES[h];
  const label = labels.find((l) => l.code === code) || labels[0];
  return { label, conf: 0.9 + ((file.size % 9) / 100) };
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
  const { label, conf } = await classify(current.img, current.file);
  $("#analyze").textContent = t("analyze");
  const rc = $("#resultCard"); rc.hidden = false;
  const pct = Math.round(conf * 100);

  if (conf < CONF_MIN) {
    $("#result").innerHTML = `<div class="uncertain">⚠️ ${t("uncertain")}<br><small>${label.label} · ${pct}%</small></div>`;
    $("#locBox").hidden = true; return;
  }
  const healthy = label.healthy || label.condition === "rotten";
  $("#result").innerHTML = `
    <div class="diag"><span class="emoji">${healthy ? "✅" : "🦠"}</span>
      <div><h2>${label.label}</h2><div class="conf">${t("confidence") || "Confidence"}: ${pct}%</div></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
  if (healthy) { $("#result").innerHTML += `<p>${t("healthy")}</p>`; $("#locBox").hidden = true; }
  else { $("#locBox").hidden = false; current.label = label; }
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
  $("#routeInfo").innerHTML = `
    <div class="route-line">${res.path.map((p) => `<span class="n">${p.replace(/_/g, " ")}</span>`).join(" → ")}</div>
    <p><b>${t("nearest")}:</b> ${res.center.replace("_", " ")} · <b>${t("distance")}:</b> ${res.distanceKm} km · <b>${t("stock")}:</b> ${res.stockKg}kg</p>
    <div class="sms"><b>SMS →</b> ${res.reply}<br><small>${hindi}</small></div>`;
  drawMap(v, res.center, res.path);
  card.scrollIntoView({ behavior: "smooth" });
});

// short code reply -> full local text (this is why the SMS stays 1 segment)
function expandReply(res) {
  const dis = res.label, ctr = res.center.replace("Center_", "");
  return lang === "hi"
    ? `${dis} की पुष्टि। दवा केंद्र ${ctr} पर उपलब्ध (${res.distanceKm} किमी)।`
    : `${dis} confirmed. Pesticide available at Center ${ctr} (${res.distanceKm} km).`;
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
