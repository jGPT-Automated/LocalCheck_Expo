import assert from "node:assert/strict";
import test from "node:test";

import {
  courtPickerDetail,
  farCourtNote,
  formatMiles,
  inviteErrorMessage,
  isCityQuery,
  normalizeInviter,
} from "./onboardingModel.ts";

test("inviter input keeps only username characters", () => {
  assert.equal(normalizeInviter(" @jesse.h_23 "), "jesseh_23");
});

test("blank or already-set invites never block onboarding", () => {
  assert.equal(inviteErrorMessage({ ok: true }), null);
  assert.equal(inviteErrorMessage({ ok: false, reason: "empty" }), null);
  assert.equal(inviteErrorMessage({ ok: false, reason: "already_set" }), null);
});

test("unknown or own username explains what to do", () => {
  assert.match(inviteErrorMessage({ ok: false, reason: "not_found" }) ?? "", /No player/);
  assert.match(inviteErrorMessage({ ok: false, reason: "self" }) ?? "", /your own/);
  assert.match(inviteErrorMessage({ ok: false, reason: "error" }) ?? "", /Try again/);
});

test("city search needs at least two letters", () => {
  assert.equal(isCityQuery("Conroe, TX"), true);
  assert.equal(isCityQuery("LA"), true);
  assert.equal(isCityQuery("a"), false);
  assert.equal(isCityQuery("77304"), false);
});

test("miles: one decimal close by, whole miles far away", () => {
  assert.equal(formatMiles(1.3), "0.8 mi");
  assert.equal(formatMiles(32), "20 mi");
  assert.equal(formatMiles(undefined), null);
});

test("court picker detail skips missing parts", () => {
  assert.equal(
    courtPickerDetail({ distanceKm: 1.3, sport: "BASKETBALL", city: "Conroe" }),
    "0.8 mi · Basketball · Conroe",
  );
  assert.equal(courtPickerDetail({ sport: "PICKLEBALL", city: "" }), "Pickleball");
});

test("usernames are 3-10 letters and numbers (D46)", async () => {
  const { cleanUsername, isValidUsername } = await import("./onboardingModel.ts");
  assert.equal(cleanUsername("chris_j.12345678"), "chrisj1234");
  assert.equal(isValidUsername("ChrisJ"), true);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("chris_j"), false);
  assert.equal(isValidUsername("abcdefghijk"), false);
});

test("a court 1354 mi away gets a plain far-away note naming the typed city", () => {
  assert.equal(
    farCourtNote([{ distanceKm: 2179 }], "  Los   Angeles "),
    "No courts near Los Angeles yet. Closest:",
  );
});

test("the far-away note says 'you' for device location", () => {
  assert.equal(farCourtNote([{ distanceKm: 300 }], null), "No courts near you yet. Closest:");
});

test("a court within 50 mi gets no note", () => {
  assert.equal(farCourtNote([{ distanceKm: 80 }], "Conroe, TX"), null);
});

test("the nearest court decides, not the first row", () => {
  assert.equal(farCourtNote([{ distanceKm: 900 }, { distanceKm: 10 }], "Conroe"), null);
});

test("no distances or no courts means no note", () => {
  assert.equal(farCourtNote([], "Conroe"), null);
  assert.equal(farCourtNote([{}], "Conroe"), null);
});
