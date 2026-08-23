import assert from "node:assert/strict";
import test from "node:test";

import {
  formatActivityCopy,
  formatClockTime,
  formatGameResult,
  formatMatchSide,
  formatRunIdentity,
} from "./homePresentation.ts";

test("derives basketball format from capacity", () => {
  assert.equal(
    formatRunIdentity({
      sport: "BASKETBALL",
      maxPlayers: 10,
      skillLevel: "ALL LEVELS",
    }),
    "5V5 · ALL LEVELS",
  );
});

test("localizes 24-hour run times", () => {
  assert.equal(formatClockTime("19:00"), "7:00 PM");
  assert.equal(formatClockTime("08:30"), "8:30 AM");
});

test("keeps every player visible in a team result", () => {
  assert.equal(
    formatMatchSide([{ name: "AUG3" }, { name: "JESSEHARRICK" }]),
    "AUG3 + JESSEHARRICK",
  );
  assert.equal(formatMatchSide([]), "SIDE TBD");
});

test("formats a game result as a human sports sentence without placeholder brackets", () => {
  assert.equal(
    formatGameResult({
      sideA: [{ name: "Jesse" }, { name: "Mia" }],
      sideB: [{ name: "Aug3" }, { name: "Kai" }],
      scoreA: 11,
      scoreB: 7,
      winnerSide: "a",
    }),
    "Jesse + Mia beat Aug3 + Kai, 11–7",
  );
});

test("derives pickleball format from capacity", () => {
  assert.equal(
    formatRunIdentity({
      sport: "PICKLEBALL",
      maxPlayers: 4,
      skillLevel: "INTERMEDIATE",
    }),
    "2V2 · INTERMEDIATE",
  );
});

test("falls back honestly for an unsupported capacity", () => {
  assert.equal(
    formatRunIdentity({
      sport: "BASKETBALL",
      maxPlayers: 7,
      skillLevel: "ALL LEVELS",
    }),
    "OPEN RUN · ALL LEVELS",
  );
});

test("separates actor and action in court-scoped activity", () => {
  assert.deepEqual(
    formatActivityCopy({
      playerName: "Jesse Harrick",
      courtName: "Rancho Cienega Sports Complex",
      message: "JESSE HARRICK CHECKED INTO RANCHO CIENEGA SPORTS COMPLEX",
      type: "checkin",
    }),
    { actor: "Jesse Harrick", action: "checked in" },
  );
});

test("describes scheduled-game activity with the product language", () => {
  assert.deepEqual(
    formatActivityCopy({
      playerName: "Jesse Harrick",
      courtName: "Rancho Cienega Sports Complex",
      message: "JESSE HARRICK SCHEDULED A GAME AT RANCHO CIENEGA SPORTS COMPLEX",
      type: "run_started",
    }),
    { actor: "Jesse Harrick", action: "scheduled a game" },
  );
});

test("normalizes an unfamiliar activity message without losing meaning", () => {
  assert.deepEqual(
    formatActivityCopy({
      playerName: "Aug3",
      courtName: "Rancho Cienega Sports Complex",
      message: "AUG3 DEF. JESSEHARRICK 11–0",
      type: "game_result",
    }),
    { actor: "Aug3", action: "def. jesseharrick 11–0" },
  );
});
