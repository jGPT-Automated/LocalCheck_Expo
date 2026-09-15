import assert from "node:assert/strict";
import test from "node:test";

import { profileNeedsOnboarding } from "./onboardingGate.ts";

test("no flag column (pre-migration): a brand-new profile needs onboarding", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding({ created_at: "2026-09-14T11:59:00Z" }, now),
    true,
  );
});

test("no flag column (pre-migration): an existing profile is protected by age alone", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding({ created_at: "2026-01-01T00:00:00Z" }, now),
    false,
  );
});

test("flag present: true is authoritative regardless of age", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding(
      { created_at: "2026-09-14T11:59:00Z", onboarding_completed: true },
      now,
    ),
    false,
  );
});

test("flag present: an explicit false still needs onboarding past the grace window — the whole point of the flag is resuming an interrupted flow", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding(
      { created_at: "2026-09-14T11:00:00Z", onboarding_completed: false },
      now,
    ),
    true,
  );
});

test("flag present: false within the grace window also needs onboarding", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  assert.equal(
    profileNeedsOnboarding(
      { created_at: "2026-09-14T11:59:00Z", onboarding_completed: false },
      now,
    ),
    true,
  );
});

test("a null profile never needs onboarding", () => {
  assert.equal(profileNeedsOnboarding(null), false);
});
