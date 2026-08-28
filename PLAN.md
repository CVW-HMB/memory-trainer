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
- **D2 — Deck manifest.** `data/decks.json` + `data/decks/wine.json` with
  metadata; update the generator to emit it.
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
- **D7 — Spreadsheet to deck, offline.** `scripts/import_deck.py` converting
  `.csv`/`.xlsx` to deck JSON via `uv run`, with stable content-derived ids.
- **D8 — In-browser import.** Drag a spreadsheet onto the launch screen; parse
  client-side, save to IndexedDB. **Decision:** `.xlsx` via SheetJS (~1 CDN file)
  vs. CSV-only (zero deps). Recommend SheetJS — importing the spreadsheet you
  already have is the point. Imported decks live in the browser, not the repo.
- **D9 — Deck health check.** Surface duplicate prompts, answer-leaking hints,
  and lopsided groups at import time, with a preview before saving.

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
