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

# The grapehome type is retired. Its front was a grape ("where's it grown?"),
# which breaks the deck's rule that a prompt is always a place or a label -- and
# it was the ambiguous direction anyway: the answers themselves listed four or
# five regions. The calls below are kept commented out so the content is not
# lost if the type is ever wanted back.
def home(group, grape, home_, also):
    cards.append({"id": f"{gp(group)}-t3-{slug(grape)}", "group": group, "type": "grapehome",
                  "grape": grape, "home": home_, "also": also})

# ===================== FRANCE - grape home (14) =====================
# home("France", "Cabernet Sauvignon", "Bordeaux, Left Bank (France)", "Napa, Tuscany (Super Tuscans), Chile, Coonawarra")
# home("France", "Merlot", "Bordeaux, Right Bank (France)", "California, northern Italy, Chile")
# home("France", "Cabernet Franc", "Loire and Bordeaux blends (France)", "northeast Italy, small plantings worldwide")
# home("France", "Pinot Noir", "Burgundy, Cote d'Or (France)", "Oregon, Sonoma, New Zealand, German Spatburgunder")
# home("France", "Chardonnay", "Burgundy and Champagne (France)", "California, Australia, planted almost everywhere")
# home("France", "Sauvignon Blanc", "Loire and Bordeaux (France)", "New Zealand (Marlborough), California")
# home("France", "Syrah", "Northern Rhone (France)", "Australia as Shiraz, Washington State")
# home("France", "Grenache", "Southern Rhone (France)", "Spain as Garnacha, Australia, Sardinia")
# home("France", "Gamay", "Beaujolais (France)", "rarely taken seriously anywhere else")
# home("France", "Chenin Blanc", "Loire (France)", "South Africa, where it is the most-planted grape")
# home("France", "Viognier", "Northern Rhone, Condrieu (France)", "California, Australia")
# home("France", "Malbec", "Cahors, Southwest France", "Argentina (Mendoza), its modern home")
# home("France", "Semillon", "Bordeaux (France)", "Hunter Valley, Australia")
# home("France", "Mourvedre", "Provence (Bandol) and Southern Rhone", "Spain as Monastrell, Australia as Mataro")

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
# home("Italy", "Sangiovese", "Tuscany (Chianti, Brunello)", "also Romagna in central Italy")
# home("Italy", "Nebbiolo", "Piedmont (Barolo, Barbaresco)", "rarely successful outside Piedmont")
# home("Italy", "Pinot Grigio", "Northeast Italy (Friuli, Alto Adige)", "France's Pinot Gris is the same grape")
# home("Italy", "Barbera", "Piedmont", "small plantings in California and Argentina")
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
# home("Rest", "Tempranillo", "Rioja and Ribera del Duero (Spain)", "Portugal, where it is called Tinta Roriz")
# home("Rest", "Riesling", "Germany (Mosel, Rheingau) and Alsace", "Austria, Australia (Clare and Eden), Washington")
# home("Rest", "Albarino", "Rias Baixas (Spain, Galicia)", "Portugal as Alvarinho in Vinho Verde")
decode("Rest", "Rioja", "Tempranillo", "Spain", "Rioja", "dried strawberry, vanilla, dill oak, leather")
decode("Rest", "Ribera del Duero", "Tempranillo", "Spain", "Castilla y Leon", "darker, structured, black plum")
decode("Rest", "Rias Baixas", "Albarino", "Spain", "Galicia", "saline, peach, citrus, crisp")
decode("Rest", "Mosel Riesling", "Riesling", "Germany", "Mosel", "off-dry, lime, green apple, slate, low alcohol")
decode("Rest", "Napa Valley Cabernet", "Cabernet Sauvignon", "USA", "Napa, California", "ripe, bold cassis, sweet oak")
decode("Rest", "Marlborough Sauvignon Blanc", "Sauvignon Blanc", "New Zealand", "Marlborough", "passionfruit, grass, zesty and pungent")
decode("Rest", "Mendoza Malbec", "Malbec", "Argentina", "Mendoza", "plush blackberry, violet, soft")
decode("Rest", "Barossa Shiraz", "Shiraz (Syrah)", "Australia", "Barossa Valley", "jammy, bold, sweet spice, full")
decode("Rest", "Port", "Touriga Nacional blend", "Portugal", "Douro", "fortified, sweet, dark, spirity")


# =====================================================================
# Expansion pass toward ~200 cards. Same bar as above: France first, and
# nothing you would not plausibly meet on a US restaurant list.
# =====================================================================

