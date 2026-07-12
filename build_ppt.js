// AgriMesh pitch deck. Run: NODE_PATH=$(npm root -g) node build_ppt.js
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE";                    // 13.33 x 7.5
p.author = "AgriMesh";
p.title = "AgriMesh — Pitch";

// ---- palette (agriculture: deep forest + moss, amber accent, alert red) ----
const FOREST = "13351F", GREEN = "2C6E3F", LEAF = "4E9F4E", MOSS = "9CC85A";
const CREAM = "F6F4EC", INK = "1C2A20", MUTE = "6E7C71", AMBER = "E8A72C",
      RED = "C0392B", WHITE = "FFFFFF";
const HFONT = "Cambria", BFONT = "Calibri";
const W = 13.33, H = 7.5, M = 0.7;

const bg = (s, c) => s.background = { color: c };
// small leaf-mark motif (repeated): two overlapping green circles
function mark(s, x, y, r = 0.16, c = MOSS) {
  s.addShape(p.ShapeType.ellipse, { x, y, w: r, h: r, fill: { color: c } });
  s.addShape(p.ShapeType.ellipse, { x: x + r * 0.6, y: y - r * 0.35, w: r, h: r, fill: { color: LEAF } });
}
function title(s, txt, color = INK, y = 0.55) {
  s.addText(txt, { x: M, y, w: W - 2 * M, h: 0.9, fontFace: HFONT, fontSize: 34, bold: true, color, align: "left" });
}

// ============================================================ 1. TITLE
let s = p.addSlide(); bg(s, FOREST);
s.addShape(p.ShapeType.ellipse, { x: 9.6, y: -2.2, w: 6.5, h: 6.5, fill: { color: GREEN }, line: { color: GREEN } });
s.addShape(p.ShapeType.ellipse, { x: 11.2, y: 3.6, w: 4.6, h: 4.6, fill: { color: "0E2817" }, line: { color: "0E2817" } });
mark(s, M, 1.5, 0.5, MOSS);
s.addText("AgriMesh", { x: M, y: 2.2, w: 9, h: 1.2, fontFace: HFONT, fontSize: 66, bold: true, color: WHITE });
s.addText("The AI crop doctor that works where the internet doesn't.",
  { x: M, y: 3.5, w: 8.6, h: 0.8, fontFace: BFONT, fontSize: 22, color: MOSS });
s.addText([
  { text: "A farmer photographs a sick leaf. The phone diagnoses it offline — and ", options: {} },
  { text: "an 11-byte text", options: { bold: true, color: AMBER } },
  { text: " brings back the cure. The image never travels.", options: {} },
], { x: M, y: 4.5, w: 9.2, h: 1, fontFace: BFONT, fontSize: 16, color: "D8E6D0" });
s.addText("Hackathon Pitch  ·  Offline-first Edge AI for agriculture",
  { x: M, y: 6.5, w: 9, h: 0.4, fontFace: BFONT, fontSize: 12, color: MUTE });
s.addNotes("Open on the human, not the tech. AgriMesh puts a crop doctor inside a basic phone that works with no internet.");

