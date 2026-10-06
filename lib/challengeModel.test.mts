import assert from "node:assert/strict";
import test from "node:test";

import {
  type Challenge,
  challengeAction,
  challengeErrorMessage,
  challengePlaceLine,
  challengeStatusLine,
  dayLabel,
  otherPlayer,
  scoreError,
  upcomingDays,
} from "./challengeModel.ts";

const base: Challenge = {
  id: "c1",
  challenger: { id: "me", name: "Jesse Harrick" },
  opponent: { id: "ty", name: "Tyler B" },
  courtId: "court",
  courtName: "Jaycee Park",
  sport: "BASKETBALL",
  playOn: null,
  ranked: true,
  status: "pending",
  matchId: null,
  cancelledBy: null,
  createdAt: "2026-10-06T12:00:00Z",
};

test("pending: opponent answers, challenger waits", () => {
  assert.equal(challengeAction(base, "ty"), "accept_decline");
  assert.equal(challengeAction(base, "me"), "waiting");
  assert.equal(challengeStatusLine(base, "ty"), "Jesse challenged you");
  assert.equal(challengeStatusLine(base, "me"), "Waiting on Tyler");
  assert.equal(otherPlayer(base, "me").id, "ty");
});

test("accepted: either player logs the score", () => {
  const c = { ...base, status: "accepted" as const };
  assert.equal(challengeAction(c, "me"), "log_score");
  assert.equal(challengeAction(c, "ty"), "log_score");
});

test("completed with a game links to it; closed otherwise", () => {
  assert.equal(challengeAction({ ...base, status: "completed", matchId: "m" }, "me"), "view_game");
  assert.equal(challengeAction({ ...base, status: "declined" }, "me"), "closed");
  assert.equal(challengeStatusLine({ ...base, status: "declined" }, "me"), "Tyler passed");
  assert.equal(
    challengeStatusLine({ ...base, status: "cancelled", cancelledBy: "me" }, "me"),
    "You called it off",
  );
});

test("place and day labels", () => {
  const today = new Date(2026, 9, 6, 9);
  assert.equal(dayLabel(null, today), "Any day");
  assert.equal(dayLabel("2026-10-06", today), "Today");
  assert.equal(dayLabel("2026-10-07", today), "Tomorrow");
  assert.equal(dayLabel("2026-10-10", today), "Sat, Oct 10");
  assert.equal(challengePlaceLine({ courtName: null, playOn: null }, today), "Any court · Any day");
  assert.deepEqual(upcomingDays(3, today), ["2026-10-06", "2026-10-07", "2026-10-08"]);
});

test("errors read as sentences", () => {
  assert.equal(
    challengeErrorMessage({ code: "LC104", message: "You already have an open challenge with this player." }),
    "You already have an open challenge with this player.",
  );
  assert.equal(challengeErrorMessage({ code: "PGRST202", message: "x" }), "Challenges aren't switched on yet.");
  assert.equal(challengeErrorMessage({ code: "XX000", message: "boom" }), "Something went wrong. Try again.");
});

test("score entry", () => {
  assert.equal(scoreError("11", "7"), null);
  assert.equal(scoreError("", "7"), "Enter both scores.");
  assert.equal(scoreError("11", "11"), "Games can't end in a tie.");
  assert.equal(scoreError("-1", "4"), "Scores are whole numbers.");
});
