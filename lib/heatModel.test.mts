import assert from "node:assert/strict";
import { test } from "node:test";

import { heatStep } from "./heatModel.ts";

test("an empty hour is step 0 and the ramp climbs to the accent", () => {
  assert.equal(heatStep(0), 0);
  assert.equal(heatStep(1), 1);
  assert.equal(heatStep(3), 2);
  assert.equal(heatStep(5), 3);
  assert.equal(heatStep(8), 4);
  assert.equal(heatStep(9), 5);
  assert.equal(heatStep(40), 5);
});
