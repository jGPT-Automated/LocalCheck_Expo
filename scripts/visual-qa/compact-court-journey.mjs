// Render the real Expo routes with isolated HTTP fixtures; never write production.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-11-17T18:00:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, ME, COURT } = await import('./fixtures.mjs');
const [base, out] = process.argv.slice(2);
assert.ok(base && out, 'usage: node compact-court-journey.mjs URL OUTPUT');
mkdirSync(out, { recursive: true });
const original = structuredClone(tables);
const results = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const strict = process.env.EXPECT_COMPACT === '1';
const qr = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
try {
  for (const width of (process.env.WIDTHS || '320,375,393,430').split(',').map(Number)) {
    for (const variant of (process.env.VARIANTS || 'short,fallback,four-digit').split(',')) {
      for (const key of Object.keys(original)) tables[key] = structuredClone(original[key]);
      for (const key of ['courts', 'courts_with_stats']) {
        const row = tables[key].find(c => c.id === COURT);
        Object.assign(row, { name: variant === 'fallback' ? 'Rancho Cienega Sports Complex' : 'Kasmiersky Park Basketball Courts', short_name: variant === 'fallback' ? null : 'Kasmiersky Park', city: 'Conroe', active_check_in_count: variant === 'four-digit' ? 1000 : 0 });
        const other = tables[key].find(c => c.id !== COURT && c.sport_type === 'basketball');
        if (other) Object.assign(other, { name: 'Sand Branch Courts', short_name: 'Sand Branch', city: 'Conroe', market: 'Conroe' });
      }
      const profile = tables.profiles.find(p => p.id === ME);
      profile.local_court_id = COURT;
      profile.preferred_sport = 'basketball';
      profile.account_tag = 'TEST';
      tables.check_ins = tables.check_ins.filter(row => row.court_id !== COURT || row.checked_out_at != null);
      if (variant === 'four-digit') for (let i = 0; i < 1000; i++) {
        const id = `stress-${i}`;
        tables.profiles.push({ ...profile, id, username: `p${i}`, display_name: `p${i}`, local_court_id: null });
        tables.check_ins.push({ id, user_id: id, court_id: COURT, checked_in_at: new Date(Number(process.env.FAKE_NOW) - 60000).toISOString(), checked_out_at: null, visibility: 'public', source: 'manual' });
      }
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 667 : 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'America/Chicago' });
      await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
      await context.addInitScript(session => localStorage.setItem('sb-qkrnmyexzvaxiqfxwwfb-auth-token', JSON.stringify(session)), SESSION);
      await context.routeWebSocket(/.*/, socket => socket.close());
      await context.route('**/*', async route => {
        const req = route.request(), url = req.url();
        if (url.startsWith(base)) return route.continue();
        if (url.includes('cdn.jsdelivr.net/npm/jsqr')) return route.fulfill({ contentType: 'application/javascript', body: qr });
        const response = url.includes('/rest/v1/') ? handleRest(req.method(), url, req.headers()) : url.includes('/auth/v1/') ? handleAuth(url) : null;
        if (!response) return route.abort();
        return route.fulfill({ status: response.status, body: response.body, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...response.headers } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      const capture = async surface => {
        await page.getByTestId('court-title-name').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const rows = await page.getByTestId('court-title-row').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().height > 0).map(row => {
          const title = row.querySelector('[data-testid="court-title-name"]');
          const live = row.querySelector('[data-testid="court-live-block"]');
          const art = row.querySelector('[data-testid="court-live-art"]');
          const value = art?.nextElementSibling || live.firstElementChild;
          const r = row.getBoundingClientRect(), t = title.getBoundingClientRect(), l = live.getBoundingClientRect(), a = art?.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(title);
          const ink = range.getBoundingClientRect();
          const v = value.getBoundingClientRect();
          return { name: title.textContent, liveValue: value.textContent, valueWithinColumn: v.left >= l.left - 1 && v.right <= l.right + 1, rowHeight: r.height, titleHeight: t.height, fontSize: parseFloat(getComputedStyle(title).fontSize), textWidth: ink.width, available: t.width, titleCountGap: l.x - t.right, countWidth: l.width, countCenterDeltaY: l.y + l.height / 2 - r.y - r.height / 2, artCenterDeltaY: a ? a.y + a.height / 2 - l.y - l.height / 2 : null, circleCenterDeltaX: a ? a.x + 84 - l.x - l.width / 2 : null, cardHeight: row.parentElement.getBoundingClientRect().height, withinViewport: t.left >= 0 && l.right <= innerWidth };
        }));
        const name = `${surface}-${width}-${variant}`;
        await page.screenshot({ path: `${out}/${name}.png` });
        results.push({ name, width, variant, surface, rows, errors: [...errors] });
        if (strict) for (const r of rows) {
          assert.ok(r.textWidth <= r.available + 1, `${name}: full title fits (${r.textWidth}/${r.available})`);
          assert.ok(r.withinViewport && r.titleCountGap >= 8, `${name}: columns stay separate`);
          assert.ok(Math.abs(r.countCenterDeltaY) < 1, `${name}: count group centered`);
          assert.notEqual(r.artCenterDeltaY, null, `${name}: artwork belongs to count group`);
          assert.ok(Math.abs(r.artCenterDeltaY) < 1, `${name}: art centered vertically`);
          assert.ok(Math.abs(r.circleCenterDeltaX) < 1, `${name}: circle centered horizontally`);
          assert.ok(r.fontSize >= 11, `${name}: title readable`);
          assert.ok(r.valueWithinColumn, `${name}: live value fits its column`);
          if (variant === 'four-digit' && r.name === 'Kasmiersky Park') assert.equal(r.liveValue, '1000', `${name}: stress count actually rendered`);
        }
        if (strict && surface === 'explore') assert.ok(Math.max(...rows.map(r => r.cardHeight)) - Math.min(...rows.map(r => r.cardHeight)) < 1, `${name}: equal card heights`);
      };
      if (process.env.SURFACES === 'settings-drawer') {
        await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
        await page.getByText('LOCALLIST', { exact: true }).click();
        await page.waitForTimeout(900);
        await capture('settings-drawer');
        assert.deepEqual(errors, [], 'no browser errors');
        await context.close();
        continue;
      }
      await page.goto(`${base}/explore`, { waitUntil: 'networkidle' });
      await capture('explore');
      if (variant === 'short') {
        await page.getByTestId(`court-${COURT}`).click();
        await page.waitForTimeout(900);
        await capture('drawer');
      }
      for (const [surface, route] of [['home', '/'], ['court', `/court/${COURT}`]]) {
        await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        await capture(surface);
      }
      if (variant === 'short') {
        await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
        await page.getByText('LOCALLIST', { exact: true }).click();
        await page.waitForTimeout(900);
        await capture('settings-drawer');
      }
      assert.deepEqual(errors, [], 'no browser errors');
      await context.close();
    }
  }
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ source: base, fixtureIsolation: true, strict, results }, null, 2));
  await browser.close();
}
console.log(`${results.length} rendered states captured; strict=${strict}`);
