#!/usr/bin/env node
/**
 * Stage 3 — aggregates.
 *
 * The naive dashboard for a registry like this counts rows per province and
 * calls it "OTOP activity". That number measures the registry, not the economy:
 * a province with an energetic CDD office out-counts a province with more
 * producers and less paperwork. So every aggregate here is labelled as a
 * measure of the *record*, and the headline metrics are the ones that describe
 * the registry's own condition — completeness, vintage, and cross-agency
 * corroboration. Those are defensible from this data. Claims about production
 * are not, and are not made.
 *
 * Reads  otop/public/otop.json + otop_meta.json
 * Writes otop/public/otop_insights.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVINCES, REGIONS, REGION_ORDER } from '../../otop/core/provinces.js';
import { CATEGORIES } from '../../otop/core/taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUB = path.join(ROOT, 'otop/public');

const records = JSON.parse(fs.readFileSync(path.join(PUB, 'otop.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(PUB, 'otop_meta.json'), 'utf8'));

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

/** How much of a record is actually filled in. This is the honest headline. */
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

/** Registry vintage: how old is the newest thing each area has filed. */
function vintage(items) {
  const years = items.map((r) => r.registeredYear).filter((y) => y != null).sort((a, b) => a - b);
  if (years.length === 0) return { years: 0, earliest: null, latest: null, median: null, staleYears: null };
  const latest = years[years.length - 1];
  return {
    years: years.length,
    earliest: years[0],
    latest,
    median: years[Math.floor(years.length / 2)],
    staleYears: new Date().getUTCFullYear() - latest,
  };
}

const byProvince = PROVINCES.map((p) => {
  const items = records.filter((r) => r.provinceCode === p.code);
  return {
    code: p.code, iso: p.iso, th: p.th, en: p.en, region: p.region,
    records: items.length,
    producers: new Set(items.map((r) => r.identityKey)).size,
    corroborated: items.filter((r) => r.sourceCount > 1).length,
    categories: categoryMix(items),
    stars: starProfile(items),
    completeness: completeness(items),
    vintage: vintage(items),
  };
}).sort((a, b) => b.records - a.records);

const byRegion = REGION_ORDER.map((id) => {
  const provinces = byProvince.filter((p) => p.region === id);
  const items = records.filter((r) => r.region === id);
  return {
    id, th: REGIONS[id].th, en: REGIONS[id].en,
    provinces: provinces.length,
    provincesWithRecords: provinces.filter((p) => p.records > 0).length,
    records: items.length,
    share: pct(items.length, records.length),
    categories: categoryMix(items),
    stars: starProfile(items),
    completeness: completeness(items),
  };
});

const contributors = [...tally(records.flatMap((r) => r.provenance), (p) => p.organization)]
  .map(([organization, count]) => ({ organization, records: count }))
  .sort((a, b) => b.records - a.records);

const insights = {
  builtAt: new Date().toISOString(),
  // Carried forward so a consumer of this file alone can still tell whether it
  // describes national open data or a development fixture.
  source: meta.source,
  degraded: meta.degraded,
  reason: meta.reason,

  national: {
    records: records.length,
    producers: new Set(records.map((r) => r.identityKey)).size,
    provincesCovered: byProvince.filter((p) => p.records > 0).length,
    provincesEmpty: byProvince.filter((p) => p.records === 0).map((p) => p.th),
    corroborated: records.filter((r) => r.sourceCount > 1).length,
    corroboratedShare: pct(records.filter((r) => r.sourceCount > 1).length, records.length),
    duplicatesCollapsed: meta.counts.duplicatesCollapsed,
    completeness: completeness(records),
    categories: categoryMix(records),
    stars: starProfile(records),
    vintage: vintage(records),
  },

  byRegion,
  byProvince,
  contributors,

  // Concentration: the share of all records held by the top ten provinces. A
  // registry is not a census, so a high figure is as likely to reflect where
  // the paperwork happens as where the making happens — stated, not hidden.
  concentration: {
    top10Share: pct(byProvince.slice(0, 10).reduce((n, p) => n + p.records, 0), records.length),
    top10: byProvince.slice(0, 10).map((p) => ({ th: p.th, en: p.en, records: p.records })),
    emptyProvinces: byProvince.filter((p) => p.records === 0).length,
  },
};

fs.writeFileSync(path.join(PUB, 'otop_insights.json'), JSON.stringify(insights, null, 2));

console.log(`[otop:insights] ${insights.national.records} records · ${insights.national.provincesCovered}/77 provinces · degraded=${insights.degraded}`);
console.log(`[otop:insights] completeness — contact ${insights.national.completeness.withContact}% · graded ${insights.national.completeness.withStars}% · priced ${insights.national.completeness.withPrice}%`);
console.log(`[otop:insights] category declared ${insights.national.completeness.categoryDeclared}% / inferred ${insights.national.completeness.categoryInferred}% / unknown ${insights.national.completeness.categoryUnknown}%`);
console.log(`[otop:insights] corroborated by >1 source: ${insights.national.corroboratedShare}% · top-10 concentration ${insights.concentration.top10Share}%`);
