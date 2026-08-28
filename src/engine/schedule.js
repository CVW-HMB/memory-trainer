// The Leitner scheduler. Deliberately pure: no DOM, no globals, no storage, and
// no knowledge of what a card contains beyond its `id`. Everything it needs is
// passed in, so it can be exercised by `node --test`.
//
// These numbers are the product. Changing them changes what mastery means, so
// they are covered by tests/schedule.test.js -- if those fail, the behaviour
// moved, and that is a bug rather than a new baseline.

export const INTERVAL = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 10 }; // box -> sessions until due
export const MAX_BOX = 5;

// A flight is capped so a session stays a habit rather than a chore. This caps
// how many of the due cards get served; it does not affect the box arithmetic.
export const FLIGHT_SIZE = 35;    // cards served per flight
export const NEW_PER_FLIGHT = 5;  // at most this many never-seen cards per flight

// Review seats reserved for the longest-overdue cards, whatever their box.
// Weak-first ordering alone starves mastered cards: they sort last every
// flight, so on a deck bigger than a flight can drain they simply stop coming
// up. Measured on the 200-card deck over 400 flights, the worst card went 55
// sessions unseen; with these seats reserved that falls to 19, and *more*
// cards reach box 5, not fewer.
export const OVERDUE_SLOTS = 4;

export const freshCardState = () => ({ box: 1, correct: 0, wrong: 0, seen: 0, lastSession: 0 });

export const isNew = s => (s?.seen || 0) === 0;

// `cur` is the session number the card would be answered in.
export function isDue(s, cur) {
  if (!s || s.seen === 0) return true;
  return (cur - s.lastSession) >= (INTERVAL[s.box] || 1);
}

export function dueCards(cards, states, cur) {
  return cards.filter(c => isDue(states[c.id], cur));
}

// Sessions a card is past its due point. Negative means not yet due; a card
// that has never been seen counts as 0 so it does not crowd out real reviews.
export function overdueBy(s, cur) {
  if (!s || s.seen === 0) return 0;
  return (cur - s.lastSession) - (INTERVAL[s.box] || 1);
}

// Longest-overdue first, with the same jitter as weakFirst so equally overdue
// cards do not lock into a fixed order.
export function mostOverdue(cards, states, cur, rand = Math.random) {
  return cards
    .map(c => ({ c, k: -overdueBy(states[c.id], cur) + rand() * 1.15 }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.c);
}

// How likely a due card is to be drawn into a flight, by box. A miss sends a
// card straight back to box 1, so box 1 is "most missed" and box 5 is "most
// recognised". 80 against 20 is a deliberately strong 4:1 pull toward the cards
// you keep getting wrong.
export const BOX_WEIGHT = { 1: 80, 2: 65, 3: 50, 4: 35, 5: 20 };
export const weightFor = s => BOX_WEIGHT[(s && s.box) || 1] || BOX_WEIGHT[5];

// Weighted sampling without replacement (Efraimidis-Spirakis): each candidate
// draws a key U^(1/w) and the k largest keys win. Every flight is a fresh draw,
// so the selection genuinely varies run to run instead of always serving the
// same weakest cards, while still pulling hard toward them.
export function weightedSample(cards, states, k, rand = Math.random) {
  if (k <= 0) return [];
  return cards
    .map(c => ({ c, key: Math.pow(rand() || Number.MIN_VALUE, 1 / weightFor(states[c.id])) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map(x => x.c);
}

// Weakest boxes first, jittered so the same cards do not come up in the same
// order every flight. The jitter (1.15) is wider than one box, so a box-2 card
// can occasionally precede a box-1 card. This is presentation order only; what
// gets into the flight is decided by weightedSample.
export function weakFirst(cards, states, rand = Math.random) {
  return cards
    .map(c => ({ c, k: (states[c.id]?.box || 1) + rand() * 1.15 }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.c);
}

// Selects up to FLIGHT_SIZE card ids from everything due. New material is
// introduced at a trickle (NEW_PER_FLIGHT) in deck order, which is the
// curriculum order. The review budget is then split: OVERDUE_SLOTS seats go to
// the longest-overdue cards so nothing can be starved indefinitely, and the
// rest are drawn by weighted random sampling, favouring the cards you miss.
// If there are not enough reviews the flight tops up with more new cards, so it
// is always as full as the due pool allows. Each card appears at most once.
export function buildQueue(cards, states, cur, rand = Math.random) {
  let due = dueCards(cards, states, cur);
  if (due.length === 0) due = cards.slice(); // free review: nothing forced today

  const fresh = due.filter(c => isNew(states[c.id]));   // deck order preserved
  const review = due.filter(c => !isNew(states[c.id]));

  const picked = fresh.slice(0, NEW_PER_FLIGHT);
  const budget = FLIGHT_SIZE - picked.length;

  const reserved = mostOverdue(review, states, cur, rand).slice(0, Math.min(OVERDUE_SLOTS, budget));
  const taken = new Set(reserved.map(c => c.id));
  const pool = review.filter(c => !taken.has(c.id));
  picked.push(...reserved, ...weightedSample(pool, states, budget - reserved.length, rand));

  if (picked.length < FLIGHT_SIZE) {
    picked.push(...fresh.slice(NEW_PER_FLIGHT, NEW_PER_FLIGHT + FLIGHT_SIZE - picked.length));
  }
  return weakFirst(picked, states, rand).map(c => c.id);
}

// Within a flight, a missed card comes back until it is answered correctly. It
// is re-inserted a few cards later rather than immediately, so it is a genuine
// re-test; if fewer than `gap` cards remain it lands at the end. The flight is
// not finished until every card in it has been cleared.
export const REDRILL_GAP = 5;

export function redrill(queue, pos, gap = REDRILL_GAP) {
  const next = queue.slice();
  const at = Math.min(pos + 1 + gap, next.length);
  next.splice(at, 0, next[pos]);
  return next;
}

// Correct promotes one box (capped); a miss drops straight back to box 1.
// Mutates and returns the card's state.
export function applyAnswer(s, correct, sessionNo) {
  s.seen += 1;
  s.lastSession = sessionNo;
  if (correct) { s.correct += 1; s.box = Math.min(MAX_BOX, s.box + 1); }
  else { s.wrong += 1; s.box = 1; }
  return s;
}

export const ymd = d => d.toISOString().slice(0, 10);
export const daysBetween = (a, b) =>
  Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);

// Consecutive calendar days extend the streak; any gap restarts it at 1.
// Only called when `today` differs from `lastPracticed`.
export function nextStreak(prevStreak, lastPracticed, today) {
  if (lastPracticed && daysBetween(lastPracticed, today) === 1) return (prevStreak || 0) + 1;
  return 1;
}
