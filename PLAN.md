# Plan

## The long-term goal

One small web app, runnable from a laptop or a phone browser, that trains you on
**any** deck of flashcards using the same scheduling and mastery measurement.
Decks live in a folder in this repo; you launch the app, pick a deck, and the app
presents itself as that deck — Spanish vocabulary, physics, wine. Creating a deck
means writing a spreadsheet and dropping it in.

## But first: finish the wine app

**Part 1 below is the MVP and the only thing being built right now.** It ships a
finished, phone-ready, offline wine trainer with the current deck. No deck
abstraction, no picker, no importer — one deck, done properly.

The reason is not just scope discipline. Generalizing an app that is not yet good
means generalizing the wrong things: you would build a deck picker before knowing
what a finished session feels like on a phone. Finish one deck, learn what
"finished" means, then make it repeatable.

Part 2 is written down so the MVP does not paint itself into a corner, but it is
**not** in scope until Part 1 ships.

---

# Part 1 — MVP: the finished wine app — **SHIPPED**

Goal: open it on your phone, train daily, offline, with progress that survives.
One deck. Done when you would actually use it every day without wishing for
anything.

**All of M1–M7 have landed.** Live at <https://cvw-hmb.github.io/memory-trainer/>.
The repo was renamed `memory-trainer` and made public so Pages could serve it on
the free plan; the app is still the wine trainer. The deck is 200 cards
(France 140 / Italy 36 / Rest 24), a flight is 20 cards, progress lives in
IndexedDB under `srs_v2:wine`, the app installs and runs offline, and the
scheduler is covered by 29 tests (`npm test`).

**Since shipping**, on request: mastered cards no longer starve under the flight
cap (4 review seats reserved for the longest-overdue, `INTERVAL[5]` 8 -> 10);
missed cards repeat inside the flight until cleared, with only the first attempt
counting; every card runs one way (place or label in front, grape/region/notes
behind) and `grapehome` is retired, taking the deck to 161; per-person profiles;
and backup/restore to a file. See `local-files/worklog.md`.

**D1, D3, D5 and D6 have landed**, on request: a card-type registry in
`src/decks/`, a "choose a deck" front page over `data/decks.json`, two new
reversible card types (`vocab`, `conjugation`), a second deck (Spanish – English,
250 cards), and a validator that checks every deck against its own declared
types and groups. D2 (moving the wine deck under `data/decks/`) and D7–D9
(spreadsheet import) are what remain.

Part 2 below is now the live roadmap. D1 (extract the deck adapter) is the
natural first move — and M6 already did half the groundwork by moving the
scheduler into `src/engine/schedule.js`, so what is left in `src/app.js` is
genuinely just the wine rendering.

## What is already good

Do not rebuild these. The engine is sound:

- The Leitner scheduler (`buildQueue`, `answer`) — boxes, intervals, weak-first
  ordering with jitter, no within-run repeats, random direction per run.
- Streaks and per-region stats, the cellar book, the end-of-session summary.
- 200 cards, validated, correctly weighted (France 140 / Italy 36 / Rest 24).
- `index.html` already sets `viewport-fit=cover`, so safe-area work has a base.
- `freshState` pre-populates every card, so no missing-state crashes.

## M1 — Deploy to GitHub Pages ✅
Do this **first**. Every other MVP item needs to be tested on a real phone, and
that is painful until there is a URL.

- No code changes required: all paths are already relative (`./data/cards.json`,
  `./src/app.js`, `./src/styles.css`).
- Enable Pages on `main` / root, or add a deploy workflow.
- **Decision required before starting:** Pages from a private repo needs a paid
  plan. On Free, the repo must go public. Nothing in the repo is sensitive and
  `local-files/` is ignored, so going public is low-risk.
- Done when: the live URL loads on a phone and a session can be completed.

