# CLAUDE.md

Guidance for working on this repo with Claude Code. Read this before changing anything.

## What this is

**La Cave**, a spaced-repetition flashcard trainer. One engine, any number of
decks: the scheduler and the mastery numbers mean the same thing whatever the
subject. The app keeps its name and its cellar vocabulary — flights, tasters,
the cellar book — while each deck names itself in the header, the tab title and
the footer. Keep app-level copy deck-neutral; wine belongs in the wine deck.

The first deck was wine, and it still sets the tone. The learning goal is real-world: walk into a restaurant, see a bottle, and know the grape and where it is from. The deck teaches that in the order a beginner actually needs it: first **what grape grows in what region**, then **how to decode a label**. Content is deliberately weighted: about 70% France, then Tuscany-led Italy, then the internationally popular wines you see on US lists. Obscure bottles are intentionally excluded.

The current app is a single-page static web app (vanilla JS, no framework, no build step). It is intentionally small so it is easy to extend. Progress persists in `localStorage`.

**The MVP has shipped.** `PLAN.md` Part 1 (M1–M7) is complete: the app is live at
<https://cvw-hmb.github.io/memory-trainer/>, installs as a PWA, runs offline,
caps a flight at 20 cards, keeps progress in IndexedDB, and has a tested
scheduler. The deck is 200 cards.

**Two decks now.** `data/decks.json` is the index and the app opens on a
"choose a deck" screen:

- `wine` — "Wines, Grapes, Regions", 161 cards, `data/cards.json`.
- `spanish` — "Spanish – English", 250 cards, `data/spanish.json`.

Progress is keyed `srs_v2:<profile>:<deck>`, so decks never collide. Each deck
declares its own `groups` (with labels), `groupsTitle` and footer `tagline`, so
the cellar book and chrome follow the deck rather than hardcoding wine.

**Card types live in `src/decks/`** behind a registry (`registry.js`). A card
type is a small compiler: it turns a row of deck data into render specs and
declares whether the card may flip. `src/app.js` knows nothing deck-specific.
Adding a deck of an existing shape is an entry in `decks.json` plus a card
file; a genuinely new shape means a new card type in `src/decks/`.

**Open question, not decided:** the app is still branded "La Cave", which reads
oddly over a Spanish deck. The deck name shows as the header subtitle. Ask
before renaming the app.

**Current focus — Part 2:** wine is the first deck, not the product. The
destination is a general multi-deck trainer — decks in `data/decks/`, pick one at
launch, and the app presents itself as that deck (Spanish vocabulary, physics,
wine), with identical scheduling and mastery measurement across decks. Start with
**D1**, extracting the deck adapter; M6 already moved the scheduler into
`src/engine/schedule.js`, so what remains wine-coupled in `src/app.js` is just
`reversible`, `cardLabel`, `cardHint` and `facesFor`.

**`PLAN.md` is the roadmap — read it before starting feature work and keep it
updated as work lands.** Storage is already deck-namespaced (`srs_v2:wine`), so
D4 does not need a second migration.

**Note on the repo name:** the repo is `memory-trainer` (public, so GitHub Pages
serves it on the free plan). The app is still "La Cave", the wine trainer. Do not
rename the app as part of Part 2 unless asked.

The wine-specific rules below (one determinate answer per prompt, declared
reversibility, stable ids) are not wine-specific in spirit. They apply to every deck.

## Run

Needs a static server because the app `fetch`es `data/cards.json`:

- `npm run dev` (Node, serves on :8000) or `npm start` (Python).
- `npm run validate` checks the dataset (Node). `npm run cards` regenerates `data/cards.json` from `scripts/generate_cards.py`.

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

So a card only works if the prompt side maps to exactly **one** correct answer. That is why there are three types, and why only one of them may be shown in both directions.

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

- `vocab` — `{ es, en, kindEs, kindEn }`. One word or phrase per side.
- `conjugation` — `{ verb, english, tenseEs, tenseEn, es[], en[] }`. A whole
  table for one verb in one tense, rendered identically on both faces so they
  read the same way.

Two rules that deck lives by:
- **Each face is entirely in one language** — the prompt line, the pronouns and
  the little category label included. A side never mixes the two.
- **A conjugation card always carries the whole table**, never a single form.
  The validator enforces that `es` and `en` are equal-length lists of
  `[pronoun, form]` pairs.

**Direction rule lives in one place:** `reversible(c)` in `src/app.js`, which
currently returns `false` for everything. If you add a type, update
`reversible`, `facesFor`, `cardLabel`, and `cardHint`.

`group` is one of `France` | `Italy` | `Rest` and drives the per-region stats.

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
- Each flight is capped at `FLIGHT_SIZE` (20) cards, introducing at most
  `NEW_PER_FLIGHT` (5) never-seen cards in deck order. The cap decides how many
  due cards a flight *serves*; it does not touch the box arithmetic.
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

1. **IndexedDB** — database `lacave`, store `progress`, key `srs_v2:wine`. Primary.
2. **`localStorage` under the same `srs_v2:wine` key** — written on every save as a
   mirror. It is the fallback where IndexedDB is blocked (Safari private
   browsing, some webviews), and the app runs entirely from it if so.
3. In-memory, if both fail, so at least the current session stays coherent.

The key is **deck-namespaced already** (`srs_v2:<deckId>`) even though there is
one deck. That is the single concession the MVP makes to Part 2; it means
adding decks later needs no second migration.

`loadState()` migrates on first boot: IndexedDB, then the mirror, then the
pre-M5 `wine_srs_v1` key. A migrated legacy key is only deleted after the
IndexedDB write reads back, because losing progress there is unrecoverable.
`navigator.storage.persist()` is requested at boot; browsers usually grant it
once the PWA is installed.

## Editing / adding cards

`data/cards.json` is the source of truth. Prefer editing `scripts/generate_cards.py` (readable, grouped by region) and running `npm run cards`, then `npm run validate`. The validator checks the per-type schema, unique ids, and that tasting notes do not leak the grape name.

When expanding the deck, keep the France-first weighting and the "popular in a US restaurant" bar. One determinate answer per card is the hard rule.

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
- Do not rewrite the scheduler while doing something else. It is already
  deck-agnostic and its numbers are the product.
