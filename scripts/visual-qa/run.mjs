#!/usr/bin/env node
// Visual QA: opens every screen in scripts/visual-qa/screens.mjs on three
// phone sizes, signed in against an in-memory Supabase stand-in, saves a
// screenshot of each and checks what is drawn (audit.js).
//
//   node scripts/visual-qa/run.mjs <web export dir> [--out dir] [--update-baseline]
//
// Fails (exit 1) when any screen has cut-off, clipped, overlapping or
// off-screen text or scrolls sideways, or when a screen has more small text,
// low-contrast text or small targets than baseline.json allows.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const dist = resolve(args.find((a) => !a.startsWith("--")) ?? "/tmp/localcheck-ci-export");
const outDir = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : "/tmp/localcheck-visual-qa");
const updateBaseline = args.includes("--update-baseline");
const VIEWPORTS = [
  { name: "375x667", width: 375, height: 667 }, // iPhone SE: the smallest supported
  { name: "393x852", width: 393, height: 852 }, // iPhone 15/16
  { name: "430x932", width: 430, height: 932 }, // Pro Max
];
// Saturday Oct 17 2026, 6:30 PM Central: courts are busy, games are upcoming.
process.env.FAKE_NOW ??= String(Date.parse("2026-10-17T23:30:00Z"));
process.env.TZ = "America/Chicago";

const { chromium } = await import("playwright");
const { handleAuth, handleRest, SESSION } = await import("./mock.mjs");
const { setOnboarding, setCourtPresentationStress, setLocalPlusScenario } = await import("./fixtures.mjs");
const { SCREENS: ALL_SCREENS } = await import("./screens.mjs");
// QA_ONLY=home,court-week runs just the screens whose names contain those words.
const only = process.env.QA_ONLY?.split(",").filter(Boolean);
const SCREENS = only ? ALL_SCREENS.filter((s) => only.some((o) => s.name.includes(o))) : ALL_SCREENS;
const sizes = process.env.QA_SIZES?.split(",");
const activeViewports = VIEWPORTS.filter((v) => !sizes || sizes.includes(v.name));
const AUDIT = readFileSync(join(here, "audit.js"), "utf8");

if (!existsSync(join(dist, "index.html"))) {
  console.error(`No web export at ${dist}. Run: pnpm export:web -- --output-dir ${dist}`);
  process.exit(2);
}
// The storage key supabase-js uses comes from the URL the bundle was built
// with, so read that URL from the bundle (the shell's env may differ).
const jsDir = join(dist, "_expo/static/js/web");
const bundleText = readdirSync(jsDir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(jsDir, f), "utf8")).join("\n");
const builtUrl = bundleText.match(/https:\/\/[a-z0-9-]+\.(?:supabase\.co|invalid)/)?.[0] ?? "https://ci-placeholder.invalid";
const storageKey = `sb-${new URL(builtUrl).hostname.split(".")[0]}-auth-token`;

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  let file = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const results = {};
const failures = [];
mkdirSync(outDir, { recursive: true });

for (const vp of activeViewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: "America/Chicago" });
  await context.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [storageKey, SESSION]);
  await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(base)) return route.continue();
    let result;
    if (url.includes("/rest/v1/")) result = handleRest(req.method(), url, req.headers(), req.postDataJSON() ?? {});
    else if (url.includes("/auth/v1/")) result = handleAuth(url);
    else if (url.includes("/functions/v1/") || url.includes("/storage/v1/")) result = { status: 200, body: "{}" };
    else return route.abort();
    await route.fulfill({ status: result.status, body: result.body, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...(result.headers ?? {}) } });
  });
  const page = await context.newPage();
  if (process.env.QA_DEBUG) page.on("console", (m) => console.log("console:", m.text().slice(0, 200)));
  mkdirSync(join(outDir, vp.name), { recursive: true });
  for (const screen of SCREENS) {
    setLocalPlusScenario(screen.localPlus ?? 0);
    setOnboarding(Boolean(screen.onboarding));
    setCourtPresentationStress(Boolean(screen.courtStress));
    await page.goto(`${base}${screen.path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(2500);
    for (const a of screen.actions ?? []) {
      try {
        if (a.click) await page.getByText(a.click, { exact: a.exact ?? true }).first().click({ timeout: 4000 });
        if (a.label) await page.getByLabel(a.label, { exact: true }).first().click({ timeout: 4000 });
        if (a.testId) await page.getByTestId(a.testId).first().click({ timeout: 4000 });
        if (a.eval) await page.evaluate(a.eval);
      } catch (error) {
        failures.push(`${vp.name} ${screen.name}: could not reach this state (${String(error.message).split("\n")[0]})`);
      }
      await page.waitForTimeout(a.wait ?? 800);
    }
    await page.screenshot({ path: join(outDir, vp.name, `${screen.name}.png`) });
    const found = await page.evaluate(`(${AUDIT})()`);
    const key = `${vp.name}/${screen.name}`;
    results[key] = found;
    for (const [kind, text] of found.fail) failures.push(`${key}: ${kind}: "${text}"`);
    // Preserve completed checks if a cloud session interrupts a long sweep.
    writeFileSync(join(outDir, "progress.json"), `${JSON.stringify({ results, failures }, null, 2)}\n`);
  }
  await context.close();
}
await browser.close();
server.close();

const baselinePath = join(here, "baseline.json");
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
const counts = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { smallText: r.debt.smallText.length, lowContrast: r.debt.lowContrast.length, smallTarget: r.debt.smallTarget.length }]));
const regressions = [];
for (const [key, c] of Object.entries(counts)) {
  for (const metric of Object.keys(c)) {
    const allowed = baseline[key]?.[metric];
    if (allowed != null && c[metric] > allowed) regressions.push(`${key}: ${metric} ${c[metric]} (baseline ${allowed}): ${results[key].debt[metric].slice(0, 6).join("; ")}`);
  }
}
if (updateBaseline) writeFileSync(baselinePath, `${JSON.stringify(counts, null, 2)}\n`);

const total = (m) => Object.values(counts).reduce((s, c) => s + c[m], 0);
const report = [
  "# Visual QA",
  "",
  `${SCREENS.length} screens x ${activeViewports.length} sizes. Screenshots in ${outDir}/<size>/<screen>.png.`,
  "",
  `## Failures (${failures.length})`,
  ...(failures.length ? failures.map((f) => `- ${f}`) : ["None."]),
  "",
  `## Above baseline (${regressions.length})`,
  ...(regressions.length ? regressions.map((f) => `- ${f}`) : ["None."]),
  "",
  "## Apple minimums still owed (all screens, all sizes)",
  `- Text under 11pt: ${total("smallText")}`,
  `- Text under 4.5:1 contrast (3:1 large): ${total("lowContrast")}`,
  `- Controls under 44x44pt (hitSlop not visible on web): ${total("smallTarget")}`,
].join("\n");
writeFileSync(join(outDir, "report.md"), `${report}\n`);
writeFileSync(join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(report);
process.exit(failures.length || (regressions.length && !updateBaseline) ? 1 : 0);
