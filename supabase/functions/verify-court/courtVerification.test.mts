import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acceptsVerifiedCourt,
  courtNamesWereEdited,
  matchesRequestedSport,
  normalizeGeminiResult,
  validateCourtSubmission,
} from "./courtVerification.ts";

test("normalizes Gemini output, clamps confidence, and constrains codes", () => {
  assert.deepEqual(normalizeGeminiResult({
    verified: true,
    sport: "BASKETBALL",
    setting: "OUTDOOR",
    confidence: 140,
    rejection_code: "not_a_court",
    name_okay: true,
    name_code: "offensive",
  }), {
    verified: true,
    sport: "basketball",
    setting: "outdoor",
    confidence: 100,
    // verified=true forces rejection_code -> "none" and name_code -> "none"
    rejectionCode: "none",
    nameOkay: true,
    nameCode: "none",
  });

  assert.deepEqual(normalizeGeminiResult({
    verified: false,
    sport: "other",
    setting: "unclear",
    confidence: 20,
    rejection_code: "PHOTO_OF_SCREEN",
    name_okay: false,
    name_code: "CONTACT_INFO",
  }), {
    verified: false,
    sport: "other",
    setting: "unclear",
    confidence: 20,
    rejectionCode: "photo_of_screen",
    nameOkay: false,
    nameCode: "contact_info",
  });

  // Unknown rejection_code falls back to too_unclear; missing name_code -> none.
  const fallback = normalizeGeminiResult({
    verified: false,
    sport: "unclear",
    setting: "unclear",
    confidence: 0,
    rejection_code: "made_up",
    name_okay: true,
  });
  assert.equal(fallback?.rejectionCode, "too_unclear");
  assert.equal(fallback?.nameCode, "none");

  assert.equal(normalizeGeminiResult({ sport: "tennis", setting: "outdoor" }), null);
});

test("validates and normalizes an authenticated court submission", () => {
  const result = validateCourtSubmission({
    name: "  Jaycee   Park ",
    suggestedOfficialName: "Jaycee Park",
    suggestedShortName: "Jaycee",
    officialName: "Jaycee Park",
    shortName: "Jaycee",
    address: "  123 Court Way ",
    city: " Houston ",
    state: "tx",
    latitude: 29.75,
    longitude: -95.35,
    imageBase64: "x".repeat(200),
    imageMimeType: "image/jpeg",
    sport: "BASKETBALL",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.officialName, "Jaycee Park");
    assert.equal(result.value.shortName, "Jaycee");
    assert.equal(result.value.nameWasEdited, false);
    assert.equal(result.value.state, "TX");
    assert.equal(result.value.requestedSport, "basketball");
  }
});

test("falls back to the street and records edited court names", () => {
  const result = validateCourtSubmission({
    suggestedOfficialName: "123 Court Way",
    suggestedShortName: "Court Way",
    officialName: "Jaycee Community Park",
    shortName: "Jaycee",
    address: "123 Court Way",
    city: "Houston",
    state: "TX",
    latitude: 29.75,
    longitude: -95.35,
    imageBase64: "x".repeat(200),
    imageMimeType: "image/jpeg",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.nameWasEdited, true);

  assert.equal(courtNamesWereEdited("Jaycee Park", "Jaycee", "jaycee  park", "JAYCEE"), false);
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

test("keeps the legacy no-sport request compatible and rejects unsupported sport choices", () => {
  const base = {
    address: "123 Court Way",
    city: "Houston",
    state: "TX",
    latitude: 29.75,
    longitude: -95.35,
    imageBase64: "x".repeat(200),
    imageMimeType: "image/jpeg",
  };
  const legacy = validateCourtSubmission(base);
  assert.equal(legacy.ok, true);
  if (legacy.ok) assert.equal(legacy.value.requestedSport, null);
  assert.equal(validateCourtSubmission({ ...base, sport: "tennis" }).ok, false);
});

test("accepts only high-confidence supported playable courts", () => {
  assert.equal(acceptsVerifiedCourt({
    verified: true,
    sport: "pickleball",
    setting: "indoor",
    confidence: 80,
    rejectionCode: "none",
    nameOkay: true,
    nameCode: "none",
  }), true);
  assert.equal(acceptsVerifiedCourt({
    verified: true,
    sport: "pickleball",
    setting: "indoor",
    confidence: 79,
    rejectionCode: "none",
    nameOkay: true,
    nameCode: "none",
  }), false);

  const basketball = {
    verified: true,
    sport: "basketball" as const,
    setting: "outdoor" as const,
    confidence: 95,
    rejectionCode: "none" as const,
    nameOkay: true,
    nameCode: "none" as const,
  };
  assert.equal(matchesRequestedSport(basketball, "basketball"), true);
  assert.equal(matchesRequestedSport(basketball, "pickleball"), false);
  assert.equal(matchesRequestedSport(basketball, null), true);
});
