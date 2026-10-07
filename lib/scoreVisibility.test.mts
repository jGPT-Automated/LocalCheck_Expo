import assert from "node:assert/strict";
import test from "node:test";

import { scoresHiddenFor } from "./scoreVisibility.ts";

const players = [
  { userId: "a", hideScore: true },
  { userId: "b", hideScore: false },
];

test("anyone outside the game sees no numbers when one player hid them", () => {
  assert.equal(scoresHiddenFor(players, "stranger"), true);
  assert.equal(scoresHiddenFor(players, null), true);
});

test("the players always see the score", () => {
  assert.equal(scoresHiddenFor(players, "a"), false);
  assert.equal(scoresHiddenFor(players, "b"), false);
});

test("nobody hid it: everyone sees it", () => {
  assert.equal(scoresHiddenFor([{ userId: "a" }, { userId: "b", hideScore: false }], "x"), false);
});
