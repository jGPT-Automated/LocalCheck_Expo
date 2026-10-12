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

test("on the game page the players see the numbers; everyone else sees W / L", () => {
  assert.equal(scoresHiddenFor(players, "a", "confirmed", "gamePage"), false);
  assert.equal(scoresHiddenFor(players, "b", "confirmed", "gamePage"), false);
  assert.equal(scoresHiddenFor(players, "stranger", "confirmed", "gamePage"), true);
  assert.equal(scoresHiddenFor(players, null, "confirmed", "gamePage"), true);
});

test("hidden once half or more of the players turn it on (D49)", async () => {
  const { hidersNeeded, isScoreHidden } = await import("./scoreVisibility.ts");
  assert.equal(isScoreHidden([{ hideScore: true }, { hideScore: false }]), true);
  const four = (n: number) => [0, 1, 2, 3].map((i) => ({ hideScore: i < n }));
  assert.equal(isScoreHidden(four(1)), false);
  assert.equal(isScoreHidden(four(2)), true);
  assert.equal(scoresHiddenFor(four(1).map((p, i) => ({ ...p, userId: `u${i}` })), "x"), false);
  assert.equal(hidersNeeded(2), 1);
  assert.equal(hidersNeeded(6), 3);
  assert.equal(hidersNeeded(10), 5);
});