// ============================================================ 2. RAMESH (emotional hook)
s = p.addSlide(); bg(s, FOREST);
s.addText("Meet Ramesh.", { x: M, y: 0.7, w: 8, h: 0.9, fontFace: HFONT, fontSize: 40, bold: true, color: WHITE });
s.addText([
  { text: "He farms two acres of potato — his daughter's school fees, a year of food, a loan to repay.\n\n", options: {} },
  { text: "One morning he finds ", options: {} },
  { text: "dark spots", options: { bold: true, color: AMBER } },
  { text: " on the leaves. He doesn't know what it is. He can't Google it — ", options: {} },
  { text: "one bar of 2G, on a good day.", options: { bold: true, color: MOSS } },
  { text: " The nearest officer is a day's travel away.\n\nSo he waits. And the disease spreads.", options: {} },
], { x: M, y: 1.8, w: 7.4, h: 3.6, fontFace: BFONT, fontSize: 19, color: "E4EEDD", lineSpacingMultiple: 1.15 });
// pull-quote card
s.addShape(p.ShapeType.roundRect, { x: 8.7, y: 1.9, w: 3.9, h: 3.4, rectRadius: 0.14, fill: { color: "0E2817" }, line: { color: GREEN, width: 1 } });
s.addText("“It wasn't that a cure didn't exist.", { x: 9.0, y: 2.25, w: 3.3, h: 1.2, fontFace: HFONT, fontSize: 20, italic: true, color: WHITE });
s.addText("The fungicide sat in a shop 5 km away.", { x: 9.0, y: 3.25, w: 3.3, h: 1.0, fontFace: BFONT, fontSize: 16, color: MOSS });
s.addText("He lost the crop for want of one thing: information, in time.”", { x: 9.0, y: 4.0, w: 3.3, h: 1.1, fontFace: BFONT, fontSize: 15, color: "D8E6D0" });
s.addText("Two weeks later, the field is gone. This happens to millions.",
  { x: M, y: 6.4, w: 11, h: 0.5, fontFace: BFONT, fontSize: 16, bold: true, color: AMBER });
s.addNotes("Slow down here. Let the judges feel the helplessness — the cure existed and was near; only the information was missing.");

// ============================================================ 3. THE PROBLEM (scale, stats)
s = p.addSlide(); bg(s, CREAM);
title(s, "The problem isn't the cure. It's the distance to it.");
const stats = [
  { n: "Up to 40%", l: "of the world's crops are lost to pests & disease every year", src: "FAO" },
  { n: "600M+", l: "smallholder farmers live or fall by that single harvest", src: "" },
  { n: "Days → weeks", l: "for expert help to reach a remote village — often too late", src: "" },
];
stats.forEach((st, i) => {
  const x = M + i * 4.05;
  s.addShape(p.ShapeType.roundRect, { x, y: 1.8, w: 3.7, h: 2.9, rectRadius: 0.12, fill: { color: WHITE }, line: { color: "E2E0D6", width: 1 } });
  s.addText(st.n, { x: x + 0.1, y: 2.05, w: 3.5, h: 1.0, fontFace: HFONT, fontSize: 40, bold: true, color: GREEN, align: "left" });
  s.addText(st.l, { x: x + 0.25, y: 3.15, w: 3.2, h: 1.3, fontFace: BFONT, fontSize: 16, color: INK, align: "left" });
  if (st.src) s.addText("Source: " + st.src, { x: x + 0.25, y: 4.35, w: 3.2, h: 0.3, fontFace: BFONT, fontSize: 10, italic: true, color: MUTE });
});
s.addShape(p.ShapeType.roundRect, { x: M, y: 5.15, w: W - 2 * M, h: 1.5, rectRadius: 0.1, fill: { color: FOREST } });
s.addText([
  { text: "The tech to diagnose a leaf already exists. ", options: { color: MOSS, bold: true } },
  { text: "But it lives in the cloud — and the farmers who need it most have no way to reach the cloud.", options: { color: WHITE } },
], { x: M + 0.3, y: 5.35, w: W - 2 * M - 0.6, h: 1.1, fontFace: BFONT, fontSize: 18, valign: "middle" });
s.addNotes("Frame the gap: diagnosis exists, but it's locked behind connectivity these farmers don't have.");

