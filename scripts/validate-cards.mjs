// Validates every deck listed in data/decks.json: per-type schema, unique ids,
// declared groups, and the rule that makes a deck work at all -- one
// determinate answer per prompt.
//
// Run: npm run validate
import { readFileSync } from "node:fs";
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
};

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
      claim(backs, f.back(c), "answer face", f.reversible);
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
