import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { buildServiceMatrix } from '../src/lib/health.js';

const payload = {
  meta: { yearBuddhist: 2568, provincesReporting: 3, sources: {}, caveats: [] },
  provinces: [
    {
      code: '20',
      name: 'Chonburi',
      services: { lab: { facilities: 15, tested: 1000, positive: 20 }, sti: { people: 40 }, vct: { people: 5, onArv: 0 }, condom: { people: 9 } },
      civilSociety: { total: 74, certified: 40, current: 36, orgs: ['A', 'B'] },
    },
    // Venues, but no organisation and no VCT return — the referral-gap case.
    { code: '55', name: 'Nan', services: { lab: { facilities: 2, tested: 500, positive: 1 }, sti: null, vct: null, condom: { people: 3 } }, civilSociety: null },
    // Tiny denominator: must never reach the yield table.
    { code: '18', name: 'Chai Nat', services: { lab: { facilities: 1, tested: 10, positive: 5 }, sti: null, vct: null, condom: null }, civilSociety: null },
  ],
};

const listings = [
  { city: 'Chonburi' }, { city: 'Chonburi' },
  { city: 'Nan' }, { city: 'Nan' }, { city: 'Nan' },
];

test('returns null when the dataset is missing', () => {
  assert.equal(buildServiceMatrix(null, listings), null);
  assert.equal(buildServiceMatrix({ provinces: [] }, listings), null);
});

test('computes testing yield per 1,000 tested', () => {
  const m = buildServiceMatrix(payload, listings);
  const chonburi = m.provinces.find((p) => p.name === 'Chonburi');
  assert.equal(chonburi.positivityPer1k, 20); // 20/1000 -> 20 per 1k
  assert.equal(m.totals.tested, 1510);
  assert.equal(m.totals.positive, 26);
});

test('a tiny denominator is excluded from the yield table', () => {
  const m = buildServiceMatrix(payload, listings);
  // Chai Nat is 500 per 1,000 on 10 tests — the highest ratio and the least
  // meaningful. The >=500 floor must keep it out of the headline.
  assert.ok(!m.topYield.some((p) => p.name === 'Chai Nat'));
  assert.ok(m.topYield.every((p) => p.tested >= 500));
});

test('flags a province with venues but no org and no VCT return', () => {
  const m = buildServiceMatrix(payload, listings);
  assert.deepEqual(m.referralGaps.map((p) => p.name), ['Nan']);
  // Chonburi has both an organisation and a VCT return, so it is not a gap.
  assert.ok(!m.referralGaps.some((p) => p.name === 'Chonburi'));
});

test('venues-per-1k-tested ranks outreach priority', () => {
  const m = buildServiceMatrix(payload, listings);
  const nan = m.provinces.find((p) => p.name === 'Nan');
  assert.equal(nan.venueCount, 3);
  assert.equal(nan.venuesPer1kTested, 6); // 3 venues / 500 tested * 1000
  assert.equal(m.coverageGap[0].name, 'Nan'); // 6 beats Chonburi's 2
});

test('a province with no report is null, never zero', () => {
  const m = buildServiceMatrix(payload, listings);
  const nan = m.provinces.find((p) => p.name === 'Nan');
  assert.equal(nan.services.vct, null, 'no return must stay null, not become 0');
  assert.equal(nan.orgs, 0);
});

test('the shipped dataset matches the shape the page renders', () => {
  const file = path.join(process.cwd(), 'public/data/health/hiv-services.json');
  const real = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(real.provinces.length, 77);
  assert.equal(real.meta.yearBuddhist, 2568);
  assert.ok(real.meta.caveats.length >= 4, 'honest-envelope caveats must ship with the data');
  const m = buildServiceMatrix(real, []);
  assert.ok(m.totals.tested > 0);
  assert.ok(m.referralDirectory.length > 0);
  assert.ok(m.referralDirectory.every((p) => p.civilSociety.orgs.length > 0));
});
