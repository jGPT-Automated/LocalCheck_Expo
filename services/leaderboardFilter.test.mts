import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLeaderboardMembershipFilter,
  canLoadLeaderboardScope,
  chunkLeaderboardIds,
} from "./leaderboardFilter.ts";

test("only LOCAL requires the viewer's home court — REGIONAL falls back to unscoped", () => {
  assert.equal(canLoadLeaderboardScope("LOCAL", null), false);
  assert.equal(canLoadLeaderboardScope("REGIONAL", null), true);
  assert.equal(canLoadLeaderboardScope("LOCAL", "court-1"), true);
  assert.equal(canLoadLeaderboardScope("REGIONAL", "court-1"), true);
  assert.equal(canLoadLeaderboardScope("GLOBAL", null), true);
  assert.equal(canLoadLeaderboardScope("FRIENDS", null), true);
});

test("preferred sport wins and home-court sport is the null-preference fallback", () => {
  assert.equal(
    buildLeaderboardMembershipFilter("BASKETBALL", ["basketball-court"]),
    "preferred_sport.eq.basketball,and(preferred_sport.is.null,local_court_id.in.(basketball-court))",
  );
  assert.equal(
    buildLeaderboardMembershipFilter("PICKLEBALL", ["pickleball-court-a", "pickleball-court-b"]),
    "preferred_sport.eq.pickleball,and(preferred_sport.is.null,local_court_id.in.(pickleball-court-a,pickleball-court-b))",
  );
});

test("players without a preferred sport need an eligible home court", () => {
  assert.equal(
    buildLeaderboardMembershipFilter("BASKETBALL", []),
    "preferred_sport.eq.basketball",
  );
});

test("court membership ids are queried in bounded chunks without dropping overflow", () => {
  const ids = Array.from({ length: 205 }, (_, index) => `court-${index}`);
  const chunks = chunkLeaderboardIds(ids, 100);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 5]);
  assert.deepEqual(chunks.flat(), ids);
});
