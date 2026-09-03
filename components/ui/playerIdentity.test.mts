import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlayerInitials, parsePlayerQrCode } from "./playerIdentity.ts";

test("normalizes names and long handles into compact initials", () => {
  assert.equal(normalizePlayerInitials("Jesse Harrick"), "JH");
  assert.equal(normalizePlayerInitials("jesseharrick"), "JE");
  assert.equal(normalizePlayerInitials("  8aug  "), "8A");
});

test("uses a stable LocalCheck fallback for empty identity", () => {
  assert.equal(normalizePlayerInitials(""), "LC");
  assert.equal(normalizePlayerInitials("---"), "LC");
});

test("accepts only LocalCheck player QR deep links", () => {
  const id = "8ea0f430-a83c-4aec-a9d6-c667f7dc0944";
  assert.equal(parsePlayerQrCode(`localcheck://player/${id}`), id);
  assert.equal(parsePlayerQrCode(`localcheck://player/${id}/`), id);
  assert.equal(parsePlayerQrCode(`https://example.com/player/${id}`), null);
  assert.equal(parsePlayerQrCode("localcheck://player/not-a-player"), null);
});
