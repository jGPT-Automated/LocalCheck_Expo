import assert from "node:assert/strict";
import { test } from "node:test";

import { courtDetailsReady, normalizeState } from "./addCourtModel.ts";

test("normalizes two-letter and full US state names", () => {
  assert.equal(normalizeState("tx"), "TX");
  assert.equal(normalizeState(" New York "), "NY");
  assert.equal(normalizeState("not-a-state"), "");
});

test("court details require a valid pin and complete address", () => {
  assert.equal(courtDetailsReady({
    latitude: 29.75,
    longitude: -95.35,
    address: "123 Court Way",
    city: "Houston",
    stateCode: "TX",
  }), true);
  assert.equal(courtDetailsReady({
    latitude: null,
    longitude: -95.35,
    address: "123 Court Way",
    city: "Houston",
    stateCode: "TX",
  }), false);
  assert.equal(courtDetailsReady({
    latitude: 29.75,
    longitude: -95.35,
    address: "123 Court Way",
    city: "Houston",
    stateCode: "Texas",
  }), false);
});
