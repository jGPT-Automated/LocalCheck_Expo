import assert from "node:assert/strict";
import test from "node:test";

import {
  scheduleSlotIndex,
  scheduleSlotLabel,
  SLOT_HOURS,
} from "./scheduleModel.ts";

test("uses a continuous one-hour 8 AM through 10 PM axis", () => {
  assert.deepEqual(SLOT_HOURS, Array.from({ length: 15 }, (_, index) => index + 8));
  assert.equal(scheduleSlotLabel(SLOT_HOURS[0]), "8 AM");
  assert.equal(scheduleSlotLabel(12), "12 PM");
  assert.equal(scheduleSlotLabel(SLOT_HOURS.at(-1)!), "10 PM");
});

test("maps local clock hours to the expected schedule row", () => {
  assert.equal(scheduleSlotIndex(8), 0);
  assert.equal(scheduleSlotIndex(12), 4);
  assert.equal(scheduleSlotIndex(19), 11);
  assert.equal(scheduleSlotIndex(22), 14);
});

test("clamps the initial scroll target to the visible schedule axis", () => {
  assert.equal(scheduleSlotIndex(7), 0);
  assert.equal(scheduleSlotIndex(23), 14);
});