// ============================================================ 4. THE WALL (the impossible)
s = p.addSlide(); bg(s, CREAM);
title(s, "So why not just send the photo?");
s.addText("Because the physics doesn't allow it.", { x: M, y: 1.5, w: 11, h: 0.5, fontFace: BFONT, fontSize: 18, color: MUTE });
// left: the numbers
const cmp = [
  { k: "A leaf photo", v: "~1,000,000 bytes", c: RED },
  { k: "One SMS (2G)", v: "140 bytes", c: GREEN },
];
cmp.forEach((r, i) => {
  const y = 2.2 + i * 1.35;
  s.addShape(p.ShapeType.roundRect, { x: M, y, w: 6.0, h: 1.1, rectRadius: 0.1, fill: { color: WHITE }, line: { color: "E2E0D6", width: 1 } });
  s.addText(r.k, { x: M + 0.3, y, w: 3.0, h: 1.1, fontFace: BFONT, fontSize: 18, bold: true, color: INK, valign: "middle" });
  s.addText(r.v, { x: M + 3.0, y, w: 2.9, h: 1.1, fontFace: HFONT, fontSize: 24, bold: true, color: r.c, valign: "middle", align: "right" });
});
s.addText("You cannot compress a megabyte into 140 bytes.", { x: M, y: 5.1, w: 6.2, h: 0.5, fontFace: BFONT, fontSize: 17, bold: true, color: INK });
s.addText("Not with any trick, transform, or clever math. It's a law, not a limitation. Everyone before us hit this wall and gave up on 2G.",
  { x: M, y: 5.6, w: 6.2, h: 1.2, fontFace: BFONT, fontSize: 15, color: MUTE });
// right: big ratio callout
s.addShape(p.ShapeType.roundRect, { x: 7.4, y: 2.2, w: 5.2, h: 4.5, rectRadius: 0.14, fill: { color: FOREST } });
s.addText("7,000×", { x: 7.4, y: 2.9, w: 5.2, h: 1.2, fontFace: HFONT, fontSize: 60, bold: true, color: AMBER, align: "center" });
s.addText("too big to fit.", { x: 7.4, y: 4.1, w: 5.2, h: 0.6, fontFace: BFONT, fontSize: 22, color: WHITE, align: "center" });
s.addText("The photo will never cross a 2G network.", { x: 7.6, y: 4.9, w: 4.8, h: 0.9, fontFace: BFONT, fontSize: 15, color: MOSS, align: "center" });
s.addNotes("Name the wall honestly and mathematically — it earns credibility for the pivot on the next slide.");

// ============================================================ 5. THE INSIGHT (pivot)
s = p.addSlide(); bg(s, FOREST);
mark(s, M, 1.1, 0.42, MOSS);
s.addText("So we stopped trying to move the data.", { x: M, y: 1.9, w: 11.5, h: 0.9, fontFace: HFONT, fontSize: 34, bold: true, color: WHITE });
s.addText([
  { text: "We move the ", options: {} },
  { text: "decision", options: { color: AMBER, bold: true } },
  { text: " instead.", options: {} },
], { x: M, y: 2.85, w: 11, h: 0.9, fontFace: HFONT, fontSize: 34, bold: true, color: WHITE });
s.addText("A doctor examines you for an hour, then writes one small prescription slip. You don't carry the X-ray machine to the pharmacy — you carry the slip.",
  { x: M, y: 4.0, w: 8.2, h: 1.4, fontFace: BFONT, fontSize: 19, color: "E4EEDD", lineSpacingMultiple: 1.15 });
s.addText([
  { text: "AgriMesh runs the AI on the phone. Only the ", options: { color: "D8E6D0" } },
  { text: "answer", options: { color: MOSS, bold: true } },
  { text: " — 11 bytes — crosses the network. The image is read, then thrown away.", options: { color: "D8E6D0" } },
], { x: M, y: 5.4, w: 8.2, h: 1.2, fontFace: BFONT, fontSize: 17 });
// right stat
s.addShape(p.ShapeType.roundRect, { x: 9.2, y: 3.9, w: 3.4, h: 2.7, rectRadius: 0.14, fill: { color: "0E2817" }, line: { color: GREEN, width: 1 } });
s.addText("11", { x: 9.2, y: 4.15, w: 3.4, h: 1.1, fontFace: HFONT, fontSize: 62, bold: true, color: AMBER, align: "center" });
s.addText("bytes cross the network", { x: 9.3, y: 5.35, w: 3.2, h: 0.5, fontFace: BFONT, fontSize: 15, color: WHITE, align: "center" });
s.addText("D0A ttnfu8r", { x: 9.3, y: 5.85, w: 3.2, h: 0.4, fontFace: "Courier New", fontSize: 14, color: MOSS, align: "center" });
s.addNotes("This is the core idea. Move decisions, not data. Say it plainly — it's the line judges will remember.");

