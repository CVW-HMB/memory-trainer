#!/usr/bin/env python3
"""Turns a spreadsheet into a La Cave deck.

    uv run python scripts/import_deck.py cards.csv --name "Kings of France"

Reads .csv, .tsv or .xlsx and writes the same JSON object the app's "Build your
own deck" panel accepts, so a converted sheet and an AI-written deck are the
same artifact and go through the same check:

    npm run deck:check out/kings-of-france.json

Stdlib only, on purpose -- an .xlsx is a zip of XML, which zipfile and
ElementTree read perfectly well, and this repo keeps its dependency footprint
at zero. See CLAUDE.md.

WHAT THE COLUMNS MEAN

The header row decides everything. Names are matched case-insensitively and
ignoring spaces and underscores, so "Kind Term", "kind_term" and "kindterm" are
one column.

  A glossary deck (a term, and what it means -- ONE direction):
      term/front/word | short/answer | definition/meaning | context | kind | group

  A vocab deck (a one-to-one pair, shown BOTH ways):
      term/word | gloss/translation | kindTerm | kindGloss | group

A sheet is read as vocab only if it says so: a `type` column naming it, a column
called gloss or translation, or --vocab. A bare front/back sheet becomes a
GLOSSARY deck, because reversibility is declared, never assumed -- front/back
pairs are not necessarily one-to-one, and a wrong guess makes half the deck
ungradeable. Pass --vocab when the pairs really do work both ways.
"""
import argparse, csv, json, pathlib, re, sys, unicodedata
import xml.etree.ElementTree as ET
import zipfile

# --- column names, and everything anyone might reasonably call them ---------
ALIASES = {
    "id":         ["id", "cardid"],
    "type":       ["type", "cardtype"],
    "group":      ["group", "section", "topic", "theme", "chapter", "category"],
    "term":       ["term", "front", "word", "name", "prompt", "question"],
    "gloss":      ["gloss", "translation", "english", "otherside"],
    "short":      ["short", "answer", "summary", "inshort"],
    "context":    ["context", "aside", "dates", "when", "reign"],
    "definition": ["definition", "meaning", "notes", "note", "detail", "explanation", "description"],
    "kind":       ["kind", "label", "class"],
    "kindterm":   ["kindterm", "termlabel", "frontlabel"],
    "kindgloss":  ["kindglos", "kindgloss", "glosslabel", "backlabel"],
    # Resolved to `short` or `gloss` once the card type is known.
    "back":       ["back", "reverse"],
}
CANON = {alias: key for key, names in ALIASES.items() for alias in names}

norm = lambda s: re.sub(r"[^a-z0-9]+", "", str(s or "").lower())


def slug(s):
    """A stable, content-derived id. Progress is keyed by it, so it must not
    wobble between runs -- same text in, same id out, accents folded."""
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))[:64]


# --- readers ---------------------------------------------------------------
def read_delimited(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        sample = fh.read(8192)
        fh.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t;")
        except csv.Error:
            dialect = csv.excel_tab if path.suffix.lower() == ".tsv" else csv.excel
        return [[(c or "").strip() for c in row] for row in csv.reader(fh, dialect)]


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def read_xlsx(path):
    """The first worksheet of an .xlsx, as rows of strings.

    An .xlsx is a zip of XML: shared strings in one part, the sheet in another,
    with most text cells holding an index into the shared table rather than the
    text. Formulas are not evaluated -- the cached <v> value is used, which is
    what the spreadsheet last displayed."""
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())

        shared = []
        if "xl/sharedStrings.xml" in names:
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))

        # Follow the workbook's relationships to the first sheet rather than
        # guessing sheet1.xml, which is not always the first tab.
        target = None
        if "xl/workbook.xml" in names and "xl/_rels/workbook.xml.rels" in names:
            sheets = ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS)
            rid = sheets[0].get(f"{{{NS['r']}}}id") if sheets is not None and len(sheets) else None
            for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")):
                if rel.get("Id") == rid:
                    target = "xl/" + rel.get("Target").lstrip("/").removeprefix("xl/")
        if target not in names:
            candidates = sorted(n for n in names if n.startswith("xl/worksheets/") and n.endswith(".xml"))
            if not candidates:
                sys.exit(f"{path}: no worksheet found inside the .xlsx")
            target = candidates[0]

        rows = []
        for row in ET.fromstring(z.read(target)).iter(f"{{{NS['m']}}}row"):
            cells = {}
            for c in row.findall("m:c", NS):
                ref = c.get("r") or ""
                col = re.sub(r"\d", "", ref)
                idx = 0
                for ch in col:                       # A -> 0, B -> 1, AA -> 26
                    idx = idx * 26 + (ord(ch) - 64)
                idx -= 1
                kind, v = c.get("t"), c.find("m:v", NS)
                if kind == "s" and v is not None and v.text is not None:
                    text = shared[int(v.text)] if int(v.text) < len(shared) else ""
                elif kind == "inlineStr":
                    text = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t"))
                else:
                    text = v.text if v is not None and v.text is not None else ""
                if idx >= 0:
                    cells[idx] = str(text).strip()
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)] if cells else [])
        return rows


