"""
Generates data/french.json.

Same shape as the Mexican Spanish deck (see CLAUDE.md):
  - Every card is REVERSIBLE; validate-cards.mjs enforces that no two cards
    share either face.
  - Each face is written entirely in one language, pronouns and category label
    included.
  - Conjugation cards always carry the WHOLE table, never a single form.

French keeps `vous`, so the tables have six rows where the Mexican Spanish ones
have five. The past tense is the passé composé, which is the one people actually
speak; the passé simple is literary and deliberately excluded.

Ids are prefixed `fra-` rather than `fr-` so they are not confused at a glance
with the wine deck's French cards, which use `fr-t1-`/`fr-t2-`.

Run: npm run cards:fr
"""
import json, os, re, unicodedata

cards = []

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

GROUPS = {
    "Verbs":    ("Verbes", "Verbs"),
    "House":    ("À la maison", "Around the house"),
    "Town":     ("En ville", "Around town"),
    "Table":    ("Manger et boire", "Eating and drinking"),
    "Everyday": ("Tous les jours", "Everyday"),
}

PRON_FR = ["je", "tu", "il / elle / on", "nous", "vous", "ils / elles"]
PRON_EN = ["I", "you", "he / she / one", "we", "you (plural)", "they"]

TENSES = [("Présent", "Present"), ("Passé composé", "Simple past"), ("Futur simple", "Future")]


def vocab(group, fr, en):
    gfr, gen = GROUPS[group]
    cards.append({"id": f"fra-v-{slug(fr)}", "group": group, "type": "vocab",
                  "lang": "fr", "term": fr, "gloss": en,
                  "kindTerm": gfr, "kindGloss": gen})


def pres(base, third=None):
    return [base, base, third or (base + "s"), base, base, base]


def same(form):
    return [form] * 6


def verb(infinitive, english, fr_forms, en_forms):
    vocab("Verbs", infinitive, english)
    for tfr, ten in TENSES:
        cards.append({
            "id": f"fra-c-{slug(infinitive)}-{slug(tfr)}",
            "group": "Verbs", "type": "conjugation",
            "lang": "fr", "verb": infinitive, "english": english,
            "tense": tfr, "tenseEn": ten,
            "kindTerm": GROUPS["Verbs"][0], "kindGloss": GROUPS["Verbs"][1],
            "forms": [[p, f] for p, f in zip(PRON_FR, fr_forms[tfr])],
            "formsEn": [[p, f] for p, f in zip(PRON_EN, en_forms[tfr])],
        })


def T(present, past, future):
    return {"Présent": present, "Passé composé": past, "Futur simple": future}


def Te(present, past, future):
    return {"Présent": present, "Passé composé": past, "Futur simple": future}


# ===================== the 15 most common verbs =====================
verb("être", "to be",
     T(["suis", "es", "est", "sommes", "êtes", "sont"],
       ["ai été", "as été", "a été", "avons été", "avez été", "ont été"],
       ["serai", "seras", "sera", "serons", "serez", "seront"]),
     Te(["am", "are", "is", "are", "are", "are"], same("was"), same("will be")))

verb("avoir", "to have",
     T(["ai", "as", "a", "avons", "avez", "ont"],
       ["ai eu", "as eu", "a eu", "avons eu", "avez eu", "ont eu"],
       ["aurai", "auras", "aura", "aurons", "aurez", "auront"]),
     Te(pres("have", "has"), same("had"), same("will have")))

verb("faire", "to do, to make",
     T(["fais", "fais", "fait", "faisons", "faites", "font"],
       ["ai fait", "as fait", "a fait", "avons fait", "avez fait", "ont fait"],
       ["ferai", "feras", "fera", "ferons", "ferez", "feront"]),
     Te(pres("do", "does"), same("did"), same("will do")))

