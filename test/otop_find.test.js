/**
 * Tests for otop/core/find.js — the pure logic behind the Find landing.
 *
 * The component is mostly UI; the score + filter + URL round-trip are here
 * and are what protects the contactability-first sort from regressions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreRecord,
  filterRecords,
  findToUrl,
  findFromUrl,
  ALL_PROVINCES,
  STAR_ANY,
  STAR_FIVE,
  STAR_FOUR_FIVE,
} from '../otop/core/find.js';

// Minimal URL polyfill so the URL serialisation tests run in node.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { location: { pathname: '/' } };
  globalThis.URLSearchParams = URLSearchParams;
}

const r = (over) => ({
  producerName: '',
  productName: null,
  description: null,
  district: null,
  subdistrict: null,
  category: null,
  phone: null,
  stars: null,
  provinceCode: 10,
  ...over,
});

test('scoreRecord: 5★ + phone ranks above 4★ + phone ranks above phone-only ranks above name-only', () => {
  const fivePhone = r({ producerName: 'A', stars: 5, phone: '0812345678' });
  const fourPhone = r({ producerName: 'B', stars: 4, phone: '0812345678' });
  const phoneOnly = r({ producerName: 'C', phone: '0812345678' });
  const nameOnly = r({ producerName: 'D' });

  const s5p = scoreRecord(fivePhone);
  const s4p = scoreRecord(fourPhone);
  const sp = scoreRecord(phoneOnly);
  const s0 = scoreRecord(nameOnly);

  assert.ok(s5p > s4p, `5★+phone (${s5p}) must outrank 4★+phone (${s4p})`);
  assert.ok(s4p > sp, `4★+phone (${s4p}) must outrank phone-only (${sp})`);
  assert.ok(sp > s0, `phone-only (${sp}) must outrank name-only (${s0})`);
});

test('scoreRecord: a sub-district address adds more than a district-only one', () => {
  const subdistrict = r({ subdistrict: 'Bang Lamung' });
  const district = r({ district: 'Bang Lamung' });
  const neither = r({});
  assert.ok(scoreRecord(subdistrict) > scoreRecord(district));
  assert.ok(scoreRecord(district) > scoreRecord(neither));
});

test('filterRecords: query matches producerName, productName, description, district, subdistrict, category', () => {
  const records = [
    r({ producerName: 'Auntie Manee Silk Weaving', provinceCode: 10 }),
    r({ productName: 'Khao Soi Paste', provinceCode: 50 }),
    r({ description: 'Hand-woven local textile', provinceCode: 10 }),
    r({ district: 'Mueang Chiang Mai', provinceCode: 50 }),
    r({ subdistrict: 'Bang Lamung', provinceCode: 20 }),
    r({ category: 'herbal', provinceCode: 80 }),
    r({ producerName: 'Unrelated Garage', provinceCode: 10 }),
  ];
  assert.equal(filterRecords(records, { query: 'silk' }).length, 1);
  assert.equal(filterRecords(records, { query: 'khao' }).length, 1);
  assert.equal(filterRecords(records, { query: 'textile' }).length, 1);
  assert.equal(filterRecords(records, { query: 'chiang' }).length, 1);
  assert.equal(filterRecords(records, { query: 'lamung' }).length, 1);
  assert.equal(filterRecords(records, { query: 'herbal' }).length, 1);
  assert.equal(filterRecords(records, { query: 'zzz' }).length, 0);
});

test('filterRecords: Thai substring search works without tokenisation', () => {
  const records = [
    r({ producerName: 'กลุ่มทอผ้าไหมบ้านแม่', provinceCode: 50 }),
    r({ producerName: 'Garage', provinceCode: 10 }),
  ];
  assert.equal(filterRecords(records, { query: 'ผ้าไหม' }).length, 1);
  assert.equal(filterRecords(records, { query: 'ผ้า' }).length, 1);
});

test('filterRecords: provinceCode filter is exact (10 != 100 != 1)', () => {
  const records = [
    r({ producerName: 'Bangkok', provinceCode: 10 }),
    r({ producerName: 'AlsoBangkok10', provinceCode: 10 }),
    r({ producerName: 'Province100', provinceCode: 100 }),
    r({ producerName: 'Province1', provinceCode: 1 }),
  ];
  const out = filterRecords(records, { provinceCode: 10 });
  assert.equal(out.length, 2);
  assert.ok(out.every((rec) => rec.provinceCode === 10));
});

test('filterRecords: stars filter is exact (4-5 catches both, "5" only catches 5)', () => {
  const records = [
    r({ producerName: 'five', stars: 5 }),
    r({ producerName: 'four', stars: 4 }),
    r({ producerName: 'three', stars: 3 }),
    r({ producerName: 'null', stars: null }),
  ];
  assert.equal(filterRecords(records, { stars: STAR_FIVE }).length, 1);
  assert.equal(filterRecords(records, { stars: STAR_FOUR_FIVE }).length, 2);
  assert.equal(filterRecords(records, { stars: STAR_ANY }).length, 4);
});

test('filterRecords: onlyContactable drops records with no phone (the heart of the fix)', () => {
  const records = [
    r({ producerName: 'has', phone: '0812345678' }),
    r({ producerName: 'noPhone' }),
    r({ producerName: 'alsoHas', phone: '02-123-4567' }),
  ];
  const out = filterRecords(records, { onlyContactable: true });
  assert.equal(out.length, 2);
  assert.ok(out.every((rec) => Boolean(rec.phone)));
});

test('filterRecords: sorts contactability-first', () => {
  const records = [
    r({ producerName: 'phone only', phone: '0811111111' }),
    r({ producerName: '4★ + phone', stars: 4, phone: '0822222222' }),
    r({ producerName: '5★ + phone', stars: 5, phone: '0833333333' }),
    r({ producerName: 'name only' }),
  ];
  const out = filterRecords(records, {});
  assert.equal(out[0].producerName, '5★ + phone');
  assert.equal(out[1].producerName, '4★ + phone');
  assert.equal(out[2].producerName, 'phone only');
  assert.equal(out[3].producerName, 'name only');
});

test('filterRecords: returns empty array for null/undefined input without throwing', () => {
  assert.deepEqual(filterRecords(null, {}), []);
  assert.deepEqual(filterRecords(undefined, {}), []);
  assert.deepEqual(filterRecords([], {}), []);
});

test('findToUrl + findFromUrl: round-trip with all four params', () => {
  const state = { query: 'silk', provinceCode: 10, stars: '4-5', onlyContactable: true };
  const url = findToUrl(state);
  assert.match(url, /q=silk/);
  assert.match(url, /p=10/);
  assert.match(url, /s=4-5/);
  assert.match(url, /c=1/);
  assert.match(url, /view=find/);

  // Strip pathname, parse as a URLSearchParams the way the loader does.
  const q = new URLSearchParams(url.split('?')[1] ?? '');
  const back = findFromUrl(q.toString());
  assert.equal(back.query, 'silk');
  assert.equal(back.provinceCode, '10');
  assert.equal(back.stars, '4-5');
  assert.equal(back.onlyContactable, true);
});

test('findToUrl: defaults produce a clean URL (no params, no view=find)', () => {
  const url = findToUrl({ query: '', provinceCode: ALL_PROVINCES, stars: STAR_ANY, onlyContactable: false });
  assert.equal(url, '/');
});

test('findFromUrl: missing params fall back to defaults, not undefined', () => {
  const back = findFromUrl('');
  assert.equal(back.query, '');
  assert.equal(back.provinceCode, ALL_PROVINCES);
  assert.equal(back.stars, STAR_ANY);
  assert.equal(back.onlyContactable, false);
});
