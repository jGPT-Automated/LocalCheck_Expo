import assert from "node:assert/strict";
import { test } from "node:test";

import { checkInVisibilityLabel, formatCheckInElapsed } from "./checkInStatus.ts";

const start = "2026-10-17T18:00:00.000Z";
const after = (seconds: number) => Date.parse(start) + seconds * 1000;

test("under an hour shows minutes and seconds", () => {
  assert.equal(formatCheckInElapsed(start, after(0)), "0:00");
  assert.equal(formatCheckInElapsed(start, after(247)), "4:07");
  assert.equal(formatCheckInElapsed(start, after(59 * 60 + 59)), "59:59");
});

test("an hour or more shows hours, minutes and seconds", () => {
  assert.equal(formatCheckInElapsed(start, after(3600)), "1:00:00");
  assert.equal(formatCheckInElapsed(start, after(3600 + 4 * 60 + 7)), "1:04:07");
});

test("a start time in the future, or a bad one, never goes negative", () => {
  assert.equal(formatCheckInElapsed(start, after(-30)), "0:00");
  assert.equal(formatCheckInElapsed("not a date", after(10)), "0:00");
});

test("visibility reads as the Settings labels", () => {
  assert.equal(checkInVisibilityLabel("public"), "PUBLIC");
  assert.equal(checkInVisibilityLabel("friends"), "FRIENDS");
  assert.equal(checkInVisibilityLabel("private"), "PRIVATE");
});
