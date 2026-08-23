import assert from "node:assert/strict";
import test from "node:test";

import {
  formatForMaxPlayers,
  generatedScheduledGameTitle,
  maxPlayersForFormat,
  scheduledFormatsForSport,
  scheduledResultAction,
  shiftScheduledGameTime,
  validateTeamAssignments,
} from "./scheduledGameModel.ts";

test("generates a moderated title from creator and format", () => {
  assert.equal(generatedScheduledGameTitle("James Carter", "3V3"), "JAMES · 3V3");
  assert.equal(maxPlayersForFormat("5V5"), 10);
  assert.equal(formatForMaxPlayers(6), "3V3");
});

test("a scheduled result cannot be submitted twice", () => {
  assert.deepEqual(
    scheduledResultAction({ hasStarted: true, isHost: true, status: "completed", resultMatchId: "match-1" }),
    { kind: "review", matchId: "match-1" },
  );
  assert.deepEqual(
    scheduledResultAction({ hasStarted: true, isHost: true, status: "completed" }),
    { kind: "submitted" },
  );
});

test("only the host can submit a started scheduled game", () => {
  assert.deepEqual(
    scheduledResultAction({ hasStarted: true, isHost: true, status: "scheduled" }),
    { kind: "submit" },
  );
  assert.deepEqual(
    scheduledResultAction({ hasStarted: true, isHost: false, status: "scheduled" }),
    { kind: "waiting" },
  );
});

test("ranked scheduled games are limited to supported sports", () => {
  assert.deepEqual(scheduledFormatsForSport("BASKETBALL"), ["2V2", "3V3", "4V4", "5V5"]);
  assert.deepEqual(scheduledFormatsForSport("PICKLEBALL"), ["2V2"]);
  assert.deepEqual(scheduledFormatsForSport("TENNIS"), []);
  assert.deepEqual(scheduledFormatsForSport("SOCCER"), []);
  assert.deepEqual(scheduledFormatsForSport("VOLLEYBALL"), []);
});

test("time control stays on the supported one-hour range", () => {
  assert.equal(shiftScheduledGameTime("18:00", 1), "19:00");
  assert.equal(shiftScheduledGameTime("23:00", 1), "23:00");
  assert.equal(shiftScheduledGameTime("08:00", -1), "08:00");
});

test("a scheduled result requires the complete roster split evenly", () => {
  const roster = ["a1", "a2", "b1", "b2"];
  assert.deepEqual(
    validateTeamAssignments(
      roster,
      [
        { playerId: "a1", side: "a" },
        { playerId: "a2", side: "a" },
        { playerId: "b1", side: "b" },
        { playerId: "b2", side: "b" },
      ],
      "2V2",
    ),
    { valid: true },
  );
  assert.equal(
    validateTeamAssignments(roster, [{ playerId: "a1", side: "a" }], "2V2").valid,
    false,
  );
});
