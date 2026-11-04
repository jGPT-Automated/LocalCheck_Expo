// Isolated interactive proof. Every remote HTTP request is fulfilled/aborted
// and all WebSockets are blocked BEFORE navigation. No live account is used.
// node scripts/visual-qa/court-day-selection-journey.mjs <preview URL> <output directory>
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-10-17T23:30:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT } = await import('./fixtures.mjs');
const [base, out] = process.argv.slice(2);
assert.ok(base && out, 'Pass the preview URL and evidence directory');
mkdirSync(out, { recursive: true });
const qrScript = '';
const original = JSON.parse(JSON.stringify(tables));
const report = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
for (const [width, height] of [[375, 667], [393, 852], [430, 932]]) {
  for (const key of Object.keys(tables)) tables[key] = structuredClone(original[key]);
  if (process.env.DASHBOARD_SIZES && !process.env.DASHBOARD_SIZES.split(",").includes(`${width}x${height}`)) continue;
  tables.planned_visits.push({ id: 'private-fixture', user_id: 'private-player', court_id: COURT, planned_at: '2026-10-19T01:00:00.000Z', visibility: 'private' });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', reducedMotion: 'reduce' });
  await context.routeWebSocket(/.*/, (ws) => ws.close());
  await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
  await context.addInitScript((session) => {
    for (const id of ['qkrnmyexzvaxiqfxwwfb', 'ci-placeholder']) localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session));
  }, SESSION);
  const unexpectedWrites = [];
  const errors = [];
  const checks = [];
  const check = async (name, fn) => { try { await fn(); checks.push({name, passed:true}); console.log(`PASS ${width} ${name}`); } catch(e) { checks.push({name, passed:false, error:String(e.message).slice(0,450)}); console.log(`FAIL ${width} ${name}: ${String(e.message).slice(0,250)}`); } };
  await context.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    if (url.includes('cdn.jsdelivr.net/npm/jsqr')) return route.fulfill({ contentType: 'application/javascript', body: qrScript });
    let result;
    if (url.includes('/rest/v1/rpc/court_planned_times')) {
      const params = req.postDataJSON();
      result = { status: 200, body: JSON.stringify(tables.planned_visits.filter((v) => v.court_id === params.p_court_id && v.planned_at >= params.p_from && v.planned_at < params.p_to).map((v) => v.planned_at)) };
    } else if (url.includes('/rest/v1/') && !['GET', 'HEAD'].includes(req.method()) && !url.includes('/rpc/')) {
      unexpectedWrites.push(`${req.method()} ${url}`); return route.abort();
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
  await open('/explore');
  await page.getByTestId(`court-${COURT}`).click();
  await page.getByLabel(/, expand$/).click();
  await page.waitForTimeout(1500);
  await check('Rapid day changes keep chart and selected attendance on the same day', async () => {
    const chart = page.getByTestId('court-time-chart');
    const slot = page.getByTestId('selected-court-hour');
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', {name:'Next day', exact:true}).click();
      await scrub(20);
      try {
        assert.match(await chart.getAttribute('aria-label'), /Tomorrow activity, 8P ·/i);
        await slot.getByText('1 private', {exact:true}).waitFor({timeout:1200});
        assert.equal(await slot.getByRole('button', {name:'Open CHATGPT', exact:true}).count(), 0);
        assert.equal(await slot.getByRole('button', {name:"I'm going", exact:true}).count(), 1);
      } catch (error) {
        await shot(`wrong-tomorrow-${i}`);
        throw new Error(`transition ${i}, chart ${await chart.getAttribute('aria-label')}, card ${await slot.innerText().catch(() => '<missing>')}: ${error.message}`);
      }
      await page.getByRole('button', {name:'Previous day', exact:true}).click();
      await scrub(20);
      assert.match(await chart.getAttribute('aria-label'), /Today activity, 8P ·/i);
      assert.equal(await slot.getByRole('button', {name:'Open CHATGPT', exact:true}).count(), 1);
    }
    await shot('drawer-today-8pm');
    await page.getByRole('button', {name:'Next day', exact:true}).click();
    await scrub(20); await shot('drawer-tomorrow-8pm');
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedWrites, []);
  report.push({width,checks,errors}); await context.close();
}
} finally {
  await browser.close(); writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));
}
if(report.some(r=>r.checks.some(c=>!c.passed))) process.exitCode=1;