verb("aller", "to go",
     T(["vais", "vas", "va", "allons", "allez", "vont"],
       ["suis allé(e)", "es allé(e)", "est allé(e)", "sommes allés", "êtes allés", "sont allés"],
       ["irai", "iras", "ira", "irons", "irez", "iront"]),
     Te(pres("go", "goes"), same("went"), same("will go")))

verb("pouvoir", "to be able to, can",
     T(["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"],
       ["ai pu", "as pu", "a pu", "avons pu", "avez pu", "ont pu"],
       ["pourrai", "pourras", "pourra", "pourrons", "pourrez", "pourront"]),
     Te(same("can"), same("could"), same("will be able to")))

verb("vouloir", "to want",
     T(["veux", "veux", "veut", "voulons", "voulez", "veulent"],
       ["ai voulu", "as voulu", "a voulu", "avons voulu", "avez voulu", "ont voulu"],
       ["voudrai", "voudras", "voudra", "voudrons", "voudrez", "voudront"]),
     Te(pres("want"), same("wanted"), same("will want")))

verb("dire", "to say",
     T(["dis", "dis", "dit", "disons", "dites", "disent"],
       ["ai dit", "as dit", "a dit", "avons dit", "avez dit", "ont dit"],
       ["dirai", "diras", "dira", "dirons", "direz", "diront"]),
     Te(pres("say"), same("said"), same("will say")))

verb("voir", "to see",
     T(["vois", "vois", "voit", "voyons", "voyez", "voient"],
       ["ai vu", "as vu", "a vu", "avons vu", "avez vu", "ont vu"],
       ["verrai", "verras", "verra", "verrons", "verrez", "verront"]),
     Te(pres("see"), same("saw"), same("will see")))

verb("savoir", "to know (a fact)",
     T(["sais", "sais", "sait", "savons", "savez", "savent"],
       ["ai su", "as su", "a su", "avons su", "avez su", "ont su"],
       ["saurai", "sauras", "saura", "saurons", "saurez", "sauront"]),
     Te(pres("know"), same("knew"), same("will know")))

verb("venir", "to come",
     T(["viens", "viens", "vient", "venons", "venez", "viennent"],
       ["suis venu(e)", "es venu(e)", "est venu(e)", "sommes venus", "êtes venus", "sont venus"],
       ["viendrai", "viendras", "viendra", "viendrons", "viendrez", "viendront"]),
     Te(pres("come"), same("came"), same("will come")))

verb("devoir", "to have to, must",
     T(["dois", "dois", "doit", "devons", "devez", "doivent"],
       ["ai dû", "as dû", "a dû", "avons dû", "avez dû", "ont dû"],
       ["devrai", "devras", "devra", "devrons", "devrez", "devront"]),
     Te(same("must"), same("had to"), same("will have to")))

verb("prendre", "to take",
     T(["prends", "prends", "prend", "prenons", "prenez", "prennent"],
       ["ai pris", "as pris", "a pris", "avons pris", "avez pris", "ont pris"],
       ["prendrai", "prendras", "prendra", "prendrons", "prendrez", "prendront"]),
     Te(pres("take"), same("took"), same("will take")))

verb("mettre", "to put",
     T(["mets", "mets", "met", "mettons", "mettez", "mettent"],
       ["ai mis", "as mis", "a mis", "avons mis", "avez mis", "ont mis"],
       ["mettrai", "mettras", "mettra", "mettrons", "mettrez", "mettront"]),
     Te(pres("put"), same("put"), same("will put")))

verb("parler", "to speak",
     T(["parle", "parles", "parle", "parlons", "parlez", "parlent"],
       ["ai parlé", "as parlé", "a parlé", "avons parlé", "avez parlé", "ont parlé"],
       ["parlerai", "parleras", "parlera", "parlerons", "parlerez", "parleront"]),
     Te(pres("speak"), same("spoke"), same("will speak")))

