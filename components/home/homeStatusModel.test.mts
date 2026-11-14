import assert from "node:assert/strict";
import { test } from "node:test";
import { homeCheckInStatus } from "./homeStatusModel.ts";

const now = Date.parse("2026-11-14T20:00:00Z");
test("automatic pending counts down to the server's posting time", () => {
  assert.deepEqual(
    homeCheckInStatus({
      now,
      activeCourtId: null,
      startedAt: null,
      pending: { courtId: "a", postsAt: new Date(now + 125_000).toISOString() },
    }),
    { phase: "pending", label: "Posts in", clock: "2:05", courtId: "a" },
  );
});
test("zero does not claim a check-in posted before the server confirms it", () => {
  const state = homeCheckInStatus({
    now,
    activeCourtId: null,
    startedAt: null,
    pending: { courtId: "a", postsAt: new Date(now - 1000).toISOString() },
  });
  assert.equal(state?.phase, "pending");
  assert.equal(state?.label, "Posting");
  assert.equal(state?.clock, "0:00");
});
test("a confirmed session uses its actual start and supersedes pending at that court", () => {
  assert.deepEqual(
    homeCheckInStatus({
      now,
      activeCourtId: "a",
      startedAt: new Date(now - 3_661_000).toISOString(),
      pending: { courtId: "a", postsAt: new Date(now + 5000).toISOString() },
    }),
    { phase: "active", label: "Checked in", clock: "1:01:01", courtId: "a" },
  );
});
test("manual has no pending stage and invalid timestamps never invent elapsed time", () => {
  assert.equal(
    homeCheckInStatus({
      now,
      activeCourtId: null,
      startedAt: null,
      pending: null,
    }),
    null,
  );
  assert.equal(
    homeCheckInStatus({
      now,
      activeCourtId: "a",
      startedAt: null,
      pending: null,
    })?.clock,
    null,
  );
});
