import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_CHECK_IN_RADIUS_M,
  autoCheckInDetail,
  autoCheckInState,
  autoCheckInSwitchValue,
  checkedInNotification,
  clockTime,
  postsAt,
  regionFor,
} from "./autoCheckInModel.ts";

const court = { id: "c1", name: "Kasmiersky Park", latitude: 30.31, longitude: -95.46 };

test("one circle around the local court", () => {
  assert.deepEqual(regionFor(court), {
    identifier: "c1",
    latitude: 30.31,
    longitude: -95.46,
    radius: AUTO_CHECK_IN_RADIUS_M,
    notifyOnEnter: true,
    notifyOnExit: true,
  });
  assert.equal(regionFor({ ...court, latitude: Number.NaN }), null);
  assert.equal(regionFor({ ...court, latitude: 0, longitude: 0 }), null);
  assert.equal(regionFor({ ...court, latitude: 120 }), null);
});

test("state follows what the phone allows", () => {
  const base = { available: true, running: true, permission: "always" as const, hasLocalCourt: true };
  assert.equal(autoCheckInState(base), "on");
  assert.equal(autoCheckInState({ ...base, running: false }), "off");
  assert.equal(autoCheckInState({ ...base, permission: "needs_always" }), "needs_always");
  assert.equal(autoCheckInState({ ...base, permission: "denied" }), "needs_always");
  assert.equal(autoCheckInState({ ...base, hasLocalCourt: false }), "no_court");
  assert.equal(autoCheckInState({ ...base, available: false }), "unavailable");
});

test("settings copy and switch", () => {
  assert.equal(autoCheckInDetail("on", "Kasmiersky Park"), "On at Kasmiersky Park");
  assert.match(autoCheckInDetail("needs_always"), /Always/);
  assert.equal(autoCheckInSwitchValue("needs_always"), true);
  assert.equal(autoCheckInSwitchValue("off"), false);
});

test("arrival notification: posts 5 minutes after arriving, with the clock time and Hide", () => {
  const arrived = new Date(2026, 9, 12, 16, 0, 0);
  const posts = postsAt(arrived.toISOString());
  assert.equal(clockTime(posts), "4:05 PM");
  assert.equal(checkedInNotification("Rancho", posts).title, "Checked in at Rancho");
  assert.equal(checkedInNotification("Rancho", posts).body, "Posts at 4:05 PM. Not playing? Tap Hide.");
});

test("clock time: noon, midnight, morning", () => {
  assert.equal(clockTime(new Date(2026, 9, 12, 12, 7)), "12:07 PM");
  assert.equal(clockTime(new Date(2026, 9, 12, 0, 30)), "12:30 AM");
  assert.equal(clockTime(new Date(2026, 9, 12, 9, 5)), "9:05 AM");
});
