// Decides which docs a change must update. No judgment calls: any change to
// the product (code, database, config, CI) counts, so every push that changes
// it must also change the docs that describe it. See AGENTS.md "Docs on every push".

// Files that are documentation themselves. Changing only these never needs more docs.
export function isDocFile(path) {
  return path.startsWith("docs/") || (!path.includes("/") && path.endsWith(".md"));
}

// Each rule: when a changed file matches `when`, `doc` must also change in the same push.
export const DOC_RULES = [
  { when: (path) => !isDocFile(path), doc: "docs/CURRENT_STATE.md", why: "what is true about the app now" },
  { when: (path) => path.startsWith("supabase/"), doc: "docs/SUPABASE.md", why: "database and server functions" },
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
