// Isolated rendered acceptance for scheduled-game RSVP in court-hour rows.
// All backend HTTP is fulfilled/aborted and every WebSocket is closed before
// navigation. Successful join writes mutate only the in-memory run fixture.
// node scripts/visual-qa/dashboard-rsvp-journey.mjs [preview URL] [evidence dir]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

process.env.FAKE_NOW = String(Date.parse('2026-10-17T23:30:00Z'));
process.env.TZ = 'America/Chicago';

const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT, ME, RUN3V3, RUN5V5 } = await import('./fixtures.mjs');
const [base = 'http://127.0.0.1:8099', out = '/tmp/dashboard-rsvp'] = process.argv.slice(2);
const baseOrigin = new URL(base).origin;
mkdirSync(out, { recursive: true });

// Mirror the existing isolated journey: the app's worker request is fulfilled
// locally by the browser route below, so it cannot make a network request.
const qrScript = execFileSync('curl', ['-fsSL', 'https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const initialTables = structuredClone(tables);
const audit = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
const longFirstAttendee = 'Alexandria McAllisterOne';
assert.equal(longFirstAttendee.length, 24);
const FULL_RUN = 'f0550000-5555-4555-8555-555555555555';
const FULL_USERS = [
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
];

function restoreTables() {
  for (const key of Object.keys(tables)) tables[key] = structuredClone(initialTables[key]);
}

function profile(id) {
  const value = tables.profiles.find((row) => row.id === id);
  assert.ok(value, `fixture profile ${id} exists`);
  return value;
}

function participantIds(runId) {
  return tables.run_participants.filter((row) => row.run_id === runId && row.status === 'going').map((row) => row.user_id);
}

function removeMeFromRun(runId) {
  tables.run_participants = tables.run_participants.filter((row) => !(row.run_id === runId && row.user_id === ME));
}

function prepareTimelineFixtures({ secondGame = false, fullGame = false, longName = false } = {}) {
  restoreTables();
  removeMeFromRun(RUN5V5);
  if (longName) {
    const firstPlannedAttendee = tables.planned_visits.find((row) => row.court_id === COURT && row.planned_at === '2026-10-18T01:00:00.000Z');
    assert.ok(firstPlannedAttendee, 'the 8 PM fixture has a first planned attendee');
    Object.assign(profile(firstPlannedAttendee.user_id), {
      display_name: longFirstAttendee,
      username: longFirstAttendee,
    });
  }
  if (secondGame) {
    const game = tables.runs.find((row) => row.id === RUN3V3);
    assert.ok(game, 'RUN3V3 fixture exists');
    Object.assign(game, {
      title: 'Choose Teams',
      start_time: '2026-10-18T01:00:00.000Z',
      team_assignment_mode: 'choose_teams',
    });
    removeMeFromRun(RUN3V3);
  }
  if (fullGame) {
    const source = tables.runs.find((row) => row.id === RUN5V5);
    assert.ok(source, 'RUN5V5 fixture exists');
    tables.runs.push({
      ...structuredClone(source),
      id: FULL_RUN,
      title: 'Full game',
      max_players: 4,
      team_assignment_mode: 'elo_balance',
      organizer_id: FULL_USERS[0],
    });
    FULL_USERS.forEach((userId, index) => {
      tables.run_participants.push({
        id: `${FULL_RUN}-p${index}`,
        run_id: FULL_RUN,
        user_id: userId,
        status: 'going',
        team_side: index % 2 === 0 ? 'a' : 'b',
        joined_at: '2026-10-17T23:00:00.000Z',
      });
    });
  }
}

const requestedSizes = process.env.RSVP_SIZES
  ? new Set(process.env.RSVP_SIZES.split(',').map((item) => item.trim()))
  : null;
const allSizes = [[375, 667], [393, 852], [430, 932]];
const results = [];
const failures = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});

