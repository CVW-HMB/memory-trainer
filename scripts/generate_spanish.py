"""
Generates data/spanish.json -- MEXICAN Spanish.

Deck shape (see CLAUDE.md):
  - Every card is REVERSIBLE. A translation pair is one-to-one by construction,
    and validate-cards.mjs enforces that no two cards share either face.
  - Each face is written entirely in one language: prompts, pronouns and the
    little category label included. A side never mixes the two.
  - Conjugation cards always carry the WHOLE table, never a single form.

Mexican Spanish specifically:
  - NO vosotros. Mexico uses ustedes for every plural "you", so the tables have
    five rows, not six. The source data below is written with the six standard
    forms and mx() drops the vosotros one, which is safer than retyping.
  - Vocabulary uses Mexican words where they differ from Peninsular Spanish:
    carro, departamento, refrigerador, camion, elevador, banqueta.
  - English glosses are American: garbage, subway, elevator, sidewalk.

Run: npm run cards:es
"""
import json, os, re, unicodedata

cards = []

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# group id -> (Spanish label, English label)
GROUPS = {
    "Verbs":    ("Verbos", "Verbs"),
    "House":    ("En casa", "Around the house"),
    "Town":     ("En la ciudad", "Around town"),
    "Table":    ("Comer y beber", "Eating and drinking"),
    "Everyday": ("Cada día", "Everyday"),
}

PRON_ES = ["yo", "tú", "él / ella / usted", "nosotros", "ellos / ustedes"]
PRON_EN = ["I", "you", "he / she / you", "we", "they / you all"]


def mx(forms):
    """Mexican Spanish has no vosotros: drop the 2nd person plural form."""
    assert len(forms) == 6, forms
    return forms[:4] + forms[5:]

TENSES = [("Presente", "Present"), ("Pretérito", "Simple past"), ("Futuro", "Future")]


def vocab(group, es, en):
    ges, gen = GROUPS[group]
    cards.append({"id": f"es-v-{slug(es)}", "group": group, "type": "vocab",
                  "lang": "es", "term": es, "gloss": en,
                  "kindTerm": ges, "kindGloss": gen})


def pres(base, third=None):
    """English present, five rows: only the third person singular differs."""
    return [base, base, third or (base + "s"), base, base]


def same(form):
    return [form] * 5


def verb(infinitive, english, es_forms, en_forms):
    """es_forms/en_forms: dicts keyed by Spanish tense name, each 6 forms."""
    vocab("Verbs", infinitive, english)
    for tes, ten in TENSES:
        cards.append({
            "id": f"es-c-{slug(infinitive)}-{slug(tes)}",
            "group": "Verbs", "type": "conjugation",
            "lang": "es", "verb": infinitive, "english": english,
            "tense": tes, "tenseEn": ten,
            "kindTerm": GROUPS["Verbs"][0], "kindGloss": GROUPS["Verbs"][1],
            "forms": [[p, f] for p, f in zip(PRON_ES, mx(es_forms[tes]))],
            "formsEn": [[p, f] for p, f in zip(PRON_EN, en_forms[tes])],
        })


def E(present, past, future):
    return {"Presente": present, "Pretérito": past, "Futuro": future}


def S(present, past, future):
    return {"Presente": present, "Pretérito": past, "Futuro": future}


# ===================== the 15 most common verbs =====================
# ser and estar are both "to be"; the English lead disambiguates them so the
# reverse direction still has exactly one answer.
verb("ser", "to be (permanent, identity)",
     S(["soy", "eres", "es", "somos", "sois", "son"],
       ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
       ["seré", "serás", "será", "seremos", "seréis", "serán"]),
     E(["am", "are", "is", "are", "are"],
       ["was", "were", "was", "were", "were"],
       same("will be")))

verb("estar", "to be (state, location)",
     S(["estoy", "estás", "está", "estamos", "estáis", "están"],
       ["estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron"],
       ["estaré", "estarás", "estará", "estaremos", "estaréis", "estarán"]),
     E(["am", "are", "is", "are", "are"],
       ["was", "were", "was", "were", "were"],
       same("will be")))