// ============================================================ 6. HOW IT WORKS (flow)
s = p.addSlide(); bg(s, CREAM);
title(s, "How it works — photo in, cure out");
const steps = [
  { t: "Snap the leaf", d: "Farmer photographs it in the field", c: LEAF },
  { t: "AI on the phone", d: "Diagnoses offline in ~1 second", c: GREEN },
  { t: "11-byte SMS", d: "Disease + location, over any 2G signal", c: AMBER },
  { t: "Smart routing", d: "Finds the nearest shop with the cure", c: GREEN },
  { t: "Reply SMS", d: "“Mancozeb at Center A, 4 km”", c: LEAF },
];
const bw = 2.18, gap = 0.28, y0 = 2.4;
steps.forEach((st, i) => {
  const x = M + i * (bw + gap);
  s.addShape(p.ShapeType.roundRect, { x, y: y0, w: bw, h: 2.7, rectRadius: 0.12, fill: { color: WHITE }, line: { color: "E2E0D6", width: 1 } });
  s.addShape(p.ShapeType.ellipse, { x: x + bw / 2 - 0.32, y: y0 + 0.25, w: 0.64, h: 0.64, fill: { color: st.c } });
  s.addText(String(i + 1), { x: x + bw / 2 - 0.32, y: y0 + 0.25, w: 0.64, h: 0.64, fontFace: HFONT, fontSize: 24, bold: true, color: WHITE, align: "center", valign: "middle" });
  s.addText(st.t, { x: x + 0.12, y: y0 + 1.05, w: bw - 0.24, h: 0.6, fontFace: BFONT, fontSize: 15, bold: true, color: INK, align: "center" });
  s.addText(st.d, { x: x + 0.12, y: y0 + 1.6, w: bw - 0.24, h: 1.0, fontFace: BFONT, fontSize: 12.5, color: MUTE, align: "center" });
  if (i < steps.length - 1) s.addText("›", { x: x + bw - 0.02, y: y0 + 0.9, w: gap + 0.04, h: 0.8, fontFace: BFONT, fontSize: 30, bold: true, color: MOSS, align: "center" });
});
s.addShape(p.ShapeType.roundRect, { x: M, y: 5.55, w: W - 2 * M, h: 1.0, rectRadius: 0.1, fill: { color: FOREST } });
s.addText([
  { text: "Steps 1–2 happen on the phone, fully offline. ", options: { color: MOSS, bold: true } },
  { text: "Only the tiny SMS needs a network — so it works exactly where cloud apps fail.", options: { color: WHITE } },
], { x: M + 0.3, y: 5.65, w: W - 2 * M - 0.6, h: 0.8, fontFace: BFONT, fontSize: 16, valign: "middle" });
s.addNotes("Walk the five steps left to right. Emphasise that the heavy lifting is offline on-device.");

