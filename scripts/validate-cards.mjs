// Validates data/cards.json: schema per type, unique ids, and basic spoiler checks.
// Run: node scripts/validate-cards.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cards = JSON.parse(readFileSync(join(root, "data", "cards.json"), "utf8"));

const GROUPS = new Set(["France", "Italy", "Rest"]);
const TYPES = new Set(["place2grape", "decode", "grapehome"]);
const required = {
  place2grape: ["grape", "country", "region", "notes"],
  decode: ["appellation", "grape", "country", "region", "notes"],
  grapehome: ["grape", "home", "also"],
};

let errors = [];
const ids = new Set();
for (const c of cards) {
  const at = c.id || JSON.stringify(c).slice(0, 40);
  if (!c.id) errors.push(`missing id: ${at}`);
  if (ids.has(c.id)) errors.push(`duplicate id: ${c.id}`);
  ids.add(c.id);
  if (!GROUPS.has(c.group)) errors.push(`${at}: bad group ${c.group}`);
  if (!TYPES.has(c.type)) errors.push(`${at}: bad type ${c.type}`);
  for (const f of (required[c.type] || [])) {
    if (!c[f] || typeof c[f] !== "string") errors.push(`${at}: missing field ${f}`);
  }
  // spoiler guard: tasting notes should not literally contain the grape name
  if ((c.type === "place2grape" || c.type === "decode") && c.notes && c.grape) {
    const g = c.grape.split(" ")[0].toLowerCase();
    if (g.length > 3 && c.notes.toLowerCase().includes(g)) errors.push(`${at}: notes leak grape "${g}"`);
  }
}

// One determinate answer per prompt is the hard content rule, so no two cards
// may present the same prompt. Checked per direction, since only `decode`
// flips. See CLAUDE.md.
const prompts = new Map();
const claim = (key, card, dir) => {
  const prev = prompts.get(key);
  if (prev) errors.push(`duplicate ${dir} prompt: ${prev} and ${card.id}`);
  else prompts.set(key, card.id);
};
for (const c of cards) {
  if (c.type === "grapehome") claim(`t3|${c.grape}`, c, "grape");
  if (c.type === "place2grape") claim(`t1|${c.country}|${c.region}|${c.notes}`, c, "place+notes");
  if (c.type === "decode") {
    claim(`t2f|${c.appellation}`, c, "appellation");
    claim(`t2r|${c.grape}|${c.country}|${c.region}|${c.notes}`, c, "reverse decode");
  }
}

const by = k => cards.reduce((m, c) => (m[c[k]] = (m[c[k]] || 0) + 1, m), {});
console.log("cards:", cards.length);
console.log("group:", by("group"));
console.log("type :", by("type"));
const fr = cards.filter(c => c.group === "France").length;
console.log("France %:", Math.round(fr / cards.length * 100));

if (errors.length) {
  console.error("\nFAIL:\n" + errors.map(e => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("\nOK: all cards valid.");