verb("donner", "to give",
     T(["donne", "donnes", "donne", "donnons", "donnez", "donnent"],
       ["ai donné", "as donné", "a donné", "avons donné", "avez donné", "ont donné"],
       ["donnerai", "donneras", "donnera", "donnerons", "donnerez", "donneront"]),
     Te(pres("give"), same("gave"), same("will give")))

# ===================== the 15 most common reflexive verbs =====================
# Reflexives take être in the passé composé, hence the agreement markers.
verb("s'appeler", "to be called",
     T(["m'appelle", "t'appelles", "s'appelle", "nous appelons", "vous appelez", "s'appellent"],
       ["me suis appelé(e)", "t'es appelé(e)", "s'est appelé(e)", "nous sommes appelés", "vous êtes appelés", "se sont appelés"],
       ["m'appellerai", "t'appelleras", "s'appellera", "nous appellerons", "vous appellerez", "s'appelleront"]),
     Te(["am called", "are called", "is called", "are called", "are called", "are called"],
        same("was called"), same("will be called")))

verb("se lever", "to get up",
     T(["me lève", "te lèves", "se lève", "nous levons", "vous levez", "se lèvent"],
       ["me suis levé(e)", "t'es levé(e)", "s'est levé(e)", "nous sommes levés", "vous êtes levés", "se sont levés"],
       ["me lèverai", "te lèveras", "se lèvera", "nous lèverons", "vous lèverez", "se lèveront"]),
     Te(pres("get up", "gets up"), same("got up"), same("will get up")))

verb("se réveiller", "to wake up",
     T(["me réveille", "te réveilles", "se réveille", "nous réveillons", "vous réveillez", "se réveillent"],
       ["me suis réveillé(e)", "t'es réveillé(e)", "s'est réveillé(e)", "nous sommes réveillés", "vous êtes réveillés", "se sont réveillés"],
       ["me réveillerai", "te réveilleras", "se réveillera", "nous réveillerons", "vous réveillerez", "se réveilleront"]),
     Te(pres("wake up", "wakes up"), same("woke up"), same("will wake up")))

verb("se coucher", "to go to bed",
     T(["me couche", "te couches", "se couche", "nous couchons", "vous couchez", "se couchent"],
       ["me suis couché(e)", "t'es couché(e)", "s'est couché(e)", "nous sommes couchés", "vous êtes couchés", "se sont couchés"],
       ["me coucherai", "te coucheras", "se couchera", "nous coucherons", "vous coucherez", "se coucheront"]),
     Te(pres("go to bed", "goes to bed"), same("went to bed"), same("will go to bed")))

verb("se laver", "to wash up",
     T(["me lave", "te laves", "se lave", "nous lavons", "vous lavez", "se lavent"],
       ["me suis lavé(e)", "t'es lavé(e)", "s'est lavé(e)", "nous sommes lavés", "vous êtes lavés", "se sont lavés"],
       ["me laverai", "te laveras", "se lavera", "nous laverons", "vous laverez", "se laveront"]),
     Te(pres("wash up", "washes up"), same("washed up"), same("will wash up")))

verb("s'habiller", "to get dressed",
     T(["m'habille", "t'habilles", "s'habille", "nous habillons", "vous habillez", "s'habillent"],
       ["me suis habillé(e)", "t'es habillé(e)", "s'est habillé(e)", "nous sommes habillés", "vous êtes habillés", "se sont habillés"],
       ["m'habillerai", "t'habilleras", "s'habillera", "nous habillerons", "vous habillerez", "s'habilleront"]),
     Te(pres("get dressed", "gets dressed"), same("got dressed"), same("will get dressed")))

verb("s'asseoir", "to sit down",
     T(["m'assieds", "t'assieds", "s'assied", "nous asseyons", "vous asseyez", "s'asseyent"],
       ["me suis assis(e)", "t'es assis(e)", "s'est assis(e)", "nous sommes assis", "vous êtes assis", "se sont assis"],
       ["m'assiérai", "t'assiéras", "s'assiéra", "nous assiérons", "vous assiérez", "s'assiéront"]),
     Te(pres("sit down", "sits down"), same("sat down"), same("will sit down")))

