// Runnable check for the routing core. node backend/test.js
const assert = require("assert");
const { route, parsePayload, nearestStockedCenter } = require("./core");

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

console.log("all pass");
console.log("sample:", JSON.stringify(route("D1Q ttnfu8r", "+919000000001"), null, 2));
