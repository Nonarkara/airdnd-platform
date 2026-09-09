/**
 * Unit tests for the OTOP insights aggregate functions.
 *
 * These test the pure functions that power every number on the Atlas page.
 *
 * ponytail: pct/tally/completeness are LOCAL COPIES, not imports — insights.js
 * is a run-on-import script. Only signalTier is the real thing. If a helper in
 * insights.js changes, this file stays green. Upgrade path: lift the helpers
 * into otop/core/aggregates.js and import them here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { signalTier } from '../otop/core/matching.js';

const CATEGORIES = [
  { id: 'food', th: 'อาหาร', en: 'Food' },
  { id: 'beverage', th: 'เครื่องดื่ม', en: 'Beverages' },
  { id: 'textile', th: 'ผ้าและเครื่องแต่งกาย', en: 'Fabric & Apparel' },
  { id: 'craft', th: 'ของใช้ ของตกแต่ง ของที่ระลึก', en: 'Household, Decorative & Souvenir' },
  { id: 'herbal', th: 'สมุนไพรที่ไม่ใช่อาหาร', en: 'Non-food Herbal' },
];

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const tally = (items, key) => {
  const out = new Map();
  for (const item of items) {
    const k = key(item);
    if (k == null) continue;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
};

function completeness(items) {
  const n = items.length;
  return {
    records: n,
    withContact: pct(items.filter((r) => r.phone || r.email || r.website).length, n),
    withStars: pct(items.filter((r) => r.stars != null).length, n),
    withPrice: pct(items.filter((r) => r.price != null).length, n),
    withSubdistrict: pct(items.filter((r) => r.subdistrict).length, n),
    withCoordinates: pct(items.filter((r) => r.latitude != null && r.longitude != null).length, n),
    categoryDeclared: pct(items.filter((r) => r.categoryConfidence === 'declared').length, n),
    categoryInferred: pct(items.filter((r) => r.categoryConfidence === 'inferred').length, n),
    categoryUnknown: pct(items.filter((r) => r.categoryConfidence === 'none').length, n),
  };
}

function categoryMix(items) {
  const counts = tally(items, (r) => r.category);
  return CATEGORIES.map((c) => ({
    id: c.id, th: c.th, en: c.en,
    count: counts.get(c.id) ?? 0,
    share: pct(counts.get(c.id) ?? 0, items.length),
  })).concat([{ id: 'unclassified', th: 'ไม่จำแนก', en: 'Unclassified', count: counts.get(null) ?? items.filter((r) => !r.category).length, share: pct(items.filter((r) => !r.category).length, items.length) }]);
}

function starProfile(items) {
  const graded = items.filter((r) => r.stars != null);
  const dist = {};
  for (let s = 0; s <= 5; s += 1) dist[s] = graded.filter((r) => r.stars === s).length;
  const sum = graded.reduce((n, r) => n + r.stars, 0);
  return {
    graded: graded.length,
    ungraded: items.length - graded.length,
    distribution: dist,
    mean: graded.length ? Math.round((sum / graded.length) * 100) / 100 : null,
  };
}

function vintage(items) {
  const years = items.map((r) => r.registeredYear).filter((y) => y != null).sort((a, b) => a - b);
  if (years.length === 0) return { years: 0, earliest: null, latest: null, median: null, staleYears: null };
  const latest = years[years.length - 1];
  return {
    years: years.length, earliest: years[0], latest,
    median: years[Math.floor(years.length / 2)],
    staleYears: new Date().getUTCFullYear() - latest,
  };
}

// ── pct ────────────────────────────────────────────────────────

test('pct returns null when denominator is zero', () => {
  assert.equal(pct(0, 0), null);
});

test('pct returns 0 when numerator is zero and denominator is positive', () => {
  assert.equal(pct(0, 100), 0);
});

test('pct returns 50 when half', () => {
  assert.equal(pct(50, 100), 50);
});

test('pct returns 0.1 precision', () => {
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(1, 7), 14.3);
});

// ── completeness ───────────────────────────────────────────────

test('completeness returns all nulls for empty array', () => {
  const c = completeness([]);
  assert.equal(c.records, 0);
  assert.equal(c.withContact, null);
  assert.equal(c.withStars, null);
});

test('completeness returns 100 when all items have the field', () => {
  const c = completeness([{ phone: '081' }, { phone: '082' }]);
  assert.equal(c.withContact, 100);
});

test('completeness returns 50 when half have the field', () => {
  const c = completeness([{ phone: '081' }, {}]);
  assert.equal(c.withContact, 50);
});

// ── categoryMix ────────────────────────────────────────────────

test('categoryMix returns all zeros for empty array', () => {
  const m = categoryMix([]);
  assert.equal(m.length, CATEGORIES.length + 1);
  for (const c of m) assert.equal(c.count, 0);
});

test('categoryMix counts correctly', () => {
  const items = [{ category: 'food' }, { category: 'food' }, { category: 'textile' }, {}];
  const m = categoryMix(items);
  assert.equal(m.find((c) => c.id === 'food').count, 2);
  assert.equal(m.find((c) => c.id === 'textile').count, 1);
  assert.equal(m.find((c) => c.id === 'unclassified').count, 1);
});

test('categoryMix share rounds to 100 within tolerance', () => {
  const items = [{ category: 'food' }, { category: 'textile' }, {}];
  const m = categoryMix(items);
  const totalShare = m.reduce((s, c) => s + c.share, 0);
  assert.ok(Math.abs(totalShare - 100) < 0.15);
});

// ── starProfile ────────────────────────────────────────────────

test('starProfile returns zeros for no graded items', () => {
  const sp = starProfile([{}, {}, {}]);
  assert.equal(sp.graded, 0);
  assert.equal(sp.ungraded, 3);
  assert.equal(sp.mean, null);
  for (let s = 0; s <= 5; s += 1) assert.equal(sp.distribution[s], 0);
});

test('starProfile computes correct distribution and mean', () => {
  const items = [{ stars: 5 }, { stars: 5 }, { stars: 4 }, { stars: null }, { stars: undefined }];
  const sp = starProfile(items);
  assert.equal(sp.graded, 3);
  assert.equal(sp.distribution[5], 2);
  assert.equal(sp.distribution[4], 1);
  assert.equal(sp.distribution[3], 0);
  assert.equal(sp.mean, 4.67);
});

test('starProfile handles single item', () => {
  const sp = starProfile([{ stars: 3 }]);
  assert.equal(sp.graded, 1);
  assert.equal(sp.mean, 3);
});

// ── vintage ────────────────────────────────────────────────────

test('vintage returns zeros for empty array', () => {
  const v = vintage([]);
  assert.equal(v.years, 0);
  assert.equal(v.earliest, null);
  assert.equal(v.median, null);
});

test('vintage computes correct values', () => {
  const items = [{ registeredYear: 2022 }, { registeredYear: 2024 }, { registeredYear: 2023 }, { registeredYear: null }];
  const v = vintage(items);
  assert.equal(v.years, 3);
  assert.equal(v.earliest, 2022);
  assert.equal(v.latest, 2024);
  assert.equal(v.median, 2023);
});

// ── signalTier ────────────────────────────────────────────────

test('signalTier returns 0 to 3 matching expectations', () => {
  assert.equal(signalTier({ category: 'food', phone: '081', stars: 5 }), 3);
  assert.equal(signalTier({ category: 'food', phone: '081', stars: null }), 2);
  assert.equal(signalTier({ category: 'food' }), 1);
  assert.equal(signalTier({}), 0);
  assert.equal(signalTier({ phone: '081' }), 1);
  assert.equal(signalTier({ stars: 5 }), 1);
  assert.equal(signalTier({ category: null, phone: null, stars: null }), 0);
});
