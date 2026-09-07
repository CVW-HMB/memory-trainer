# La Cave

A spaced-repetition flashcard trainer. Pick a deck, take a short daily flight,
and let the scheduler decide what you see next. One engine, any number of decks:
the scheduling and the mastery numbers mean the same thing whatever you are
studying.

Five decks ship today:

- **Wines, Grapes, Regions** — 161 cards. Learning wine the way it helps you in
  a restaurant: which grapes grow where, and how to read a label you have never
  seen. France-first, then Tuscany-led Italy, then the wines you will actually
  meet on a US list.
- **Mexican Spanish – English** — 254 cards. The 15 most common verbs and the 15
  most common reflexive verbs across present, past and future, plus the
  vocabulary for a house, a town and a table. Mexican usage throughout: no
  `vosotros`, and carro/departamento/refrigerador rather than the Peninsular
  words.
- **French – English** — 254 cards. The same shape, with the passé composé as
  the past tense.
- **Payment Cards** — 148 cards. How a swipe actually works: who is involved,
  authorization through settlement, interchange and the economics, card data
  and EMV, risk and compliance, and the rails underneath.
- **California Plant Families** — 149 cards, and the deck with pictures. The ten
  families that account for most of the California flora: a **floral diagram**
  for each, the diagnostic characters that give it away and what they are
  called, and sets of field clues to key out. An eleventh group holds the
  lookalikes — how to know a mint from a penstemon, a sedge from a grass.
  Flights are 20 cards here rather than 35, because a diagram takes longer to
  read than a word.

  Every diagram is drawn in code as SVG from numbers stored on the card, not
  fetched as an image, so the deck is offline and weightless like the rest. The
  floral formula printed under a diagram is derived from that diagram, and
  `npm run validate` derives it a second time independently and fails if the two
  disagree — a card cannot claim five petals over a drawing of four.

**Live: https://cvw-hmb.github.io/memory-trainer/** — served by GitHub Pages from
`main` at the repo root. Every path in the app is relative, so it works under the
`/memory-trainer/` subpath with no build step. Pushing to `main` redeploys.

> The repo is named `memory-trainer` because wine was the first deck, not the
> product — see `PLAN.md`. The app is called La Cave; each deck names itself.

## Run it

The app loads `data/cards.json` over `fetch`, so it needs a local web server (opening `index.html` directly from the file system will not work in most browsers).

```bash
# option A: Node
npm run dev          # serves on http://localhost:8000

# option B: Python, via the local uv venv
npm run setup:py     # one time: creates ./.venv (uv sync)
npm start            # or: uv run python -m http.server 8000
```

Then open http://localhost:8000.

```bash
npm run cards       # regenerate the wine deck
npm run cards:es    # regenerate the Mexican Spanish deck
npm run cards:fr    # regenerate the French deck
npm run cards:pay   # regenerate the Payment Cards deck
npm run cards:bot   # regenerate the California Plant Families deck
npm test            # scheduler tests (node --test, no dependencies)
npm run validate    # every deck: schema, unique ids, duplicate prompts,
                    # spoiler check, and floral formula vs. floral diagram
```

## Python environment

The card generator is Python. It uses only the standard library, so the venv exists
to pin the interpreter, not to install packages.

```bash
uv sync                              # creates ./.venv from .python-version + pyproject.toml
uv run python scripts/generate_cards.py   # same as: npm run cards
```

`uv run` activates `./.venv` for you — no `source .venv/bin/activate` needed. If you
already have another project's venv active, uv prints a `VIRTUAL_ENV does not match`
warning and correctly uses this project's `.venv` anyway.

### IntelliJ / PyCharm

Point the IDE at the venv this repo already builds — do not let it create its own.

1. `npm run setup:py` (or `uv sync`) so `./.venv` exists.
2. **Settings → Project → Python Interpreter → Add Interpreter → Add Local Interpreter**.
3. Choose **Existing** environment and select:
   `<repo>/.venv/bin/python`
4. Mark `scripts/` as a Sources Root if you want imports resolved there.

`.venv/` and `.idea/` are both gitignored, so this is per-machine setup: anyone
cloning the repo runs step 1 and repeats it.

## What it does

- Opens on a deck chooser — a dropdown, so a phone gets its native picker.
- Ten card types across the five decks (see `CLAUDE.md`), including a `figure`
  render mode for decks that draw rather than describe.
- A flight is 35 cards by default, or whatever the deck asks for (20 in the
  botany deck), drawn at random each time and weighted 4:1 toward the cards you
  keep missing.
- A card runs one way unless its type declares otherwise. Reversibility is
  declared, never assumed: a card flips only when both directions have exactly
  one right answer.
- Miss a card and it comes back later in the same flight. You do not finish a
  flight until every card in it is right; only the first attempt counts toward
  your box and stats.
- A 5-level Leitner scheduler: cards you miss come back every session, mastered cards fade to occasional review.
- Streaks, per-region accuracy, and a "hardest for you" list in the cellar book.
- Progress is saved in IndexedDB, mirrored to `localStorage` as a fallback, under
  the key `srs_v2:<profile>:<deck>`, so several people can share a browser and
  no two decks collide. Progress from the old `wine_srs_v1` key migrates
  automatically on first load.
- Installable as a PWA and fully usable offline: the service worker precaches
  the shell, the deck and the fonts, so a flight runs in airplane mode.

## Editing cards

The deck JSON files under `data/` are the sources of truth, but prefer editing
the matching generator in `scripts/` and regenerating (Python 3.14, run through
the local uv venv) — see the table of `npm run cards:*` commands above. Validate
with `npm run validate`. Keep ids stable and only add cards additively so saved
progress survives.

## Project layout

```
index.html            app shell
data/decks.json       deck index (the "choose a deck" screen)
data/spanish.json     the Mexican Spanish deck
data/french.json      the French deck
data/payments.json    the Payment Cards deck
data/botany.json      the California Plant Families deck
src/decks/            card types: registry, render specs, wine, vocab,
                      glossary, botany — and figures.js, the SVG drawings
src/app.js            UI, rendering, storage, wiring
src/engine/schedule.js  the Leitner scheduler (pure, no DOM)
src/styles.css        styling
tests/                scheduler tests (node --test)
sw.js                 service worker (offline precache)
manifest.webmanifest  PWA manifest
icons/                app icons (192, 512, maskable, apple-touch, favicon)
data/cards.json       the 161 cards (source of truth)
scripts/              card generator + validator
pyproject.toml        Python project for the generator (uv)
.python-version       pinned interpreter for uv
CLAUDE.md             architecture + roadmap for Claude Code
```
