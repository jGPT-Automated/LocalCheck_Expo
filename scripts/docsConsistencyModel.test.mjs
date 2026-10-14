// Regression tests: each fixture is the shape of a real doc error found Oct 13–14.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brokenRelativeLinks,
  decisionRangeProblems,
  functionCountProblems,
  missingFunctionsInSupabaseDoc,
  missingSupersededBy,
  releaseWorkflowProblems,
  unlistedMigrations,
} from "./docsConsistencyModel.mjs";

const FUNCTIONS = ["delete-account", "revenuecat-webhook", "send-notification", "timers", "verify-court", "_shared"];

test("Oct 13: 'All four Edge Functions' with five folders fails, across a line break", () => {
  const doc = "Every migration is applied. All four Edge\nFunctions are deployed.";
  assert.equal(functionCountProblems(FUNCTIONS, doc).length, 1);
  assert.deepEqual(functionCountProblems(FUNCTIONS, "All five Edge Functions are deployed."), []);
  assert.deepEqual(functionCountProblems(FUNCTIONS, "Deployed: 5 Edge Functions."), []);
});

test("every function folder must be named in SUPABASE.md; _shared is ignored", () => {
  const doc = "`delete-account` `revenuecat-webhook` `send-notification` `verify-court`";
  const problems = missingFunctionsInSupabaseDoc(FUNCTIONS, doc);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /`timers`/);
});

test("Oct 14: an October migration missing from SUPABASE.md fails; older ones are not required", () => {
  const files = ["20261012180000_qstash_timers.sql", "20261012200000_checkout_notice_for_all.sql", "20260911000000_old.sql"];
  const problems = unlistedMigrations(files, "- `20261012180000_qstash_timers.sql` applied");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /20261012200000_checkout_notice_for_all/);
});

test("Oct 14: README decision range must match the highest decision", () => {
  const decisions = "- **D53 x:** y\n- **D54 Docs:** z\n- **D52 a:** b";
  assert.equal(decisionRangeProblems("decisions (D0–D51)", decisions).length, 1);
  assert.deepEqual(decisionRangeProblems("decisions (D0–D54)", decisions), []);
});

test("Oct 14: a decision that revises another needs a back-reference there", () => {
  const before = [
    "- **D25–D27r Challenges:** court and day optional.",
    "- **D35 Auto check-in in v1:** geofence. **D36:** 3-minute hold.",
    "- **D50 Game time (Oct 12, revises D26,\n  D39):** time required.",
    "- **D52 Timing (Oct 12, revises D36, D38):** 5 minutes.",
    "- **D37 Friend alerts:** both on. **D38:** 3-hour backstop.",
  ].join("\n");
  const problems = missingSupersededBy(before);
  assert.deepEqual(
    problems.map((p) => p.slice(0, 16)).sort(),
    ["D50 revises D26,", "D52 revises D36,", "D52 revises D38,"].sort(),
  );
  const after = before
    .replace("court and day optional.", "court and day optional. (Revised by D50.)")
    .replace("3-minute hold.", "3-minute hold. (Revised by D52.)")
    .replace("3-hour backstop.", "3-hour backstop. (Revised by D52.)");
  assert.deepEqual(missingSupersededBy(after), []);
});

test("release workflow: manual only passes; adding a push trigger fails", () => {
  const manual = "name: Release\n\non:\n  workflow_dispatch:\n\njobs:\n  build: {}\n";
  assert.deepEqual(releaseWorkflowProblems(manual), []);
  const onPush = "name: Release\n\non:\n  workflow_dispatch:\n  push:\n    branches: [main]\n\njobs:\n  build: {}\n";
  assert.match(releaseWorkflowProblems(onPush)[0], /push/);
});

test("README links must point at files that exist", () => {
  const readme = "[a](docs/A.md) [b](https://x.dev) [c](docs/C.md#part) [d](#local)";
  const exists = (path) => path === "docs/A.md";
  const problems = brokenRelativeLinks(readme, exists);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /docs\/C\.md/);
});
