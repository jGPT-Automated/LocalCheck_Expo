import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLeaderboardMembershipFilter,
  canLoadLeaderboardScope,
} from "./leaderboardFilter.ts";

test("local and regional rankings require the viewer's home court", () => {
  assert.equal(canLoadLeaderboardScope("LOCAL", null), false);
  assert.equal(canLoadLeaderboardScope("REGIONAL", null), false);
  assert.equal(canLoadLeaderboardScope("LOCAL", "court-1"), true);
  assert.equal(canLoadLeaderboardScope("REGIONAL", "court-1"), true);
  assert.equal(canLoadLeaderboardScope("GLOBAL", null), true);
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
