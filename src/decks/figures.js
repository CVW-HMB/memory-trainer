// Botanical line art, drawn rather than fetched.
//
// Every diagram on a botany card is built here out of numbers, in SVG, at
// render time. Nothing is downloaded, so the deck works offline like the rest
// of the app, weighs nothing, and stays legible at any size on the cream card
// face. Deck JSON therefore carries a *description* of a diagram -- how many
// sepals, whether they are fused, where the ovary sits -- never markup.
//
// Two kinds of picture:
//
//   floralDiagram(spec)  a real floral diagram: concentric whorls seen from
//                        above, the inflorescence axis at the top and the
//                        subtending bract at the bottom, exactly the notation
//                        a systematics text uses.
//   shapeFigure(id)      a named schematic from the library below -- a
//                        spikelet, a silique, a scorpioid cyme. The drawing
//                        lives in code; the deck only names it.
//
// Palette matches the card's paper, so the drawings read as ink on it.
const NS = "http://www.w3.org/2000/svg";
const INK = "#2a1a12";
const SOFT = "#6b5642";
const BRASS = "#98743480";
const SAGE = "#6f855a";
const PETAL = "#c79a4b55";
const FAINT = "#6b564240";

const el = (name, attrs) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, String(attrs[k]));
  return n;
};
const path = (d, attrs) => el("path", { d, ...attrs });
const g = (attrs) => el("g", attrs);
const line = (x1, y1, x2, y2, attrs) => el("line", { x1, y1, x2, y2, ...attrs });
const circle = (cx, cy, r, attrs) => el("circle", { cx, cy, r, ...attrs });

// Small caption text. Deck strings are set with textContent, never as markup.
function label(x, y, text, attrs) {
  const t = el("text", { x, y, "text-anchor": "middle", fill: SOFT, "font-size": 8.5,
    "font-family": "Inter, system-ui, sans-serif", "letter-spacing": ".04em", ...attrs });
  t.textContent = text;
  return t;
}

const stroke = (w, c) => ({ fill: "none", stroke: c || INK, "stroke-width": w,
  "stroke-linecap": "round", "stroke-linejoin": "round" });

const rad = d => d * Math.PI / 180;
const P = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

// A frame every figure shares, so diagrams sit at the same scale card to card.
function frame(viewBox, title) {
  const s = el("svg", { viewBox, class: "fig", role: "img", xmlns: NS });
  const t = el("title", {});
  t.textContent = title || "diagram";
  s.appendChild(t);
  return s;
}

/* ---------------- floral diagrams ----------------
   Seen from above, looking down onto the flower with the stem's axis behind
   it. Outermost whorl first. The odd sepal of a 5-merous calyx is drawn
   posterior (top, toward the axis) and each whorl alternates with the one
   outside it, which is what real diagrams show.                            */

// An arc segment -- the "boat" that stands for one sepal or petal.
function segment(cx, cy, r, deg, halfWidth, depth, attrs) {
  const ro = r + depth / 2, ri = r - depth / 2;
  const [x1, y1] = P(cx, cy, ro, deg - halfWidth);
  const [x2, y2] = P(cx, cy, ro, deg + halfWidth);
  const [x3, y3] = P(cx, cy, ri, deg + halfWidth);
  const [x4, y4] = P(cx, cy, ri, deg - halfWidth);
  return path(`M${x1} ${y1}A${ro} ${ro} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${ri} ${ri} 0 0 0 ${x4} ${y4}Z`, attrs);
}

// One anther in cross-section: two thecae joined by the connective.
function anther(cx, cy, r, deg) {
  const box = g({});
  const [x, y] = P(cx, cy, r, deg);
  const [tx, ty] = [Math.cos(rad(deg + 90)), Math.sin(rad(deg + 90))];
  const off = 3.5;
  box.appendChild(line(x - tx * off, y - ty * off, x + tx * off, y + ty * off, stroke(2.4)));
  for (const k of [-1, 1]) box.appendChild(circle(x + tx * off * k, y + ty * off * k, 3.5,
    { fill: "#efe4cf", stroke: INK, "stroke-width": 1.5 }));
  return box;
}

// The gynoecium at the centre. Fused carpels are one outline divided into
// locules with an ovule in each; free carpels are drawn as separate circles.
function gynoecium(cx, cy, r, gy) {
  const box = g({});
  const carpels = gy.carpels || 1;
  const fused = gy.fused !== false;
  if (!fused) {
    const rr = carpels === 1 ? r : r * 0.42;
    if (carpels === 1) box.appendChild(circle(cx, cy, rr, { fill: "#efe4cf", stroke: INK, "stroke-width": 1.8 }));
    else for (let i = 0; i < Math.min(carpels, 9); i++) {
      const [x, y] = P(cx, cy, r * 0.55, -90 + 360 / Math.min(carpels, 9) * i);
      box.appendChild(circle(x, y, rr, { fill: "#efe4cf", stroke: INK, "stroke-width": 1.5 }));
    }
    return box;
  }
  const locules = gy.locules || carpels;
  box.appendChild(circle(cx, cy, r, { fill: "#efe4cf", stroke: INK, "stroke-width": 2 }));
  if (locules > 1) {
    for (let i = 0; i < locules; i++) {
      const [x, y] = P(cx, cy, r, -90 + 360 / locules * i + 180 / locules);
      box.appendChild(line(cx, cy, x, y, stroke(1.2, SOFT)));
    }
  }
  const ovules = gy.ovules == null ? locules : gy.ovules;
  if (ovules === 1 && locules === 1) box.appendChild(circle(cx, cy, r * 0.34, { fill: SOFT }));
  else for (let i = 0; i < Math.min(ovules, locules * 2); i++) {
    const [x, y] = P(cx, cy, r * 0.5, -90 + 360 / Math.min(ovules, locules * 2) * i);
    box.appendChild(circle(x, y, r * 0.2, { fill: SOFT }));
  }
  return box;
}

