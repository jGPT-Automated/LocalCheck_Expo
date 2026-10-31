import assert from "node:assert/strict";
import test from "node:test";

import {
  SCHEDULE_WINDOW_ROWS,
  SCHEDULE_WINDOW_STARTS,
  scheduleSlotIndex,
  scheduleSlotLabel,
  scheduleWindowForHour,
  SLOT_HOURS,
} from "./scheduleModel.ts";

test("uses a continuous one-hour 4 AM through 11 PM axis", () => {
  assert.deepEqual(SLOT_HOURS, Array.from({ length: 20 }, (_, index) => index + 4));
  assert.equal(scheduleSlotLabel(SLOT_HOURS[0]), "4 AM");
  assert.equal(scheduleSlotLabel(12), "12 PM");
  assert.equal(scheduleSlotLabel(SLOT_HOURS.at(-1)!), "11 PM");
});

test("maps local clock hours to the expected schedule row", () => {
  assert.equal(scheduleSlotIndex(4), 0);
  assert.equal(scheduleSlotIndex(12), 8);
  assert.equal(scheduleSlotIndex(23), 19);
  assert.equal(scheduleSlotIndex(2), 0);
});

test("two 12-hour windows, 4 AM-3 PM and 12 PM-11 PM, overlapping at midday", () => {
  const [morning, evening] = SCHEDULE_WINDOW_STARTS;
  assert.equal(SLOT_HOURS[morning], 4);
  assert.equal(SLOT_HOURS[morning + SCHEDULE_WINDOW_ROWS - 1], 15);
  assert.equal(SLOT_HOURS[evening], 12);
  assert.equal(SLOT_HOURS[evening + SCHEDULE_WINDOW_ROWS - 1], 23);
  assert.equal(scheduleWindowForHour(9), 0);
  assert.equal(scheduleWindowForHour(19), 1);
});