# ===================== FRANCE - grape home (+7) =====================
# home("France", "Melon de Bourgogne", "Loire, Pays Nantais (France)", "essentially nowhere else; it is the Muscadet grape")
# home("France", "Pinot Meunier", "Champagne (France)", "England, and small German plantings")
# home("France", "Petit Verdot", "Bordeaux, Left Bank blends (France)", "Napa, Australia and Spain as a varietal")
# home("France", "Marsanne", "Northern Rhone (France)", "Victoria in Australia, California")
# home("France", "Roussanne", "Northern Rhone (France)", "Southern Rhone white blends, California")
# home("France", "Aligote", "Burgundy, the other white (France)", "small plantings across Eastern Europe")
# home("France", "Tannat", "Madiran, Southwest France", "Uruguay, where it is the national grape")

# ===================== FRANCE - decode (+38) =====================
# Bordeaux
decode("France", "Haut-Medoc", "Cabernet Sauvignon blend", "France", "Bordeaux, Haut-Medoc", "everyday claret, blackcurrant, cedar, firm")
decode("France", "Medoc", "Cabernet Sauvignon blend", "France", "Bordeaux, Medoc (northern tip)", "leaner, earthy, brisk, less polished")
decode("France", "Graves", "red blend; also dry white blend", "France", "Bordeaux, Graves (wider appellation)", "gravelly, smoky reds and dry whites")
decode("France", "Entre-Deux-Mers", "Sauvignon Blanc blend", "France", "Bordeaux, between the rivers", "crisp, dry, grapefruit, inexpensive")
decode("France", "Barsac", "Semillon, botrytis", "France", "Bordeaux, Barsac", "sweet, honeyed, a touch fresher than its neighbour")
# Burgundy
decode("France", "Bourgogne Rouge", "Pinot Noir", "France", "Burgundy, regional", "light cherry, everyday red, no oak to speak of")
decode("France", "Chassagne-Montrachet", "Chardonnay", "France", "Burgundy, Cote de Beaune", "citrus, hazelnut, saline finish")
decode("France", "Volnay", "Pinot Noir", "France", "Burgundy, Cote de Beaune", "delicate, violet, red berry, silky")
decode("France", "Nuits-Saint-Georges", "Pinot Noir", "France", "Burgundy, Cote de Nuits", "earthy, dark berry, sturdy")
decode("France", "Chambolle-Musigny", "Pinot Noir", "France", "Burgundy, Cote de Nuits", "perfumed, lacy, delicate red fruit")
decode("France", "Corton-Charlemagne", "Chardonnay", "France", "Burgundy, Cote de Beaune (grand cru)", "powerful, mineral, long-lived white")
decode("France", "Saint-Veran", "Chardonnay", "France", "Burgundy, Maconnais", "bright orchard fruit, gentle, good value")
decode("France", "Macon-Villages", "Chardonnay", "France", "Burgundy, Maconnais (villages)", "easy, apple, unoaked, inexpensive")
# Beaujolais
decode("France", "Fleurie", "Gamay", "France", "Beaujolais (cru)", "floral, silky, light red berry")
decode("France", "Moulin-a-Vent", "Gamay", "France", "Beaujolais (cru)", "structured, dark fruit, the firmest of the crus")
decode("France", "Brouilly", "Gamay", "France", "Beaujolais (cru, largest)", "juicy, bright, easy drinking")
# Loire
decode("France", "Savennieres", "Chenin Blanc", "France", "Loire, Anjou (schist)", "dry, austere, waxy, quince")
decode("France", "Bourgueil", "Cabernet Franc", "France", "Loire, Touraine (Bourgueil)", "raspberry, gravel, brisk")
decode("France", "Saumur-Champigny", "Cabernet Franc", "France", "Loire, Anjou-Saumur", "crunchy red fruit, light, worth chilling")
decode("France", "Coteaux du Layon", "Chenin Blanc, botrytis", "France", "Loire, Anjou (Layon valley)", "sweet, honeyed, quince, bracing acid")
decode("France", "Montlouis-sur-Loire", "Chenin Blanc", "France", "Loire, Touraine (Montlouis)", "dry to sparkling, orchard fruit, chalk")
# Rhone
decode("France", "Saint-Joseph", "Syrah", "France", "Northern Rhone (Saint-Joseph)", "peppery, red fruit, medium-bodied")
decode("France", "Cornas", "Syrah", "France", "Northern Rhone (Cornas, granite)", "dark, savoury, brooding, tannic")
decode("France", "Vacqueyras", "Grenache-based GSM", "France", "Southern Rhone (Vacqueyras)", "spicy, warm, dark berry")
decode("France", "Cotes du Rhone", "Grenache-based blend", "France", "Southern Rhone (regional)", "everyday red, red fruit, dried herb")
decode("France", "Tavel", "Grenache-based rose", "France", "Southern Rhone (Tavel)", "deep-coloured dry rose, structured, food wine")
decode("France", "Saint-Peray", "Marsanne and Roussanne", "France", "Northern Rhone (Saint-Peray)", "still and sparkling white, nutty, full")
decode("France", "Muscat de Beaumes-de-Venise", "Muscat", "France", "Southern Rhone (Beaumes-de-Venise)", "fortified sweet, orange blossom, grapey")
# Alsace and Champagne
decode("France", "Cremant d'Alsace", "Pinot Blanc-led blend", "France", "Alsace (sparkling)", "dry sparkling, apple, fine bubble, value")
decode("France", "Alsace Pinot Blanc", "Pinot Blanc", "France", "Alsace (everyday white)", "soft, pear, gentle, unshowy")
decode("France", "Blanc de Blancs Champagne", "Chardonnay only", "France", "Champagne (white grapes only)", "chalk, citrus, taut and fine")
decode("France", "Rose Champagne", "Pinot Noir and Chardonnay", "France", "Champagne (rose)", "red-berry tinged, dry, fine mousse")
# Languedoc and Roussillon
decode("France", "Corbieres", "Carignan-based blend", "France", "Languedoc (Corbieres)", "rustic, garrigue, dark berry, warm")
decode("France", "Minervois", "Syrah and Grenache blend", "France", "Languedoc (Minervois)", "warm, peppery, herbal")
decode("France", "Blanquette de Limoux", "Mauzac", "France", "Languedoc (Limoux)", "apple, sparkling, made before Champagne was")
decode("France", "Banyuls", "Grenache, fortified", "France", "Roussillon (Banyuls)", "sweet fortified red, cocoa, dried fig")
# Provence and Southwest
decode("France", "Cassis", "Marsanne and Clairette blend", "France", "Provence (Cassis)", "a saline seaside white; NOT the blackcurrant note", trap=True)
decode("France", "Madiran", "Tannat", "France", "Southwest France (Madiran)", "dense, dark, gripping, built to age")

