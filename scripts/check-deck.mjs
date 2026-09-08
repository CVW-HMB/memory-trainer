// Checks a deck file the app would accept -- one written by an AI from the
// brief, or produced by scripts/import_deck.py.
//
// Run: npm run deck:check <file.json>
//
// This deliberately runs the SAME parseDeck the app runs on paste, rather than
// a second implementation that would drift from it. If this passes, the paste
// box will accept the file; if it fails, it fails there too, with these words.
import { readFileSync } from "node:fs";
import { parseDeck } from "../src/decks/authoring.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run deck:check <file.json>");
  process.exit(2);
}

let text;
try { text = readFileSync(file, "utf8"); }
catch (e) { console.error(`${file}: ${e.message}`); process.exit(2); }

const r = parseDeck(text);

if (r.deck) {
  console.log(`\n=== ${r.deck.name} ===`);
  console.log("cards:", r.stats.count);
  console.log("group:", r.stats.byGroup);
  console.log("type :", r.stats.byType);
}
if (r.warnings.length) {
  console.warn("\nwarnings:\n" + r.warnings.map(w => "  - " + w).join("\n"));
}
if (!r.ok) {
  console.error("\nFAIL:\n" + r.errors.map(e => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("\nOK — paste this into the app's \"Build your own deck\" box.");
