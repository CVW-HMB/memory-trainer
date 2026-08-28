# Plan: from wine trainer to a multi-deck trainer

## The goal

One small web app, runnable from a laptop or a phone browser, that trains you on
**any** deck of flashcards using the same scheduling and mastery measurement.

- Decks live in a folder in this repo. Launch the app, pick a deck, and that deck
  is set for the session.
- The app presents itself as the deck: pick the Spanish deck and it is a
  vocabulary trainer; pick wine and it is the wine trainer. Same engine
  underneath — name, subtitle, and vocabulary come from the deck.
- Creating a deck means writing a spreadsheet and dropping it in.
- The yes/no self-rating, the Leitner boxes, the mastery and streak measurement
  are the point. They stay identical across every deck, so progress means the
  same thing whatever you are learning.
- It must work well on a phone: daily training, offline, installed to the home
  screen.

## How hard is this, honestly

**Moderate, and front-loaded with easy wins.** The engine is already generic; the
wine coupling is thinner than it looks.

Already deck-agnostic (`src/app.js`): the Leitner scheduler (`buildQueue`,
`answer`), streaks, per-`group` stats, the flight builder. They key off card `id`
and `group` and never inspect a wine field.

Already a generic contract: `specHeadline` / `specDetail` (app.js:124-125) describe
a card face as "one big line" or "lead + context + notes" — no wine in them. The
renderer (`fillFace`) consumes only those.

Genuinely wine-specific, and it is a short list: `reversible`, `cardLabel`,
`cardHint`, and `facesFor` — about 30 lines that translate wine fields into those
generic specs. That is the seam. Everything else is additive.

So the honest sizing:
- Deck-picking and multi-deck storage: **easy**, mostly plumbing.
- Generic card types and a spreadsheet importer: **moderate**, well-understood.
- Phone/PWA/offline: **moderate**, fiddly rather than hard.
- The scheduler: **already done**. Do not rewrite it.

The main risk is not difficulty, it is doing things in the wrong order — see the
sequencing warnings below.

## Target architecture

```
data/
  decks.json              index: id, name, subtitle, theme, file, cardCount
  decks/
    wine.json             cards + deck metadata
    spanish.json
    physics.json
src/
  app.js                  shell: routing, session loop, stats
  engine/
    schedule.js           Leitner, unchanged behavior
    store.js              per-deck progress
  decks/
    registry.js           type -> compiler lookup
    basic.js              generic front/back compiler
    wine.js               the three wine types
```

A **deck** is metadata plus cards. A **card type** is a compiler: it turns a card
row into `{prompt, answer}` render specs and declares whether it is reversible.
The wine types become the first compilers rather than special cases in the
renderer.

Generic core card, what the engine speaks:

```
{ id, deck, group, type, front, back, extra, reversible }
```

The minimum spreadsheet for a new deck:

| type  | group | front | back | notes | reversible |
|-------|-------|-------|------|-------|------------|

## Rules that carry over

These came out of the wine deck and are not wine-specific. They apply to every
deck:

- **One determinate answer per prompt.** A prompt that maps to several correct
  answers cannot be graded yes/no. This cannot be auto-enforced for arbitrary
  decks, so the importer must *warn* on duplicate prompts.
- **Reversibility is declared, never assumed.** A card flips only if the deck
  says that direction is also determinate.
- **Card ids are stable.** Progress is keyed by id. Renaming an id resets that
  card.
- **Do not leak the answer into the hint fields.**

## Sequencing warnings

1. **Do per-deck storage (PR 5) before any second deck ships.** Progress lives
   under one `wine_srs_v1` key today. Add decks first and they collide, and you
   pay for a second migration later.
2. **Do IndexedDB (PR 11) before in-browser import (PR 12).** Imported decks need
   somewhere to live that is not `localStorage`.
3. **Do not rewrite the scheduler.** Every PR below leaves `buildQueue` and the
   box arithmetic alone. If mastery numbers move, something broke.

---

# The PRs

Each is a branch off `main`, squash-merged when code complete. Each leaves the
app working — no PR depends on a later one to be runnable.

## Phase 0 — ship what exists

### PR 1 — Publish to GitHub Pages
Serve the current app at `cvw-hmb.github.io/wine-trainer`. No code changes needed:
every path is already relative (`./data/cards.json`, `./src/app.js`).
- Enable Pages on `main` / root, or add a deploy workflow.
- **Decision required:** Pages from a private repo needs a paid plan. On Free,
  the repo must go public.
