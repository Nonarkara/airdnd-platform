import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES, scoreComponents, scoreRecord, matchRequirement, sourcingBasins, toCsv, STRUCTURAL_CAVEATS,
} from '../otop/core/matching.js';

const YEAR = new Date().getUTCFullYear();

const rec = (over = {}) => ({
  identityKey: over.identityKey ?? Math.random().toString(36),
  productName: 'ผ้าทอ', producerName: 'กลุ่มทดสอบ',
  category: 'textile', stars: 4,
  province: 'บุรีรัมย์', provinceEn: 'Buri Ram', provinceCode: 31, region: 'northeast',
  district: 'เมืองบุรีรัมย์', subdistrict: 'สะแกโพรง',
  phone: '0812345678', email: null, website: null,
  price: 500, registeredYear: YEAR - 1, sourceCount: 1,
  provenance: [{ datasetId: 'ds1', datasetTitle: 'D1' }],
  ...over,
});

test('every profile weight set sums to 1', () => {
  for (const [name, profile] of Object.entries(PROFILES)) {
    const total = Object.values(profile.weights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${name} weights sum to ${total}`);
  }
});

test('unassessed (null) outranks assessed-and-failed (0)', () => {
  // ไม่ผ่าน is a known negative result; a missing grade is merely unknown.
  const unknown = scoreComponents(rec({ stars: null })).assurance;
  const failed = scoreComponents(rec({ stars: 0 })).assurance;
  const passed = scoreComponents(rec({ stars: 1 })).assurance;
  assert.ok(failed < unknown && unknown < passed);
});

test('a phone outranks a website, and no contact scores zero', () => {
  assert.equal(scoreComponents(rec({ phone: '0812345678' })).contactability, 1);
  assert.ok(scoreComponents(rec({ phone: null, email: 'a@b.co' })).contactability > scoreComponents(rec({ phone: null, website: 'x.com' })).contactability);
  assert.equal(scoreComponents(rec({ phone: null, email: null, website: null })).contactability, 0);
});

test('freshness decays with filing age and bottoms out, never going negative', () => {
  assert.equal(scoreComponents(rec({ registeredYear: YEAR - 1 })).freshness, 1);
  assert.equal(scoreComponents(rec({ registeredYear: YEAR - 30 })).freshness, 0);
  const mid = scoreComponents(rec({ registeredYear: YEAR - 6 })).freshness;
  assert.ok(mid > 0 && mid < 1);
});

test('B2C weights reachability above grading; B2B does the reverse', () => {
  // The buyer's question differs: a consumer must reach someone to buy at all,
  // while a business buyer is doing due diligence before a purchase order.
  const reachableUngraded = rec({ stars: null, phone: '0812345678' });
  const gradedUnreachable = rec({ stars: 5, phone: null, email: null, website: null });

  assert.ok(scoreRecord(reachableUngraded, 'b2c').score > scoreRecord(gradedUnreachable, 'b2c').score);
  assert.ok(
    scoreRecord(gradedUnreachable, 'b2b').score / scoreRecord(reachableUngraded, 'b2b').score >
    scoreRecord(gradedUnreachable, 'b2c').score / scoreRecord(reachableUngraded, 'b2c').score,
    'B2B must close the gap relative to B2C',
  );
});

test('components are returned with the score so a ranking can be explained', () => {
  const { components } = scoreRecord(rec());
  assert.deepEqual(
    Object.keys(components).sort(),
    ['assurance', 'contactability', 'corroboration', 'freshness', 'locatability'],
  );
});

test('requirement filters compose, and minStars excludes ungraded records', () => {
  const pool = [
    rec({ identityKey: 'a', category: 'textile', stars: 5 }),
    rec({ identityKey: 'b', category: 'food', stars: 5 }),
    rec({ identityKey: 'c', category: 'textile', stars: null }),
    rec({ identityKey: 'd', category: 'textile', stars: 2 }),
  ];
  const { matches } = matchRequirement(pool, { categories: ['textile'], minStars: 4 });
  assert.deepEqual(matches.map((m) => m.record.identityKey), ['a']);
});

test('requireContact removes records with no contact of any kind', () => {
  const pool = [rec({ identityKey: 'a' }), rec({ identityKey: 'b', phone: null, email: null, website: null })];
  assert.equal(matchRequirement(pool, { requireContact: true }).matches.length, 1);
});

test('structural caveats are always returned, even for an empty result', () => {
  const { caveats } = matchRequirement([], {});
  for (const caveat of STRUCTURAL_CAVEATS) assert.ok(caveats.includes(caveat));
});

test('dynamic caveats quantify what is missing from THIS result set', () => {
  const pool = [rec({ identityKey: 'a' }), rec({ identityKey: 'b', phone: null, email: null, website: null })];
  const { caveats } = matchRequirement(pool, {});
  assert.ok(caveats.some((c) => /50% of these matches \(1\) have no contact/.test(c)));
});

test('basins rank reachable depth, not raw row count', () => {
  // Ten unreachable listings in one province are not a sourcing basin; three
  // reachable ones are.
  const shallow = Array.from({ length: 10 }, (_, i) =>
    rec({ identityKey: `s${i}`, provinceCode: 40, province: 'ขอนแก่น', phone: null, email: null, website: null, stars: null }));
  const deep = Array.from({ length: 3 }, (_, i) =>
    rec({ identityKey: `d${i}`, provinceCode: 31, province: 'บุรีรัมย์', phone: '081234567' + i, stars: 5 }));

  const { matches } = matchRequirement([...shallow, ...deep], {});
  const basins = sourcingBasins(matches, { minDepth: 2 });
  assert.equal(basins[0].province, 'บุรีรัมย์');
  assert.equal(basins[0].reachable, 3);
});

test('basins honour minDepth: a lone supplier is not a basin', () => {
  const pool = [rec({ identityKey: 'a', provinceCode: 31 })];
  assert.equal(sourcingBasins(matchRequirement(pool, {}).matches, { minDepth: 2 }).length, 0);
});

test('CSV escapes commas and quotes so a shortlist survives a spreadsheet', () => {
  const csv = toCsv([{ record: rec({ productName: 'ผ้า, ไหม', producerName: 'กลุ่ม "ก"' }), score: 90 }]);
  const [header, row] = csv.split('\n');
  assert.ok(header.startsWith('score,product,producer'));
  assert.ok(row.includes('"ผ้า, ไหม"'));
  assert.ok(row.includes('"กลุ่ม ""ก"""'));
});