verb("se sentir", "to feel",
     T(["me sens", "te sens", "se sent", "nous sentons", "vous sentez", "se sentent"],
       ["me suis senti(e)", "t'es senti(e)", "s'est senti(e)", "nous sommes sentis", "vous êtes sentis", "se sont sentis"],
       ["me sentirai", "te sentiras", "se sentira", "nous sentirons", "vous sentirez", "se sentiront"]),
     Te(pres("feel"), same("felt"), same("will feel")))

verb("s'en aller", "to leave, to go away",
     T(["m'en vais", "t'en vas", "s'en va", "nous en allons", "vous en allez", "s'en vont"],
       ["m'en suis allé(e)", "t'en es allé(e)", "s'en est allé(e)", "nous en sommes allés", "vous en êtes allés", "s'en sont allés"],
       ["m'en irai", "t'en iras", "s'en ira", "nous en irons", "vous en irez", "s'en iront"]),
     Te(pres("leave"), same("left"), same("will leave")))

verb("se souvenir", "to remember",
     T(["me souviens", "te souviens", "se souvient", "nous souvenons", "vous souvenez", "se souviennent"],
       ["me suis souvenu(e)", "t'es souvenu(e)", "s'est souvenu(e)", "nous sommes souvenus", "vous êtes souvenus", "se sont souvenus"],
       ["me souviendrai", "te souviendras", "se souviendra", "nous souviendrons", "vous souviendrez", "se souviendront"]),
     Te(pres("remember"), same("remembered"), same("will remember")))

verb("s'amuser", "to have fun",
     T(["m'amuse", "t'amuses", "s'amuse", "nous amusons", "vous amusez", "s'amusent"],
       ["me suis amusé(e)", "t'es amusé(e)", "s'est amusé(e)", "nous sommes amusés", "vous êtes amusés", "se sont amusés"],
       ["m'amuserai", "t'amuseras", "s'amusera", "nous amuserons", "vous amuserez", "s'amuseront"]),
     Te(pres("have fun", "has fun"), same("had fun"), same("will have fun")))

verb("s'inquiéter", "to worry",
     T(["m'inquiète", "t'inquiètes", "s'inquiète", "nous inquiétons", "vous inquiétez", "s'inquiètent"],
       ["me suis inquiété(e)", "t'es inquiété(e)", "s'est inquiété(e)", "nous sommes inquiétés", "vous êtes inquiétés", "se sont inquiétés"],
       ["m'inquiéterai", "t'inquiéteras", "s'inquiétera", "nous inquiéterons", "vous inquiéterez", "s'inquiéteront"]),
     Te(pres("worry", "worries"), same("worried"), same("will worry")))

verb("se dépêcher", "to hurry",
     T(["me dépêche", "te dépêches", "se dépêche", "nous dépêchons", "vous dépêchez", "se dépêchent"],
       ["me suis dépêché(e)", "t'es dépêché(e)", "s'est dépêché(e)", "nous sommes dépêchés", "vous êtes dépêchés", "se sont dépêchés"],
       ["me dépêcherai", "te dépêcheras", "se dépêchera", "nous dépêcherons", "vous dépêcherez", "se dépêcheront"]),
     Te(pres("hurry", "hurries"), same("hurried"), same("will hurry")))

verb("se reposer", "to rest",
     T(["me repose", "te reposes", "se repose", "nous reposons", "vous reposez", "se reposent"],
       ["me suis reposé(e)", "t'es reposé(e)", "s'est reposé(e)", "nous sommes reposés", "vous êtes reposés", "se sont reposés"],
       ["me reposerai", "te reposeras", "se reposera", "nous reposerons", "vous reposerez", "se reposeront"]),
     Te(pres("rest"), same("rested"), same("will rest")))