- Done when: the live URL loads and a session can be completed on a phone.

## Phase 1 — decouple the engine from wine

### PR 2 — Extract the deck adapter (no behavior change)
Move `reversible`, `cardLabel`, `cardHint`, `facesFor` out of `app.js` into
`src/decks/wine.js`, reached through a `type -> compiler` registry.
- `app.js` stops naming any wine field.
- Done when: the app behaves identically and `grep -i grape src/app.js` is empty.

### PR 3 — Deck manifest and `data/decks/`
Introduce `data/decks.json` (the index) and move the cards to
`data/decks/wine.json` with metadata: `id`, `name`, `subtitle`, `theme`.
- Keep `data/cards.json` generation working, or update the generator to emit the
  new shape.
- Done when: the app loads wine through the manifest.

### PR 4 — Deck picker
A launch screen listing decks from `data/decks.json`. Picking one sets it for the
session; the header, title, and copy come from that deck's metadata.
- Remember the last deck used.
- Done when: the app titles itself from the chosen deck.

### PR 5 — Per-deck progress (blocking prerequisite)
Move storage to a per-deck key (e.g. `srs_v2:<deckId>`), with a one-time
migration of `wine_srs_v1` into the wine deck.
- Stats, streaks, and mastery become per-deck. Decide and document whether the
  daily streak is global or per-deck — recommend **global**, since it measures
  the habit, not the subject.
- Done when: two decks hold independent progress and existing wine progress
  survives the upgrade.

## Phase 2 — any deck, no custom code

### PR 6 — Generic `basic` card type
A compiler for `{front, back, notes, reversible}` covering vocabulary, terms,
formulas — most decks.
- Done when: a hand-written Spanish deck JSON trains end to end with no new JS.

### PR 7 — Generalize the validator
`scripts/validate-cards.mjs` validates any deck: schema per type, unique ids,
and the duplicate-prompt warning that protects the one-answer rule.
- Done when: `npm run validate` checks every deck in `data/decks/`.

### PR 8 — Spreadsheet to deck (offline)
A Python script (`scripts/import_deck.py`) converting `.csv`/`.xlsx` into deck
JSON, run via `uv run`.
- Deterministic, stable ids derived from content.
- Done when: dropping a spreadsheet in and running one command produces a
  playable deck in the repo.

## Phase 3 — make it a phone app

### PR 9 — Touch and small-screen pass
Tap targets, safe-area insets, no accidental zoom, thumb-reachable rating
buttons. Keyboard shortcuts stay for the laptop.
- Done when: a full session on a phone needs no pinching or precision taps.

### PR 10 — PWA: installable and offline
`manifest.webmanifest` (standalone, theme `#241016`, icons) plus a service worker
precaching the shell and every deck.
- Also protects saved progress: installed PWAs are exempt from Safari's 7-day
  storage eviction.
- Done when: it installs to an iPhone home screen and runs in airplane mode.

### PR 11 — IndexedDB and persistent storage
Move progress from `localStorage` to IndexedDB, call
`navigator.storage.persist()`, migrate existing data.
- Done when: progress survives with no storage warnings, and import has a home.

## Phase 4 — drop a spreadsheet into the running app

### PR 12 — In-browser deck import
Drag a `.csv`/`.xlsx` onto the launch screen; it parses client-side and saves the
deck to IndexedDB alongside the repo decks.
- `.xlsx` needs SheetJS from a CDN (~1 file). CSV-only would need zero
  dependencies — **decide before starting.** Recommend SheetJS, since importing
  the spreadsheet you already have is the point.
- Imported decks live in the browser, not the repo. No commit, no redeploy.
- Done when: a spreadsheet becomes a playable deck on a phone with no laptop.

### PR 13 — Deck health check
Surface duplicate prompts, answer-leaking hints, and lopsided groups at import
time, with a preview before the deck is saved.
- Done when: a broken deck is caught before it is trained on.

## Deliberately not in scope yet

- Cloud sync across devices (roadmap step 3). Revisit only if one browser stops
  being enough.
- Typed answers or fuzzy grading. The yes/no self-rating is the measurement.
- A build step / framework. Revisit at PR 12 if the import UI justifies Vite.
