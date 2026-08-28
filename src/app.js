// La Cave - wine flashcard trainer
// Data lives in /data/cards.json. Progress persists in localStorage.
// Card types and their direction rules are documented in CLAUDE.md.

const STORE_KEY = "wine_srs_v1";
const INTERVAL = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }; // Leitner box -> sessions until due

// A flight is capped so a session stays a habit rather than a chore. This caps
// how many of the due cards get served; it does not touch the box arithmetic
// or INTERVAL above. Undrawn cards stay due and come back next flight.
const FLIGHT_SIZE = 20;    // cards served per flight
const NEW_PER_FLIGHT = 5;  // at most this many never-seen cards per flight

let CARDS = [];
let BY_ID = {};

/* ---------------- storage (localStorage + in-memory fallback) ---------------- */
let memStore = null;
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { return memStore; }
  return null;
}
function saveState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
  catch (e) { memStore = s; }
}

function freshState() {
  const cards = {};
  for (const c of CARDS) cards[c.id] = { box: 1, correct: 0, wrong: 0, seen: 0, lastSession: 0 };
  return { version: 1, cards, totalSessions: 0, streak: 0, bestStreak: 0, lastPracticed: null };
}
function ensureCard(id) {
  if (!state.cards[id]) state.cards[id] = { box: 1, correct: 0, wrong: 0, seen: 0, lastSession: 0 };
  return state.cards[id];
}

let state = null;
let queue = [], qpos = 0, sessionTotal = 0, sGot = 0, sMiss = 0, revealed = false;
let runDir = {};

/* ---------------- date helpers ---------------- */
const ymd = d => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);

/* ---------------- views ---------------- */
function show(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  window.scrollTo(0, 0);
}
const $ = id => document.getElementById(id);

/* ---------------- card helpers ---------------- */
// Only bottle-decode cards may flip. place2grape and grapehome have a single
// determinate answer, so they always run in their authored direction.
function reversible(c) { return c.type === "decode"; }
function cardLabel(c) { return c.type === "decode" ? c.appellation : c.grape; }
function cardHint(c) {
  if (c.type === "decode") return c.grape;
  if (c.type === "grapehome") return c.home;
  return c.region;
}

/* ---------------- due ---------------- */
// A card is due if it has never been seen, or if enough sessions have passed
// for its box. `cur` is the session number the card would be answered in.
function isDue(c, cur) {
  const s = state.cards[c.id];
  if (!s || s.seen === 0) return true;
  return (cur - s.lastSession) >= (INTERVAL[s.box] || 1);
}
const isNew = c => (state.cards[c.id]?.seen || 0) === 0;
function dueCards(cur) { return CARDS.filter(c => isDue(c, cur)); }

/* ---------------- home ---------------- */
function dueCount() { return dueCards(state.totalSessions + 1).length; }
// How many cards the next flight will actually serve. The top-up in buildQueue
// means a flight is always as full as the due pool allows.
function flightSize() { return Math.min(FLIGHT_SIZE, dueCount()) || Math.min(FLIGHT_SIZE, CARDS.length); }
const masteredCount = () => CARDS.filter(c => (state.cards[c.id]?.box || 1) >= 5).length;
const seenCount = () => CARDS.filter(c => (state.cards[c.id]?.seen || 0) > 0).length;

function renderHome() {
  $("streakNum").textContent = state.streak || 0;
  const due = dueCount();
  const flight = flightSize();
  // Honest numbers: show what this flight pours, not the whole backlog.
  $("hDue").textContent = due > flight ? flight + " of " + due : due;
  $("hDueLabel").textContent = due > flight ? "In this flight" : "Due today";
  $("hMastered").textContent = masteredCount() + "/" + CARDS.length;
  $("hSeen").textContent = seenCount() + "/" + CARDS.length;
  const lead = $("homeLead");
  const today = ymd(new Date());
  if (state.lastPracticed === today && due === 0) lead.innerHTML = "All caught up for today. <em>Pour another</em> if you like.";
  else if (due === 0) lead.innerHTML = "Nothing forced today. A <em>free flight</em> keeps it sharp.";
  else if (due > flight) lead.innerHTML = "<em>" + due + "</em> cards are ready. Tonight&rsquo;s flight pours <em>" + flight + "</em>.";
  else lead.innerHTML = "You have <em>" + due + "</em> card" + (due === 1 ? "" : "s") + " ready to taste.";
}

