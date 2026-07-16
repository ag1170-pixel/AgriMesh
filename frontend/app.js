// AgriMesh frontend. Works TODAY with a mock classifier; the moment a real
// TensorFlow.js model is dropped in /models/model.json it uses that instead.
const $ = (s) => document.querySelector(s);
let lang = "en", labels = [], model = null, current = null, mapObj = null, nodes = {};
const DEMO_CODES = ["D1Q", "D1O", "D2N"]; // Potato Late/Early Blight, Tomato Late Blight — seeded in inventory
// Below this confidence we escalate to "consult officer" (top-3 shown) instead of naming
// one disease. 0.70 balances usability on real/field photos against misadvising. Clean
// single-leaf shots score 90-100%; genuinely ambiguous ones (e.g. potato vs tomato late
// blight — same pathogen) stay below and defer.
const CONF_MIN = 0.70;

// This key ships in client-side JS, so it is readable by anyone via view-source
// — it is NOT a secret and provides no real access control. Its only purpose is
// to filter out naive automated hits on the public API; actual abuse protection
// is the server-side rate limiting (see backend/middleware.js). Must match the
// backend's API_KEY default unless that env var has been overridden.
const API_KEY = "public-demo-key";

// Leaf-damage color thresholds — tunable via URL query params (admin sliders build the
// link). The farmer flow ships no params, so it always uses these sane defaults.
const Q = new URLSearchParams(location.search);
const DMG = {
  greenLo: +(Q.get("greenLo") ?? 55), greenHi: +(Q.get("greenHi") ?? 175),
  bgSat: +(Q.get("bgSat") ?? 0.15), lesionSat: +(Q.get("lesionSat") ?? 0.18),
  minLeaf: +(Q.get("minLeaf") ?? 0.12),
};
let lastDetailCode = null;
let lastPayload = null; // set once a route has been found; reused by the Send SMS button

// Escape any string before it goes into innerHTML. Everything here currently
// comes from our own trusted model labels / diseases.json, but escaping is
// cheap defense-in-depth against a future data source (or a compromised CDN
// mirror) injecting markup.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Swap `hidden` for a class toggle so CSS can animate the reveal (fade + slide)
// instead of content just popping into view. Re-triggers the animation even if
// the element was already visible, by removing then re-adding the class on the
// next frame.
function reveal(el) {
  el.hidden = false;
  el.classList.remove("reveal");
  void el.offsetWidth; // force reflow so the class removal/add is seen as a change
  el.classList.add("reveal");
}

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
  document.querySelectorAll("[data-t-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.tPlaceholder)));
  $("#lang").textContent = t("langBtn");
  document.documentElement.lang = lang;
}

