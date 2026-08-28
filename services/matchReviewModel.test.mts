import assert from "node:assert/strict";
import test from "node:test";

import { formatRemainingTime, matchStatusCopy, remainingTime } from "./matchReviewModel.ts";

test("formats multi-day and sub-day review clocks", () => {
  const now = Date.parse("2026-08-28T12:00:00Z");
  assert.equal(formatRemainingTime("2026-08-30T15:04:00Z", now), "2D 03H 04M");
  assert.equal(formatRemainingTime("2026-08-28T13:02:03Z", now), "01H 02M 03S");
  assert.equal(remainingTime("2026-08-27T12:00:00Z", now).totalSeconds, 0);
});

test("status copy distinguishes review, hold, final, and void", () => {
  assert.equal(matchStatusCopy("pending").countdownLabel, "AUTO-APPROVES IN");
  assert.equal(matchStatusCopy("held").countdownLabel, "RESOLVE WITHIN");
  assert.equal(matchStatusCopy("confirmed").label, "FINAL");
  assert.equal(matchStatusCopy("voided").label, "VOID");
});