## M2 — Cap the session length ✅
**This is the biggest gap in the app today.** `buildQueue` returns every due
card, and every unseen card counts as due — so **the first flight is all 100
cards**, and flights stay long afterward because box-1 cards are due every
session. That is not a daily habit, it is a chore, and it is the single thing
most likely to stop you using it.

- Add a target flight size (start around 20; make it a constant, not a setting).
- Keep the existing weak-first ordering, then take the top N.
- Mix in a few unseen cards per flight so new material is introduced steadily
  rather than 100 at once.
- Show honest numbers on the home screen: "20 of 47 due" beats "47 due".
- Do **not** change the box arithmetic or intervals. Only how many of the due
  cards a flight serves.
- Done when: a first-run session is ~20 cards, and the deck is still fully
  learnable over repeated days.

## M3 — Touch and small-screen pass ✅
- Thumb-reachable rating buttons; large tap targets.
- Safe-area insets (notch, home indicator); no accidental zoom on double-tap.
- Handle iOS dynamic viewport height properly (`dvh`, not `100vh`).
- Keep the keyboard shortcuts for laptop use.
- Done when: a full session on a phone needs no pinching or precision taps.

## M4 — PWA: installable and offline ✅
- `manifest.webmanifest`: name, `display: standalone`, theme `#241016`.
- **App icons** — real image files at the required sizes, plus
  `apple-touch-icon`. This is a genuine task, not a line of config.
- Add the `theme-color` meta tag (not currently present).
- Service worker precaching the shell and `cards.json`.
- Also protects progress: installed PWAs are exempt from Safari's 7-day storage
  eviction.
- Done when: it installs to an iPhone home screen and runs in airplane mode.

## M5 — Storage hardening ✅
- Move progress from `localStorage` to IndexedDB; call
  `navigator.storage.persist()`; migrate existing `wine_srs_v1` data.
- **Namespace the key now** — store under a deck-scoped key (`srs_v2:wine`)
  even though there is only one deck. It costs nothing today and saves a second
  migration in Part 2. This is the one concession the MVP makes to the long-term
  plan, and it is worth it.
- Done when: progress survives reload, reinstall, and a week of not opening it.

## M6 — Lock the scheduler with tests ✅
There are no tests. The scheduler *is* the product — "if mastery numbers move,
that's a bug" is unenforceable without something to catch it.

- Use Node's built-in test runner (`node --test`), zero dependencies.
- Cover: box promotion and demotion, `INTERVAL` due arithmetic, streak
  increment/reset across day boundaries, no within-run repeats, and the M2 cap.
- Add `npm test`; keep it fast.
- Done when: refactoring the scheduler without changing behavior is safe.

## M7 — Finish the edges ✅
- ~~A "reset progress" path (currently impossible without devtools).~~ This was
  wrong: the cellar book has had a working reset button all along. It now also
  clears IndexedDB and the legacy key.
- Empty and edge states: nothing due, everything mastered, first ever run.
- Content pass toward ~200 cards, still France-first.
- Optional, only if it still feels unfinished: a "learn" pass that introduces a
  card as `place2grape` before it can appear as a `decode` reverse.
- Done when: you would send it to someone without a caveat.

## MVP guardrails
- **One deck.** No deck abstraction, no picker, no importer, no generic card
  types. If a change only makes sense for a second deck, it belongs in Part 2.
- The only forward-looking concession is the namespaced storage key in M5.
- Do not add wine-specific coupling to new code. Not the same as abstracting —
  just do not make Part 2 harder for free.
- Do not rewrite the scheduler. M2 changes how many cards a flight serves, not
  how boxes work.

---

# Part 2 — Generalize to any deck (after the MVP ships)

Not in scope yet. Recorded so Part 1 does not block it.

## Why this is not as big as it sounds

The engine is already deck-agnostic. `buildQueue`, `answer`, streaks and group
stats key off card `id` and `group` and never inspect a wine field. And
`specHeadline` / `specDetail` (`src/app.js:124-125`) are already a generic render
contract — "one big line" or "lead + context + notes", with no wine in them.