// ---- model load: local files if present, else the CDN mirror, else mock ----
// The CDN (jsDelivr, tracking the committed model on GitHub) lets a lightweight
// serverless deploy — one that ships no 9 MB binary — still run the REAL model.
const CDN_MODELS = "https://cdn.jsdelivr.net/gh/ag1170-pixel/AgriMesh@main/frontend/models";
async function loadModel() {
  let base = "models";
  try { const h = await fetch("models/model.json", { method: "HEAD" }); if (!h.ok) base = CDN_MODELS; }
  catch { base = CDN_MODELS; }
  labels = await fetch(base + "/labels.json").then((r) => r.json());
  const statusEl = $("#modelStatus");
  try {
    await import("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
    // accept either format the converter produces: LayersModel or GraphModel
    model = await tf.loadLayersModel(base + "/model.json")
      .catch(() => tf.loadGraphModel(base + "/model.json"));
    statusEl.textContent = "AI model ready";
  } catch {
    model = "mock";
    statusEl.textContent = "Demo model ready";
  }
  statusEl.classList.remove("loading");
  // NOTE: do NOT touch #analyze.disabled here. It already starts disabled in
  // the HTML and is enabled by showImage()'s img.onload once a photo is
  // picked. Model loading is a slow network fetch (TF.js + weights from a
  // CDN) that can easily finish AFTER the user has already picked a sample
  // image — re-disabling the button here would silently undo that enable
  // and leave Analyze looking permanently greyed out, which is exactly what
  // was happening for the demo samples.
}

async function classify(imgEl, file) {
  if (model && model !== "mock") {
    const tf = window.tf;
    // Read at NATURAL resolution. The on-screen <img> is CSS-scaled (width:100%,
    // object-fit), so tf.browser.fromPixels(imgEl) would grab that distorted layout
    // size — silently classifying every photo at the wrong aspect ratio. Drawing to an
    // offscreen canvas at naturalW×naturalH fixes it. Then center-crop to a square so
    // the (usually centered) leaf fills the frame and side background is dropped.
    const nw = imgEl.naturalWidth || imgEl.width, nh = imgEl.naturalHeight || imgEl.height;
    const cnv = document.createElement("canvas"); cnv.width = nw; cnv.height = nh;
    cnv.getContext("2d").drawImage(imgEl, 0, 0, nw, nh);
    const x = tf.tidy(() => {
      const px = tf.browser.fromPixels(cnv);
      const [h, w] = px.shape;
      const s = Math.min(h, w), top = (h - s) >> 1, left = (w - s) >> 1;
      return px.slice([top, left, 0], [s, s, 3]).resizeBilinear([224, 224]).toFloat().expandDims();
    });
    const logits = model.predict(x);
    const probs = await logits.data();
    tf.dispose([x, logits]);      // dispose BOTH — the output tensor leaked GPU memory each run
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
// Green = healthy leaf, brown/yellow = lesion. Used for SEVERITY, not classification.
// Color-threshold heuristic; the HSV bands are the calibration knob (admin sliders).
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
    if (s < DMG.bgSat) continue;                       // gray/white background — skip
    if (h >= DMG.greenLo && h <= DMG.greenHi) green++; // healthy green tissue
    else if (s > DMG.lesionSat) diseased++;            // saturated non-green = lesion
  }
  const leaf = green + diseased;
  // Need a real green leaf to anchor the estimate. Skips fruit / non-leaf frames
  // (e.g. a healthy apple is ~all fruit, no green) so we never invent a % there.
  if (green < N * N * DMG.minLeaf || leaf < N * N * 0.04) return null;
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
  return `<div class="dmg reveal" style="margin-top:10px">
    <div class="conf">${title}: <b>${d.pct}%</b> &middot; <b style="color:${d.color}">${esc(d.band[lang] || d.band.en)}</b></div>
    <div class="bar"><i style="width:${d.pct}%;background:${d.color}"></i></div>
    <p style="margin:6px 0 0;font-size:.92rem">${esc(d.action[lang] || d.action.en)}</p>
  </div>`;
}

// ---- image pick ----
let lastUrl = null;
function showImage(file) {
  if (lastUrl) URL.revokeObjectURL(lastUrl);      // free the previous blob
  const url = URL.createObjectURL(file); lastUrl = url;
  const img = $("#preview"); reveal(img);
  img.onload = () => ($("#analyze").disabled = false);
  img.src = url;
  current = { file, img };
  $("#resultCard").hidden = true; $("#routeCard").hidden = true;
}
// both inputs (Take Photo / Choose from Gallery) feed the same handler.
// reset value after each pick so re-selecting the SAME file still fires change.
document.querySelectorAll(".filein").forEach((inp) =>
  inp.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) showImage(f); e.target.value = ""; }));

// demo sample buttons — guaranteed clean, high-confidence images for the live demo
document.querySelectorAll(".demo").forEach((b) => b.addEventListener("click", async () => {
  const blob = await fetch(`demo/${b.dataset.img}.jpg`).then((r) => r.blob());
  showImage(new File([blob], b.dataset.img + ".jpg", { type: "image/jpeg" }));
}));

// real GPS: find the farmer's actual location; backend snaps it to the nearest node
let gpsCoords = null, gpsAccuracyM = null;
function updateGpsStatus() {
  const st = $("#gpsStatus");
  const acc = gpsAccuracyM != null ? ` &middot; ${lang === "hi" ? "सटीकता" : "accuracy"} ~${Math.round(gpsAccuracyM)}m` : "";
  st.innerHTML = `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}${acc} ${lang === "hi" ? "(आपका स्थान — नक्शे पर पिन को खींचकर ठीक करें)" : "(your location — drag the pin on the map below to correct it)"}`;
}
$("#gps").addEventListener("click", () => {
  const st = $("#gpsStatus");
  if (!navigator.geolocation) return void (st.textContent = "GPS not available on this device.");
  st.textContent = lang === "hi" ? "स्थान खोज रहे हैं…" : "Locating…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gpsAccuracyM = pos.coords.accuracy; // meters — browsers without a real GPS chip (most
      // desktops/laptops) fall back to WiFi/IP-based positioning, which can be off by a lot,
      // especially where that database is sparse. Showing this honestly, rather than pretending
      // GPS-grade precision, is the difference between a trustworthy reading and a silent guess.
      updateGpsStatus();
      previewLocation(); // let the farmer SEE and correct the pin before routing off of it
    },
    () => { st.textContent = lang === "hi" ? "स्थान नहीं मिला — नीचे गाँव चुनें।" : "Couldn't get location — pick a village below."; },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 } // maximumAge:0 forces a FRESH
    // reading every time instead of letting the browser silently reuse a stale cached fix —
    // a stale fix from an earlier location is a real, common cause of "the app has the wrong
    // location" that has nothing to do with app logic.
  );
});

