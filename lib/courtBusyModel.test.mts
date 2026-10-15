import assert from "node:assert/strict";
import { test } from "node:test";

import { busyCaption, busyDay, hourLabel } from "./courtBusyModel.ts";

// Local-time instants so the test holds in any time zone.
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(2026, 9, 15, 0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const now = at(0, 15, 30).getTime();

test("today: earlier hours are actual, this hour is now, later hours are planned", () => {
  const bars = busyDay({
    dayOffset: 0,
    now,
    spans: [{ checked_in_at: at(0, 9, 10).toISOString(), checked_out_at: at(0, 11, 20).toISOString() }],
    planned: [at(0, 18, 0)],
    games: [{ startIso: at(0, 18, 30).toISOString(), going: 6 }],
  });
  const byHour = new Map(bars.map((bar) => [bar.hour, bar]));
  assert.equal(byHour.get(9)?.kind, "past");
  assert.equal(byHour.get(9)?.value, 1);
  assert.equal(byHour.get(11)?.value, 1);
  assert.equal(byHour.get(12)?.value, 0);
  assert.equal(byHour.get(15)?.kind, "now");
  assert.equal(byHour.get(18)?.kind, "planned");
  assert.equal(byHour.get(18)?.value, 7);
});

test("a session still open counts as on court now", () => {
  const bars = busyDay({
    dayOffset: 0,
    now,
    spans: [{ checked_in_at: at(0, 15, 0).toISOString(), checked_out_at: null }],
    planned: [],
    games: [],
  });
  assert.equal(bars.find((bar) => bar.kind === "now")?.value, 1);
});

test("past days are all actual, future days all planned", () => {
  const past = busyDay({ dayOffset: -2, now, spans: [], planned: [], games: [] });
  const future = busyDay({ dayOffset: 2, now, spans: [], planned: [at(2, 10)], games: [] });
  assert.ok(past.every((bar) => bar.kind === "past"));
  assert.ok(future.every((bar) => bar.kind === "planned"));
  assert.equal(future.find((bar) => bar.hour === 10)?.value, 1);
});

test("labels and captions", () => {
  assert.equal(hourLabel(6), "6A");
  assert.equal(hourLabel(12), "12P");
  assert.equal(hourLabel(22), "10P");
  const empty = busyDay({ dayOffset: 1, now, spans: [], planned: [], games: [] });
  assert.equal(busyCaption(empty, 1), "No plans yet");
});
