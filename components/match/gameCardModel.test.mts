import assert from "node:assert/strict";
import test from "node:test";

import {
  cardTitle,
  countdownText,
  eloDelta,
  formatCardDate,
  formatEloDelta,
  gameBannerKind,
  marginSplit,
  shortFirstName,
  sideEloDelta,
  waitingBannerLabel,
} from "./gameCardModel.ts";

test("a long first name is cut before it reaches a line of copy", () => {
  assert.equal(shortFirstName("Jesse Harrick"), "Jesse");
  assert.equal(shortFirstName("MAXIMILIANO_RODRIGUEZ_JR"), "MAXIMILIANO…");
  assert.equal(shortFirstName("  Marcus  "), "Marcus");
});

test("the waiting banner never carries a long name", () => {
  assert.equal(waitingBannerLabel("Jesse Harrick"), "WAITING ON JESSE");
  assert.equal(waitingBannerLabel("MAXIMILIANO_RODRIGUEZ_JR"), "WAITING ON THEM");
  assert.equal(waitingBannerLabel(undefined), "WAITING ON THEM");
});

test("banner kind follows status, then the viewer's seat", () => {
  assert.equal(gameBannerKind("confirmed", "action"), "final");
  assert.equal(gameBannerKind("voided"), "voided");
  assert.equal(gameBannerKind("held", "waiting"), "held");
  assert.equal(gameBannerKind("pending", "action"), "action");
  assert.equal(gameBannerKind("pending", "waiting"), "waiting");
  assert.equal(gameBannerKind("pending"), "waiting");
  assert.equal(gameBannerKind("draft"), "waiting");
});

test("card title is one line: format at short court", () => {
  assert.equal(cardTitle("2V2", "Rancho"), "2V2 AT RANCHO");
  assert.equal(cardTitle("1v1", "Kasmiersky"), "1V1 AT KASMIERSKY");
  assert.equal(cardTitle(undefined, "Rancho"), "RANCHO");
  assert.equal(cardTitle("2V2", ""), "2V2");
});

test("card date is month and day", () => {
  assert.equal(formatCardDate("2026-09-06"), "SEP 6");
  assert.equal(formatCardDate("not a date"), "not a date");
});

test("margin split is the left share and who leads", () => {
  assert.deepEqual(marginSplit(11, 10), { share: 11 / 21, leader: "left" });
  assert.deepEqual(marginSplit("118", "120"), { share: 118 / 238, leader: "right" });
  assert.deepEqual(marginSplit(10, 10), { share: 0.5, leader: null });
  assert.equal(marginSplit(0, 0), null);
  assert.equal(marginSplit("W", "L"), null);
});

test("rating tile text carries the sign", () => {
  assert.equal(formatEloDelta(15), "+15");
  assert.equal(formatEloDelta(-15), "-15");
  assert.equal(formatEloDelta(0), "0");
  assert.equal(eloDelta({ before: 1500, after: 1515 }), 15);
  assert.equal(eloDelta(null), null);
});

test("a side's rating move needs every player rated", () => {
  assert.equal(
    sideEloDelta([
      { elo: { before: 1500, after: 1515 } },
      { elo: { before: 1490, after: 1505 } },
    ]),
    15,
  );
  assert.equal(
    sideEloDelta([{ elo: { before: 1500, after: 1515 } }, { elo: null }]),
    null,
  );
  assert.equal(sideEloDelta([]), null);
});

test("countdown reads in days and hours, hours and minutes, or minutes", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(countdownText("2026-10-11T11:59:00Z", now), "23h 59m");
  assert.equal(countdownText("2026-10-15T11:59:00Z", now), "4d 23h");
  assert.equal(countdownText("2026-10-10T12:12:00Z", now), "12m");
  assert.equal(countdownText("2026-10-15T12:00:00Z", now), "5d");
  assert.equal(countdownText("2026-10-10T15:00:00Z", now), "3h");
  assert.equal(countdownText("2026-10-10T11:00:00Z", now), null);
  assert.equal(countdownText(undefined, now), null);
});
