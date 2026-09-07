// Validates every deck listed in data/decks.json: per-type schema, unique ids,
// declared groups, and the rule that makes a deck work at all -- one
// determinate answer per prompt.
//
// Run: npm run validate
import { readFileSync } from "node:fs";
import { SHAPE_IDS } from "../src/decks/figures.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = rel => JSON.parse(readFileSync(join(root, rel.replace(/^\.\//, "")), "utf8"));

// Required string fields per card type.
const REQUIRED = {
  place2grape: ["grape", "country", "region", "notes"],
  decode: ["appellation", "grape", "country", "region", "notes"],
  grapehome: ["grape", "home", "also"],
  vocab: ["lang", "term", "gloss", "kindTerm", "kindGloss"],
  conjugation: ["lang", "verb", "english", "tense", "tenseEn", "kindTerm", "kindGloss"],
  glossary: ["term", "short", "definition", "kind"],
  floral: ["family", "common", "form", "formula", "note"],
  feature: ["term", "kind", "description", "where"],
  idclue: ["family", "common", "example"],
  checklist: ["family", "common", "place", "genera"],
};

// Which faces a card presents, and whether it may be shown in both directions.
// This mirrors src/decks/registry.js: if a type flips there, both of its faces
// must be unique here.
const FACES = {
  place2grape: { reversible: false, front: c => `place|${c.country}|${c.region}|${c.notes}`,
                                    back: c => `grape|${c.grape}` },
  decode:      { reversible: false, front: c => `label|${c.appellation}`,
                                    back: c => `wine|${c.grape}|${c.country}|${c.region}|${c.notes}` },
  grapehome:   { reversible: false, front: c => `grape|${c.grape}`,
                                    back: c => `home|${c.home}` },
  vocab:       { reversible: true,  front: c => `term|${c.term}`,
                                    back: c => `gloss|${c.gloss}` },
  conjugation: { reversible: true,  front: c => `term|${c.verb}|${c.tense}`,
                                    back: c => `gloss|${c.english}|${c.tenseEn}` },
  glossary:    { reversible: false, front: c => `term|${c.term}`,
                                    back: c => `def|${c.short}|${c.definition}` },
  // Botany. None of these flip, and for idclue the answer face is *expected* to
  // repeat -- one family answers to many clue sets -- so it returns null, which
  // means "this face is never a prompt, do not check it".
  floral:      { reversible: false, front: c => `flower|${c.family}|${c.form}`,
                                    back: c => `diagram|${c.family}|${c.form}|${c.formula}` },
  feature:     { reversible: false, front: c => `desc|${c.description}`,
                                    back: c => `term|${c.term}` },
  idclue:      { reversible: false, front: c => `clues|${JSON.stringify(c.clues)}`,
                                    back: () => null },
  checklist:   { reversible: false, front: c => `family|${c.family}`,
                                    back: () => null },
};

// An independent re-derivation of a floral formula from the floral diagram.
// scripts/generate_botany.py derives the string that ships in the deck; this
// derives it again, in another language, and the check below fails if the two
// disagree. That is what stops a card from printing "C(5)" over a drawing with
// four petals.
function whorlToken(w) {
  const as = w.as;
  if (as === "absent") return "0";
  if (as === "pappus") return " pappus";
  if (as === "bristles") return " bristles";
  if (as === "lodicules") return ` ${w.n} lodicules`;
  if (!w.n) return "0";
  return w.fused ? `(${w.n})` : String(w.n);
}

function formulaFor(d) {
  const perianth = d.whorls.filter(w => w.part !== "androecium");
  const andro = d.whorls.filter(w => w.part === "androecium");
  const out = [];
  const tepal = perianth.find(w => w.p);
  if (tepal) out.push("P" + whorlToken(tepal));
  else for (const w of perianth) out.push((w.part === "calyx" ? "K" : "C") + whorlToken(w));
  out.push("A" + (d.andro || andro.map(whorlToken).join("+")));
  const gy = d.gynoecium;
  const fused = gy.fused !== false;
  out.push("G" + (fused && gy.carpels > 1 ? `(${gy.carpels})` : String(gy.carpels)) +
           (d.ovary === "inferior" ? " inferior" : ""));
  return (d.symmetry === "bilateral" ? "↓" : "*") + " " + out.join(" · ");
}

let failed = false;