// ============================================================ 7. THE AI (proof)
s = p.addSlide(); bg(s, CREAM);
title(s, "A real crop doctor — trained, tested, on-device");
const ai = [
  { n: "107", l: "crop & disease classes", },
  { n: "90%", l: "validation accuracy (91% on unseen images)" },
  { n: "~9 MB", l: "model, runs in the browser — no app store" },
  { n: "$0", l: "cost · fully offline after first load" },
];
ai.forEach((st, i) => {
  const x = M + (i % 2) * 6.05, y = 1.75 + Math.floor(i / 2) * 1.65;
  s.addShape(p.ShapeType.roundRect, { x, y, w: 5.7, h: 1.4, rectRadius: 0.1, fill: { color: WHITE }, line: { color: "E2E0D6", width: 1 } });
  s.addText(st.n, { x: x + 0.25, y, w: 2.1, h: 1.4, fontFace: HFONT, fontSize: 34, bold: true, color: GREEN, valign: "middle" });
  s.addText(st.l, { x: x + 2.3, y, w: 3.2, h: 1.4, fontFace: BFONT, fontSize: 15, color: INK, valign: "middle" });
});
s.addShape(p.ShapeType.roundRect, { x: M, y: 5.15, w: W - 2 * M, h: 1.5, rectRadius: 0.1, fill: { color: MOSS } });
s.addText([
  { text: "Bonus: ", options: { bold: true, color: FOREST } },
  { text: "the app also reads ", options: { color: FOREST } },
  { text: "how much of the leaf is damaged", options: { bold: true, color: FOREST } },
  { text: " and tells the farmer how much to cut — mild, moderate, or severe.", options: { color: FOREST } },
], { x: M + 0.3, y: 5.35, w: W - 2 * M - 0.6, h: 1.1, fontFace: BFONT, fontSize: 18, valign: "middle" });
s.addNotes("These are measured numbers from the shipped model — not aspirations. The damage % is the image-processing layer.");

// ============================================================ 8. SMART ROUTING
s = p.addSlide(); bg(s, CREAM);
title(s, "It doesn't send them to the nearest shop.");
s.addText("It sends them to the nearest shop that actually has the cure in stock.",
  { x: M, y: 1.45, w: 11.8, h: 0.5, fontFace: BFONT, fontSize: 18, color: MUTE });
// simple graph: farmer -> A (empty) skipped -> B (stocked)
const gy = 3.5;
const node = (x, y, label, sub, fill, line) => {
  s.addShape(p.ShapeType.ellipse, { x, y, w: 1.15, h: 1.15, fill: { color: fill }, line: { color: line, width: 2 } });
  s.addText(label, { x: x - 0.6, y: y + 1.2, w: 2.35, h: 0.4, fontFace: BFONT, fontSize: 14, bold: true, color: INK, align: "center" });
  if (sub) s.addText(sub, { x: x - 0.6, y: y + 1.55, w: 2.35, h: 0.35, fontFace: BFONT, fontSize: 12, color: MUTE, align: "center" });
};
s.addShape(p.ShapeType.line, { x: 2.7, y: gy - 0.35, w: 3.2, h: 0.9, flipV: true, line: { color: RED, width: 2.5, dashType: "dash" } });
s.addShape(p.ShapeType.line, { x: 2.7, y: gy + 0.55, w: 6.9, h: 1.4, line: { color: GREEN, width: 4 } });
node(2.1, gy, "Ramesh", "needs fungicide", MOSS, GREEN);
node(5.3, gy - 1.4, "Center A", "3 km · 0 kg — skip", "F1D6D3", RED);
node(9.0, gy + 1.4, "Center B", "4 km · 15 kg ✓", GREEN, GREEN);
s.addShape(p.ShapeType.roundRect, { x: 10.6, y: 2.0, w: 2.1, h: 4.4, rectRadius: 0.12, fill: { color: FOREST } });
s.addText("Stock-aware\nDijkstra", { x: 10.6, y: 2.3, w: 2.1, h: 1.0, fontFace: HFONT, fontSize: 18, bold: true, color: WHITE, align: "center" });
s.addText("An empty shop is treated as if it doesn't exist. The route bends to where the medicine actually is.",
  { x: 10.65, y: 3.5, w: 2.0, h: 2.6, fontFace: BFONT, fontSize: 13, color: MOSS, align: "center" });
s.addNotes("This is the live 'wow' in the demo: set Center B to 0 stock and the route jumps to the next stocked center.");

// ============================================================ 9. RESPONSIBLE AI
s = p.addSlide(); bg(s, CREAM);
title(s, "Honest when it isn't sure");
s.addText("A wrong pesticide can cost a farmer a whole season. So the AI is built to defer, not to guess.",
  { x: M, y: 1.5, w: 11.8, h: 0.6, fontFace: BFONT, fontSize: 18, color: MUTE });
