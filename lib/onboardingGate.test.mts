import assert from "node:assert/strict";
import test from "node:test";

import { profileNeedsOnboarding } from "./onboardingGate.ts";

test("a brand-new profile needs onboarding", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding(
      { created_at: "2026-09-14T11:59:00Z" },
      now,
    ),
    true,
  );
});

test("an existing profile is never routed into onboarding, flag or not", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding(
      { created_at: "2026-01-01T00:00:00Z", onboarding_completed: false },
      now,
    ),
    false,
  );
});

test("onboarding_completed short-circuits within the grace window", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding(
      { created_at: "2026-09-14T11:59:00Z", onboarding_completed: true },
      now,
    ),
    false,
  );
});

test("a null profile never needs onboarding", () => {
  assert.equal(profileNeedsOnboarding(null), false);
});
