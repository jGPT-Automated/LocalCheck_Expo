import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-11-17T18:00:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, ME, COURT } = await import('./fixtures.mjs');
const [baseArg = 'https://localcheck-app-preview-rg6xbtm7l-jgpt-automated.vercel.app', out = '/tmp/localcheck-court-header'] = process.argv.slice(2);
const base = baseArg.replace(/\/$/, '');
const now = Number(process.env.FAKE_NOW);
const qr = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const original = structuredClone(tables);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const all = [];
let totalWebsocketCloses = 0;

function setCounts(courtId, count) {
  for (const key of ['courts', 'courts_with_stats']) {
    const row = tables[key].find((c) => c.id === courtId);
    if (row) row.active_check_in_count = count;
  }
}
function selectedCourt(sport) {
  return sport === 'pickleball'
    ? tables.courts.find((c) => c.sport_type === 'pickleball')
    : tables.courts.find((c) => c.id === COURT);
}
async function measureTitle(page, title) {
  const name = page.getByText(title, { exact: true }).first();
  return name.evaluate((el) => {
    const rowById = el.closest('[data-testid="court-title-row"]');
    let row = rowById;
    if (!row) {
      row = el;
      while (row && !row.querySelector('[aria-label*="on court"]')) row = row.parentElement;
    }
    if (!row) throw new Error('CourtTitleRow ancestor not found');
    const rowBox = row.getBoundingClientRect();
    const live = row.querySelector('[data-testid="court-live-block"]') || row.querySelector('[aria-label*="on court"]');
    let titleBlock = row.querySelector('[data-testid="court-title-copy"]');
    if (!titleBlock) {
      titleBlock = el;
      while (titleBlock.parentElement && titleBlock.parentElement !== row) titleBlock = titleBlock.parentElement;
    }
    const textBox = el.getBoundingClientRect();
    const titleBox = titleBlock.getBoundingClientRect();
    const liveBox = live.getBoundingClientRect();
    const liveText = live.querySelector('[data-testid="court-live-value"]') || live.querySelector('[data-testid="court-live-art"]')?.nextElementSibling || live.firstElementChild;
    const valueBox = liveText.getBoundingClientRect();
    return {
      row: { x: rowBox.x, y: rowBox.y, width: rowBox.width, height: rowBox.height, centerY: rowBox.y + rowBox.height / 2 },
      title: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, lines: Math.max(1, Math.round(textBox.height / (parseFloat(getComputedStyle(el).lineHeight) || textBox.height))) },
      titleColumn: { x: titleBox.x, width: titleBox.width },
      liveColumn: { x: liveBox.x, width: liveBox.width, centerY: liveBox.y + liveBox.height / 2, centerDeltaY: liveBox.y + liveBox.height / 2 - (rowBox.y + rowBox.height / 2) },
      liveValue: { x: valueBox.x, width: valueBox.width, centerX: valueBox.x + valueBox.width / 2, centerY: valueBox.y + valueBox.height / 2 },
      accessibleLive: live.getAttribute('aria-label'),
    };
  });
}
async function open(page, route = '/') {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}
try {
  const selectedSizes = (process.env.SIZES || '375,393,430').split(',').map(Number);
  const viewportSizes = [[375, 667], [393, 852], [430, 932]].filter(([width]) => selectedSizes.includes(width));
  for (const [width, height] of viewportSizes) {
    for (const sport of ['basketball', 'pickleball']) {
      for (const key of Object.keys(original)) tables[key] = structuredClone(original[key]);
      const court = selectedCourt(sport);
      assert.ok(court, `fixture court exists: ${sport}`);
      if (process.env.COURT_QA_NAME) {
        for (const table of ['courts', 'courts_with_stats']) {
          const row = tables[table]?.find((item) => item.id === court.id);
          if (row) row.short_name = process.env.COURT_QA_NAME;
        }
      }
      const profile = tables.profiles.find((p) => p.id === ME);
      profile.local_court_id = court.id;
      profile.preferred_sport = sport;
      tables.check_ins = [];
      setCounts(court.id, 0);
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', reducedMotion: 'reduce' });
      let checkIns = 0;
      const http = { fulfilled: 0, aborted: 0 };
      let websocketCloses = 0;
      await context.clock.setFixedTime(new Date(now));
      await context.addInitScript((session) => localStorage.setItem('sb-qkrnmyexzvaxiqfxwwfb-auth-token', JSON.stringify(session)), SESSION);
      await context.routeWebSocket(/.*/, (socket) => { websocketCloses++; totalWebsocketCloses++; socket.close(); });
      await context.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();
        if (url.startsWith(base)) return route.continue();
        if (url.includes('cdn.jsdelivr.net/npm/jsqr')) {
          http.fulfilled++;
          return route.fulfill({ contentType: 'application/javascript', body: qr });
        }
        let response;
        if (url.includes('/rest/v1/rpc/check_in')) {
          const payload = req.postDataJSON();
          tables.check_ins.push({ id: `fixture-${checkIns + 1}`, user_id: ME, court_id: payload.p_court_id, checked_in_at: new Date(now).toISOString(), checked_out_at: null, source: 'manual', visibility: payload.p_visibility, note: payload.p_note ?? null });
          checkIns++;
          setCounts(court.id, 1);
          response = { status: 200, body: '{}' };
        } else if (url.includes('/rest/v1/')) response = handleRest(req.method(), url, req.headers());
        else if (url.includes('/auth/v1/')) response = handleAuth(url);
        else if (url.includes('/functions/v1/') || url.includes('/storage/v1/')) response = { status: 200, body: '{}' };
        else { http.aborted++; return route.abort(); }
        http.fulfilled++;
        return route.fulfill({ status: response.status, body: response.body, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...response.headers } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.setDefaultTimeout(10000);
      await open(page);
      await page.getByTestId('home-court-hero').waitFor();
      const titleText = court.short_name || court.name;
      const snapshots = {};
      const record = async (state) => {
        const m = await measureTitle(page, titleText);
        const alertCount = await page.getByRole('alert').count();
        await page.screenshot({ path: `${out}/${sport}-home-${width}-${state}.png` });
        snapshots[state] = { ...m, alertCount };
      };

      // Four-digit stress count forces the live column to its widest relevant state.
      if (process.env.HOME_PAIR_ONLY !== '1') {
      setCounts(court.id, 1000);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId('home-court-hero').waitFor();
      await page.getByTestId('court-live-block').getByText(/1000/).waitFor().catch(async () => {
        const live = page.getByLabel(/1000 on court/);
        await live.waitFor();
      });
      await record('count-1000');
      if (process.env.STRESS_ONLY === '1') {
        const m = snapshots['count-1000'];
        const valueRight = m.liveValue.x + m.liveValue.width;
        const columnRight = m.liveColumn.x + m.liveColumn.width;
        assert.ok(m.liveValue.x >= m.liveColumn.x - 0.5 && valueRight <= columnRight + 0.5, `${sport} ${width}: four-digit live value stays within column`);
      }
      }
      if (process.env.STRESS_ONLY === '1' && width !== 393) {
        all.push({ width, height, sport, court: titleText, checkIns, http, websocketCloses, pageErrors: errors, snapshots });
        await context.close();
        continue;
      }

      setCounts(court.id, 0);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId('home-court-hero').waitFor();
      await page.getByTestId('court-live-block').waitFor().catch(() => {});
      await record('count-0');
      await page.getByTestId('check-in-btn').click();
      await page.getByTestId('home-session-status').waitFor();
      await page.waitForTimeout(450); // let check-in state settle before measuring/capturing
      await page.waitForFunction(() => document.querySelector('[data-testid="court-live-block"]')?.textContent?.includes('1') || [...document.querySelectorAll('[aria-label]')].some(e => /1 on court/.test(e.getAttribute('aria-label') || '')));
      await record('count-1');
      assert.equal(checkIns, 1, `${sport} ${width}: exactly one fixture check-in`);
      if (process.env.EXPECT_NO_TOAST === '1') assert.equal(snapshots['count-1'].alertCount, 0, `${sport} ${width}: no drop-down toast alert`);
      assert.deepEqual(errors, [], `${sport} ${width}: no page errors`);
      all.push({ width, height, sport, court: titleText, snapshots, checkIns, http, websocketCloses, pageErrors: errors });

      // Shared title-row consumers at a representative width: Explore card, drawer, court page.
      if (width === 393 && process.env.STRESS_ONLY !== '1') {
        await open(page, '/explore');
        await page.getByTestId(`court-${court.id}`).waitFor();
        await page.screenshot({ path: `${out}/${sport}-explore-393.png` });
        const cardName = page.getByText(titleText, { exact: true }).first();
        const cardMeasure = await measureTitle(page, titleText);
        await page.getByTestId(`court-${court.id}`).click();
        await page.waitForTimeout(500);
        const drawerMeasure = await measureTitle(page, titleText);
        await page.screenshot({ path: `${out}/${sport}-drawer-393.png` });
        await open(page, `/court/${court.id}`);
        const courtPageMeasure = await measureTitle(page, titleText);
        await page.screenshot({ path: `${out}/${sport}-court-393.png` });
        snapshots.sharedTitleConsumers = { exploreCard: cardMeasure, drawer: drawerMeasure, courtPage: courtPageMeasure };
        if (process.env.EXPECT_CENTERED_TITLE === '1') {
          for (const [surface, m] of Object.entries(snapshots.sharedTitleConsumers)) assert.ok(Math.abs(m.liveColumn.centerDeltaY) <= 1.5, `${sport} ${surface}: live column vertically centered`);
        }
      }
      if (process.env.EXPECT_CENTERED_TITLE === '1' && process.env.HOME_PAIR_ONLY !== '1' && process.env.STRESS_ONLY !== '1') {
        assert.ok(Math.abs(snapshots['count-1000'].liveColumn.centerDeltaY) <= 1.5, `${sport} ${width}: stress live column centered`);
        assert.ok(Math.abs(snapshots['count-0'].titleColumn.width - snapshots['count-1'].titleColumn.width) <= 1, `${sport} ${width}: title column width stable from zero to one`);
      }
      await context.close();
    }
  }
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ preview: base, viewportSet: [[375, 667], [393, 852], [430, 932]], isolation: { allSupabaseHttpFulfilledOrAborted: true, checkInFulfilledFromInMemoryFixture: true, websocketCloses: totalWebsocketCloses }, results: all }, null, 2));
  console.log(JSON.stringify(all.map(({ snapshots, ...row }) => ({ ...row, snapshots: Object.fromEntries(Object.entries(snapshots).map(([key, v]) => [key, { alertCount: v.alertCount, titleWidth: v.titleColumn?.width, titleHeight: v.title?.height, titleLines: v.title?.lines, liveCenterDeltaY: v.liveColumn?.centerDeltaY, liveValue: v.accessibleLive }])) })), null, 2));
} finally {
  await browser.close();
}