verb("tener", "to have",
     S(["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
       ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"],
       ["tendré", "tendrás", "tendrá", "tendremos", "tendréis", "tendrán"]),
     E(pres("have", "has"), same("had"), same("will have")))

verb("hacer", "to do, to make",
     S(["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
       ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"],
       ["haré", "harás", "hará", "haremos", "haréis", "harán"]),
     E(pres("do", "does"), same("did"), same("will do")))

verb("poder", "to be able to, can",
     S(["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
       ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"],
       ["podré", "podrás", "podrá", "podremos", "podréis", "podrán"]),
     E(same("can"), same("could"), same("will be able to")))

verb("decir", "to say",
     S(["digo", "dices", "dice", "decimos", "decís", "dicen"],
       ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"],
       ["diré", "dirás", "dirá", "diremos", "diréis", "dirán"]),
     E(pres("say"), same("said"), same("will say")))

verb("ir", "to go",
     S(["voy", "vas", "va", "vamos", "vais", "van"],
       ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
       ["iré", "irás", "irá", "iremos", "iréis", "irán"]),
     E(pres("go", "goes"), same("went"), same("will go")))

verb("ver", "to see",
     S(["veo", "ves", "ve", "vemos", "veis", "ven"],
       ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
       ["veré", "verás", "verá", "veremos", "veréis", "verán"]),
     E(pres("see"), same("saw"), same("will see")))

verb("dar", "to give",
     S(["doy", "das", "da", "damos", "dais", "dan"],
       ["di", "diste", "dio", "dimos", "disteis", "dieron"],
       ["daré", "darás", "dará", "daremos", "daréis", "darán"]),
     E(pres("give"), same("gave"), same("will give")))

verb("saber", "to know (a fact)",
     S(["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
       ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"],
       ["sabré", "sabrás", "sabrá", "sabremos", "sabréis", "sabrán"]),
     E(pres("know"), same("knew"), same("will know")))

verb("querer", "to want",
     S(["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
       ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"],
       ["querré", "querrás", "querrá", "querremos", "querréis", "querrán"]),
     E(pres("want"), same("wanted"), same("will want")))

verb("venir", "to come",
     S(["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
       ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"],
       ["vendré", "vendrás", "vendrá", "vendremos", "vendréis", "vendrán"]),
     E(pres("come"), same("came"), same("will come")))

verb("poner", "to put, to place",
     S(["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"],
       ["puse", "pusiste", "puso", "pusimos", "pusisteis", "pusieron"],
       ["pondré", "pondrás", "pondrá", "pondremos", "pondréis", "pondrán"]),
     E(pres("put"), same("put"), same("will put")))

verb("salir", "to go out",
     S(["salgo", "sales", "sale", "salimos", "salís", "salen"],
       ["salí", "saliste", "salió", "salimos", "salisteis", "salieron"],
       ["saldré", "saldrás", "saldrá", "saldremos", "saldréis", "saldrán"]),
     E(pres("go out", "goes out"), same("went out"), same("will go out")))

verb("hablar", "to speak",
     S(["hablo", "hablas", "habla", "hablamos", "habláis", "hablan"],
       ["hablé", "hablaste", "habló", "hablamos", "hablasteis", "hablaron"],
       ["hablaré", "hablarás", "hablará", "hablaremos", "hablaréis", "hablarán"]),
     E(pres("speak"), same("spoke"), same("will speak")))

# ===================== the 15 most common reflexive verbs =====================
verb("llamarse", "to be called",
     S(["me llamo", "te llamas", "se llama", "nos llamamos", "os llamáis", "se llaman"],
       ["me llamé", "te llamaste", "se llamó", "nos llamamos", "os llamasteis", "se llamaron"],
       ["me llamaré", "te llamarás", "se llamará", "nos llamaremos", "os llamaréis", "se llamarán"]),
     E(["am called", "are called", "is called", "are called", "are called"],
       ["was called", "were called", "was called", "were called", "were called"],
       same("will be called")))

verb("levantarse", "to get up",
     S(["me levanto", "te levantas", "se levanta", "nos levantamos", "os levantáis", "se levantan"],
       ["me levanté", "te levantaste", "se levantó", "nos levantamos", "os levantasteis", "se levantaron"],
       ["me levantaré", "te levantarás", "se levantará", "nos levantaremos", "os levantaréis", "se levantarán"]),
     E(pres("get up", "gets up"), same("got up"), same("will get up")))

verb("despertarse", "to wake up",
     S(["me despierto", "te despiertas", "se despierta", "nos despertamos", "os despertáis", "se despiertan"],
       ["me desperté", "te despertaste", "se despertó", "nos despertamos", "os despertasteis", "se despertaron"],
       ["me despertaré", "te despertarás", "se despertará", "nos despertaremos", "os despertaréis", "se despertarán"]),
     E(pres("wake up", "wakes up"), same("woke up"), same("will wake up")))

verb("acostarse", "to go to bed",
     S(["me acuesto", "te acuestas", "se acuesta", "nos acostamos", "os acostáis", "se acuestan"],
       ["me acosté", "te acostaste", "se acostó", "nos acostamos", "os acostasteis", "se acostaron"],
       ["me acostaré", "te acostarás", "se acostará", "nos acostaremos", "os acostaréis", "se acostarán"]),
     E(pres("go to bed", "goes to bed"), same("went to bed"), same("will go to bed")))

verb("ducharse", "to take a shower",
     S(["me ducho", "te duchas", "se ducha", "nos duchamos", "os ducháis", "se duchan"],
       ["me duché", "te duchaste", "se duchó", "nos duchamos", "os duchasteis", "se ducharon"],
       ["me ducharé", "te ducharás", "se duchará", "nos ducharemos", "os ducharéis", "se ducharán"]),
     E(pres("take a shower", "takes a shower"), same("took a shower"), same("will take a shower")))

verb("vestirse", "to get dressed",
     S(["me visto", "te vistes", "se viste", "nos vestimos", "os vestís", "se visten"],
       ["me vestí", "te vestiste", "se vistió", "nos vestimos", "os vestisteis", "se vistieron"],
       ["me vestiré", "te vestirás", "se vestirá", "nos vestiremos", "os vestiréis", "se vestirán"]),
     E(pres("get dressed", "gets dressed"), same("got dressed"), same("will get dressed")))

verb("sentarse", "to sit down",
     S(["me siento", "te sientas", "se sienta", "nos sentamos", "os sentáis", "se sientan"],
       ["me senté", "te sentaste", "se sentó", "nos sentamos", "os sentasteis", "se sentaron"],
       ["me sentaré", "te sentarás", "se sentará", "nos sentaremos", "os sentaréis", "se sentarán"]),
     E(pres("sit down", "sits down"), same("sat down"), same("will sit down")))

verb("sentirse", "to feel",
     S(["me siento", "te sientes", "se siente", "nos sentimos", "os sentís", "se sienten"],
       ["me sentí", "te sentiste", "se sintió", "nos sentimos", "os sentisteis", "se sintieron"],
       ["me sentiré", "te sentirás", "se sentirá", "nos sentiremos", "os sentiréis", "se sentirán"]),
     E(pres("feel"), same("felt"), same("will feel")))

verb("irse", "to leave, to go away",
     S(["me voy", "te vas", "se va", "nos vamos", "os vais", "se van"],
       ["me fui", "te fuiste", "se fue", "nos fuimos", "os fuisteis", "se fueron"],
       ["me iré", "te irás", "se irá", "nos iremos", "os iréis", "se irán"]),
     E(pres("leave"), same("left"), same("will leave")))

verb("quedarse", "to stay",
     S(["me quedo", "te quedas", "se queda", "nos quedamos", "os quedáis", "se quedan"],
       ["me quedé", "te quedaste", "se quedó", "nos quedamos", "os quedasteis", "se quedaron"],
       ["me quedaré", "te quedarás", "se quedará", "nos quedaremos", "os quedaréis", "se quedarán"]),
     E(pres("stay"), same("stayed"), same("will stay")))

verb("ponerse", "to put on (clothing)",
     S(["me pongo", "te pones", "se pone", "nos ponemos", "os ponéis", "se ponen"],
       ["me puse", "te pusiste", "se puso", "nos pusimos", "os pusisteis", "se pusieron"],
       ["me pondré", "te pondrás", "se pondrá", "nos pondremos", "os pondréis", "se pondrán"]),
     E(pres("put on", "puts on"), same("put on"), same("will put on")))

verb("acordarse", "to remember",
     S(["me acuerdo", "te acuerdas", "se acuerda", "nos acordamos", "os acordáis", "se acuerdan"],
       ["me acordé", "te acordaste", "se acordó", "nos acordamos", "os acordasteis", "se acordaron"],
       ["me acordaré", "te acordarás", "se acordará", "nos acordaremos", "os acordaréis", "se acordarán"]),
     E(pres("remember"), same("remembered"), same("will remember")))

verb("olvidarse", "to forget",
     S(["me olvido", "te olvidas", "se olvida", "nos olvidamos", "os olvidáis", "se olvidan"],
       ["me olvidé", "te olvidaste", "se olvidó", "nos olvidamos", "os olvidasteis", "se olvidaron"],
       ["me olvidaré", "te olvidarás", "se olvidará", "nos olvidaremos", "os olvidaréis", "se olvidarán"]),
     E(pres("forget"), same("forgot"), same("will forget")))

verb("divertirse", "to have fun",
     S(["me divierto", "te diviertes", "se divierte", "nos divertimos", "os divertís", "se divierten"],
       ["me divertí", "te divertiste", "se divirtió", "nos divertimos", "os divertisteis", "se divirtieron"],
       ["me divertiré", "te divertirás", "se divertirá", "nos divertiremos", "os divertiréis", "se divertirán"]),
     E(pres("have fun", "has fun"), same("had fun"), same("will have fun")))

verb("preocuparse", "to worry",
     S(["me preocupo", "te preocupas", "se preocupa", "nos preocupamos", "os preocupáis", "se preocupan"],
       ["me preocupé", "te preocupaste", "se preocupó", "nos preocupamos", "os preocupasteis", "se preocuparon"],
       ["me preocuparé", "te preocuparás", "se preocupará", "nos preocuparemos", "os preocuparéis", "se preocuparán"]),
     E(pres("worry", "worries"), same("worried"), same("will worry")))

# ===================== around the house (35) =====================
for es, en in [
    ("la casa", "the house"), ("el departamento", "the apartment"), ("la puerta", "the door"),
    ("la ventana", "the window"), ("la llave", "the key"), ("la cocina", "the kitchen"),
    ("el dormitorio", "the bedroom"), ("el baño", "the bathroom"), ("la sala", "the living room"),
    ("la cama", "the bed"), ("la almohada", "the pillow"), ("la manta", "the blanket"),
    ("la silla", "the chair"), ("la mesa", "the table"), ("el sofá", "the couch"),
    ("la lámpara", "the lamp"), ("el espejo", "the mirror"), ("la regadera", "the shower"),
    ("el fregadero", "the kitchen sink"), ("el refrigerador", "the fridge"), ("el horno", "the oven"),
    ("la estufa", "the stove"), ("el armario", "the closet"), ("el cajón", "the drawer"),
    ("la escalera", "the stairs"), ("el techo", "the ceiling"), ("el suelo", "the floor"),
    ("la pared", "the wall"), ("la basura", "the garbage"), ("la toalla", "the towel"),
    ("el jabón", "the soap"), ("la ropa", "the clothes"), ("la lavadora", "the washing machine"),
    ("el enchufe", "the electrical outlet"), ("la bombilla", "the light bulb"),
]:
    vocab("House", es, en)

# ===================== around town (35) =====================
for es, en in [
    ("la ciudad", "the city"), ("la calle", "the street"), ("la esquina", "the corner"),
    ("la plaza", "the square"), ("la colonia", "the neighborhood"), ("la tienda", "the shop"),
    ("el mercado", "the market"), ("la panadería", "the bakery"), ("la farmacia", "the pharmacy"),
    ("el banco", "the bank"), ("la parada", "the bus stop"), ("el camión", "the bus"),
    ("el metro", "the subway"), ("el tren", "the train"), ("la estación", "the station"),
    ("el aeropuerto", "the airport"), ("el carro", "the car"), ("la bicicleta", "the bicycle"),
    ("el semáforo", "the traffic light"), ("el puente", "the bridge"), ("la iglesia", "the church"),
    ("el museo", "the museum"), ("el parque", "the park"), ("la playa", "the beach"),
    ("el hospital", "the hospital"), ("la estación de policía", "the police station"), ("la oficina de correos", "the post office"),
    ("la biblioteca", "the library"), ("el hotel", "the hotel"), ("la entrada", "the entrance"),
    ("la salida", "the exit"), ("el elevador", "the elevator"), ("el edificio", "the building"),
    ("la banqueta", "the sidewalk"), ("el mapa", "the map"),
]:
    vocab("Town", es, en)

# ===================== eating and drinking (40) =====================
for es, en in [
    ("el restaurante", "the restaurant"), ("el bar", "the bar"), ("el menú", "the menu"),
    ("la cuenta", "the bill"), ("el mesero", "the waiter"), ("la propina", "the tip"),
    ("el plato", "the plate"), ("el vaso", "the glass (tumbler)"), ("la copa", "the wine glass"),
    ("la taza", "the cup"), ("la botella", "the bottle"), ("el tenedor", "the fork"),
    ("el cuchillo", "the knife"), ("la cuchara", "the spoon"), ("la servilleta", "the napkin"),
    ("el desayuno", "breakfast"), ("la comida", "lunch"), ("la cena", "dinner"),
    ("el pan", "the bread"), ("el queso", "the cheese"), ("el jamón", "the ham"),
    ("el pollo", "the chicken"), ("la carne", "the meat"), ("el pescado", "the fish"),
    ("las verduras", "the vegetables"), ("la ensalada", "the salad"), ("la sopa", "the soup"),
    ("el arroz", "the rice"), ("los huevos", "the eggs"), ("la fruta", "the fruit"),
    ("el postre", "the dessert"), ("el azúcar", "the sugar"), ("la sal", "the salt"),
    ("la pimienta", "the pepper"), ("el aceite", "the oil"), ("el agua", "the water"),
    ("el vino", "the wine"), ("la cerveza", "the beer"), ("el café", "the coffee"),
    ("el té", "the tea"), ("la tortilla", "the tortilla"),
    ("los frijoles", "the beans"), ("el aguacate", "the avocado"), ("la salsa", "the salsa"),
]:
    vocab("Table", es, en)

# ===================== everyday (20) =====================
for es, en in [
    ("rojo", "red"), ("azul", "blue"), ("verde", "green"),
    ("amarillo", "yellow"), ("negro", "black"), ("blanco", "white"),
    ("hoy", "today"), ("mañana", "tomorrow"), ("ayer", "yesterday"),
    ("ahora", "now"), ("siempre", "always"), ("nunca", "never"),
    ("tal vez", "maybe"), ("claro", "of course"), ("lo siento", "I am sorry"),
    ("por favor", "please"), ("gracias", "thank you"), ("de nada", "you are welcome"),
    ("¿cuánto cuesta?", "how much does it cost?"), ("otra vez", "again"),
]:
    vocab("Everyday", es, en)

# ---- introduction order ----
# New cards enter a flight in deck order, so emitting all 120 verb cards first
# would mean weeks of nothing but conjugation tables before the first noun.
# Interleave one verb (its infinitive plus its three tenses) with a handful of
# vocabulary. Proportions are unchanged; only the order you meet them in is.
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
assert len(ordered) == len(cards), (len(ordered), len(cards))
cards = ordered

# ---- validate + write ----
ids = [c["id"] for c in cards]
dupes = sorted({i for i in ids if ids.count(i) > 1})
assert not dupes, "duplicate ids: " + str(dupes)

# Every card flips, so both faces must be unique across the whole deck.
def face_es(c):
    return c["term"] if c["type"] == "vocab" else c["verb"] + "|" + c["tense"]
def face_en(c):
    return c["gloss"] if c["type"] == "vocab" else c["english"] + "|" + c["tenseEn"]

for side, fn in (("Spanish", face_es), ("English", face_en)):
    seen = {}
    for c in cards:
        k = fn(c)
        assert k not in seen, f"duplicate {side} face {k!r}: {seen[k]} and {c['id']}"
        seen[k] = c["id"]

for c in cards:
    if c["type"] == "conjugation":
        # Five rows: Mexican Spanish has no vosotros.
        assert len(c["forms"]) == 5 and len(c["formsEn"]) == 5, c["id"]

from collections import Counter
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(here, "data", "spanish.json")
json.dump(cards, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("TOTAL", len(cards))
print("group", dict(Counter(c["group"] for c in cards)))
print("type ", dict(Counter(c["type"] for c in cards)))
