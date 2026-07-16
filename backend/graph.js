// AgriMesh location data.
//
// Supply centers are NOT fixed on a map — they are positioned relative to the
// farmer's real GPS at request time (see core.js CENTER_OFFSETS), so the route
// always starts from where the farmer actually is (Patna, Agra, anywhere) and
// goes to a shop a few km away on real roads. In production these offsets become
// a proximity query against a real agri-supplier database.
//
// INVENTORY (below) is the real, admin-editable stock per center — that's what
// makes routing "stock-aware": an empty center is skipped for that disease.

// Fallback demo locations (real Indian cities) — used only when the browser
// denies GPS. Real GPS is always preferred. Served by GET /api/nodes.
const NODES = {
  Patna:     { lat: 25.5941, lng: 85.1376, center: false },
  Agra:      { lat: 27.1767, lng: 78.0081, center: false },
  Delhi:     { lat: 28.6139, lng: 77.2090, center: false },
  Lucknow:   { lat: 26.8467, lng: 80.9462, center: false },
  Kanpur:    { lat: 26.4499, lng: 80.3319, center: false },
  Ludhiana:  { lat: 30.9010, lng: 75.8573, center: false },
  Nagpur:    { lat: 21.1458, lng: 79.0882, center: false },
  Pune:      { lat: 18.5204, lng: 73.8567, center: false },
};

// centerId -> { Dcode: kg }. Seeded so the common real-upload diseases all route.
// D1Q Potato Late · D1O Potato Early · D2N Tomato Late · D0R Corn Rust · D04 Apple Scab
// D0Z Grape Black Rot · D2U Tomato YLCV · D0H Cherry Powdery · D27 Strawberry Scorch
const INVENTORY = {
  Center_A: { D1Q: 20, D1O: 0,  D2N: 10, D0R: 25, D04: 12, D0Z: 0,  D2U: 8,  D0H: 15, D27: 0  },
  Center_B: { D1Q: 0,  D1O: 15, D2N: 0,  D0R: 0,  D04: 20, D0Z: 18, D2U: 0,  D0H: 0,  D27: 10 },
  Center_C: { D1Q: 30, D1O: 5,  D2N: 0,  D0R: 10, D04: 0,  D0Z: 22, D2U: 14, D0H: 9,  D27: 6  },
};

module.exports = { NODES, INVENTORY };
