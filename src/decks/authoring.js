// Decks written outside the repo.
//
// The app cannot generate deck content, but an AI can, so this file is the two
// halves of that round trip: `buildPrompt` writes the brief you hand to Claude
// or another model, and `parseDeck` checks what comes back before it is allowed
// anywhere near the renderer.
//
// Both are generated from src/decks/schema.js, so the brief always describes
// exactly what the check accepts.
import {
  USER_FIELDS, USER_TYPES, USER_TYPE_DOC, LIMITS, fieldMax,
  FACES, checkCards,
} from "./schema.js";

const DEFAULT_FLIGHT = 35;          // mirrors FLIGHT_SIZE in src/engine/schedule.js

/* ---------------- the prompt ---------------- */

// The example is written out rather than generated: an AI follows a worked
// example far more reliably than a field list, and one concrete deck shows the
// group/id/kind conventions all at once.
const EXAMPLE = `{
  "app": "la-cave",
  "format": 1,
  "name": "Roman Emperors",
  "subtitle": "The principate, Augustus to Diocletian: who ruled, when, and what they are remembered for.",
  "tagline": "the principate, in order",
  "groupsTitle": "By dynasty",
  "groups": [
    { "id": "JulioClaudian", "label": "Julio-Claudian" },
    { "id": "Flavian", "label": "Flavian" },
    { "id": "Nerva", "label": "Nerva-Antonine" }
  ],
  "cards": [
    {
      "id": "augustus",
      "group": "JulioClaudian",
      "type": "glossary",
      "term": "Augustus",
      "kind": "Emperor",
      "short": "First emperor, r. 27 BC - AD 14",
      "context": "Born Gaius Octavius",
      "definition": "Great-nephew and heir of Julius Caesar. Won the civil war at Actium, then kept republican forms while holding real power, founding the principate and a peace that lasted two centuries."
    },
    {
      "id": "vespasian",
      "group": "Flavian",
      "type": "glossary",
      "term": "Vespasian",
      "kind": "Emperor",
      "short": "Restored order after the Year of Four Emperors",
      "context": "r. AD 69 - 79",
      "definition": "A general from outside the old aristocracy who ended the civil war of AD 69, repaired the treasury, and began the Colosseum."
    }
  ]
}`;

const EXAMPLE_VOCAB = `{
  "id": "fe",
  "group": "Metals",
  "type": "vocab",
  "term": "Fe",
  "kindTerm": "Symbol",
  "gloss": "Iron",
  "kindGloss": "Element"
}`;

function typeDoc(type) {
  const doc = USER_TYPE_DOC[type], spec = USER_FIELDS[type];
  const line = f => `  - ${f}${spec.required.includes(f) ? "" : " (optional)"} — ` +
                    `${doc.fields[f]}. Max ${fieldMax(f)} characters.`;
  return `### "${type}" — ${doc.summary}\n\n${doc.why}\n\nFields:\n` +
         [...spec.required, ...spec.optional].map(line).join("\n");
}

export function buildPrompt(topic) {
  const subject = (topic || "").trim() || "<PUT YOUR SUBJECT HERE>";
  return `I want a flashcard deck for La Cave, a spaced-repetition trainer, about:

${subject}

Reply with ONE JSON object and nothing else — no explanation before or after,
no markdown code fence. It gets pasted straight into the app.

## The four rules a deck lives by

1. **One determinate answer per prompt.** The front of a card must map to
   exactly ONE correct back. If two cards could reasonably share an answer, or
   one front has several defensible answers, the card is broken — rewrite it
   until the prompt pins the answer down.
2. **Never leak the answer into the prompt side.** The category label, the
   context line and the term itself must not contain the answer.
3. **Ids are permanent.** Progress is stored per card id. Give every card a
   short, stable, lowercase id (letters, digits, hyphens). If you later revise
   this deck, keep the ids of cards that still mean the same thing — that is
   what preserves the learner's progress.
4. **Text only.** No HTML, no markdown, no images, no URLs. Plain sentences.

## Shape

${EXAMPLE}

Rules for the wrapper:
- "app" and "format" are exactly as shown.
- "name" is short (max ${LIMITS.name} chars) — it names the deck in a dropdown.
- "subtitle" is one or two sentences saying what the deck covers and how it is
  weighted (max ${LIMITS.subtitle} chars).
- "tagline" is a lowercase fragment for the footer (max ${LIMITS.tagline} chars).
- "groupsTitle" labels the grouping in the progress screen ("By dynasty",
  "By theme", "By era").
- "groups" is 1 to ${LIMITS.groups} groups. Every card's "group" must be one of
  their ids. Aim for at least 3 cards in each; a group holding most of the deck
  is not a grouping.

## Card types — use "glossary" unless the deck is genuinely a set of pairs

${USER_TYPES.map(typeDoc).join("\n\n")}

A "vocab" card looks like this:

${EXAMPLE_VOCAB}

If you use "vocab" cards, add this next to "groups" so each side asks for the
other in words that fit the subject:

  "ask": { "onTerm": "Which element?", "onGloss": "Which symbol?" }

"onTerm" is shown under the "term" side and asks for the gloss; "onGloss" is
shown under the "gloss" side and asks for the term.

## How much

Aim for 40 to 120 cards — enough that a session is not the same cards every
time (a session serves up to ${DEFAULT_FLIGHT}), few enough to be learnable.
The hard cap is ${LIMITS.cards}. Weight the deck toward what a beginner
actually needs first, and leave out the obscure entries; a deck that covers
everything teaches nothing.

## Check before you answer

- Every card has a unique id and a group that exists in "groups".
- No two cards share a front. For "vocab", no two share a back either.
- No answer appears on its own prompt side.
- Every field is inside its character limit.
- The whole reply parses as JSON.`;
}

