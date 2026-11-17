import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationHeading, notificationTimestamp } from "./notificationPresentation.ts";
import { notificationEventMetadata } from "./notificationPresentation.ts";

test("manual and automatic own rows show recorded audiences, incoming rows do not", () => {
  for (const type of ["auto_check_in", "auto_check_out", "manual_check_in", "manual_check_out"]) {
    const metadata = notificationEventMetadata({ type, source: "manual", visibility: "private" });
    assert.equal(metadata.audience?.label, "Private · Only you");
    assert.equal(metadata.sourceLabel, "Manual");
  }
  for (const type of ["friend_request", "friend_accepted", "run_invite", "match_review", "match_confirmed", "match_rejected", "challenge", "friend_check_in"]) {
    assert.equal(notificationEventMetadata({ type, source: null, visibility: "public" }).audience, null);
  }
  assert.equal(notificationEventMetadata({ type: "auto_check_in", source: null, visibility: null }).audience, null);
});

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
