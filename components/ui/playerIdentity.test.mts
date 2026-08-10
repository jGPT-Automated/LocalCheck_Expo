import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlayerInitials } from "./playerIdentity.ts";

test("normalizes names and long handles into compact initials", () => {
  assert.equal(normalizePlayerInitials("Jesse Harrick"), "JH");
  assert.equal(normalizePlayerInitials("jesseharrick"), "JE");
  assert.equal(normalizePlayerInitials("  8aug  "), "8A");
});

test("uses a stable LocalCheck fallback for empty identity", () => {
  assert.equal(normalizePlayerInitials(""), "LC");
  assert.equal(normalizePlayerInitials("---"), "LC");
});