/* ---------------- session ---------------- */
// Weakest boxes first, jittered so the same run of cards does not repeat in the
// same order every flight. Unchanged from before the flight cap.
function weakFirst(cards) {
  cards.forEach(c => c._k = (state.cards[c.id]?.box || 1) + Math.random() * 1.15);
  return cards.slice().sort((a, b) => a._k - b._k);
}

// Selects up to FLIGHT_SIZE cards from everything due. New material is
// introduced at a trickle (NEW_PER_FLIGHT) in deck order, which is the
// curriculum order: France before Italy before the rest, grape homes before
// label decoding. Reviews fill the remainder weak-first; if there are not
// enough reviews, the flight tops up with more new cards so it is always as
// full as the due pool allows.
function buildQueue() {
  const cur = state.totalSessions; // already incremented at start
  let due = dueCards(cur);
  if (due.length === 0) due = CARDS.slice(); // free review: nothing forced today

  const fresh = due.filter(isNew);            // deck order preserved
  const review = due.filter(c => !isNew(c));

  const picked = fresh.slice(0, NEW_PER_FLIGHT);
  picked.push(...weakFirst(review).slice(0, FLIGHT_SIZE - picked.length));
  if (picked.length < FLIGHT_SIZE) {
    picked.push(...fresh.slice(NEW_PER_FLIGHT, NEW_PER_FLIGHT + FLIGHT_SIZE - picked.length));
  }
  return weakFirst(picked).map(c => c.id);
}

function startSession() {
  const today = ymd(new Date());
  if (state.lastPracticed !== today) {
    if (state.lastPracticed && daysBetween(state.lastPracticed, today) === 1) state.streak = (state.streak || 0) + 1;
    else state.streak = 1;
    state.lastPracticed = today;
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
  }
  state.totalSessions = (state.totalSessions || 0) + 1;
  saveState(state);

  queue = buildQueue();
  qpos = 0; sessionTotal = queue.length; sGot = 0; sMiss = 0;
  runDir = {};
  for (const id of queue) {
    const c = BY_ID[id];
    runDir[id] = reversible(c) ? (Math.random() < 0.5 ? "rev" : "fwd") : "fwd";
  }
  $("streakNum").textContent = state.streak;
  show("session");
  renderCard();
}

// content specs: mode "headline" (one big line) or "detail" (lead + context + notes)
function specHeadline(big, kind, ask, warn) { return { mode: "headline", big, kind, ask: ask || "", warn: !!warn }; }
function specDetail(lead, context, notes, kind, ask) { return { mode: "detail", lead: lead || "", context: context || "", notes: notes || "", kind, ask: ask || "" }; }

function facesFor(c, dir) {
  if (c.type === "place2grape") {
    return {
      prompt: specDetail(c.region, c.country, c.notes, "Place & taste", "Which grape?"),
      answer: specHeadline(c.grape, "Grape")
    };
  }
  if (c.type === "grapehome") {
    return {
      prompt: specHeadline(c.grape, "Grape", "Where's it grown?"),
      answer: specDetail(c.home, "", "Also grown: " + c.also, "Its home")
    };
  }
  // decode
  const appPrompt = specHeadline(c.appellation, "On the label", "Grape & region?", c.trap);
  const appAnswer = specHeadline(c.appellation, "On the label", "", c.trap);
  const detPrompt = specDetail(c.grape, c.country + "  \u00b7  " + c.region, c.notes, "What's in it", "Name the wine");
  const detAnswer = specDetail(c.grape, c.country + "  \u00b7  " + c.region, c.notes, "What's in it", "");
  return dir === "rev"
    ? { prompt: detPrompt, answer: appAnswer }
    : { prompt: appPrompt, answer: detAnswer };
}

