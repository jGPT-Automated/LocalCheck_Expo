import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRecord,
  pointsToNextRank,
  rankByElo,
  sortCourtPlayers,
  type CourtPlayer,
} from "./courtPlayersModel.ts";

const player = (id: string, extra: Partial<CourtPlayer> = {}): CourtPlayer => ({
  id,
  name: id,
  avatar: id.slice(0, 2).toUpperCase(),
  elo: 1200,
  wins: 0,
  losses: 0,
  lastCheckInAt: null,
  joinedAt: null,
  activeNow: false,
  ...extra,
});

const players = [
  player("ade", { elo: 1201, lastCheckInAt: "2026-10-10T10:00:00Z", joinedAt: "2026-09-01T00:00:00Z" }),
  player("marcus", { elo: 1342, wins: 31, losses: 9, lastCheckInAt: "2026-10-17T10:00:00Z", joinedAt: "2026-07-01T00:00:00Z" }),
  player("luis", { elo: 1240, lastCheckInAt: "2026-10-18T09:00:00Z", activeNow: true, joinedAt: "2026-10-01T00:00:00Z" }),
  player("newbie", { elo: 1200 }),
];

test("ranking sorts by rating, then wins, then name", () => {
  const sorted = sortCourtPlayers([...players, player("zed", { elo: 1200, wins: 2 })], "ranking");
  assert.deepEqual(sorted.map((p) => p.id), ["marcus", "luis", "ade", "zed", "newbie"]);
});

test("active puts people on court first, then latest check-in, never-checked-in last", () => {
  assert.deepEqual(sortCourtPlayers(players, "active").map((p) => p.id), ["luis", "marcus", "ade", "newbie"]);
});

test("newest puts the most recent local first and unknown dates last", () => {
  assert.deepEqual(sortCourtPlayers(players, "newest").map((p) => p.id), ["luis", "ade", "marcus", "newbie"]);
});

test("rank is by rating in every sort", () => {
  const ranks = rankByElo(players);
  assert.equal(ranks.get("marcus"), 1);
  assert.equal(ranks.get("newbie"), 4);
});

test("points to the next rank up", () => {
  assert.deepEqual(pointsToNextRank(players, "ade"), { points: 39, rank: 2 });
  assert.equal(pointsToNextRank(players, "marcus"), null);
});

test("record copy", () => {
  assert.equal(formatRecord(31, 9), "31–9 at this court");
  assert.equal(formatRecord(0, 0), "No games here yet");
});
