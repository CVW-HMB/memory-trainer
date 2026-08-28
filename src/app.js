// La Cave - wine flashcard trainer
// Data lives in /data/cards.json. Progress persists in IndexedDB, mirrored to
// localStorage as a fallback. Card types and direction rules are in CLAUDE.md.

import {
  FLIGHT_SIZE, freshCardState, dueCards as pickDue, buildQueue as pickQueue,
  applyAnswer, ymd, nextStreak,
} from "./engine/schedule.js";

// Namespaced now, with a single deck, so adding decks later needs no second
// migration. This is the one forward-looking concession the MVP makes.
const DECK_ID = "wine";
const STORE_KEY = "srs_v2:" + DECK_ID;
const LEGACY_KEY = "wine_srs_v1";      // pre-M5 localStorage key, migrated on first boot
let CARDS = [];
let BY_ID = {};

/* ---------------- storage ----------------
   IndexedDB is the primary store: unlike localStorage it is not cleared by
   Safari's 7-day eviction for sites without an installed PWA, and it survives
   more aggressive storage pressure. Every write is mirrored to localStorage,
   which costs a few KB and keeps the app working where IndexedDB is blocked
   (Safari private browsing, some embedded webviews). If both fail, an
   in-memory copy keeps the current session coherent.                        */
const DB_NAME = "lacave", DB_STORE = "progress", DB_VERSION = 1;
let backend = "memory";   // "idb" | "local" | "memory" - what actually persisted
let memStore = null;

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) return reject(new Error("indexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("indexedDB blocked"));
  });
}
function idbRun(mode, fn) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const req = fn(tx.objectStore(DB_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  }));
}
const idbGet = key => idbRun("readonly", s => s.get(key));
const idbSet = (key, val) => idbRun("readwrite", s => s.put(val, key));
const idbDel = key => idbRun("readwrite", s => s.delete(key));

const parse = raw => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
const lsGet = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const lsSet = (key, raw) => { try { localStorage.setItem(key, raw); return true; } catch (e) { return false; } };
const lsDel = key => { try { localStorage.removeItem(key); } catch (e) {} };

// Ask the browser not to evict us. Best effort: it may decline, and an
// installed PWA is generally granted it automatically.
async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return "already";
      return (await navigator.storage.persist()) ? "granted" : "denied";
    }
  } catch (e) {}
  return "unsupported";
}

// Reads progress and migrates anything found under an older location.
// Order: IndexedDB, then the mirror, then the pre-M5 key.
async function loadState() {
  let raw = null;
  try { raw = await idbGet(STORE_KEY); backend = "idb"; }
  catch (e) { console.warn("[store] IndexedDB unavailable, falling back", e); backend = null; }

  if (!raw) {
    const mirrored = lsGet(STORE_KEY);
    const legacy = mirrored ? null : lsGet(LEGACY_KEY);
    raw = mirrored || legacy;
    if (raw && backend === "idb") {
      // Promote into IndexedDB, and only drop the old key once the write reads
      // back -- losing progress to a failed migration is not recoverable.
      try {
        await idbSet(STORE_KEY, raw);
        if (await idbGet(STORE_KEY) === raw && legacy) lsDel(LEGACY_KEY);
      } catch (e) { console.warn("[store] migration failed, keeping old copy", e); }
    }
  }
  if (backend === null) backend = lsSet(STORE_KEY, lsGet(STORE_KEY) || "") ? "local" : "memory";
  return parse(raw) || memStore;
}

// Writes are serialised: a flight saves after every answer, and overlapping
// IndexedDB transactions would otherwise race. Callers stay synchronous.
let saveChain = Promise.resolve();
function saveState(s) {
  const raw = JSON.stringify(s);
  memStore = s;
  lsSet(STORE_KEY, raw);                       // mirror, always
  if (backend !== "idb") return;
  saveChain = saveChain
    .then(() => idbSet(STORE_KEY, raw))
    .catch(e => { console.warn("[store] IndexedDB write failed, mirror still holds it", e); });
}
async function clearState() {
  lsDel(STORE_KEY); lsDel(LEGACY_KEY); memStore = null;
  if (backend === "idb") { try { await idbDel(STORE_KEY); } catch (e) {} }
}

