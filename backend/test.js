// Runnable check for the routing core. node backend/test.js
const assert = require("assert");
const { route, parsePayload, nearestStockedCenter, geohashDecode } = require("./core");

// geohash of Ramnagar (28.6100,77.2000) from the python encoder = "ttnfu8r"
const p = parsePayload("D1Q ttnfu8r");
assert.strictEqual(p.code, "D1Q");
assert(Math.abs(p.lat - 28.61) < 0.05 && Math.abs(p.lng - 77.20) < 0.05, "geohash decodes near Ramnagar");

// D1Q (Potato Late Blight) in stock at A(20) and C(30); should be reachable
const r = route("D1Q ttnfu8r", "+919000000001");
assert(r.ok, "should route");
assert(r.path[0] === r.start && r.path.at(-1) === r.center, "path connects start->center");
assert(["Center_A", "Center_B", "Center_C"].includes(r.center));
assert(/^R:1Q C:[ABC] D:[\d.]+$/.test(r.reply), "reply is 1-SMS code form: " + r.reply);

// stock-aware: D1O is 0 at A, 15 at B -> must skip A even if A is closer
const rb = nearestStockedCenter("Balaji", "D1O");
assert.strictEqual(rb.center, "Center_B", "routes only to stocked center");

// no stock anywhere -> graceful NO_STOCK, never a crash
const none = route("DZZ ttnfu8r");
assert(!none.ok && none.error === "NO_STOCK");

// garbage payload rejected, not routed
assert.throws(() => parsePayload("hello world"), /INVALID_PAYLOAD/);

// out-of-service-area guard: a GPS point genuinely far from the pilot district
// (e.g. Mumbai, ~28.6 -> ~19.1 lat, a ~1,150 km jump) must NOT silently snap to
// "whichever demo village happens to be nearest" and fabricate a plausible
// route. It must fail loudly and explicitly instead.
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
const farAway = geohashEncode(19.076, 72.8777); // Mumbai
const outOfArea = route(`D1Q ${farAway}`, "+919000000002");
assert(!outOfArea.ok && outOfArea.error === "OUT_OF_SERVICE_AREA",
  "far-away GPS must not fabricate a route: " + JSON.stringify(outOfArea));
assert(outOfArea.nearestVillageKm > 15, "reported distance should reflect the real, large gap");

// sanity: decode(encode(x)) round-trips close enough for the snap to still work
const rt = geohashDecode(geohashEncode(28.61, 77.20));
assert(Math.abs(rt.lat - 28.61) < 0.01 && Math.abs(rt.lng - 77.20) < 0.01, "geohash round-trips");

// SMS adapter: with no gateway env vars, must degrade to a safe logged mock,
// never throw, never crash the request path.
(async () => {
  const { sendSMS } = require("./sms");
  const s = await sendSMS("+919000000001", "R:1Q C:A D:2.5");
  assert(s.ok && s.provider === "mock", "no gateway -> mock send");
  console.log("all pass");
  console.log("sample:", JSON.stringify(route("D1Q ttnfu8r", "+919000000001"), null, 2));
})();
