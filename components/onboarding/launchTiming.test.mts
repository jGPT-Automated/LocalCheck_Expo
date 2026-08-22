import assert from "node:assert/strict";
import test from "node:test";

import { remainingLaunchFloor } from "./launchTiming.ts";

test("cold-open launch keeps the full visible motion floor", () => {
  assert.equal(remainingLaunchFloor(1_000, 1_000, 1_560), 1_560);
});

test("launch floor subtracts elapsed work and never becomes negative", () => {
  assert.equal(remainingLaunchFloor(1_000, 1_500, 1_560), 1_060);
  assert.equal(remainingLaunchFloor(1_000, 3_000, 1_560), 0);
});
