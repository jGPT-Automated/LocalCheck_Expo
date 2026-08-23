import assert from "node:assert/strict";
import test from "node:test";

import { formatLegacyFeedResult, summarizeActivityHype } from "./feedModel.ts";

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
