import assert from "node:assert/strict";
import { test } from "node:test";

import { courtHours, formatAverageSession, formatCourtHours, formatNextGame, formatTimeOnCourt } from "./courtHours.ts";

const now = Date.parse("2026-10-14T20:00:00Z");
const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();

test("adds up closed sessions", () => {
  const result = courtHours(
    [
      { checked_in_at: at(10), checked_out_at: at(8) },
      { checked_in_at: at(5), checked_out_at: at(4.5) },
    ],
    now,
  );
  assert.equal(result.sessions, 2);
  assert.equal(result.hours, 2.5);
});

test("caps a long session at 4 hours", () => {
  const result = courtHours([{ checked_in_at: at(30), checked_out_at: at(20) }], now);
  assert.equal(result.hours, 4);
});

test("closes a forgotten check-out at 3 hours, or now if sooner", () => {
  assert.equal(courtHours([{ checked_in_at: at(9), checked_out_at: null }], now).hours, 3);
  assert.equal(courtHours([{ checked_in_at: at(1), checked_out_at: null }], now).hours, 1);
});

test("skips bad and future rows", () => {
  const result = courtHours(
    [
      { checked_in_at: "nope", checked_out_at: null },
      { checked_in_at: at(-1), checked_out_at: null },
      { checked_in_at: at(2), checked_out_at: at(3) },
    ],
    now,
  );
  assert.deepEqual(result, { hours: 0, sessions: 0 });
});

test("formats hours, average session and next game", () => {
  assert.equal(formatCourtHours(69.6), "70h");
  assert.equal(formatAverageSession({ hours: 0, sessions: 0 }), "—");
  assert.equal(formatAverageSession({ hours: 1.5, sessions: 2 }), "45m");
  assert.equal(formatAverageSession({ hours: 4, sessions: 3 }), "1h 20m");
  assert.equal(formatAverageSession({ hours: 2, sessions: 1 }), "2h");
  assert.equal(formatNextGame(null), "—");
  const evening = new Date(2026, 9, 14, 18, 30).toISOString();
  assert.equal(formatNextGame(evening), "6:30P");
  const noon = new Date(2026, 9, 14, 12, 0).toISOString();
  assert.equal(formatNextGame(noon), "12P");
});

test("time on court reads Now, minutes, then hours and minutes", () => {
  const now = Date.parse("2026-10-15T18:00:00Z");
  assert.equal(formatTimeOnCourt(undefined, now), null);
  assert.equal(formatTimeOnCourt("2026-10-15T17:59:40Z", now), "Now");
  assert.equal(formatTimeOnCourt("2026-10-15T17:22:00Z", now), "38m");
  assert.equal(formatTimeOnCourt("2026-10-15T16:50:00Z", now), "1h 10m");
  assert.equal(formatTimeOnCourt("2026-10-15T16:00:00Z", now), "2h");
});
