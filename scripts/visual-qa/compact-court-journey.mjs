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
        for (const item of tables[key]) item.market='Houston';
        const row = tables[key].find(c => c.id === COURT);
        Object.assign(row, { name: variant === 'fallback' ? 'Rancho Cienega Sports Complex' : 'Kasmiersky Park Basketball Courts', short_name: variant === 'fallback' ? null : 'Kasmiersky Park', city: 'Conroe', market:'Houston', active_check_in_count: variant === 'four-digit' ? 1000 : 0 });
        const other = tables[key].find(c => c.id !== COURT && c.sport_type === 'basketball');
        if (other) Object.assign(other, { name: 'Sand Branch Courts', short_name: 'Sand Branch', city: 'Conroe', market: 'Houston' });
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
        const response = url.includes('/rest/v1/') ? handleRest(req.method(), url, req.headers(), req.postDataJSON() ?? {}) : url.includes('/auth/v1/') ? handleAuth(url) : null;
        if (!response) return route.abort();
        return route.fulfill({ status: response.status, body: response.body, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...response.headers } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      const capture = async (surface, empty = false) => {
        if (!empty) await page.getByTestId('court-title-name').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const rows = await page.getByTestId('court-title-row').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().height > 0).map(row => {
          const title = row.querySelector('[data-testid="court-title-name"]');
          const live = row.querySelector('[data-testid="court-live-block"]');
          const art = row.querySelector('[data-testid="court-live-art"]');
          const value = live.querySelector('[data-testid="court-live-value"]') || art?.nextElementSibling || live.firstElementChild;
          const frame = live.querySelector('[data-testid="court-live-value-frame"]') || value;
          const r = row.getBoundingClientRect(), t = title.getBoundingClientRect(), l = live.getBoundingClientRect(), a = art?.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(title);
          const ink = range.getBoundingClientRect();
          const v = value.getBoundingClientRect();
          const f = frame.getBoundingClientRect();
          const valueRange = document.createRange(); valueRange.selectNodeContents(value);
          const valueInkWidth = valueRange.getBoundingClientRect().width;
          const caption = live.lastElementChild.getBoundingClientRect();
          return { name: title.textContent, liveValue: value.textContent, valueBox: {x:v.x,y:v.y,width:v.width,height:v.height}, valueInkWidth, circleWidth:f.width, captionClearance:a ? caption.y-a.y-97.5:null, circleCenter: a ? {x:a.x+84,y:a.y+66}:null, valueWithinColumn: v.left >= l.left - 1 && v.right <= l.right + 1, rowHeight: r.height, titleHeight: t.height, fontSize: parseFloat(getComputedStyle(title).fontSize), textWidth: ink.width, available: t.width, titleCountGap: l.x - t.right, countWidth: l.width, countCenterDeltaY: l.y + l.height / 2 - r.y - r.height / 2, artCenterDeltaY: a ? a.y + 66 - f.y - f.height / 2 : null, circleCenterDeltaX: a ? a.x + 84 - v.x - v.width / 2 : null, cardHeight: row.parentElement.getBoundingClientRect().height, withinViewport: t.left >= 0 && l.right <= innerWidth };
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
          assert.ok(r.valueInkWidth <= r.circleWidth + 1, `${name}: numeral fits inside circle`);
          assert.ok(r.captionClearance >= 4, `${name}: caption clears circle`);
          if (variant === 'four-digit' && r.name === 'Kasmiersky Park') assert.equal(r.liveValue, '1000', `${name}: stress count actually rendered`);
        }
        if (strict && surface.startsWith('explore') && rows.length) assert.ok(Math.max(...rows.map(r => r.cardHeight)) - Math.min(...rows.map(r => r.cardHeight)) < 1, `${name}: equal card heights`);
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
      if (strict) {
        const headings = await page.locator('text=/^(LOCAL LIST|HOUSTON COURTS)$/').evaluateAll(els => els.map(el => ({text:el.textContent,x:el.getBoundingClientRect().x,font:getComputedStyle(el).fontSize,weight:getComputedStyle(el).fontFamily,tracking:getComputedStyle(el).letterSpacing})));
        assert.equal(headings.length,2,'both Explore section headings present');
        assert.deepEqual(Object.values(headings[0]).slice(1),Object.values(headings[1]).slice(1),'same section heading token and gutter');
        assert.equal(await page.getByTestId('court-default-marker').count(),1,'one default marker on its court');
        assert.equal(await page.getByText('Default',{exact:true}).count(),0,'no detached Default row');
      }
      if (variant === 'short' && width === 375 && process.env.EXPLORE_FLOW === '1') {
        const search = page.getByRole('textbox',{name:'Search courts',exact:true});
        await search.fill('Kasmiersky');
        await page.getByText('1 SEARCH RESULT',{exact:true}).waitFor();
        await capture('explore-search');
        const clear = page.getByRole('button',{name:'Clear search',exact:true});
        if (strict) { const box=await clear.boundingBox(); assert.ok(box.width>=44 && box.height>=44,'clear search has a real 44pt target'); }
        await search.fill('zzzzzzzz');
        await page.getByText('NO COURTS MATCH THIS SEARCH',{exact:true}).waitFor();
        await capture('explore-search-empty',true);
        await clear.click();
        await page.getByText('HOUSTON COURTS',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Filter courts by sport',exact:true}).click();
        await page.getByRole('menu').getByText('PB',{exact:true}).click();
        await page.getByTestId('court-dddddddd-dddd-4ddd-8ddd-dddddddddddd').waitFor();
        await capture('explore-pickleball');
        await page.getByRole('button',{name:'Filter courts by sport',exact:true}).click();
        await page.getByRole('menu').getByText('BB',{exact:true}).click();
        await page.getByTestId(`court-${COURT}`).waitFor();
        const other = tables.courts.find(c=>c.id!==COURT && c.sport_type==='basketball');
        await page.getByTestId(`court-${other.id}`).click();
        await page.getByRole('button',{name:`Open ${other.short_name}`,exact:true}).last().click();
        await page.waitForURL(`**/court/${other.id}`);
        await page.getByRole('button',{name:'Add to LocalList',exact:true}).click();
        await page.getByRole('button',{name:'Back',exact:true}).click();
        await page.getByTestId(`local-list-${other.id}`).waitFor();
        assert.equal(await page.getByTestId(`court-${other.id}`).count(),1,'saved court is not duplicated in discovery');
        if(strict) assert.equal(await page.getByTestId('court-default-marker').count(),1,'one default marker with two saved courts');
        await capture('explore-two-saved');
      }
      if (variant === 'short') {
        await page.getByTestId(`court-${COURT}`).click();
        await page.getByLabel('Kasmiersky Park, expand',{exact:true}).waitFor({state:'visible'});
        await page.waitForTimeout(900);
        const peekBox=await page.getByLabel('Kasmiersky Park, expand',{exact:true}).boundingBox();
        assert.ok(peekBox && peekBox.y>page.viewportSize().height*0.2,'peek remains open before expansion');
        await capture('drawer');
        await page.getByLabel('Kasmiersky Park, expand',{exact:true}).click();
        await page.waitForTimeout(900);
        const expandedBox=await page.getByLabel('Kasmiersky Park, expand',{exact:true}).boundingBox();
        assert.ok(expandedBox && expandedBox.y<page.viewportSize().height*0.2,'drawer reached expanded detent');
        await capture('drawer-expanded');
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
