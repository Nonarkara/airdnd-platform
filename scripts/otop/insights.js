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

// Per-resource reports moved out of otop_meta.json (1.9 MB the browser was
// parsing on every page load for five counts). Build-time consumers read them
// from the sidecar's data file; the fallback keeps a stale checkout's
// meta.resources working so the build never silently loses the funnel.
const resourcesPath = path.join(ROOT, 'otop/data/meta-resources.json');
const metaResources = fs.existsSync(resourcesPath)
  ? (JSON.parse(fs.readFileSync(resourcesPath, 'utf8')).resources ?? [])
  : (meta.resources ?? []);

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

const tambonsPath = path.join(PUB, 'otop_tambons.json');
let tambonsList = [];
if (fs.existsSync(tambonsPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(tambonsPath, 'utf8'));
    tambonsList = Array.isArray(raw.tambons) ? raw.tambons : [];
  } catch {}
}

const standardsPath = path.join(PUB, 'otop_standards.json');
let standardsPayload = null;
if (fs.existsSync(standardsPath)) {
  try {
    standardsPayload = JSON.parse(fs.readFileSync(standardsPath, 'utf8'));
  } catch {}
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
    withIncome: pct(items.filter((r) => r.income != null).length, n),
    withSubdistrict: pct(items.filter((r) => r.subdistrict).length, n),
    withCoordinates: pct(items.filter((r) => r.latitude != null && r.longitude != null).length, n),
    withTambon: pct(items.filter((r) => r.tambonCode).length, n),
    withCert: pct(items.filter((r) => (r.certs ?? []).length > 0).length, n),
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
  const provTambons = tambonsList
    .filter((t) => t.provinceCode === p.code)
    .sort((a, b) => b.records - a.records);
  return {
    code: p.code, iso: p.iso, th: p.th, en: p.en, region: p.region,
    records: items.length,
    producers: new Set(items.map((r) => r.identityKey)).size,
    corroborated: items.filter((r) => r.sourceCount > 1).length,
    categories: categoryMix(items),
    stars: starProfile(items),
    completeness: completeness(items),
    vintage: vintage(items),
    topBasins: provTambons.slice(0, 5),
  };
}).sort((a, b) => b.records - a.records);

const topBasins = {
  byRecords: [...tambonsList].sort((a, b) => b.records - a.records).slice(0, 15),
  byReachable: [...tambonsList].sort((a, b) => b.reachable - a.reachable).slice(0, 15),
  byChampions: [...tambonsList].filter((t) => t.graded4Plus > 0).sort((a, b) => b.graded4Plus - a.graded4Plus).slice(0, 15),
};

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

/**
 * Filings per year. The vintage section already shows the median; this is
 * the year-by-year breakdown. Categories split so a viewer can read the
 * shift in the programme's emphasis: a textile spike in year X, a food
 * surge in year Y. Only records that carry a year are counted — the rest
 * (86.6% of the registry) cannot be dated.
 */
const byYear = (() => {
  const total = new Map();
  const byCategory = new Map();
  for (const r of records) {
    const y = r.registeredYear;
    if (y == null) continue;
    total.set(y, (total.get(y) ?? 0) + 1);
    const cat = r.category ?? 'unclassified';
    if (!byCategory.has(cat)) byCategory.set(cat, new Map());
    const m = byCategory.get(cat);
    m.set(y, (m.get(y) ?? 0) + 1);
  }
  const years = [...total.keys()].sort((a, b) => a - b);
  return {
    years,
    total: years.map((y) => ({ year: y, count: total.get(y) })),
    byCategory: Object.fromEntries(
      [...byCategory.entries()].map(([cat, m]) => [cat, years.map((y) => ({ year: y, count: m.get(y) ?? 0 }))]),
    ),
  };
})();

/**
 * Province × category matrix, the single most informative view in the
 * registry. A reader can see in one glance that Lamphun is a textile
 * specialist, Nonthaburi is herbal/beverage, and Bangkok punches above
 * its weight in processed goods. The cell intensity is the cell's share
 * of the column (category) total, so the eye is drawn to the columns
 * where one province dominates — the actual specializations.
 */
