import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationHeading, notificationTimestamp } from "./notificationPresentation.ts";

test("legacy headings normalize without lowercasing names or custom test messages", () => {
  assert.equal(notificationHeading("MATCH CONFIRMED"), "Match confirmed");
  assert.equal(notificationHeading("Check-in posted"), "Checked in");
  assert.equal(notificationHeading("Auto checked out"), "Checked out");
  assert.equal(notificationHeading("Marcus R. challenged JESSE"), "Marcus R. challenged JESSE");
  assert.equal(notificationHeading("LocalCheck notification test"), "LocalCheck notification test");
});
test("timestamps retain the event date and clock time rather than relative age", () => {
  const stamp = notificationTimestamp("2026-11-09T02:44:17Z");
  assert.match(stamp, /2026/);
  assert.match(stamp, /44/);
  assert.equal(notificationTimestamp("invalid"), "");
});
