// La Cave - wine flashcard trainer
// Data lives in /data/cards.json. Progress persists in IndexedDB, mirrored to
// localStorage as a fallback. Card types and direction rules are in CLAUDE.md.

import {
  FLIGHT_SIZE, MAX_BOX, freshCardState, dueCards as pickDue, buildQueue as pickQueue,
  applyAnswer, redrill, ymd, nextStreak,
} from "./engine/schedule.js";
import { typeFor } from "./decks/registry.js";

// Keys are namespaced by profile and deck, so several people can share a
// browser and adding decks later needs no further migration.
const APP_NAME = "La Cave";                   // the app; decks name themselves
let DECK_ID = "wine";                         // set when a deck is chosen
let DECK = null;                              // the chosen deck's manifest entry
let DECKS = [];
const PROFILES_KEY = "srs_v2:profiles";       // [{ id, name, created }]
const ACTIVE_KEY = "srs_v2:active";           // id of the profile in use
const LAST_DECK_KEY = "srs_v2:lastDeck";
const SHARED_KEY = "srs_v2:wine";             // pre-profile key, adopted by the first profile
const LEGACY_KEY = "wine_srs_v1";             // pre-M5 key, migrated on first boot
const progressKey = (pid) => "srs_v2:" + pid + ":" + DECK_ID;
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

// Decides once, at boot, whether IndexedDB is usable.
async function probeBackend() {
  try { await idbGet(PROFILES_KEY); backend = "idb"; }
  catch (e) {
    console.warn("[store] IndexedDB unavailable, using localStorage", e);
    backend = lsSet("srs_v2:probe", "1") ? "local" : "memory";
    lsDel("srs_v2:probe");
  }
  return backend;
}

// Reads a key. The in-memory copy comes first because writeKey fills it
// synchronously while the IndexedDB write is still queued behind the chain: a
// flight leaves 35 writes draining, so reading IndexedDB straight after one
// could hand back the previous value. Then IndexedDB, then the localStorage
// mirror, and anything found only in the mirror is promoted back.
async function readKey(key) {
  if (memCache[key] !== undefined) return memCache[key];
  let raw = null;
  if (backend === "idb") { try { raw = await idbGet(key); } catch (e) {} }
  if (!raw) {
    raw = lsGet(key);
    if (raw && backend === "idb") { try { await idbSet(key, raw); } catch (e) {} }
  }
  return raw;
}

// Writes are serialised: a flight saves after every answer, and overlapping
// IndexedDB transactions would otherwise race. Callers stay synchronous.
let saveChain = Promise.resolve();
const memCache = {};
function writeKey(key, raw) {
  memCache[key] = raw;
  lsSet(key, raw);                              // mirror, always
  if (backend !== "idb") return;
  saveChain = saveChain
    .then(() => idbSet(key, raw))
    .catch(e => { console.warn("[store] IndexedDB write failed, mirror still holds it", e); });
}
async function removeKey(key) {
  delete memCache[key];
  lsDel(key);
  if (backend === "idb") { try { await idbDel(key); } catch (e) {} }
}

/* ---------------- profiles ----------------
   Several people can share one browser. Each profile owns its own progress,
   streak and stats under srs_v2:<profileId>:<deck>. Nothing is shared.      */
let profiles = [], activeId = null;

const newProfileId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const activeProfile = () => profiles.find(p => p.id === activeId) || profiles[0];

async function loadProfiles() {
  profiles = parse(await readKey(PROFILES_KEY)) || [];
  if (!Array.isArray(profiles)) profiles = [];

  if (profiles.length === 0) {
    // First run under profiles. Any pre-profile progress becomes this person's,
    // so nobody loses a streak to the upgrade.
    const inherited = (await readKey(SHARED_KEY)) || lsGet(LEGACY_KEY);
    const first = { id: newProfileId(), name: "Me", created: Date.now() };
    profiles = [first];
    writeKey(PROFILES_KEY, JSON.stringify(profiles));
    if (inherited) {
      writeKey(progressKey(first.id), inherited);
      // Only drop the old copies once the new one reads back.
      if (await readKey(progressKey(first.id)) === inherited) {
        await removeKey(SHARED_KEY); lsDel(LEGACY_KEY);
      }
    }
  }
  activeId = (await readKey(ACTIVE_KEY)) || profiles[0].id;
  if (!profiles.some(p => p.id === activeId)) activeId = profiles[0].id;
  writeKey(ACTIVE_KEY, activeId);
  return profiles;
}

