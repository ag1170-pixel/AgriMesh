// AgriMesh backend core: decode the ~11-byte SMS payload -> route to nearest
// stocked center. No image, no DFT ever reaches here — only the decision.

const { NODES, ADJ, INVENTORY } = require("./graph");

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

// ---- haversine km, to snap farmer GPS onto the nearest graph node ----
function km(a, b) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function snap({ lat, lng }) {
  let best, bd = Infinity;
  for (const [name, n] of Object.entries(NODES)) {
    const d = km({ lat, lng }, n);
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

// ---- binary min-heap (avoids O(V^2) array scan; real Dijkstra speed) ----
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

// ---- stock-aware Dijkstra: shortest road path from start to the nearest
//      center that actually has stock for `code`. Empty centers are invisible. ----
function nearestStockedCenter(start, code) {
  const targets = new Set(
    Object.entries(INVENTORY).filter(([, s]) => (s[code] || 0) > 0).map(([id]) => id)
  );
  if (!targets.size) return null;

  const dist = { [start]: 0 }, prev = {};
  const heap = new MinHeap(); heap.push([0, start]);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > (dist[u] ?? Infinity)) continue;
    if (targets.has(u)) {                       // first popped target = nearest
      const path = []; for (let x = u; x; x = prev[x]) path.unshift(x);
      return { center: u, distanceKm: +d.toFixed(1), path, stockKg: INVENTORY[u][code] };
    }
    for (const [v, w] of ADJ[u]) {
      const nd = d + w;
      if (nd < (dist[v] ?? Infinity)) { dist[v] = nd; prev[v] = u; heap.push([nd, v]); }
    }
  }
  return null;
}

// ---- one call: raw SMS text -> full routing result ----
function route(raw, senderPhone = "unknown") {
  const { code, lat, lng } = parsePayload(raw);
  const start = snap({ lat, lng });
  const r = nearestStockedCenter(start, code);
  if (!r) return { ok: false, error: "NO_STOCK", code, start };
  return {
    ok: true, code, farmer: senderPhone, start,
    ...r,
    // short code reply -> 1 GSM-7 SMS (Hindi expansion happens client/poster side)
    reply: `R:${code.slice(1)} C:${r.center.replace("Center_", "")} D:${r.distanceKm}`,
  };
}

module.exports = { parsePayload, geohashDecode, snap, nearestStockedCenter, route };