# ===================== FRANCE - place to grape (+25) =====================
p2g("France", "Petit Verdot", "France", "Bordeaux, Left Bank (blending grape)", "inky, violet, late-ripening, used in small doses")
p2g("France", "Sauvignon Blanc", "France", "Bordeaux, Entre-Deux-Mers", "crisp, dry, grapefruit, inexpensive")
p2g("France", "Semillon", "France", "Bordeaux, dry white blends (Graves)", "waxy, lanolin, rounds out a blend")
p2g("France", "Chardonnay", "France", "Burgundy, Maconnais", "ripe apple, soft, gently rounded")
p2g("France", "Chardonnay", "France", "Burgundy, Cote Chalonnaise", "brisk, lemon, lighter and cheaper")
p2g("France", "Pinot Noir", "France", "Burgundy, Cote Chalonnaise", "light red fruit, earthy, good value")
p2g("France", "Aligote", "France", "Burgundy, the other white", "sharp, lemon, lean, traditionally mixed with cassis")
p2g("France", "Chardonnay", "France", "Champagne (chalk soils)", "green apple, chalk, high acid, picked for sparkling")
p2g("France", "Pinot Noir", "France", "Champagne (for the blend)", "red apple, gives body and structure to sparkling")
p2g("France", "Pinot Meunier", "France", "Champagne, Marne Valley", "soft, fruity, the early-drinking third of the blend")
p2g("France", "Gamay", "France", "Beaujolais crus (granite soils)", "firmer, darker, ages a decade")
p2g("France", "Chenin Blanc", "France", "Loire, Anjou (schist)", "dry, austere, waxy, quince")
p2g("France", "Chenin Blanc", "France", "Loire, Vouvray (sweet styles)", "honey, quince, botrytis, sweet")
p2g("France", "Cabernet Franc", "France", "Loire, Anjou-Saumur", "crunchy raspberry, light, worth chilling")
p2g("France", "Syrah", "France", "Northern Rhone, Cornas (granite)", "dark, savoury, brooding, tannic")
p2g("France", "Marsanne", "France", "Northern Rhone (white blends)", "waxy, almond, low acid, full-bodied")
p2g("France", "Grenache", "France", "Southern Rhone, Chateauneuf-du-Pape (galets)", "kirsch, garrigue, warm, high alcohol")
p2g("France", "Grenache", "France", "Roussillon (fortified sweet reds)", "sweet fortified, cocoa, dried fig")
p2g("France", "Cinsault", "France", "Provence and Languedoc (for rose)", "pale, light, soft, a rose backbone")
p2g("France", "Carignan", "France", "Languedoc (old vines)", "rustic, dark, brambly, high acid")
p2g("France", "Picpoul", "France", "Languedoc, Pinet (coastal)", "zesty lemon, saline, a seafood white")
p2g("France", "Mauzac", "France", "Languedoc, Limoux", "apple skin, sparkling, an old tradition")
p2g("France", "Tannat", "France", "Southwest, Madiran", "dense, dark, gripping, built to age")
p2g("France", "Pinot Blanc", "France", "Alsace (everyday white)", "soft, pear, gentle, unshowy")
p2g("France", "Muscat", "France", "Alsace (dry style)", "grapey, floral, dry despite the perfume")

