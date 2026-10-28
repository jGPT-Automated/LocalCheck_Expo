import assert from "node:assert/strict";
import { test } from "node:test";

import { slotMetaLabel } from "./slotModel.ts";

test("this hour counts the people on court, not just the plans", () => {
  assert.equal(slotMetaLabel({ current: true, here: 1, planned: 0 }), "1 on court");
  assert.equal(slotMetaLabel({ current: true, here: 3, planned: 2 }), "3 on court · 2 planning to go");
});

test("this hour with nobody on court falls back to the plans", () => {
  assert.equal(slotMetaLabel({ current: true, here: 0, planned: 0 }), "0 planning to go");
  assert.equal(slotMetaLabel({ current: true, here: 0, planned: 4 }), "4 planning to go");
});

test("other hours only ever show plans, whoever is on court now", () => {
  assert.equal(slotMetaLabel({ current: false, here: 5, planned: 2 }), "2 planning to go");
});
