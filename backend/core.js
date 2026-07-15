// AgriMesh backend core: decode the ~11-byte SMS payload -> route to nearest
// stocked center. No image, no GPS ever reaches here as anything more than a
// lat/lng pair — only the decision (code + location) crosses the network.

const { NODES, ADJ, INVENTORY } = require("./graph");

// The demo road graph covers a single fictional pilot district; every node in
// it sits within ~6 km of every other (see graph.js). Real device GPS can
// report a location anywhere on Earth, so blindly snapping to "whichever demo
// node happens to be nearest" — with no distance check — silently produces a
// confident-looking route for someone who is, say, 500 km away and nowhere
// near this pilot district. That is worse than an error: it *looks* correct.
// This cap makes the honest failure mode explicit instead of hallucinating a
// plausible route. Generous relative to the ~6 km graph span, so genuine
// GPS drift near the district's edge still passes.
const SERVICE_AREA_MAX_KM = 15;

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
// Returns the nearest node name AND how far away it actually is, so callers
// can decide whether that snap is meaningful rather than assuming it always is.
function snap({ lat, lng }) {
  let best, bd = Infinity;
  for (const [name, n] of Object.entries(NODES)) {
    const d = km({ lat, lng }, n);
    if (d < bd) { bd = d; best = name; }
  }
  return { name: best, distanceKm: bd };
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
  const { name: start, distanceKm: snapKm } = snap({ lat, lng });

  // Honest failure instead of a fabricated route: if the reported location is
  // nowhere near this pilot district's road graph, say so explicitly rather
  // than silently returning "nearest" node #1 out of 15 as if it were valid.
  if (snapKm > SERVICE_AREA_MAX_KM) {
    return {
      ok: false, error: "OUT_OF_SERVICE_AREA", code,
      nearestVillage: start, nearestVillageKm: +snapKm.toFixed(1),
      lat, lng, // precise reading, so the map can still plot "you are here" honestly
    };
  }

  const r = nearestStockedCenter(start, code);
  if (!r) return { ok: false, error: "NO_STOCK", code, start, lat, lng };

  // The Dijkstra path only covers node-to-node distance across the fixed road
  // graph (start village -> ... -> shop). It does NOT include the gap between
  // the farmer's ACTUAL coordinate and that start village -- for a manually
  // picked village that gap is ~0 (the payload IS that village's coordinate),
  // but for a real GPS reading it can be a genuine last-mile distance. Folding
  // it in gives a total that reflects the real starting point, not just the
  // internal graph segment; the shop-end coordinate was already exact.
  const lastMileKm = +km({ lat, lng }, NODES[start]).toFixed(1);
  const totalKm = +(lastMileKm + r.distanceKm).toFixed(1);

  return {
    ok: true, code, farmer: senderPhone, start, lat, lng,
    ...r,
    graphKm: r.distanceKm,     // node-to-node segment only, for transparency
    lastMileKm,                // true-location -> nearest road-network node
    distanceKm: totalKm,       // precise coordinate -> exact shop coordinate, end to end
    // short code reply -> 1 GSM-7 SMS (Hindi expansion happens client/poster side)
    reply: `R:${code.slice(1)} C:${r.center.replace("Center_", "")} D:${totalKm}`,
  };
}

module.exports = { parsePayload, geohashDecode, snap, nearestStockedCenter, route, SERVICE_AREA_MAX_KM };
