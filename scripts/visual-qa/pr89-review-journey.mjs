// Regressions for the approved PR #89 review patch. Backend HTTP is fulfilled
// locally and every WebSocket is blocked before navigation; no live account.
// node scripts/visual-qa/pr89-review-journey.mjs <preview URL> <evidence directory>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-10-17T23:30:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT } = await import('./fixtures.mjs');
const [base, out] = process.argv.slice(2);
assert.ok(base && out, 'Pass the preview URL and evidence directory');
mkdirSync(out, { recursive: true });
const qr = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const fixture = (id, actor, when) => ({ id, event_type: 'check_out', actor_id: actor, occurred_at: when,
  court_id: COURT, visibility: 'public', payload: {}, match_id: null, run_id: null });
tables.activity_events.push(
  fixture(9001, null, '2026-10-17T23:20:00.000Z'), // Now: no actor
  fixture(9002, null, '2026-10-17T19:15:00.000Z'), // 2 PM: no actor
  fixture(9003, '22222222-2222-4222-8222-222222222222', '2026-10-17T17:15:00.000Z'),
);
const audit = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
const results = [];
const failures = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
for (const [width, height] of [[375, 667], [393, 852], [430, 932]]) {
  if (process.env.REVIEW_SIZES && !process.env.REVIEW_SIZES.split(',').includes(`${width}x${height}`)) continue;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'America/Chicago' });
  await context.routeWebSocket(/.*/, ws => ws.close());
  await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
  await context.addInitScript(session => {
    for (const id of ['qkrnmyexzvaxiqfxwwfb', 'ci-placeholder']) localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session));
  }, SESSION);
  let writes = 0;
  await context.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    if (url.includes('cdn.jsdelivr.net/npm/jsqr')) return route.fulfill({ contentType: 'application/javascript', body: qr });
    let response;
    if (url.includes('/rest/v1/')) {
      if (!['GET', 'HEAD'].includes(req.method()) && !url.includes('/rpc/')) writes++;
      response = handleRest(req.method(), url, req.headers());
    } else if (url.includes('/auth/v1/')) response = handleAuth(url);
    else if (url.includes('/functions/v1/') || url.includes('/storage/v1/')) response = { status: 200, body: '{}' };
    else return route.abort();
    return route.fulfill({ status: response.status, body: response.body, headers: { 'content-type': 'application/json',
      'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...response.headers } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const open = async path => { await page.goto(base + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(2400); };
  const chart = () => page.getByTestId('court-time-chart');
  const label = () => chart().getAttribute('aria-label');
  const select = async (hour, drag = false) => {
    const b = await chart().boundingBox(), x = b.x + (hour - 6 + .5) / 17 * b.width, y = b.y + 20;
    if (drag) { await page.mouse.move(b.x + b.width / 2, y); await page.mouse.down(); await page.mouse.move(x, y, { steps: 10 }); await page.mouse.up(); }
    else await page.mouse.click(x, y);
    await page.waitForTimeout(350);
  };
  const screenshot = async name => {
    await page.screenshot({ path: `${out}/${name}-${width}.png` });
    const visual = await page.evaluate(`(${audit})()`);
    assert.deepEqual(visual.fail, [], `${name}: clipping/overlap/sideways scroll`);
  };
  const check = async (name, fn) => {
    if (process.env.REVIEW_CASE && !name.includes(process.env.REVIEW_CASE)) return;
    try { const evidence = await fn(); results.push({ width, name, passed: true, evidence }); console.log(`PASS ${width} ${name}`); }
    catch (error) { const message = String(error.message).split('\n').slice(0, 4).join(' ') + (error.actual !== undefined ? ` actual=${JSON.stringify(error.actual)} expected=${JSON.stringify(error.expected)}` : ''); results.push({ width, name, passed: false, error: message }); failures.push(`${width} ${name}: ${message}`); console.log(`FAIL ${width} ${name}: ${message}`); }
  };
  await check('today heatmap preserves 5 PM block at 6:30 PM', async () => {
    await open(`/court/${COURT}?tab=week`);
    assert.equal(await page.getByTestId('week-5-4').getAttribute('aria-disabled'), 'true', 'Completed 3 PM block stays disabled');
    await page.getByTestId('week-5-5').click(); await page.waitForTimeout(500);
    const selected = await label(); await screenshot('today-5pm');
    assert.match(selected, /activity, 5P ·/, 'Tapped 5 PM must not become 6 PM');
    return { selected };
  });
  await check('future heatmap preserves 7 PM', async () => {
    await open(`/court/${COURT}?tab=week`);
    await page.getByTestId('week-5-6').click(); await page.waitForTimeout(500);
    assert.match(await label(), /activity, 7P ·/);
  });
  await check('past-day top hour remains 10 PM after scroll clamps to zero', async () => {
    await open(`/court/${COURT}`);
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    await select(17); await select(22);
    const selected = await label(); await screenshot('yesterday-10pm');
    assert.match(selected, /activity, 10P ·/);
    return { selected, scrollTop: await page.getByTestId('court-activity-scroll').evaluate(e => e.scrollTop) };
  });
  await check('rapid scrub and manual scrolling stay linked on past/today/future days', async () => {
    await open(`/court/${COURT}`);
    const y = (await chart().boundingBox()).y;
    for (const day of ['today', 'tomorrow', 'yesterday']) {
      if (day === 'tomorrow') await page.getByRole('button', { name: 'Next day', exact: true }).click();
      if (day === 'yesterday') for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Previous day', exact: true }).click();
      for (const hour of [21, 22, 20, 22, 6, 22]) {
        await select(hour);
        if (process.env.REVIEW_TRACE) console.log(JSON.stringify({day, hour, label: await label(), geometry: await page.getByTestId('court-activity-scroll').evaluate(e => ({top:e.scrollTop, height:e.clientHeight, content:e.scrollHeight, rows:[...e.querySelectorAll('[data-testid^=activity-hour]')].map(r=>({id:r.dataset.testid, y:r.offsetTop, height:r.clientHeight}))}))}));
        assert.match(await label(), new RegExp(`activity, ${hour % 12 || 12}${hour < 12 ? 'A' : 'P'} ·`), `${day}: hour ${hour}`);
      }
    }
    await select(19, true); assert.match(await label(), /activity, 7P ·/);
    const before = await label();
    await page.getByTestId('court-activity-scroll').evaluate(e => { e.scrollTop += 180; });
    await page.waitForTimeout(300);
    assert.notEqual(await label(), before);
    assert.equal((await chart().boundingBox()).y, y);
    return { chartY: y };
  });
  for (const [name, hour] of [['now', 18], ['past', 14]]) await check(`missing actor in ${name} does not navigate`, async () => {
    await open(`/court/${COURT}`); await select(hour);
    const actor = page.getByTestId(`activity-hour-${hour}`).getByText('Someone', { exact: true });
    await actor.scrollIntoViewIfNeeded(); await screenshot(`actorless-${name}`);
    const before = page.url(); await actor.click(); await page.waitForTimeout(300);
    assert.equal(page.url(), before, 'An empty actor ID must never open a player route');
  });
  await check('valid actor opens the correct player', async () => {
    await open(`/court/${COURT}`); await select(12);
    await page.getByTestId('activity-hour-12').getByText('Player2', { exact: true }).click();
    await page.waitForURL('**/player/22222222-2222-4222-8222-222222222222');
  });
  await check('hourly court feed owns its single date heading', async () => {
    await open(`/court/${COURT}`);
    assert.equal(await page.getByText('Today', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    assert.equal(await page.getByText('Yesterday', { exact: true }).count(), 1);
  });
  for (const [name, path] of [['me', '/elo'], ['player', '/player/22222222-2222-4222-8222-222222222222']]) await check(`${name} activity keeps default date headings`, async () => {
    await open(path);
    if (name === 'player') await page.getByRole('tab', { name: /^activity$/i }).click();
    await page.getByText('Today', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Today', { exact: true }).count(), 1);
    await screenshot(`${name}-activity`);
  });
  await check('no page errors or product writes', async () => {
    assert.deepEqual(errors, []); assert.equal(writes, 0);
  });
  await context.close();
}
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, failures }, null, 2));
}
if (failures.length) process.exitCode = 1;
