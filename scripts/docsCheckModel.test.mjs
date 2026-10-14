import { test } from "node:test";
import assert from "node:assert/strict";
import { isDocFile, missingDocs } from "./docsCheckModel.mjs";

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
  assert.equal(missingDocs([".github/workflows/ci.yml"], {}).length, 1);
  assert.equal(missingDocs(["package.json"], {}).length, 1);
});
