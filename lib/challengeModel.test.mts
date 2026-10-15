import assert from "node:assert/strict";
import test from "node:test";

import {
  type Challenge,
  challengeAction,
  challengeBanner,
  challengeErrorMessage,
  challengeSubtitle,
  challengeTitle,
  dayShort,
  challengeStatusLine,
  dayLabel,
  challengeCardLines,
  defaultSlot,
  inboxChallenges,
  isPastSlot,
  isUnknownRpcSignature,
  relativeDay,
  toPlayAt,
  wheelDays,
  wheelTimes,
  isOpen,
  isStalePending,
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
  assert.equal(challengeStatusLine(base, "ty"), "Challenged you");
  assert.equal(challengeStatusLine(base, "me"), "Waiting for a reply");
  assert.equal(otherPlayer(base, "me").id, "ty");
});

test("accepted: either player logs the score", () => {
  const c = { ...base, status: "accepted" as const };
  assert.equal(challengeAction(c, "me"), "log_score");
  assert.equal(challengeAction(c, "ty"), "log_score");
  assert.equal(challengeStatusLine(c, "me"), "Game on");
});

test("casual challenges are plans: no score, just 'we played'", () => {
  const c = { ...base, status: "accepted" as const, ranked: false };
  assert.equal(challengeAction(c, "me"), "casual_on");
  assert.equal(challengeAction(c, "ty"), "casual_on");
  assert.equal(challengeStatusLine({ ...c, status: "completed" }, "me"), "Played");
});

test("completed with a game links to it; closed otherwise", () => {
  assert.equal(challengeAction({ ...base, status: "completed", matchId: "m" }, "me"), "view_game");
  assert.equal(challengeAction({ ...base, status: "declined" }, "me"), "closed");
  assert.equal(challengeStatusLine({ ...base, status: "declined" }, "me"), "Passed");
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
  assert.equal(dayShort(null, today), "Any day");
  assert.equal(dayShort("2026-10-06", today), "Today");
  assert.equal(dayShort("2026-10-07", today), "Tomorrow");
  assert.equal(dayShort("2026-10-10", today), "Sat");
  assert.equal(dayShort("2026-10-12", today), "Mon");
  assert.equal(dayShort("2026-10-13", today), "Oct 13");
  assert.deepEqual(upcomingDays(3, today), ["2026-10-06", "2026-10-07", "2026-10-08"]);
});

