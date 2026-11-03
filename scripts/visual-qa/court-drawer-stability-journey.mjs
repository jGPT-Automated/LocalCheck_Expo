// Reopen the Explore court drawer repeatedly and measure the settled sheet box.
// All backend HTTP is fulfilled/aborted and all WebSockets are closed before
// navigation. No live account or backend write is used.
// node scripts/visual-qa/court-drawer-stability-journey.mjs [preview URL] [evidence dir]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

process.env.FAKE_NOW = String(Date.parse('2026-10-17T23:30:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT } = await import('./fixtures.mjs');
const [base = 'http://127.0.0.1:8097', out = '/tmp/drawer-stable'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const qr = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const original = structuredClone(tables);
const sizes = [[375, 667], [393, 852], [430, 932]];
const results = [];
const failures = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });

try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
      timezoneId: 'America/Chicago', reducedMotion: 'reduce',
    });
    const websocketClosures = [];
    await context.routeWebSocket(/.*/, (socket) => { websocketClosures.push('closed'); socket.close(); });
    await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
    await context.addInitScript((session) => {
      for (const id of ['qkrnmyexzvaxiqfxwwfb', 'ci-placeholder']) localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session));
    }, SESSION);
    const remoteHttp = [];
    const unexpectedWrites = [];
    await context.route('**/*', async (route) => {
      const req = route.request(), url = req.url();
      if (url.startsWith(base)) return route.continue();
      if (url.includes('cdn.jsdelivr.net/npm/jsqr')) {
        remoteHttp.push({ url, method: req.method(), disposition: 'fulfilled-jsqr' });
        return route.fulfill({ contentType: 'application/javascript', body: qr });
      }
      let result;
      if (url.includes('/rest/v1/')) {
        if (!['GET', 'HEAD'].includes(req.method()) && !url.includes('/rpc/')) unexpectedWrites.push({ url, method: req.method() });
        result = handleRest(req.method(), url, req.headers());
      } else if (url.includes('/auth/v1/')) result = handleAuth(url);
      else if (url.includes('/functions/v1/') || url.includes('/storage/v1/')) result = { status: 200, body: '{}' };
      else {
        remoteHttp.push({ url, method: req.method(), disposition: 'aborted' });
        return route.abort();
      }
      remoteHttp.push({ url, method: req.method(), disposition: `fulfilled-${result.status}` });
      return route.fulfill({ status: result.status, body: result.body, headers: {
        'content-type': 'application/json', 'access-control-allow-origin': '*',
        'access-control-expose-headers': 'content-range', ...result.headers,
      } });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const trials = [];
    const measureSheet = async (control) => control.evaluate((el) => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        if (style.transform !== 'none' && rect.width >= innerWidth - 1 && rect.height >= innerHeight - 20) {
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, transform: style.transform };
        }
      }
      return null;
    });
    for (let trial = 1; trial <= 5; trial++) {
      for (const key of Object.keys(tables)) tables[key] = structuredClone(original[key]);
      await page.goto(`${base}/explore`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await page.getByTestId(`court-${COURT}`).click();
      const openControl = page.getByLabel(/, expand$/);
      await page.waitForTimeout(600);
      const collapsed = [];
      for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(100);
        const count = await openControl.count();
        const box = count ? await measureSheet(openControl.first()) : null;
        collapsed.push(box);
      }
      assert.ok(collapsed.every(Boolean), `trial ${trial}: drawer stays open without input for 1.6s at ${width}`);
      const collapsedYs = collapsed.map(box => box.y);
      const collapsedYDrift = Math.max(...collapsedYs) - Math.min(...collapsedYs);
      assert.ok(collapsedYDrift <= 1, `trial ${trial}: collapsed header remains stable (${collapsedYDrift}px drift)`);
      if (trial === 1) await page.screenshot({ path: `${out}/collapsed-${width}.png` });

      const expanded = [];
      let dismissedBy;
      if (trial === 1) {
        await openControl.first().click();
        await page.waitForTimeout(700);
        for (let i = 0; i < 8; i++) {
          const box = await measureSheet(page.getByLabel(/, expand$/).first());
          expanded.push(box);
          await page.waitForTimeout(100);
        }
        assert.ok(expanded.every(Boolean), `trial ${trial}: drawer remains visible after explicit expand at ${width}`);
        const expandedYs = expanded.map(box => box.y);
        const expandedYDrift = Math.max(...expandedYs) - Math.min(...expandedYs);
        assert.ok(expandedYDrift <= 1, `trial ${trial}: expanded sheet remains stable (${expandedYDrift}px drift)`);
        await page.screenshot({ path: `${out}/expanded-${width}.png` });
        await page.getByRole('button', { name: 'Open Kasmiersky Park', exact: true }).last().click();
        await page.waitForURL(`**/court/${COURT}`);
        dismissedBy = 'explicit court navigation';
      } else {
        await page.mouse.click(width / 2, 10);
        dismissedBy = 'backdrop tap';
      }
      await page.waitForTimeout(500);
      assert.equal(await page.getByLabel(/, expand$/).count(), 0, `trial ${trial}: ${dismissedBy} dismisses the sheet`);
      trials.push({
        trial,
        openIdleSamples: collapsed.length,
        collapsedSheetBox: collapsed[0],
        collapsedYDrift,
        expandedSheetBox: expanded[0] ?? null,
        expandedYDrift: expanded.length ? Math.max(...expanded.map(box => box.y)) - Math.min(...expanded.map(box => box.y)) : null,
        dismissedBy,
      });
    }
    assert.deepEqual(pageErrors, [], `no page errors at ${width}`);
    assert.deepEqual(unexpectedWrites, [], `no fixture table writes at ${width}`);
    assert.ok(remoteHttp.every(item => item.disposition.startsWith('fulfilled') || item.disposition === 'aborted'));
    assert.ok(websocketClosures.every(item => item === 'closed'));
    results.push({ width, height, trials, pageErrors, unexpectedWrites, remoteHttpCount: remoteHttp.length, websocketClosures: websocketClosures.length });
    console.log(`PASS ${width}: ${trials.length} stable first opens, explicit expand and backdrop dismiss; max collapsed/expanded y drift ${Math.max(...trials.flatMap(t => [t.collapsedYDrift, t.expandedYDrift]))}px`);
    await context.close();
  }
} catch (error) {
  failures.push(String(error.stack || error));
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ base, results, failures }, null, 2));
}
if (failures.length) process.exitCode = 1;
console.log(JSON.stringify({ results: results.map(row => ({ width: row.width, trialCount: row.trials.length, maxDrift: Math.max(...row.trials.flatMap(t => [t.collapsedYDrift, t.expandedYDrift])) })), failures }, null, 2));
