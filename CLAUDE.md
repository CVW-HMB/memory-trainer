# CLAUDE.md

Guidance for working on this repo with Claude Code. Read this before changing anything.

## What this is

A wine flashcard trainer. The learning goal is real-world: walk into a restaurant, see a bottle, and know the grape and where it is from. The deck teaches that in the order a beginner actually needs it: first **what grape grows in what region**, then **how to decode a label**. Content is deliberately weighted: about 70% France, then Tuscany-led Italy, then the internationally popular wines you see on US lists. Obscure bottles are intentionally excluded.

The current app is a single-page static web app (vanilla JS, no framework, no build step). It is intentionally small so it is easy to extend. Progress persists in `localStorage`.

## Run

Needs a static server because the app `fetch`es `data/cards.json`:

- `npm run dev` (Node, serves on :8000) or `npm start` (Python).
- `npm run validate` checks the dataset (Node). `npm run cards` regenerates `data/cards.json` from `scripts/generate_cards.py`.

The Python side is managed by **uv** with a local `./.venv`: `npm run setup:py` (= `uv sync`) creates it from `pyproject.toml` + `.python-version` (3.14, the current stable line). The generator is stdlib-only, so the venv pins the interpreter rather than installing packages. Every Python entry point goes through `uv run`, so no manual activation is needed — do not add `python3 ...` calls back into `package.json`. `.venv/` is gitignored; commit `pyproject.toml`, `.python-version`, and `uv.lock`.

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

`localStorage` under key `wine_srs_v1`, shape:
`{ version, cards: { [id]: {box, correct, wrong, seen, lastSession} }, totalSessions, streak, bestStreak, lastPracticed }`.
Progress is keyed by card id, so **keep ids stable** and add cards additively. Renaming an id resets that one card only.

## Editing / adding cards

`data/cards.json` is the source of truth. Prefer editing `scripts/generate_cards.py` (readable, grouped by region) and running `npm run cards`, then `npm run validate`. The validator checks the per-type schema, unique ids, and that tasting notes do not leak the grape name.

When expanding the deck, keep the France-first weighting and the "popular in a US restaurant" bar. One determinate answer per card is the hard rule.

## Roadmap (what to build next)

This repo is the seed. The intended destination is a phone app the owner can send to someone and have it track progress. Suggested order:

1. **PWA**: add `manifest.webmanifest` (name, icons, `display: standalone`, theme color `#241016`) and a service worker that precaches the shell + `cards.json` for offline use. Installed home-screen PWAs are exempt from Safari's 7-day storage eviction, so this also protects saved progress on iOS. Provide app icons (a wine/label mark).
2. **Storage hardening**: move from `localStorage` to IndexedDB, and call `navigator.storage.persist()`. This matters specifically for iOS home-screen persistence.
3. **Optional cloud sync**: only if cross-device or bulletproof persistence is wanted. A tiny backend (Supabase / Cloudflare KV / a serverless function) keyed by a user id, syncing the same progress object. This also unlocks pushing new cards without a redeploy.
4. **Build tooling**: if the app grows, introduce Vite. Keep `cards.json` as data, not code.
5. **Content**: expand toward ~200 cards, still France-first. Add a "learn" pass that introduces a card in `place2grape` before it can appear as a `decode` reverse.

### Guardrails
- Do not make `place2grape` or `grapehome` reversible. It produces ambiguous prompts.
- Do not embed the grape name in a card's tasting notes.
- Keep card ids stable across updates.
- Keep the dependency footprint light; this should stay easy to run and reason about.