test("inbox subtitle: status, court, day; Casual only when casual; no names", () => {
  const today = new Date(2026, 9, 6, 9);
  const rancho = { ...base, courtName: "Rancho", playOn: "2026-10-10" };
  assert.equal(challengeSubtitle(rancho, "ty", today), "Challenged you · Rancho · Sat");
  assert.equal(challengeSubtitle({ ...rancho, playOn: null }, "me", today), "Waiting for a reply · Rancho · Any day");
  assert.equal(
    challengeSubtitle({ ...rancho, status: "accepted", ranked: false }, "me", today),
    "Game on · Casual · Rancho · Sat",
  );
  assert.equal(challengeSubtitle({ ...base, courtName: null }, "me", today), "Waiting for a reply · Any court · Any day");
  assert.equal(challengeTitle(rancho), "1v1 at Rancho");
  assert.equal(challengeTitle({ courtName: null }), "1v1, any court");
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

test("expired challenges are closed and read as expired", () => {
  const c = { ...base, status: "expired" as const };
  assert.equal(challengeAction(c, "ty"), "closed");
  assert.equal(challengeAction(c, "me"), "closed");
  assert.equal(challengeStatusLine(c, "me"), "Expired");
  assert.equal(isOpen("expired"), false);
});

test("a status this build doesn't know is closed, not a crash", () => {
  const c = { ...base, status: "mystery" as unknown as Challenge["status"] };
  assert.equal(challengeAction(c, "ty"), "closed");
  assert.equal(challengeStatusLine(c, "ty"), "Closed");
});

test("pending past its day is stale; today and later are not", () => {
  const today = new Date(2026, 9, 8, 15);
  assert.equal(isStalePending({ ...base, playOn: "2026-10-07" }, today), true);
  assert.equal(isStalePending({ ...base, playOn: "2026-10-08" }, today), false);
  assert.equal(isStalePending({ ...base, playOn: "2026-10-09" }, today), false);
});

test("pending with a time is stale once the time passes, not before", () => {
  const now = new Date("2026-10-12T18:00:00Z");
  assert.equal(isStalePending({ ...base, playOn: "2026-10-12", playAt: "2026-10-12T17:59:00Z" }, now), true);
  assert.equal(isStalePending({ ...base, playOn: "2026-10-12", playAt: "2026-10-12T18:00:00Z" }, now), true);
  assert.equal(isStalePending({ ...base, playOn: "2026-10-12", playAt: "2026-10-12T18:01:00Z" }, now), false);
});

test("pending with no day goes stale after 7 days", () => {
  const today = new Date("2026-10-13T12:00:00Z");
  assert.equal(isStalePending({ ...base, createdAt: "2026-10-06T12:00:00Z" }, today), false);
  assert.equal(isStalePending({ ...base, createdAt: "2026-10-06T11:00:00Z" }, today), true);
  assert.equal(isStalePending({ ...base, createdAt: "not a date" }, today), false);
});

test("accepted challenges never expire client-side", () => {
  const today = new Date(2026, 9, 20, 9);
  const c = { ...base, status: "accepted" as const, playOn: "2026-10-01" };
  assert.equal(isStalePending(c, today), false);
  assert.deepEqual(inboxChallenges([c], "pending", today), [c]);
});

test("inbox: PENDING hides stale pending, ALL shows it as expired", () => {
  const today = new Date(2026, 9, 8, 9);
  const stale = { ...base, id: "old", playOn: "2026-10-07" };
  const todays = { ...base, id: "now", playOn: "2026-10-08" };
  const undated = { ...base, id: "any", createdAt: new Date(today.getTime() - 3600_000).toISOString() };
  const accepted = { ...base, id: "on", status: "accepted" as const, playOn: "2026-10-05" };
  const all = [stale, todays, undated, accepted];

  assert.deepEqual(
    inboxChallenges(all, "pending", today).map((c) => c.id),
    ["now", "any", "on"],
  );
  const shown = inboxChallenges(all, "all", today);
  assert.deepEqual(shown.map((c) => c.id), ["old", "now", "any", "on"]);
  assert.equal(shown[0].status, "expired");
  assert.equal(shown[1].status, "pending");
  assert.equal(stale.status, "pending", "input is not mutated");
});

test("banner: accent only when it is the viewer's move", () => {
  assert.deepEqual(challengeBanner(base, "ty"), { kind: "action", label: "WAITING ON YOU" });
  assert.deepEqual(challengeBanner(base, "me"), { kind: "waiting", label: "WAITING FOR A REPLY" });
  assert.deepEqual(challengeBanner({ ...base, status: "accepted" }, "me"), { kind: "waiting", label: "GAME ON" });
  assert.equal(challengeBanner({ ...base, status: "declined" }, "me").kind, "voided");
  assert.equal(challengeBanner({ ...base, status: "expired" }, "me").label, "EXPIRED");
});

test("relative days for the inbox card", () => {
  const today = new Date(2026, 9, 11, 9);
  assert.equal(relativeDay(null, today), "");
  assert.equal(relativeDay("2026-10-11", today), "Today");
  assert.equal(relativeDay("2026-10-12", today), "Tomorrow");
  assert.equal(relativeDay("2026-10-14", today), "In 3 days");
  assert.equal(relativeDay("2026-10-10", today), "Today");
});

test("challenge card: game type, then who, where and when", () => {
  const today = new Date(2026, 9, 11, 9);
  const c = { ...base, courtName: "Rancho Courts", playOn: "2026-10-14" };
  assert.deepEqual(challengeCardLines(c, "ty", today), {
    title: "Ranked game",
    subtitle: "Jesse Harrick · Rancho Courts · In 3 days",
  });
  assert.deepEqual(challengeCardLines({ ...c, ranked: false, playOn: "2026-10-12" }, "me", today), {
    title: "Casual game",
    subtitle: "Tyler B · Rancho Courts · Tomorrow",
  });
  assert.equal(challengeCardLines({ ...c, courtName: null, playOn: null }, "me", today).subtitle, "Tyler B");
});

test("wheel: today plus four days, 15-minute steps", () => {
  const now = new Date(2026, 9, 11, 17, 5);
  const days = wheelDays(now);
  assert.equal(days.length, 7);
  assert.deepEqual(days.slice(0, 2).map((d) => d.label), ["Today", "Tomorrow"]);
  assert.equal(days[2].label, "Tue 13");
  assert.equal(days[4].value, "2026-10-15");
  const times = wheelTimes();
  assert.equal(times.length, 96);
  assert.equal(times[0].label, "12:00 AM");
  assert.equal(times[73].label, "6:15 PM");
  assert.equal(times[95].label, "11:45 PM");
});

test("wheel: times already past today are disabled, other days are open", () => {
  const now = new Date(2026, 9, 11, 17, 5);
  assert.equal(isPastSlot("2026-10-11", 17 * 60, now), true);
  assert.equal(isPastSlot("2026-10-11", 17 * 60 + 15, now), false);
  assert.equal(isPastSlot("2026-10-12", 0, now), false);
});

test("default slot: the next quarter hour, or noon tomorrow after 11:45 PM", () => {
  assert.deepEqual(defaultSlot(new Date(2026, 9, 11, 17, 5)), { day: "2026-10-11", minutes: 17 * 60 + 15 });
  assert.deepEqual(defaultSlot(new Date(2026, 9, 11, 17, 15)), { day: "2026-10-11", minutes: 17 * 60 + 30 });
  assert.deepEqual(defaultSlot(new Date(2026, 9, 11, 23, 50)), { day: "2026-10-12", minutes: 12 * 60 });
});

test("play_at is the local day and time as an ISO timestamp", () => {
  assert.equal(toPlayAt("2026-10-12", 18 * 60 + 30), new Date(2026, 9, 12, 18, 30).toISOString());
});

test("an RPC that does not know p_play_at is recognised so the old call can run", () => {
  assert.equal(isUnknownRpcSignature({ code: "PGRST202", message: "Could not find the function" }), true);
  assert.equal(isUnknownRpcSignature({ code: "42883", message: "function does not exist" }), true);
  assert.equal(isUnknownRpcSignature({ code: "LC104", message: "You already have an open challenge" }), false);
  assert.equal(isUnknownRpcSignature({ code: null, message: "network down" }), false);
});

test("a challenge with a time shows it after the day", async () => {
  const { relativeWhen, challengeTime } = await import("./challengeModel.ts");
  const today = new Date(2026, 9, 12, 9, 0);
  const at = new Date(2026, 9, 13, 18, 30).toISOString();
  assert.equal(challengeTime(at), "6:30 PM");
  assert.equal(relativeWhen({ playOn: "2026-10-13", playAt: at }, today), "Tomorrow 6:30 PM");
  assert.equal(relativeWhen({ playOn: "2026-10-13", playAt: null }, today), "Tomorrow");
});
