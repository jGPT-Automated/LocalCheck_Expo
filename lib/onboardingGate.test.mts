import assert from "node:assert/strict";
import test from "node:test";

import { profileNeedsOnboarding } from "./onboardingGate.ts";

test("false means onboarding is still needed, however old the account", () => {
  assert.equal(profileNeedsOnboarding({ onboarding_completed: false }), true);
});

test("true means finished", () => {
  assert.equal(profileNeedsOnboarding({ onboarding_completed: true }), false);
});

test("missing column never routes an account into onboarding", () => {
  assert.equal(profileNeedsOnboarding({}), false);
});

test("a null profile never needs onboarding", () => {
  assert.equal(profileNeedsOnboarding(null), false);
});
