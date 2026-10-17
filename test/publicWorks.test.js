import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicWorks, storedCoordinates } from '../src/lib/publicWorks.js';
const now = Date.parse('2026-09-25T00:00:00Z');
test('area-only evidence never acquires a station distance', () => {
  const data = buildPublicWorks([{ name: 'Shop', location: 'ทองหล่อ', updatedAt: '2026-09-25' }], now);
  assert.equal(data.resolved, 1);
  assert.equal(data.located, 0);
  assert.equal(data.rows[0].transit, null);
  assert.equal(data.recent, 0);
});
test('area classification uses location rather than a suggestive business name', () => {
  const data = buildPublicWorks([{ name: 'Sukhumvit Spa', location: '' }], now);
  assert.equal(data.resolved, 0);
  assert.equal(data.areas[0].area, 'Area not resolved');
});
test('counts reconcile and future or invalid source dates do not look recent', () => {
  const data = buildPublicWorks([
    { location: 'อโศก', postedAt: '2026-09-24' },
    { location: 'อโศก', postedAt: '2026-10-01' },
    { location: '', postedAt: 'invalid' },
  ], now);
  assert.equal(data.areas.reduce((sum, a) => sum + a.count, 0), 3);
  assert.equal(data.recent, 1);
  assert.equal(data.latest, Date.parse('2026-09-24'));
});
test('stored coordinates validate bounds and produce reference distances', () => {
  for (const value of [{}, { latitude: '', longitude: '' }, { latitude: 100, longitude: 100 }, { latitude: 0, longitude: 0 }]) assert.equal(storedCoordinates(value), null);
  const data = buildPublicWorks([{ latitude: 13.7367, longitude: 100.5604 }], now);
  assert.equal(data.located, 1);
  assert.equal(data.rows[0].transit.name, 'BTS Asok');
  assert.equal(data.rows[0].transit.km, 0);
});
test('empty input remains a valid empty report', () => {
  assert.deepEqual(buildPublicWorks([], now).areas, []);
  assert.equal(buildPublicWorks([], now).latest, null);
});