for (const deck of read("./data/decks.json")) {
  const errors = [], warnings = [];
  const cards = read(deck.file);
  const groups = new Set((deck.groups || []).map(g => g.id));
  const ids = new Set();
  const fronts = new Map(), backs = new Map();

  for (const c of cards) {
    const at = c.id || JSON.stringify(c).slice(0, 40);
    if (!c.id) errors.push(`missing id: ${at}`);
    if (ids.has(c.id)) errors.push(`duplicate id: ${c.id}`);
    ids.add(c.id);
    if (!groups.has(c.group)) errors.push(`${at}: group ${c.group} is not declared in decks.json`);
    if (!REQUIRED[c.type]) { errors.push(`${at}: unknown type ${c.type}`); continue; }
    for (const f of REQUIRED[c.type]) {
      if (!c[f] || typeof c[f] !== "string") errors.push(`${at}: missing field ${f}`);
    }

    // Conjugation cards must carry the whole table, never a single form, and
    // both languages must line up row for row.
    if (c.type === "conjugation") {
      const ok = a => Array.isArray(a) && a.length >= 2 &&
                      a.every(r => Array.isArray(r) && r.length === 2 && r[0] && r[1]);
      if (!ok(c.forms) || !ok(c.formsEn)) errors.push(`${at}: forms/formsEn must be arrays of [pronoun, form] pairs`);
      else if (c.forms.length !== c.formsEn.length) errors.push(`${at}: forms has ${c.forms.length}, formsEn has ${c.formsEn.length}`);
    }

    // A floral diagram has to be drawable, and its numbers have to be the same
    // numbers the printed formula claims.
    if (c.type === "floral") {
      const d = c.diagram;
      if (!d || !Array.isArray(d.whorls) || !d.gynoecium) {
        errors.push(`${at}: floral card needs a diagram with whorls and a gynoecium`);
      } else {
        for (const w of d.whorls) {
          if (!["calyx", "corolla", "androecium"].includes(w.part))
            errors.push(`${at}: unknown whorl "${w.part}"`);
          if (typeof w.n !== "number" || w.n < 0) errors.push(`${at}: whorl ${w.part} needs a count`);
        }
        if (typeof d.gynoecium.carpels !== "number" || d.gynoecium.carpels < 1)
          errors.push(`${at}: gynoecium needs a carpel count`);
        // A hand-written androecium token (the legumes' (9)+1) still has to add
        // up to the number of stamens actually drawn.
        if (d.andro) {
          const drawn = d.whorls.filter(w => w.part === "androecium")
                                .reduce((n, w) => n + (w.n || 0), 0);
          const claimed = (d.andro.match(/\d+/g) || []).reduce((n, s) => n + Number(s), 0);
          if (drawn !== claimed)
            errors.push(`${at}: formula says A${d.andro} (${claimed} stamens) but the diagram draws ${drawn}`);
        }
        const derived = formulaFor(d);
        if (derived !== c.formula)
          errors.push(`${at}: formula "${c.formula}" does not match the diagram, which reads "${derived}"`);
      }
    }

    // A named figure must exist in the shape library, or the card renders a hole.
    if (c.shape && !SHAPE_IDS.includes(c.shape))
      errors.push(`${at}: no figure named "${c.shape}" in src/decks/figures.js`);

    // Row tables must be pairs, like the conjugation tables.
    for (const f of ["rows", "clues"]) {
      if (c[f] != null) {
        const ok = Array.isArray(c[f]) && c[f].length >= 2 &&
                   c[f].every(r => Array.isArray(r) && r.length === 2 && r[0] && r[1]);
        if (!ok) errors.push(`${at}: ${f} must be an array of [label, text] pairs`);
      }
    }

    // Spoiler guard: a wine card's tasting notes must not name the grape.
    if ((c.type === "place2grape" || c.type === "decode") && c.notes && c.grape) {
      const g = c.grape.split(" ")[0].toLowerCase();
      if (g.length > 3 && c.notes.toLowerCase().includes(g)) errors.push(`${at}: notes leak grape "${g}"`);
    }

    // One determinate answer per prompt. A face that is never shown as a prompt
    // only warns; a face that is a prompt must be unique.
    const f = FACES[c.type];
    if (f) {
      const claim = (map, key, label, hard) => {
        if (map.has(key)) (hard ? errors : warnings).push(`duplicate ${label}: ${map.get(key)} and ${c.id}`);
        else map.set(key, c.id);
      };
      claim(fronts, f.front(c), "prompt", true);
      const back = f.back(c);
      if (back != null) claim(backs, back, "answer face", f.reversible);
    }
  }

  const by = k => cards.reduce((m, c) => (m[c[k]] = (m[c[k]] || 0) + 1, m), {});
  console.log(`\n=== ${deck.name} (${deck.id}) ===`);
  console.log("cards:", cards.length);
  console.log("group:", by("group"));
  console.log("type :", by("type"));
  if (deck.id === "wine") {
    const fr = cards.filter(c => c.group === "France").length;
    console.log("France %:", Math.round(fr / cards.length * 100));
  }
  if (warnings.length) console.warn("warnings:\n" + warnings.map(w => "  - " + w).join("\n"));
  if (errors.length) {
    failed = true;
    console.error("FAIL:\n" + errors.map(e => "  - " + e).join("\n"));
  } else {
    console.log("OK");
  }
}

if (failed) process.exit(1);
console.log("\nAll decks valid.");
