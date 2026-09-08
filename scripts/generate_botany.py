#!/usr/bin/env python3
"""Generates data/decks/botany.json -- the California plant families deck.

Ten families, ranked by how much of the California flora they account for.
Every card is written from the sources listed in README; nothing is
transcribed. Run: npm run cards:bot

The floral formula printed on a card is DERIVED from that card's floral
diagram, here, so the two cannot drift apart. scripts/validate-cards.mjs
re-derives it independently in JavaScript and fails if the strings differ.
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "decks" / "botany.json"

# --------------------------------------------------------------------------
# floral formulas, derived from the diagram
# --------------------------------------------------------------------------

def _whorl_token(w):
    """The count part of one whorl: (5) fused, 5 free, 0 absent, or a word."""
    kind = w.get("as") or w.get("as_")
    if kind in ("pappus", "bristles", "lodicules", "absent"):
        return "0" if kind == "absent" else " " + (
            "pappus" if kind == "pappus" else
            "bristles" if kind == "bristles" else
            "%d lodicules" % w["n"])
    n = w.get("n", 0)
    if n == 0:
        return "0"
    return "(%d)" % n if w.get("fused") else str(n)


def formula_for(d):
    """`* K(5) · C(5) · A5 · G(2) inferior` and friends."""
    parts = ["*" if d.get("symmetry") != "bilateral" else "↓"]
    perianth, andro = [], []
    for w in d["whorls"]:
        if w["part"] == "androecium":
            andro.append(_whorl_token(w))
        else:
            perianth.append(w)

    # An undifferentiated perianth (tepals, or the grasses' lodicules) prints as
    # P and swallows the empty whorl beside it.
    tepal = next((w for w in perianth if w.get("p")), None)
    if tepal:
        parts.append("P" + _whorl_token(tepal))
    else:
        for w in perianth:
            parts.append({"calyx": "K", "corolla": "C"}[w["part"]] + _whorl_token(w))

    # A drawn androecium of 5 + 5 is written (9)+1 in the legumes, because nine
    # of the ten filaments are fused. Where the conventional formula does not
    # simply count the whorls, the diagram declares the token -- and the
    # validator checks its numbers still add up to what is drawn.
    parts.append("A" + (d.get("andro") or "+".join(andro)))
    gy = d["gynoecium"]
    g = "G" + ("(%d)" % gy["carpels"] if gy.get("fused", True) and gy["carpels"] > 1
               else str(gy["carpels"]))
    if d.get("ovary") == "inferior":
        g += " inferior"
    parts.append(g)
    return parts[0] + " " + " · ".join(parts[1:])


def fl(symmetry, whorls, gynoecium, ovary="superior", bract=False, axis=True, andro=None):
    d = {"symmetry": symmetry, "ovary": ovary, "bract": bract, "axis": axis,
         "whorls": whorls, "gynoecium": gynoecium}
    if andro:
        d["andro"] = andro
    return d


K = lambda n, fused=False, **kw: dict(part="calyx", n=n, fused=fused, **kw)
C = lambda n, fused=False, **kw: dict(part="corolla", n=n, fused=fused, **kw)
A = lambda n, fused=False, **kw: dict(part="androecium", n=n, fused=fused, **kw)
G = lambda carpels, locules=None, ovules=None, fused=True: dict(
    carpels=carpels, locules=locules or carpels, ovules=ovules, fused=fused)

# --------------------------------------------------------------------------
# the ten families
#
# Ordered by how much of the California flora each accounts for. The top three
# are not in doubt; the rest of the order shifts a little between sources
# because the modern (APG) family limits are wider than the ones older
# California floras used -- most of the old Scrophulariaceae is now
# Plantaginaceae, and Hydrophyllaceae (Phacelia and its allies) is now inside
# Boraginaceae. The deck follows the modern limits.
# --------------------------------------------------------------------------

FAMILIES = [
 dict(code="ast", name="Asteraceae", common="sunflower family",
      form="disc floret", place="The largest family in California, and in the world.",
      diagram=fl("radial",
                 [K(0, as_="pappus"), C(5, True), A(5, True)],
                 G(2, locules=1, ovules=1), ovary="inferior", bract=True, axis=False),
      note="What looks like one flower is a crowd of them on a shared receptacle.",
      check=[["Inflorescence", "a head, ringed by involucral bracts"],
             ["Calyx", "none — a pappus of bristles or scales"],
             ["Corolla", "5 petals fused into a tube or a strap"],
             ["Stamens", "5, anthers fused into a tube round the style"],
             ["Ovary", "inferior, one ovule, one seed"],
             ["Fruit", "a cypsela, usually with the pappus still on"]],
      genera="Eriophyllum, Lasthenia, Artemisia, Baccharis, Cirsium"),

 dict(code="poa", name="Poaceae", common="grass family",
      form="floret", place="Second only to the sunflowers, and the matrix of every California grassland.",
      diagram=fl("bilateral",
                 [K(0, as_="absent"), C(2, as_="lodicules", p=True), A(3)],
                 G(2, locules=1, ovules=1), bract=True),
      note="No sepals, no petals: two lodicules swell and shove the bracts apart.",
      check=[["Stem", "round, hollow, solid and swollen at the nodes"],
             ["Leaves", "2-ranked, parallel-veined, sheath split open"],
             ["Junction", "a ligule where blade meets sheath"],
             ["Flowers", "in spikelets, behind a lemma and a palea"],
             ["Stamens", "3, hanging out; stigmas 2 and feathery"],
             ["Fruit", "a caryopsis — seed coat fused to the fruit wall"]],
      genera="Stipa, Bromus, Festuca, Poa, Muhlenbergia"),

 dict(code="fab", name="Fabaceae", common="legume family",
      form="papilionoid flower", place="Third largest in California; Astragalus and Lupinus are both enormous here.",
      diagram=fl("bilateral",
                 [K(5, True), C(5), A(5), A(5)],
                 G(1, locules=1, ovules=4), bract=True, andro="(9)+1"),
      note="Banner, two wings and a keel; the keel hides nine fused stamens and one free.",
      check=[["Corolla", "bilateral: banner, 2 wings, a keel"],
             ["Stamens", "10 — nine fused into a sheath, one free"],
             ["Ovary", "superior, one carpel, one chamber"],
             ["Fruit", "a legume, splitting down both seams"],
             ["Leaves", "alternate, compound, with stipules"],
             ["Roots", "often with nitrogen-fixing nodules"]],
      genera="Lupinus, Astragalus, Acmispon, Trifolium, Acacia"),

 dict(code="bra", name="Brassicaceae", common="mustard family",
      form="flower", place="Fourth largest, and the family behind most of California's weedy spring yellow.",
      diagram=fl("radial",
                 [K(4), C(4), A(2, offset=90), A(4)],
                 G(2, locules=2, ovules=4)),
      note="Four petals in a cross, six stamens — four tall, two short.",
      check=[["Corolla", "4 free petals set in a cross"],
             ["Stamens", "6, tetradynamous: 4 long, 2 short"],
             ["Ovary", "superior, 2 carpels, a false septum between"],
             ["Fruit", "a silique, or a silicle if under 3× as long"],
             ["Leaves", "alternate or in a basal rosette"],
             ["Smell", "peppery — glucosinolates (mustard oils)"]],
      genera="Streptanthus, Caulanthus, Boechera, Brassica, Lepidium"),

 dict(code="pol", name="Polygonaceae", common="buckwheat family",
      form="flower", place="The wild buckwheats (Eriogonum) are one of California's largest genera.",
      diagram=fl("radial",
                 [K(6, True, p=True), C(0, as_="absent"), A(6), A(3)],
                 G(3, locules=1, ovules=1), bract=True),
      note="No petals — six look-alike tepals over a single seed with three angles.",
      check=[["Nodes", "swollen, usually sheathed by an ocrea"],
             ["Perianth", "tepals, all alike, no true petals"],
             ["Stamens", "3–9"],
             ["Ovary", "superior, 3 carpels but one chamber, one ovule"],
             ["Fruit", "a 3-sided achene"],
             ["Exception", "Eriogonum has no ocrea — it has involucres"]],
      genera="Eriogonum, Chorizanthe, Rumex, Persicaria"),

 dict(code="bor", name="Boraginaceae", common="borage and waterleaf family",
      form="flower", place="Bigger than it looks: Phacelia and its allies (once Hydrophyllaceae) sit inside it now.",
      diagram=fl("radial",
                 [K(5, True), C(5, True), A(5)],
                 G(2, locules=4, ovules=4)),
      note="A coiled spray of five-lobed flowers over an ovary split into four.",
      check=[["Hairs", "stiff and bristly, often rough to the touch"],
             ["Inflorescence", "a scorpioid cyme, coiled at the tip"],
             ["Corolla", "5 fused lobes, radial, often with throat scales"],
             ["Stamens", "5, attached inside the corolla tube"],
             ["Ovary", "superior, 2 carpels, 4 lobes, style from the base"],
             ["Fruit", "4 nutlets"]],
      genera="Phacelia, Cryptantha, Plagiobothrys, Amsinckia, Eriodictyon"),

 dict(code="cyp", name="Cyperaceae", common="sedge family",
      form="flower", place="Carex alone runs to well over a hundred taxa in California.",
      diagram=fl("radial",
                 [K(0, as_="bristles", p=True), C(0, as_="absent"), A(3)],
                 G(3, locules=1, ovules=1), bract=True),
      note="One naked flower behind one scale; sedges have edges.",
      check=[["Stem", "triangular, solid, no swollen nodes"],
             ["Leaves", "3-ranked, sheaths closed into a tube"],
             ["Flowers", "tiny, one behind each scale of a spike"],
             ["Perianth", "absent, or reduced to bristles"],
             ["Stamens", "3; stigmas 2 or 3, not feathery"],
             ["Fruit", "an achene — in Carex, sealed in a perigynium"]],
      genera="Carex, Cyperus, Eleocharis, Schoenoplectus"),

 dict(code="pla", name="Plantaginaceae", common="plantain family",
      form="flower", place="Holds most of what California floras used to file under Scrophulariaceae, Penstemon included.",
      diagram=fl("bilateral",
                 [K(5, True), C(5, True), A(4)],
                 G(2, locules=2, ovules=6)),
      note="Two lips and four stamens — but a capsule of many seeds, not four nutlets.",
      check=[["Corolla", "5 fused lobes, bilateral, often 2-lipped"],
             ["Stamens", "4, didynamous — two pairs of unequal length"],
             ["Extra", "a 5th sterile staminode in Penstemon"],
             ["Ovary", "superior, 2 carpels, axile placentation"],
             ["Fruit", "a capsule with many small seeds"],
             ["Not", "no square stem, no mint smell, no nutlets"]],
      genera="Penstemon, Collinsia, Antirrhinum, Keckiella, Plantago"),

 dict(code="ple", name="Polemoniaceae", common="phlox family",
      form="flower", place="A California-centred family: more of it grows here than anywhere else on earth.",
      diagram=fl("radial",
                 [K(5, True), C(5, True), A(5)],
                 G(3, locules=3, ovules=6)),
      note="A narrow tube that flares abruptly into a flat face, over three chambers.",
      check=[["Corolla", "5 fused lobes, radial, often salverform"],
             ["Stamens", "5, attached in the corolla tube"],
             ["Ovary", "superior, 3 carpels, 3 chambers"],
             ["Style", "one, with 3 stigma lobes"],
             ["Fruit", "a capsule, seeds on the central column"],
             ["Leaves", "alternate or opposite, often finely divided"]],
      genera="Gilia, Leptosiphon, Navarretia, Eriastrum, Phlox"),

 dict(code="ona", name="Onagraceae", common="evening primrose family",
      form="flower", place="Clarkia is nearly a California endemic genus, and the family is unusually well represented here.",
      diagram=fl("radial",
                 [K(4), C(4), A(4), A(4)],
                 G(4, locules=4, ovules=8), ovary="inferior"),
      note="Count in fours — and check the stigma, which has four lobes too.",
      check=[["Merosity", "in fours: 4 sepals, 4 petals"],
             ["Stamens", "8, in two whorls of four"],
             ["Tube", "a floral tube (hypanthium) above the ovary"],
             ["Ovary", "inferior, 4 carpels, 4 chambers"],
             ["Stigma", "capitate or 4-lobed"],
             ["Fruit", "usually a capsule splitting into 4"]],
      genera="Clarkia, Camissonia, Oenothera, Epilobium, Ludwigia"),
]

# `as_` keeps Python happy; the JSON field is `as`.
def clean(d):
    if isinstance(d, dict):
        return {("as" if k == "as_" else k): clean(v) for k, v in d.items()}
    if isinstance(d, list):
        return [clean(x) for x in d]
    return d

# Extra flower forms worth their own card, plus the two families California
# beginners most often mistake for one of the ten.
FLORAL_EXTRA = [
 dict(code="ast", group="Asteraceae", name="Asteraceae", common="sunflower family",
      form="ray floret", diagram=fl("bilateral",
          [K(0, as_="pappus"), C(5, True), A(0)],
          G(2, locules=1, ovules=1), ovary="inferior", bract=True, axis=False),
      note="Three teeth on the strap, not three petals: five are fused, two of them tiny."),
 dict(code="ast", group="Asteraceae", name="Asteraceae", common="sunflower family",
      form="ligulate floret", diagram=fl("bilateral",
          [K(0, as_="pappus"), C(5, True), A(5, True)],
          G(2, locules=1, ovules=1), ovary="inferior", bract=True, axis=False),
      note="All five petals in the strap, so five teeth — the dandelion sort, and it has stamens."),
 dict(code="fab", group="Fabaceae", name="Fabaceae", common="legume family",
      form="mimosoid flower", diagram=fl("radial",
          [K(5, True), C(5, True), A(12)],
          G(1, locules=1, ovules=4), bract=True),
      note="Radial and tiny, with long stamens doing the show — the acacia puffball."),
 dict(code="fab", group="Fabaceae", name="Fabaceae", common="legume family",
      form="caesalpinioid flower", diagram=fl("bilateral",
          [K(5), C(5), A(10)],
          G(1, locules=1, ovules=4), bract=True),
      note="Bilateral but not butterfly-shaped, and the upper petal sits innermost."),
 dict(code="lam", group="Lookalikes", name="Lamiaceae", common="mint family — not in the top ten",
      form="flower", diagram=fl("bilateral",
          [K(5, True), C(5, True), A(4)],
          G(2, locules=4, ovules=4)),
      note="Same 2 lips and 4 stamens as Plantaginaceae — but a 4-lobed ovary, so four nutlets."),
]

# --------------------------------------------------------------------------
# diagnostic features: what you are looking at, and what it is called
# --------------------------------------------------------------------------
F = lambda group, term, kind, description, shape=None, where="", note="": dict(
    group=group, term=term, kind=kind, description=description,
    shape=shape, where=where, note=note)

FEATURES = [
 # Asteraceae
 F("Asteraceae", "Head (capitulum)", "Inflorescence",
   "Many small flowers packed side by side on one shared, flattened stem tip, the whole thing ringed by green bracts and read by the eye as a single flower.",
   "head", "Asteraceae — every one of them.",
   "It is why the family used to be called Compositae: each 'flower' is a composite."),
 F("Asteraceae", "Involucre", "Inflorescence",
   "The collar of green bracts wrapped round the base of a head, doing the job sepals do elsewhere.",
   None, "Asteraceae. The individual bracts are phyllaries.",
   "Their shape and rank count carry a lot of the genus-level identification."),
 F("Asteraceae", "Pappus", "Flower",
   "The calyx, reduced to a tuft of bristles, scales or teeth sitting on top of the ovary, and still there on the ripe fruit.",
   None, "Asteraceae.", "The dandelion's parachute is a pappus."),
 F("Asteraceae", "Cypsela", "Fruit",
   "A dry one-seeded fruit that never opens, developed from an inferior ovary and usually still crowned by its bristles.",
   None, "Asteraceae.", "Loosely called an achene; strictly a cypsela, because the ovary was inferior."),
 F("Asteraceae", "Disc floret", "Flower",
   "One small flower with a radial tube of five fused lobes, standing in the middle of a head.",
   "discFloret", "Asteraceae.", "Count the lobes at the rim of the tube: there are five."),
 F("Asteraceae", "Ray floret", "Flower",
   "A flower at the edge of a head whose corolla is pulled out into a one-sided strap with three teeth, and which has no stamens.",
   "rayFloret", "Asteraceae, in the sunflower subfamily.",
   "Three teeth, because three of the five fused petals make the strap."),
 F("Asteraceae", "Ligulate floret", "Flower",
   "A strap-shaped flower with five teeth at its tip and working stamens, filling a head that has no tubular flowers in it at all.",
   "ligulateFloret", "Asteraceae, in the chicory subfamily — dandelions and their kin.",
   "Five teeth means all five petals went into the strap."),
 F("Asteraceae", "Syngenesious anthers", "Flower",
   "Five anthers joined edge to edge into a hollow tube, through which the style grows to push the pollen out ahead of itself.",
   "syngenesious", "Asteraceae — the character the family is named for in older books.",
   "The filaments stay free; only the anthers are fused."),
 F("Asteraceae", "Discoid head", "Inflorescence",
   "A head made only of tubular flowers, with no straps round the edge, so it reads as a brush or a thistle rather than a daisy.",
   None, "Asteraceae — thistles, sagebrush, coyote brush.", ""),
 F("Asteraceae", "Radiate head", "Inflorescence",
   "A head with tubular flowers in the middle and a single ring of strap-shaped ones round the outside.",
   None, "Asteraceae — the shape everyone thinks of as a daisy.", ""),

 # Poaceae
 F("Poaceae", "Spikelet", "Inflorescence",
   "The unit a grass inflorescence is built from: a short axis carrying two empty bracts at the bottom and one or more flowers stacked above them.",
   "spikelet", "Poaceae.", "Almost all grass identification is spikelet dissection."),
 F("Poaceae", "Glume", "Flower",
   "Either of the two empty bracts at the very base of a grass spikelet, below any flower.",
   None, "Poaceae.", "Empty is the point: no flower sits in a glume's axil."),
 F("Poaceae", "Lemma", "Flower",
   "The outer, lower bract of the pair that encloses a single grass flower, and the one that usually carries the bristle.",
   None, "Poaceae.", "Lemma outside, palea inside."),
 F("Poaceae", "Palea", "Flower",
   "The inner, upper bract of the pair enclosing a single grass flower, usually thinner and two-keeled.",
   None, "Poaceae.", ""),
 F("Poaceae", "Lodicule", "Flower",
   "Either of the two minute scales at the base of a grass flower that swell with water and force its bracts apart so the anthers can hang out.",
   "grassFloret", "Poaceae.", "They are what is left of the perianth."),
 F("Poaceae", "Awn", "Flower",
   "A stiff bristle running out from the tip or back of a bract in a grass spikelet.",
   None, "Poaceae, and named parts of other families.",
   "Whether it is straight, bent or twisted separates a lot of California grasses."),
 F("Poaceae", "Ligule", "Stem & leaf",
   "A small membrane or fringe of hairs standing up at the join where a grass leaf blade leaves the sheath that wraps the stem.",
   "liguleGrass", "Poaceae.", "Its shape is a routine identification character."),
 F("Poaceae", "Culm", "Stem & leaf",
   "The flowering stem of a grass: round in section, hollow between the joints and solid at them.",
   "culmHollow", "Poaceae.", "Roll it between finger and thumb — a grass rolls, a sedge will not."),
 F("Poaceae", "Caryopsis", "Fruit",
   "A dry one-seeded fruit in which the seed coat is fused to the fruit wall, so the two cannot be separated.",
   None, "Poaceae.", "Every grain — wheat, rice, corn — is one."),
 F("Poaceae", "Distichous", "Stem & leaf",
   "Leaves borne in two vertical ranks, so the whole shoot lies flat in a single plane.",
   "ranks2", "Poaceae, and irises.", "Two ranks, grass; three ranks, sedge."),
 F("Poaceae", "Plumose stigma", "Flower",
   "A stigma drawn out into a feathery brush, built to comb pollen out of moving air.",
   None, "Poaceae, and other wind-pollinated families.", ""),

 # Cyperaceae
 F("Cyperaceae", "Trigonous culm", "Stem & leaf",
   "A flowering stem triangular in cross-section and solid all the way through, with no swollen joints along it.",
   "culmTriangular", "Cyperaceae.", "Sedges have edges."),
 F("Cyperaceae", "Tristichous", "Stem & leaf",
   "Leaves borne in three vertical ranks, one every 120 degrees round the stem.",
   "ranks3", "Cyperaceae.", ""),
 F("Cyperaceae", "Perigynium", "Fruit",
   "A closed flask-shaped sac enclosing a single ovary, with the stigmas emerging from a beak at its top.",
   "perigynium", "Cyperaceae — the genus Carex, and only it.",
   "Its shape and beak are how Carex species are told apart."),
 F("Cyperaceae", "Floral scale", "Inflorescence",
   "A single small bract with one naked flower sitting in its axil, stacked with others into a spike.",
   "sedgeSpike", "Cyperaceae.", "One scale, one flower — grasses put two bracts round each."),

 # Fabaceae
 F("Fabaceae", "Papilionaceous corolla", "Flower",
   "A bilateral corolla of five unequal petals: a broad one standing up at the back, two spreading sideways, and two joined along their lower edge into a boat.",
   "papilionaceous", "Fabaceae, in the subfamily Faboideae.", "Butterfly-shaped, hence the name."),
 F("Fabaceae", "Banner (standard)", "Flower",
   "The single large upper petal of a pea flower, the one that wraps all the others while the flower is still in bud.",
   None, "Fabaceae.", ""),
 F("Fabaceae", "Wings", "Flower",
   "The two lateral petals of a pea flower, which flank the boat-shaped structure and take a bee's weight.",
   None, "Fabaceae.", ""),
 F("Fabaceae", "Keel", "Flower",
   "The two lowest petals of a pea flower, joined along their upper edge into a boat that hides the stamens and style.",
   None, "Fabaceae.", "Press it down and the stamens spring out onto the bee."),
 F("Fabaceae", "Diadelphous stamens", "Flower",
   "Ten stamens with nine of their filaments fused into an open sheath and the tenth standing free above it.",
   "diadelphous", "Fabaceae, in the subfamily Faboideae.", "Written (9)+1 in a floral formula."),
 F("Fabaceae", "Legume", "Fruit",
   "A dry fruit from one carpel that splits along both of its seams into two halves, with the seeds attached in a single row.",
   "legume", "Fabaceae — the fruit the family is named for.",
   "One carpel is the giveaway; nothing divides the inside."),
 F("Fabaceae", "Stipule", "Stem & leaf",
   "Either of a pair of small appendages at the point where a leaf stalk meets the stem.",
   None, "Fabaceae reliably; many other families.",
   "In peas they can be leafy; in some legumes they are spines."),

 # Brassicaceae
 F("Brassicaceae", "Cruciform corolla", "Flower",
   "Four free petals set at right angles so the flower reads as a cross from directly above.",
   "cruciform", "Brassicaceae — the character behind the old name Cruciferae.", ""),
 F("Brassicaceae", "Tetradynamous stamens", "Flower",
   "Six stamens of two lengths in one flower: four long ones and two short ones.",
   "tetradynamous", "Brassicaceae.", "The two short ones are the outer, lateral pair."),
 F("Brassicaceae", "Silique", "Fruit",
   "A dry two-valved fruit at least three times longer than wide, whose valves fall away from a papery partition left standing in a rim.",
   "silique", "Brassicaceae.", ""),
 F("Brassicaceae", "Silicle", "Fruit",
   "The same two-valved fruit with the standing partition, but less than three times as long as it is wide.",
   "silicle", "Brassicaceae — peppergrass, shepherd's purse.",
   "Only the proportion differs; the construction is identical."),
 F("Brassicaceae", "Replum", "Fruit",
   "The persistent rim left standing when both valves of a mustard fruit fall away, still carrying the partition and the seeds.",
   None, "Brassicaceae.", ""),
 F("Brassicaceae", "Glucosinolate", "Term",
   "The class of sulphur compound that turns pungent when the tissue is crushed, giving a crushed leaf its peppery bite.",
   None, "Brassicaceae, and its relatives in the order Brassicales.",
   "Mustard, horseradish and wasabi heat is all the same chemistry."),

 # Polygonaceae
 F("Polygonaceae", "Ocrea", "Stem & leaf",
   "A papery tube round the stem just above a leaf base, formed from two stipules fused together.",
   "ocrea", "Polygonaceae — but not Eriogonum.",
   "Slide a finger up the stem and you feel each collar."),
 F("Polygonaceae", "Swollen node", "Stem & leaf",
   "A joint on the stem visibly thicker than the internode either side of it.",
   "swollenNode", "Polygonaceae — the knots in knotweed.", ""),
 F("Polygonaceae", "Tepal", "Flower",
   "A perianth part on a flower whose sepals and petals cannot be told apart from each other.",
   None, "Polygonaceae, and most monocots.", ""),
 F("Polygonaceae", "Trigonous achene", "Fruit",
   "A dry one-seeded fruit that does not open, with three flat faces meeting in three sharp angles.",
   "acheneTrigonous", "Polygonaceae.", "Three carpels, one seed, three edges."),
 F("Polygonaceae", "Involucre (buckwheat)", "Inflorescence",
   "A small cup of fused bracts, its rim toothed, holding a cluster of stalked flowers up above it.",
   "involucreCup", "Polygonaceae — Eriogonum and Chorizanthe.",
   "The wild buckwheats have this instead of an ocrea."),

 # Boraginaceae
 F("Boraginaceae", "Scorpioid cyme", "Inflorescence",
   "A one-sided flower spray coiled like the head of a fiddle, unrolling from the tip as the oldest flowers open first.",
   "scorpioid", "Boraginaceae.", "The genus name Amsinckia's common name, fiddleneck, is this shape."),
 F("Boraginaceae", "Nutlets", "Fruit",
   "Four small hard one-seeded segments left sitting in the persistent calyx when a single ovary breaks apart.",
   "nutlets4", "Boraginaceae — and, confusingly, Lamiaceae.",
   "Four nutlets alone will not settle the family; check stem and leaves."),
 F("Boraginaceae", "Gynobasic style", "Flower",
   "A style that rises from a point at the very base of a deeply lobed ovary rather than from its tip.",
   "gynobasic", "Boraginaceae and Lamiaceae.",
   "It is why the ovary can split into four and the style still stands."),
 F("Boraginaceae", "Faucal appendages", "Flower",
   "Small scales, folds or pads standing in the throat of a fused corolla where the tube opens out.",
   None, "Boraginaceae — forget-me-nots wear them as a coloured eye.", ""),
 F("Boraginaceae", "Hispid", "Stem & leaf",
   "Clothed in stiff, straight, harsh bristles that catch on skin.",
   None, "Boraginaceae, characteristically.", "Rough enough that the family is recognisable by touch."),

 # Polemoniaceae
 F("Polemoniaceae", "Salverform corolla", "Flower",
   "Five fused petals making a long narrow tube that opens abruptly into a flat, radial face set at right angles to it.",
   "salverform", "Polemoniaceae — phlox, gilia, leptosiphon.", ""),
 F("Polemoniaceae", "Loculicidal capsule", "Fruit",
   "A dry fruit of several chambers that splits open through the back of each chamber, seeds attached to the central column.",
   "capsule3", "Polemoniaceae.", "Three chambers here, matching three carpels."),

 # Onagraceae
 F("Onagraceae", "Hypanthium (floral tube)", "Flower",
   "A tube standing above the ovary, formed from the fused bases of sepals, petals and stamens, and carrying all of them at its rim.",
   "hypanthiumInferior", "Onagraceae. Also, cup-shaped, in Rosaceae.",
   "In an evening primrose it can be several centimetres long."),
 F("Onagraceae", "Inferior ovary", "Flower",
   "An ovary sunk below the point where sepals, petals and stamens are attached, so the flower sits on top of it.",
   None, "Onagraceae and Asteraceae, among the ten.",
   "The swelling behind the flower is the fruit already forming."),
 F("Onagraceae", "Four-lobed stigma", "Flower",
   "A stigma divided into four arms in a cross, one for each chamber of the ovary below.",
   "stigma4", "Onagraceae.", "Counting stigma lobes counts carpels."),
 F("Onagraceae", "Tetramerous", "Flower",
   "Built in fours: four sepals, four petals, and stamens in fours.",
   "merous4", "Onagraceae.", "Most eudicots go in fives; fours are worth noticing."),

 # Plantaginaceae
 F("Plantaginaceae", "Bilabiate corolla", "Flower",
   "Five fused petals split into an upper lip of two lobes and a lower lip of three.",
   "bilabiate", "Plantaginaceae, Lamiaceae, Orobanchaceae.", "Two above, three below."),
 F("Plantaginaceae", "Didynamous stamens", "Flower",
   "Four stamens in one flower arranged as two pairs of unequal length.",
   "didynamous", "Plantaginaceae and Lamiaceae.", "Four, in two lengths — not six."),
 F("Plantaginaceae", "Staminode", "Flower",
   "A stamen present in the flower but making no pollen, sometimes conspicuous and bearded.",
   None, "Plantaginaceae — the fifth stamen of every Penstemon.",
   "Penstemon means 'five stamens'; the fifth is this sterile one."),
 F("Plantaginaceae", "Axile placentation", "Fruit",
   "Ovules attached to a central column where the partitions of a several-chambered ovary meet.",
   "capsuleAxile", "Plantaginaceae, Polemoniaceae, Onagraceae.", ""),

 # cross-family vocabulary and the lookalikes
 F("Lookalikes", "Square stem", "Stem & leaf",
   "A stem four-angled in cross-section, carrying its leaves in opposite pairs set at right angles to the pair below.",
   "squareStem", "Lamiaceae, characteristically — and some Scrophulariaceae.",
   "Square stem plus a smell plus four nutlets is a mint; any one alone is not."),
 F("Lookalikes", "Verticillaster", "Inflorescence",
   "A dense cluster of flowers sitting in the axil of each leaf pair, so the flowers appear to ring the stem at intervals.",
   "verticillaster", "Lamiaceae.", "It looks like a whorl but is really two opposed cymes."),
 F("Lookalikes", "Compound umbel", "Inflorescence",
   "Stalks radiating from one point, each ending not in a flower but in a second, smaller set of radiating stalks.",
   "umbelCompound", "Apiaceae — carrots, hemlock, cow parsnip.",
   "A daisy's head is dense and flat; an umbel's stalks are visibly separate."),
 F("Lookalikes", "Schizocarp", "Fruit",
   "A dry fruit that splits at maturity into two one-seeded halves hanging from a forked central stalk.",
   "schizocarp2", "Apiaceae. Boraginaceae's four nutlets are the same idea taken further.", ""),
 F("Lookalikes", "Raceme", "Inflorescence",
   "An unbranched axis of stalked flowers that opens from the bottom upwards and keeps growing at the tip.",
   "raceme", "Brassicaceae and Fabaceae, routinely.",
   "Open flowers below, buds above, fruit below that."),
 F("Lookalikes", "Actinomorphic", "Term",
   "A flower that can be cut through the middle in more than one plane and still give two matching halves.",
   None, "Radially symmetrical. Brassicaceae, Polemoniaceae, Boraginaceae.", ""),
 F("Lookalikes", "Zygomorphic", "Term",
   "A flower with exactly one plane of symmetry, so there is only one way to halve it into a matching pair.",
   None, "Bilaterally symmetrical. Fabaceae, Plantaginaceae, Lamiaceae.", ""),
 F("Lookalikes", "Connate", "Term",
   "Fused to other parts of the same kind — petals to petals, sepals to sepals.",
   None, "Shown by brackets in a floral formula: C(5).",
   "Fused to a different kind of part is adnate, not this."),
 F("Lookalikes", "Epipetalous", "Term",
   "Describing stamens attached to the inside of the corolla tube rather than to the receptacle.",
   None, "Boraginaceae, Polemoniaceae, Plantaginaceae.", ""),
]

# --------------------------------------------------------------------------
# field clues: what you can see, and the family it lands on
#
# The hard rule of this app is one determinate answer per prompt, so each set
# below has to key out to exactly one family -- including against the two
# lookalike families, which is why several sets carry a negative character.
# --------------------------------------------------------------------------
def CL(group, rows, example, note="", family=None, common=None):
    return dict(group=group, rows=rows, example=example, note=note,
                family=family or group, common=common)

CLUES = [
 # Asteraceae
 CL("Asteraceae", [["Inflorescence", "many small flowers on one shared receptacle"],
                   ["Below them", "a collar of green bracts"],
                   ["Stamens", "5, anthers fused into a tube"],
                   ["Ovary", "inferior, a single ovule"]], "Eriophyllum, Lasthenia"),
 CL("Asteraceae", [["Looks like", "one yellow flower with broad petals"],
                   ["Each petal", "a strap with 3 small teeth at the tip"],
                   ["On the fruit", "a crown of bristles, no sepals"]], "Helianthus, Encelia",
    "Each strap is a whole flower — a ray floret."),
 CL("Asteraceae", [["Sap", "milky"],
                   ["Head", "strap-shaped flowers only, each with 5 teeth"],
                   ["Fruit", "one seed, with a parachute of hairs"]], "Malacothrix, Stephanomeria",
    "The chicory side of the family: ligulate florets all through."),
 CL("Asteraceae", [["Bracts", "spine-tipped, in many overlapping ranks"],
                   ["Head", "tubular flowers only, no straps at the rim"],
                   ["Style", "with 2 branches, pushed through an anther tube"]], "Cirsium, Centaurea"),
 CL("Asteraceae", [["Shrub", "of coastal scrub, resinous"],
                   ["Heads", "small, crowded, of tubular flowers only"],
                   ["Fruit", "dry, one-seeded, never opening, pappus attached"]], "Baccharis, Artemisia"),

 # Poaceae
 CL("Poaceae", [["Stem", "round, hollow, solid at the joints"],
                ["Leaves", "in 2 ranks, sheath split open down one side"],
                ["At the join", "a membrane standing up against the stem"]], "Bromus, Festuca",
    "Roll the stem: a grass rolls between finger and thumb."),
 CL("Poaceae", [["Flowers", "no sepals, no petals, tucked between two bracts"],
                ["Stamens", "3, dangling on long filaments"],
                ["Stigmas", "2, feathery"]], "Poa, Agrostis"),
 CL("Poaceae", [["Unit", "a short axis with 2 empty bracts at its base"],
                ["Above them", "one or more flowers, each in its own pair of bracts"],
                ["Often", "a stiff bristle from the outer bract"]], "Stipa, Elymus",
    "That unit is a spikelet, and grass identification lives in it."),
 CL("Poaceae", [["Fruit", "dry, one-seeded, seed coat fused to the fruit wall"],
                ["Habit", "annual or tufted perennial of open ground"],
                ["Perianth", "two tiny scales that swell to open the bracts"]], "Avena, Hordeum"),
 CL("Poaceae", [["Where", "dry hills, whole slopes of it, gold by June"],
                ["Stem", "jointed, hollow between the joints"],
                ["Leaves", "flat, parallel-veined, alternate in one plane"]], "Bromus, Avena",
    "Most of California's golden hills are introduced annual grasses."),

 # Fabaceae
 CL("Fabaceae", [["Corolla", "bilateral: a broad upper petal, 2 side petals, a boat"],
                 ["Stamens", "10 — nine fused into a sheath, one free"],
                 ["Ovary", "superior, one carpel"]], "Lupinus, Acmispon"),
 CL("Fabaceae", [["Leaves", "alternate, compound, with stipules at the base"],
                 ["Fruit", "dry, splitting down both seams"],
                 ["Seeds", "in a single row along one side"]], "Vicia, Lathyrus"),
 CL("Fabaceae", [["Roots", "carrying small nodules"],
                 ["Leaves", "palmately compound, in a hand of leaflets"],
                 ["Flowers", "in a raceme, each with a keel hiding the stamens"]], "Lupinus",
    "The nodules house nitrogen-fixing bacteria."),
 CL("Fabaceae", [["Flowers", "radial, tiny, packed into a fluffy ball"],
                 ["Stamens", "many, long-filamented, doing all the display"],
                 ["Fruit", "a dry pod splitting down both seams"]], "Acacia, Prosopis",
    "The mimosoid side of the family: radial, not butterfly-shaped."),
 CL("Fabaceae", [["Pod", "papery and inflated over the seeds"],
                 ["Leaves", "pinnate, alternate"],
                 ["Corolla", "banner, wings and keel"]], "Astragalus",
    "Astragalus is one of the largest genera in the state."),

 # Brassicaceae
 CL("Brassicaceae", [["Petals", "4, free, set in a cross"],
                     ["Stamens", "6 — four long, two short"],
                     ["Ovary", "superior, 2 carpels with a partition between"]], "Streptanthus, Boechera"),
 CL("Brassicaceae", [["Crushed leaf", "peppery"],
                     ["Inflorescence", "a raceme still lengthening at the tip"],
                     ["On one stem", "buds above, flowers below, fruit below that"]], "Brassica, Hirschfeldia"),
 CL("Brassicaceae", [["Fruit", "long and flat, splitting into 2 valves"],
                     ["Left behind", "a rim with a translucent papery partition"],
                     ["Seeds", "attached to that rim"]], "Caulanthus, Arabis"),
 CL("Brassicaceae", [["Fruit", "flat and round, under 3 times as long as wide"],
                     ["Petals", "4, small, white"],
                     ["Leaves", "alternate, often in a basal rosette"]], "Lepidium, Capsella"),
 CL("Brassicaceae", [["Flower", "radial, 4 sepals and 4 petals alternating"],
                     ["Stamens", "6 in two whorls of unequal length"],
                     ["Fruit", "a dry capsule with a false septum"]], "Draba, Thysanocarpus"),

 # Polygonaceae
 CL("Polygonaceae", [["At each node", "a papery sheath wrapped round the stem"],
                     ["Nodes", "swollen"],
                     ["Flowers", "small, pink, without petals"]], "Persicaria, Polygonum"),
 CL("Polygonaceae", [["Perianth", "6 parts, all alike, no petals as such"],
                     ["Ovary", "superior, 3 carpels but one chamber, one ovule"],
                     ["Fruit", "one seed, three sharp angles"]], "Rumex, Eriogonum"),
 CL("Polygonaceae", [["No sheath", "at the nodes"],
                     ["Instead", "small toothed cups holding clusters of flowers"],
                     ["Habit", "grey subshrub of dry slopes, leaves in bundles"]], "Eriogonum fasciculatum",
    "The wild buckwheats swapped the ocrea for an involucre."),
 CL("Polygonaceae", [["Leaves", "sour to taste"],
                     ["In fruit", "three of the tepals enlarge into wings"],
                     ["Habit", "coarse herb of ditches and damp ground"]], "Rumex"),
 CL("Polygonaceae", [["Habit", "low spiny annual of sand and pavement"],
                     ["Flowers", "in bracted involucres, perianth of 6 tepals"],
                     ["Fruit", "an achene with three angles"]], "Chorizanthe"),

 # Boraginaceae
 CL("Boraginaceae", [["Hairs", "stiff and bristly, rough to the touch"],
                     ["Inflorescence", "coiled like a fiddle head, uncoiling as it opens"],
                     ["Fruit", "4 nutlets in the old calyx"],
                     ["Leaves", "alternate, stem round"]], "Amsinckia, Cryptantha",
    "Four nutlets with alternate leaves and a round stem: not a mint."),
 CL("Boraginaceae", [["Corolla", "5 fused lobes, radial, scales in the throat"],
                     ["Stamens", "5, attached inside the tube"],
                     ["Style", "rising from the base of a 4-lobed ovary"]], "Myosotis, Plagiobothrys"),
 CL("Boraginaceae", [["Buds", "pink; the open flowers blue"],
                     ["Spray", "one-sided and curved"],
                     ["Stem and leaf", "harshly hairy"]], "Phacelia, Echium"),
 CL("Boraginaceae", [["Flowers", "bell-shaped, purple, stamens sticking well out"],
                     ["Spray", "curved, opening from the base"],
                     ["Ovary", "superior, 2 carpels"]], "Phacelia",
    "Phacelia and its allies used to be a family of their own, Hydrophyllaceae."),
 CL("Boraginaceae", [["Shrub", "of chaparral, leaves sticky or felted beneath"],
                     ["Corolla", "5 fused lobes in a tube"],
                     ["Inflorescence", "coiled cymes"]], "Eriodictyon",
    "Yerba santa — a shrubby member of a mostly herbaceous family."),

 # Cyperaceae
 CL("Cyperaceae", [["Stem", "triangular in section, solid, no swollen joints"],
                   ["Leaves", "in 3 ranks, sheaths closed into tubes"],
                   ["Where", "wet meadow, seep, streambank"]], "Carex, Cyperus",
    "Sedges have edges; it will not roll between your fingers."),
 CL("Cyperaceae", [["Each flower", "naked, sitting behind a single scale"],
                   ["Perianth", "absent, or a few bristles"],
                   ["Stamens", "3; stigmas 2 or 3, not feathery"]], "Eleocharis, Schoenoplectus"),
 CL("Cyperaceae", [["Ovary", "sealed inside a small flask"],
                   ["Out of its beak", "the stigmas"],
                   ["Fruit", "a hard one-seeded nut inside that flask"]], "Carex",
    "The flask is a perigynium, and only Carex has one."),
 CL("Cyperaceae", [["Spike", "male flowers at the top, female below"],
                   ["Stem", "3-sided"],
                   ["Fruit", "an achene, often 3-angled"]], "Carex"),
 CL("Cyperaceae", [["Habit", "grass-like, but leafless green stems in shallow water"],
                   ["Inflorescence", "a single terminal spike of scales"],
                   ["Perianth", "reduced to bristles"]], "Eleocharis, Schoenoplectus"),

 # Plantaginaceae
 CL("Plantaginaceae", [["Corolla", "5 fused lobes, 2 above and 3 below"],
                       ["Stamens", "4, in two unequal pairs"],
                       ["Fruit", "a capsule of many small seeds"],
                       ["Stem", "round, no smell"]], "Penstemon, Keckiella",
    "Two lips and four stamens, but a capsule: not a mint."),
 CL("Plantaginaceae", [["Stamens", "4 fertile, plus a fifth making no pollen"],
                       ["That fifth", "often flattened and bearded"],
                       ["Flowers", "tubular, in a one-sided spray"]], "Penstemon",
    "The bearded staminode is what gave Penstemon its common name."),
 CL("Plantaginaceae", [["Ovary", "superior, 2 carpels, seeds on a central column"],
                       ["Corolla", "bilateral, fused"],
                       ["Fruit", "splitting to release many seeds"]], "Collinsia, Antirrhinum"),
 CL("Plantaginaceae", [["Leaves", "in a basal rosette, strongly ribbed"],
                       ["Inflorescence", "a dense spike of small brown flowers"],
                       ["Corolla", "4 papery lobes, stamens sticking out"]], "Plantago",
    "The family's name genus is the odd one out to look at."),
 CL("Plantaginaceae", [["Flowers", "tubular red, on a woody-based stem"],
                       ["Leaves", "opposite, no smell when crushed"],
                       ["Fruit", "a dry capsule, not four nutlets"]], "Keckiella, Penstemon"),

 # Polemoniaceae
 CL("Polemoniaceae", [["Corolla", "a narrow tube flaring abruptly into a flat face"],
                      ["Ovary", "superior, 3 carpels, 3 chambers"],
                      ["Style", "one, with 3 stigma lobes"]], "Gilia, Leptosiphon"),
 CL("Polemoniaceae", [["Stamens", "5, attached in the corolla tube"],
                      ["Fruit", "a capsule splitting into 3, seeds on the axis"],
                      ["Flower", "radial, 5 fused petals"]], "Phlox, Linanthus"),
 CL("Polemoniaceae", [["Habit", "small spring annual of open sand"],
                      ["Leaves", "opposite, cut into thread-fine lobes"],
                      ["Flowers", "in a tight head, corolla tube long and slender"]], "Leptosiphon"),
 CL("Polemoniaceae", [["Leaves", "pinnately compound, leaflets in a ladder"],
                      ["Flowers", "blue, bell-shaped, 5 fused lobes"],
                      ["Ovary", "superior, 3 chambers"]], "Polemonium",
    "Jacob's ladder — the family's name genus."),
 CL("Polemoniaceae", [["Bracts", "spine-tipped, under a head of flowers"],
                      ["Corolla", "5 fused lobes, blue, tube slender"],
                      ["Fruit", "a 3-chambered capsule"]], "Navarretia, Eriastrum",
    "Prickly heads, but a 3-chambered capsule rather than an inferior ovary."),

 # Onagraceae
 CL("Onagraceae", [["Sepals and petals", "4 of each"],
                   ["Stamens", "8"],
                   ["Ovary", "below the flower, swelling as a stalk behind it"]], "Clarkia, Camissonia"),
 CL("Onagraceae", [["Above the ovary", "a slender tube carrying sepals, petals and stamens"],
                   ["Stigma", "in 4 lobes, or a knob"],
                   ["Fruit", "a long capsule splitting into 4"]], "Oenothera, Epilobium"),
 CL("Onagraceae", [["Flowers", "pink or lavender, 4 petals, often fan- or spoon-shaped"],
                   ["Buds", "nodding before they open"],
                   ["Ovary", "inferior, 4-chambered"]], "Clarkia",
    "Clarkia is very nearly a California endemic."),
 CL("Onagraceae", [["Flowers", "large, yellow, opening at dusk"],
                   ["Everything", "in fours"],
                   ["Stigma", "four arms in a cross"]], "Oenothera"),
 CL("Onagraceae", [["Habit", "streamside herb, leaves willow-like"],
                   ["Flowers", "4 petals, ovary inferior and long"],
                   ["Seeds", "each with a tuft of hairs"]], "Epilobium, Chamerion"),

 # the lookalikes -- where a shared character is not enough
 CL("Lookalikes", [["Stem", "square in section"],
                   ["Leaves", "opposite, crushed leaf aromatic"],
                   ["Corolla", "2-lipped; stamens 4 or 2"],
                   ["Fruit", "4 nutlets"]], "Salvia, Monardella",
    "Square stem plus a smell plus nutlets. Any one of the three alone is not enough.",
    family="Lamiaceae", common="mint family"),
 CL("Lookalikes", [["Fruit", "4 nutlets in the old calyx"],
                   ["But leaves", "alternate, and the stem round"],
                   ["And corolla", "radial, not two-lipped"]], "Cryptantha, Amsinckia",
    "Nutlets are shared with the mints; the leaves and the symmetry settle it.",
    family="Boraginaceae", common="borage and waterleaf family"),
 CL("Lookalikes", [["Corolla", "2-lipped, stamens 4 in unequal pairs"],
                   ["But stem", "round, and no smell"],
                   ["Fruit", "a capsule of many seeds"]], "Penstemon, Collinsia",
    "Two lips and four stamens are shared with the mints; the fruit settles it.",
    family="Plantaginaceae", common="plantain family"),
 CL("Lookalikes", [["Inflorescence", "stalks radiating from one point"],
                   ["Each stalk", "ending in a second set of radiating stalks"],
                   ["Stem", "hollow; leaves dissected, sheathing at the base"],
                   ["Fruit", "splitting into 2 dry halves"]], "Daucus, Conium, Heracleum",
    "Not a head: the stalks are visibly separate, and the fruit is a schizocarp.",
    family="Apiaceae", common="carrot family"),
 CL("Lookalikes", [["Grass-like", "and in wet ground"],
                   ["Stem", "triangular and solid"],
                   ["Leaves", "in 3 ranks"]], "Carex, Cyperus",
    "Sedges have edges. Grasses are round and hollow; rushes are round and pithy.",
    family="Cyperaceae", common="sedge family"),
 CL("Lookalikes", [["Grass-like", "and in wet ground"],
                   ["Stem", "round, hollow, with swollen joints"],
                   ["Leaves", "in 2 ranks, with a ligule"]], "Bromus, Poa",
    "Round, hollow and jointed, with a ligule: a grass, not a sedge.",
    family="Poaceae", common="grass family"),
 CL("Lookalikes", [["Many small flowers", "crowded into one dense flat head"],
                   ["Round the head", "a collar of green bracts"],
                   ["Ovary", "inferior, one seed each"]], "Achillea, Eriophyllum",
    "Achillea looks like an umbel from a distance; the involucre and the inferior "
    "one-seeded ovaries say sunflower family.",
    family="Asteraceae", common="sunflower family"),
]

# --------------------------------------------------------------------------
# emit
#
# Deck order is curriculum order -- the scheduler introduces new cards in it --
# so each family arrives as a whole: its checklist, then its flower, then the
# features you need to read one, then the field clues that use them. The
# lookalike cards come last, once there is something to confuse.
# --------------------------------------------------------------------------

COMMON = {f["name"]: f["common"] for f in FAMILIES}
COMMON["Lamiaceae"] = "mint family"
COMMON["Apiaceae"] = "carrot family"

def build():
    cards = []
    groups = [f["name"] for f in FAMILIES] + ["Lookalikes"]
    code_of = {f["name"]: f["code"] for f in FAMILIES}
    code_of["Lookalikes"] = "look"

    floral_by_group, feature_by_group, clue_by_group = {}, {}, {}
    for f in FAMILIES:
        floral_by_group.setdefault(f["name"], []).append(dict(
            group=f["name"], name=f["name"], common=f["common"],
            form=f["form"], diagram=f["diagram"], note=f["note"]))
    for x in FLORAL_EXTRA:
        floral_by_group.setdefault(x["group"], []).append(x)
    for x in FEATURES:
        feature_by_group.setdefault(x["group"], []).append(x)
    for x in CLUES:
        clue_by_group.setdefault(x["group"], []).append(x)

    for gname in groups:
        code = code_of[gname]
        fam = next((f for f in FAMILIES if f["name"] == gname), None)
        if fam:
            cards.append({
                "id": "bot-%s-ck" % code, "type": "checklist", "group": gname,
                "family": fam["name"], "common": fam["common"],
                "place": fam["place"], "rows": fam["check"],
                "genera": fam["genera"],
            })
        for i, x in enumerate(floral_by_group.get(gname, []), 1):
            cards.append({
                "id": "bot-%s-fl-%d" % (code, i), "type": "floral", "group": gname,
                "family": x["name"], "common": x["common"], "form": x["form"],
                "formula": formula_for(x["diagram"]),
                "diagram": clean(x["diagram"]), "note": x["note"],
            })
        for i, x in enumerate(feature_by_group.get(gname, []), 1):
            c = {
                "id": "bot-%s-ft-%d" % (code, i), "type": "feature", "group": gname,
                "term": x["term"], "kind": x["kind"], "description": x["description"],
                "where": x["where"],
            }
            if x["shape"]:
                c["shape"] = x["shape"]
            if x["note"]:
                c["note"] = x["note"]
            cards.append(c)
        for i, x in enumerate(clue_by_group.get(gname, []), 1):
            c = {
                "id": "bot-%s-cl-%d" % (code, i), "type": "idclue", "group": gname,
                "family": x["family"], "common": x["common"] or COMMON[x["family"]],
                "clues": x["rows"], "example": x["example"],
            }
            if x["note"]:
                c["note"] = x["note"]
            cards.append(c)
    return cards


if __name__ == "__main__":
    cards = build()
    OUT.write_text(json.dumps(cards, ensure_ascii=False, indent=1) + "\n")
    by = {}
    for c in cards:
        by[c["type"]] = by.get(c["type"], 0) + 1
    print("wrote %s  %d cards" % (OUT.name, len(cards)))
    print("  by type :", by)
    seen = {}
    for c in cards:
        seen[c["group"]] = seen.get(c["group"], 0) + 1
    print("  by group:", seen)