def read_rows(path):
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        return read_xlsx(path)
    if suffix in (".csv", ".tsv", ".txt"):
        return read_delimited(path)
    sys.exit(f"{path}: expected .csv, .tsv or .xlsx (got {suffix or 'no extension'})")


# --- the conversion --------------------------------------------------------
def build(rows, args):
    rows = [r for r in rows if any(str(c).strip() for c in r)]
    if len(rows) < 2:
        sys.exit("The sheet needs a header row and at least one card.")

    header = rows[0]
    columns, headings = {}, {}
    for i, name in enumerate(header):
        key = CANON.get(norm(name))
        if key and key not in columns:            # first column of a name wins
            columns[key], headings[key] = i, str(name).strip()
    unknown = [str(h).strip() for h in header
               if str(h).strip() and CANON.get(norm(h)) is None]

    if "term" not in columns:
        sys.exit("No column for the front of the card. Name one 'term', 'front' or 'word'.\n"
                 f"Found: {', '.join(str(h).strip() for h in header if str(h).strip()) or '(nothing)'}")

    # Reversibility is declared, never assumed -- see the module docstring.
    declared = ""
    if "type" in columns and len(rows) > 1:
        declared = norm(rows[1][columns["type"]] if columns["type"] < len(rows[1]) else "")
    is_vocab = args.vocab or declared == "vocab" or "gloss" in columns

    # `back` means the answer in a glossary and the other side in a vocab deck,
    # so it is only resolved now that the type is known.
    if "back" in columns:
        columns.setdefault("gloss" if is_vocab else "short", columns["back"])
        headings.setdefault("gloss" if is_vocab else "short", headings["back"])

    if is_vocab and "gloss" not in columns:
        sys.exit("A vocab deck needs the other side of each pair. "
                 "Name a column 'gloss', 'translation' or 'back'.")
    if not is_vocab and "short" not in columns and "definition" not in columns:
        sys.exit("A glossary deck needs the answer. Name a column 'short', 'answer', "
                 "'definition' or 'back'.")

    cell = lambda row, key: (str(row[columns[key]]).strip()
                             if key in columns and columns[key] < len(row) else "")

    cards, groups, seen = [], [], {}
    collisions = []
    for line, row in enumerate(rows[1:], start=2):
        term = cell(row, "term")
        if not term:
            continue                              # a blank front is a spacer row
        group = cell(row, "group") or args.default_group
        if group not in groups:
            groups.append(group)
        # Ids are content-derived so a re-import lands on the same cards and
        # keeps their progress. Two rows deriving one id is therefore a real
        # collision, and the sheet is the only place that can name the row.
        card_id = slug(cell(row, "id") or term)
        if card_id in seen:
            collisions.append(f"row {line} ({term!r}) makes the same id as row {seen[card_id]}: {card_id}")
        else:
            seen[card_id] = line
        card = {"id": card_id, "group": group}
        if is_vocab:
            card |= {
                "type": "vocab",
                "term": term,
                "gloss": cell(row, "gloss"),
                # Falling back to the column headings is usually exactly right:
                # a sheet with "Spanish" and "English" columns labels its faces
                # "Spanish" and "English".
                "kindTerm": cell(row, "kindterm") or args.kind_term or headings.get("term", "Term"),
                "kindGloss": cell(row, "kindgloss") or args.kind_gloss or headings.get("gloss", "Gloss"),
            }
        else:
            answer, detail = cell(row, "short"), cell(row, "definition")
            card |= {
                "type": "glossary",
                "term": term,
                # One column of answer serves as both the big line and the
                # sentence, rather than inventing text the sheet did not have.
                "short": (answer or detail)[:60],
                "definition": detail or answer,
                "kind": cell(row, "kind") or args.kind or group,
            }
            if cell(row, "context"):
                card["context"] = cell(row, "context")
        cards.append(card)

    if not cards:
        sys.exit("No rows had anything in the front column.")

    deck = {
        "app": "la-cave", "format": 1,
        "name": args.name,
        "subtitle": args.subtitle or f"Imported from {args.sheet.name}.",
        "tagline": args.tagline or "",
        "groupsTitle": args.groups_title,
        "groups": [{"id": g, "label": g} for g in groups],
        "cards": cards,
    }
    if is_vocab and (args.ask_term or args.ask_gloss):
        deck["ask"] = {"onTerm": args.ask_term or "", "onGloss": args.ask_gloss or ""}
    return deck, is_vocab, unknown, collisions


