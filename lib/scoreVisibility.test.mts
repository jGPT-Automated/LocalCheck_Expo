import assert from "node:assert/strict";
import test from "node:test";

import { scoresHiddenFor } from "./scoreVisibility.ts";

const players = [
  { userId: "a", hideScore: true },
  { userId: "b", hideScore: false },
];

test("a settled game with a hidden score shows W / L to everyone, players included", () => {
  assert.equal(scoresHiddenFor(players, "stranger"), true);
  assert.equal(scoresHiddenFor(players, null), true);
  assert.equal(scoresHiddenFor(players, "a"), true);
  assert.equal(scoresHiddenFor(players, "b", "confirmed"), true);
});

test("players still see the numbers while the game is in review", () => {
  assert.equal(scoresHiddenFor(players, "a", "pending"), false);
  assert.equal(scoresHiddenFor(players, "b", "held"), false);
  assert.equal(scoresHiddenFor(players, "stranger", "pending"), true);
});

test("nobody hid it: everyone sees it", () => {
  assert.equal(scoresHiddenFor([{ userId: "a" }, { userId: "b", hideScore: false }], "x"), false);
});