verb("se promener", "to go for a walk",
     T(["me promène", "te promènes", "se promène", "nous promenons", "vous promenez", "se promènent"],
       ["me suis promené(e)", "t'es promené(e)", "s'est promené(e)", "nous sommes promenés", "vous êtes promenés", "se sont promenés"],
       ["me promènerai", "te promèneras", "se promènera", "nous promènerons", "vous promènerez", "se promèneront"]),
     Te(pres("go for a walk", "goes for a walk"), same("went for a walk"), same("will go for a walk")))

# ===================== around the house (35) =====================
for fr, en in [
    ("la maison", "the house"), ("l'appartement", "the apartment"), ("la porte", "the door"),
    ("la fenêtre", "the window"), ("la clé", "the key"), ("la cuisine", "the kitchen"),
    ("la chambre", "the bedroom"), ("la salle de bains", "the bathroom"), ("le salon", "the living room"),
    ("le lit", "the bed"), ("l'oreiller", "the pillow"), ("la couverture", "the blanket"),
    ("la chaise", "the chair"), ("la table", "the table"), ("le canapé", "the couch"),
    ("la lampe", "the lamp"), ("le miroir", "the mirror"), ("la douche", "the shower"),
    ("l'évier", "the kitchen sink"), ("le frigo", "the fridge"), ("le four", "the oven"),
    ("la cuisinière", "the stove"), ("l'armoire", "the closet"), ("le tiroir", "the drawer"),
    ("l'escalier", "the stairs"), ("le plafond", "the ceiling"), ("le sol", "the floor"),
    ("le mur", "the wall"), ("la poubelle", "the garbage"), ("la serviette de bain", "the bath towel"),
    ("le savon", "the soap"), ("les vêtements", "the clothes"), ("le lave-linge", "the washing machine"),
    ("la prise", "the electrical outlet"), ("l'ampoule", "the light bulb"),
]:
    vocab("House", fr, en)

# ===================== around town (35) =====================
for fr, en in [
    ("la ville", "the city"), ("la rue", "the street"), ("le coin", "the corner"),
    ("la place", "the square"), ("le quartier", "the neighborhood"), ("le magasin", "the shop"),
    ("le marché", "the market"), ("la boulangerie", "the bakery"), ("la pharmacie", "the pharmacy"),
    ("la banque", "the bank"), ("l'arrêt de bus", "the bus stop"), ("le bus", "the bus"),
    ("le métro", "the subway"), ("le train", "the train"), ("la gare", "the train station"),
    ("l'aéroport", "the airport"), ("la voiture", "the car"), ("le vélo", "the bicycle"),
    ("le feu", "the traffic light"), ("le pont", "the bridge"), ("l'église", "the church"),
    ("le musée", "the museum"), ("le parc", "the park"), ("la plage", "the beach"),
    ("l'hôpital", "the hospital"), ("le commissariat", "the police station"), ("la poste", "the post office"),
    ("la bibliothèque", "the library"), ("l'hôtel", "the hotel"), ("l'entrée", "the entrance"),
    ("la sortie", "the exit"), ("l'ascenseur", "the elevator"), ("le bâtiment", "the building"),
    ("le trottoir", "the sidewalk"), ("le plan", "the map"),
]:
    vocab("Town", fr, en)

