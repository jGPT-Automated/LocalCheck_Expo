import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectHomeCourt } from './savedCourtsModel.ts';
import { regionsForSavedCourts } from './autoCheckInModel.ts';

const court = (id: string, enabled: boolean | null, latitude = 30) => ({ court: { id, name: id, latitude, longitude: -95 }, autoCheckInEnabled: enabled });
test('LocalLite monitors its primary only, regardless of paid saved rows', () => {
  assert.deepEqual(regionsForSavedCourts(false, court('primary', true).court, [court('extra', true)], true).map(r => r.identifier), ['primary']);
});
test('LocalPlus monitors only enabled courts, including the inherited legacy primary', () => {
  assert.deepEqual(regionsForSavedCourts(true, court('primary', true).court, [court('primary', null), court('on', true), court('off', false)], true).map(r => r.identifier), ['primary', 'on']);
  assert.deepEqual(regionsForSavedCourts(true, court('primary', true).court, [court('primary', null), court('off', false)], false), []);
});
test('invalid coordinates never become a monitored region', () => {
  assert.equal(regionsForSavedCourts(true, null, [court('invalid', true, 200)], true).length, 0);
});
test('Home selection falls back after removal and ignores extra courts on the free tier', () => {
  const primary = court('primary', true).court;
  const extra = court('extra', false).court;
  assert.equal(selectHomeCourt(true, 'extra', [primary, extra], primary)?.id, 'extra');
  assert.equal(selectHomeCourt(true, 'missing', [extra], primary)?.id, 'extra');
  assert.equal(selectHomeCourt(false, 'extra', [extra], primary)?.id, 'primary');
});

test('resolving legacy opt-in freezes primary off before another region starts', async () => {
  const { resolveLegacyAutoCheckIn } = await import('./autoCheckInModel.ts');
  const primary = court('primary', null).court;
  const entries = [court('primary', null), court('other', false)];
  let running = false;
  let persisted: boolean | undefined;
  const resolved = await resolveLegacyAutoCheckIn(primary, entries, async () => running, async (_id, enabled) => { persisted = enabled; return enabled; });
  assert.equal(persisted, false);
  running = true; // Starting the explicitly selected OTHER court.
  const savedAfterEnable = resolved.map(entry => entry.court.id === 'other' ? {...entry, autoCheckInEnabled:true} : entry);
  assert.deepEqual(regionsForSavedCourts(true, primary, savedAfterEnable, running).map(r => r.identifier), ['other']);
  assert.deepEqual(regionsForSavedCourts(true, primary, resolved, running), []); // Failed-write rollback never opts primary in.
});
test('legacy resolution respects a concurrently saved explicit opt-in', async () => {
  const { resolveLegacyAutoCheckIn } = await import('./autoCheckInModel.ts');
  const primary = court('primary', null).court;
  const resolved = await resolveLegacyAutoCheckIn(primary, [court('primary', null)], async () => false, async () => true);
  assert.deepEqual(regionsForSavedCourts(true, primary, resolved, false).map(r => r.identifier), ['primary']);
});

test('paid region identifiers retain court identity and can be retired on downgrade', async () => {
  const { autoCheckInRegionIdentifier, courtIdFromAutoCheckInRegion, hasLocalPlusRegions } = await import('./autoCheckInModel.ts');
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(autoCheckInRegionIdentifier(id, false), id);
  assert.equal(courtIdFromAutoCheckInRegion(autoCheckInRegionIdentifier(id, true)), id);
  assert.equal(hasLocalPlusRegions({regions:[{identifier:id}]}), false);
  assert.equal(hasLocalPlusRegions({regions:[{identifier:autoCheckInRegionIdentifier(id,true)}]}), true);
});
