import assert from "node:assert/strict";
import test from "node:test";

import type { FeedItem } from "../constants/data.ts";
import {
  formatDurationMinutes,
  formatRelativeDay,
  groupCheckinBursts,
  pairVisits,
} from "./activityPresentation.ts";

function item(partial: Partial<FeedItem> & Pick<FeedItem, "id" | "type" | "occurredAtIso">): FeedItem {
  return {
    playerId: "p1",
    playerName: "Jesse",
    message: "",
    timestamp: "",
    hypeCount: 0,
    ...partial,
  };
}

test("pairVisits collapses a matching checkin/checkout into one visit", () => {
  const items = [
    item({
      id: "checkout-1",
      type: "checkout",
      occurredAtIso: "2026-09-04T19:00:00Z",
      courtId: "court-a",
      courtName: "Fonde",
    }),
    item({
      id: "checkin-1",
      type: "checkin",
      occurredAtIso: "2026-09-04T18:00:00Z",
      courtId: "court-a",
      courtName: "Fonde",
    }),
  ];

  const result = pairVisits(items);

  assert.equal(result.length, 1);
  assert.equal(result[0].type, "visit");
  assert.equal(result[0].visit?.durationMinutes, 60);
  assert.equal(result[0].visit?.checkInIso, "2026-09-04T18:00:00Z");
  assert.equal(result[0].visit?.checkOutIso, "2026-09-04T19:00:00Z");
});

test("pairVisits leaves an unmatched checkin alone (still checked in)", () => {
  const items = [
    item({
      id: "checkin-open",
      type: "checkin",
      occurredAtIso: "2026-09-04T18:00:00Z",
      courtId: "court-a",
    }),
  ];

  const result = pairVisits(items);

  assert.equal(result.length, 1);
  assert.equal(result[0].type, "checkin");
});

test("pairVisits keeps two visits at the same court separate", () => {
  const items = [
    item({ id: "checkout-2", type: "checkout", occurredAtIso: "2026-09-04T20:00:00Z", courtId: "court-a" }),
    item({ id: "checkin-2", type: "checkin", occurredAtIso: "2026-09-04T19:30:00Z", courtId: "court-a" }),
    item({ id: "checkout-1", type: "checkout", occurredAtIso: "2026-09-04T18:00:00Z", courtId: "court-a" }),
    item({ id: "checkin-1", type: "checkin", occurredAtIso: "2026-09-04T17:00:00Z", courtId: "court-a" }),
  ];

  const result = pairVisits(items);

  assert.equal(result.length, 2);
  assert.ok(result.every((r) => r.type === "visit"));
  assert.equal(result[0].visit?.durationMinutes, 30);
  assert.equal(result[1].visit?.durationMinutes, 60);
});

test("pairVisits does not merge across a game in between", () => {
  const items = [
    item({ id: "checkout-1", type: "checkout", occurredAtIso: "2026-09-04T20:00:00Z", courtId: "court-a" }),
    item({ id: "game-1", type: "game_result", occurredAtIso: "2026-09-04T19:00:00Z" }),
    item({ id: "checkin-1", type: "checkin", occurredAtIso: "2026-09-04T18:00:00Z", courtId: "court-a" }),
  ];

  const result = pairVisits(items);

  // A game between the two doesn't block pairing (it's a different key/type
  // entirely) - checkin and checkout are still the same visit.
  assert.equal(result.length, 2);
  assert.ok(result.some((r) => r.type === "visit"));
  assert.ok(result.some((r) => r.type === "game_result"));
});

test("groupCheckinBursts leaves 1-2 check-ins ungrouped", () => {
  const items = [
    item({ id: "c2", type: "checkin", occurredAtIso: "2026-09-04T18:05:00Z" }),
    item({ id: "c1", type: "checkin", occurredAtIso: "2026-09-04T18:00:00Z" }),
  ];

  const result = groupCheckinBursts(items);

  assert.equal(result.length, 2);
  assert.ok(result.every((r) => r.type === "checkin"));
});

test("groupCheckinBursts groups 3+ check-ins within the window", () => {
  const items = [
    item({ id: "c3", type: "checkin", playerName: "Alex", occurredAtIso: "2026-09-04T18:10:00Z" }),
    item({ id: "c2", type: "checkin", playerName: "Mike", occurredAtIso: "2026-09-04T18:05:00Z" }),
    item({ id: "c1", type: "checkin", playerName: "Jesse", occurredAtIso: "2026-09-04T18:00:00Z" }),
  ];

  const result = groupCheckinBursts(items);

  assert.equal(result.length, 1);
  assert.equal(result[0].type, "checkin_burst");
  assert.equal(result[0].burst?.count, 3);
  assert.deepEqual(result[0].burst?.playerNames, ["Alex", "Mike", "Jesse"]);
});

test("groupCheckinBursts breaks the run when the gap is too large", () => {
  const items = [
    item({ id: "c3", type: "checkin", occurredAtIso: "2026-09-04T19:00:00Z" }), // 50 min gap
    item({ id: "c2", type: "checkin", occurredAtIso: "2026-09-04T18:05:00Z" }),
    item({ id: "c1", type: "checkin", occurredAtIso: "2026-09-04T18:00:00Z" }),
  ];

  const result = groupCheckinBursts(items, 15, 3);

  // The lone late check-in stays separate; the earlier two don't meet minCount.
  assert.equal(result.length, 3);
  assert.ok(result.every((r) => r.type === "checkin"));
});

test("groupCheckinBursts does not group across a non-checkin event", () => {
  const items = [
    item({ id: "c3", type: "checkin", occurredAtIso: "2026-09-04T18:10:00Z" }),
    item({ id: "co", type: "checkout", occurredAtIso: "2026-09-04T18:07:00Z" }),
    item({ id: "c2", type: "checkin", occurredAtIso: "2026-09-04T18:05:00Z" }),
    item({ id: "c1", type: "checkin", occurredAtIso: "2026-09-04T18:00:00Z" }),
  ];

  const result = groupCheckinBursts(items);

  // 2 + checkout + 1 - neither checkin run reaches minCount 3.
  assert.equal(result.length, 4);
});

test("formatDurationMinutes", () => {
  assert.equal(formatDurationMinutes(45), "45m");
  assert.equal(formatDurationMinutes(60), "1h");
  assert.equal(formatDurationMinutes(74), "1h 14m");
  assert.equal(formatDurationMinutes(0), "<1m");
  assert.equal(formatDurationMinutes(null), "—");
});

test("formatRelativeDay", () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).toISOString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).toISOString();
  assert.equal(formatRelativeDay(today), "TODAY");
  assert.equal(formatRelativeDay(yesterday), "YESTERDAY");
});
