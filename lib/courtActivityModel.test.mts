import assert from "node:assert/strict";
import { test } from "node:test";
import {
  courtHourSlot,
  courtHourStart,
  chartHourAt,
  courtHourEvents,
} from "./courtActivityModel.ts";
process.env.TZ = 'America/Chicago';
const now = new Date(2026, 9, 17, 18, 30).getTime();
const pick = { dayOffset: 1, hour: 19 };
const time = courtHourStart(pick, now).toISOString();
const player = { id: "a", name: "Jesse", avatar: "JE" };
const visit = {
  id: "v1",
  courtId: "c",
  userId: "a",
  player,
  plannedAtIso: time,
};
const game = {
  id: "g",
  courtId: "c",
  startTimeIso: time,
  participants: [player, { id: "b", name: "Sam", avatar: "SA" }],
};
test("one person with multiple plans and a game is named once; private plans remain anonymous", () => {
  const slot = courtHourSlot({
    courtId: "c",
    pick,
    now,
    visits: [
      visit,
      { ...visit, id: "v2" },
      { ...visit, courtId: "other" },
    ] as any,
    anonymousTimes: [new Date(time), new Date(time), new Date(time)],
    games: [game] as any,
    meId: "a",
  });
  assert.equal(slot.total, 3);
  assert.equal(slot.hidden, 1);
  assert.equal(slot.attendees.length, 2);
  assert.equal(slot.mine.length, 2);
  assert.equal(slot.attendees[0].visitId, "v1");
});
test("hour boundaries exclude next hour and other courts", () => {
  const next = courtHourStart({ ...pick, hour: 20 }, now).toISOString();
  const slot = courtHourSlot({
    courtId: "c",
    pick,
    now,
    visits: [{ ...visit, plannedAtIso: next }] as any,
    anonymousTimes: [],
    games: [{ ...game, courtId: "other" }] as any,
    meId: "a",
  });
  assert.equal(slot.total, 0);
  assert.equal(
    courtHourEvents(
      [{ occurredAtIso: time }, { occurredAtIso: next }] as any,
      pick,
      now,
    ).length,
    1,
  );
});
test("scrubbing clamps outside the chart and maps its full width to the full day", () => {
  assert.equal(chartHourAt(-10, 170), 6);
  assert.equal(chartHourAt(0, 170), 6);
  assert.equal(chartHourAt(85, 170), 14);
  assert.equal(chartHourAt(170, 170), 22);
  assert.equal(chartHourAt(300, 170), 22);
});
test("tomorrow and hour windows use local calendar arithmetic", () => {
  const late = new Date(2026, 10, 1, 0, 30).getTime();
  const d = courtHourStart({ dayOffset: 1, hour: 19 }, late);
  assert.equal(d.getDate(), 2);
  assert.equal(d.getHours(), 19);
  assert.equal(d.getTime() - late, 43.5 * 3_600_000);
});