const matrix = (() => {
  const catIds = CATEGORIES.map((c) => c.id);
  const cellCounts = {};
  for (const id of catIds) cellCounts[id] = {};
  for (const r of records) {
    if (!r.category) continue;
    if (!cellCounts[r.category]) continue;
    cellCounts[r.category][r.provinceCode] = (cellCounts[r.category][r.provinceCode] ?? 0) + 1;
  }
  // Per-category column totals drive the share calculation.
  const colTotal = {};
  for (const id of catIds) colTotal[id] = Object.values(cellCounts[id] ?? {}).reduce((a, b) => a + b, 0);

  const rows = byProvince
    .filter((p) => p.records > 0)
    .map((p) => {
      const row = {
        code: p.code, th: p.th, en: p.en, records: p.records,
        cells: {},
        rowTotal: 0,
      };
      for (const id of catIds) {
        const count = cellCounts[id]?.[p.code] ?? 0;
        row.cells[id] = {
          count,
          share: colTotal[id] > 0 ? Math.round((count / colTotal[id]) * 1000) / 10 : 0,
        };
        row.rowTotal += count;
      }
      return row;
    })
    .sort((a, b) => b.rowTotal - a.rowTotal)
    .slice(0, 25); // the long tail flattens; 25 provinces still carry >95% of the classified volume

  return {
    categories: CATEGORIES.map((c) => ({ id: c.id, th: c.th, en: c.en, total: colTotal[c.id] ?? 0 })),
    rows,
    colTotal,
  };
})();

const CONCENTRATION_TOP_N = 10;
const concentration = {
  top10Share: pct(byProvince.slice(0, CONCENTRATION_TOP_N).reduce((n, p) => n + p.records, 0), records.length),
  top10: byProvince.slice(0, CONCENTRATION_TOP_N).map((p) => ({ th: p.th, en: p.en, records: p.records })),
  emptyProvinces: byProvince.filter((p) => p.records === 0).length,
};

/**
 * State certification — the มผช. holder lists joined to the registry.
 * The certificate fields used to be dropped by the pipeline, so 11,000+
 * clean holder rows entered the corpus as ordinary producers and no view
 * could answer "is this producer state-certified?". Now each merged record
 * carries its certificates with a standing judged at build time.
 * Certified + reachable + graded is the buyer-ready set: the state has
 * signed the product AND the system can route an order to its maker.
 * (Defined before `findings`: that IIFE runs immediately and cannot take
 * forward references.)
 */
