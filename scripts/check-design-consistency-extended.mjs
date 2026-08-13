// Extended drop-in replacement for scripts/check-design-consistency.mjs.
// Keeps every existing check (brand mark import, literal font-family names,
// raw canonical-orange duplication, text-glyph icons, component ownership,
// Log Game action) and adds the checks that were missing:
//   - raw fontSize / lineHeight / letterSpacing literals (should be tokens
//     from constants/typography.ts)
//   - raw padding/margin/borderRadius literals (should be tokens from
//     constants/layout.ts / constants/colors.ts)
//   - any hardcoded orange that is NOT exactly the canonical accent value
//     (the original script only catches a *duplicated* canonical value —
//     it silently misses a *different*, drifted orange like #FF6A00)
//
// This is an audit tool, not a CI gate: as of 2026-08-13 the repo has a large
// backlog of pre-existing raw fontSize/spacing/radius literals (see
// docs/product/DESIGN.md history / LOCALCHECK_DESIGN_AUDIT.md), so wiring
// this into `pnpm check` would fail on unrelated code. Run it directly to
// measure drift; `check-design-consistency.mjs` remains the CI-blocking
// check until that backlog is paid down.
//
// Run: `node scripts/check-design-consistency-extended.mjs`

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "components"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const failures = [];

// ---- canonical values -------------------------------------------------
// Keep these in sync with constants/typography.ts, constants/layout.ts,
// and constants/colors.ts. If those files change, update these sets too —
// this script intentionally does not import the app's TS constants so it
// keeps working even against files that don't compile yet.
const CANONICAL_ACCENT_HEX = "ff5500";
const CANONICAL_ACCENT_RGB = [255, 85, 0];
const CANONICAL_FONT_SIZES = new Set([11, 12, 14, 16, 18, 22, 28, 36, 48, 64]);
const CANONICAL_SPACE = new Set([4, 8, 12, 16, 20, 28, 36]);
const CANONICAL_RADIUS = new Set([2, 3, 5, 8, 16, 999]); // 999 = pill/full, add Radius.full if formalizing

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function isOrangeish(r, g, b) {
  // Loose heuristic: red channel dominant, green in a plausible mid range,
  // blue low — catches "an orange" without needing exact hue math.
  return r >= 200 && g >= 30 && g <= 160 && b <= 60 && r - b >= 140;
}

function* hexColors(source) {
  const re = /#([0-9a-fA-F]{6})\b/g;
  let m;
  while ((m = re.exec(source))) {
    const hex = m[1].toLowerCase();
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    yield { raw: `#${hex}`, hex, r, g, b };
  }
}

