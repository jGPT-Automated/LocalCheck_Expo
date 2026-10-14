import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseRange, isDocFile, missingDocs } from "./docsCheckModel.mjs";

test("doc files are recognized", () => {
  assert.equal(isDocFile("docs/CURRENT_STATE.md"), true);
  assert.equal(isDocFile("docs/product/DECISIONS.md"), true);
  assert.equal(isDocFile("AGENTS.md"), true);
  assert.equal(isDocFile("components/Home.tsx"), false);
  assert.equal(isDocFile("supabase/migrations/x.sql"), false);
  assert.equal(isDocFile(".github/workflows/ci.yml"), false);
});

test("a docs-only push passes", () => {
  assert.deepEqual(missingDocs(["docs/CURRENT_STATE.md", "README.md"], {}), []);
});

test("any app change without CURRENT_STATE fails", () => {
  const problems = missingDocs(["components/HomeScreen.tsx"], {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /CURRENT_STATE\.md/);
  assert.match(problems[0], /components\/HomeScreen\.tsx/);
});

test("touching CURRENT_STATE without adding a line still fails", () => {
  assert.equal(missingDocs(["lib/x.ts", "docs/CURRENT_STATE.md"], { "docs/CURRENT_STATE.md": 0 }).length, 1);
});

test("app change with CURRENT_STATE lines passes", () => {
  assert.deepEqual(missingDocs(["lib/x.ts", "docs/CURRENT_STATE.md"], { "docs/CURRENT_STATE.md": 2 }), []);
});

test("database change also needs SUPABASE.md", () => {
  const problems = missingDocs(["supabase/migrations/1.sql"], { "docs/CURRENT_STATE.md": 1 });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /SUPABASE\.md/);
  assert.deepEqual(missingDocs(["supabase/migrations/1.sql"], { "docs/CURRENT_STATE.md": 1, "docs/SUPABASE.md": 1 }), []);
});

test("CI and config changes count too", () => {
  assert.ok(missingDocs([".github/workflows/ci.yml"], {}).some((p) => p.includes("CURRENT_STATE.md")));
  assert.equal(missingDocs(["package.json"], {}).length, 1);
});

test("release and native config changes need RELEASE.md", () => {
  for (const path of ["eas.json", "app.json", ".eas/workflows/release-ios.yml", ".github/workflows/release-ios.yml"]) {
    const problems = missingDocs([path], { "docs/CURRENT_STATE.md": 1 });
    assert.equal(problems.length, 1, path);
    assert.match(problems[0], /RELEASE\.md/);
  }
  assert.deepEqual(missingDocs(["eas.json"], { "docs/CURRENT_STATE.md": 1, "docs/RELEASE.md": 1 }), []);
});

test("CI workflow changes need GITHUB.md; purchase code needs the RevenueCat runbook", () => {
  assert.match(missingDocs([".github/workflows/ci.yml"], { "docs/CURRENT_STATE.md": 1 })[0], /GITHUB\.md/);
  assert.match(missingDocs(["services/purchasesService.ts"], { "docs/CURRENT_STATE.md": 1 })[0], /REVENUECAT\.md/);
});

test("range: a normal push is checked alone", () => {
  assert.deepEqual(
    chooseRange({ action: "synchronize", before: "aaaaaaa", base: "bbbbbbb", head: "ccccccc", beforeIsAncestor: true }),
    { from: "aaaaaaa", to: "ccccccc", scope: "push" },
  );
});

test("range: a force push or rebase falls back to the whole pull request", () => {
  const r = chooseRange({ action: "synchronize", before: "aaaaaaa", base: "bbbbbbb", head: "ccccccc", beforeIsAncestor: false });
  assert.equal(r.from, "bbbbbbb");
  assert.equal(r.scope, "pull request");
});

test("range: opening a pull request, or an all-zero before, checks the whole pull request", () => {
  assert.equal(chooseRange({ action: "opened", before: "", base: "b0", head: "c0", beforeIsAncestor: false }).from, "b0");
  assert.equal(
    chooseRange({ action: "synchronize", before: "0000000000000000000000000000000000000000", base: "b0", head: "c0", beforeIsAncestor: true }).from,
    "b0",
  );
});