/* ---------------- reading one back ---------------- */

const str = v => (typeof v === "string" ? v.trim() : "");
const clip = (v, n) => str(v).slice(0, n);
const slug = v => str(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// AIs wrap JSON in a fence about a third of the time however firmly you ask.
// Stripping it is friendlier than telling the user their model disobeyed.
function unfence(text) {
  const t = str(text);
  const fenced = t.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/);
  return fenced ? fenced[1] : t;
}

// A card is REBUILT from the schema's field list rather than filtered, so a
// field the schema does not name cannot reach the renderer. See USER_FIELDS.
function normalizeCard(raw, i) {
  const type = USER_TYPES.includes(raw && raw.type) ? raw.type : null;
  // An unrecognised type is reported by checkCards; keep the id and group so
  // the message names the card rather than compounding into three errors.
  if (!type) {
    return { type: str(raw && raw.type) || "(none)",
             id: slug(raw && raw.id).slice(0, LIMITS.id) || `card-${i + 1}`,
             group: clip(raw && raw.group, LIMITS.id) };
  }
  const spec = USER_FIELDS[type];
  const out = { type, group: clip(raw.group, LIMITS.id) };
  for (const f of [...spec.required, ...spec.optional]) {
    const v = clip(raw[f], fieldMax(f));
    if (v) out[f] = v;
  }
  // A supplied id is preferred: it is what carries progress across a revision
  // of the deck. Falling back to the prompt field keeps ids content-derived, so
  // re-importing an unchanged card lands on the same id either way.
  out.id = slug(raw.id).slice(0, LIMITS.id) || slug(out.term).slice(0, LIMITS.id) || `card-${i + 1}`;
  return out;
}

// Warnings that will not stop a deck working but will make it worse to learn
// from. This is the deck health check: it runs on paste, before saving.
function health(cards, groups) {
  const out = [];
  if (cards.length && cards.length < DEFAULT_FLIGHT) {
    out.push(`only ${cards.length} card${cards.length === 1 ? "" : "s"} — ` +
             `smaller than one flight (${DEFAULT_FLIGHT}), ` +
             `so every card comes up every session until the deck grows`);
  }
  const counts = {};
  for (const c of cards) counts[c.group] = (counts[c.group] || 0) + 1;
  for (const g of groups) {
    const n = counts[g.id] || 0;
    if (n === 0) out.push(`group "${g.label}" has no cards`);
    else if (n < 3) out.push(`group "${g.label}" has only ${n} card${n === 1 ? "" : "s"}`);
    else if (groups.length > 1 && n / cards.length > 0.7) {
      out.push(`group "${g.label}" holds ${Math.round(n / cards.length * 100)}% of the deck — ` +
               `that is not really a grouping`);
    }
  }
  const has = (hay, needle) =>
    needle.length > 3 && str(hay).toLowerCase().includes(needle.toLowerCase());
  for (const c of cards) {
    if (c.type === "glossary" && c.short && c.term &&
        c.short.toLowerCase() === c.term.toLowerCase()) {
      out.push(`${c.id}: the answer just repeats the term`);
    }
    if (c.type === "vocab") {
      if (has(c.kindTerm, c.gloss)) out.push(`${c.id}: the label on the front leaks "${c.gloss}"`);
      if (has(c.kindGloss, c.term)) out.push(`${c.id}: the label on the back leaks "${c.term}"`);
    }
    if (c.type === "glossary" && has(c.kind, c.short)) {
      out.push(`${c.id}: the category label on the front leaks the answer`);
    }
  }
  return out;
}