const saveProfiles = () => writeKey(PROFILES_KEY, JSON.stringify(profiles));

async function loadState() { return parse(await readKey(progressKey(activeId))); }
function saveState(s) { writeKey(progressKey(activeId), JSON.stringify(s)); }
async function clearState() { await removeKey(progressKey(activeId)); }

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
// `queue` grows as missed cards are re-inserted, so it is not the flight size.
// `flightTotal` is the number of distinct cards; `cleared` is those answered
// correctly. The flight ends when every card has been cleared.
let queue = [], qpos = 0, flightTotal = 0, sGot = 0, sMiss = 0, revealed = false;
let runDir = {}, firstPass = {}, cleared = new Set();

/* ---------------- views ---------------- */
function show(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  // No deck is loaded on the chooser, so the card count and streak would both
  // read 0 and mean nothing. Hide them until a deck is picked.
  const onChooser = id === "decks";
  document.querySelector(".foot").classList.toggle("hidden", onChooser);
  $("hdrStreak").classList.toggle("hidden", onChooser);
  window.scrollTo(0, 0);
}
const $ = id => document.getElementById(id);

/* ---------------- card helpers ----------------
   All four delegate to the card type registered for the card, so deck-specific
   knowledge lives in src/decks/ rather than here. Reversibility is declared by
   the card type, never assumed: a card flips only when both directions have
   exactly one right answer.                                                 */
const reversible = c => typeFor(c).reversible(c);
const cardLabel = c => typeFor(c).label(c);
const cardHint = c => typeFor(c).hint(c);
const facesFor = (c, dir) => typeFor(c).faces(c, dir);

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
  qpos = 0; flightTotal = queue.length; sGot = 0; sMiss = 0;
  runDir = {}; firstPass = {}; cleared = new Set();
  for (const id of queue) {
    const c = BY_ID[id];
    runDir[id] = reversible(c) ? (Math.random() < 0.5 ? "rev" : "fwd") : "fwd";
  }
  $("streakNum").textContent = state.streak;
  show("session");
  renderCard();
}

