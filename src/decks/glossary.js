// Glossary card type: a term on the front, what it means on the back.
//
// Deliberately NOT reversible. A translation pair is one-to-one by
// construction, but a definition is not: several payments terms are close
// enough in meaning that going definition -> term would have more than one
// defensible answer. Reversibility is declared, never assumed.
import { specHeadline, specDetail } from "./specs.js";

// { term, short, context, definition, kind }
//   short      the answer in a few words, set as the big line
//   context    optional orienting note, e.g. "Acquirer pays issuer"
//   definition the full sentence
export const glossary = {
  reversible: () => false,
  label: c => c.term,
  hint: c => c.short,
  faces: c => ({
    prompt: specHeadline(c.term, c.kind, "What is it?"),
    answer: specDetail(c.short, c.context || "", c.definition, c.kind),
  }),
};
