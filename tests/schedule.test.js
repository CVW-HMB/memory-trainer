// The scheduler is the product: if these numbers move, that is a bug, not a new
// baseline. Run with `npm test` (node --test, no dependencies).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  INTERVAL, MAX_BOX, FLIGHT_SIZE, NEW_PER_FLIGHT,
  freshCardState, isNew, isDue, dueCards, weakFirst, buildQueue,
  applyAnswer, ymd, daysBetween, nextStreak,
} from "../src/engine/schedule.js";

/* ---------------- helpers ---------------- */
const deck = n => Array.from({ length: n }, (_, i) => ({ id: "c" + i, group: "France" }));
const states = cards => Object.fromEntries(cards.map(c => [c.id, freshCardState()]));
// Deterministic rand so ordering assertions cannot flake.
const seeded = (s = 1) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const seen = (st, { box = 1, lastSession = 1 }) => Object.assign(st, { box, lastSession, seen: 1 });

/* ---------------- box arithmetic ---------------- */
describe("box promotion and demotion", () => {
  test("a correct answer promotes one box", () => {
    const s = freshCardState();
    applyAnswer(s, true, 1);
    assert.equal(s.box, 2);
    assert.equal(s.correct, 1);
    assert.equal(s.wrong, 0);
    assert.equal(s.seen, 1);
    assert.equal(s.lastSession, 1);
  });

  test("promotion caps at MAX_BOX", () => {
    const s = freshCardState();
    for (let i = 0; i < 10; i++) applyAnswer(s, true, i + 1);
    assert.equal(s.box, MAX_BOX);
    assert.equal(s.box, 5);
    assert.equal(s.correct, 10);
  });

  test("a miss drops straight to box 1 from any box", () => {
    for (let box = 1; box <= MAX_BOX; box++) {
      const s = Object.assign(freshCardState(), { box });
      applyAnswer(s, false, 7);
      assert.equal(s.box, 1, `box ${box} should reset to 1`);
      assert.equal(s.wrong, 1);
      assert.equal(s.lastSession, 7);
    }
  });

  test("lastSession records the flight the card was answered in", () => {
    const s = freshCardState();
    applyAnswer(s, true, 3);
    applyAnswer(s, false, 9);
    assert.equal(s.lastSession, 9);
    assert.equal(s.seen, 2);
    assert.equal(s.correct, 1);
    assert.equal(s.wrong, 1);
  });
});

/* ---------------- due arithmetic ---------------- */
describe("INTERVAL due arithmetic", () => {
  test("an unseen card is always due", () => {
    assert.equal(isDue(freshCardState(), 1), true);
    assert.equal(isDue(undefined, 1), true);
    assert.equal(isDue(freshCardState(), 999), true);
  });

  test("each box comes due exactly INTERVAL[box] sessions later, not before", () => {
    for (let box = 1; box <= MAX_BOX; box++) {
      const wait = INTERVAL[box];
      const s = seen(freshCardState(), { box, lastSession: 10 });
      for (let gap = 0; gap < wait; gap++) {
        assert.equal(isDue(s, 10 + gap), false, `box ${box} must not be due after ${gap} sessions`);
      }
      assert.equal(isDue(s, 10 + wait), true, `box ${box} must be due after ${wait} sessions`);
      assert.equal(isDue(s, 10 + wait + 5), true, `box ${box} stays due once overdue`);
    }
  });

  test("the interval table is the documented one", () => {
    assert.deepEqual(INTERVAL, { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 });
  });

  test("an out-of-range box falls back to a one-session interval", () => {
    const s = seen(freshCardState(), { box: 99, lastSession: 4 });
    assert.equal(isDue(s, 4), false);
    assert.equal(isDue(s, 5), true);
  });

  test("dueCards returns only cards that are due", () => {
    const cards = deck(4);
    const st = states(cards);
    seen(st.c0, { box: 5, lastSession: 1 });   // due at 9
    seen(st.c1, { box: 1, lastSession: 1 });   // due at 2
    seen(st.c2, { box: 3, lastSession: 1 });   // due at 3
    // c3 never seen -> always due
    assert.deepEqual(dueCards(cards, st, 3).map(c => c.id), ["c1", "c2", "c3"]);
  });
});