The only wine-coupled code is `reversible`, `cardLabel`, `cardHint`, and
`facesFor`: roughly 30 lines translating wine fields into those generic specs.
That is the entire seam.

## Target architecture

```
data/
  decks.json              index: id, name, subtitle, theme, file
  decks/wine.json         cards + deck metadata
src/
  engine/                 schedule.js, store.js
  decks/                  registry.js, basic.js, wine.js
```

A **deck** is metadata plus cards. A **card type** is a compiler: it turns a row
into `{prompt, answer}` render specs and declares whether it is reversible. The
wine types become the first compiler rather than special cases in the renderer.

Generic core card: `{ id, deck, group, type, front, back, extra, reversible }`.

Minimum spreadsheet: `type | group | front | back | notes | reversible`.

## The PRs

- **D1 — Extract the deck adapter.** Move `reversible`/`cardLabel`/`cardHint`/
  `facesFor` into `src/decks/wine.js` behind a type registry. Pure refactor, no
  behavior change. Done when `grep -i grape src/app.js` is empty. *(Good first
  move: needs no decisions.)*
- **D2 — Deck manifest** — **SHIPPED** *(deck-file-paths branch)*. The five deck
  files moved under `data/decks/` (`data/cards.json` became
  `data/decks/wine.json`) and all five generators emit there. Metadata stayed in
  `data/decks.json` rather than moving into each deck file, as this PR
  originally implied: the picker needs every deck's name and subtitle before it
  fetches any deck, so splitting metadata across five files would mean five
  fetches to draw one dropdown.
- **D3 — Deck picker.** Launch screen listing decks; the chosen deck sets the
  session and supplies the app's name, subtitle, and theme. Remember the last
  deck used.
- **D4 — Per-deck progress.** Extend M5's namespaced key to real multi-deck
  storage. **Decision:** is the daily streak global or per-deck? Recommend
  global — it measures the habit, not the subject.
- **D5 — Generic `basic` card type.** `{front, back, notes, reversible}`. Done
  when a hand-written Spanish deck trains end to end with no new JS.
- **D6 — Generalize the validator.** Per-deck schema, unique ids, and a
  duplicate-prompt warning.
- **D7 — Spreadsheet to deck, offline** — **SHIPPED** *(spreadsheet-import
  branch)*. `scripts/import_deck.py` reads `.csv`, `.tsv` and `.xlsx` and emits
  **the same object the D8 paste box accepts**, so a converted sheet and an
  AI-written deck are one artifact checked one way. Ids are content-derived
  (accent-folded slug of the front), so a re-import lands on the same cards and
  keeps their progress; two rows deriving one id is reported by row number.

  `.xlsx` is read with `zipfile` + `ElementTree` — it is a zip of XML — so the
  SheetJS-vs-CSV decision this PR was waiting on is moot in both directions and
  the repo stays dependency-free. The reader follows the workbook relationships
  to the real first tab rather than assuming `sheet1.xml`.

  **A bare front/back sheet becomes a `glossary` deck, not `vocab`.**
  Reversibility is declared, never assumed, and front/back pairs are not
  necessarily one-to-one. `--vocab`, a `translation` column, or an explicit
  `type` column opts in.

  `npm run deck:check <file>` runs the app's own `parseDeck` over a deck file,
  so the command line and the paste box cannot disagree.
- **D8 — Bring your own deck** — **SHIPPED** *(deck-import branch)*, and not as
  the spreadsheet importer this said. The app cannot write deck content, but an
  AI can, so the deck screen hands out a **brief** and takes back the JSON that
  comes of it. That turned out better than the spreadsheet on every axis: zero
  dependencies (the SheetJS decision simply evaporates), and the AI can produce
  real card types instead of flat front/back rows. See "Shipped outside the
  D-list" below.
