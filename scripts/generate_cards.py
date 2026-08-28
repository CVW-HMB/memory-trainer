"""
Generates data/cards.json from the definitions below.
This is the single source of truth for card CONTENT. Edit here (or edit
data/cards.json directly), keep ids stable, and only add cards additively so
saved progress survives. See CLAUDE.md for the schema and the direction rules.
"""
import json, re, os

cards = []

def slug(s):
    s = s.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def gp(g):
    return {"France": "fr", "Italy": "it", "Rest": "rw"}[g]

def p2g(group, grape, country, region, notes):
    cards.append({"id": f"{gp(group)}-t1-{slug(grape)}-{slug(region)}", "group": group,
                  "type": "place2grape", "grape": grape, "country": country,
                  "region": region, "notes": notes})

def decode(group, appellation, grape, country, region, notes, trap=False):
    c = {"id": f"{gp(group)}-t2-{slug(appellation)}", "group": group, "type": "decode",
         "appellation": appellation, "grape": grape, "country": country,
         "region": region, "notes": notes}
    if trap:
        c["trap"] = True
    cards.append(c)

def home(group, grape, home_, also):
    cards.append({"id": f"{gp(group)}-t3-{slug(grape)}", "group": group, "type": "grapehome",
                  "grape": grape, "home": home_, "also": also})

# ===================== FRANCE - grape home (14) =====================
home("France", "Cabernet Sauvignon", "Bordeaux, Left Bank (France)", "Napa, Tuscany (Super Tuscans), Chile, Coonawarra")
home("France", "Merlot", "Bordeaux, Right Bank (France)", "California, northern Italy, Chile")
home("France", "Cabernet Franc", "Loire and Bordeaux blends (France)", "northeast Italy, small plantings worldwide")
home("France", "Pinot Noir", "Burgundy, Cote d'Or (France)", "Oregon, Sonoma, New Zealand, German Spatburgunder")
home("France", "Chardonnay", "Burgundy and Champagne (France)", "California, Australia, planted almost everywhere")
home("France", "Sauvignon Blanc", "Loire and Bordeaux (France)", "New Zealand (Marlborough), California")
home("France", "Syrah", "Northern Rhone (France)", "Australia as Shiraz, Washington State")
home("France", "Grenache", "Southern Rhone (France)", "Spain as Garnacha, Australia, Sardinia")
home("France", "Gamay", "Beaujolais (France)", "rarely taken seriously anywhere else")
home("France", "Chenin Blanc", "Loire (France)", "South Africa, where it is the most-planted grape")
home("France", "Viognier", "Northern Rhone, Condrieu (France)", "California, Australia")
home("France", "Malbec", "Cahors, Southwest France", "Argentina (Mendoza), its modern home")
home("France", "Semillon", "Bordeaux (France)", "Hunter Valley, Australia")
home("France", "Mourvedre", "Provence (Bandol) and Southern Rhone", "Spain as Monastrell, Australia as Mataro")