function renderCard() {
  revealed = false;
  $("card").classList.remove("flipped");
  const c = BY_ID[queue[qpos]];
  const { prompt, answer } = facesFor(c, runDir[c.id] || "fwd");
  fillFace("f", prompt);
  fillFace("b", answer);

  const done = qpos;
  $("progNum").textContent = done + " / " + sessionTotal;
  $("progFill").style.width = (sessionTotal ? (done / sessionTotal * 100) : 0) + "%";
  $("flipBtn").classList.remove("hidden");
  $("missBtn").classList.add("hidden");
  $("gotBtn").classList.add("hidden");
}

function fillFace(p, s) {
  const kind = $(p + "Kind");
  kind.textContent = s.kind || "";
  kind.classList.toggle("warn", !!s.warn);
  $(p + "Big").classList.toggle("hidden", s.mode !== "headline");
  $(p + "Detail").classList.toggle("hidden", s.mode !== "detail");
  if (s.mode === "headline") {
    $(p + "Big").textContent = s.big;
  } else {
    const lead = $(p + "Lead");
    lead.textContent = s.lead || "";
    lead.classList.toggle("hidden", !s.lead);
    $(p + "Context").textContent = s.context || "";
    $(p + "Notes").textContent = s.notes || "";
  }
  const ask = $(p + "Ask");
  if (ask) ask.textContent = s.ask || "";
}

function flip() {
  if (revealed) return;
  revealed = true;
  $("card").classList.add("flipped");
  $("flipBtn").classList.add("hidden");
  $("missBtn").classList.remove("hidden");
  $("gotBtn").classList.remove("hidden");
}

function answer(correct) {
  if (!revealed) return;
  const id = queue[qpos];
  const s = ensureCard(id);
  s.seen += 1;
  s.lastSession = state.totalSessions;
  if (correct) { s.correct += 1; s.box = Math.min(5, s.box + 1); sGot += 1; }
  else { s.wrong += 1; s.box = 1; sMiss += 1; }
  saveState(state);
  qpos += 1;
  if (qpos >= queue.length) endSession();
  else renderCard();
}

function endSession() {
  $("progNum").textContent = sessionTotal + " / " + sessionTotal;
  $("progFill").style.width = "100%";
  $("sGot").textContent = sGot;
  $("sMiss").textContent = sMiss;
  const tot = sGot + sMiss;
  $("sAcc").textContent = tot ? Math.round(sGot / tot * 100) + "%" : "--";

  const weak = CARDS.map(c => ({ c, s: state.cards[c.id] }))
    .filter(x => x.s.box <= 2 && x.s.seen > 0)
    .sort((a, b) => (b.s.wrong - a.s.wrong) || (a.s.box - b.s.box))
    .slice(0, 5);
  const ul = $("revisitList"), box = $("revisitBox");
  if (weak.length === 0) box.classList.add("hidden");
  else {
    box.classList.remove("hidden");
    ul.innerHTML = weak.map(x => "<li>" + cardLabel(x.c) + "<span>" + cardHint(x.c) + "</span></li>").join("");
  }
  const acc = tot ? Math.round(sGot / tot * 100) : 0;
  $("sumHead").textContent = acc >= 90 ? "Beautifully done" : acc >= 70 ? "Coming along" : "Good work, keep pouring";
  show("summary");
}

