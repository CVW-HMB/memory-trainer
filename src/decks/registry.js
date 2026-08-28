// Card-type registry. A card type is a small compiler: it turns a row of deck
// data into render specs and declares whether that card may be shown in both
// directions. The renderer and the scheduler know nothing else about a deck.
//
// To support a new kind of card, write the type and register it here. To
// support a whole new deck, add an entry to data/decks.json and use types that
// already exist, or add new ones first.
//
// Reversibility is DECLARED, never assumed: a card flips only when both
// directions have exactly one right answer.
import * as wine from "./wine.js";
import * as vocab from "./vocab.js";

export const CARD_TYPES = {
  place2grape: wine.place2grape,
  decode: wine.decode,
  grapehome: wine.grapehome,
  vocab: vocab.vocab,
  conjugation: vocab.conjugation,
};

// A card of an unregistered type would otherwise crash the renderer mid-flight.
// Fall back to something that displays rather than throwing.
const FALLBACK = {
  reversible: () => false,
  label: c => c.id,
  hint: () => "",
  faces: c => ({
    prompt: { mode: "headline", big: c.id, kind: "Unknown card type", ask: "", warn: true },
    answer: { mode: "headline", big: "No renderer for type “" + c.type + "”", kind: "", ask: "", warn: true },
  }),
};

export function typeFor(card) {
  const t = CARD_TYPES[card && card.type];
  if (!t) console.warn("[decks] no card type registered for", card && card.type);
  return t || FALLBACK;
}