/* ---------------- streaks ---------------- */
describe("streaks across day boundaries", () => {
  test("a consecutive day extends the streak", () => {
    assert.equal(nextStreak(4, "2026-08-27", "2026-08-28"), 5);
    assert.equal(nextStreak(0, "2026-08-27", "2026-08-28"), 1);
  });

  test("a skipped day restarts the streak at 1", () => {
    assert.equal(nextStreak(9, "2026-08-26", "2026-08-28"), 1);
    assert.equal(nextStreak(40, "2026-01-01", "2026-08-28"), 1);
  });

  test("the first ever session starts a streak of 1", () => {
    assert.equal(nextStreak(0, null, "2026-08-28"), 1);
    assert.equal(nextStreak(undefined, undefined, "2026-08-28"), 1);
  });

  test("month, year and leap-day boundaries still count as consecutive", () => {
    assert.equal(nextStreak(2, "2026-08-31", "2026-09-01"), 3);
    assert.equal(nextStreak(2, "2026-12-31", "2027-01-01"), 3);
    assert.equal(nextStreak(2, "2028-02-28", "2028-02-29"), 3); // 2028 is a leap year
    assert.equal(nextStreak(2, "2028-02-29", "2028-03-01"), 3);
  });

  test("daysBetween survives a daylight-saving transition", () => {
    // 23- or 25-hour days must still round to one calendar day.
    assert.equal(daysBetween("2026-03-07", "2026-03-08"), 1);
    assert.equal(daysBetween("2026-10-31", "2026-11-01"), 1);
  });

  test("ymd formats a date as YYYY-MM-DD", () => {
    assert.equal(ymd(new Date("2026-08-28T12:00:00Z")), "2026-08-28");
  });
});