const resp = [
  { t: "Confidence gate", d: "Below 85% it won't name a disease — it says “consult your officer.” Zero confidently-wrong advice." },
  { t: "Top-3 candidates", d: "When look-alike diseases confuse it (e.g. rice), it shows the ranked possibilities instead of a dead end." },
  { t: "Human in the loop", d: "It points to the nearest agri-officer — the AI assists the expert, it doesn't replace them." },
];
resp.forEach((r, i) => {
  const y = 2.3 + i * 1.45;
  s.addShape(p.ShapeType.roundRect, { x: M, y, w: W - 2 * M, h: 1.25, rectRadius: 0.1, fill: { color: WHITE }, line: { color: "E2E0D6", width: 1 } });
  s.addShape(p.ShapeType.ellipse, { x: M + 0.3, y: y + 0.32, w: 0.6, h: 0.6, fill: { color: GREEN } });
  s.addText("✓", { x: M + 0.3, y: y + 0.32, w: 0.6, h: 0.6, fontFace: BFONT, fontSize: 22, bold: true, color: WHITE, align: "center", valign: "middle" });
  s.addText(r.t, { x: M + 1.15, y: y + 0.15, w: 3.2, h: 0.95, fontFace: BFONT, fontSize: 18, bold: true, color: INK, valign: "middle" });
  s.addText(r.d, { x: M + 4.4, y: y + 0.1, w: W - 2 * M - 4.7, h: 1.05, fontFace: BFONT, fontSize: 14.5, color: MUTE, valign: "middle" });
});
s.addNotes("Judges love responsible-AI thinking. This is the maturity slide — it defers rather than misadvises.");

// ============================================================ 10. IT'S BUILT (mock phone)
s = p.addSlide(); bg(s, FOREST);
s.addText("This isn't a mockup. It runs today.", { x: M, y: 0.7, w: 11, h: 0.9, fontFace: HFONT, fontSize: 34, bold: true, color: WHITE });
const built = [
  "On-device AI diagnosis (offline)",
  "Leaf-damage % + how-much-to-cut advice",
  "11-byte SMS payload, 1 segment",
  "Stock-aware routing on a live map",
  "Admin panel + SMS gateway (TextBee)",
  "One command to run · code on GitHub",
];
built.forEach((b, i) => {
  const y = 1.9 + i * 0.72;
  s.addShape(p.ShapeType.ellipse, { x: M, y: y + 0.05, w: 0.28, h: 0.28, fill: { color: MOSS } });
  s.addText(b, { x: M + 0.5, y, w: 6.2, h: 0.5, fontFace: BFONT, fontSize: 17, color: "E4EEDD", valign: "middle" });
});
// phone mock
s.addShape(p.ShapeType.roundRect, { x: 8.7, y: 1.4, w: 3.5, h: 5.4, rectRadius: 0.25, fill: { color: "0E2817" }, line: { color: GREEN, width: 2 } });
s.addShape(p.ShapeType.roundRect, { x: 9.0, y: 1.9, w: 2.9, h: 1.6, rectRadius: 0.1, fill: { color: GREEN } });
s.addText("🦠 Potato — Late Blight", { x: 9.05, y: 2.05, w: 2.8, h: 0.5, fontFace: BFONT, fontSize: 13, bold: true, color: WHITE, align: "center" });
s.addText("Confidence 99%", { x: 9.05, y: 2.6, w: 2.8, h: 0.35, fontFace: BFONT, fontSize: 12, color: "D8E6D0", align: "center" });
s.addText("Leaf damage: 15% · Moderate", { x: 9.05, y: 3.0, w: 2.8, h: 0.35, fontFace: BFONT, fontSize: 11, color: AMBER, align: "center" });
s.addShape(p.ShapeType.roundRect, { x: 9.0, y: 3.7, w: 2.9, h: 1.5, rectRadius: 0.1, fill: { color: "12301C" }, line: { color: GREEN, width: 1 } });
s.addText("💊 Mancozeb", { x: 9.15, y: 3.85, w: 2.7, h: 0.4, fontFace: BFONT, fontSize: 13, bold: true, color: MOSS });
s.addText("Center B · 4.2 km · 15 kg in stock", { x: 9.15, y: 4.25, w: 2.7, h: 0.5, fontFace: BFONT, fontSize: 11, color: "D8E6D0" });
s.addText("SMS → R:1Q C:B D:4.2", { x: 9.15, y: 4.75, w: 2.7, h: 0.35, fontFace: "Courier New", fontSize: 10, color: MOSS });
s.addText("agrimesh — github.com/ag1170-pixel/AgriMesh", { x: 9.0, y: 5.4, w: 2.9, h: 0.5, fontFace: BFONT, fontSize: 9, color: MUTE, align: "center" });
s.addNotes("Pivot to the live demo here. Everything on the list is real and testable right now.");

