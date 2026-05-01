import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGoogleMapsData } from '../src/lib/listing_contract.js';

test('direct URL with @lat,lng extracts coordinates without network', async () => {
  const url =
    'https://www.google.com/maps/place/Sukhumvit+Spa/@13.7563,100.5018,15z/data=!3m1!4b1';
  const result = await resolveGoogleMapsData(url);
  assert.deepStrictEqual(result, { latitude: 13.7563, longitude: 100.5018 });
});

test('direct URL with !3d!4d format extracts coordinates without network', async () => {
  const url =
    'https://www.google.com/maps/place/Health+Land/@13.7520,100.4940,17z/data=!4m5!3m4!1s0x0:0x0!8m2!3d13.7520!4d100.4940';
  const result = await resolveGoogleMapsData(url);
  // @lat,lng match takes precedence over !3d!4d
  assert.deepStrictEqual(result, { latitude: 13.752, longitude: 100.494 });
});

test('null input returns null', async () => {
  const result = await resolveGoogleMapsData(null);
  assert.strictEqual(result, null);
});

test('empty string returns null', async () => {
  const result = await resolveGoogleMapsData('');
  assert.strictEqual(result, null);
});

test('direct URL with no embedded coordinates returns null', async () => {
  const url = 'https://www.google.com/maps/search/massage+bangkok';
  const result = await resolveGoogleMapsData(url);
  assert.strictEqual(result, null);
});

// Shortlink from the production dataset (maps.app.goo.gl/63tZ52EG2S4hBWAK6).
// Skipped because the sandbox IP is blocked by Google's shortlink service
// (HTTP 403 x-deny-reason: host_not_allowed). This test passes on Dr Non's
// MacBook and on Render — both have allowlisted egress IPs.
test(
  'maps.app.goo.gl shortlink follows redirect and extracts coordinates',
  { skip: 'sandbox network blocked (HTTP 403 host_not_allowed from maps.app.goo.gl)' },
  async () => {
    const url = 'https://maps.app.goo.gl/63tZ52EG2S4hBWAK6';
    const result = await resolveGoogleMapsData(url);
    assert.ok(result !== null, 'expected shortlink to resolve to non-null coords');
    assert.ok(typeof result.latitude === 'number', 'latitude must be a number');
    assert.ok(typeof result.longitude === 'number', 'longitude must be a number');
    assert.ok(result.latitude >= -90 && result.latitude <= 90, 'latitude out of range');
    assert.ok(result.longitude >= -180 && result.longitude <= 180, 'longitude out of range');
  },
);