- **D9 — Deck health check** — **SHIPPED** with D8. Duplicate prompts, undeclared
  groups, answer-leaking labels and lopsided groups are all reported on paste,
  with the card counts, before anything is saved.

## Shipped outside the D-list

- **Bring your own deck** *(deck-import branch)* — D8/D9, reshaped. Three parts:

  1. **`src/decks/schema.js`**, the single source of truth. The per-type field
     tables and the generic check (`checkCards`) moved out of
     `scripts/validate-cards.mjs` so three things read one file: the Node
     validator, the in-app check, and the authoring brief itself. The brief is
     *generated* from the schema, so it cannot describe a deck the app would
     then reject.
  2. **`src/decks/authoring.js`** — `buildPrompt(topic)` writes the brief;
     `parseDeck(text)` reads one back. A pasted deck may use only `glossary` and
     `vocab`, and each card is **rebuilt** from the schema's field list rather
     than filtered, so a field the schema does not name cannot reach the
     renderer. No new card types were needed.
  3. **Storage.** `srs_v2:customDecks` holds the manifest rows, one per deck;
     `srs_v2:customCards:<id>` holds the cards. Deck ids are namespaced `user:`,
     which is what keeps them from colliding with a deck that ships here — and
     since progress keys off the deck id, the namespace protects progress too.

  Two consequences worth remembering. **Re-pasting a deck under the same name
  replaces it and keeps its id**, so a revision preserves progress on every card
  whose id survived — the "ids are stable" rule, now load-bearing for a deck the
  app did not write. And **a custom deck's backup carries its cards**, because a
  deck that exists only in one browser is otherwise unrestorable; built-in decks
  still back up progress alone.

  Also fixed here: restoring a backup never checked that it belonged to the deck
  being restored into, so a wine backup could overwrite the Spanish deck card
  for card. A mismatched backup is now refused by name.

- **Botany deck + drawn figures** *(botany-deck branch)*. Five decks now. The
  California Plant Families deck (149 cards) added three things worth naming:

  1. A **`figure` render mode** in `src/decks/specs.js`. The spec carries a
     `draw` function, not markup, so the renderer stays deck-agnostic and no
     deck can inject HTML. `src/decks/figures.js` holds a parametric floral
     diagram plus ~40 named schematics; deck JSON only names one.
  2. **Per-deck flight size.** `buildQueue` takes an optional fifth argument and
     `data/decks.json` may set `flightSize`; botany asks for 20 against the
     default 35. It caps how many due cards a flight serves and touches nothing
     else — covered by four new tests, including one asserting the default path
     is byte-identical to before.
  3. **A derived-and-cross-checked floral formula.** The Python generator
     derives each formula from that card's diagram; the JS validator derives it
     again and fails on any disagreement. Worth copying wherever a deck prints a
     claim about a picture.

  Also fixed on the way past: `src/decks/glossary.js` was missing from the
  service worker's precache list, so the payments deck was not actually offline.

## Rules that generalize to every deck

- **One determinate answer per prompt.** A prompt with several correct answers
  cannot be graded yes/no. Not auto-enforceable for arbitrary decks, so the
  importer must warn on duplicate prompts.
- **Reversibility is declared, never assumed.**
- **Card ids are stable.** Progress is keyed by id.
- **Do not leak the answer into the hint fields.**

## Sequencing warnings

1. Per-deck storage (D4) must land before a second deck ships, or progress
   collides. M5's namespaced key is what makes this cheap.
2. IndexedDB (M5) before in-browser import (D8) — imported decks need a home.
3. Never rewrite the scheduler as a side effect. If mastery or streak numbers
   move unexpectedly, that is a bug, not a new baseline. M6's tests enforce this.

## Not in scope, either part

- Cloud sync across devices. Revisit only if one browser stops being enough.
- Typed answers or fuzzy grading. The yes/no self-rating is the measurement.
- A build step or framework. Revisit at D8 if the import UI justifies Vite.
