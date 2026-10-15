// Decides which docs a push must update. No judgment calls: any change to the
// product (code, database, config, CI) counts, so every push that changes it
// must also add lines to the docs that describe that area.
// See AGENTS.md "Docs on every push" (D54).
//
// What this can prove: the right doc files gained lines in the same push.
// What it cannot prove: that those lines are true. Truth is checked by hand
// against the code, production and devices, and recorded in CURRENT_STATE.md.

// Files that are documentation themselves. Changing only these never needs more docs.
export function isDocFile(path) {
  return path.startsWith("docs/") || (!path.includes("/") && path.endsWith(".md"));
}

const startsWithAny = (prefixes) => (path) => prefixes.some((prefix) => path.startsWith(prefix));
const isAny = (names) => (path) => names.includes(path);

// Each rule: when a changed file matches `when`, `doc` must gain lines in the same push.
export const DOC_RULES = [
  {
    when: (path) => !isDocFile(path),
    doc: "docs/CURRENT_STATE.md",
    why: "what is true about the app now",
  },
  {
    when: startsWithAny(["supabase/"]),
    doc: "docs/SUPABASE.md",
    why: "database and server functions",
  },
  {
    // Release paths and native configuration: what a build or OTA will contain.
    when: (path) =>
      startsWithAny([".eas/"])(path) ||
      isAny([
        "eas.json",
        "app.json",
        "app.config.js",
        ".github/workflows/release-ios.yml",
        ".github/workflows/expo-pr-preview.yml",
      ])(path),
    doc: "docs/RELEASE.md",
    why: "builds, previews, OTA updates and native config",
  },
  {
    when: isAny([".github/workflows/ci.yml", ".github/pull_request_template.md"]),
    doc: "docs/GITHUB.md",
    why: "CI checks and merge rules",
  },
  {
    when: (path) =>
      path.startsWith("supabase/functions/revenuecat-webhook/") || path === "services/purchasesService.ts",
    doc: "docs/runbooks/REVENUECAT.md",
    why: "purchases and the RevenueCat webhook",
  },
];

// changed: file paths changed in the push.
// addedLines: map of doc path -> number of non-blank lines added to it in the push.
// Returns the list of problems; empty means the push passes.
export function missingDocs(changed, addedLines = {}) {
  const problems = [];
  for (const rule of DOC_RULES) {
    const triggers = changed.filter(rule.when);
    if (triggers.length === 0) continue;
    if ((addedLines[rule.doc] ?? 0) > 0) continue;
    const examples = triggers.slice(0, 3).join(", ") + (triggers.length > 3 ? `, and ${triggers.length - 3} more` : "");
    problems.push(`${rule.doc} (${rule.why}) was not updated, but this push changed ${examples}.`);
  }
  return problems;
}

// Which commits to compare for one pull request event.
// - A normal push ("synchronize") compares the previous head with the new head,
//   so every push is checked on its own.
// - A force push or rebase leaves the previous head outside the new history;
//   comparing against it would count unrelated main commits as this push's
//   changes, so fall back to the whole pull request.
// - Opening or reopening checks the whole pull request.
// The caller diffs with three dots (merge base), so commits that landed on main
// after the branch started never count as the branch's changes.
export function chooseRange({ action, before, base, head, beforeIsAncestor }) {
  const usableBefore =
    action === "synchronize" && typeof before === "string" && /^[0-9a-f]{7,40}$/.test(before) && !/^0+$/.test(before) && beforeIsAncestor;
  return usableBefore ? { from: before, to: head, scope: "push" } : { from: base, to: head, scope: "pull request" };
}