# ===================== FRANCE - decode (36) =====================
decode("France", "Pauillac", "Cabernet Sauvignon blend", "France", "Bordeaux, Left Bank", "cassis, cedar, graphite, firm tannin")
decode("France", "Margaux", "Cabernet Sauvignon blend", "France", "Bordeaux, Left Bank", "perfumed, violet, silky and elegant")
decode("France", "Saint-Julien", "Cabernet Sauvignon blend", "France", "Bordeaux, Left Bank", "balanced, cedar, cassis, polished")
decode("France", "Saint-Estephe", "Cabernet Sauvignon blend", "France", "Bordeaux, Left Bank", "firm, earthy, sturdy, tannic")
decode("France", "Saint-Emilion", "Merlot with Cabernet Franc", "France", "Bordeaux, Right Bank", "plush plum, supple, warm")
decode("France", "Pomerol", "Merlot", "France", "Bordeaux, Right Bank", "rich, velvety, iron, dark fruit")
decode("France", "Pessac-Leognan", "Cabernet/Merlot; Sauvignon/Semillon", "France", "Bordeaux, Graves", "gravelly smoky reds, oaked whites")
decode("France", "Sauternes", "Semillon, botrytis", "France", "Bordeaux", "honey, apricot, saffron, lusciously sweet")
decode("France", "Chablis", "Chardonnay", "France", "Burgundy, far north", "lean, unoaked, oyster shell, citrus")
decode("France", "Meursault", "Chardonnay", "France", "Burgundy, Cote de Beaune", "hazelnut, butter, oatmeal, oak")
decode("France", "Puligny-Montrachet", "Chardonnay", "France", "Burgundy, Cote de Beaune", "precise, white flower, mineral")
decode("France", "Pouilly-Fuisse", "Chardonnay", "France", "Burgundy, Maconnais", "ripe, rounded, gentle oak")
decode("France", "Gevrey-Chambertin", "Pinot Noir", "France", "Burgundy, Cote de Nuits", "dark cherry, muscular, structured")
decode("France", "Vosne-Romanee", "Pinot Noir", "France", "Burgundy, Cote de Nuits", "spice, silk, exalted perfume")
decode("France", "Pommard", "Pinot Noir", "France", "Burgundy, Cote de Beaune", "firm, sturdy, red plum, earthy")
decode("France", "Morgon", "Gamay", "France", "Beaujolais (cru)", "cherry, earthy, ages surprisingly well")
decode("France", "Champagne", "Chardonnay, Pinot Noir, Meunier", "France", "Champagne", "brioche, green apple, chalk, fine mousse")
decode("France", "Cremant", "traditional-method blend", "France", "Alsace, Loire or Burgundy", "apple, biscuit, value sparkling")
decode("France", "Sancerre", "Sauvignon Blanc", "France", "Loire, upper river", "flint, gooseberry, nettle, high acid")
decode("France", "Pouilly-Fume", "Sauvignon Blanc", "France", "Loire, upper river", "smoky, mineral, citrus")
decode("France", "Vouvray", "Chenin Blanc", "France", "Loire, Touraine", "quince, honey, dry through sweet")
decode("France", "Chinon", "Cabernet Franc", "France", "Loire, Touraine", "red currant, graphite, leafy")
decode("France", "Muscadet", "Melon de Bourgogne", "France", "Loire, Atlantic coast", "saline, lean, lees, seashell")
decode("France", "Cote-Rotie", "Syrah with a little Viognier", "France", "Northern Rhone", "olive, black pepper, perfumed")
decode("France", "Hermitage", "Syrah", "France", "Northern Rhone", "powerful, tar, smoked meat, age-worthy")
decode("France", "Crozes-Hermitage", "Syrah", "France", "Northern Rhone", "peppery, red fruit, everyday value")
decode("France", "Condrieu", "Viognier", "France", "Northern Rhone", "apricot, honeysuckle, full and floral")
decode("France", "Chateauneuf-du-Pape", "Grenache-based GSM", "France", "Southern Rhone", "kirsch, garrigue, warm spice")
decode("France", "Gigondas", "Grenache-based GSM", "France", "Southern Rhone", "robust, peppery, dark berry")
decode("France", "Alsace Riesling", "Riesling", "France", "Alsace", "dry, lime, petrol, racy acid")
decode("France", "Alsace Gewurztraminer", "Gewurztraminer", "France", "Alsace", "lychee, rose, exotic spice")
decode("France", "Alsace Pinot Gris", "Pinot Gris", "France", "Alsace", "smoky, honeyed, rich texture")
decode("France", "Cotes de Provence Rose", "Grenache and Cinsault", "France", "Provence", "pale, dry, strawberry, crisp")
decode("France", "Bandol", "Mourvedre", "France", "Provence", "leather, blackberry, game, tannic")
decode("France", "Picpoul de Pinet", "Picpoul", "France", "Languedoc", "zesty, lemon, seaside white")
decode("France", "Cahors", "Malbec", "France", "Southwest France", "inky, black plum, rustic tannin")

# ===================== FRANCE - place to grape (20) =====================
p2g("France", "Cabernet Sauvignon", "France", "Bordeaux, Left Bank (gravel soils)", "cassis, cedar, graphite, firm tannin")
p2g("France", "Merlot", "France", "Bordeaux, Right Bank (clay soils)", "plush plum, cocoa, supple")
p2g("France", "Sauvignon Blanc", "France", "Loire, upper river", "flint, gooseberry, nettle, high acid")
p2g("France", "Chenin Blanc", "France", "Loire, Touraine", "quince, wet wool, honey, high acid")
p2g("France", "Cabernet Franc", "France", "Loire, Touraine (reds)", "red currant, pencil shaving, leaf")
p2g("France", "Melon de Bourgogne", "France", "Loire, Atlantic coast", "saline, green apple, lees")
p2g("France", "Chardonnay", "France", "Burgundy, far north (Chablis)", "lean, oyster shell, lemon, no oak")
p2g("France", "Chardonnay", "France", "Burgundy, Cote de Beaune", "hazelnut, butter, toast, oak")
p2g("France", "Pinot Noir", "France", "Burgundy, Cote d'Or", "red cherry, rose, forest floor, silky")
p2g("France", "Gamay", "France", "Beaujolais", "cherry, banana, violet, light tannin")
p2g("France", "Syrah", "France", "Northern Rhone", "black pepper, smoked meat, violet")
p2g("France", "Viognier", "France", "Northern Rhone", "apricot, peach, honeysuckle, full")
p2g("France", "Grenache", "France", "Southern Rhone", "kirsch, dried herb, warm spice")
p2g("France", "Riesling", "France", "Alsace", "lime, petrol, racy, bone dry")
p2g("France", "Gewurztraminer", "France", "Alsace", "lychee, rose petal, exotic spice")
p2g("France", "Pinot Gris", "France", "Alsace", "smoky, honeyed, rich texture")
p2g("France", "Mourvedre", "France", "Provence, Bandol", "leather, blackberry, game, tannic")
p2g("France", "Malbec", "France", "Southwest, Cahors", "inky, black plum, rustic")
p2g("France", "Semillon", "France", "Bordeaux, Sauternes", "honey, apricot, botrytis, sweet")
p2g("France", "Grenache and Cinsault", "France", "Provence", "pale rose, strawberry, dry, crisp")

