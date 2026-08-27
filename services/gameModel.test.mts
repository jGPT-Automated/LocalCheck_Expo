import assert from "node:assert/strict";
import test from "node:test";

import {
  areOpponentsInMatch,
  extractRpcMatchId,
  isMissingDateAwareLogMatch,
} from "./gameModel.ts";

const participants = [
  { user_id: "a1", side: "a" as const },
  { user_id: "a2", side: "a" as const },
  { user_id: "b1", side: "b" as const },
  { user_id: "b2", side: "b" as const },
];

test("head-to-head includes players on opposite sides", () => {
  assert.equal(areOpponentsInMatch(participants, "a1", "b2"), true);
});

test("head-to-head excludes teammates and incomplete participant data", () => {
  assert.equal(areOpponentsInMatch(participants, "a1", "a2"), false);
  assert.equal(areOpponentsInMatch(participants, "a1", "missing"), false);
});

test("RPC match ids normalize row and one-row array responses", () => {
  assert.equal(extractRpcMatchId({ id: "match-1" }), "match-1");
  assert.equal(extractRpcMatchId([{ id: "match-2" }]), "match-2");
  assert.equal(extractRpcMatchId([]), undefined);
  assert.equal(extractRpcMatchId(null), undefined);
});

test("only a missing date-aware RPC signature enables the legacy retry", () => {
  assert.equal(
    isMissingDateAwareLogMatch({
      code: "PGRST202",
      message: "Could not find the function public.log_match",
    }),
    true,
  );
  assert.equal(
    isMissingDateAwareLogMatch({
      message: "Could not find the function public.log_match(p_played_on)",
    }),
    true,
  );
  assert.equal(
    isMissingDateAwareLogMatch({
      code: "42501",
      message: "interaction is blocked",
    }),
    false,
  );
});
