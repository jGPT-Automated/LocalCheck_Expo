import assert from "node:assert/strict";
import test from "node:test";

import { coordinateForLocationAction } from "./deviceLocationModel.ts";

const coordinate = { lat: 34.0522, lng: -118.2437 };

test("location actions use only a permission-backed device fix", () => {
  assert.deepEqual(coordinateForLocationAction("granted", coordinate), coordinate);
});

test("location actions reject display fallbacks and unresolved fixes", () => {
  assert.equal(coordinateForLocationAction("denied", coordinate), null);
  assert.equal(coordinateForLocationAction("unavailable", coordinate), null);
  assert.equal(coordinateForLocationAction("loading", coordinate), null);
  assert.equal(coordinateForLocationAction("granted", null), null);
});