function renderCard() {
  revealed = false;
  $("card").classList.remove("flipped");
  const c = BY_ID[queue[qpos]];
  const { prompt, answer } = facesFor(c, runDir[c.id] || "fwd");
  fillFace("f", prompt);
  fillFace("b", answer);
  // Flag a card you are seeing again this flight, so a repeat does not read as
  // the deck glitching.
  if (c.id in firstPass) $("fKind").textContent += " \u00b7 again";

  // Progress is cards cleared, not cards shown: repeats must not inflate it.
  $("progNum").textContent = cleared.size + " / " + flightTotal;
  $("progFill").style.width = (flightTotal ? (cleared.size / flightTotal * 100) : 0) + "%";
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
  $(p + "List").classList.toggle("hidden", s.mode !== "list");

  // Every field is written every time. Only filling the active mode's fields
  // leaves the hidden ones holding the previous card's text -- invisible until
  // a layout change makes it visible.
  $(p + "Big").textContent = s.mode === "headline" ? (s.big || "") : "";
  const lead = $(p + "Lead");
  lead.textContent = s.mode === "detail" ? (s.lead || "") : "";
  lead.classList.toggle("hidden", !(s.mode === "detail" && s.lead));
  $(p + "Context").textContent = s.mode === "detail" ? (s.context || "") : "";
  $(p + "Notes").textContent = s.mode === "detail" ? (s.notes || "") : "";

  $(p + "LLead").textContent = s.mode === "list" ? (s.lead || "") : "";
  $(p + "LSub").textContent = s.mode === "list" ? (s.sub || "") : "";
  const rows = $(p + "LRows");
  rows.replaceChildren();
  if (s.mode === "list") {
    // Deck data is set as text, never markup.
    for (const [left, right] of (s.rows || [])) {
      const li = document.createElement("li");
      const a = document.createElement("span"); a.className = "lk"; a.textContent = left;
      const b = document.createElement("span"); b.className = "lv"; b.textContent = right;
      li.append(a, b);
      rows.appendChild(li);
    }
    // Long tables get a smaller row so six forms still fit on a phone.
    rows.classList.toggle("dense", (s.rows || []).length > 4);
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
  if (!(id in firstPass)) {
    // Only the first attempt in a flight moves the box or the stats. The
    // repeats are drilling, not new evidence -- otherwise missing a card and
    // then getting it right would cost nothing, and a bad night would swamp
    // the "hardest for you" list.
    firstPass[id] = correct;
    applyAnswer(ensureCard(id), correct, state.totalSessions);
    if (correct) sGot += 1; else sMiss += 1;
    saveState(state);
  }
  if (correct) cleared.add(id);
  else queue = redrill(queue, qpos);   // seen again later this flight
  qpos += 1;
  if (qpos >= queue.length) endSession();
  else renderCard();
}

function endSession() {
  $("progNum").textContent = flightTotal + " / " + flightTotal;
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

  // Groups and their labels come from the deck, so this works for any deck.
  const groups = (DECK && DECK.groups) || [];
  $("groupsTitle").textContent = (DECK && DECK.groupsTitle) || "By group";
  $("regionBars").innerHTML = groups.map(g => {
    const cs = CARDS.filter(c => c.group === g.id);
    let cor = 0, wr = 0;
    cs.forEach(c => { const s = state.cards[c.id]; if (s) { cor += s.correct; wr += s.wrong; } });
    const tot = cor + wr;
    const pct = tot ? Math.round(cor / tot * 100) : 0;
    return barRow(g.label || g.id, pct, 100, tot ? pct + "%" : "--");
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

/* ---------------- profiles view ---------------- */
// A per-profile summary needs that profile's saved progress, not the active
// state, so each row is read from storage.
async function profileSummary(pid) {
  const s = parse(await readKey(progressKey(pid)));
  if (!s || !s.cards) return { flights: 0, mastered: 0, streak: 0 };
  const mastered = CARDS.filter(c => (s.cards[c.id]?.box || 1) >= 5).length;
  return { flights: s.totalSessions || 0, mastered, streak: s.streak || 0 };
}

async function renderProfiles() {
  const list = $("profileList");
  list.innerHTML = profiles.map(p => `
    <li class="prow${p.id === activeId ? " current" : ""}" data-id="${p.id}">
      <button class="pname" data-act="switch" data-id="${p.id}">
        <span class="nm"></span>
        <span class="sub" id="sum-${p.id}">&hellip;</span>
      </button>
      <span class="pacts">
        <button class="link tiny" data-act="rename" data-id="${p.id}">Rename</button>
        <button class="link tiny danger" data-act="delete" data-id="${p.id}">Delete</button>
      </span>
    </li>`).join("");
  // Names are user input: set them as text, never as markup.
  for (const p of profiles) {
    const row = list.querySelector(`.prow[data-id="${p.id}"] .nm`);
    if (row) row.textContent = p.name + (p.id === activeId ? "  \u2022  in use" : "");
  }
  for (const p of profiles) {
    const s = await profileSummary(p.id);
    const el = $("sum-" + p.id);
    if (el) el.textContent = s.flights === 0
      ? "no flights yet"
      : `${s.flights} flight${s.flights === 1 ? "" : "s"} \u00b7 ${s.mastered}/${CARDS.length} mastered \u00b7 ${s.streak} day streak`;
  }
  list.onclick = async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const id = b.dataset.id, who = profiles.find(x => x.id === id);
    if (!who) return;
    if (b.dataset.act === "switch") return switchProfile(id);
    if (b.dataset.act === "rename") {
      const name = (prompt("Name for this taster:", who.name) || "").trim();
      if (!name) return;
      who.name = name.slice(0, 32);
      saveProfiles(); renderProfileChip(); renderProfiles();
    }
    if (b.dataset.act === "delete") {
      if (profiles.length === 1) return alert("This is the only taster. Add another before deleting this one.");
      if (!confirm(`Delete ${who.name} and all of their progress? This cannot be undone.`)) return;
      await removeKey(progressKey(id));
      profiles = profiles.filter(x => x.id !== id);
      saveProfiles();
      if (activeId === id) { activeId = profiles[0].id; writeKey(ACTIVE_KEY, activeId); await adoptActiveProfile(); }
      renderProfiles(); renderHome();
    }
  };
}

async function switchProfile(id) {
  if (id === activeId) { backFromProfiles(); return; }
  activeId = id;
  writeKey(ACTIVE_KEY, activeId);
  if (CARDS.length) await adoptActiveProfile();
  else renderProfileChip();
  backFromProfiles();
}

// Profiles can be reached from the deck chooser as well as from home, so go
// back to wherever makes sense rather than always to home.
function backFromProfiles() {
  if (CARDS.length) { renderHome(); show("home"); }
  else { renderDecks(); show("decks"); }
}

async function addProfile() {
  const name = (prompt("Name for the new taster:", "") || "").trim();
  if (!name) return;
  const who = { id: newProfileId(), name: name.slice(0, 32), created: Date.now() };
  profiles.push(who);
  saveProfiles();
  await switchProfile(who.id);   // a new taster starts their own fresh deck
}

/* ---------------- backup and restore ----------------
   There is no server, so a file is how progress moves between devices and how
   it survives a cleared browser. A backup holds every profile on this device. */
const BACKUP_APP = "la-cave", BACKUP_FORMAT = 1;

// Backup files are untrusted input, so a restored state is rebuilt field by
// field rather than trusted as-is. Card ids not in the current deck are
// dropped; missing ones come back as fresh.
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
// Clamped, not just coerced: a finite but absurd counter would render as a
// 13-digit streak. Nothing legitimate approaches this.
const CAP = 1e6;
const whole = (v, d = 0) => Math.min(CAP, Math.max(0, Math.round(num(v, d))));
function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const src = (raw.cards && typeof raw.cards === "object") ? raw.cards : {};
  const cards = {};
  for (const c of CARDS) {
    const s = src[c.id];
    cards[c.id] = (s && typeof s === "object")
      ? { box: Math.min(MAX_BOX, Math.max(1, Math.round(num(s.box, 1)))),
          correct: whole(s.correct), wrong: whole(s.wrong),
          seen: whole(s.seen), lastSession: whole(s.lastSession) }
      : freshCardState();
  }
  const lp = raw.lastPracticed;
  return { version: 1, cards,
    totalSessions: whole(raw.totalSessions), streak: whole(raw.streak), bestStreak: whole(raw.bestStreak),
    lastPracticed: (typeof lp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lp)) ? lp : null };
}

async function exportBackup() {
  const progress = {};
  for (const p of profiles) {
    const s = parse(await readKey(progressKey(p.id)));
    if (s) progress[p.id] = s;
  }
  const payload = {
    app: BACKUP_APP, format: BACKUP_FORMAT, deck: DECK_ID,
    exportedAt: new Date().toISOString(), cardCount: CARDS.length,
    profiles: profiles.map(p => ({ id: p.id, name: p.name, created: p.created })),
    progress,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "la-cave-progress-" + ymd(new Date()) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (e) { alert("That file could not be read as JSON."); return; }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.profiles)) {
    alert("That does not look like a La Cave backup."); return;
  }
  let added = 0, replaced = 0, skipped = 0;
  for (const p of data.profiles) {
    const name = (String(p && p.name || "").trim() || "Taster").slice(0, 32);
    const restored = sanitizeState(data.progress && data.progress[p && p.id]);
    if (!restored) { skipped++; continue; }
    // Same name means the same person moving devices: offer to replace rather
    // than silently creating a duplicate.
    const existing = profiles.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!confirm("Replace " + existing.name + "'s progress with the backup? This cannot be undone.")) { skipped++; continue; }
      writeKey(progressKey(existing.id), JSON.stringify(restored));
      replaced++;
    } else {
      const who = { id: newProfileId(), name, created: whole(p.created, Date.now()) };
      profiles.push(who);
      writeKey(progressKey(who.id), JSON.stringify(restored));
      added++;
    }
  }
  if (added || replaced) { saveProfiles(); await adoptActiveProfile(); }
  renderProfiles(); renderHome();
  alert("Restored from backup.\n" + added + " taster(s) added, " + replaced + " replaced" +
        (skipped ? ", " + skipped + " skipped." : "."));
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
  $("toDecks").onclick = async () => { await renderDecks(); show("decks"); };
  $("deckWhoBtn").onclick = () => { renderProfiles(); show("profiles"); };
  $("resetBtn").onclick = async () => {
    const who = activeProfile();
    if (!confirm("Reset every card, streak and stat for " + (who ? who.name : "this taster") + "?")) return;
    await clearState();
    state = freshState(); saveState(state); renderCellar(); renderHome();
  };
  $("toProfiles").onclick = () => { renderProfiles(); show("profiles"); };
  $("profilesBack").onclick = backFromProfiles;
  $("addProfileBtn").onclick = addProfile;
  $("exportBtn").onclick = exportBackup;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";                 // so the same file can be picked twice
    if (file) await importBackup(file);
  };
  document.addEventListener("keydown", e => {
    if (!$("session").classList.contains("active")) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!revealed) flip(); }
    else if (revealed && (e.key === "1" || e.key === "ArrowLeft")) { e.preventDefault(); answer(false); }
    else if (revealed && (e.key === "2" || e.key === "ArrowRight")) { e.preventDefault(); answer(true); }
  });
}

