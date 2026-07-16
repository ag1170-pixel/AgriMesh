// Runnable check for the routing core. node backend/test.js
const assert = require("assert");
const { route, parsePayload, nearestStockedCenter, km, geohashDecode } = require("./core");

function geohashEncode(lat, lng, precision = 7) {
  const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latR = [-90, 90], lngR = [-180, 180], even = true, bit = 0, ch = 0, out = "";
  while (out.length < precision) {
    if (even) { const m = (lngR[0] + lngR[1]) / 2; if (lng > m) { ch = (ch << 1) | 1; lngR[0] = m; } else { ch <<= 1; lngR[1] = m; } }
    else { const m = (latR[0] + latR[1]) / 2; if (lat > m) { ch = (ch << 1) | 1; latR[0] = m; } else { ch <<= 1; latR[1] = m; } }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

// geohash decodes back near the encoded point
const p = parsePayload("D1Q ttnfu8r");
assert.strictEqual(p.code, "D1Q");
assert(Math.abs(p.lat - 28.61) < 0.05 && Math.abs(p.lng - 77.20) < 0.05, "geohash decodes near 28.61,77.20");

// routes, returns real coords, center a few km away
const r = route("D1Q ttnfu8r", "+919000000001");
assert(r.ok, "should route");
assert(["Center_A", "Center_B", "Center_C"].includes(r.center));
assert(typeof r.centerLat === "number" && typeof r.farmerLat === "number", "returns real coords for the map");
assert(r.distanceKm > 0 && r.distanceKm < 10, "center is a few km away, not across the country: " + r.distanceKm);
assert(/^R:1Q C:[ABC] D:[\d.]+$/.test(r.reply), "reply is 1-SMS code form: " + r.reply);

// THE FIX: a farmer anywhere (Mumbai, ~1150 km from the old fixed district) now
// gets a center near THEM — not "out of service area", not a stale Delhi node.
const mumbai = route(`D1Q ${geohashEncode(19.076, 72.8777)}`, "+919000000002");
assert(mumbai.ok, "far-away farmer must now route (centers follow the farmer)");
assert(km({ lat: 19.076, lng: 72.8777 }, { lat: mumbai.centerLat, lng: mumbai.centerLng }) < 6,
  "center is near the farmer (Mumbai), not Delhi");

// centers follow the farmer: Patna -> center near Patna
const patna = nearestStockedCenter({ lat: 25.5941, lng: 85.1376 }, "D1Q");
assert(patna && Math.abs(patna.centerLat - 25.5941) < 0.1, "center is local to the farmer (Patna)");

// stock-aware: D1O is 0 at Center_A -> must skip A and pick a stocked one
const io = nearestStockedCenter({ lat: 27.1767, lng: 78.0081 }, "D1O");
assert(io && io.center !== "Center_A", "skips the empty center A for D1O -> " + (io && io.center));

// no stock anywhere -> graceful NO_STOCK, never a crash
const none = route("DZZ ttnfu8r");
assert(!none.ok && none.error === "NO_STOCK");

// garbage payload rejected, not routed
assert.throws(() => parsePayload("hello world"), /INVALID_PAYLOAD/);

// geohash round-trips close enough
const rt = geohashDecode(geohashEncode(28.61, 77.20));
assert(Math.abs(rt.lat - 28.61) < 0.01 && Math.abs(rt.lng - 77.20) < 0.01, "geohash round-trips");

// SMS adapter: with no gateway env vars, must degrade to a safe logged mock.
(async () => {
  const { sendSMS } = require("./sms");
  const s = await sendSMS("+919000000001", "R:1Q C:A D:2.5");
  assert(s.ok && s.provider === "mock", "no gateway -> mock send");
  console.log("all pass");
  console.log("sample:", JSON.stringify(route("D1Q ttnfu8r", "+919000000001"), null, 2));
})();
