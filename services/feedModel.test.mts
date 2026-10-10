import assert from "node:assert/strict";
import test from "node:test";

import {
  courtDisplayName,
  formatLegacyFeedResult,
  summarizeActivityHype,
} from "./feedModel.ts";

test("hydrates the authoritative hype count", () => {
  assert.deepEqual(
    summarizeActivityHype([{ user_id: "one" }, { user_id: "two" }], "three"),
    { hypeCount: 2, hypedByCurrentUser: false },
  );
});

test("legacy feed result copy keeps every teammate visible", () => {
  assert.equal(
    formatLegacyFeedResult({
      sideA: [{ name: "Jesse" }, { name: "Mia" }],
      sideB: [{ name: "Aug3" }, { name: "Kai" }],
      scoreA: 11,
      scoreB: 7,
      winnerSide: "a",
    }),
    "Jesse + Mia DEF. Aug3 + Kai 11–7",
  );
});

test("marks an event already hyped by the current user", () => {
  assert.deepEqual(
    summarizeActivityHype([{ user_id: "one" }, { user_id: "two" }], "two"),
    { hypeCount: 2, hypedByCurrentUser: true },
  );
});

test("a court shows its short slug, and the full name only when it has none", () => {
  assert.equal(courtDisplayName({ name: "Rancho Cienega Recreation Center", short_name: "Rancho" }), "Rancho");
  assert.equal(courtDisplayName({ name: "Kasmiersky Park Courts", short_name: null }), "Kasmiersky Park Courts");
  assert.equal(courtDisplayName({ name: "Kasmiersky Park Courts", short_name: "  " }), "Kasmiersky Park Courts");
  assert.equal(courtDisplayName(null), undefined);
});
