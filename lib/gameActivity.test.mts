import assert from "node:assert/strict";
import test from "node:test";

import { activityDayLabels, buildGameActivity } from "./gameActivity.ts";

const base = {
  status: "pending" as const,
  courtName: "Rancho",
  playedAt: "2026-10-08T23:00:00Z",
  createdAt: "2026-10-08T23:12:00Z",
  updatedAt: "2026-10-09T01:30:00Z",
  confirmationMethod: null,
  createdBy: "m",
  lastSubmittedBy: "m",
  revisionNumber: 0,
  participants: [
    { id: "m", name: "MaximJ", decision: "approved" as const },
    { id: "j", name: "Jesse", decision: "pending" as const },
  ],
};

test("pending game: played, logged, then who we're waiting on", () => {
  const events = buildGameActivity(base, "j");
  assert.deepEqual(events.map((e) => `${e.lead} ${e.rest}`.trim()), [
    "Played · Rancho",
    "MaximJ logged",
    "Waiting on you",
  ]);
});

test("person first, then the action, in time order, note on the dispute", () => {
  const events = buildGameActivity(
    {
      ...base,
      status: "confirmed",
      confirmedAt: "2026-10-10T12:00:00Z",
      confirmationMethod: "manual",
      disputeNote: "Score changed from 11–9 to 11–10.",
      participants: [
        { id: "m", name: "MaximJ", decision: "approved", decidedAt: "2026-10-10T12:00:00Z" },
        { id: "j", name: "Jesse", decision: "disputed", decidedAt: "2026-10-09T01:30:00Z" },
      ],
    },
    "j",
  );
  assert.deepEqual(events.map((e) => `${e.lead} ${e.rest}`.trim()), [
    "Played · Rancho",
    "MaximJ logged",
    "Jesse disputed",
    "MaximJ approved",
  ]);
  assert.equal(events[2].detail, "Score changed from 11–9 to 11–10.");
});

test("auto-approved games say so", () => {
  const events = buildGameActivity({
    ...base,
    status: "confirmed",
    confirmedAt: "2026-10-11T23:12:00Z",
    confirmationMethod: "automatic",
  });
  assert.equal(events.at(-1)?.lead, "Auto-approved");
});

test("day labels only on the first row of each day", () => {
  const events = buildGameActivity(base, "j");
  const labels = activityDayLabels(events, new Date("2026-10-12T12:00:00Z"));
  assert.equal(labels[0], "OCT 8");
  assert.equal(labels[2], null);
});
