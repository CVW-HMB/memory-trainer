// The deck schema, in one place.
//
// Three things read this file and they must never drift apart:
//   - scripts/validate-cards.mjs, checking the decks that ship in the repo
//   - src/decks/authoring.js, checking a deck someone pasted into the app
//   - the authoring prompt, which is generated from these same tables
//
// If a card type gains a field, it gains it here and all three follow.

// Required string fields per card type.
export const REQUIRED = {
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
//
// A `back` returning null means "this face is never a prompt, do not check it" --
// for idclue the answer face is *expected* to repeat, since one family answers
// to many different clue sets.
export const FACES = {
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
  floral:      { reversible: false, front: c => `flower|${c.family}|${c.form}`,
                                    back: c => `diagram|${c.family}|${c.form}|${c.formula}` },
  feature:     { reversible: false, front: c => `desc|${c.description}`,
                                    back: c => `term|${c.term}` },
  idclue:      { reversible: false, front: c => `clues|${JSON.stringify(c.clues)}`,
                                    back: () => null },
  checklist:   { reversible: false, front: c => `family|${c.family}`,
                                    back: () => null },
};

/* ---------------- decks written outside the repo ----------------
   A deck pasted into the app may use only these two types. Both already exist
   and neither needs deck-specific rendering: `glossary` is a term and what it
   means, `vocab` is a one-to-one pair that reads correctly in both directions.
   Everything else -- the wine types, the botany figures -- stays out of reach
   of JSON the app did not write.

   A pasted card is REBUILT from the field lists below rather than filtered, so
   a field that is not named here cannot reach the renderer at all. That is what
   stops a pasted deck naming a figure, carrying a `draw`, or smuggling markup
   into a field some future card type might trust.                          */
export const USER_FIELDS = {
  glossary: { required: ["term", "short", "definition", "kind"], optional: ["context"] },
  vocab:    { required: ["term", "gloss", "kindTerm", "kindGloss"], optional: [] },
};

export const USER_TYPES = Object.keys(USER_FIELDS);

// What each type is for, in the words the authoring prompt uses.
export const USER_TYPE_DOC = {
  glossary: {
    summary: "A term on the front, what it means on the back. Never reversed.",
    why: "Going definition -> term rarely has one right answer: two close definitions would both be defensible. Use this for concepts, people, events, parts, processes -- anything explained rather than translated.",
    fields: {
      term: "the thing being asked about, as it appears on the front",
      short: "the answer in a few words; this is the big line on the back",
      context: "OPTIONAL one orienting phrase, e.g. a date range or a category",
      definition: "the full sentence that actually teaches it",
      kind: "a short category label, e.g. \"Emperor\" or \"Protocol\"",
    },
  },
  vocab: {
    summary: "A one-to-one pair, shown in BOTH directions.",
    why: "Only use this when each side maps to exactly one other side, both ways -- a translation, a symbol and its element, a country and its capital. If two different fronts could share a back, use glossary instead.",
    fields: {
      term: "one side of the pair",
      gloss: "the other side",
      kindTerm: "short category label shown with `term`",
      kindGloss: "short category label shown with `gloss`",
    },
  },
};

// Caps on a pasted deck. Generous enough for a real deck, small enough that a
// paste cannot fill the browser's storage or produce a card that will not fit
// on screen. `short` matches the 42 characters the payments generator allows
// itself for the same reason -- it is set as the card's big line.
export const LIMITS = {
  json: 1_000_000,        // characters of pasted text
  cards: 1000,
  groups: 12,
  name: 60, subtitle: 240, tagline: 80, groupsTitle: 40, groupLabel: 40, id: 64,
  field: 120,             // default cap for a card's string field
};

export const FIELD_MAX = { short: 60, definition: 600, context: 60 };
export const fieldMax = f => FIELD_MAX[f] || LIMITS.field;

/* ---------------- the shared check ----------------
   The rules that apply to every deck, whoever wrote it: stable unique ids,
   declared groups, a known type with its fields present, and the one that makes
   a deck work at all -- one determinate answer per prompt.

   `required` and `faces` are passed in so the repo's decks are checked against
   the full tables while a pasted deck is checked against the user-facing subset.
   Returns { errors, warnings }; deck-specific checks are the caller's job.   */
export function checkCards(cards, { groups, required = REQUIRED, faces = FACES } = {}) {
  const errors = [], warnings = [];
  const declared = groups instanceof Set ? groups : new Set(groups || []);
  const ids = new Set();
  const fronts = new Map(), backs = new Map();

  for (const c of cards) {
    const at = (c && c.id) || JSON.stringify(c).slice(0, 40);
    if (!c || !c.id) errors.push(`missing id: ${at}`);
    if (ids.has(c.id)) errors.push(`duplicate id: ${c.id}`);
    ids.add(c && c.id);
    if (!declared.has(c && c.group)) errors.push(`${at}: group ${c && c.group} is not declared`);
    if (!required[c && c.type]) { errors.push(`${at}: unknown type ${c && c.type}`); continue; }
    for (const f of required[c.type]) {
      if (!c[f] || typeof c[f] !== "string") errors.push(`${at}: missing field ${f}`);
    }

    // One determinate answer per prompt. A face that is never shown as a prompt
    // only warns; a face that is a prompt must be unique.
    const f = faces[c.type];
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
  return { errors, warnings };
}
