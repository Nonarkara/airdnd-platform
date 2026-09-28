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

// ── Money layer ───────────────────────────────────────────────────────────
// Two filings from one department. Each obeys its own arithmetic; neither is
// summed into the other. The reconciliation block is what stops a reader
// (or a later agent) from quietly treating them as one series.
const REV = new URL('../otop/public/otop_revenue.json', import.meta.url);

test('revenue: category table — offline + online = total, per cell, per province-year, nationally', (t) => {
  if (!existsSync(REV)) return t.skip('otop_revenue.json not built');
  const { byCategory } = JSON.parse(readFileSync(REV, 'utf8'));
  if (!byCategory) return t.skip('category table not cached');
  const close = (a, b) => Math.abs(a - b) < 1; // baht, float sums
  for (const [code, years] of Object.entries(byCategory.provinces)) {
    for (const [y, py] of Object.entries(years)) {
      let off = 0, on = 0;
      for (const c of Object.values(py.categories)) {
        assert.ok(close(c.offline + c.online, c.total), `${code}/${y} cell`);
        off += c.offline; on += c.online;
      }
      assert.ok(close(off, py.offline) && close(on, py.online) && close(off + on, py.total), `${code}/${y} province-year`);
    }
  }
  for (const y of byCategory.years) {
    const nat = byCategory.national[y];
    const sum = Object.values(byCategory.provinces).reduce((s, yrs) => s + (yrs[y]?.total ?? 0), 0);
    assert.ok(close(sum, nat.total), `national ${y}: provinces sum ${sum} ≠ ${nat.total}`);
  }
  assert.equal(Object.keys(byCategory.provinces).length, 77);
});

test('revenue: the two filings are published with a reconciliation, never merged', (t) => {
  if (!existsSync(REV)) return t.skip('otop_revenue.json not built');
  const rev = JSON.parse(readFileSync(REV, 'utf8'));
  if (!rev.byCategory) return t.skip('category table not cached');
  assert.notEqual(rev.byCategory.resourceId, rev.source.resourceId, 'two resources, two ids');
  const r = rev.reconciliation;
  assert.ok(r && r.comparedProvinceYears > 0);
  assert.equal(r.matching + r.mismatching, r.comparedProvinceYears);
  assert.ok(r.medianGapPct != null);
  // A conflicting duplicate in the source is excluded and named, not resolved by guessing.
  for (const e of rev.byCategory.excluded) {
    assert.equal(rev.byCategory.provinces[e.code]?.[e.year], undefined, `${e.th} ${e.year} must not be published`);
  }
});

test('atlas: revenue in insights carries the monthly line and the category split', (t) => {
  if (!existsSync(PATH)) return t.skip('otop_insights.json not built');
  const { revenue } = JSON.parse(readFileSync(PATH, 'utf8'));
  if (!revenue) return t.skip('revenue degraded');
  assert.ok(Array.isArray(revenue.nationalMonthly) && revenue.nationalMonthly.length >= 12);
  for (const m of revenue.nationalMonthly) assert.ok(m.value == null || m.value >= 0);
  if (revenue.byCategory) assert.ok(revenue.reconciliation, 'category split without reconciliation is a merge waiting to happen');
});