def main():
    ap = argparse.ArgumentParser(
        description="Convert a spreadsheet into a La Cave deck.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("WHAT THE COLUMNS MEAN")[1])
    ap.add_argument("sheet", type=pathlib.Path, help=".csv, .tsv or .xlsx")
    ap.add_argument("--name", required=True, help="the deck's name, as it appears in the picker")
    ap.add_argument("--subtitle", default="", help="one or two sentences on what it covers")
    ap.add_argument("--tagline", default="", help="lowercase fragment for the footer")
    ap.add_argument("--groups-title", default="By group", help='e.g. "By dynasty"')
    ap.add_argument("--default-group", default="All", help="group for rows that name none")
    ap.add_argument("--kind", default="", help="glossary: category label when the sheet has no kind column")
    ap.add_argument("--kind-term", default="", help="vocab: label for the term side")
    ap.add_argument("--kind-gloss", default="", help="vocab: label for the gloss side")
    ap.add_argument("--ask-term", default="", help='vocab: line under the term side, e.g. "Which element?"')
    ap.add_argument("--ask-gloss", default="", help='vocab: line under the gloss side')
    ap.add_argument("--vocab", action="store_true",
                    help="read the sheet as one-to-one pairs shown BOTH ways. Only pass this "
                         "when every front has exactly one back AND every back exactly one front")
    ap.add_argument("-o", "--out", type=pathlib.Path, help="output file (default: <slug>.json here)")
    args = ap.parse_args()

    if not args.sheet.exists():
        sys.exit(f"{args.sheet}: no such file")

    deck, is_vocab, unknown, collisions = build(read_rows(args.sheet), args)
    out = args.out or pathlib.Path(f"{slug(args.name) or 'deck'}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = {}
    for c in deck["cards"]:
        counts[c["group"]] = counts.get(c["group"], 0) + 1
    print(f"{out}: {len(deck['cards'])} {'vocab' if is_vocab else 'glossary'} cards")
    print("  groups: " + " · ".join(f"{g} {n}" for g, n in counts.items()))
    if unknown:
        print("  ignored columns: " + ", ".join(unknown))
    if collisions:
        print("\nDuplicate ids -- the app will refuse this deck until they are fixed:")
        for c in collisions:
            print("  - " + c)
        print("  Give the rows distinct fronts, or add an `id` column.")
    print(f"\nCheck it before using it:\n  npm run deck:check {out}")
    if collisions:
        sys.exit(1)


if __name__ == "__main__":
    main()