try {
  for (const [width, height] of allSizes) {
    if (requestedSizes && !requestedSizes.has(`${width}x${height}`)) continue;
    restoreTables();
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      timezoneId: 'America/Chicago',
      reducedMotion: 'reduce',
    });
    const webSockets = [];
    await context.routeWebSocket(/.*/, (socket) => {
      webSockets.push('closed');
      socket.close();
    });
    await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
    await context.addInitScript((session) => {
      for (const id of ['qkrnmyexzvaxiqfxwwfb', 'ci-placeholder']) {
        localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session));
      }
    }, SESSION);

    const joinCalls = [];
    const remoteHttp = [];
    const unexpectedWrites = [];
    let failNextJoin = false;
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url();
      if (url.startsWith(baseOrigin)) return route.continue();
      if (url.includes('cdn.jsdelivr.net/npm/jsqr')) {
        remoteHttp.push({ method: request.method(), url, disposition: 'fulfilled-jsqr' });
        return route.fulfill({ contentType: 'application/javascript', body: qrScript });
      }

      let response;
      if (url.includes('/rest/v1/rpc/join_scheduled_game')) {
        const params = request.postDataJSON();
        const call = { runId: params.p_run_id, teamSide: params.p_team_side ?? null };
        joinCalls.push(call);
        if (failNextJoin) {
          failNextJoin = false;
          call.outcome = 'fixture failure';
          response = {
            status: 503,
            body: JSON.stringify({ code: 'FIXTURE_FAILURE', message: 'Fixture join unavailable' }),
          };
        } else {
          const alreadyGoing = tables.run_participants.some((row) => row.run_id === params.p_run_id && row.user_id === ME && row.status === 'going');
          if (!alreadyGoing) {
            tables.run_participants.push({
              id: `${params.p_run_id}-fixture-me`,
              run_id: params.p_run_id,
              user_id: ME,
              status: 'going',
              team_side: params.p_team_side ?? null,
              joined_at: new Date(Number(process.env.FAKE_NOW)).toISOString(),
            });
          }
          call.outcome = 'fixture success';
          response = { status: 200, body: 'null' };
        }
      } else if (url.includes('/rest/v1/')) {
        if (!['GET', 'HEAD'].includes(request.method()) && !url.includes('/rpc/')) {
          unexpectedWrites.push({ method: request.method(), url });
        }
        response = handleRest(request.method(), url, request.headers());
      } else if (url.includes('/auth/v1/')) {
        response = handleAuth(url);
      } else if (url.includes('/functions/v1/') || url.includes('/storage/v1/')) {
        response = { status: 200, body: '{}' };
      } else {
        remoteHttp.push({ method: request.method(), url, disposition: 'aborted' });
        return route.abort();
      }
      remoteHttp.push({ method: request.method(), url, disposition: `fulfilled-${response.status}` });
      return route.fulfill({
        status: response.status,
        body: response.body,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-range',
          ...response.headers,
        },
      });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    const errors = [];
    const checks = [];
    const captures = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const open = async (path) => {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
    };
    const openCourtAtEight = async (fixtureOptions = {}) => {
      prepareTimelineFixtures(fixtureOptions);
      joinCalls.length = 0;
      failNextJoin = false;
      await open(`/court/${COURT}`);
      const chart = page.getByTestId('court-time-chart');
      await chart.waitFor();
      const box = await chart.boundingBox();
      assert.ok(box, 'chart has a rendered box');
      // Use the same chart coordinate mapping as court-activity-journey.mjs.
      const x = box.x + (20 - 6 + 0.5) / 17 * box.width;
      await page.mouse.click(x, box.y + 20);
      await page.waitForTimeout(400);
      assert.match(await chart.getAttribute('aria-label'), /8P/);
      await page.getByTestId('activity-hour-20').waitFor();
    };
    const capture = async (name) => {
      const path = `${out}/${name}-${width}.png`;
      await page.screenshot({ path });
      const visual = await page.evaluate(`(${audit})()`);
      captures.push({ name, path, audit: visual });
      assert.deepEqual(visual.fail, [], `${name}: hard clipping, overlap, or sideways scroll`);
      return visual;
    };
    const check = async (name, run) => {
      if(process.env.RSVP_CASE && !name.toLowerCase().includes(process.env.RSVP_CASE.toLowerCase())) return;
      try {
        const evidence = await run();
        checks.push({ name, passed: true, evidence });
        console.log(`PASS ${width} ${name}`);
      } catch (error) {
        const message = String(error.message).split('\n').slice(0, 5).join(' ');
        checks.push({ name, passed: false, error: message });
        failures.push(`${width} ${name}: ${message}`);
        console.log(`FAIL ${width} ${name}: ${message}`);
      }
    };

    await check('8 PM RUN5V5 join fails without changing fixture, retry succeeds once', async () => {
      await openCourtAtEight();
      const row = page.getByTestId('activity-hour-20');
      const join = row.getByRole('button', { name: 'Join CHATGPT', exact: true });
      await capture('join-before');
      const before = structuredClone(tables);
      await row.getByRole('button',{name:'Expand CHATGPT',exact:true}).click();
      const spot=row.getByTestId('game-open-spot').first();
      failNextJoin = true;
      await spot.click();
      await row.getByText('Something went wrong. Try again.', { exact: true }).waitFor();
      assert.equal(joinCalls.length, 1, 'failed click called join_scheduled_game once');
      assert.equal(joinCalls[0].runId, RUN5V5);
      assert.equal(participantIds(RUN5V5).includes(ME), false, 'failed fixture did not add ME');
      for (const key of Object.keys(tables)) {
        assert.deepEqual(tables[key], before[key], `failed join leaves fixture table ${key} unchanged`);
      }
      await capture('join-error');
      await spot.click();
      await row.getByRole('button', { name: 'Open CHATGPT', exact: true }).waitFor();
      assert.equal(joinCalls.length, 2, 'one failed call and one retry');
      assert.deepEqual(joinCalls.map((call) => call.outcome), ['fixture failure', 'fixture success']);
      assert.equal(joinCalls.filter((call) => call.outcome === 'fixture success').length, 1);
      assert.equal(participantIds(RUN5V5).filter((id) => id === ME).length, 1);
      for (const key of Object.keys(tables)) {
        if (key !== 'run_participants') assert.deepEqual(tables[key], before[key], `success changes only run_participants; ${key} unchanged`);
      }
      await capture('join-success');
      return { rpcCalls: joinCalls, participantIds: participantIds(RUN5V5) };
    });

    await check('full 4/4 game shows a disabled Game full action', async () => {
      await openCourtAtEight({ fullGame: true });
      const row = page.getByTestId('activity-hour-20');
      await row.getByText('FULL GAME', { exact: true }).waitFor();
      const full = row.getByRole('button', { name: 'Game full', exact: true });
      await full.waitFor();
      assert.equal(await full.isDisabled(), true);
      assert.equal(joinCalls.length, 0, 'rendering a full game made no join RPC');
      await capture('game-full');
      return { runId: FULL_RUN, going: participantIds(FULL_RUN).length, maxPlayers: 4, disabled: await full.isDisabled() };
    });

    await check('choose-teams Join opens the run for side selection without an RPC', async () => {
      await openCourtAtEight({ secondGame: true });
      const row = page.getByTestId('activity-hour-20');
      const choose = row.getByRole('button', { name: 'Join CHOOSE TEAMS', exact: true });
      await choose.waitFor();
      await capture('choose-teams-inline');
      await choose.click();
      await page.waitForURL(`**/run/${RUN3V3}`);
      await page.getByTestId('join-run-a').waitFor();
      await page.getByTestId('join-run-b').waitFor();
      assert.equal(joinCalls.length, 0, 'timeline tap leaves team choice and RPC to the run page');
      await capture('choose-teams-run-page');
      return { url: page.url(), sideButtons: ['join-run-a', 'join-run-b'], rpcCalls: joinCalls.length };
    });

    await check('two 8 PM games and a 24-character first attendee render without hard clipping', async () => {
      await openCourtAtEight({ secondGame: true, longName: true });
      const row = page.getByTestId('activity-hour-20');
      await row.getByRole('button', { name: 'Join CHATGPT', exact: true }).waitFor();
      await row.getByRole('button', { name: 'Join CHOOSE TEAMS', exact: true }).waitFor();
      await row.getByText(new RegExp(longFirstAttendee.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).waitFor();
      await row.getByRole('button',{name:'Expand CHATGPT',exact:true}).click();
      const visual = await capture('two-games-long-attendee');
      assert.equal(joinCalls.length, 0, 'rendering game cards made no join RPC');
      const actualText = await row.innerText();
      assert.ok(actualText.indexOf(longFirstAttendee) >= 0, 'long first attendee name is visible in full text');
      return { gamesAt8PM: [RUN5V5, RUN3V3], firstAttendee: longFirstAttendee, audit: visual };
    });

    await check('Schedule vacant spot uses the confirmed RSVP and turns into Open', async()=>{
      prepareTimelineFixtures(); joinCalls.length=0; failNextJoin=false;
      await open('/schedule'); await page.getByTestId('heat-0-16').click();
      const slot=page.getByTestId('court-hour-card');
      await slot.getByRole('button',{name:'Expand CHATGPT',exact:true}).click();
      await slot.getByTestId('game-open-spot').first().click();
      await slot.getByRole('button',{name:'Open CHATGPT',exact:true}).waitFor();
      assert.equal(joinCalls.length,1);assert.ok(participantIds(RUN5V5).includes(ME));
      assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[]);
      await capture('schedule-spot-joined');
      return {rpcCalls:joinCalls,member:ME};
    });

    await check('remote requests are isolated, fixture-only writes and page errors are absent', async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpectedWrites, [], 'no REST table writes outside successful join fixture response');
      assert.ok(remoteHttp.every((entry) => entry.disposition.startsWith('fulfilled') || entry.disposition === 'aborted'));
      assert.ok(webSockets.every((entry) => entry === 'closed'));
      return { pageErrors: errors, unexpectedWrites, remoteHttp: remoteHttp.length, webSocketsClosed: webSockets.length };
    });

    results.push({ width, height, checks, captures, joinCalls, pageErrors: errors, unexpectedWrites, remoteHttp, webSockets });
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, failures }, null, 2));
}

if (!results.length) {
  failures.push(`No viewports selected by RSVP_SIZES=${process.env.RSVP_SIZES ?? ''}`);
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, failures }, null, 2));
}
if (failures.length) process.exitCode = 1;
console.log(JSON.stringify({ results: results.map(({ width, height, checks }) => ({ width, height, checks })), failures }, null, 2));