/* ---------------- decks ----------------
   data/decks.json is the index. Adding a deck is adding an entry plus its card
   file. Note that only wine-shaped cards render today: a deck of a different
   shape also needs card-type work (PLAN.md Part 2, D1/D5).               */
async function loadDecks() {
  const res = await fetch("./data/decks.json");
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) throw new Error("decks.json is empty");
  return list;
}

async function chooseDeck(id) {
  const deck = DECKS.find(d => d.id === id) || DECKS[0];
  try {
    CARDS = await (await fetch(deck.file)).json();
  } catch (e) {
    alert("Could not load that deck.");
    return;
  }
  DECK = deck;
  DECK_ID = deck.id;
  BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
  writeKey(LAST_DECK_KEY, deck.id);
  $("deckName").textContent = deck.name;
  $("deckTagline").textContent = deck.tagline || "";
  // The tab is how you find this among a dozen others, so name the deck in it.
  document.title = APP_NAME + " — " + deck.name;
  $("cardCount").textContent = CARDS.length;
  // Progress is keyed by deck, so this reloads the right saved state.
  await adoptActiveProfile();
  renderHome();
  show("home");
}

// Per-deck summary for the chooser, read from storage rather than from the
// active state, since the point is to show decks you are not currently in.
async function deckSummary(deck) {
  const s = parse(await readKey("srs_v2:" + activeId + ":" + deck.id));
  if (!s || !s.cards) return "not started";
  const cards = Object.values(s.cards);
  const mastered = cards.filter(c => c.box >= 5).length;
  const seen = cards.filter(c => c.seen > 0).length;
  if (!s.totalSessions) return "not started";
  return `${s.totalSessions} flight${s.totalSessions === 1 ? "" : "s"} \u00b7 ${mastered} mastered \u00b7 ${seen} seen`;
}