function* rgbaColors(source) {
  const re = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
  let m;
  while ((m = re.exec(source))) {
    yield { raw: m[0], r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
}

for (const root of ROOTS) {
  for (const file of await sourceFiles(root)) {
    const rawSource = await readFile(file, "utf8");
    const source = withoutComments(rawSource);
    const label = relative(process.cwd(), file);

    // --- original checks ---
    if (
      file !== "components/brand/LogoMark.tsx" &&
      /logo-mark\.(png|svg)/.test(source)
    ) {
      failures.push(`${label}: import the brand mark through LogoMark`);
    }
    if (/fontFamily\s*:\s*["'`]/.test(source)) {
      failures.push(
        `${label}: use Typography tokens instead of a literal font family`,
      );
    }
    if (/#ff5500|rgba\(255\s*,\s*85\s*,\s*0/i.test(source)) {
      failures.push(
        `${label}: use the canonical Colors accent tokens instead of raw orange`,
      );
    }
    if (/[←→↑↓↗↕★☆✓]/.test(source)) {
      failures.push(
        `${label}: use an installed icon component instead of a text glyph`,
      );
    }

    // --- new: raw type-scale literals ---
    for (const m of source.matchAll(/fontSize\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
      const value = Number(m[1]);
      if (!CANONICAL_FONT_SIZES.has(value)) {
        failures.push(
          `${label}: raw fontSize ${value} — use a FontSizes token (nearest: ${nearest(value, CANONICAL_FONT_SIZES)})`,
        );
      } else {
        failures.push(
          `${label}: fontSize ${value} matches a FontSizes token by coincidence — import FontSizes and reference it explicitly`,
        );
      }
    }
    for (const m of source.matchAll(/lineHeight\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
      failures.push(
        `${label}: raw lineHeight ${m[1]} — use a LineHeights token`,
      );
    }
    for (const m of source.matchAll(/letterSpacing\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
      failures.push(
        `${label}: raw letterSpacing ${m[1]} — use a LetterSpacings token`,
      );
    }

    // --- new: raw spacing / radius literals ---
    for (const m of source.matchAll(
      /(padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical)?\s*:\s*(-?\d+(?:\.\d+)?)/g,
    )) {
      const value = Number(m[3]);
      if (value !== 0 && !CANONICAL_SPACE.has(Math.abs(value))) {
        failures.push(
          `${label}: raw ${m[1]}${m[2] ?? ""} ${value} — use a Space token (nearest: ${nearest(Math.abs(value), CANONICAL_SPACE)})`,
        );
      }
    }
    for (const m of source.matchAll(/borderRadius\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
      const value = Number(m[1]);
      if (!CANONICAL_RADIUS.has(value)) {
        failures.push(
          `${label}: raw borderRadius ${value} — use a Radius token (nearest: ${nearest(value, CANONICAL_RADIUS)})`,
        );
      }
    }

    // --- new: color-drift check (catches a DIFFERENT orange, not just a duplicated one) ---
    for (const c of hexColors(source)) {
      if (c.hex !== CANONICAL_ACCENT_HEX && isOrangeish(c.r, c.g, c.b)) {
        failures.push(
          `${label}: ${c.raw} is an orange that does not match the canonical accent #${CANONICAL_ACCENT_HEX} — drift, not just duplication`,
        );
      }
    }
    for (const c of rgbaColors(source)) {
      const isCanonical =
        c.r === CANONICAL_ACCENT_RGB[0] &&
        c.g === CANONICAL_ACCENT_RGB[1] &&
        c.b === CANONICAL_ACCENT_RGB[2];
      if (!isCanonical && isOrangeish(c.r, c.g, c.b)) {
        failures.push(
          `${label}: ${c.raw} is an orange that does not match the canonical accent rgb(255,85,0) — drift, not just duplication`,
        );
      }
    }
  }
}

function nearest(value, set) {
  return [...set].reduce((best, cur) =>
    Math.abs(cur - value) < Math.abs(best - value) ? cur : best,
  );
}

// --- original component-ownership checks (unchanged) ---
const ownership = [
  [
    "components/HomeScreen.tsx",
    ["HomeCourtHero", "PlayerSummaryRow", "ActivityRow"],
  ],
  ["components/CourtsScreen.tsx", ["CourtListItem", "CompactSelect"]],
  ["app/(tabs)/elo.tsx", ["ProfileHero", "ProfileStats", "PlayerSummaryRow"]],
  ["app/player/[id].tsx", ["ProfileHero", "ProfileStats", "HeadToHeadSummary"]],
  ["app/(tabs)/compete.tsx", ["CompactSelect", "EloStat"]],
  ["app/(tabs)/schedule.tsx", ["SpeedDialFab", "scheduleSlotIndex"]],
];

for (const [file, components] of ownership) {
  const source = await readFile(file, "utf8");
  for (const component of components) {
    if (!source.includes(component))
      failures.push(`${file}: missing canonical ${component}`);
  }
}

const competeSource = await readFile("app/(tabs)/compete.tsx", "utf8");
if (competeSource.includes("SpeedDialFab")) {
  failures.push(
    "app/(tabs)/compete.tsx: use the explicit Log Game action instead of a floating speed dial",
  );
}
if (
  !competeSource.includes('accessibilityLabel="Log a game"') ||
  !competeSource.includes(">LOG GAME</Text>")
) {
  failures.push(
    "app/(tabs)/compete.tsx: missing the explicit accessible Log Game action",
  );
}

if (failures.length > 0) {
  console.error(
    "Design consistency check failed:\n" +
      failures.map((failure) => `- ${failure}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  "Design consistency check passed: canonical brand, icon, typography, spacing, radius, and " +
    "shared-component ownership rules hold, and no accent-color drift was found.",
);
