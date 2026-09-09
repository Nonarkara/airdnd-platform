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

const metaPath = path.join(PUB, 'otop_meta.json');
const indexPath = path.join(PUB, 'otop_index.json');
if (!fs.existsSync(metaPath) || !fs.existsSync(indexPath)) {
  console.error('[otop:insights] missing otop_meta.json or otop_index.json — cannot compute aggregates');
  process.exit(1);
}
let meta, index;
try {
  meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
} catch (e) {
  console.error(`[otop:insights] corrupt JSON in metadata or index: ${e.message}`);
  process.exit(1);
}
if (!index.totals || typeof index.totals.records !== 'number') {
  console.error('[otop:insights] index.totals.records missing or invalid — cannot verify shard consistency');
  process.exit(1);
}

/**
 * Read the corpus back out of the province shards rather than from a flat file.
 * Above 20,000 records the flat file is not written at all, so the shards are
 * the only complete source — and reading them here means every build verifies
 * that the shards actually add up to what the index claims, instead of trusting
 * two artefacts written by the same pass to agree.
 */
const records = index.provinces.flatMap((p) =>
  JSON.parse(fs.readFileSync(path.join(PUB, 'p', `${p.code}.json`), 'utf8')),
);

if (records.length !== index.totals.records) {
  console.error(
    `[otop:insights] shard total ${records.length} does not match index total ${index.totals.records}. ` +
      'The published data is inconsistent; not writing insights.',
  );
  process.exit(1);
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const nf = new Intl.NumberFormat('en-US');
const n = (v) => (v == null ? '—' : nf.format(v));
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

const CONCENTRATION_TOP_N = 10;
const concentration = {
  top10Share: pct(byProvince.slice(0, CONCENTRATION_TOP_N).reduce((n, p) => n + p.records, 0), records.length),
  top10: byProvince.slice(0, CONCENTRATION_TOP_N).map((p) => ({ th: p.th, en: p.en, records: p.records })),
  emptyProvinces: byProvince.filter((p) => p.records === 0).length,
};

/**
 * Headline findings — what the data actually says, in plain language. The
 * Atlas leads with these because 118,335 is not a finding, it is the size of
 * the input. Every claim here is paired with the value the reader can
 * verify against the meter below it.
 */
const findings = (() => {
  const out = [];
  const total = records.length;
  const corroborated = records.filter((r) => r.sourceCount > 1).length;
  const stars = starProfile(records);
  const v = vintage(records);

  // The "commercial-ready" share: records carrying all three signals a buyer
  // needs at once. Definition is pinned to signalTier() in
  // otop/core/matching.js: category + contact (phone/email/website) + stars.
  // Both the share AND the absolute count are printed, because an earlier
  // report quoted "159" against this same 158,864-record build while the
  // shards recompute to 123 — a bare count with no pinned definition rots.
  // Only tier 0 is "name-only": tiers 1-2 carry one or two usable signals,
  // and calling all of the other 99.9% "name-only registrations" (as an
  // earlier finding did) defined ~52,000 partially-signalled records out of
  // existence.
  const tier = (r) => [r.category, (r.phone || r.email || r.website), r.stars != null].filter(Boolean).length;
  const tierCounts = [0, 0, 0, 0];
  for (const r of records) tierCounts[tier(r)] += 1;
  const commercial = tierCounts[3];
  out.push({
    id: 'commercial-ready',
    th: 'โอทอปพร้อมค้า',
    text: `${n(commercial)} records (${n(pct(commercial, total))}%) carry the three signals a buyer needs at the same time — a category, a contact, and an OPC grade. ${n(tierCounts[2])} carry two of the three, ${n(tierCounts[1])} carry one, and ${n(tierCounts[0])} (${n(pct(tierCounts[0], total))}%) carry none of the three: a name and an area only.`,
    value: pct(commercial, total),
    count: commercial,
    tier2: tierCounts[2],
    tier1: tierCounts[1],
    tier0: tierCounts[0],
  });

  // Corroboration: the only field in the registry that distinguishes a real
  // producer from a single filing, because every record has at least one
  // source.
  out.push({
    id: 'corroboration',
    th: 'ความเห็นตรงกัน',
    text: `${n(pct(corroborated, total))}% of records are attested by more than one agency. Without corroboration, a record is one office's filing; with it, two or more agreed.`,
    value: pct(corroborated, total),
  });

  // Grading. OPC stars are the state's own quality assessment.
  out.push({
    id: 'graded',
    th: 'ได้รับการคัดสรร',
    text: `${n(stars.graded)} records (${n(pct(stars.graded, total))}%) carry an OPC star grade. Mean grade of those: ${n(stars.mean)}★. ${n(stars.distribution[5] ?? 0)} are 5-star; ${n(stars.distribution[4] ?? 0)} are 4-star.`,
    value: pct(stars.graded, total),
  });

  // Concentration. A registry is not a census, so this measures where the
  // paperwork happens, not where the making happens.
  out.push({
    id: 'concentration',
    th: 'ความเข้มข้น',
    text: `The ten most-filed provinces hold ${n(concentration.top10Share)}% of all records. The remaining 67 provinces share the rest.`,
    value: concentration.top10Share,
  });

  // Corroboration spread. Same data source, very different trust.
  const byCorroboration = [...byProvince].sort((a, b) => (b.corroborated / Math.max(b.records, 1)) - (a.corroborated / Math.max(a.records, 1)));
  const mostTrusted = byCorroboration[0];
  const leastTrusted = byCorroboration[byCorroboration.length - 1];
  if (mostTrusted && leastTrusted) {
    out.push({
      id: 'trust-spread',
      th: 'ช่วงความน่าเชื่อถือ',
      text: `${mostTrusted.th} is the most cross-attested province (${n(pct(mostTrusted.corroborated, mostTrusted.records))}% of its records corroborated by ≥2 agencies); ${leastTrusted.th} is the least (${n(pct(leastTrusted.corroborated, leastTrusted.records))}%). Same data source, very different administrative depth.`,
      value: pct(mostTrusted.corroborated, mostTrusted.records),
    });
  }

  // Freshness.
  if (v.years > 0) {
    out.push({
      id: 'freshness',
      th: 'ความสดใหม่',
      text: `${n(v.years)} records (${n(pct(v.years, total))}%) carry a filing year. Median filing year is ${v.median}. The other ${n(pct(total - v.years, total))}% cannot be dated from the registry.`,
      value: pct(v.years, total),
    });
  }

  return out;
})();

/**
 * Specialization. For each declared category, the top three provinces. A
 * category becomes a real signal only when a province concentrates it —
 * equal distribution means no province is the place to source from for that
 * category.
 */
const specialization = (() => {
  const out = [];
  for (const cat of CATEGORIES) {
    const ranked = byProvince
      .map((p) => {
        const c = (p.categories || []).find((x) => x.id === cat.id);
        return c ? { code: p.code, th: p.th, en: p.en, count: c.count, share: c.share } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    if (ranked[0] && ranked[0].count > 0) {
      out.push({
        id: cat.id, th: cat.th, en: cat.en,
        leaders: ranked,
        topCount: ranked[0].count,
      });
    }
  }
  return out.sort((a, b) => b.topCount - a.topCount);
})();

/**
 * Where the verified supply actually is. The graded subset is the most
 * defensible shortlist the registry offers, because both the producer and
 * the state have signed off.
 */
const qualityLeaders = byProvince
  .map((p) => ({
    code: p.code, th: p.th, en: p.en,
    graded: p.stars.graded,
    graded45: (p.stars.distribution?.[4] ?? 0) + (p.stars.distribution?.[5] ?? 0),
    total: p.records,
    density: p.stars.graded > 0 ? Math.round((p.stars.graded / p.records) * 1000) / 10 : 0,
  }))
  .filter((p) => p.graded > 0)
  .sort((a, b) => b.graded - a.graded)
  .slice(0, 10);

/**
 * The Reach Gap — the single most actionable table in the whole registry.
 * Per province: how many producers exist, how many can be reached, how many
 * are corroborated. The poverty-fighting number is the gap between the first
 * and the second column.
 */
const reachGap = byProvince
  .map((p) => {
    const items = records.filter((r) => r.provinceCode === p.code);
    const reachable = items.filter((r) => r.phone || r.email || r.website).length;
    const unreachable = items.length - reachable;
    const corrob = items.filter((r) => r.sourceCount > 1).length;
    const highStars = items.filter((r) => r.stars >= 4).length;
    const hiddenChampions = items.filter((r) => r.stars >= 4 && r.sourceCount > 1 && !r.phone && !r.email && !r.website).length;
    return {
      code: p.code, th: p.th, en: p.en, region: p.region,
      records: items.length,
      reachable,
      unreachable,
      reachablePct: pct(reachable, items.length),
      corroborated: corrob,
      corroboratedPct: pct(corrob, items.length),
      highStars,
      hiddenChampions,
    };
  })
  .sort((a, b) => b.unreachable - a.unreachable);

/**
 * The Contact × Corroboration Quadrant. A 2×2 grid that classifies every
 * province into: ready to trade, best docs but unreachable, reachable but
 * unverified, and the poverty zones.
 *
 * The cuts (50% corroborated, 10% reachable) are administrative lines, not
 * natural kinds — chosen because 10% contact separates the handful of
 * reachable provinces from the mass near zero, and 50% corroboration splits
 * verified-majority from verified-minority. Provinces sitting on the lines
 * (e.g. Kamphaeng Phet at 49.4%/8.8% in the 2026-09-09 build) change
 * quadrants if the lines move; the Atlas names the nearest edge case live
 * so the fragility is visible, not hidden.
 */
const CORROBORATION_THRESHOLD = 50; // % of records corroborated
const CONTACT_THRESHOLD = 10; // % of records with contact

const corroborationQuadrant = {
  thresholds: { corroboration: CORROBORATION_THRESHOLD, contact: CONTACT_THRESHOLD },
  ready: reachGap.filter((p) => p.corroboratedPct >= CORROBORATION_THRESHOLD && p.reachablePct >= CONTACT_THRESHOLD),
  documented: reachGap.filter((p) => p.corroboratedPct >= CORROBORATION_THRESHOLD && p.reachablePct < CONTACT_THRESHOLD),
  reachable: reachGap.filter((p) => p.corroboratedPct < CORROBORATION_THRESHOLD && p.reachablePct >= CONTACT_THRESHOLD),
  blind: reachGap.filter((p) => p.corroboratedPct < CORROBORATION_THRESHOLD && p.reachablePct < CONTACT_THRESHOLD),
};

/**
 * Hidden champions — the state's own certified producers that are unreachable.
 * Each one is a lost sale the state itself vetted.
 */
const hiddenChampions = reachGap
  .filter((p) => p.hiddenChampions > 0)
  .sort((a, b) => b.hiddenChampions - a.hiddenChampions)
  .slice(0, 15)
  .map((p) => ({ code: p.code, th: p.th, en: p.en, hiddenChampions: p.hiddenChampions, highStars: p.highStars, reachable: p.reachable }));

/**
 * Region identity — what each region's classified production actually is.
 * Thailand's OTOP character in one screen.
 */
const regionIdentity = byRegion.map((r) => {
  const cats = (r.categories || []).filter((c) => c.id !== 'unclassified');
  const total = cats.reduce((s, c) => s + c.count, 0);
  const sorted = [...cats].sort((a, b) => b.count - a.count);
  const dominant = sorted[0];
  return {
    id: r.id, th: r.th, en: r.en,
    dominantCategory: dominant ? dominant.id : null,
    dominantLabel: dominant ? dominant.en : 'Unclassified',
    dominantShare: dominant ? Math.round((dominant.count / Math.max(total, 1)) * 1000) / 10 : 0,
    classified: total,
    records: r.records,
    classifiedPct: pct(total, r.records),
  };
});

/**
 * Revenue. The CDD monthly sales series (BE 2565–2567) joined to province
 * codes by scripts/otop/revenue.js. Embedded here — not merged into records —
 * because provincial aggregates cannot be divided down to producers. The only
 * numbers carried forward are the ones that survive without a per-record
 * join: national annuals and the top ten provinces of the latest full year.
 * No revenue-per-record ratio is computed anywhere: dividing CDD aggregates
 * by registry row counts would launder filing energy into productivity.
 */
const revenue = (() => {
  const file = path.join(PUB, 'otop_revenue.json');
  if (!fs.existsSync(file)) return null;
  let rev;
  try {
    rev = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!rev || rev.degraded || !Array.isArray(rev.byProvince)) return null;
  const fullYears = (rev.coverage?.fullYears ?? []).slice().sort();
  const latestFull = fullYears.length ? fullYears[fullYears.length - 1] : null;
  if (latestFull == null) return null;
  const top10 = rev.byProvince
    .map((p) => ({ code: p.code, th: p.th, en: p.en, total: p.years?.[latestFull]?.total ?? null }))
    .filter((p) => p.total != null)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  return {
    builtAt: rev.builtAt,
    unit: rev.source?.unit ?? 'บาท',
    seriesSource: rev.source?.seriesSource ?? null,
    latestFullYear: latestFull,
    nationalAnnual: rev.nationalAnnual,
    coverage: rev.coverage,
    top10,
  };
})();

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
  findings,
  specialization,
  qualityLeaders,

  // New: poverty-fighting intelligence
  reachGap,
  corroborationQuadrant,
  hiddenChampions,
  regionIdentity,

  // Revenue aggregates (null when the revenue stage degraded — the Atlas
  // hides the section rather than substituting).
  revenue,

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

console.log(`[otop:insights] ${insights.national.records} records · ${insights.national.provincesCovered}/${PROVINCES.length} provinces · degraded=${insights.degraded}`);
console.log(`[otop:insights] completeness — contact ${insights.national.completeness.withContact}% · graded ${insights.national.completeness.withStars}% · priced ${insights.national.completeness.withPrice}%`);
console.log(`[otop:insights] category declared ${insights.national.completeness.categoryDeclared}% / inferred ${insights.national.completeness.categoryInferred}% / unknown ${insights.national.completeness.categoryUnknown}%`);
console.log(`[otop:insights] corroborated by >1 source: ${insights.national.corroboratedShare}% · top-10 concentration ${insights.concentration.top10Share}%`);
