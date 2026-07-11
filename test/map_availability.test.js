import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm,
  getAvailability,
  isOpenAt,
  parseOpeningHours,
} from '../src/lib/mapAvailability.js';

test('parses common Thai listing hour formats', () => {
  assert.deepEqual(parseOpeningHours('10.00 – 23.00'), { startMinutes: 600, endMinutes: 1380 });
  assert.deepEqual(parseOpeningHours('11:00-02:00'), { startMinutes: 660, endMinutes: 120 });
  assert.deepEqual(parseOpeningHours('เปิด 24 ชม.'), { startMinutes: 0, endMinutes: 1440 });
});

test('determines daytime and overnight opening state', () => {
  assert.equal(isOpenAt('10:00-23:00', new Date('2026-07-05T14:00:00+07:00')), true);
  assert.equal(isOpenAt('10:00-23:00', new Date('2026-07-05T08:00:00+07:00')), false);
  assert.equal(isOpenAt('18:00-02:00', new Date('2026-07-06T01:00:00+07:00')), true);
});

test('only treats a fresh explicit signal as available now', () => {
  const now = new Date('2026-07-05T14:00:00+07:00').getTime();
  const fresh = getAvailability({
    description: 'คิวว่างตอนนี้ พร้อมให้บริการ',
    postedAt: '2026-07-05T12:30:00+07:00',
    hours: '10:00-23:00',
  }, now);
  const stale = getAvailability({
    description: 'Available now',
    postedAt: '2026-07-04T12:30:00+07:00',
    hours: '10:00-23:00',
  }, now);
  assert.equal(fresh.state, 'available');
  assert.equal(stale.state, 'open');
});

test('prefers a fresh stored pipeline availability signal', () => {
  const now = new Date('2026-07-05T14:00:00+07:00').getTime();
  const result = getAvailability({
    metrics: { availability_status: 'available', available_staff_count: 3 },
    postedAt: '2026-07-05T13:45:00+07:00',
    hours: '10:00-23:00',
  }, now);
  assert.equal(result.state, 'available');
  assert.equal(result.label, '3 available now');
});

test('calculates useful local distances', () => {
  const km = distanceKm([13.7563, 100.5018], [13.7653, 100.5018]);
  assert.ok(km > 0.99 && km < 1.02);
});