// Show the captured point immediately (map + accuracy circle), before any routing happens,
// and let the farmer drag the pin to the correct spot if the auto-detected one is off.
function previewLocation() {
  const card = $("#routeCard"); reveal(card);
  $("#routeInfo").innerHTML = "";
  drawMap(gpsCoords, null, gpsAccuracyM, true);
}

// Manually picking a village is a deliberate override of GPS — e.g. GPS put you
// outside the pilot area, or picked up the wrong location. Without this, a
// stale gpsCoords from an earlier "Get my location" click would silently keep
// winning (`gpsCoords || village`) no matter what the farmer selects here,
// making the dropdown look completely broken.
$("#village").addEventListener("change", () => {
  gpsCoords = null;
  gpsAccuracyM = null;
  const st = $("#gpsStatus");
  if (st) st.textContent = "";
});
const drop = $("#drop");
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => { e.preventDefault(); e.dataTransfer.files[0] && showImage(e.dataTransfer.files[0]); });

// ---- analyze ----
$("#analyze").addEventListener("click", async () => {
  const btn = $("#analyze");
  btn.disabled = true; btn.textContent = t("analyzing");
  try {
    const { label, conf, top3 } = await classify(current.img, current.file);
    const rc = $("#resultCard"); reveal(rc);
    $("#details").innerHTML = ""; $("#locBox").hidden = true; lastDetailCode = null;
    const pct1 = (conf * 100).toFixed(1);
    const margin = conf - (top3[1]?.conf || 0);

    // 1. Invalid capture: an explicit "background" class (once the model has one), or a
    //    near-random top-1 with no clear winner = probably not a leaf. The heuristic is
    //    the approximation until the background class ships (see model/build_notebook.py).
    if (label.condition === "background" || conf < 0.40 || (conf < 0.55 && margin < 0.12)) {
      $("#result").innerHTML = `<div class="uncertain reveal">${esc(t("noLeaf"))}</div>`;
      return;
    }
    // 2. Plausible but not sure: ranked candidates for the officer to confirm.
    if (conf < CONF_MIN) {
      const cands = top3.map((c) => `${esc(c.label.label)} (${(c.conf * 100).toFixed(1)}%)`).join(" &middot; ");
      $("#result").innerHTML = `<div class="uncertain reveal">${esc(t("uncertain"))}<br><small>${lang === "hi" ? "संभावित" : "Possible"}: ${cands}</small></div>`;
      return;
    }
    // 3. Confident diagnosis — name + exact confidence + symptoms/management details.
    const healthy = label.healthy || label.condition === "rotten";
    $("#result").innerHTML = `
      <div class="diag reveal"><span class="status-dot ${healthy ? "is-healthy" : "is-disease"}"></span>
        <div><h2>${esc(label.label)}</h2><div class="conf"><b>${pct1}%</b> ${lang === "hi" ? "विश्वास" : "confident"}</div></div></div>
      <div class="bar"><i style="width:${pct1}%"></i></div>`;
    showDetails(label.code);
    if (healthy) { $("#result").innerHTML += `<p>${esc(t("healthy"))}</p>`; }
    else {
      $("#locBox").hidden = false; current.label = label;
      const dmg = estimateDamage(current.img);        // how much of the leaf is affected + cut advice
      if (dmg) $("#result").innerHTML += damageHTML(dmg);
    }
    rc.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    // Never leave the button stuck on "Analyzing…" — surface the failure and
    // let the farmer retry immediately instead of being silently blocked.
    console.error("[analyze] classification failed:", err);
    reveal($("#resultCard"));
    $("#result").innerHTML = `<div class="uncertain reveal">${
      lang === "hi"
        ? "विश्लेषण विफल हुआ। कृपया दोबारा कोशिश करें या कोई और फोटो चुनें।"
        : "Analysis failed. Please try again, or pick a different photo."
    }</div>`;
  } finally {
    // Always restore the button — regardless of success, a handled "uncertain"
    // result, or an outright error — so the UI can never get permanently stuck.
    btn.disabled = false; btn.textContent = t("analyze");
  }
});

