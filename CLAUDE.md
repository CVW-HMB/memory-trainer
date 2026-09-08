# CLAUDE.md

Guidance for working on this repo with Claude Code. Read this before changing anything.

## What this is

**La Cave**, a spaced-repetition flashcard trainer. One engine, any number of
decks: the scheduler and the mastery numbers mean the same thing whatever the
subject. The app keeps its name and its cellar vocabulary — flights, tasters,
the cellar book — while each deck names itself in the header, the tab title and
the footer. Keep app-level copy deck-neutral; wine belongs in the wine deck.

The first deck was wine, and it still sets the tone. The learning goal is real-world: walk into a restaurant, see a bottle, and know the grape and where it is from. The deck teaches that in the order a beginner actually needs it: first **what grape grows in what region**, then **how to decode a label**. Content is deliberately weighted: about 70% France, then Tuscany-led Italy, then the internationally popular wines you see on US lists. Obscure bottles are intentionally excluded.

The app is a single-page static web app (vanilla JS, no framework, no build step). It is intentionally small so it is easy to extend. Progress persists in IndexedDB — see **Storage** below.

**The MVP has shipped.** `PLAN.md` Part 1 (M1–M7) is complete: the app is live at
<https://cvw-hmb.github.io/memory-trainer/>, installs as a PWA, runs offline,
caps a flight at 35 cards, keeps progress in IndexedDB, and has a tested
scheduler (`npm test`).

**Five decks now.** `data/decks.json` is the index and the app opens on a
"choose a deck" screen:

- `wine` — "Wines, Grapes, Regions", 161 cards, `data/decks/wine.json`.
- `spanish` — "Mexican Spanish – English", 254 cards, `data/decks/spanish.json`.
- `french` — "French – English", 254 cards, `data/decks/french.json`.
- `payments` — "Payment Cards", 148 cards, `data/decks/payments.json`.
- `botany` — "California Plant Families", 149 cards, `data/decks/botany.json`.

The picker is a **dropdown**, not a list: it scales, and a phone gets its native
picker for free.

Progress is keyed `srs_v2:<profile>:<deck>`, so decks never collide. Each deck
declares its own `groups` (with labels), `groupsTitle` and footer `tagline`, so
the cellar book and chrome follow the deck rather than hardcoding wine. A deck
may also set `flightSize` to ask for a shorter flight than the default 35 — the
botany deck sets 20, because a card carrying a diagram takes longer to work
through than a vocabulary card. It caps how many due cards a flight serves and
nothing else; the boxes, the intervals and what mastery means are unchanged.

**Card types live in `src/decks/`** behind a registry (`registry.js`). A card
type is a small compiler: it turns a row of deck data into render specs and
declares whether the card may flip. `src/app.js` knows nothing deck-specific.
Adding a deck of an existing shape is an entry in `decks.json` plus a card
file; a genuinely new shape means a new card type in `src/decks/`.

**The app is called La Cave. Settled — do not rename it.** It is the app's name,
not the wine deck's; each deck names itself in the header subtitle, the tab
title and the footer. The cellar vocabulary that goes with it (flights, tasters,
the cellar book) is deliberate and stays. Keep app-level *descriptions*
deck-neutral, though — see "What this is".

**Anyone can add a deck without touching the repo.** The deck screen has a
"Build your own deck" panel: it copies out a **brief** (generated from the
schema), you hand that to Claude or any other AI, and you paste the JSON back.
See "Decks written outside the repo" below.

**Current state of Part 2:** D1 (card-type registry), D3 (deck picker), D5
(generic card types), D6 (per-deck validator) and D8/D9 (bring your own deck)
have landed. What remains is D2 (move the decks under `data/decks/`) and D7
(an offline spreadsheet converter, now optional).

**`PLAN.md` is the roadmap — read it before starting feature work and keep it
updated as work lands.**

**Note on the repo name:** the repo is `memory-trainer` (public, so GitHub Pages
serves it on the free plan). The app is La Cave.

The rules below (one determinate answer per prompt, declared reversibility,
stable ids) apply to every deck, not just wine.

