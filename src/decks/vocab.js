// Language card types. Written for the Spanish deck, now shared by French, and
// deliberately not tied to either: the foreign side is `term`, the English side
// is `gloss`, and the card's `lang` picks the prompt wording.
//
// Both types are REVERSIBLE, which is safe here in a way it was not for wine:
// a translation pair is one-to-one by construction, and the validator enforces
// that no two cards in a deck share either face.
//
// Each face is written entirely in one language -- prompt, pronouns and the
// little category label included. A side never mixes the two.
import { specHeadline, specList } from "./specs.js";

// The "now tell me the other side" line, in the language of the face it sits on.
const ASKS = {
  es: { term: "¿En inglés?", gloss: "In Spanish?" },
  fr: { term: "En anglais ?", gloss: "In French?" },
};
const asksFor = c => ASKS[c && c.lang] || { term: "In English?", gloss: "In the other language?" };

// One word or phrase per side.
//   { lang, term, gloss, kindTerm, kindGloss }
export const vocab = {
  reversible: () => true,
  label: c => c.term,
  hint: c => c.gloss,
  faces: (c, dir) => {
    const ask = asksFor(c);
    return dir === "rev"
      ? { prompt: specHeadline(c.gloss, c.kindGloss, ask.gloss),
          answer: specHeadline(c.term, c.kindTerm) }
      : { prompt: specHeadline(c.term, c.kindTerm, ask.term),
          answer: specHeadline(c.gloss, c.kindGloss) };
  },
};

// A whole conjugation table for one verb in one tense. Never a single form:
// the point is to see the full set, and both faces lay out identically so they
// read the same way.
//   { lang, verb, english, tense, tenseEn, forms, formsEn, kindTerm, kindGloss }
// `forms`/`formsEn` are [pronoun, form] pairs and must be the same length.
export const conjugation = {
  reversible: () => true,
  label: c => c.verb + " · " + c.tense,
  hint: c => c.english,
  faces: (c, dir) => {
    const ask = asksFor(c);
    return dir === "rev"
      ? { prompt: specList(c.english, c.tenseEn, c.formsEn, c.kindGloss, ask.gloss),
          answer: specList(c.verb, c.tense, c.forms, c.kindTerm) }
      : { prompt: specList(c.verb, c.tense, c.forms, c.kindTerm, ask.term),
          answer: specList(c.english, c.tenseEn, c.formsEn, c.kindGloss) };
  },
};
