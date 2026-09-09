import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { railOf, classifiedOf, RAIL_LABEL } from '../otop/src/lib/insights.js';

const PATH = new URL('../otop/public/otop_insights.json', import.meta.url);

// The Atlas draws composition bars straight from these arrays. A bar whose
// segments do not sum to its total is a chart that lies with true numbers, so
// the conservation law is checked here rather than trusted at render time.
test('atlas: every category composition sums to its own record count', (t) => {
  if (!existsSync(PATH)) return t.skip('otop_insights.json not built');
  const insights = JSON.parse(readFileSync(PATH, 'utf8'));

  const scopes = [insights.national, ...insights.byRegion, ...insights.byProvince];
  for (const scope of scopes) {
    const sum = scope.categories.reduce((s, c) => s + c.count, 0);
    assert.equal(sum, scope.records, `${scope.en ?? 'national'} categories sum ${sum} ≠ ${scope.records}`);
    assert.equal(scope.stars.graded + scope.stars.ungraded, scope.records, `${scope.en ?? 'national'} stars`);
    assert.ok(classifiedOf(scope) >= 0 && classifiedOf(scope) <= scope.records);
  }
});

test('atlas: every province gets a rail, and the rail is ordinal', (t) => {
  if (!existsSync(PATH)) return t.skip('otop_insights.json not built');
  const insights = JSON.parse(readFileSync(PATH, 'utf8'));

  for (const p of insights.byProvince) {
    const rail = railOf(p);
    assert.ok(rail in RAIL_LABEL, `${p.en} got unknown rail ${rail}`);
    // The rail names the STRONGEST field the record carries, so a graded
    // province can never fall to a weaker rail than a merely-corroborated one.
    if (p.stars.graded > 0) assert.equal(rail, 'business');
    else if (classifiedOf(p) > 0) assert.equal(rail, 'standard');
    else if (p.corroborated > 0) assert.equal(rail, 'transfer');
    else assert.equal(rail, 'hazard');
  }
});

test('atlas: concentration top-ten cannot exceed the registry', (t) => {
  if (!existsSync(PATH)) return t.skip('otop_insights.json not built');
  const { national, concentration } = JSON.parse(readFileSync(PATH, 'utf8'));
  const top = concentration.top10.reduce((s, p) => s + p.records, 0);
  assert.ok(top <= national.records, `top ten ${top} > ${national.records}`);
  assert.equal(concentration.top10.length, 10);
});