// Members of one whorl, plus the connecting line that marks fusion.
function whorl(box, cx, cy, r, spec, style) {
  const n = spec.n || 0;
  // A pappus and a ring of bristles both have a member count of zero -- there
  // are no sepals left to count -- so they have to be tested before the
  // empty-whorl case, not after it.
  if (spec.as === "pappus" || spec.as === "bristles") {
    for (let i = 0; i < 30; i++) {
      const a = -90 + 12 * i;
      const [x1, y1] = P(cx, cy, r - 3, a), [x2, y2] = P(cx, cy, r + 7, a);
      box.appendChild(line(x1, y1, x2, y2, stroke(1.1, SOFT)));
    }
    return;
  }
  if (spec.as === "absent" || n === 0) {
    if (spec.as === "absent") box.appendChild(circle(cx, cy, r, { fill: "none", stroke: FAINT,
      "stroke-width": 1.2, "stroke-dasharray": "1.5 4" }));
    return;
  }
  if (spec.fused) box.appendChild(circle(cx, cy, r, { fill: "none", stroke: style.fill && style.fill !== "none" ? SOFT : SOFT, "stroke-width": 1.4 }));
  const step = 360 / n;
  const start = -90 + (spec.offset || 0);
  for (let i = 0; i < n; i++) {
    const a = start + step * i;
    if (spec.part === "androecium") box.appendChild(anther(cx, cy, r, a));
    else box.appendChild(segment(cx, cy, r, a, Math.min(step * 0.36, 26), style.depth, style));
  }
}

// spec: { symmetry, ovary, bract, axis, whorls: [{part,n,fused,as,offset}], gynoecium }
export function floralDiagram(spec) {
  const s = frame("0 0 210 210", "floral diagram");
  const cx = 105, cy = 107;
  const box = g({});
  s.appendChild(box);

  const RADII = { calyx: 82, corolla: 66, androecium: 48, androecium2: 34 };
  const styles = {
    calyx: { fill: "none", stroke: SAGE, "stroke-width": 2, depth: 9 },
    corolla: { fill: PETAL, stroke: BRASS, "stroke-width": 1.8, depth: 12 },
  };

  if (spec.symmetry === "bilateral") {
    box.appendChild(line(cx, 8, cx, 206, { stroke: FAINT, "stroke-width": 1.2, "stroke-dasharray": "4 4" }));
  }
  if (spec.axis !== false) box.appendChild(circle(cx, 12, 5, { fill: SOFT }));
  if (spec.bract) box.appendChild(segment(cx, cy, 99, 90, 22, 10, { fill: "none", stroke: SAGE, "stroke-width": 2.4 }));

  // Successive whorls alternate: petals sit between sepals, stamens between
  // petals. That is how a real flower is built and how a real diagram is drawn,
  // and it also keeps neighbouring whorls from drawing on top of each other.
  // A whorl may still pin itself with an explicit offset -- the mustards' two
  // short stamens are lateral, not median.
  let androecium = 0;
  const whorls = spec.whorls || [];
  for (let i = 0; i < whorls.length; i++) {
    const w = whorls[i];
    let r, style;
    if (w.part === "androecium") { r = androecium++ ? RADII.androecium2 : RADII.androecium; style = {}; }
    else { r = RADII[w.part]; style = styles[w.part]; }
    if (r == null) continue;
    const stagger = w.offset != null ? w.offset : (i % 2 && w.n ? 180 / w.n : 0);
    whorl(box, cx, cy, r, { ...w, offset: stagger }, style);
  }

  if (spec.ovary === "inferior") {
    box.appendChild(circle(cx, cy, 27, { fill: "none", stroke: SOFT, "stroke-width": 1.3, "stroke-dasharray": "3 3" }));
  }
  box.appendChild(gynoecium(cx, cy, 19, spec.gynoecium || { carpels: 1 }));
  return s;
}

/* ---------------- the shape library ----------------
   Named schematics. Deck data names one; the drawing lives here, so the JSON
   stays a description of a plant rather than a blob of markup. Each entry is a
   viewBox and a function that fills it.                                     */

const S = (vb, draw) => ({ vb, draw });

// A tapered petal/strap from (x,y) heading in a direction -- used for rays,
// lips and limbs.
const strap = (x1, y1, x2, y2, w, attrs) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * w, ny = dx / len * w;
  return path(`M${x1 + nx} ${y1 + ny}L${x2 + nx * 0.5} ${y2 + ny * 0.5}L${x2 - nx * 0.5} ${y2 - ny * 0.5}L${x1 - nx} ${y1 - ny}Z`, attrs);
};

const PET = { fill: PETAL, stroke: BRASS, "stroke-width": 1.6, "stroke-linejoin": "round" };
const GRN = { fill: "none", stroke: SAGE, "stroke-width": 2, "stroke-linecap": "round" };
const SEED = { fill: SOFT, stroke: "none" };