# ===================== eating and drinking (44) =====================
# "serviette" is both towel and napkin, and "carte" is both menu and map, so
# both are qualified to keep every face one-to-one.
for fr, en in [
    ("le restaurant", "the restaurant"), ("le bar", "the bar"), ("la carte", "the menu"),
    ("l'addition", "the bill"), ("le serveur", "the waiter"), ("le pourboire", "the tip"),
    ("l'assiette", "the plate"), ("le verre", "the glass (tumbler)"), ("le verre à vin", "the wine glass"),
    ("la tasse", "the cup"), ("la bouteille", "the bottle"), ("la fourchette", "the fork"),
    ("le couteau", "the knife"), ("la cuillère", "the spoon"), ("la serviette de table", "the napkin"),
    ("le petit-déjeuner", "breakfast"), ("le déjeuner", "lunch"), ("le dîner", "dinner"),
    ("le pain", "the bread"), ("le fromage", "the cheese"), ("le jambon", "the ham"),
    ("le poulet", "the chicken"), ("la viande", "the meat"), ("le poisson", "the fish"),
    ("les légumes", "the vegetables"), ("la salade", "the salad"), ("la soupe", "the soup"),
    ("le riz", "the rice"), ("les œufs", "the eggs"), ("le fruit", "the fruit"),
    ("le dessert", "the dessert"), ("le sucre", "the sugar"), ("le sel", "the salt"),
    ("le poivre", "the pepper"), ("l'huile", "the oil"), ("l'eau", "the water"),
    ("le vin", "the wine"), ("la bière", "the beer"), ("le café", "the coffee"),
    ("le thé", "the tea"), ("le beurre", "the butter"), ("la confiture", "the jam"),
    ("le croissant", "the croissant"), ("la baguette", "the baguette"),
]:
    vocab("Table", fr, en)

# ===================== everyday (20) =====================
for fr, en in [
    ("rouge", "red"), ("bleu", "blue"), ("vert", "green"),
    ("jaune", "yellow"), ("noir", "black"), ("blanc", "white"),
    ("aujourd'hui", "today"), ("demain", "tomorrow"), ("hier", "yesterday"),
    ("maintenant", "now"), ("toujours", "always"), ("jamais", "never"),
    ("peut-être", "maybe"), ("bien sûr", "of course"), ("je suis désolé", "I am sorry"),
    ("s'il vous plaît", "please"), ("merci", "thank you"), ("de rien", "you are welcome"),
    ("combien ça coûte ?", "how much does it cost?"), ("encore", "again"),
]:
    vocab("Everyday", fr, en)

# ---- introduction order ----
# New cards enter a flight in deck order, so all 120 verb cards first would mean
# weeks of conjugation tables before the first noun. Interleave one verb (its
# infinitive plus three tenses) with a few vocabulary cards.
verb_cards = [c for c in cards if c["group"] == "Verbs"]
other_cards = [c for c in cards if c["group"] != "Verbs"]
verb_blocks = [verb_cards[i:i + 4] for i in range(0, len(verb_cards), 4)]
per_block = max(1, round(len(other_cards) / max(1, len(verb_blocks))))
ordered, oi = [], 0
for block in verb_blocks:
    ordered += block
    ordered += other_cards[oi:oi + per_block]
    oi += per_block
ordered += other_cards[oi:]
assert len(ordered) == len(cards)
cards = ordered

# ---- validate + write ----
ids = [c["id"] for c in cards]
dupes = sorted({i for i in ids if ids.count(i) > 1})
assert not dupes, "duplicate ids: " + str(dupes)

def face_fr(c):
    return c["term"] if c["type"] == "vocab" else c["verb"] + "|" + c["tense"]
def face_en(c):
    return c["gloss"] if c["type"] == "vocab" else c["english"] + "|" + c["tenseEn"]

for side, fn in (("French", face_fr), ("English", face_en)):
    seen = {}
    for c in cards:
        k = fn(c)
        assert k not in seen, f"duplicate {side} face {k!r}: {seen[k]} and {c['id']}"
        seen[k] = c["id"]

for c in cards:
    if c["type"] == "conjugation":
        assert len(c["forms"]) == 6 and len(c["formsEn"]) == 6, c["id"]

from collections import Counter
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
json.dump(cards, open(os.path.join(here, "data", "french.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
print("TOTAL", len(cards))
print("group", dict(Counter(c["group"] for c in cards)))
print("type ", dict(Counter(c["type"] for c in cards)))
