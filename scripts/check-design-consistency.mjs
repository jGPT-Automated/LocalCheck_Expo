import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "components"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const failures = [];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

for (const root of ROOTS) {
  for (const file of await sourceFiles(root)) {
    const source = withoutComments(await readFile(file, "utf8"));
    const label = relative(process.cwd(), file);

    if (file !== "components/brand/LogoMark.tsx" && /logo-mark\.(png|svg)/.test(source)) {
      failures.push(`${label}: import the brand mark through LogoMark`);
    }
    if (/fontFamily\s*:\s*["'`]/.test(source)) {
      failures.push(`${label}: use Typography tokens instead of a literal font family`);
    }
    if (/#ff5500|rgba\(255\s*,\s*85\s*,\s*0/i.test(source)) {
      failures.push(`${label}: use the canonical Colors accent tokens instead of raw orange`);
    }
    if (/[←→↑↓↗↕★☆✓]/.test(source)) {
      failures.push(`${label}: use an installed icon component instead of a text glyph`);
    }
  }
}

const ownership = [
  ["components/HomeScreen.tsx", ["HomeCourtHero", "PlayerSummaryRow", "ActivityRow"]],
  ["components/CourtsScreen.tsx", ["CourtListItem", "CompactSelect", "ModeTabs"]],
  ["app/(tabs)/elo.tsx", ["ProfileHero", "ProfileStats", "PlayerSummaryRow"]],
  ["app/player/[id].tsx", ["ProfileHero", "ProfileStats", "HeadToHeadSummary"]],
  ["app/(tabs)/compete.tsx", ["CompactSelect", "EloStat", "ModeTabs"]],
  ["app/(tabs)/schedule.tsx", ["SpeedDialFab", "scheduleSlotIndex"]],
];

for (const [file, components] of ownership) {
  const source = await readFile(file, "utf8");
  for (const component of components) {
    if (!source.includes(component)) failures.push(`${file}: missing canonical ${component}`);
  }
}

const competeSource = await readFile("app/(tabs)/compete.tsx", "utf8");
if (competeSource.includes("SpeedDialFab")) {
  failures.push("app/(tabs)/compete.tsx: use the explicit Log Game action instead of a floating speed dial");
}
if (!competeSource.includes('accessibilityLabel: "Log a game"') || !competeSource.includes('label: "LOG GAME"')) {
  failures.push("app/(tabs)/compete.tsx: missing the explicit accessible Log Game action");
}

if (failures.length > 0) {
  console.error("Design consistency check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Design consistency check passed: canonical brand, icon, typography, and shared-component ownership rules hold.");
