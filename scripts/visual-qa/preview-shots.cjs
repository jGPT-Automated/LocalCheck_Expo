// Preview-vs-live screenshots of the screens a PR changes (ui-done skill, section 3).
// usage: QA_EMAIL=... QA_PASSWORD=... ONLY=1-explore,2-drawer \
//   node scripts/visual-qa/preview-shots.cjs <baseUrl> <live|pr>
// Run it once with main's live link and once with the PR's Vercel preview.
// ONLY limits it to the screens the change touches. Ask Jesse for the login.
// Writes shots/<label>-<width>-<screen>.png. Add a step here for a new screen.
const { chromium } = require('playwright');
const [base, label] = process.argv.slice(2);
const SIZES = [[375, 667], [393, 852]];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const tag = `${label}-${w}`;
    await p.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(4000);
    const inputs = p.locator('input');
    if (await inputs.count() >= 2) {
      await inputs.nth(0).fill(process.env.QA_EMAIL);
      await inputs.nth(1).fill(process.env.QA_PASSWORD);
      await p.getByText('SIGN IN', { exact: true }).first().click();
      await p.waitForTimeout(10000);
    }
    await p.goto(base.replace(/\/$/, '') + '/explore', { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(6000);
    if (want('1-explore')) await p.screenshot({ path: `shots/${tag}-1-explore.png` });
    const card = p.locator('[data-testid^="court-"]').first();
    const id = (await card.getAttribute('data-testid')).replace('court-', '');
    await card.click();
    await p.waitForTimeout(5000);
    if (want('2-drawer')) await p.screenshot({ path: `shots/${tag}-2-drawer.png` });
    const exp = p.locator('[aria-label$=", expand"]').first();
    if (await exp.count()) { await exp.click(); await p.waitForTimeout(3500); }
    if (want('3-drawer-expanded')) await p.screenshot({ path: `shots/${tag}-3-drawer-expanded.png` });
    await p.goto(base.replace(/\/$/, '') + '/court/' + id, { waitUntil: 'networkidle', timeout: 90000 });
    await p.waitForTimeout(6000);
    if (want('4-court-page')) await p.screenshot({ path: `shots/${tag}-4-court-page.png` });
    if (want('5-home')) {
      await p.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'networkidle', timeout: 90000 });
      await p.waitForTimeout(6000);
      await p.screenshot({ path: `shots/${tag}-5-home.png` });
    }
    console.log(tag, 'court', id);
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