/* ---------------- flight cap ---------------- */
describe("flight cap", () => {
  test("the first flight on a fresh 100-card deck is FLIGHT_SIZE, not 100", () => {
    const cards = deck(100);
    const q = buildQueue(cards, states(cards), 1, seeded());
    assert.equal(q.length, FLIGHT_SIZE);
    assert.equal(q.length, 20);
  });

  test("a flight never repeats a card", () => {
    const cards = deck(100);
    const st = states(cards);
    const rand = seeded(7);
    for (let flight = 1; flight <= 40; flight++) {
      const q = buildQueue(cards, st, flight, rand);
      assert.equal(new Set(q).size, q.length, `flight ${flight} repeated a card`);
      for (const id of q) applyAnswer(st[id], flight % 4 !== 0, flight);
    }
  });

  test("a flight serves exactly min(FLIGHT_SIZE, due)", () => {
    const cards = deck(100);
    const st = states(cards);
    const rand = seeded(11);
    for (let flight = 1; flight <= 40; flight++) {
      const expected = Math.min(FLIGHT_SIZE, dueCards(cards, st, flight).length);
      const q = buildQueue(cards, st, flight, rand);
      assert.equal(q.length, expected, `flight ${flight}`);
      for (const id of q) applyAnswer(st[id], true, flight);
    }
  });

  test("every card served is actually due", () => {
    const cards = deck(60);
    const st = states(cards);
    const rand = seeded(3);
    for (let flight = 1; flight <= 15; flight++) {
      const due = new Set(dueCards(cards, st, flight).map(c => c.id));
      for (const id of buildQueue(cards, st, flight, rand)) {
        assert.ok(due.has(id), `flight ${flight} served ${id}, which was not due`);
        applyAnswer(st[id], true, flight);
      }
    }
  });

  test("at most NEW_PER_FLIGHT new cards once there are enough reviews", () => {
    const cards = deck(100);
    const st = states(cards);
    // 40 cards already seen and all due, so reviews can fill the flight
    for (let i = 0; i < 40; i++) seen(st["c" + i], { box: 1, lastSession: 1 });
    const q = buildQueue(cards, st, 2, seeded(5));
    const fresh = q.filter(id => isNew(st[id]));
    assert.equal(q.length, FLIGHT_SIZE);
    assert.equal(fresh.length, NEW_PER_FLIGHT);
  });

  test("the flight tops up with new cards when reviews run short", () => {
    const cards = deck(100);
    const st = states(cards);
    for (let i = 0; i < 3; i++) seen(st["c" + i], { box: 1, lastSession: 1 }); // only 3 reviews
    const q = buildQueue(cards, st, 2, seeded(5));
    assert.equal(q.length, FLIGHT_SIZE, "must still fill the flight");
    assert.equal(q.filter(id => isNew(st[id])).length, FLIGHT_SIZE - 3);
  });

  test("new cards are introduced in deck order", () => {
    const cards = deck(100);
    const st = states(cards);
    for (let i = 50; i < 100; i++) seen(st["c" + i], { box: 1, lastSession: 1 });
    const q = buildQueue(cards, st, 2, seeded(9));
    const freshServed = q.filter(id => isNew(st[id]));
    assert.deepEqual(freshServed.slice().sort((a, b) => +a.slice(1) - +b.slice(1)),
                     ["c0", "c1", "c2", "c3", "c4"]);
  });

  test("a deck smaller than a flight serves the whole deck", () => {
    const cards = deck(6);
    const q = buildQueue(cards, states(cards), 1, seeded());
    assert.equal(q.length, 6);
    assert.equal(new Set(q).size, 6);
  });

  test("with nothing due, a free flight still runs", () => {
    const cards = deck(100);
    const st = states(cards);
    for (const c of cards) seen(st[c.id], { box: 5, lastSession: 100 }); // none due at session 101
    assert.equal(dueCards(cards, st, 101).length, 0);
    const q = buildQueue(cards, st, 101, seeded());
    assert.equal(q.length, FLIGHT_SIZE);
    assert.equal(new Set(q).size, FLIGHT_SIZE);
  });

  test("the whole deck is still learnable over repeated flights", () => {
    const cards = deck(100);
    const st = states(cards);
    const rand = seeded(42);
    for (let flight = 1; flight <= 20; flight++) {
      for (const id of buildQueue(cards, st, flight, rand)) applyAnswer(st[id], true, flight);
    }
    assert.equal(cards.filter(c => isNew(st[c.id])).length, 0, "every card should have been introduced");
  });
});

/* ---------------- ordering ---------------- */
describe("weak-first ordering", () => {
  test("weaker boxes come first when the jitter is removed", () => {
    const cards = deck(5);
    const st = states(cards);
    [5, 3, 1, 4, 2].forEach((box, i) => seen(st["c" + i], { box }));
    const zero = () => 0;
    assert.deepEqual(weakFirst(cards, st, zero).map(c => c.id), ["c2", "c4", "c1", "c3", "c0"]);
  });

  test("the jitter can reorder adjacent boxes but not distant ones", () => {
    const cards = deck(2);
    const st = states(cards);
    seen(st.c0, { box: 5 });
    seen(st.c1, { box: 1 });
    // jitter is 1.15, well under the 4-box gap, so c1 always leads
    for (let i = 0; i < 200; i++) {
      assert.equal(weakFirst(cards, st, Math.random)[0].id, "c1");
    }
  });

  test("weakFirst does not mutate the array it is given", () => {
    const cards = deck(4);
    const before = cards.map(c => c.id);
    weakFirst(cards, states(cards), seeded());
    assert.deepEqual(cards.map(c => c.id), before);
  });

  test("weakFirst does not write scratch fields onto cards", () => {
    const cards = deck(3);
    weakFirst(cards, states(cards), seeded());
    for (const c of cards) assert.deepEqual(Object.keys(c), ["id", "group"]);
  });
});