## Run

Needs a static server because the app `fetch`es `data/decks.json` and the deck files:

- `npm run dev` (Node, serves on :8000) or `npm start` (Python).
- `npm test` runs the scheduler tests. `npm run validate` checks **every** deck in `data/decks.json`.
- `npm run cards` regenerates `data/decks/wine.json`; `npm run cards:es` regenerates `data/decks/spanish.json`.
- `npm run deck:import <sheet>` turns a `.csv`/`.tsv`/`.xlsx` into a deck;
  `npm run deck:check <file>` checks one. Both are for decks that live in a
  browser, not in this repo — see "Decks written outside the repo".

The Python side is managed by **uv** with a local `./.venv`: `npm run setup:py` (= `uv sync`) creates it from `pyproject.toml` + `.python-version` (3.14, the current stable line). The generator is stdlib-only, so the venv pins the interpreter rather than installing packages. Every Python entry point goes through `uv run`, so no manual activation is needed — do not add `python3 ...` calls back into `package.json`. `.venv/` is gitignored; commit `pyproject.toml`, `.python-version`, and `uv.lock`.

## Branching and PRs

- `main` is the only long-lived branch. There is no `develop`.
- **Large or multi-file feature work happens on a branch off `main`**, named for
  the work (`deck-adapter`, `per-deck-storage`, `pwa-offline`). Small doc or
  config edits may go straight to `main`.
- **Squash-merge to `main` when the work is code complete** — one commit per PR,
  so `main` reads as one commit per shipped unit. Delete the branch after.
- Code complete means: the app still runs, `npm run validate` passes, and the
  PR's "done when" in `PLAN.md` is actually true. Do not merge a branch that
  needs a later PR to be runnable.
- Keep PRs bite-size and shippable on their own. If a branch grows past roughly
  one `PLAN.md` PR, split it.
- Never rewrite the scheduler as a side effect of another change. If mastery or
  streak numbers move unexpectedly, treat it as a bug, not a new baseline.

## Local notes (`local-files/`)

`local-files/` is the owner's scratch space: project notes, card drafts, TODOs.
It is **git-ignored**, so nothing in it reaches GitHub and nothing in the app may
depend on it. Never move a file out of it into the repo without being asked, and
never put secrets in the tracked tree instead.

**Required at the end of every full iteration** (a prompt, or a group of prompts,
carried through to a working and verified state):

1. Append an entry to `local-files/worklog.md`, newest first, under a dated
   heading. Say what changed, what was verified and how, and — importantly — any
   open question, deferred decision, or thing deliberately not done. The log is
   for picking work back up cold, so record the *why*, not just the diff.
2. Update any other file in `local-files/` the work touched or made stale.
3. If the work changed how the repo is run, built, or structured, update this
   file and `README.md` too — those are the tracked, shareable source of truth.
   `local-files/` is history and context; it does not replace real docs.

Create the folder with `mkdir local-files` if a fresh clone lacks it.

## The card model (important)

The relationship between grape and region is many-to-many, which breaks card symmetry. That constraint drove the whole design, so preserve it.

- A **region grows many grapes** (Bordeaux: Cabernet, Merlot, Cab Franc, Sémillon, Sauvignon Blanc).
- A **grape grows in many regions** (Cabernet: Bordeaux, Napa, Tuscany, Chile).

So a card only works if the prompt side maps to exactly **one** correct answer. That is why the wine deck has the types it does, and why none of them may be flipped.

### Type 1 — `place2grape` (one direction only)
Prompt: country + region + tasting notes. Answer: the grape.
`{ type, group, grape, country, region, notes }`
Determinate (place + notes → one grape). Never reversed: a bare grape does not map to one region.

### Type 2 — `decode` (one direction only)
The bottle-reading skill.
`{ type, group, appellation, grape, country, region, notes, trap? }`
Show the appellation → recall grape + region + notes.
**Not reversed.** Showing grape + region + notes and asking you to name the wine
has no single answer: Pauillac, Margaux, Saint-Julien and Saint-Estephe are all
"Cabernet Sauvignon blend, Bordeaux, Left Bank", separable only by memorising
which tasting note went with which. The reverse rendering still exists in
`facesFor` but is unreachable while `reversible()` returns false.
`trap: true` marks look-alikes (the two Montepulcianos) and renders a warning-colored label.