function freshState() {
  const cards = {};
  for (const c of CARDS) cards[c.id] = freshCardState();
  return { version: 1, cards, totalSessions: 0, streak: 0, bestStreak: 0, lastPracticed: null };
}
function ensureCard(id) {
  if (!state.cards[id]) state.cards[id] = freshCardState();
  return state.cards[id];
}

let state = null;
let queue = [], qpos = 0, sessionTotal = 0, sGot = 0, sMiss = 0, revealed = false;
let runDir = {};

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

/* ---------------- home ---------------- */
function dueCount() { return pickDue(CARDS, state.cards, state.totalSessions + 1).length; }
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
  const btn = $("startBtn");
  const today = ymd(new Date());
  const everything = masteredCount() === CARDS.length;
  const firstEver = (state.totalSessions || 0) === 0;

  if (CARDS.length === 0) {
    // Nothing to train on. Say so rather than starting an empty flight.
    lead.innerHTML = "This deck is empty.";
    btn.disabled = true;
    btn.textContent = "Nothing to pour";
    return;
  }
  btn.disabled = false;

  if (everything && due === 0) lead.innerHTML = "Every card mastered. A <em>free flight</em> keeps it there.";
  else if (state.lastPracticed === today && due === 0) lead.innerHTML = "All caught up for today. <em>Pour another</em> if you like.";
  else if (due === 0) lead.innerHTML = "Nothing forced today. A <em>free flight</em> keeps it sharp.";
  else if (firstEver) lead.innerHTML = "<em>" + CARDS.length + "</em> cards in the cellar. We&rsquo;ll start with <em>" + flight + "</em>.";
  else if (due > flight) lead.innerHTML = "<em>" + due + "</em> cards are ready. Tonight&rsquo;s flight pours <em>" + flight + "</em>.";
  else lead.innerHTML = "You have <em>" + due + "</em> card" + (due === 1 ? "" : "s") + " ready to taste.";

  // The button should promise what the flight actually is.
  btn.textContent = due === 0 ? "Pour a free flight" : firstEver ? "Begin your first flight" : "Begin today\u2019s flight";
}

/* ---------------- session ---------------- */
function startSession() {
  if (CARDS.length === 0) return;
  const today = ymd(new Date());
  if (state.lastPracticed !== today) {
    state.streak = nextStreak(state.streak, state.lastPracticed, today);
    state.lastPracticed = today;
    state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
  }
  state.totalSessions = (state.totalSessions || 0) + 1;
  saveState(state);

  // totalSessions is already incremented, so it is this flight's number.
  queue = pickQueue(CARDS, state.cards, state.totalSessions);
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
  applyAnswer(ensureCard(id), correct, state.totalSessions);
  if (correct) sGot += 1; else sMiss += 1;
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
  const mastery = CARDS.length
    ? Math.round(CARDS.reduce((a, c) => a + ((state.cards[c.id]?.box || 1) - 1) / 4, 0) / CARDS.length * 100)
    : 0;
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
  $("resetBtn").onclick = async () => {
    if (!confirm("Reset every card, streak, and stat back to zero?")) return;
    await clearState();
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
  const persistence = await requestPersistence();
  const saved = await loadState();
  console.info("[store] backend=" + backend + " persistence=" + persistence);
  state = freshState();
  if (saved && saved.cards) {
    state = Object.assign(state, saved, { cards: Object.assign(freshState().cards, saved.cards) });
  }
  // Persist the merged state right away: it populates the localStorage mirror
  // before the first answer, and gives any newly added cards their entries.
  saveState(state);
  $("cardCount").textContent = CARDS.length;
  wire();
  renderHome();
  show("home");
}
boot();

/* ---------------- service worker ---------------- */
// Registered after boot so a worker problem can never stop the app loading.
// No reload on controllerchange: an update mid-flight would drop the run. The
// new worker takes over on the next launch.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(e => console.warn("[sw] registration failed", e));
  });
}
