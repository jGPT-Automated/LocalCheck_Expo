// Structural checks between the docs and the repo. Each rule catches a mistake
// that actually happened (dates in the comments). They compare docs with files
// in this repo only: they cannot see production, devices, or whether a sentence
// is true. Pure functions; scripts/check-docs-consistency.mjs feeds them files.

// Oct 13: SUPABASE.md said "All four Edge Functions are deployed" while a fifth
// (`timers`) existed. Every function folder must be named in SUPABASE.md.
export function missingFunctionsInSupabaseDoc(functionDirs, supabaseDoc) {
  return functionDirs
    .filter((name) => !name.startsWith("_"))
    .filter((name) => !supabaseDoc.includes(`\`${name}\``))
    .map((name) => `docs/SUPABASE.md does not name the Edge Function \`${name}\` (supabase/functions/${name}/).`);
}

// The Oct 13 error itself was a count: "All four Edge Functions are deployed"
// with five folders. Any "<number> Edge Functions" in a doc must match.
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export function functionCountProblems(functionDirs, doc, docName = "docs/SUPABASE.md") {
  const actual = functionDirs.filter((name) => !name.startsWith("_")).length;
  return [...doc.matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+Edge\s+Functions\b/gi)]
    .map((m) => ({ said: m[0].replace(/\s+/g, " "), n: /\d/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS.indexOf(m[1].toLowerCase()) }))
    .filter(({ n }) => n !== actual)
    .map(({ said }) => `${docName} says "${said}", but supabase/functions/ has ${actual}.`);
}

// Oct 14: 20261012200000_checkout_notice_for_all.sql was applied but never listed
// in SUPABASE.md. Every migration from October 2026 on must be named there.
export const MIGRATION_LISTING_STARTS = "20261001000000";
export function unlistedMigrations(migrationFiles, supabaseDoc) {
  return migrationFiles
    .filter((file) => /^\d{14}_.+\.sql$/.test(file) && file.slice(0, 14) >= MIGRATION_LISTING_STARTS)
    .filter((file) => !supabaseDoc.includes(file.slice(0, 14)))
    .map((file) => `docs/SUPABASE.md does not mention migration ${file}.`);
}

// Oct 14: README said "D0–D51" while DECISIONS.md went to D54.
export function highestDecision(decisionsDoc) {
  const numbers = [...decisionsDoc.matchAll(/\*\*D(\d+)/g)].map((m) => Number(m[1]));
  return numbers.length ? Math.max(...numbers) : null;
}
export function decisionRangeProblems(readme, decisionsDoc) {
  const highest = highestDecision(decisionsDoc);
  const match = readme.match(/D0[–-]D(\d+)/);
  if (highest === null) return ["docs/product/DECISIONS.md has no **Dn decisions."];
  if (!match) return ["README.md must state the decision range as \"D0–Dn\"."];
  return Number(match[1]) === highest
    ? []
    : [`README.md says decisions D0–D${match[1]}, but docs/product/DECISIONS.md goes to D${highest}.`];
}

// Oct 14: D52 said it "revises D36, D38" but D36 and D38 still read as current.
// A decision that revises another must be named inside the one it replaces.
function decisionEntries(decisionsDoc) {
  const entries = [];
  for (const block of decisionsDoc.split(/\n(?=- \*\*D\d)/)) {
    const header = block.match(/^- \*\*([^*]+)\*\*/);
    if (!header) continue;
    const ids = new Set();
    for (const m of block.matchAll(/\*\*D(\d+)/g)) ids.add(Number(m[1]));
    for (const m of header[1].matchAll(/D(\d+)\w*\s*[–-]\s*D(\d+)/g)) {
      for (let n = Number(m[1]); n <= Number(m[2]); n += 1) ids.add(n);
    }
    const own = Number(header[1].match(/D(\d+)/)?.[1]);
    entries.push({ own, ids, text: block.replace(/\s+/g, " ") });
  }
  return entries;
}
export function missingSupersededBy(decisionsDoc) {
  const entries = decisionEntries(decisionsDoc);
  const problems = [];
  for (const entry of entries) {
    const revises = entry.text.match(/\brevises ((?:D\d+(?:,? (?:and )?)?)+)/i);
    if (!revises) continue;
    for (const m of revises[1].matchAll(/D(\d+)/g)) {
      const target = Number(m[1]);
      const holder = entries.find((e) => e !== entry && e.ids.has(target));
      if (!holder) continue;
      if (!new RegExp(`\\bD${entry.own}\\b`).test(holder.text)) {
        problems.push(`D${entry.own} revises D${target}, but the D${target} entry doesn't say "Revised by D${entry.own}".`);
      }
    }
  }
  return problems;
}

// Oct 3–14: the docs say merges never build (D22). If release-ios.yml gains any
// trigger besides a manual run, those docs become false.
export function releaseWorkflowProblems(releaseWorkflow) {
  const on = releaseWorkflow.match(/^on:\n((?:[ \t]+.*\n?)*)/m);
  if (!on) return [".github/workflows/release-ios.yml has no `on:` block."];
  const triggers = [...on[1].matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);
  const extra = triggers.filter((t) => t !== "workflow_dispatch");
  return extra.length
    ? [`release-ios.yml is triggered by ${extra.join(", ")}; D22, README.md and docs/RELEASE.md say builds are manual only. Change them together.`]
    : [];
}

// README links to docs that must exist.
export function brokenRelativeLinks(markdown, exists, from = "README.md") {
  return [...markdown.matchAll(/\]\(((?!https?:|#|mailto:)[^)\s]+)\)/g)]
    .map((m) => m[1].split("#")[0])
    .filter((target) => target && !exists(target))
    .map((target) => `${from} links to ${target}, which doesn't exist.`);
}
