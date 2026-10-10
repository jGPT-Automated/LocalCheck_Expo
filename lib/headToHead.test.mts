import assert from "node:assert/strict";
import test from "node:test";

import {
  gameFormatLabel,
  gameTitle,
  seriesHeadline,
  seriesStatus,
  signed,
  summarizeHeadToHead,
  teamsLine,
  toHeadToHeadGame,
  type HeadToHeadSourceGame,
} from "./headToHead.ts";

const me = "me";
const them = "them";

const oneVOne: HeadToHeadSourceGame = {
  id: "g1",
  playedAtIso: "2026-10-04T18:00:00Z",
  courtName: "RANCHO CIENEGA",
  scoreA: 11,
  scoreB: 5,
  winnerSide: "a",
  teamSize: 1,
  participants: [
    { userId: them, side: "a", name: "Jesse Harrick", eloBefore: 1100, eloAfter: 1109 },
    { userId: me, side: "b", name: "Tyler", eloBefore: 1200, eloAfter: 1191 },
  ],
};

const threeVThree: HeadToHeadSourceGame = {
  id: "g2",
  playedAtIso: "2026-10-01T18:00:00Z",
  courtName: "RANCHO CIENEGA",
  scoreA: 21,
  scoreB: 15,
  winnerSide: "a",
  teamSize: 3,
  participants: [
    { userId: me, side: "a", name: "Tyler", displayOrder: 0, eloBefore: 1189, eloAfter: 1200 },
    { userId: "m", side: "a", name: "Marcus R", displayOrder: 1 },
    { userId: "av", side: "a", name: "Avery", displayOrder: 2 },
    { userId: them, side: "b", name: "Jesse", displayOrder: 0 },
    { userId: "rc", side: "b", name: "RC2", displayOrder: 1 },
    { userId: "b", side: "b", name: "Ben", displayOrder: 2 },
  ],
};

test("1v1 from the viewer's side", () => {
  const g = toHeadToHeadGame(oneVOne, me)!;
  assert.equal(g.won, false);
  assert.equal(g.myScore, 5);
  assert.equal(g.theirScore, 11);
  assert.equal(g.myEloDelta, -9);
  assert.equal(teamsLine(g), "vs Jesse");
  assert.equal(gameFormatLabel(g), "1v1");
  assert.equal(gameTitle(g), "1v1 at RANCHO CIENEGA");
});

test("team game lists teammates and opponents by first name", () => {
  const g = toHeadToHeadGame(threeVThree, me)!;
  assert.equal(g.won, true);
  assert.equal(teamsLine(g), "with Marcus, Avery · vs Jesse, RC2, Ben");
  assert.equal(gameTitle(g), "3v3 at RANCHO CIENEGA");
  assert.equal(g.myEloDelta, 11);
});

test("casual games never count ELO", () => {
  const g = toHeadToHeadGame({ ...oneVOne, ranked: false }, me)!;
  assert.equal(g.myEloDelta, null);
  assert.equal(gameFormatLabel(g), "1v1 · Casual");
  assert.ok(!gameFormatLabel(toHeadToHeadGame(oneVOne, me)!).includes("Ranked"));
});

test("viewer not in the game is skipped", () => {
  assert.equal(toHeadToHeadGame(oneVOne, "stranger"), null);
});

test("summary: series, margin, ELO net, last played", () => {
  const games = [toHeadToHeadGame(oneVOne, me)!, toHeadToHeadGame(threeVThree, me)!];
  const s = summarizeHeadToHead(games);
  assert.equal(s.myWins, 1);
  assert.equal(s.theirWins, 1);
  assert.equal(s.leader, "even");
  assert.equal(s.avgMargin, 0); // (-6 + 6) / 2
  assert.equal(s.eloNet, 2);
  assert.equal(s.lastPlayedIso, "2026-10-04T18:00:00Z");
  assert.equal(seriesHeadline(s, "Jesse Harrick"), "TIED 1–1");
});

test("headline and signed numbers", () => {
  const empty = summarizeHeadToHead([]);
  assert.equal(seriesHeadline(empty, "Jesse"), "FIRST GAME");
  assert.equal(empty.avgMargin, null);
  assert.equal(empty.eloNet, null);
  const theyLead = summarizeHeadToHead([
    { ...toHeadToHeadGame(oneVOne, me)!, id: "a" },
    { ...toHeadToHeadGame(oneVOne, me)!, id: "b" },
    { ...toHeadToHeadGame(threeVThree, me)!, id: "c" },
  ]);
  assert.equal(seriesHeadline(theyLead, "jesse h"), "JESSE LEADS 2–1");
  assert.deepEqual(seriesStatus(theyLead, "Jesse H"), { name: "JESSE", text: "LEADS 2–1" });
  const youLead = summarizeHeadToHead([toHeadToHeadGame(threeVThree, me)!]);
  assert.equal(seriesHeadline(youLead, "Jesse"), "YOU LEAD 1–0");
  assert.equal(signed(3.66), "+3.7");
  assert.equal(signed(-2), "-2");
  assert.equal(signed(0), "0");
});

test("a hidden score shows as hidden and stays out of the average margin", () => {
  const hidden = toHeadToHeadGame(
    { ...oneVOne, participants: oneVOne.participants.map((p, i) => ({ ...p, hideScore: i === 0 })) },
    me,
  )!;
  const shown = toHeadToHeadGame(threeVThree, me)!;
  assert.equal(hidden.scoresHidden, true);
  assert.equal(shown.scoresHidden, false);
  const s = summarizeHeadToHead([hidden, shown]);
  assert.equal(s.avgMargin, 6);
  assert.equal(summarizeHeadToHead([hidden]).avgMargin, null);
  assert.equal(s.myWins, 1);
});
