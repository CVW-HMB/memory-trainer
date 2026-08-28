# La Cave — wine trainer

A spaced-repetition flashcard app for learning wine the way it actually helps you in a restaurant: which grapes grow where, and how to read a label you have never seen. Content is France-first (about 70%), then Tuscany-led Italy, then the wines you will actually meet on a US list.

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

- Three card types (see `CLAUDE.md`): place → grape, bottle decode, and grape → home.
- Randomized direction per run for the reversible cards, never the same card twice in a run.
- A 5-level Leitner scheduler: cards you miss come back every session, mastered cards fade to occasional review.
- Streaks, per-region accuracy, and a "hardest for you" list in the cellar book.
- Progress is saved in `localStorage`.

## Editing cards

`data/cards.json` is the source of truth. Either edit it directly or edit the definitions in `scripts/generate_cards.py` and run `npm run cards` (Python 3.14, run through the local uv venv). Validate with `npm run validate`. Keep ids stable and only add cards additively so saved progress survives.

## Project layout

```
index.html            app shell
src/app.js            logic: scheduling, rendering, storage
src/styles.css        styling
data/cards.json       the 100 cards (source of truth)
scripts/              card generator + validator
pyproject.toml        Python project for the generator (uv)
.python-version       pinned interpreter for uv
CLAUDE.md             architecture + roadmap for Claude Code
```
