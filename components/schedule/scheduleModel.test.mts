import assert from "node:assert/strict";
import test from "node:test";

import {
  SCHEDULE_WINDOW_ROWS,
  SCHEDULE_WINDOW_STARTS,
  scheduleSlotIndex,
  scheduleSlotLabel,
  scheduleGridLayout,
  scheduleGridStart,
  scheduleWindowForHour,
  SLOT_HOURS,
} from "./scheduleModel.ts";

test("uses a continuous one-hour 4 AM through 11 PM axis", () => {
  assert.deepEqual(SLOT_HOURS, Array.from({ length: 20 }, (_, index) => index + 4));
  assert.equal(scheduleSlotLabel(SLOT_HOURS[0]), "4 AM");
  assert.equal(scheduleSlotLabel(12), "12 PM");
  assert.equal(scheduleSlotLabel(SLOT_HOURS.at(-1)!), "11 PM");
});

test("short heatmaps keep 44pt cells and expose every hour through overlapping windows", () => {
  for (const height of [96, 150, 240, 350, 430, 576, 720]) {
    const grid = scheduleGridLayout(height);
    assert.ok(grid.rowPitch - 3 >= 44);
    assert.ok(grid.viewportHeight <= height);
    assert.equal(grid.starts[0], 0);
    assert.equal(grid.starts.at(-1), SLOT_HOURS.length - grid.visibleRows);
    for (let i = 0; i < SLOT_HOURS.length; i++) {
      assert.ok(grid.starts.some((start) => start <= i && i < start + grid.visibleRows), `hour ${SLOT_HOURS[i]} at ${height}`);
      const initial = scheduleGridStart(grid, SLOT_HOURS[i]);
      assert.ok(initial <= i && i < initial + grid.visibleRows, `initial hour ${SLOT_HOURS[i]} at ${height}`);
    }
    assert.ok(grid.starts.at(-1)! * grid.rowPitch + grid.viewportHeight <= SLOT_HOURS.length * grid.rowPitch);
  }
});

test("grid keeps the existing 12-row defaults and preserves a nearby top row after resize", () => {
  const full = scheduleGridLayout(576);
  assert.deepEqual(full.starts, [0, 8]);
  assert.equal(scheduleGridStart(full, 9), 0);
  assert.equal(scheduleGridStart(full, 19), 8);
  const short = scheduleGridLayout(240);
  assert.equal(scheduleGridStart(short, 19, 12), 12);
  assert.ok(short.starts.includes(scheduleGridStart(short, 19, 13)));
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