### Type 3 — `grapehome` — **retired**
`{ type, group, grape, home, also }`. Its prompt was a grape ("where's it
grown?"), which breaks the rule that a prompt is always a place or a label —
and it was the ambiguous direction anyway, since the answers themselves listed
four or five regions. The 39 calls are commented out in
`scripts/generate_cards.py` and the rendering code still handles the type, so
restoring it is uncommenting those lines and running `npm run cards`.

**The wine card model, in one line:** the front is always a **place or a label**;
the back is always the **grape, its region and its notes**. Nothing flips in the
wine deck.

### Spanish deck types (`src/decks/vocab.js`)

Both **are** reversible — safe here in a way it is not for wine, because a
translation pair is one-to-one by construction and the validator enforces that
no two cards share either face.

Fields are language-neutral so the same types serve every language deck: the
foreign side is `term`, the English side is `gloss`, and `lang` picks the prompt
wording ("¿En inglés?" against "En anglais ?").

- `vocab` — `{ lang, term, gloss, kindTerm, kindGloss }`. One word per side.
- `conjugation` — `{ lang, verb, english, tense, tenseEn, forms[], formsEn[] }`.
  A whole table for one verb in one tense, rendered identically on both faces.

### Payments deck type (`src/decks/glossary.js`)

`glossary` — `{ term, short, context, definition, kind }`. Term on the front,
meaning on the back. **Not reversible**: unlike a translation pair, several
payments definitions are close enough that going definition → term would have
more than one defensible answer.

Content scope follows *The Anatomy of the Swipe* (four-party model,
authorization → clearing → settlement, interchange, EMV, risk, rails), but the
definitions are **written from general industry knowledge, not transcribed from
that book or any other**. Keep it that way. `short` is capped at 42 characters
by the generator so it fits the card's big line.

**Mexican Spanish has no `vosotros`** — five rows, not six; `ustedes` covers
every plural "you". Vocabulary is Mexican (carro, departamento, refrigerador,
camión, elevador, banqueta) and the English glosses are American. French keeps
`vous`, so its tables have six rows, and its past tense is the **passé composé**
— the one people actually speak.

Two rules that deck lives by:
- **Each face is entirely in one language** — the prompt line, the pronouns and
  the little category label included. A side never mixes the two.
- **A conjugation card always carries the whole table**, never a single form.
  The validator enforces that `es` and `en` are equal-length lists of
  `[pronoun, form]` pairs.

### Botany deck types (`src/decks/botany.js`)

The ten families that account for most of the California flora, with the
diagrams that go with them. Four types, **none of them reversible**:

- `floral` — `{ family, common, form, formula, diagram, note }`. Prompt is the
  named flower ("Asteraceae — disc floret"); answer is its **floral diagram**
  and formula. Not reversed: a bare radial 5-merous diagram fits Polemoniaceae,
  Boraginaceae and a dozen families outside the deck. The diagram summarises a
  family you have already named; it is not a key to one.
- `feature` — `{ term, kind, description, shape?, where, note? }`. The
  description (with a drawing, where there is one) is the prompt and the term is
  the answer, because naming what you are looking at is the direction that does
  the work outdoors. Not reversed: achene, cypsela and nutlet are close enough
  that term → description would have more than one defensible answer.
- `idclue` — `{ family, common, clues: [[aspect, observation]…], example }`.
  The deck's real skill, and the analogue of wine's `place2grape`: read the
  plant, land on the family. Not reversed — one family answers to many
  different clue sets.
- `checklist` — `{ family, common, place, rows, genera }`. A family, and the
  characters that give it away.

**Drawings, not images (`src/decks/figures.js`).** Every diagram is SVG
generated at render time from numbers in the card. Nothing is fetched, so the
deck works offline like everything else, weighs nothing, and stays sharp at any
size. Two kinds:

- `floralDiagram(spec)` — a real floral diagram: concentric whorls seen from
  above, axis at the top, subtending bract at the bottom, fused whorls joined by
  a connecting line, successive whorls alternating with the one outside them.
  Driven entirely by `{ symmetry, ovary, whorls: [{part, n, fused, as}], gynoecium }`.
- `shapeFigure(id)` — one of ~40 named schematics (a spikelet, a silique, a
  scorpioid cyme, a perigynium). The drawing lives in code; the deck only names
  it, and the validator rejects a name the library does not have.

Deck JSON therefore describes a plant and never carries markup. The renderer
gets a `draw` function on the spec and calls it, so `src/app.js` still knows
nothing deck-specific.

**How the diagrams are checked.** The floral formula printed on a card is
*derived from that card's diagram* by `scripts/generate_botany.py`, and
`scripts/validate-cards.mjs` derives it again independently in JavaScript and
fails if the two strings differ. A card cannot print `C(5)` over a drawing with
four petals. Where the conventional formula does not simply count whorls — the
legumes' `A(9)+1` over a drawn 5+5 — the diagram declares the token and the
validator checks its numbers still add up to the stamens actually drawn.

**Where the content comes from.** Family characters are written from standard
descriptive sources — Lena Struwe's *Field identification of the 50 most common
plant families in temperate regions*, Wikipedia's family treatments, and
teaching floral formulas — not transcribed from any one of them. The ranking is
by share of the California flora, with modern (APG) family limits, which is why
most of the old Scrophulariaceae appears here as Plantaginaceae and Phacelia
appears inside Boraginaceae. Ranks 8–10 shuffle between sources; the deck picks
an order and says so. An eleventh group, **Lookalikes**, holds the cards that
separate confusable families — Lamiaceae and Apiaceae appear there, as contrasts,
not as members of the top ten.

### Decks written outside the repo (`src/decks/authoring.js`)

The app cannot write deck content, but an AI can, so the deck screen is the two
halves of that round trip. `buildPrompt(topic)` writes the brief; `parseDeck(text)`
checks what comes back before it goes anywhere near the renderer.

Three rules hold this together:

- **`src/decks/schema.js` is the single source of truth.** The per-type field
  tables (`REQUIRED`, `FACES`) and the generic check (`checkCards`) live there,
  and three things read them: `scripts/validate-cards.mjs`, the in-app check,
  and the brief itself — which is *generated* from the schema, so it can never
  describe a deck the app would then reject. Add a field in one place.
- **A pasted deck may use only `glossary` and `vocab`.** Both already exist and
  neither needs deck-specific rendering. The wine types and the botany figures
  stay out of reach of JSON the app did not write.
- **A pasted card is rebuilt, not filtered.** `normalizeCard` constructs each
  card from `USER_FIELDS`, so a field the schema does not name — a `shape`, a
  `diagram`, a `draw` — cannot reach the renderer at all. That, plus the
  renderer only ever setting text or calling a `draw` function, is why untrusted
  deck JSON is safe. Do not "helpfully" pass unknown fields through.

Storage, all under the usual prefix:

- `srs_v2:customDecks` — manifest rows, the same shape as one row of `decks.json`.
- `srs_v2:customCards:<deckId>` — that deck's cards.

Deck ids are namespaced **`user:`**. That is what stops one colliding with a deck
that ships here, and since progress keys off the deck id, it protects progress
too. Nothing else in the app treats these decks specially.

Two behaviours that follow from "ids are stable":

- **Re-pasting a deck under the same name replaces it and keeps its id**, so a
  revision preserves progress on every card whose id survived. This is why the
  brief tells the model to keep ids across revisions.
- **A custom deck's backup carries its cards**, since a deck that exists only in
  one browser is otherwise unrestorable. Built-in decks back up progress alone.
  A backup is refused if its `deck` is not the deck being restored into — decks
  are independent, and one deck's progress would overwrite another's card for
  card.

`vocab` was written for the language decks, where `lang` picks the "now say it
in the other language" wording. A deck that is a pair but not a translation
declares its own wording once (`ask.onTerm` / `ask.onGloss`) and the importer
stamps it onto each card, since a card type only ever sees one card.

**Direction rule lives with the card type**, in `src/decks/`. Each type exports
`reversible`, `label`, `hint` and `faces`; `src/app.js` only delegates via
`typeFor()`. To add a type, write it and register it in `src/decks/registry.js`.
Reversibility is **declared, never assumed** — a card flips only when both
directions have exactly one right answer.

`group` values are declared per deck in `data/decks.json` (with labels) and
drive the cellar book's per-group stats. Wine uses `France` | `Italy` | `Rest`;
Spanish uses `Verbs` | `House` | `Town` | `Table` | `Everyday`.

## Scheduling

A 5-level Leitner system in **`src/engine/schedule.js`** — pure functions, no
DOM, no globals, no storage, and no knowledge of what a card holds beyond its
`id`. `src/app.js` imports it and keeps the rendering. It is covered by
`tests/schedule.test.js` (`npm test`, `node --test`, zero dependencies):
- Correct → box up (max 5), which pushes the next due date out (`INTERVAL` maps box → sessions until due).
- Miss → back to box 1 (due every session).
- Each run ("flight") pulls the due cards and orders them weak-first with jitter.
- **A missed card comes back within the same flight.** You do not finish a
  flight until every card in it has been answered correctly. A miss re-queues
  the card `REDRILL_GAP` (5) cards later, or at the end if fewer remain; once a
  card is correct it is done for that flight.
- **Only the first attempt at a card in a flight counts.** It is what moves the
  box and what lands in `correct`/`wrong`/`seen`. The repeats are drilling, not
  new evidence — otherwise missing a card and then getting it right would cost
  nothing, and one bad night would swamp the "hardest for you" list. So a card
  you missed stays in box 1 and is due again next session even though you
  cleared it before the flight ended.
- Progress and the summary are counted in **cards cleared**, not cards shown, so
  repeats never inflate them. The summary's accuracy is first-pass accuracy.
- `buildQueue` still never selects the same card twice; the repetition is purely
  the flight loop.
- Each flight is capped at `FLIGHT_SIZE` (35) cards, introducing at most
  `NEW_PER_FLIGHT` (5) never-seen cards in deck order. The cap decides how many
  due cards a flight *serves*; it does not touch the box arithmetic. A deck may
  pass a smaller size via `flightSize` in `data/decks.json` (`buildQueue`'s
  fifth argument); everything else about the flight is identical.
- Streaks and `bestStreak` update once per calendar day.

**The tests are the guardrail.** They cover box promotion and demotion, the
`INTERVAL` due arithmetic, streak behaviour across day, month, year, leap-day
and DST boundaries, no-repeats-within-a-flight, and the flight cap. If they
fail, behaviour moved — that is a bug, not a new baseline. Run `npm test`
before and after any change that touches scheduling.

## Storage

Shape (unchanged since v1):
`{ version, cards: { [id]: {box, correct, wrong, seen, lastSession} }, totalSessions, streak, bestStreak, lastPracticed }`.
Progress is keyed by card id, so **keep ids stable** and add cards additively. Renaming an id resets that one card only.

Where it lives, in order of precedence:

1. **In-memory**, written synchronously on every save. Read first, because the
   IndexedDB write queues behind the save chain and a flight leaves dozens of
   writes draining.
2. **IndexedDB** — database `lacave`, store `progress`. Primary durable store.
3. **`localStorage` under the same keys** — a mirror written on every save. It
   is the fallback where IndexedDB is blocked (Safari private browsing, some
   webviews), and the app runs entirely from it if so.

Keys, all under the `srs_v2:` prefix:

- `srs_v2:profiles` — `[{ id, name, created }]`, the tasters sharing this browser.
- `srs_v2:active` — id of the profile in use.
- `srs_v2:lastDeck` — the deck to highlight on the chooser.
- `srs_v2:<profileId>:<deckId>` — one person's progress in one deck.

Progress is namespaced by **profile and deck**, so neither collides.

`loadProfiles()` migrates on first boot: any pre-profile `srs_v2:wine`, or the
pre-M5 `wine_srs_v1`, is adopted by a first profile named "Me". An old key is
only deleted after the new one reads back, because losing progress there is
unrecoverable.
`navigator.storage.persist()` is requested at boot; browsers usually grant it
once the PWA is installed.

## Editing / adding cards

The deck JSON files are the source of truth, but prefer editing the generator
and regenerating:

- Wine: `scripts/generate_cards.py` → `npm run cards` → `data/decks/wine.json`.
- Spanish: `scripts/generate_spanish.py` → `npm run cards:es` → `data/decks/spanish.json`.
- French: `scripts/generate_french.py` → `npm run cards:fr` → `data/decks/french.json`.
- Payments: `scripts/generate_payments.py` → `npm run cards:pay` → `data/decks/payments.json`.
- Botany: `scripts/generate_botany.py` → `npm run cards:bot` → `data/decks/botany.json`.

A deck that is **not** going in the repo comes in through the app instead: paste
it into "Build your own deck", or convert a spreadsheet first —

```bash
npm run deck:import -- sheet.xlsx --name "Kings of France"   # -> kings-of-france.json
npm run deck:check kings-of-france.json                      # the app's own check
```

`scripts/import_deck.py` emits exactly the object the paste box accepts, so
there is one deck format and one check, not two. It is stdlib-only like the
other generators: `.xlsx` is a zip of XML, which `zipfile` and `ElementTree`
read without help. Ids are the accent-folded slug of the front, so re-importing
an edited sheet keeps progress on every row whose front did not change — which
is also why the importer reports two rows that derive the same id, by row
number, and exits nonzero.

Then `npm run validate`, which walks **every** deck in `data/decks.json` and
checks each card against its own type's schema, its deck's declared groups,
unique ids, that wine tasting notes do not leak the grape name, and that no two
cards share a prompt. A duplicate *answer* face is an error only for reversible
types; for wine it is a warning, because several `place2grape` cards
legitimately share a grape and that face is never a prompt.

When expanding wine, keep the France-first weighting and the "popular in a US
restaurant" bar. When expanding Spanish, keep each face monolingual and keep
conjugation tables whole. **One determinate answer per prompt is the hard rule
for every deck.**

## Roadmap

**`PLAN.md` is the roadmap.** Part 1 is the MVP — finishing the wine app (Pages
deploy, session-length cap, touch pass, PWA/offline, IndexedDB, scheduler tests,
edge cases). Part 2 is the multi-deck generalization, deferred until Part 1 ships.
Do not keep a competing list here — update `PLAN.md` as work lands.

The deck is at 161 cards (France 119 / Italy 25 / Rest 17 — 74% France, a
little above the 70% target since retiring `grapehome` removed proportionally
more Italy and Rest cards; rebalance on the next content pass).
A possible next content step is a "learn" pass that introduces a card as
`place2grape` before it can appear as a `decode` reverse.

### Guardrails
- Do not make `place2grape` or `grapehome` reversible. It produces ambiguous prompts.
  More generally: a card flips only if the deck declares that direction determinate.
- Do not embed the answer in a card's hint fields (for wine: the grape name in the
  tasting notes).
- Keep card ids stable across updates. Progress is keyed by id.
- Keep the dependency footprint light; this should stay easy to run and reason about.
- Do not put SVG or any other markup into deck JSON. A card describes a plant;
  the drawing code lives in `src/decks/figures.js` and the renderer only ever
  sets text or calls a `draw` function.
- Do not widen what a pasted deck may carry. The type whitelist and the
  rebuild-from-field-list in `src/decks/authoring.js` are the security boundary,
  not a convenience.
- Do not let the authoring brief drift from the schema. It is generated from
  `src/decks/schema.js`; keep it that way rather than hand-editing a copy.
- Do not hand-write a floral formula. Derive it from the diagram, or the two
  will drift and the validator will be right to stop you.
- Do not rewrite the scheduler while doing something else. It is already
  deck-agnostic and its numbers are the product.
