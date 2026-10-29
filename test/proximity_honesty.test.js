import assert from 'node:assert/strict';
import test from 'node:test';
import { listingCoords, nearestListings } from '../src/lib/geo.js';

const ORIGIN = [13.7303, 100.5698]; // BTS Phrom Phong

test('the finder ranks only placed listings and never invents a point', () => {
  assert.deepEqual(listingCoords({ latitude: 13.73, longitude: 100.57, geoPrecision: 'exact' })?.precision, 'exact');
  assert.equal(listingCoords({ latitude: 13.73, longitude: 100.57, geoPrecision: 'tambon', geoUnit: {} })?.precision, 'approximate');
  // Province-only: no point, even when the text names a famous area.
  assert.equal(listingCoords({ name: 'Sukhumvit Spa', location: 'Sukhumvit, Bangkok', geoPrecision: 'province' }), null);
  assert.equal(listingCoords({ name: 'x', geoPrecision: 'none', latitude: null }), null);
});

test('one result per business, and no transit distance from an approximate centre', () => {
  const a5 = { name: 'A5 Massage', phone: '081-234-5678', latitude: 13.731, longitude: 100.570, geoPrecision: 'exact', priceValue: 500 };
  const rows = nearestListings([
    { ...a5, id: 1 },
    { ...a5, id: 2, name: 'A5 Massage สุขุมวิท22' },
    { ...a5, id: 3, phone: null, name: 'A5 Massage' },
    { id: 4, name: 'Other', latitude: 13.74, longitude: 100.56, geoPrecision: 'tambon', geoUnit: {} },
  ], ORIGIN);
  assert.deepEqual(rows.map((r) => r.listing.id), [1, 4]);
  assert.ok(rows[0].transit, 'exact listing gets its nearest station');
  assert.equal(rows[1].transit, null);
});
