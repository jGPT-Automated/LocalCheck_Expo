// Isolated interactive proof. Every remote HTTP request is fulfilled/aborted
// and all WebSockets are blocked BEFORE navigation. No live account is used.
// node scripts/visual-qa/court-activity-journey.mjs http://127.0.0.1:8084 /tmp/activity-proof
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-10-17T23:30:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT, ME } = await import('./fixtures.mjs');
const [base = 'http://127.0.0.1:8084', out = '/tmp/activity-proof'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const qrScript = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const original = JSON.parse(JSON.stringify(tables));
const report = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const audit = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
try {
for (const [width, height] of [[375, 667], [393, 852], [430, 932]]) {
  for (const key of Object.keys(tables)) tables[key] = structuredClone(original[key]);
  tables.planned_visits.push({ id: 'private-fixture', user_id: 'private-player', court_id: COURT, planned_at: '2026-10-19T01:00:00.000Z', visibility: 'private' });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', reducedMotion: 'reduce' });
  await context.routeWebSocket(/.*/, (ws) => ws.close());
  await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
  await context.addInitScript((session) => {
    for (const id of ['qkrnmyexzvaxiqfxwwfb', 'ci-placeholder']) localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session));
  }, SESSION);
  let failSave = false, failLoad = false, writes = 0;
  const errors = [];
  await context.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    if (url.includes('cdn.jsdelivr.net/npm/jsqr')) return route.fulfill({ contentType: 'application/javascript', body: qrScript });
    let result;
    if (url.includes('/rest/v1/planned_visits') && req.method() === 'POST') {
      writes++;
      if (failSave) result = { status: 503, body: JSON.stringify({ message: 'Fixture unavailable' }) };
      else {
        const row = req.postDataJSON();
        tables.planned_visits.push({ ...row, id: `fixture-${writes}`, created_at: new Date(Number(process.env.FAKE_NOW)).toISOString() });
        result = { status: 201, body: '' };
      }
    } else if (url.includes('/rest/v1/planned_visits') && req.method() === 'DELETE') {
      writes++;
      const id = new URL(url).searchParams.get('id')?.replace(/^eq\./, '');
      tables.planned_visits = tables.planned_visits.filter((v) => v.id !== id);
      result = { status: 204, body: '' };
    } else if (url.includes('/rest/v1/rpc/court_planned_times')) {
      if (failLoad) result = { status: 503, body: JSON.stringify({ message: 'Fixture unavailable' }) };
      else {
        const params = req.postDataJSON();
        result = { status: 200, body: JSON.stringify(tables.planned_visits.filter((v) => v.court_id === params.p_court_id && v.planned_at >= params.p_from && v.planned_at < params.p_to).map((v) => v.planned_at)) };
      }
    } else if (url.includes('/rest/v1/')) result = handleRest(req.method(), url, req.headers());
    else if (url.includes('/auth/v1/')) result = handleAuth(url);
    else if (url.includes('/functions/v1/') || url.includes('/storage/v1/')) result = { status: 200, body: '{}' };
    else return route.abort();
    await route.fulfill({ status: result.status, body: result.body, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...result.headers } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const open = async (path) => { await page.goto(base + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(2600); };
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}-${width}.png` }); };
  const scrub = async (hour, drag = false) => {
    const b = await page.getByTestId('court-time-chart').boundingBox();
    const x = b.x + (hour - 6 + .5) / 17 * b.width, y = b.y + 20;
    if (drag) { await page.mouse.move(b.x + b.width * .5, y); await page.mouse.down(); await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up(); }
    else await page.mouse.click(x, y);
    await page.waitForTimeout(450);
  };
  let chartBefore, chartAfter;
  if (!process.env.QA_PLANNER_ONLY) {
  await open(`/court/${COURT}`);
  await page.getByTestId('court-activity-scroll').waitFor();
  await shot('court-feed');
  chartBefore = await page.getByTestId('court-time-chart').boundingBox();
  await scrub(20, true);
  assert.match(await page.getByTestId('court-time-chart').getAttribute('aria-label'), /8P/);
  await shot('court-scrubbed');
  const list = page.getByTestId('court-activity-scroll');
  const labelBeforeScroll = await page.getByTestId('court-time-chart').getAttribute('aria-label');
  await list.evaluate((e) => { e.scrollTop += 200; });
  await page.waitForTimeout(350);
  chartAfter = await page.getByTestId('court-time-chart').boundingBox();
  assert.equal(chartBefore.y, chartAfter.y, 'chart stays anchored during vertical scroll');
  assert.notEqual(await page.getByTestId('court-time-chart').getAttribute('aria-label'), labelBeforeScroll);
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await page.getByText('Tomorrow', { exact: true }).waitFor();
  const dayHeading = await page.getByTestId('court-day-heading').boundingBox();
  await page.mouse.move(dayHeading.x + dayHeading.width - 20, dayHeading.y + dayHeading.height / 2);
  await page.mouse.down();
  await page.mouse.move(dayHeading.x + 20, dayHeading.y + dayHeading.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.getByText('Mon, Oct 19', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await page.getByText('Tomorrow', { exact: true }).waitFor();
  await scrub(20);
  const row = page.getByTestId('activity-hour-20');
  await row.getByText('1 private', { exact: true }).waitFor();
  failSave = true;
  await row.getByRole('button', { name: "I'm going", exact: true }).click();
  await row.getByText('Could not save your time. Try again.').waitFor();
  assert.equal(tables.planned_visits.some((v) => v.user_id === ME && v.planned_at === '2026-10-19T01:00:00.000Z'), false);
  await shot('court-save-error');
  failSave = false;
  await row.getByRole('button', { name: "I'm going", exact: true }).click();
  await row.getByRole('button', { name: "I'm not coming", exact: true }).waitFor();
  await shot('court-going');
  await open(`/court/${COURT}`);
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await scrub(20);
  await page.getByTestId('activity-hour-20').getByRole('button', { name: "I'm not coming", exact: true }).click();
  await page.getByTestId('activity-hour-20').getByRole('button', { name: "I'm going", exact: true }).waitFor();
  await open(`/court/${COURT}?tab=week`);
  await page.getByTestId('week-5-6').click();
  await page.getByTestId('court-activity-scroll').waitFor();
  assert.match(await page.getByTestId('court-time-chart').getAttribute('aria-label'), /7P/);
  await shot('court-heatmap-pick');
  failLoad = true;
  await open(`/court/${COURT}`);
  await page.getByRole('button', { name: "Couldn't load activity. Try again." }).waitFor();
  await shot('court-load-error');
  failLoad = false;
  await page.getByRole('button', { name: "Couldn't load activity. Try again." }).click();
  await page.getByTestId('activity-hour-19').getByRole('button', { name: "I'm going", exact: true }).waitFor();
  const savedTables = structuredClone(tables);
  const rosterProfile = tables.check_ins.find((v) => v.court_id === COURT && !v.checked_out_at && v.user_id !== ME)?.user_id;
  tables.profiles = tables.profiles.filter((v) => v.id !== rosterProfile);
  await open(`/court/${COURT}`);
  await page.getByText('+1 private', { exact: true }).waitFor();
  await shot('court-private');
  for (const key of Object.keys(tables)) tables[key] = structuredClone(savedTables[key]);
  const busyTables = structuredClone(tables);
  for (const key of ['check_ins', 'planned_visits', 'runs', 'run_participants', 'activity_events']) tables[key] = [];
  for (const key of ['courts', 'courts_with_stats']) for (const row of tables[key] ?? []) row.active_check_in_count = 0;
  await open(`/court/${COURT}`);
  await page.getByText("Nobody yet. Check in and you're first.", { exact: true }).waitFor();
  await shot('court-empty');
  for (const key of Object.keys(tables)) tables[key] = structuredClone(busyTables[key]);
  }
  await open('/');
  assert.equal(await page.getByText('Recent activity', { exact: true }).count(), 0);
  await page.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 200) e.scrollTop = e.scrollHeight; });
  await page.waitForTimeout(300);
  await shot('home-chart');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await scrub(20);
  const selectedSlot = await page.getByTestId('selected-court-hour').boundingBox();
  assert.ok(selectedSlot.y + selectedSlot.height <= height - 88, 'selected hour clears the Home tab floor');
  assert.match(await page.getByTestId('selected-court-hour').innerText(), /private/);
  await shot('home-slot');
  await open('/explore');
  await page.getByTestId(`court-${COURT}`).click();
  await page.waitForTimeout(1500);
  await page.getByLabel(/, expand$/).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.getByText('Recent activity', { exact: true }).count(), 0);
  await shot('drawer');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await scrub(20);
  await shot('drawer-slot');
  const visual = await page.evaluate(`(${audit})()`);
  assert.deepEqual(errors, []);
  report.push({ width, writes, errors, chartY: chartBefore?.y, chartAfterScrollY: chartAfter?.y, drawerAudit: visual });
  await context.close();
}
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