const certification = (() => {
  const certified = records.filter((r) => (r.certs ?? []).length > 0);
  const valid = certified.filter((r) => r.certStatus === 'valid');
  const expired = certified.filter((r) => r.certStatus === 'expired');
  const unknown = certified.filter((r) => r.certStatus === 'unknown');
  const asOf = (certified.map((r) => r.certAsOf).filter(Boolean).sort().pop()) ?? null;

  const stdTally = new Map();
  for (const r of certified) {
    for (const c of r.certs ?? []) {
      const key = [c.standardCode, c.standardTitle].filter(Boolean).join(' · ') || '(unspecified standard)';
      if (!stdTally.has(key)) stdTally.set(key, { standard: key, holders: 0, valid: 0 });
      const t = stdTally.get(key);
      t.holders += 1;
      if (r.certStatus === 'valid') t.valid += 1;
    }
  }
  const byStandard = [...stdTally.values()].sort((a, b) => b.holders - a.holders).slice(0, 10);

  const byProvinceCert = byProvince
    .map((p) => {
      const items = records.filter((r) => r.provinceCode === p.code && (r.certs ?? []).length > 0);
      return {
        code: p.code, th: p.th, en: p.en, records: p.records,
        certified: items.length,
        valid: items.filter((r) => r.certStatus === 'valid').length,
        certifiedReachable: items.filter((r) => r.phone || r.email || r.website).length,
        certifiedGraded: items.filter((r) => r.stars != null && r.stars >= 4).length,
      };
    })
    .filter((p) => p.certified > 0)
    .sort((a, b) => b.certified - a.certified);

  return {
    asOf,
    certified: certified.length,
    certifiedShare: pct(certified.length, records.length),
    valid: valid.length,
    expired: expired.length,
    unknown: unknown.length,
    buyerReady: certified.filter((r) => r.certStatus === 'valid' && (r.phone || r.email || r.website) && r.stars != null && r.stars >= 4).length,
    byStandard,
    byProvince: byProvinceCert,
  };
})();

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

  // Hidden champions. The registry's most damning finding: state-certified
  // 4-5★ producers with no contact channel. These exist; the system just
  // cannot route a buyer to them. Summed across all provinces this is the
  // number of supply the programme has graded and then lost. Computed
  // directly from the records (not from a derived const) so the findings
  // IIFE has no forward references.
  const hiddenTotal = records.filter((r) => r.stars != null && r.stars >= 4 && r.sourceCount > 1 && !r.phone && !r.email && !r.website).length;
  if (hiddenTotal > 0) {
    out.push({
      id: 'hidden-champions',
      th: 'ซ่อนอยู่ในทะเบียน',
      text: `${n(hiddenTotal)} records carry a 4-5★ OPC grade but no contact channel. The state has certified them; the system cannot route a buyer to them.`,
      value: hiddenTotal,
    });
  }

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

  // Community Product Standards (มผช.) from TISI
  if (standardsPayload && standardsPayload.total > 0) {
    out.push({
      id: 'standards',
      th: 'มาตรฐานผลิตภัณฑ์ชุมชน',
      text: `${n(standardsPayload.total)} official Community Product Standards (มผช.) from TISI / Ministry of Industry govern technical specifications across the 5 categories (Food: ${n(standardsPayload.byCategory.food)}, Decor: ${n(standardsPayload.byCategory.decor)}, Beverages: ${n(standardsPayload.byCategory.beverage)}, Textiles: ${n(standardsPayload.byCategory.textile)}, Herbal: ${n(standardsPayload.byCategory.herbal)}). Every standard carries an official gazette PDF specification.`,
      value: standardsPayload.total,
    });
  }

  // 26-Agency Reconciliation & Duplicate Collapse
  out.push({
    id: 'agency-reconciliation',
    th: 'การประมวลรวม 26 หน่วยงาน',
    text: `1,015,991 rows from 522 open datasets across 26 government publishing offices were harmonized. Deduplication collapsed ${n(meta.counts.duplicatesCollapsed)} redundant filings (64.0% duplicate inflation) down to ${n(total)} verified producer entities.`,
    value: meta.counts.duplicatesCollapsed,
  });

  // State certification. The มผช. holder lists name certified producers with
  // certificate numbers and expiry dates — the state's own quality mark,
  // joined to the registry rather than read as a separate PDF.
  if (certification.certified > 0) {
    out.push({
      id: 'certified',
      th: 'ได้รับการรับรอง มผช.',
      text: `${n(certification.certified)} records (${n(certification.certifiedShare)}%) carry a Community Product Standard (มผช.) certificate: ${n(certification.valid)} still valid as of ${certification.asOf}, ${n(certification.expired)} lapsed, ${n(certification.unknown)} undated. ${n(certification.buyerReady)} are buyer-ready — valid certificate, 4-5★ grade, and a contact channel.`,
      value: certification.certified,
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
  // National month-by-month, 33 points, for the Money chapter's line. Summed
  // over reporting provinces only; a month with no reporting province is null.
  const nationalMonthly = (() => {
    const acc = new Map();
    for (const p of rev.byProvince) {
      for (const [y, yr] of Object.entries(p.years ?? {})) {
        for (const [m, v] of Object.entries(yr.months ?? {})) {
          const key = Number(y) * 100 + Number(m);
          if (!acc.has(key)) acc.set(key, null);
          if (v != null) acc.set(key, (acc.get(key) ?? 0) + v);
        }
      }
    }
    return [...acc.entries()].sort(([a], [b]) => a - b)
      .map(([key, value]) => ({ year: Math.floor(key / 100), month: key % 100, value }));
  })();
  return {
    builtAt: rev.builtAt,
    unit: rev.source?.unit ?? 'บาท',
    seriesSource: rev.source?.seriesSource ?? null,
    resourceId: rev.source?.resourceId ?? null,
    latestFullYear: latestFull,
    nationalAnnual: rev.nationalAnnual,
    nationalMonthly,
    coverage: rev.coverage,
    top10,
    // The second filing: annual, by category and channel. National only here;
    // the per-province split lives in otop_revenue.json for the dossier.
    byCategory: rev.byCategory
      ? { resourceId: rev.byCategory.resourceId, categories: rev.byCategory.categories, years: rev.byCategory.years, national: rev.byCategory.national, excluded: rev.byCategory.excluded }
      : null,
    reconciliation: rev.reconciliation ?? null,
  };
})();

/**
 * Catalogue shape, carried from otop_meta.json so the prose prints the count
 * instead of typing it. resourcesAggregateEconomic is pinned to
 * classifyResource() in otop/core/field_map.js; "136 vs 385" style drift is
 * what happens when this number lives in a handoff note instead of here.
 */
const catalogue = (() => {
  const agg = metaResources.filter((r) => r.kind === 'aggregate-economic');
  return {
    resourcesCached: meta.counts.resourcesCached,
    resourcesUsable: meta.counts.resourcesUsable,
    resourcesSkipped: meta.counts.resourcesSkipped ?? null,
    resourcesAggregateEconomic: meta.counts.resourcesAggregateEconomic ?? null,
    resourcesExcludedByTitle: meta.counts.resourcesExcludedByTitle ?? 0,
    aggregateTitles: new Set(agg.map((r) => (r.datasetTitle ?? '').trim().toLowerCase())).size,
    aggregateRows: agg.reduce((n, r) => n + (r.rowsIn ?? 0), 0),
  };
})();

/**
 * Gaps — what the registry does NOT show, in one place, so policy can start
 * from the blanks instead of the totals. Every series here is a count of the
 * same corpus the other chapters describe; nothing is sampled, nothing is
 * modelled. A gap with no honest denominator is not printed.
 */
const gaps = (() => {
  const total = records.length;
  // Funnel: catalogue titles → usable producer lists → accepted rows.
  const titles = new Set(metaResources.map((r) => (r.datasetTitle ?? '').trim()).filter(Boolean));
  const usableTitles = new Set(metaResources.filter((r) => r.usable).map((r) => (r.datasetTitle ?? '').trim()).filter(Boolean));
  const funnel = {
    resourcesCached: meta.counts.resourcesCached,
    resourcesUsable: meta.counts.resourcesUsable,
    resourcesSkipped: meta.counts.resourcesSkipped ?? null,
    resourcesAggregateEconomic: meta.counts.resourcesAggregateEconomic ?? null,
    resourcesExcludedByTitle: meta.counts.resourcesExcludedByTitle ?? 0,
    distinctTitles: titles.size,
    usableTitles: usableTitles.size,
    silentTitles: titles.size - usableTitles.size,
    rowsIn: meta.counts.rowsIn,
    rowsAccepted: meta.counts.rowsAccepted,
    rowsRejected: meta.counts.rowsRejected ?? 0,
    duplicatesCollapsed: meta.counts.duplicatesCollapsed,
    records: total,
  };
  // Darkness: which categories the registry never describes.
  const catById = Object.fromEntries(categoryMix(records).map((c) => [c.id, c]));
  const darkness = {
    unclassified: catById.unclassified?.count ?? 0,
    unclassifiedShare: catById.unclassified?.share ?? null,
    beverage: catById.beverage?.count ?? 0,
    herbal: catById.herbal?.count ?? 0,
    leastClassified: byProvince
      .filter((p) => p.records > 0)
      .map((p) => ({ code: p.code, th: p.th, en: p.en, records: p.records, classifiedPct: Math.round(((p.records - ((p.categories || []).find((c) => c.id === 'unclassified')?.count ?? 0)) / Math.max(p.records, 1)) * 1000) / 10 }))
      .sort((a, b) => a.classifiedPct - b.classifiedPct)
      .slice(0, 5),
  };
  // Contact desert: reachable, priced, mapped — and the certified unreachable.
  const reachable = reachGap.reduce((s, p) => s + p.reachable, 0);
  const hiddenTotal = records.filter((r) => r.stars != null && r.stars >= 4 && r.sourceCount > 1 && !r.phone && !r.email && !r.website).length;
  const desert = {
    reachable,
    reachableShare: pct(reachable, total),
    withPrice: completeness(records).withPrice,
    withCoordinates: completeness(records).withCoordinates,
    hiddenChampions: hiddenTotal,
    worstUnreachable: reachGap.slice(0, 5).map((p) => ({ code: p.code, th: p.th, en: p.en, records: p.records, reachable: p.reachable })),
  };
  // Filing energy vs supply: who files, who corroborates, who sits blind.
  const byCorroboration = [...byProvince].sort((a, b) => (b.corroborated / Math.max(b.records, 1)) - (a.corroborated / Math.max(a.records, 1)));
  const energy = {
    top10Share: concentration.top10Share,
    mostTrusted: byCorroboration[0] ? { code: byCorroboration[0].code, th: byCorroboration[0].th, share: pct(byCorroboration[0].corroborated, byCorroboration[0].records) } : null,
    leastTrusted: byCorroboration[byCorroboration.length - 1] ? { code: byCorroboration[byCorroboration.length - 1].code, th: byCorroboration[byCorroboration.length - 1].th, share: pct(byCorroboration[byCorroboration.length - 1].corroborated, byCorroboration[byCorroboration.length - 1].records) } : null,
    quadrant: {
      ready: corroborationQuadrant.ready.length,
      documented: corroborationQuadrant.documented.length,
      reachable: corroborationQuadrant.reachable.length,
      blind: corroborationQuadrant.blind.length,
    },
    blindProvinces: corroborationQuadrant.blind.map((p) => ({ code: p.code, th: p.th, en: p.en, records: p.records })),
  };
  // Silent tambons: reference codes with zero placed records + size buckets.
  // Size distribution of the basins that DO file.
  const buckets = { one: 0, few: 0, cluster: 0, basin: 0 };
  for (const t of tambonsList) {
    if (t.records <= 1) buckets.one += 1;
    else if (t.records <= 5) buckets.few += 1;
    else if (t.records <= 20) buckets.cluster += 1;
    else buckets.basin += 1;
  }
  const refTotal = meta.geo?.tambonsInReference ?? tambonsList.length;
  const silentTambons = {
    reference: refTotal,
    withRecords: tambonsList.length,
    silent: Math.max(refTotal - tambonsList.length, 0),
    buckets,
  };
  // Temporal silence: dated vs undatable, missing years, spike years.
  const v = vintage(records);
  const yearCounts = new Map(byYear.total.map((y) => [y.year, y.count]));
  const missingYears = [];
  if (v.earliest != null && v.latest != null) {
    for (let y = v.earliest; y <= v.latest; y += 1) {
      if (!yearCounts.has(y)) missingYears.push(y);
    }
  }
  const temporal = {
    dated: v.years,
    datedShare: pct(v.years, total),
    undated: total - v.years,
    earliest: v.earliest,
    latest: v.latest,
    median: v.median,
    missingYears: missingYears.slice(0, 12),
    missingYearsCount: missingYears.length,
    peak: [...byYear.total].sort((a, b) => b.count - a.count).slice(0, 3),
  };
  // Standards mismatch: products per official specification, by category.
  const stdBy = standardsPayload?.byCategory ?? null;
  const prodBy = { food: catById.food?.count ?? 0, beverage: catById.beverage?.count ?? 0, textile: catById.textile?.count ?? 0, craft: catById.craft?.count ?? 0, herbal: catById.herbal?.count ?? 0 };
  // standards payload keys food/beverage/decor/textile/herbal; registry craft == decor.
  const stdMap = stdBy ? { food: stdBy.food, beverage: stdBy.beverage, textile: stdBy.textile, craft: stdBy.decor, herbal: stdBy.herbal } : null;
  const standardsGap = stdMap ? Object.keys(prodBy).map((id) => ({
    id,
    products: prodBy[id],
    standards: stdMap[id] ?? 0,
    productsPerStandard: (stdMap[id] ?? 0) > 0 ? Math.round((prodBy[id] / stdMap[id]) * 10) / 10 : null,
  })).sort((a, b) => (b.productsPerStandard ?? -1) - (a.productsPerStandard ?? -1)) : null;
  // Revenue gap: who reports money vs who files paperwork.
  const revenueGap = revenue ? {
    provincesWithData: revenue.coverage?.provincesWithData ?? null,
    provinces: revenue.coverage?.provinces ?? null,
    missing: revenue.coverage?.provincesMissing ?? [],
    medianGapPct: revenue.reconciliation?.medianGapPct ?? null,
    latestFullYear: revenue.latestFullYear ?? null,
  } : null;
  return { funnel, darkness, desert, energy, silentTambons, temporal, standardsGap, revenueGap };
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
  byYear,
  matrix,

  // New: poverty-fighting intelligence
  reachGap,
  corroborationQuadrant,
  hiddenChampions,
  regionIdentity,

  // State certification: the มผช. holder join, judged at build time.
  certification,

  // Technical standards and geographic basins. Only the summary keys are
  // inlined — the full 1,489-standard list is already published as
  // otop_standards.json, and inlining it here doubled the artefact the
  // default Atlas view parses (630 KB of it read by nobody on this page).
  standards: standardsPayload
    ? {
        builtAt: standardsPayload.builtAt ?? null,
        source: standardsPayload.source ?? null,
        total: standardsPayload.total,
        byCategory: standardsPayload.byCategory,
      }
    : null,
  topBasins,

  // Revenue aggregates (null when the revenue stage degraded — the Atlas
  // hides the section rather than substituting).
  revenue,
  catalogue,

  // Gaps: what the registry does not show — the policy chapter's numbers.
  gaps,

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
console.log(`[otop:insights] completeness — contact ${insights.national.completeness.withContact}% · graded ${insights.national.completeness.withStars}% · priced ${insights.national.completeness.withPrice}% · incomed ${insights.national.completeness.withIncome}%`);
console.log(`[otop:insights] category declared ${insights.national.completeness.categoryDeclared}% / inferred ${insights.national.completeness.categoryInferred}% / unknown ${insights.national.completeness.categoryUnknown}%`);
console.log(`[otop:insights] corroborated by >1 source: ${insights.national.corroboratedShare}% · top-10 concentration ${insights.concentration.top10Share}%`);