async function renderDecks() {
  document.title = APP_NAME;          // no deck loaded yet
  $("deckWho").textContent = (activeProfile() || {}).name || "Me";
  const list = $("deckList");
  list.innerHTML = DECKS.map(d => `
    <li><button class="deckrow" data-id="${d.id}">
      <span class="dname"></span><span class="dsub"></span>
      <span class="dprog" id="dp-${d.id}">&hellip;</span>
    </button></li>`).join("");
  // Deck names come from a data file; set them as text, not markup.
  for (const d of DECKS) {
    const row = list.querySelector(`.deckrow[data-id="${d.id}"]`);
    if (!row) continue;
    row.querySelector(".dname").textContent = d.name;
    row.querySelector(".dsub").textContent = d.subtitle || "";
  }
  for (const d of DECKS) {
    const el = $("dp-" + d.id);
    if (el) el.textContent = await deckSummary(d);
  }
  list.onclick = (e) => {
    const b = e.target.closest(".deckrow");
    if (b) chooseDeck(b.dataset.id);
  };
}

/* ---------------- boot ---------------- */
async function boot() {
  try {
    DECKS = await loadDecks();
  } catch (e) {
    document.getElementById("deckLead").textContent =
      "Could not load decks.json. Run this through a local server (see README).";
    show("decks");
    return;
  }
  const persistence = await requestPersistence();
  await probeBackend();
  await loadProfiles();
  console.info("[store] backend=" + backend + " persistence=" + persistence +
               " profiles=" + profiles.length + " decks=" + DECKS.length);
  wire();
  renderProfileChip();
  // The deck chooser is the front page. The last deck used is only remembered
  // so its row can be highlighted, not to skip the screen.
  const last = await readKey(LAST_DECK_KEY);
  if (last && DECKS.some(d => d.id === last)) DECK_ID = last;
  await renderDecks();
  show("decks");
}

// Loads the active profile's progress into `state`. Called at boot and on every
// profile switch, so switching is just a reload of this one object.
async function adoptActiveProfile() {
  const saved = await loadState();
  state = freshState();
  if (saved && saved.cards) {
    state = Object.assign(state, saved, { cards: Object.assign(freshState().cards, saved.cards) });
  }
  // Persist the merged state right away: it populates the localStorage mirror
  // before the first answer, and gives any newly added cards their entries.
  saveState(state);
  renderProfileChip();
}

function renderProfileChip() {
  const who = activeProfile();
  const label = who ? who.name : "Me";
  $("whoName").textContent = label;
  $("profileWho").textContent = label;
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
