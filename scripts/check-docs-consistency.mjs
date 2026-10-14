// Runs the structural doc checks in docsConsistencyModel.mjs against the repo.
// Part of `pnpm check`, so CI's `quality` job runs it on every push.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
  brokenRelativeLinks,
  decisionRangeProblems,
  functionCountProblems,
  missingFunctionsInSupabaseDoc,
  missingSupersededBy,
  releaseWorkflowProblems,
  unlistedMigrations,
} from "./docsConsistencyModel.mjs";

const read = (path) => readFileSync(path, "utf8");
const supabaseDoc = read("docs/SUPABASE.md");
const decisions = read("docs/product/DECISIONS.md");
const readme = read("README.md");
const functionDirs = readdirSync("supabase/functions").filter((name) =>
  statSync(`supabase/functions/${name}`).isDirectory(),
);

const problems = [
  ...missingFunctionsInSupabaseDoc(functionDirs, supabaseDoc),
  ...functionCountProblems(functionDirs, supabaseDoc),
  ...functionCountProblems(functionDirs, read("docs/CURRENT_STATE.md"), "docs/CURRENT_STATE.md"),
  ...unlistedMigrations(readdirSync("supabase/migrations"), supabaseDoc),
  ...decisionRangeProblems(readme, decisions),
  ...missingSupersededBy(decisions),
  ...releaseWorkflowProblems(read(".github/workflows/release-ios.yml")),
  ...brokenRelativeLinks(readme, (target) => existsSync(target)),
];

if (problems.length === 0) {
  console.log("Docs consistency check passed: functions, recent migrations, decision range and back-references, release trigger, README links.");
} else {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}
