// CI check: every push to a pull request that changes the product must also
// update the docs that describe it (rules in docsCheckModel.mjs).
// Usage (CI): node scripts/check-docs-updated.mjs
//   reads ACTION, BEFORE, BASE, HEAD from the environment.
// Usage (by hand): node scripts/check-docs-updated.mjs <from> <to>
import { execFileSync } from "node:child_process";
import { chooseRange, missingDocs } from "./docsCheckModel.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const isAncestor = (a, b) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", a, b], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

let from;
let to;
let scope = "range";
if (process.argv.length >= 4) {
  [from, to] = process.argv.slice(2);
} else {
  const { ACTION, BEFORE, BASE, HEAD } = process.env;
  if (!BASE || !HEAD) {
    console.error("Set BASE and HEAD (and ACTION, BEFORE for pushes), or pass <from> <to>.");
    process.exit(2);
  }
  ({ from, to, scope } = chooseRange({
    action: ACTION,
    before: BEFORE,
    base: BASE,
    head: HEAD,
    beforeIsAncestor: Boolean(BEFORE) && isAncestor(BEFORE, HEAD),
  }));
}

// Three dots: compare against the merge base, so main's own new commits never
// count as this branch's changes.
const range = `${from}...${to}`;
const changed = git("diff", "--name-only", range).split("\n").filter(Boolean);

const addedLines = {};
for (const path of git("diff", "--name-only", range, "--", "docs/").split("\n").filter(Boolean)) {
  addedLines[path] = git("diff", "-U0", range, "--", path)
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++") && l.slice(1).trim() !== "").length;
}

const problems = missingDocs(changed, addedLines);
console.log(`Checked ${changed.length} changed file(s) in this ${scope} (${from.slice(0, 7)}...${to.slice(0, 7)}).`);
if (problems.length === 0) {
  console.log("Docs updated. (This proves the docs changed, not that they are true.)");
} else {
  for (const problem of problems) console.error(`::error::${problem}`);
  console.error('Update the docs in the same push. See AGENTS.md "Docs on every push".');
  process.exit(1);
}