/* ---------------- cellar (stats) ---------------- */
function renderCellar() {
  $("mStreak").textContent = state.streak || 0;
  $("mBest").textContent = state.bestStreak || 0;
  $("mFlights").textContent = state.totalSessions || 0;
  const mastery = Math.round(CARDS.reduce((a, c) => a + ((state.cards[c.id]?.box || 1) - 1) / 4, 0) / CARDS.length * 100);
  $("mMastery").textContent = mastery + "%";

  const buckets = { New: 0, Learning: 0, Familiar: 0, Mastered: 0 };
  for (const c of CARDS) {
    const s = state.cards[c.id];
    if (!s || s.seen === 0) buckets.New++;
    else if (s.box <= 2) buckets.Learning++;
    else if (s.box <= 4) buckets.Familiar++;
    else buckets.Mastered++;
  }
  $("statusBars").innerHTML = Object.entries(buckets).map(([k, v]) => barRow(k, v, CARDS.length, v)).join("");

  const groups = ["France", "Italy", "Rest"];
  $("regionBars").innerHTML = groups.map(g => {
    const cs = CARDS.filter(c => c.group === g);
    let cor = 0, wr = 0;
    cs.forEach(c => { const s = state.cards[c.id]; cor += s.correct; wr += s.wrong; });
    const tot = cor + wr;
    const pct = tot ? Math.round(cor / tot * 100) : 0;
    return barRow(g === "Rest" ? "Rest of world" : g, pct, 100, tot ? pct + "%" : "--");
  }).join("");

  const hard = CARDS.map(c => ({ c, s: state.cards[c.id] }))
    .filter(x => x.s.wrong > 0)
    .sort((a, b) => (b.s.wrong - a.s.wrong) || (b.s.wrong / (b.s.seen || 1) - a.s.wrong / (a.s.seen || 1)))
    .slice(0, 8);
  const ul = $("struggleList");
  if (hard.length === 0) ul.innerHTML = "<li class='empty'>No misses logged yet. Run a flight and your weak spots show up here.</li>";
  else ul.innerHTML = hard.map(x => "<li><span class='nm'>" + cardLabel(x.c) + "</span><span class='sc'>" + x.s.wrong + " miss" + (x.s.wrong === 1 ? "" : "es") + "</span></li>").join("");
}
function barRow(label, value, max, right) {
  const pct = max ? Math.round(value / max * 100) : 0;
  return "<div class='bar-row'><div class='bar-label'>" + label + "</div><div class='bar-track'><div class='bar-fill' style='width:" + pct + "%'></div></div><div class='bar-pct'>" + right + "</div></div>";
}

/* ---------------- wiring ---------------- */
function wire() {
  $("startBtn").onclick = startSession;
  $("againBtn").onclick = startSession;
  $("flipBtn").onclick = flip;
  $("card").onclick = () => { if (!revealed) flip(); };
  $("card").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!revealed) flip(); } });
  $("missBtn").onclick = () => answer(false);
  $("gotBtn").onclick = () => answer(true);
  $("exitBtn").onclick = () => { renderHome(); show("home"); };
  $("toCellar").onclick = () => { renderCellar(); show("cellar"); };
  $("sumCellar").onclick = () => { renderCellar(); show("cellar"); };
  $("sumHome").onclick = () => { renderHome(); show("home"); };
  $("cellarBack").onclick = () => { renderHome(); show("home"); };
  $("resetBtn").onclick = () => {
    if (!confirm("Reset every card, streak, and stat back to zero?")) return;
    state = freshState(); saveState(state); renderCellar(); renderHome();
  };
  document.addEventListener("keydown", e => {
    if (!$("session").classList.contains("active")) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!revealed) flip(); }
    else if (revealed && (e.key === "1" || e.key === "ArrowLeft")) { e.preventDefault(); answer(false); }
    else if (revealed && (e.key === "2" || e.key === "ArrowRight")) { e.preventDefault(); answer(true); }
  });
}

/* ---------------- boot ---------------- */
async function boot() {
  try {
    const res = await fetch("./data/cards.json");
    CARDS = await res.json();
  } catch (e) {
    document.getElementById("homeLead").textContent = "Could not load cards.json. Run this through a local server (see README).";
    return;
  }
  BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
  const saved = loadState();
  state = freshState();
  if (saved && saved.cards) {
    state = Object.assign(state, saved, { cards: Object.assign(freshState().cards, saved.cards) });
  }
  $("cardCount").textContent = CARDS.length;
  wire();
  renderHome();
  show("home");
}
boot();
