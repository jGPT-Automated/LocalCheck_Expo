import assert from "node:assert/strict";
import test from "node:test";

import {
  courtPickerDetail,
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