# ===================== ITALY (18) =====================
home("Italy", "Sangiovese", "Tuscany (Chianti, Brunello)", "also Romagna in central Italy")
home("Italy", "Nebbiolo", "Piedmont (Barolo, Barbaresco)", "rarely successful outside Piedmont")
home("Italy", "Pinot Grigio", "Northeast Italy (Friuli, Alto Adige)", "France's Pinot Gris is the same grape")
home("Italy", "Barbera", "Piedmont", "small plantings in California and Argentina")
decode("Italy", "Chianti Classico", "Sangiovese", "Italy", "Tuscany", "tart cherry, dried herb, high acid")
decode("Italy", "Brunello di Montalcino", "Sangiovese", "Italy", "Tuscany", "powerful, leather, plum, age-worthy")
decode("Italy", "Barolo", "Nebbiolo", "Italy", "Piedmont", "tar, rose, dried cherry, huge tannin")
decode("Italy", "Barbaresco", "Nebbiolo", "Italy", "Piedmont", "perfumed, elegant, firm tannin")
decode("Italy", "Barbera d'Alba", "Barbera", "Italy", "Piedmont", "juicy, sour cherry, high acid, low tannin")
decode("Italy", "Amarone della Valpolicella", "Corvina, dried grapes", "Italy", "Veneto", "raisin, fig, cherry, high alcohol")
decode("Italy", "Prosecco", "Glera", "Italy", "Veneto", "pear, white flower, frothy, off-dry")
decode("Italy", "Moscato d'Asti", "Moscato", "Italy", "Piedmont", "sweet, grapey, low alcohol, gently fizzy")
decode("Italy", "Montepulciano d'Abruzzo", "Montepulciano (the grape)", "Italy", "Abruzzo", "juicy, black cherry, soft; NOT the Tuscan town", trap=True)
decode("Italy", "Vino Nobile di Montepulciano", "Sangiovese", "Italy", "Tuscany", "a town in Tuscany, NOT the Montepulciano grape", trap=True)
p2g("Italy", "Sangiovese", "Italy", "Tuscany", "tart cherry, dried herb, tomato leaf, high acid")
p2g("Italy", "Nebbiolo", "Italy", "Piedmont", "tar, rose, dried cherry, huge tannin and acid")
p2g("Italy", "Corvina", "Italy", "Veneto (dried-grape Amarone)", "raisin, fig, cherry, high alcohol")
p2g("Italy", "Pinot Grigio", "Italy", "Friuli / Alto Adige", "pear, green apple, light and crisp")

# ===================== REST OF WORLD (12) =====================
home("Rest", "Tempranillo", "Rioja and Ribera del Duero (Spain)", "Portugal, where it is called Tinta Roriz")
home("Rest", "Riesling", "Germany (Mosel, Rheingau) and Alsace", "Austria, Australia (Clare and Eden), Washington")
home("Rest", "Albarino", "Rias Baixas (Spain, Galicia)", "Portugal as Alvarinho in Vinho Verde")
decode("Rest", "Rioja", "Tempranillo", "Spain", "Rioja", "dried strawberry, vanilla, dill oak, leather")
decode("Rest", "Ribera del Duero", "Tempranillo", "Spain", "Castilla y Leon", "darker, structured, black plum")
decode("Rest", "Rias Baixas", "Albarino", "Spain", "Galicia", "saline, peach, citrus, crisp")
decode("Rest", "Mosel Riesling", "Riesling", "Germany", "Mosel", "off-dry, lime, green apple, slate, low alcohol")
decode("Rest", "Napa Valley Cabernet", "Cabernet Sauvignon", "USA", "Napa, California", "ripe, bold cassis, sweet oak")
decode("Rest", "Marlborough Sauvignon Blanc", "Sauvignon Blanc", "New Zealand", "Marlborough", "passionfruit, grass, zesty and pungent")
decode("Rest", "Mendoza Malbec", "Malbec", "Argentina", "Mendoza", "plush blackberry, violet, soft")
decode("Rest", "Barossa Shiraz", "Shiraz (Syrah)", "Australia", "Barossa Valley", "jammy, bold, sweet spice, full")
decode("Rest", "Port", "Touriga Nacional blend", "Portugal", "Douro", "fortified, sweet, dark, spirity")

# ---- validate + write ----
ids = [c["id"] for c in cards]
dupes = [i for i in ids if ids.count(i) > 1]
assert not dupes, "duplicate ids: " + str(sorted(set(dupes)))
from collections import Counter
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(here, "data", "cards.json")
json.dump(cards, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("TOTAL", len(cards))
print("group", dict(Counter(c["group"] for c in cards)))
print("type ", dict(Counter(c["type"] for c in cards)))
print("France pct", round(sum(1 for c in cards if c["group"] == "France") / len(cards) * 100), "%")