// ============================================================ 11. IMPACT
s = p.addSlide(); bg(s, CREAM);
title(s, "Why it matters");
const imp = [
  { n: "Works on 2G", l: "Reaches the farmers cloud apps can't — the ones who need it most." },
  { n: "$0 to run", l: "Free model, free hosting, an old Android as the SMS gateway." },
  { n: "Any phone", l: "A web link, no app-store install. Diagnosis in the local language." },
  { n: "Early = saved", l: "A same-day answer instead of a week's wait turns a lost season into a saved one." },
];
imp.forEach((st, i) => {
  const x = M + (i % 2) * 6.05, y = 1.75 + Math.floor(i / 2) * 1.75;
  s.addShape(p.ShapeType.roundRect, { x, y, w: 5.7, h: 1.5, rectRadius: 0.1, fill: { color: WHITE }, line: { color: "E2E0D6", width: 1 } });
  s.addText(st.n, { x: x + 0.25, y: y + 0.15, w: 5.2, h: 0.5, fontFace: HFONT, fontSize: 20, bold: true, color: GREEN });
  s.addText(st.l, { x: x + 0.25, y: y + 0.68, w: 5.2, h: 0.75, fontFace: BFONT, fontSize: 14, color: INK });
});
s.addText("Not a better farming app. The first crop doctor that reaches the disconnected.",
  { x: M, y: 5.5, w: W - 2 * M, h: 0.7, fontFace: HFONT, fontSize: 20, italic: true, bold: true, color: FOREST, align: "center" });
s.addNotes("Tie impact back to the mission: reaching the unreachable, cheaply, in time.");

// ============================================================ 12. CLOSE
s = p.addSlide(); bg(s, FOREST);
s.addShape(p.ShapeType.ellipse, { x: -2.2, y: 3.4, w: 6.5, h: 6.5, fill: { color: GREEN }, line: { color: GREEN } });
mark(s, 11.7, 0.9, 0.5, MOSS);
s.addText("Back to Ramesh.", { x: M, y: 2.0, w: 11, h: 0.9, fontFace: HFONT, fontSize: 40, bold: true, color: WHITE });
s.addText([
  { text: "Two hours ago: dread, and no one to ask.\n", options: {} },
  { text: "Now his ₹3,000 phone — with zero internet — just told him the disease, how bad it is, and where the cure is.", options: {} },
], { x: M, y: 3.1, w: 9.4, h: 1.8, fontFace: BFONT, fontSize: 21, color: "E4EEDD", lineSpacingMultiple: 1.2 });
s.addText([
  { text: "He's on his bicycle. ", options: { color: WHITE, bold: true } },
  { text: "The crop lives. 🌱", options: { color: AMBER, bold: true } },
], { x: M, y: 5.1, w: 11, h: 0.8, fontFace: HFONT, fontSize: 30, bold: true });
s.addText("AgriMesh — move the decision, not the data.", { x: M, y: 6.3, w: 11, h: 0.5, fontFace: BFONT, fontSize: 16, color: MOSS });
s.addNotes("Close the loop you opened. Same farmer, different ending. End on the one-line thesis.");

p.writeFile({ fileName: "AgriMesh_Pitch.pptx" }).then((f) => console.log("wrote", f));