export const SHAPES = {

  /* --- Asteraceae --- */
  head: S("0 0 200 165", s => {
    // longitudinal section: many florets on one receptacle, bracts below
    s.appendChild(strap(58, 104, 16, 86, 7, PET));
    s.appendChild(strap(142, 104, 184, 86, 7, PET));
    for (const x of [74, 87, 100, 113, 126]) {
      const t = (x - 100) / 42, y = 106 - 22 * (1 - t * t);
      s.appendChild(path(`M${x - 4} ${y}L${x - 3} ${y - 15}M${x + 4} ${y}L${x + 3} ${y - 15}`, stroke(1.6)));
      s.appendChild(path(`M${x - 3} ${y - 15}L${x} ${y - 19}L${x + 3} ${y - 15}`, stroke(1.4, SOFT)));
      s.appendChild(line(x, y - 17, x, y - 27, stroke(1.2, SOFT)));
    }
    s.appendChild(path("M58 107Q100 84 142 107", stroke(2.6)));
    s.appendChild(line(100, 112, 100, 150, stroke(3)));
    for (const [x, cx, ex] of [[60, 46, 62], [68, 56, 70], [76, 68, 80]]) {
      s.appendChild(path(`M${x} 106Q${cx} 126 ${ex} 144`, GRN));
      s.appendChild(path(`M${200 - x} 106Q${200 - cx} 126 ${200 - ex} 144`, GRN));
    }
    s.appendChild(label(30, 74, "ray floret"));
    s.appendChild(label(100, 48, "disc florets"));
    s.appendChild(label(100, 160, "involucral bracts"));
  }),

  discFloret: S("0 0 130 165", s => {
    s.appendChild(el("ellipse", { cx: 65, cy: 140, rx: 10, ry: 13, fill: "none", stroke: INK, "stroke-width": 2 }));
    s.appendChild(circle(65, 141, 3.4, SEED));
    for (let i = -3; i <= 3; i++) s.appendChild(line(65 + i * 2.4, 127, 65 + i * 6, 112, stroke(1.1, SOFT)));
    s.appendChild(path("M56 126L58 74L72 74L74 126", stroke(2)));
    s.appendChild(path("M58 74L61 68L65 74L69 68L72 74", stroke(1.5, SOFT)));
    s.appendChild(path("M58 74L58 46L72 46L72 74", { fill: FAINT, stroke: INK, "stroke-width": 1.6 }));
    s.appendChild(line(65, 128, 65, 40, stroke(1.6)));
    s.appendChild(path("M65 42Q57 32 50 30M65 42Q73 32 80 30", stroke(1.6)));
    s.appendChild(label(65, 20, "2 style branches"));
    s.appendChild(label(103, 60, "anther tube"));
    s.appendChild(label(24, 112, "pappus"));
    s.appendChild(label(65, 162, "inferior ovary"));
  }),

  rayFloret: S("0 0 130 165", s => {
    s.appendChild(el("ellipse", { cx: 65, cy: 142, rx: 10, ry: 12, fill: "none", stroke: INK, "stroke-width": 2 }));
    for (let i = -3; i <= 3; i++) s.appendChild(line(65 + i * 2.4, 129, 65 + i * 6, 115, stroke(1.1, SOFT)));
    s.appendChild(path("M54 128L52 52Q65 44 78 52L76 128Z", PET));
    s.appendChild(path("M52 52L56 40M65 46L65 34M78 52L74 40", stroke(1.5, BRASS)));
    s.appendChild(label(65, 24, "3 teeth = 3 fused petals"));
    s.appendChild(label(65, 162, "one flower, not one petal"));
  }),

  ligulateFloret: S("0 0 130 165", s => {
    s.appendChild(el("ellipse", { cx: 65, cy: 142, rx: 10, ry: 12, fill: "none", stroke: INK, "stroke-width": 2 }));
    for (let i = -3; i <= 3; i++) s.appendChild(line(65 + i * 2.4, 129, 65 + i * 6, 115, stroke(1.1, SOFT)));
    s.appendChild(path("M52 128L50 52Q65 44 80 52L78 128Z", PET));
    for (const [x, y] of [[50, 52], [58, 46], [65, 44], [72, 46], [80, 52]])
      s.appendChild(line(x, y, x + (x - 65) * 0.22, y - 11, stroke(1.5, BRASS)));
    s.appendChild(line(65, 128, 65, 30, stroke(1.4, SOFT)));
    s.appendChild(label(65, 22, "5 teeth = all 5 petals"));
    s.appendChild(label(65, 162, "the dandelion type"));
  }),

  syngenesious: S("0 0 170 155", s => {
    const cx = 85, cy = 78;
    s.appendChild(circle(cx, cy, 34, { fill: "none", stroke: SOFT, "stroke-width": 1.3 }));
    for (let i = 0; i < 5; i++) s.appendChild(anther(cx, cy, 34, -90 + 72 * i));
    s.appendChild(circle(cx, cy, 11, { fill: "#efe4cf", stroke: INK, "stroke-width": 2 }));
    s.appendChild(label(cx, 20, "anthers fused into a tube"));
    s.appendChild(label(cx, 140, "the style grows up through it"));
  }),

  /* --- Poaceae --- */
  spikelet: S("0 0 200 165", s => {
    s.appendChild(line(96, 148, 96, 44, stroke(2)));
    s.appendChild(path("M96 146Q66 126 74 98", GRN));
    s.appendChild(path("M96 142Q126 122 118 92", GRN));
    for (const [y, k] of [[120, -1], [96, 1], [72, -1]]) {
      s.appendChild(path(`M96 ${y + 12}Q${96 + 30 * k} ${y - 2} ${96 + 20 * k} ${y - 22}`, stroke(2)));
      s.appendChild(path(`M96 ${y + 10}Q${96 + 17 * k} ${y - 2} ${96 + 12 * k} ${y - 18}`, stroke(1.4, SOFT)));
      s.appendChild(line(96 + 20 * k, y - 22, 96 + 30 * k, y - 46, stroke(1.1, SOFT)));
    }
    s.appendChild(label(40, 92, "glumes"));
    s.appendChild(label(166, 82, "lemma"));
    s.appendChild(label(160, 130, "palea"));
    s.appendChild(label(100, 22, "awn"));
    s.appendChild(label(100, 161, "florets stacked on a rachilla"));
  }),

  grassFloret: S("0 0 190 165", s => {
    s.appendChild(path("M46 140Q20 94 46 42", stroke(2.4)));
    s.appendChild(path("M136 140Q158 96 134 48", stroke(1.8, SOFT)));
    for (const k of [-1, 1]) {
      const x0 = 91 + 9 * k;
      s.appendChild(path(`M${x0} 116Q${91 + 34 * k} 96 ${91 + 46 * k} 58`, stroke(1.8)));
      for (let i = 1; i < 8; i++) {
        const u = i / 8, x = x0 + (91 + 34 * k - x0) * 2 * u * (1 - u) + (91 + 46 * k - x0) * u * u;
        const y = 116 - 58 * u;
        s.appendChild(line(x, y, x + 8 * k, y - 4, stroke(0.9, SOFT)));
      }
    }
    for (const dx of [-17, 0, 17]) {
      s.appendChild(line(91, 122, 91 + dx * 1.3, 90, stroke(1.2, SOFT)));
      s.appendChild(el("ellipse", { cx: 91 + dx * 1.3, cy: 82, rx: 3.6, ry: 9,
        fill: "#efe4cf", stroke: INK, "stroke-width": 1.5 }));
    }
    s.appendChild(el("ellipse", { cx: 91, cy: 128, rx: 9, ry: 11, fill: "none", stroke: INK, "stroke-width": 1.8 }));
    for (const k of [-1, 1]) s.appendChild(path(`M${91 + 11 * k} 138Q${91 + 17 * k} 130 ${91 + 9 * k} 124`,
      { fill: PETAL, stroke: BRASS, "stroke-width": 1.4 }));
    s.appendChild(label(24, 156, "lemma"));
    s.appendChild(label(158, 156, "palea"));
    s.appendChild(label(91, 158, "2 lodicules"));
    s.appendChild(label(95, 22, "3 stamens, 2 feathery stigmas"));
  }),

  liguleGrass: S("0 0 190 165", s => {
    s.appendChild(path("M76 158L76 74M96 158L96 74", stroke(2.2)));
    s.appendChild(line(74, 120, 98, 120, stroke(3)));
    s.appendChild(path("M96 74Q132 58 172 34", GRN));
    s.appendChild(path("M96 86Q130 72 170 50", GRN));
    s.appendChild(path("M76 74Q86 62 96 74Z", { fill: FAINT, stroke: INK, "stroke-width": 1.6 }));
    s.appendChild(path("M78 68l0 -6M86 63l0 -7M94 68l0 -6", stroke(1, SOFT)));
    s.appendChild(line(52, 62, 72, 70, stroke(0.9, SOFT)));
    s.appendChild(line(52, 120, 70, 120, stroke(0.9, SOFT)));
    s.appendChild(label(38, 60, "ligule"));
    s.appendChild(label(38, 123, "node"));
    s.appendChild(label(95, 20, "sheath wraps the stem, open"));
  }),

  culmHollow: S("0 0 170 130", s => {
    s.appendChild(circle(85, 62, 42, { fill: "none", stroke: INK, "stroke-width": 2.4 }));
    s.appendChild(circle(85, 62, 27, { fill: "none", stroke: INK, "stroke-width": 1.8 }));
    s.appendChild(label(85, 116, "round, hollow, jointed at nodes"));
  }),

  culmTriangular: S("0 0 170 130", s => {
    s.appendChild(path("M85 20L128 96L42 96Z", { fill: FAINT, stroke: INK, "stroke-width": 2.4, "stroke-linejoin": "round" }));
    s.appendChild(label(85, 118, "3-sided, solid, no nodes"));
  }),

  ranks2: S("0 0 170 140", s => {
    s.appendChild(circle(85, 66, 12, { fill: "none", stroke: INK, "stroke-width": 2 }));
    for (const a of [0, 180]) s.appendChild(strap(85 + 12 * Math.cos(rad(a)), 66 + 12 * Math.sin(rad(a)),
      85 + 60 * Math.cos(rad(a)), 66 + 60 * Math.sin(rad(a)), 9, GRN));
    s.appendChild(label(85, 124, "2-ranked: leaves in one plane"));
  }),

  ranks3: S("0 0 170 140", s => {
    s.appendChild(circle(85, 62, 12, { fill: "none", stroke: INK, "stroke-width": 2 }));
    for (const a of [-90, 30, 150]) s.appendChild(strap(85 + 12 * Math.cos(rad(a)), 62 + 12 * Math.sin(rad(a)),
      85 + 52 * Math.cos(rad(a)), 62 + 52 * Math.sin(rad(a)), 9, GRN));
    s.appendChild(label(85, 128, "3-ranked: leaves at 120°"));
  }),

  /* --- Cyperaceae --- */
  sedgeSpike: S("0 0 170 165", s => {
    s.appendChild(line(85, 150, 85, 30, stroke(2)));
    for (let i = 0; i < 6; i++) {
      const y = 138 - i * 19, k = i % 2 ? 1 : -1;
      s.appendChild(path(`M85 ${y}Q${85 + 26 * k} ${y - 4} ${85 + 20 * k} ${y - 18}`, GRN));
      s.appendChild(path(`M${85 + 8 * k} ${y - 4}l${5 * k} -8l${-5 * k} -7Z`, { fill: FAINT, stroke: INK, "stroke-width": 1.2 }));
    }
    s.appendChild(label(85, 22, "one flower behind each scale"));
    s.appendChild(label(85, 162, "no sepals, no petals"));
  }),

  perigynium: S("0 0 150 168", s => {
    s.appendChild(path("M75 150Q44 136 48 96Q50 64 68 48L70 38L80 38L82 48Q100 64 102 96Q106 136 75 150Z",
      { fill: "none", stroke: INK, "stroke-width": 2.2 }));
    s.appendChild(path("M75 128Q58 116 62 96Q66 78 75 70Q84 78 88 96Q92 116 75 128Z",
      { fill: FAINT, stroke: SOFT, "stroke-width": 1.4 }));
    for (const a of [-125, -90, -55]) s.appendChild(line(75, 40, ...P(75, 40, 26, a), stroke(1.4, SOFT)));
    s.appendChild(label(75, 166, "an achene sealed in a sac (Carex)"));
    s.appendChild(label(75, 12, "3 stigmas out of the beak"));
  }),

  /* --- Fabaceae --- */
  papilionaceous: S("0 0 200 165", s => {
    s.appendChild(path("M100 84Q54 74 48 40Q70 16 100 18Q130 16 152 40Q146 74 100 84Z", PET));
    s.appendChild(path("M52 92Q30 90 26 106Q40 122 74 116Z", PET));
    s.appendChild(path("M148 92Q170 90 174 106Q160 122 126 116Z", PET));
    s.appendChild(path("M74 96Q100 88 126 96Q130 122 100 134Q70 122 74 96Z",
      { fill: "#efe4cf", stroke: BRASS, "stroke-width": 1.8 }));
    s.appendChild(label(100, 12, "banner (standard)"));
    s.appendChild(label(26, 136, "wing"));
    s.appendChild(label(174, 136, "wing"));
    s.appendChild(label(100, 152, "keel — stamens and style inside"));
  }),

  diadelphous: S("0 0 170 150", s => {
    s.appendChild(path("M40 118Q42 66 85 58Q128 66 130 118", { fill: FAINT, stroke: INK, "stroke-width": 2 }));
    for (let i = 0; i < 9; i++) {
      const x = 44 + i * 10.2;
      s.appendChild(line(x, 116, 85 + (x - 85) * 0.34, 52, stroke(1.1, SOFT)));
      s.appendChild(circle(85 + (x - 85) * 0.34, 47, 3.2, { fill: "#efe4cf", stroke: INK, "stroke-width": 1.3 }));
    }
    s.appendChild(line(85, 122, 85, 34, stroke(1.8)));
    s.appendChild(circle(85, 29, 3.6, { fill: "#efe4cf", stroke: INK, "stroke-width": 1.6 }));
    s.appendChild(label(85, 142, "9 filaments fused, 1 free — (9)+1"));
  }),

  legume: S("0 0 200 140", s => {
    s.appendChild(path("M22 74Q60 30 108 40Q152 50 176 84Q150 106 104 96Q56 88 22 74Z",
      { fill: "none", stroke: INK, "stroke-width": 2.2 }));
    for (const [x, y] of [[58, 62], [86, 62], [114, 68], [140, 76]]) s.appendChild(circle(x, y, 8, SEED));
    s.appendChild(path("M22 74Q56 88 104 96Q150 106 176 84", stroke(1.4, SOFT)));
    s.appendChild(label(100, 122, "one carpel, splits down both seams"));
    s.appendChild(label(100, 22, "seeds in a single row"));
  }),

  /* --- Brassicaceae --- */
  cruciform: S("0 0 170 165", s => {
    const cx = 85, cy = 80;
    for (const a of [-90, 0, 90, 180]) s.appendChild(el("ellipse",
      { cx: cx + 36 * Math.cos(rad(a)), cy: cy + 36 * Math.sin(rad(a)), rx: 17, ry: 27,
        transform: `rotate(${a + 90} ${cx + 36 * Math.cos(rad(a))} ${cy + 36 * Math.sin(rad(a))})`, ...PET }));
    for (const a of [-45, 45, 135, 225]) s.appendChild(segment(cx, cy, 30, a, 16, 8, { fill: "none", stroke: SAGE, "stroke-width": 1.8 }));
    s.appendChild(circle(cx, cy, 9, { fill: "#efe4cf", stroke: INK, "stroke-width": 1.8 }));
    s.appendChild(label(cx, 158, "4 free petals in a cross"));
  }),

  tetradynamous: S("0 0 170 155", s => {
    s.appendChild(line(85, 128, 85, 40, stroke(2.2)));
    s.appendChild(el("ellipse", { cx: 85, cy: 34, rx: 7, ry: 8, fill: "#efe4cf", stroke: INK, "stroke-width": 1.8 }));
    for (const [dx, top] of [[-16, 48], [-8, 48], [8, 48], [16, 48]]) {
      s.appendChild(line(85 + dx * 1.5, 128, 85 + dx, top + 8, stroke(1.4)));
      s.appendChild(el("ellipse", { cx: 85 + dx, cy: top, rx: 4, ry: 7.5, fill: "#efe4cf", stroke: INK, "stroke-width": 1.4 }));
    }
    for (const dx of [-40, 40]) {
      s.appendChild(line(85 + dx, 128, 85 + dx * 0.86, 86, stroke(1.4)));
      s.appendChild(el("ellipse", { cx: 85 + dx * 0.86, cy: 78, rx: 4, ry: 7.5, fill: "#efe4cf", stroke: INK, "stroke-width": 1.4 }));
    }
    s.appendChild(label(85, 148, "6 stamens: 4 long, 2 short"));
  }),

  silique: S("0 0 200 160", s => {
    s.appendChild(path("M104 124L104 28", stroke(2)));
    s.appendChild(path("M104 120Q74 102 76 68Q78 40 104 32", { fill: "none", stroke: INK, "stroke-width": 2 }));
    s.appendChild(path("M104 120Q134 102 132 68Q130 40 104 32", { fill: FAINT, stroke: SOFT, "stroke-width": 1.6 }));
    s.appendChild(path("M44 122Q26 98 30 64Q34 36 48 26", { fill: PETAL, stroke: BRASS, "stroke-width": 1.8 }));
    for (const y of [48, 66, 84, 102]) s.appendChild(circle(90, y, 5.5, SEED));
    s.appendChild(line(140, 76, 158, 76, stroke(0.9, SOFT)));
    s.appendChild(label(180, 79, "septum"));
    s.appendChild(label(38, 142, "valve"));
    s.appendChild(label(104, 18, "replum"));
    s.appendChild(label(112, 152, "3+ times longer than wide"));
  }),

  silicle: S("0 0 200 140", s => {
    s.appendChild(path("M100 110L100 44", stroke(2)));
    s.appendChild(path("M100 108Q62 96 62 76Q62 54 100 46", { fill: "none", stroke: INK, "stroke-width": 2 }));
    s.appendChild(path("M100 108Q138 96 138 76Q138 54 100 46", { fill: FAINT, stroke: SOFT, "stroke-width": 1.6 }));
    for (const [x, y] of [[84, 66], [84, 88]]) s.appendChild(circle(x, y, 5.5, SEED));
    s.appendChild(label(100, 130, "same fruit, under 3 times as long"));
    s.appendChild(label(100, 28, "the rim left behind is the replum"));
  }),

  /* --- Polygonaceae --- */
  ocrea: S("0 0 150 165", s => {
    s.appendChild(line(60, 152, 60, 26, stroke(3)));
    s.appendChild(path("M46 108Q46 78 74 74Q76 104 74 110Z", { fill: FAINT, stroke: INK, "stroke-width": 2 }));
    s.appendChild(path("M46 108Q60 114 74 110", stroke(1.4, SOFT)));
    s.appendChild(path("M72 78Q106 62 132 40", GRN));
    s.appendChild(path("M72 88Q104 74 130 52", GRN));
    s.appendChild(label(28, 62, "ocrea"));
    s.appendChild(label(75, 162, "a papery sheath at every node"));
  }),

  swollenNode: S("0 0 160 150", s => {
    s.appendChild(path("M68 118L68 92Q56 80 68 68L68 26", stroke(3)));
    s.appendChild(el("ellipse", { cx: 68, cy: 80, rx: 13, ry: 9, fill: FAINT, stroke: INK, "stroke-width": 2 }));
    s.appendChild(line(84, 80, 100, 80, stroke(0.9, SOFT)));
    s.appendChild(label(122, 83, "swollen"));
    s.appendChild(label(78, 142, "the knots in knotweed are nodes"));
  }),

  involucreCup: S("0 0 170 150", s => {
    s.appendChild(path("M52 118Q48 82 62 76L108 76Q122 82 118 118Z", { fill: FAINT, stroke: INK, "stroke-width": 2.2 }));
    s.appendChild(path("M62 76l4 -10l6 10l5 -10l6 10l5 -10l6 10l5 -10l4 10", stroke(1.6, SAGE)));
    for (const [x, y] of [[70, 44], [85, 34], [100, 44]]) {
      s.appendChild(line(85, 78, x, y + 6, stroke(1.3, SOFT)));
      s.appendChild(circle(x, y, 6, { fill: PETAL, stroke: BRASS, "stroke-width": 1.4 }));
    }
    s.appendChild(label(85, 140, "no ocrea, but an involucre"));
  }),

  acheneTrigonous: S("0 0 150 140", s => {
    s.appendChild(path("M60 30L86 92L34 92Z", { fill: "none", stroke: INK, "stroke-width": 2.2, "stroke-linejoin": "round" }));
    s.appendChild(line(60, 30, 60, 92, stroke(1.2, SOFT)));
    s.appendChild(path("M118 46L134 78L102 78Z", { fill: FAINT, stroke: INK, "stroke-width": 1.6, "stroke-linejoin": "round" }));
    s.appendChild(label(118, 96, "section"));
    s.appendChild(label(75, 122, "one seed, three sharp angles"));
  }),

  /* --- Boraginaceae --- */
  scorpioid: S("0 0 200 155", s => {
    s.appendChild(path("M18 128Q64 128 92 112Q124 94 130 70Q134 50 118 44Q102 40 100 56Q99 68 112 70", stroke(2.4)));
    const pts = [[30, 126], [54, 122], [78, 114], [98, 100], [114, 82]];
    for (const [x, y] of pts) s.appendChild(circle(x, y - 12, 8, { fill: PETAL, stroke: BRASS, "stroke-width": 1.5 }));
    for (const [x, y] of pts) s.appendChild(line(x, y, x, y - 5, stroke(1.2, SOFT)));
    s.appendChild(label(100, 146, "youngest buds coiled at the tip"));
    s.appendChild(label(150, 40, "a fiddleneck"));
  }),

  nutlets4: S("0 0 170 150", s => {
    s.appendChild(circle(85, 72, 46, { fill: "none", stroke: SAGE, "stroke-width": 2.2 }));
    for (const a of [-45, 45, 135, 225]) {
      const [x, y] = P(85, 72, 21, a);
      s.appendChild(circle(x, y, 17, { fill: FAINT, stroke: INK, "stroke-width": 1.8 }));
    }
    s.appendChild(circle(85, 72, 4.5, { fill: INK }));
    s.appendChild(label(85, 138, "4 nutlets seated in the old calyx"));
  }),

  gynobasic: S("0 0 150 165", s => {
    for (const dx of [-22, -7, 7, 22]) s.appendChild(el("ellipse",
      { cx: 75 + dx, cy: 112, rx: 11, ry: 17, fill: FAINT, stroke: INK, "stroke-width": 1.8 }));
    s.appendChild(line(75, 122, 75, 36, stroke(2.4)));
    s.appendChild(path("M75 40Q68 30 62 28M75 40Q82 30 88 28", stroke(1.6)));
    s.appendChild(label(75, 148, "the style rises between the 4 lobes"));
    s.appendChild(label(75, 16, "gynobasic"));
  }),

  /* --- Polemoniaceae --- */
  salverform: S("0 0 200 168", s => {
    s.appendChild(path("M48 132L48 62Q48 52 58 52L62 52", stroke(2)));
    s.appendChild(path("M68 132L68 62Q68 52 58 52", stroke(2)));
    s.appendChild(path("M48 58Q32 36 18 30M68 58Q84 36 98 30", { fill: PETAL, stroke: BRASS, "stroke-width": 1.8 }));
    s.appendChild(line(58, 126, 58, 36, stroke(1.2, SOFT)));
    const cx = 150, cy = 74;
    for (let i = 0; i < 5; i++) s.appendChild(el("ellipse",
      { cx: cx + 26 * Math.cos(rad(-90 + 72 * i)), cy: cy + 26 * Math.sin(rad(-90 + 72 * i)), rx: 15, ry: 21,
        transform: `rotate(${72 * i} ${cx + 26 * Math.cos(rad(-90 + 72 * i))} ${cy + 26 * Math.sin(rad(-90 + 72 * i))})`, ...PET }));
    s.appendChild(circle(cx, cy, 8, { fill: "#efe4cf", stroke: INK, "stroke-width": 1.6 }));
    s.appendChild(label(58, 152, "side on"));
    s.appendChild(label(150, 130, "face on"));
    s.appendChild(label(100, 165, "narrow tube, abrupt flat limb"));
  }),

  capsule3: S("0 0 170 160", s => {
    s.appendChild(path("M85 130Q54 118 56 84Q58 50 85 32Q112 50 114 84Q116 118 85 130Z", { fill: "none", stroke: INK, "stroke-width": 2.2 }));
    s.appendChild(path("M85 32L85 130M85 78Q66 84 58 96M85 78Q104 84 112 96", stroke(1.3, SOFT)));
    const cx = 85, cy = 78;
    for (const a of [-90, 30, 150]) s.appendChild(line(cx, cy, ...P(cx, cy, 27, a), stroke(1.2, SOFT)));
    s.appendChild(label(85, 150, "3 chambers, seeds on the axis"));
  }),

  /* --- Onagraceae --- */
  hypanthiumInferior: S("0 0 170 170", s => {
    s.appendChild(el("ellipse", { cx: 85, cy: 138, rx: 20, ry: 22, fill: "none", stroke: INK, "stroke-width": 2.2 }));
    for (const [x, y] of [[78, 132], [92, 132], [78, 144], [92, 144]]) s.appendChild(circle(x, y, 4, SEED));
    s.appendChild(path("M71 120L74 66M99 120L96 66", stroke(2)));
    s.appendChild(path("M74 66Q56 50 40 44M96 66Q114 50 130 44", { fill: PETAL, stroke: BRASS, "stroke-width": 1.8 }));
    s.appendChild(path("M74 66Q62 60 52 62M96 66Q108 60 118 62", { fill: "none", stroke: SAGE, "stroke-width": 1.6 }));
    s.appendChild(line(85, 128, 85, 34, stroke(1.6)));
    s.appendChild(path("M85 36l-9 -8M85 36l9 -8M85 36l0 -11M85 36l0 0", stroke(1.4)));
    s.appendChild(label(140, 96, "floral tube"));
    s.appendChild(label(85, 168, "ovary below the flower"));
    s.appendChild(label(85, 16, "4 parts, 4-lobed stigma"));
  }),

  stigma4: S("0 0 150 140", s => {
    s.appendChild(line(75, 116, 75, 64, stroke(2.4)));
    for (const a of [-90, 0, 90, 180]) s.appendChild(el("ellipse",
      { cx: 75 + 17 * Math.cos(rad(a)), cy: 62 + 17 * Math.sin(rad(a)), rx: 8, ry: 12,
        transform: `rotate(${a + 90} ${75 + 17 * Math.cos(rad(a))} ${62 + 17 * Math.sin(rad(a))})`,
        fill: FAINT, stroke: INK, "stroke-width": 1.6 }));
    s.appendChild(label(75, 134, "count the lobes, count the carpels"));
  }),

  merous4: S("0 0 170 165", s => {
    const cx = 85, cy = 78;
    for (const a of [-90, 0, 90, 180]) s.appendChild(el("ellipse",
      { cx: cx + 40 * Math.cos(rad(a)), cy: cy + 40 * Math.sin(rad(a)), rx: 20, ry: 26,
        transform: `rotate(${a + 90} ${cx + 40 * Math.cos(rad(a))} ${cy + 40 * Math.sin(rad(a))})`, ...PET }));
    for (const a of [-45, 45, 135, 225]) s.appendChild(segment(cx, cy, 34, a, 17, 8, { fill: "none", stroke: SAGE, "stroke-width": 1.8 }));
    for (let i = 0; i < 8; i++) s.appendChild(anther(cx, cy, 20, -90 + 45 * i));
    s.appendChild(label(cx, 158, "4 sepals, 4 petals, 8 stamens"));
  }),

  /* --- Plantaginaceae and the two-lipped families --- */
  bilabiate: S("0 0 200 165", s => {
    s.appendChild(path("M26 116Q22 78 52 70L110 58L112 92L58 100Q34 104 26 116Z",
      { fill: "#efe4cf", stroke: INK, "stroke-width": 2 }));
    s.appendChild(path("M110 58Q136 40 166 46Q150 66 114 74Z", PET));
    s.appendChild(path("M112 92Q142 96 168 120Q134 130 110 108Z", PET));
    s.appendChild(path("M138 44Q136 58 128 70", stroke(1.2, BRASS)));
    s.appendChild(path("M132 108Q142 112 148 124M118 100Q126 110 128 122", stroke(1.2, BRASS)));
    s.appendChild(label(158, 32, "2 upper lobes"));
    s.appendChild(label(160, 146, "3 lower lobes"));
    s.appendChild(label(96, 160, "one top lip, one bottom lip"));
  }),

  didynamous: S("0 0 170 150", s => {
    s.appendChild(path("M42 124Q38 66 85 56Q132 66 128 124", { fill: "none", stroke: SOFT, "stroke-width": 1.6, "stroke-dasharray": "4 4" }));
    for (const [dx, top] of [[-26, 52], [26, 52], [-11, 78], [11, 78]]) {
      s.appendChild(line(85 + dx * 1.6, 122, 85 + dx, top + 8, stroke(1.5)));
      s.appendChild(el("ellipse", { cx: 85 + dx, cy: top, rx: 4.5, ry: 8, fill: "#efe4cf", stroke: INK, "stroke-width": 1.5 }));
    }
    s.appendChild(label(85, 142, "4 stamens in two unequal pairs"));
  }),

  capsuleAxile: S("0 0 170 155", s => {
    s.appendChild(circle(85, 72, 42, { fill: "none", stroke: INK, "stroke-width": 2.2 }));
    s.appendChild(line(85, 30, 85, 114, stroke(1.4, SOFT)));
    for (const [x, y] of [[68, 50], [102, 50], [68, 94], [102, 94], [70, 72], [100, 72]]) s.appendChild(circle(x, y, 6, SEED));
    s.appendChild(label(85, 134, "seeds on the central column (axile)"));
  }),

  /* --- Lamiaceae, the family everyone confuses with the above --- */
  squareStem: S("0 0 170 140", s => {
    s.appendChild(path("M56 34L114 34L114 92L56 92Z", { fill: FAINT, stroke: INK, "stroke-width": 2.4, "stroke-linejoin": "round" }));
    for (const [x, y, ex, ey] of [[56, 63, 16, 63], [114, 63, 154, 63]]) s.appendChild(strap(x, y, ex, ey, 8, GRN));
    s.appendChild(label(85, 122, "square stem, leaves in opposite pairs"));
  }),

  verticillaster: S("0 0 170 170", s => {
    s.appendChild(line(85, 158, 85, 26, stroke(2.6)));
    for (const y of [126, 90, 54]) {
      for (const k of [-1, 1]) {
        s.appendChild(strap(85, y, 85 + 42 * k, y - 14, 7, GRN));
        for (const dx of [14, 25, 34]) s.appendChild(circle(85 + dx * k, y - 6, 6, { fill: PETAL, stroke: BRASS, "stroke-width": 1.3 }));
      }
    }
    s.appendChild(label(85, 168, "flower clusters in the leaf axils"));
  }),

  /* --- inflorescences and fruits shared across families --- */
  raceme: S("0 0 150 165", s => {
    s.appendChild(line(70, 152, 70, 26, stroke(2.4)));
    for (let i = 0; i < 5; i++) {
      const y = 138 - i * 24, k = i % 2 ? 1 : -1, r = 9 - i * 1.1;
      s.appendChild(line(70, y, 70 + 26 * k, y - 6, stroke(1.4, SOFT)));
      s.appendChild(circle(70 + 30 * k, y - 7, r, { fill: PETAL, stroke: BRASS, "stroke-width": 1.4 }));
    }
    s.appendChild(label(70, 164, "oldest at the bottom, buds on top"));
  }),

  umbelCompound: S("0 0 200 155", s => {
    s.appendChild(line(100, 146, 100, 100, stroke(2.6)));
    for (const a of [-150, -120, -90, -60, -30]) {
      const [x, y] = P(100, 100, 52, a);
      s.appendChild(line(100, 100, x, y, stroke(1.8)));
      for (const b of [-140, -110, -70, -40]) {
        const [x2, y2] = P(x, y, 15, b);
        s.appendChild(line(x, y, x2, y2, stroke(1, SOFT)));
        s.appendChild(circle(x2, y2, 3.4, { fill: PETAL, stroke: BRASS, "stroke-width": 1 }));
      }
    }
    s.appendChild(label(100, 138, "umbels of umbels"));
  }),

  schizocarp2: S("0 0 150 155", s => {
    s.appendChild(line(75, 24, 75, 66, stroke(2)));
    s.appendChild(path("M75 66L58 74M75 66L92 74", stroke(1.6)));
    for (const k of [-1, 1]) {
      s.appendChild(path(`M${75 + 17 * k} 74Q${75 + 36 * k} 96 ${75 + 26 * k} 126Q${75 + 12 * k} 128 ${75 + 8 * k} 100Q${75 + 8 * k} 82 ${75 + 17 * k} 74Z`,
        { fill: FAINT, stroke: INK, "stroke-width": 1.8 }));
      for (const d of [0.35, 0.6, 0.85]) s.appendChild(line(75 + (12 + 8 * d) * k, 84, 75 + (14 + 10 * d) * k, 120, stroke(0.9, SOFT)));
    }
    s.appendChild(label(75, 146, "one fruit splitting into two halves"));
  }),
};

// The renderer only needs a function; the drawing stays here, in the deck layer.
export function shapeFigure(id) {
  const sh = SHAPES[id];
  if (!sh) {
    const s = frame("0 0 200 60", "missing figure");
    s.appendChild(label(100, 34, "no figure named “" + id + "”", { fill: "#a5526a" }));
    return s;
  }
  // Every shape is drawn in its own coordinate box but framed to a common
  // 200-wide viewBox, so a caption has the same room -- and label type the same
  // size -- whatever the drawing's natural width.
  const [, , w, h] = sh.vb.split(" ").map(Number);
  const s = frame(`0 0 200 ${h}`, id);
  const box = g({ transform: `translate(${(200 - w) / 2} 0)` });
  s.appendChild(box);
  sh.draw(box);
  return s;
}

export const SHAPE_IDS = Object.keys(SHAPES);
