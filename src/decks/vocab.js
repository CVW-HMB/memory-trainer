// Language card types, written for the Spanish deck but not specific to it.
//
// Both types are REVERSIBLE, which is safe here in a way it was not for wine:
// a translation pair is one-to-one by construction, and the validator enforces
// that no two cards share either side. Each face is written entirely in one
// language -- prompts, pronouns and the little kind label included -- so a side
// never mixes the two.
import { specHeadline, specList } from "./specs.js";

const ASK_EN = "In Spanish?";     // shown on an English face
const ASK_ES = "¿En inglés?";     // shown on a Spanish face

// A single word or phrase, one language per side.
//   { es, en, kindEs, kindEn }
export const vocab = {
  reversible: () => true,
  label: c => c.es,
  hint: c => c.en,
  faces: (c, dir) => (dir === "rev"
    ? { prompt: specHeadline(c.en, c.kindEn, ASK_EN),
        answer: specHeadline(c.es, c.kindEs) }
    : { prompt: specHeadline(c.es, c.kindEs, ASK_ES),
        answer: specHeadline(c.en, c.kindEn) }),
};

// A whole conjugation table for one verb in one tense. Never a single form:
// the point is to see the full set, and both faces lay out identically so they
// read the same way.
//   { verb, english, tenseEs, tenseEn, es: [[pronoun, form], ...], en: [...] }
export const conjugation = {
  reversible: () => true,
  label: c => c.verb + " · " + c.tenseEs,
  hint: c => c.english,
  faces: (c, dir) => (dir === "rev"
    ? { prompt: specList(c.english, c.tenseEn, c.en, "Verb", ASK_EN),
        answer: specList(c.verb, c.tenseEs, c.es, "Verbo") }
    : { prompt: specList(c.verb, c.tenseEs, c.es, "Verbo", ASK_ES),
        answer: specList(c.english, c.tenseEn, c.en, "Verb") }),
};
