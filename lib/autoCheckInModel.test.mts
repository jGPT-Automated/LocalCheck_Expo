import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_CHECK_IN_RADIUS_M,
  autoCheckInDetail,
  autoCheckInState,
  autoCheckInSwitchValue,
  checkedInNotification,
  notifyAt,
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

test("notification fires 3 minutes after arrival, never in the past", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(notifyAt("2026-10-08T11:59:00Z", now).toISOString(), "2026-10-08T12:02:00.000Z");
  assert.equal(notifyAt("2026-10-08T11:00:00Z", now).toISOString(), "2026-10-08T12:00:05.000Z");
  assert.equal(notifyAt(null, now).toISOString(), "2026-10-08T12:03:00.000Z");
  assert.equal(checkedInNotification("Kasmiersky Park").title, "Checked in at Kasmiersky Park");
  assert.match(checkedInNotification("Kasmiersky Park").body, /Not here/);
});
