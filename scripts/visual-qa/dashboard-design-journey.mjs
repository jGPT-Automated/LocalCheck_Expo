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
const [base = 'http://127.0.0.1:8095', out = '/tmp/dashboard-proof'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const qrScript = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const original = JSON.parse(JSON.stringify(tables));
const pickleball = process.env.DASHBOARD_SPORT === 'pickleball';
const report = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const audit = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
try {
for (const [width, height] of [[375, 667], [393, 852], [430, 932]]) {
  for (const key of Object.keys(tables)) tables[key] = structuredClone(original[key]);
  if (process.env.DASHBOARD_SIZES && !process.env.DASHBOARD_SIZES.split(",").includes(`${width}x${height}`)) continue;
  // Opt-in fixture: exercise a real four-player scheduled game at the existing
  // Candy Cane court without changing the basketball fixtures or product state.
  const selectedCourt = pickleball ? tables.courts.find((c) => c.short_name === 'Candy Cane')?.id : COURT;
  assert.ok(selectedCourt, 'Selected fixture court exists');
  if (pickleball) {
    const viewer = tables.profiles.find((p) => p.id === ME);
    const source = tables.runs.find((r) => r.court_id === COURT && r.max_players === 10 && r.start_time === '2026-10-18T01:00:00.000Z');
    assert.ok(viewer && source, 'Viewer and 8 PM source game exist');
    viewer.local_court_id = selectedCourt;
    viewer.preferred_sport = 'pickleball';
    // Move existing live check-ins so each fixture player is present at one
    // court only. The mock has check_ins; it has no court_sessions table.
    const present = tables.check_ins.filter((row) => row.court_id === COURT && !row.checked_out_at).slice(0, 3);
    assert.equal(present.length, 3);
    for (const row of present) {
      row.court_id = selectedCourt;
      const player = tables.profiles.find((p) => p.id === row.user_id);
      assert.ok(player);
      player.local_court_id = selectedCourt;
      player.preferred_sport = 'pickleball';
    }
    for (const table of [tables.courts, tables.courts_with_stats]) {
      table.find((court) => court.id === selectedCourt).active_check_in_count = 3;
      table.find((court) => court.id === COURT).active_check_in_count = 1;
    }
    const id = 'dddddddd-5555-4555-8555-555555555555';
    tables.runs.push({ ...structuredClone(source), id, court_id: selectedCourt, title: 'Pickleball game', max_players: 4 });
    const players = tables.run_participants.filter((p) => p.run_id === source.id).slice(0, 2);
    assert.equal(players.length, 2);
    players.forEach((p, i) => tables.run_participants.push({ ...structuredClone(p), id: `${id}-p${i}`, run_id: id }));
  }
  tables.planned_visits.push({ id: 'private-fixture', user_id: 'private-player', court_id: COURT, planned_at: '2026-10-19T01:00:00.000Z', visibility: 'private' });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', reducedMotion: 'reduce' });
  await context.routeWebSocket(/.*/, (ws) => ws.close());
  await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
  await context.addInitScript((session) => {
    for (const id of ['qkrnmyexzvaxiqfxwwfb', 'ci-placeholder']) localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session));
  }, SESSION);
  let failSave = false, failLoad = false, writes = 0;
  let holdLoad = false, releaseLoad;
  const loadGate = new Promise(resolve => { releaseLoad = resolve; });
  const errors = [];
  const checks = [];
  const check = async (name, fn) => { try { const evidence=await fn(); checks.push({name, passed:true,...(evidence?{evidence}:{})}); console.log(`PASS ${width} ${name}`); } catch(e) { checks.push({name, passed:false, error:String(e.message).slice(0,450)}); console.log(`FAIL ${width} ${name}: ${String(e.message).slice(0,250)}`); } };
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
      if (holdLoad) await loadGate;
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
  const open = async (path) => { await page.goto(base + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(2600); if(path==='/') await page.getByTestId('court-day-planner').waitFor({timeout:15000}); };
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}-${width}.png` }); };
  const revealRoster = async (locator) => locator.evaluate(e => {
    const b=e.getBoundingClientRect(); let parent=e.parentElement;
    while(parent && !(parent.scrollHeight>parent.clientHeight+10 && parent.clientHeight>100))parent=parent.parentElement;
    if(parent)parent.scrollTop += Math.max(0,b.bottom-(innerHeight-96));
  });
  const scrub = async (hour, drag = false) => {
    const b = await page.getByTestId('court-time-chart').boundingBox();
    const x = b.x + (hour - 6 + .5) / 17 * b.width, y = b.y + 20;
    if (drag) { await page.mouse.move(b.x + b.width * .5, y); await page.mouse.down(); await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up(); }
    else await page.mouse.click(x, y);
    await page.waitForTimeout(450);
  };
  const checkHierarchy = async () => {
    const planner = page.getByTestId('court-day-planner');
    const heading = planner.getByTestId('court-day-heading');
    const selected = planner.getByTestId('selected-court-hour');
    await check('Selected hour has one time/count header above chart and people', async () => {
      assert.equal(await planner.getByText('8 PM', {exact:true}).count(), 1);
      assert.doesNotMatch(await selected.innerText(), /planning to go|8 PM/);
      const summary = await heading.innerText();
      assert.match(summary, /8 PM/); assert.match(summary, /\d+ going/);
      const measurements = await heading.evaluate(e => [...e.querySelectorAll('div')].filter(n => n.childElementCount === 0 && n.innerText.trim()).map(n => ({text:n.innerText,size:Number.parseFloat(getComputedStyle(n).fontSize)})));
      const hour = measurements.find(m => m.text === '8 PM');
      assert.ok(hour && hour.size >= 20, 'Selected hour has display emphasis');
      assert.ok(measurements.every(m => m.size >= 11), 'No new sub-11pt heading');
      const chart = await planner.getByTestId('court-time-chart').boundingBox();
      const people = await selected.boundingBox();
      assert.ok((await heading.boundingBox()).y < chart.y && chart.y < people.y);
    });
  };
  await open('/');
  await shot('home-header');
  if (process.env.DASHBOARD_HEADER_ONLY === '1') {
    report.push({width, sport: pickleball ? 'pickleball' : 'basketball', checks, writes, errors});
    await context.close();
    continue;
  }
  await check('Home court navigation is beside the live count, above Check in', async () => {
    const court = tables.courts.find(c => c.id === selectedCourt);
    const link = page.getByRole('button', {name:`Open ${court.short_name || court.name}`,exact:true});
    assert.equal(await link.count(), 1);
    const linkBox = await link.boundingBox();
    const checkIn = await page.getByRole('button', {name:new RegExp('^Check in to ')}).boundingBox();
    assert.ok(linkBox.width >= 44 && linkBox.height >= 44);
    assert.ok(linkBox.y + linkBox.height <= checkIn.y, 'Link is in hero, not the action row');
    const parts = await link.evaluate(e => {const c=e.firstElementChild;return [...c.children].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,right:b.right,width:b.width};});});
    assert.ok(parts.length >= 2 && parts[1].x-parts[0].right <= 6, 'Chevron is close to live value');
    const name = page.getByText(court.short_name || court.name, {exact:true}).first();
    assert.ok(await name.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Court name is not ellipsized');
    await link.click(); await page.waitForURL(`**/court/${selectedCourt}`);
  });
  await open('/');
  await check('Court-name menu shows only the actual saved court and dismisses', async () => {
    await page.getByRole('button',{name:'Current home court',exact:true}).click();
    const menu=page.getByRole('menu'); await menu.waitFor();
    assert.equal(await menu.getByRole('menuitem').count(),1);
    await shot('home-court-menu'); await menu.getByRole('menuitem').click();
    await menu.waitFor({state:'hidden'});
  });
  if (pickleball) {
    const assertGame = async (container) => {
      assert.match(await container.innerText(), /2\/4/);
      assert.equal(await container.getByRole('button', {name:'Open PICKLEBALL GAME', exact:true}).count(), 1);
    };
    await page.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 200) e.scrollTop = e.scrollHeight; });
    await scrub(20); await shot('pickleball-home-selected'); await checkHierarchy();
    await check('Pickleball Home selected hour shows the 2/4 scheduled game', async () => {
      await assertGame(page.getByTestId('selected-court-hour'));
    });
    await page.getByTestId('selected-court-hour').getByRole('button',{name:'Expand PICKLEBALL GAME',exact:true}).click();
    await revealRoster(page.getByTestId('game-roster-dddddddd-5555-4555-8555-555555555555'));
    await shot('pickleball-home-roster');
    await check('Pickleball roster has four positions with supplied green open spots', async()=>{
      const roster=page.getByTestId('game-roster-dddddddd-5555-4555-8555-555555555555');
      assert.equal(await roster.getByRole('button').count(),4);
      const spot=roster.getByTestId('game-open-spot');assert.equal(await spot.count(),2);
      assert.equal(await spot.first().evaluate(e=>getComputedStyle(e.firstElementChild).borderColor),'rgb(63, 195, 151)');
    });
    await open('/explore'); await page.getByTestId(`court-${selectedCourt}`).click();
    await page.waitForTimeout(1600); await page.getByLabel(/, expand$/).click();
    await page.waitForTimeout(1500); await scrub(20); await shot('pickleball-drawer-selected'); await checkHierarchy();
    await check('Pickleball drawer selected hour shows the 2/4 scheduled game', async () => {
      await assertGame(page.getByTestId('selected-court-hour'));
    });
    await open(`/court/${selectedCourt}`); await scrub(20); await shot('pickleball-court-selected');
    await check('Pickleball court selected hour shows the 2/4 scheduled game', async () => {
      await assertGame(page.getByTestId('activity-hour-20'));
    });
    const visual = await page.evaluate(`(${audit})()`);
    assert.deepEqual(errors, []); assert.deepEqual(visual.fail, []);
    report.push({width, sport: 'pickleball', checks, writes, errors, visual});
    await context.close();
    continue;
  }
  await page.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight + 50 && e.clientHeight > 200) e.scrollTop = e.scrollHeight; });
  await scrub(20);
  await shot('home-selected');
  await checkHierarchy();
  const selectedSlot = page.getByTestId('selected-court-hour');
  await check('Home selected hour is boxed with square attendee profiles', async () => {
    assert.equal(await page.getByTestId('court-day-planner').count(), 1, 'Chart and slot share a panel');
    await selectedSlot.getByRole('button', {name:'Player2', exact:true}).waitFor({timeout:1200});
  });
  await check('Home planner comes before next game and clears tab floor', async () => {
    const chart = await page.getByTestId('court-time-chart').boundingBox();
    const next = await page.getByText('Up next', {exact:true}).boundingBox();
    const slot = await selectedSlot.boundingBox();
    assert.ok(chart.y < next.y, 'Next game follows the planner');
    assert.ok(slot.y + slot.height <= height - 88, 'Selected card clears tab floor');
  });
  await check('Selected dashboard hour retains its scheduled game and RSVP', async () => {
    assert.equal(await selectedSlot.getByRole('button', {name:'Expand CHATGPT', exact:true}).count(), 1);
    assert.equal(await selectedSlot.getByRole('button', {name:'Open CHATGPT', exact:true}).count(), 1);
    assert.equal(await selectedSlot.getByRole('button', {name:"I'm going", exact:true}).count(), 1, 'Attendance remains on the people row, independent of RSVP');
  });
  const filledHeight=(await selectedSlot.boundingBox()).height;
  await selectedSlot.getByRole('button',{name:'Expand CHATGPT',exact:true}).click();
  await revealRoster(selectedSlot.getByTestId('game-roster-e5e5e5e5-5555-4555-8555-555555555555'));
  await shot('home-roster');
  await check('Basketball roster has ten actual occupied/open positions and collapses',async()=>{
    const roster=selectedSlot.getByTestId('game-roster-e5e5e5e5-5555-4555-8555-555555555555');
    assert.equal(await roster.getByTestId('game-open-spot').count(),3);
    assert.equal(await roster.getByRole('button').count(),10);
    await selectedSlot.getByRole('button',{name:'Collapse CHATGPT',exact:true}).click();
    assert.equal((await selectedSlot.boundingBox()).height,filledHeight);
  });
  await scrub(19); await shot('home-intent');
  await check('Empty and populated hour cards keep the same height and action size',async()=>{
    assert.ok(Math.abs((await selectedSlot.boundingBox()).height-filledHeight)<=1);
    const create=selectedSlot.getByRole('button',{name:'Create a game',exact:true});
    const plus=selectedSlot.getByRole('button',{name:"I'm going",exact:true});
    for(const button of [create,plus]) {
      const sizes=await button.evaluate(e=>({touch:e.getBoundingClientRect().height,visual:e.firstElementChild.getBoundingClientRect().height}));
      assert.equal(sizes.visual,34);assert.ok(sizes.touch>=44);
    }
  });
  await check('Home attendance is a compact plus control', async () => {
    const button = selectedSlot.getByRole('button', {name:"I'm going", exact:true});
    assert.doesNotMatch(await button.innerText(), /Going/i);
    const box = await button.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44 && box.width <= 52);
    const mark = await button.evaluate(e => {const b=e.firstElementChild.getBoundingClientRect();return {width:b.width,height:b.height};});
    assert.equal(mark.width,34); assert.equal(mark.height,34);
  });
  await scrub(19);
  const action = () => page.getByTestId('selected-court-hour').getByRole('button', {name:"I'm going", exact:true});
  failSave = true; await action().click();
  await page.getByTestId('selected-court-hour').getByText('Could not save your time. Try again.').waitFor();
  await shot('home-save-error');
  failSave = false; await action().click();
  await page.getByTestId('selected-court-hour').getByRole('button', {name:"I'm not coming", exact:true}).waitFor();
  await shot('home-planned');
  await check('Confirmed attendance can be removed with same control', async () => {
    const button=page.getByTestId('selected-court-hour').getByRole('button', {name:"I'm not coming", exact:true});
    await button.click(); await action().waitFor();
  });
  await open('/explore'); await page.getByTestId(`court-${COURT}`).click();
  await page.waitForTimeout(1600); await shot('drawer-collapsed');
  await page.getByLabel(/, expand$/).click(); await page.waitForTimeout(1500);
  await page.getByRole('button', {name:'Next day', exact:true}).click(); await scrub(20);
  await shot('drawer-selected');
  await check('Drawer reuses boxed planner, square profiles and compact plus', async () => {
    assert.equal(await page.getByTestId('court-day-planner').count(),1);
    const slot=page.getByTestId('selected-court-hour'); const b=await slot.boundingBox();
    assert.ok(b.y>=0 && b.y+b.height<=height, 'Selected row stays in the drawer');
    assert.doesNotMatch(await slot.getByRole('button',{name:"I'm going",exact:true}).innerText(),/Going/i);
    const chart=await page.getByTestId('court-time-chart').boundingBox();
    const next=await page.getByText('Up next',{exact:true}).boundingBox(); assert.ok(chart.y<next.y);
    await slot.getByText('1 private',{exact:true}).waitFor();
  });
  await page.getByRole('button',{name:'Previous day',exact:true}).click(); await scrub(20);
  await check('Drawer selected game dismisses sheet before opening run',async()=>{
    await page.getByTestId('selected-court-hour').getByRole('button',{name:'Open CHATGPT',exact:true}).click();
    await page.waitForURL('**/run/e5e5e5e5-5555-4555-8555-555555555555');
    await page.getByLabel(/, expand$/).waitFor({state:'hidden',timeout:1500});
  });
  await open('/explore'); await page.getByTestId(`court-${COURT}`).click();
  await page.getByLabel(/, expand$/).click(); await page.waitForTimeout(900); await scrub(20);
  await check('Drawer selected player dismisses sheet before opening profile',async()=>{
    await page.getByTestId('selected-court-hour').getByRole('button',{name:'Player2',exact:true}).click();
    await page.waitForURL('**/player/22222222-2222-4222-8222-222222222222');
    await page.getByLabel(/, expand$/).waitFor({state:'hidden',timeout:1500});
  });
  await open(`/court/${COURT}`); await scrub(20);
  await shot('court-future');
  await check('Court future hour shows square stack and inline game action',async()=>{
    const row=page.getByTestId('activity-hour-20');
    assert.equal(await row.getByTestId('slot-attendee-stack').count(),1);
    assert.equal(await row.getByRole('button',{name:"Open CHATGPT",exact:true}).count(),1);
  });
  await page.getByRole('button',{name:'Next day',exact:true}).click(); await scrub(20);
  await check('Private-only court attendance has a spoken private count',async()=>{
    const privateText=page.getByTestId('activity-hour-20').getByText('1 private',{exact:true});
    assert.match(await privateText.getAttribute('aria-label') ?? '', /1 private/);
  });
  await open('/schedule');
  await page.getByTestId('heat-0-16').click(); await page.waitForTimeout(750);
  const scheduleCard=page.getByTestId('court-hour-card');
  const populatedHeight=(await scheduleCard.boundingBox()).height;
  await shot('schedule-filled');
  await page.getByTestId('heat-0-15').click(); await page.waitForTimeout(750);
  await shot('schedule-empty');
  await check('Schedule empty and game hours reserve equal card heights and same-height actions',async()=>{
    assert.ok(Math.abs((await scheduleCard.boundingBox()).height-populatedHeight)<=1);
    for(const label of ['Create a game',"I'm going"]) {
      const button=scheduleCard.getByRole('button',{name:label,exact:true});
      const b=await button.evaluate(e=>({touch:e.getBoundingClientRect().height,visual:e.firstElementChild.getBoundingClientRect().height}));
      assert.equal(b.visual,34);assert.ok(b.touch>=44);
    }
  });
  const gridScroll=page.getByTestId('schedule-heat-scroll');
  await gridScroll.evaluate(e=>{e.scrollTop=e.scrollHeight;}); await page.waitForTimeout(450);
  await check('Schedule retains readable cells and the last 11 PM hour is reachable after snapping',async()=>{
    const last=await page.getByTestId('heat-0-19').boundingBox();
    const grid=await gridScroll.boundingBox();
    assert.ok(last.height>=44,'Heatmap cell keeps minimum height');
    assert.ok(last.y>=grid.y-1 && last.y+last.height<=grid.y+grid.height+1,'Last hour stays in grid viewport');
    return {cellHeight:last.height,viewportHeight:grid.height};
  });
  if(width===393) {
    holdLoad=true;
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.getByTestId('court-time-chart').waitFor();
    await page.evaluate(()=>{for(const e of document.querySelectorAll('*'))if(e.scrollHeight>e.clientHeight+50&&e.clientHeight>200)e.scrollTop=e.scrollHeight;});
    await scrub(20);
    releaseLoad();holdLoad=false;
    const cold=page.getByTestId('selected-court-hour');
    await cold.getByRole('button',{name:'Open CHATGPT',exact:true}).waitFor();
    await page.waitForTimeout(350);
    await check('A selection made before activity loads reveals the ready controls above tab floor',async()=>{
      const b=await cold.boundingBox();assert.ok(b.y+b.height<=height-88);
    });
    await shot('home-cold-ready');
  }
  const visual=await page.evaluate(`(${audit})()`);
  assert.deepEqual(errors,[]); assert.deepEqual(visual.fail,[]);
  report.push({width,checks,writes,errors,visual}); await context.close();
}
} finally {
  await browser.close(); writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));
}
if(report.some(r=>r.checks.some(c=>!c.passed))) process.exitCode=1;