// symptoms + management panel (shared by the result card and the library page)
async function showDetails(code) {
  lastDetailCode = code;
  try {
    const d = await fetch(`/api/disease/${encodeURIComponent(code)}`).then((r) => r.json());
    if (!d.ok) return;
    const sym = lang === "hi" ? d.symptoms_hi : d.symptoms_en;
    const mgmt = (lang === "hi" ? d.management_hi : d.management_en) || [];
    $("#details").innerHTML = `
      <div class="detail reveal">
        <h3>${esc(t("symptoms"))}</h3><p>${esc(sym)}</p>
        <h3>${esc(t("management"))}</h3>
        <ul>${mgmt.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
      </div>`;
  } catch { /* offline / not found — silently skip the details panel */ }
}

// ---- find route ----
$("#findRoute").addEventListener("click", async () => {
  const farmer = gpsCoords || nodes[$("#village").value];   // real GPS if located, else the chosen city
  if (!farmer) { $("#gps").click(); return; }               // no location yet -> prompt for GPS
  const payload = `${current.label.code} ${geohash(farmer.lat, farmer.lng)}`;
  lastPayload = payload; // reused by the dedicated "Send SMS" button below
  const phone = $("#phone").value.trim();
  const res = await fetch("/api/route", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload, from: "web", phone: phone || undefined, key: API_KEY }),
  }).then((r) => r.json());

  const card = $("#routeCard"); reveal(card);
  $("#smsStatus").textContent = ""; $("#smsStatus").className = "sms-status";
  // Only offer "Send SMS" when there's an actual route to send.
  $("#smsBox").hidden = !res.ok;
  if (!res.ok) lastPayload = null;
  const acc = gpsCoords === farmer ? gpsAccuracyM : null;   // accuracy circle only for a real GPS fix
  if (!res.ok) { $("#routeInfo").innerHTML = `<div class="uncertain reveal">${esc(t("noStock"))}</div>`; drawMap(farmer, null, acc, false); return; }
  const hindi = expandReply(res);
  const pest = res.pesticide ? (res.pesticide[lang] || res.pesticide.en) : "";
  const centerName = res.center.replace("Center_", lang === "hi" ? "केंद्र " : "Center ");
  const sent = !res.sms ? "" : res.sms.provider === "mock"
    ? "Demo mode — add TextBee keys to send a real SMS"
    : `Sent to ${esc(phone)}`;
  $("#routeInfo").innerHTML = `
    <p class="pest"><b>${lang === "hi" ? "दवा" : "Pesticide"}:</b> ${esc(pest)}</p>
    <div class="route-line"><span class="n">${esc(t("youAreHere"))}</span> &rarr; <span class="n">${esc(centerName)}</span></div>
    <p><b>${esc(t("nearest"))}:</b> ${esc(centerName)} &middot; <b>${esc(t("distance"))}:</b> ${res.distanceKm} km &middot; <b>${esc(t("stock"))}:</b> ${res.stockKg}kg</p>
    <div class="sms reveal"><b>SMS &rarr;</b> ${esc(res.reply)}<br><small>${esc(hindi)}</small>${sent ? `<br><small style="color:#8ef0a6">${esc(sent)}</small>` : ""}</div>`;
  drawMap(farmer, { lat: res.centerLat, lng: res.centerLng, name: centerName }, acc, false);
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
// `precise` is the ACTUAL coordinate (real device GPS, or the exact stored
// point of a manually picked village) — plotted as "you are here" in place of
// the snapped graph node, so the pin always reflects where you truly are, not
// an approximation. `startName` anchors the road-network portion of the route
// (Dijkstra only knows fixed nodes) and may be null for a location-only
// preview, before any route has been computed. `accuracyM` (meters) draws an
// honest uncertainty circle instead of implying GPS-grade precision that
// desktop/WiFi-based positioning often can't actually deliver. `draggable`
// lets the farmer manually correct the pin if the auto-detected fix is off —
// standard practice in any serious location-based app, not just a nicety.
// `farmer` = the real location {lat,lng} (device GPS or a picked city). `center` =
// {lat,lng,name} of the chosen supply shop, or null for a location-only preview.
// `accuracyM` (meters) draws an honest uncertainty circle for WiFi/IP fixes.
// `draggable` lets the farmer correct the pin before routing off of it.
function drawMap(farmer, center, accuracyM, draggable) {
  if (!mapObj) { mapObj = L.map("map"); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OSM" }).addTo(mapObj); }
  mapObj.eachLayer((l) => (l instanceof L.Marker || l instanceof L.Polyline || l instanceof L.Circle || l instanceof L.CircleMarker) ? mapObj.removeLayer(l) : 0);

  const youMarker = L.marker([farmer.lat, farmer.lng], { draggable: !!draggable })
    .addTo(mapObj).bindPopup(lang === "hi" ? "आपका स्थान" : "Your location");
  if (accuracyM) {
    L.circle([farmer.lat, farmer.lng], { radius: accuracyM, color: "#2E86AB", weight: 1, fillOpacity: 0.08 }).addTo(mapObj);
  }
  if (draggable) {
    youMarker.on("dragend", (e) => {
      const { lat, lng } = e.target.getLatLng();
      gpsCoords = { lat, lng };
      gpsAccuracyM = null; // a manual correction beats the device's own estimate
      updateGpsStatus();
      drawMap(gpsCoords, null, null, true); // location-only; re-run Find Route for a fresh nearby shop
    });
  }

  // Preview-only call (no route yet) — just show where you are.
  if (!center) return mapObj.setView([farmer.lat, farmer.lng], 13);

  L.marker([center.lat, center.lng]).addTo(mapObj)
    .bindPopup(esc(center.name || "Center") + (lang === "hi" ? " (आपूर्ति केंद्र)" : " (supply center)"));
  const pts = [[farmer.lat, farmer.lng], [center.lat, center.lng]];
  // Provisional straight line (instant, and the offline fallback). Snapped to real
  // roads by OSRM if online — the polyline then follows streets, not a diagonal.
  let line = L.polyline(pts, { color: "#1b7a3d", weight: 4, opacity: 0.45, dashArray: "6 6" }).addTo(mapObj);
  mapObj.fitBounds(pts, { padding: [45, 45] });
  followRoads([farmer, center]).then((road) => {
    if (!road) return;                       // offline / OSRM down -> keep the straight line
    mapObj.removeLayer(line);
    line = L.polyline(road, { color: "#1b7a3d", weight: 5 }).addTo(mapObj);
    mapObj.fitBounds(road, { padding: [45, 45] });
  });
}

// Route two {lat,lng} points along real roads via OSRM, return geometry as [lat,lng][].
// Returns null on any failure so the caller keeps the straight-line fallback.
async function followRoads(points) {
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(timer);
    const j = await r.json();
    if (j.code !== "Ok") return null;
    return j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch { return null; }
}

// ---- dedicated "Send SMS" button (route card) ----
// India-only number check: optional +91/91 prefix, then 10 digits starting
// 6-9 (the valid leading-digit range for Indian mobile numbers).
const INDIA_PHONE_RE = /^(?:\+?91)?([6-9]\d{9})$/;
function normalizeIndianPhone(raw) {
  const digits = raw.replace(/\s+/g, "");
  const m = digits.match(INDIA_PHONE_RE);
  return m ? "+91" + m[1] : null;
}

$("#sendSmsBtn").addEventListener("click", async () => {
  const statusEl = $("#smsStatus");
  const raw = $("#smsPhone").value.trim();
  const phone = normalizeIndianPhone(raw);
  if (!phone) {
    statusEl.textContent = t("smsBadPhone");
    statusEl.className = "sms-status error reveal";
    return;
  }
  if (!lastPayload) return; // no route found yet — button shouldn't be reachable, but guard anyway

  const btn = $("#sendSmsBtn");
  btn.disabled = true; const original = btn.textContent; btn.textContent = t("smsSending");
  try {
    const res = await fetch("/api/route", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: lastPayload, from: "web", phone, key: API_KEY }),
    }).then((r) => r.json());

    if (!res.ok) {
      statusEl.textContent = res.error === "OUT_OF_SERVICE_AREA" ? t("outOfArea") : t("noStock");
      statusEl.className = "sms-status error reveal";
      return;
    }
    // TextBee/Fast2SMS aren't wired up for this deployment yet (see the
    // disclaimer above the button) — the backend always answers with
    // provider: "mock" until real credentials are configured. Show the
    // farmer exactly what the message would contain either way.
    statusEl.innerHTML = `${esc(t("smsSentOk"))} ${esc(phone)}<br><span class="sms">${esc(res.reply)}</span>`;
    statusEl.className = "sms-status ok reveal";
  } catch {
    statusEl.textContent = t("smsBadPhone");
    statusEl.className = "sms-status error reveal";
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
});

// ---- lang toggle ----
$("#lang").addEventListener("click", () => { lang = lang === "en" ? "hi" : "en"; applyLang(); if (lastDetailCode) showDetails(lastDetailCode); });

// ---- boot ----
(async () => {
  applyLang();
  nodes = await fetch("/api/nodes").then((r) => r.json());
  const sel = $("#village");
  Object.entries(nodes).filter(([, n]) => !n.center).forEach(([name]) =>
    sel.insertAdjacentHTML("beforeend", `<option value="${esc(name)}">${esc(name)}</option>`));
  await loadModel();
})();
