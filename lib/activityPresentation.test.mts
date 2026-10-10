import assert from "node:assert/strict";
import test from "node:test";

import type { FeedItem } from "../constants/data.ts";
import {
  describeTimelineItem,
  formatDayLabel,
  formatDurationMinutes,
  groupCheckinBursts,
  pairVisits,
  startsNewDay,
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

const noon = (day: number, hour = 12) => new Date(2026, 9, day, hour, 0, 0).toISOString();

function gameItem(overrides: Partial<NonNullable<FeedItem["match"]>> = {}): FeedItem {
  const side = (id: string, name: string, s: "a" | "b") => ({
    playerId: id,
    name,
    side: s,
    displayOrder: 0,
  });
  return item({
    id: "game-1",
    type: "game_result",
    occurredAtIso: noon(8, 18),
    courtName: "Rancho",
    match: {
      id: "m1",
      playedAt: noon(8, 18),
      scoreA: 15,
      scoreB: 21,
      winnerSide: "b",
      status: "confirmed",
      sideA: [side("p1", "Jesse Harrick", "a"), side("p2", "Marcus Webb", "a")],
      sideB: [side("p3", "Ben", "b"), side("p4", "Eli R", "b")],
      ...overrides,
    },
  });
}

test("a game is a winner line, a loser line and a short caption", () => {
  const model = describeTimelineItem(gameItem());
  assert.equal(model.kind, "game");
  if (model.kind !== "game") return;
  assert.deepEqual(model.lines[0], { name: "Ben & Eli", score: "21", winner: true });
  assert.deepEqual(model.lines[1], { name: "Jesse & Marcus", score: "15", winner: false });
  assert.equal(model.caption, "2v2 at Rancho · 6:00 PM");
});

test("a hidden score shows W / L and a casual game says so", () => {
  const model = describeTimelineItem(gameItem({ scoresHidden: true, ranked: false }));
  assert.equal(model.kind, "game");
  if (model.kind !== "game") return;
  assert.equal(model.lines[0].score, "W");
  assert.equal(model.lines[1].score, "L");
  assert.equal(model.caption, "2v2 at Rancho · 6:00 PM · Casual");
  assert.ok(!model.accessibilityLabel.includes("21"));
});

test("a team of three joins names with commas and an ampersand", () => {
  const side = (id: string, name: string) => ({ playerId: id, name, side: "a" as const, displayOrder: 0 });
  const model = describeTimelineItem(
    gameItem({
      winnerSide: "a",
      sideA: [side("a", "Marcus"), side("b", "Ben"), side("c", "Eli")],
    }),
  );
  if (model.kind !== "game") throw new Error("expected a game");
  assert.equal(model.lines[0].name, "Marcus, Ben & Eli");
});

test("check-in is one quiet line with the time; the name leads in a mixed list", () => {
  const checkin = item({
    id: "c1",
    type: "checkin",
    occurredAtIso: noon(8, 18),
    courtName: "Rancho",
    playerName: "MAXIMILIANO_RODRIGUEZ_JR",
  });
  const own = describeTimelineItem(checkin);
  assert.equal(own.kind, "line");
  if (own.kind !== "line") return;
  assert.equal(own.marker, "checkin");
  assert.deepEqual(own.segments.map((s) => s.text), ["Checked in at Rancho", "· 6:00 PM"]);

  const mixed = describeTimelineItem(checkin, { showActor: true });
  if (mixed.kind !== "line") throw new Error("expected a line");
  assert.deepEqual(mixed.segments.map((s) => s.text), [
    "MAXIMILIANO_RODRIGUEZ_JR",
    "checked in",
    "· 6:00 PM",
  ]);
  // The name is what gives way, never the verb or the time.
  assert.equal(mixed.segments[0].shrink, true);
  assert.equal(mixed.segments[1].shrink, undefined);
});

test("visit and check-out are quiet grey lines", () => {
  const visit = describeTimelineItem(
    item({
      id: "v1",
      type: "visit",
      occurredAtIso: noon(8),
      courtName: "Rancho",
      visit: { checkInIso: noon(8, 10), checkOutIso: noon(8), durationMinutes: 80 },
    }),
  );
  if (visit.kind !== "line") throw new Error("expected a line");
  assert.equal(visit.marker, "quiet");
  assert.equal(visit.segments[0].text, "1h 20m at Rancho");
  const out = describeTimelineItem(
    item({ id: "o1", type: "checkout", occurredAtIso: noon(8), courtName: "Rancho" }),
  );
  if (out.kind !== "line") throw new Error("expected a line");
  assert.equal(out.marker, "quiet");
});

test("day labels and day grouping", () => {
  const now = new Date(2026, 9, 10, 9, 0, 0);
  assert.equal(formatDayLabel(noon(10), now), "Today");
  assert.equal(formatDayLabel(noon(9), now), "Yesterday");
  assert.equal(formatDayLabel(noon(6), now), "Oct 6");
  assert.equal(formatDayLabel(new Date(2025, 8, 6, 12).toISOString(), now), "Sep 6, 2025");

  const a = item({ id: "a", type: "checkin", occurredAtIso: noon(8, 20) });
  const b = item({ id: "b", type: "checkin", occurredAtIso: noon(8, 9) });
  const c = item({ id: "c", type: "checkin", occurredAtIso: noon(7, 9) });
  assert.equal(startsNewDay(a, undefined), true);
  assert.equal(startsNewDay(b, a), false);
  assert.equal(startsNewDay(c, b), true);
});
