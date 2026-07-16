// AgriMesh backend core: decode the ~11-byte SMS payload -> pick the nearest supply
// center (positioned around the farmer's REAL GPS) that actually has stock for the
// disease. Works from wherever the farmer is — Patna, Agra, anywhere. No image, no
// GPS ever reaches here as more than a lat/lng pair; only the decision crosses.

const { INVENTORY } = require("./graph");

// ---- geohash decode (matches model/payload_demo.py encoder) ----
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohashDecode(gh) {
  let latR = [-90, 90], lngR = [-180, 180], even = true;
  for (const ch of gh) {
    const cd = B32.indexOf(ch);
    if (cd < 0) throw new Error("bad geohash");
    for (let bit = 4; bit >= 0; bit--) {
      const mid = ((r) => (r[0] + r[1]) / 2);
      const on = (cd >> bit) & 1;
      if (even) { const m = mid(lngR); lngR = on ? [m, lngR[1]] : [lngR[0], m]; }
      else      { const m = mid(latR); latR = on ? [m, latR[1]] : [latR[0], m]; }
      even = !even;
    }
  }
  return { lat: (latR[0] + latR[1]) / 2, lng: (lngR[0] + lngR[1]) / 2 };
}

// ---- payload parse: "D0A ttnfu8r" -> { code, lat, lng } ----
// Farmer ID is NOT here — it's the SMS 'From' header. Timestamp = arrival time.
const PAYLOAD = /^(D[0-9A-Z]{2})\s+([0-9bcdefghjkmnpqrstuvwxyz]{5,9})$/;
function parsePayload(raw) {
  const m = String(raw).trim().match(PAYLOAD);
  if (!m) throw new Error("INVALID_PAYLOAD");
  return { code: m[1], ...geohashDecode(m[2]) };
}

// ---- haversine km between two {lat,lng} ----
function km(a, b) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---- binary min-heap (priority queue for nearest-center selection) ----
class MinHeap {
  constructor() { this.h = []; }
  push(x) { const h = this.h; h.push(x); let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
  pop() { const h = this.h, top = h[0], last = h.pop();
    if (h.length) { h[0] = last; let i = 0; for (;;) { let s = i, l = 2*i+1, r = 2*i+2;
      if (l < h.length && h[l][0] < h[s][0]) s = l; if (r < h.length && h[r][0] < h[s][0]) s = r;
      if (s === i) break; [h[s], h[i]] = [h[i], h[s]]; i = s; } } return top; }
  get size() { return this.h.length; }
}

// Supply centers are placed a few km around the farmer, in different directions, so
// "nearest" is meaningful and the admin's stock edits change which one wins. (In
// production these offsets become a proximity query against a real supplier DB.)
const CENTER_OFFSETS = {
  Center_A: [ 0.021,  0.013],   // ~2.7 km NE
  Center_B: [-0.028,  0.023],   // ~3.9 km SE
  Center_C: [ 0.015, -0.031],   // ~3.5 km NW
};

// ---- stock-aware nearest center: skip any center with no stock for `code`,
//      then min-heap by real distance from the farmer. Empty centers are invisible. ----
function nearestStockedCenter(farmer, code) {
  const heap = new MinHeap();
  for (const [id, [dLat, dLng]] of Object.entries(CENTER_OFFSETS)) {
    if ((INVENTORY[id]?.[code] || 0) <= 0) continue;              // stock-aware skip
    const c = { lat: farmer.lat + dLat, lng: farmer.lng + dLng };
    heap.push([km(farmer, c), { id, ...c }]);                     // priority = distance
  }
  if (!heap.size) return null;
  const [d, c] = heap.pop();                                      // nearest stocked center
  return { center: c.id, centerLat: +c.lat.toFixed(6), centerLng: +c.lng.toFixed(6),
           distanceKm: +d.toFixed(1), stockKg: INVENTORY[c.id][code] };
}

// ---- one call: raw SMS text -> full routing result (real coords for the map) ----
function route(raw, senderPhone = "unknown") {
  const { code, lat, lng } = parsePayload(raw);
  const r = nearestStockedCenter({ lat, lng }, code);
  if (!r) return { ok: false, error: "NO_STOCK", code, lat, lng };
  return {
    ok: true, code, farmer: senderPhone,
    lat, lng, farmerLat: +lat.toFixed(6), farmerLng: +lng.toFixed(6),
    ...r,
    // short code reply -> 1 GSM-7 SMS (Hindi expansion happens client/poster side)
    reply: `R:${code.slice(1)} C:${r.center.replace("Center_", "")} D:${r.distanceKm}`,
  };
}

module.exports = { parsePayload, geohashDecode, km, nearestStockedCenter, route };
