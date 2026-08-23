import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acceptsVerifiedCourt,
  normalizeGeminiResult,
  validateCourtSubmission,
} from "./courtVerification.ts";

test("normalizes Gemini output and clamps confidence", () => {
  assert.deepEqual(normalizeGeminiResult({
    verified: true,
    sport: "BASKETBALL",
    setting: "OUTDOOR",
    confidence: 140,
    reason: "  Clear regulation court.  ",
  }), {
    verified: true,
    sport: "basketball",
    setting: "outdoor",
    confidence: 100,
    reason: "Clear regulation court.",
  });
  assert.equal(normalizeGeminiResult({ sport: "tennis", setting: "outdoor" }), null);
});

test("validates and normalizes an authenticated court submission", () => {
  const result = validateCourtSubmission({
    name: "  Jaycee   Park ",
    address: "  123 Court Way ",
    city: " Houston ",
    state: "tx",
    latitude: 29.75,
    longitude: -95.35,
    imageBase64: "x".repeat(200),
    imageMimeType: "image/jpeg",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.name, "Jaycee Park");
    assert.equal(result.value.state, "TX");
  }
});

test("rejects invalid image types and oversized base64 payloads", () => {
  const base = {
    address: "123 Court Way",
    city: "Houston",
    state: "TX",
    latitude: 29.75,
    longitude: -95.35,
  };
  assert.equal(validateCourtSubmission({
    ...base,
    imageBase64: "x".repeat(200),
    imageMimeType: "image/gif",
  }).ok, false);
  assert.equal(validateCourtSubmission({
    ...base,
    imageBase64: "x".repeat(8_000_001),
    imageMimeType: "image/jpeg",
  }).ok, false);
});

test("accepts only high-confidence supported playable courts", () => {
  assert.equal(acceptsVerifiedCourt({
    verified: true,
    sport: "pickleball",
    setting: "indoor",
    confidence: 80,
    reason: "Playable court.",
  }), true);
  assert.equal(acceptsVerifiedCourt({
    verified: true,
    sport: "pickleball",
    setting: "indoor",
    confidence: 79,
    reason: "Playable court.",
  }), false);
});
