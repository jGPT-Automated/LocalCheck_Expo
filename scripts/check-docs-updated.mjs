// CI check: every push to a pull request that changes the product must also
// update the docs that describe it (rules in docsCheckModel.mjs).
// Usage: node scripts/check-docs-updated.mjs <from-sha> <to-sha>
import { execFileSync } from "node:child_process";
import { missingDocs } from "./docsCheckModel.mjs";

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error("Usage: node scripts/check-docs-updated.mjs <from-sha> <to-sha>");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const changed = git("diff", "--name-only", `${from}..${to}`).split("\n").filter(Boolean);

const addedLines = {};
for (const line of git("diff", "--numstat", `${from}..${to}`, "--", "docs/").split("\n").filter(Boolean)) {
  const [, , path] = line.split("\t");
  const added = git("diff", "-U0", `${from}..${to}`, "--", path)
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++") && l.slice(1).trim() !== "").length;
  addedLines[path] = added;
}

const problems = missingDocs(changed, addedLines);
console.log(`Checked ${changed.length} changed file(s) in ${from.slice(0, 7)}..${to.slice(0, 7)}.`);
if (problems.length === 0) {
  console.log("Docs updated with this push.");
} else {
  for (const problem of problems) console.error(`::error::${problem}`);
  console.error("Update the docs in the same push. See AGENTS.md \"Docs on every push\".");
  process.exit(1);
}