// Parses and checks a pasted deck. Never throws: everything wrong with the
// paste comes back in `errors`, because this text came from outside the app.
//
// Returns { ok, errors, warnings, deck, cards, stats }. `deck` is a manifest
// entry in the same shape as one row of data/decks.json, minus the id, which
// the app assigns so a pasted deck can never collide with a built-in one.
export function parseDeck(text) {
  const fail = (...errors) => ({ ok: false, errors, warnings: [], deck: null, cards: [], stats: null });
  const src = unfence(text);
  if (!src) return fail("Nothing pasted.");
  if (src.length > LIMITS.json) {
    return fail(`That is ${Math.round(src.length / 1000)}k characters; the limit is ` +
                `${LIMITS.json / 1000}k. Ask for a smaller deck.`);
  }

  let raw;
  try { raw = JSON.parse(src); }
  catch (e) {
    return fail("That did not parse as JSON (" + e.message + ").",
                "If the model wrote anything before or after the JSON, delete it and paste again.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("A deck must be a single JSON object.");
  if (raw.app !== "la-cave") return fail('The JSON is missing "app": "la-cave". This does not look like a La Cave deck.');
  if (!Array.isArray(raw.cards) || raw.cards.length === 0) return fail("The deck has no cards.");
  if (raw.cards.length > LIMITS.cards) {
    return fail(`${raw.cards.length} cards; the limit is ${LIMITS.cards}.`);
  }
  const name = clip(raw.name, LIMITS.name);
  if (!name) return fail("The deck needs a name.");

  const cards = raw.cards.map(normalizeCard);

  // Groups: take what the deck declares, else derive them from the cards, so a
  // model that forgot the wrapper field still produces a usable deck.
  let groups = Array.isArray(raw.groups)
    ? raw.groups.map(g => ({ id: clip(g && g.id, LIMITS.id), label: clip(g && g.label, LIMITS.groupLabel) }))
                .filter(g => g.id)
    : [];
  if (!groups.length) {
    const seen = [...new Set(cards.map(c => c.group).filter(Boolean))];
    groups = (seen.length ? seen : ["All"]).map(id => ({ id, label: id }));
  }
  groups = groups.slice(0, LIMITS.groups);
  for (const g of groups) g.label = g.label || g.id;
  // With one group, a card that names nothing still belongs to it. A card that
  // names something else is a mistake, and checkCards must still say so.
  if (groups.length === 1) for (const c of cards) c.group = c.group || groups[0].id;

  const { errors, warnings } = checkCards(cards, {
    groups: new Set(groups.map(g => g.id)),
    required: Object.fromEntries(USER_TYPES.map(t => [t, USER_FIELDS[t].required])),
    faces: Object.fromEntries(USER_TYPES.map(t => [t, FACES[t]])),
  });

  // Wording for the two faces of a vocab card, declared once by the deck and
  // stamped onto each card -- the card types only ever see one card. Stamped
  // after normalizing, so a card cannot override the deck.
  const ask = raw.ask && typeof raw.ask === "object" ? raw.ask : {};
  const onTerm = clip(ask.onTerm, LIMITS.groupLabel), onGloss = clip(ask.onGloss, LIMITS.groupLabel);
  for (const c of cards) {
    if (c.type !== "vocab") continue;
    c.askTerm = onTerm || "And the other side?";
    c.askGloss = onGloss || "And the other side?";
  }

  const flightSize = Number.isFinite(raw.flightSize)
    ? Math.max(5, Math.min(60, Math.round(raw.flightSize))) : null;

  const deck = {
    name,
    subtitle: clip(raw.subtitle, LIMITS.subtitle),
    tagline: clip(raw.tagline, LIMITS.tagline),
    groupsTitle: clip(raw.groupsTitle, LIMITS.groupsTitle) || "By group",
    groups,
    ...(flightSize ? { flightSize } : {}),
  };

  const tally = k => cards.reduce((m, c) => (m[c[k]] = (m[c[k]] || 0) + 1, m), {});
  return {
    ok: errors.length === 0,
    errors,
    warnings: [...warnings, ...(errors.length ? [] : health(cards, groups))],
    deck, cards,
    stats: { count: cards.length, byGroup: tally("group"), byType: tally("type") },
  };
}
