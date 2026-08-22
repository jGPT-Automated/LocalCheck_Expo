import assert from "node:assert/strict";
import test from "node:test";

import { resolveProfileSport } from "./profileModel.ts";

test("an explicit ranking scope wins over the stored preference", () => {
  assert.equal(resolveProfileSport("pickleball", "BASKETBALL"), "BASKETBALL");
});

test("a valid stored preference supplies the default profile sport", () => {
  assert.equal(resolveProfileSport("pickleball"), "PICKLEBALL");
  assert.equal(resolveProfileSport("soccer"), "SOCCER");
});

test("unknown or missing preferences stay unscoped", () => {
  assert.equal(resolveProfileSport("cricket"), undefined);
  assert.equal(resolveProfileSport(null), undefined);
});
