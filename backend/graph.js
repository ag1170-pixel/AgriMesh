// Hardcoded rural road graph (demo). Nodes = places, edges = km along real roads.
// Inventory is keyed by the SAME D-codes the model emits (see model/labels.json),
// so a diseased leaf -> code -> "which center stocks its pesticide" lines up 1:1.
// ponytail: 15 nodes hardcoded on purpose — parsing 50MB of OSM buys nothing for a demo.

const NODES = {
  Ramnagar:   { lat: 28.6100, lng: 77.2000, center: false },
  Shivpur:    { lat: 28.6150, lng: 77.2100, center: false },
  Krishnapura:{ lat: 28.6200, lng: 77.2150, center: false },
  Balaji:     { lat: 28.6050, lng: 77.2200, center: false },
  Govindpur:  { lat: 28.6250, lng: 77.2250, center: false },
  Lakshmipur: { lat: 28.6120, lng: 77.2300, center: false },
  Hanuman:    { lat: 28.6180, lng: 77.2350, center: false },
  Ganga:      { lat: 28.6080, lng: 77.2400, center: false },
  Yamuna:     { lat: 28.6220, lng: 77.2450, center: false },
  Saraswati:  { lat: 28.6150, lng: 77.2500, center: false },
  T_Junction: { lat: 28.6150, lng: 77.2250, center: false },
  Crossroads: { lat: 28.6180, lng: 77.2350, center: false },
  Center_A:   { lat: 28.6300, lng: 77.2200, center: true },
  Center_B:   { lat: 28.6000, lng: 77.2300, center: true },
  Center_C:   { lat: 28.6200, lng: 77.2400, center: true },
};

const EDGES = [
  ["Ramnagar","Shivpur",1.2],["Ramnagar","Balaji",2.1],["Shivpur","Krishnapura",1.5],
  ["Shivpur","T_Junction",1.8],["Krishnapura","Govindpur",2.0],["Krishnapura","T_Junction",1.0],
  ["Balaji","T_Junction",2.5],["Balaji","Center_B",3.0],["Govindpur","Center_A",2.2],
  ["Govindpur","T_Junction",2.0],["Lakshmipur","T_Junction",1.5],["Lakshmipur","Crossroads",2.0],
  ["Hanuman","Crossroads",1.2],["Hanuman","Center_C",1.5],["Ganga","Center_B",2.5],
  ["Ganga","Crossroads",2.8],["Yamuna","Crossroads",1.0],["Yamuna","Center_C",2.2],
  ["Saraswati","Crossroads",2.5],["Saraswati","Center_C",3.0],["T_Junction","Crossroads",2.0],
  ["T_Junction","Center_A",2.5],["Crossroads","Center_A",3.0],["Crossroads","Center_B",2.2],
  ["Center_A","Center_B",4.0],["Center_A","Center_C",3.5],["Center_B","Center_C",4.5],
];

// centerId -> { Dcode: kg in stock }. Seeded for demo; admin panel edits this live.
// D1Q=Potato Late Blight, D1O=Potato Early Blight, D2N=Tomato Late Blight.
const INVENTORY = {
  Center_A: { D1Q: 20, D1O: 0,  D2N: 10 },
  Center_B: { D1Q: 0,  D1O: 15, D2N: 0  },
  Center_C: { D1Q: 30, D1O: 5,  D2N: 0  },
};

// adjacency list built once
const ADJ = {};
for (const n of Object.keys(NODES)) ADJ[n] = [];
for (const [a, b, d] of EDGES) { ADJ[a].push([b, d]); ADJ[b].push([a, d]); }

module.exports = { NODES, ADJ, INVENTORY };