# ===================== ITALY (+18) =====================
# home("Italy", "Aglianico", "Campania and Basilicata (southern Italy)", "almost nowhere outside southern Italy")
# home("Italy", "Montepulciano", "Abruzzo, central-east Italy", "the Marche as Rosso Conero; it is a grape, not the Tuscan town")
# home("Italy", "Verdicchio", "The Marche, central-east Italy", "rarely planted outside Italy")
# home("Italy", "Vermentino", "Sardinia and the Ligurian coast", "Corsica, and Provence where it is called Rolle")
# home("Italy", "Garganega", "Soave, Veneto", "little planted anywhere else")
# home("Italy", "Cortese", "Gavi, Piedmont", "essentially a Piedmont speciality")
# home("Italy", "Primitivo", "Puglia, the heel of Italy", "California, where the same grape is Zinfandel")
decode("Italy", "Soave", "Garganega", "Italy", "Veneto", "almond, lemon, light and dry")
decode("Italy", "Gavi", "Cortese", "Italy", "Piedmont", "crisp, green apple, mineral white")
decode("Italy", "Valpolicella", "Corvina blend", "Italy", "Veneto (Valpolicella)", "light, sour cherry, easy red")
decode("Italy", "Valpolicella Ripasso", "Corvina re-passed on Amarone skins", "Italy", "Veneto (Ripasso)", "richer, raisined edge, mid-weight")
decode("Italy", "Dolcetto d'Alba", "Dolcetto", "Italy", "Piedmont (Alba)", "soft, dark plum, low acid, almond finish")
decode("Italy", "Etna Rosso", "Nerello Mascalese", "Italy", "Sicily (volcanic slopes)", "pale, red cherry, ash, high acid")
decode("Italy", "Vernaccia di San Gimignano", "Vernaccia", "Italy", "Tuscany (San Gimignano)", "dry white, almond, brisk")
decode("Italy", "Bolgheri", "Cabernet and Merlot, a Super Tuscan", "Italy", "Tuscany, coastal", "polished, dark fruit, Bordeaux transplanted")
p2g("Italy", "Aglianico", "Italy", "Campania and Basilicata (volcanic south)", "dark, tannic, smoky, high acid")
p2g("Italy", "Verdicchio", "Italy", "The Marche (Adriatic coast)", "lemon, almond, saline finish")
p2g("Italy", "Primitivo", "Italy", "Puglia, the heel", "jammy, ripe, soft, high alcohol")

# ===================== REST OF WORLD (+12) =====================
# home("Rest", "Zinfandel", "California (USA)", "southern Italy as Primitivo, its genetic twin")
# home("Rest", "Gruner Veltliner", "Austria (Wachau, Kamptal)", "small plantings in New Zealand and the US")
# home("Rest", "Carmenere", "Chile", "originally a Bordeaux grape, long lost there")
# home("Rest", "Touriga Nacional", "Douro, Portugal", "small amounts in Australia and South Africa")
decode("Rest", "Rueda", "Verdejo", "Spain", "Rueda", "crisp, fennel, grapefruit, dry white")
decode("Rest", "Priorat", "Garnacha and Carinena", "Spain", "Catalonia (slate terraces)", "concentrated, mineral, powerful")
decode("Rest", "Cava", "Macabeo, Xarel-lo, Parellada", "Spain", "Penedes, Catalonia", "traditional-method sparkling, apple, value")
decode("Rest", "Vinho Verde", "Loureiro and Alvarinho", "Portugal", "Minho", "light, spritzy, low alcohol, tart")
decode("Rest", "Willamette Valley Pinot Noir", "Pinot Noir", "USA", "Oregon", "red cherry, earth, cool-climate elegance")
decode("Rest", "Fino Sherry", "Palomino", "Spain", "Jerez", "bone dry, saline, aged under flor, fortified")
p2g("Rest", "Gruner Veltliner", "Austria", "Wachau (Danube terraces)", "white pepper, lentil, citrus, dry")
p2g("Rest", "Carmenere", "Chile", "Central Valley", "green peppercorn, dark plum, herbal")

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
