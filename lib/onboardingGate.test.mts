import assert from "node:assert/strict";
import test from "node:test";

import { canAutoPromptPush, profileNeedsOnboarding } from "./onboardingGate.ts";

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

test("push never auto-prompts before the profile has loaded", () => {
  assert.equal(canAutoPromptPush("u1", null), false);
  assert.equal(canAutoPromptPush(null, null), false);
});

test("push never auto-prompts while onboarding is unfinished", () => {
  assert.equal(canAutoPromptPush("u1", { id: "u1", onboarding_completed: false }), false);
});

test("push never auto-prompts on a profile without the onboarding flag", () => {
  assert.equal(canAutoPromptPush("u1", { id: "u1" }), false);
});

test("push never auto-prompts on another account's leftover profile", () => {
  assert.equal(canAutoPromptPush("new-user", { id: "old-user", onboarding_completed: true }), false);
});

test("push still auto-syncs for a finished account", () => {
  assert.equal(canAutoPromptPush("u1", { id: "u1", onboarding_completed: true }), true);
});
