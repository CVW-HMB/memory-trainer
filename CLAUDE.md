# CLAUDE.md

Guidance for working on this repo with Claude Code. Read this before changing anything.

## What this is

A wine flashcard trainer. The learning goal is real-world: walk into a restaurant, see a bottle, and know the grape and where it is from. The deck teaches that in the order a beginner actually needs it: first **what grape grows in what region**, then **how to decode a label**. Content is deliberately weighted: about 70% France, then Tuscany-led Italy, then the internationally popular wines you see on US lists. Obscure bottles are intentionally excluded.

The current app is a single-page static web app (vanilla JS, no framework, no build step). It is intentionally small so it is easy to extend. Progress persists in `localStorage`.

**Current focus — MVP:** finish the wine app. One deck, done properly: deployed,
phone-ready, offline, durable progress. `PLAN.md` **Part 1** is the only work in
scope right now. Do not build deck abstraction, a deck picker, generic card types,
or an importer until Part 1 ships.

**Where this eventually goes:** wine is the first deck, not the product. The
destination is a general multi-deck trainer — decks in `data/decks/`, pick one at
launch, and the app presents itself as that deck (Spanish vocabulary, physics,
wine), with identical scheduling and mastery measurement across decks. That is
`PLAN.md` **Part 2**, deliberately deferred.

**`PLAN.md` is the roadmap — read it before starting feature work and keep it
updated as work lands.** The one concession Part 1 makes to Part 2 is namespacing
the storage key (M5); otherwise build for one deck.

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

### Type 2 — `decode` (both directions)
The bottle-reading skill. An appellation is unique, so this one is safe to flip.
`{ type, group, appellation, grape, country, region, notes, trap? }`
- forward: show the appellation → recall grape + region + notes.
- reverse: show grape + region + notes → recall the appellation.
`trap: true` marks look-alikes (the two Montepulcianos) and renders a warning-colored label.

### Type 3 — `grapehome` (one direction only)
Prompt: the grape. Answer: its classic home + where else it grows.
`{ type, group, grape, home, also }`
Never reversed: "where does Cabernet grow" has many answers, so it can only be the answer, never the prompt.

**Direction rule lives in one place:** `reversible(c)` in `src/app.js` returns true only for `decode`. If you add a type, update `reversible`, `facesFor`, `cardLabel`, and `cardHint`.

`group` is one of `France` | `Italy` | `Rest` and drives the per-region stats.

## Scheduling

A 5-level Leitner system in `src/app.js`:
- Correct → box up (max 5), which pushes the next due date out (`INTERVAL` maps box → sessions until due).
- Miss → back to box 1 (due every session).
- Each run ("flight") pulls the due cards, orders weak-first with jitter, and shows each **once**. There is deliberately no within-run repeat: a card is never shown twice in one run, and reversible cards get a random direction per run so both directions come up over time.
- Streaks and `bestStreak` update once per calendar day.

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

Content work continues alongside it: expand toward ~200 wine cards, still
France-first, and add a "learn" pass that introduces a card as `place2grape`
before it can appear as a `decode` reverse.

### Guardrails
- Do not make `place2grape` or `grapehome` reversible. It produces ambiguous prompts.
  More generally: a card flips only if the deck declares that direction determinate.
- Do not embed the answer in a card's hint fields (for wine: the grape name in the
  tasting notes).
- Keep card ids stable across updates. Progress is keyed by id.
- Keep the dependency footprint light; this should stay easy to run and reason about.
- Do not rewrite the scheduler while doing something else. It is already
  deck-agnostic and its numbers are the product.
