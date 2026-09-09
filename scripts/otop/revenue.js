#!/usr/bin/env node
/**
 * Stage 2.5 — province revenue layer.
 *
 * The producer pipeline (build.js) only ingests per-producer rows — name +
 * area — so every aggregate-economic dataset on data.go.th is structurally
 * invisible to it. The richest of those is the Department of Community
 * Development's monthly OTOP sales series, filed here by the Chaiyaphum
 * provincial office: 2,541 rows = 77 provinces × 33 months (BE 2565 full,
 * 2566 full, 2567 Jan–Sep), values in baht, one source.
 *
 * This stage joins that series to province codes and publishes
 * otop/public/otop_revenue.json. It is deliberately NOT merged into producer
 * records: provincial aggregates cannot be divided down to producers, and
 * dividing them by registry row counts would launder filing energy into
 * productivity. The Atlas states that refusal in prose.
 *
 * Join discipline: every province name in the series must resolve to a
 * PROVINCES code or the build fails. A silent drop would corrupt every
 * total; a loud failure names the variant.
 *
 * Second table (added 2026-09-10): the same department's ANNUAL series split
 * by product category and by offline/online channel — 77 provinces × BE
 * 2565–2567 × 5 categories, resource 000017df-…. It does NOT reconcile with
 * the monthly series: for most province-years the two totals differ by
 * 10–50%. They are two filings from one department, so both are published
 * under their own resource id, never summed, and the disagreement is measured
 * (`reconciliation`) and stated on the page. A near-duplicate of this table
 * exists as resource 831a5e76-b6a7-4cc4-a6e7-180440d3c475 with totals ~30×
 * smaller — a different measure, left out on purpose.
 *
 * Reads  otop/data/raw/c1c39e6a-c6ab-4d31-a911-44517db7f2eb.json  (monthly)
 *        otop/data/raw/000017df-6ebc-4e8f-afcc-500708549a71.json  (category)
 * Writes otop/public/otop_revenue.json (or a degraded artefact if the monthly
 *         raw file is absent, so a fetch gap degrades the revenue section
 *         instead of breaking the build)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVINCES } from '../../otop/core/provinces.js';
import { CATEGORIES } from '../../otop/core/taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW = path.join(
  ROOT,
  'otop/data/raw/c1c39e6a-c6ab-4d31-a911-44517db7f2eb.json',
);
const OUT = path.join(ROOT, 'otop/public/otop_revenue.json');

const REVENUE_RESOURCE_ID = 'c1c39e6a-c6ab-4d31-a911-44517db7f2eb';
const CATEGORY_RESOURCE_ID = '000017df-6ebc-4e8f-afcc-500708549a71';
const RAW_CATEGORY = path.join(ROOT, 'otop/data/raw', `${CATEGORY_RESOURCE_ID}.json`);

/** The category table's own labels → taxonomy ids. Anything else fails the build. */
const CATEGORY_LABELS = {
  'อาหาร': 'food',
  'เครื่องดื่ม': 'beverage',
  'ผ้าและเครื่องแต่งกาย': 'textile',
  'เครื่องใช้และเครื่องประดับตกแต่ง': 'craft',
  'สมุนไพรที่ไม่ใช่อาหารและยา': 'herbal',
};

const THAI_MONTHS = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
};

const byThaiName = new Map(PROVINCES.map((p) => [p.th, p]));

function degrade(reason) {
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      { builtAt: new Date().toISOString(), degraded: true, reason, byProvince: [], national: null },
      null,
      2,
    ),
  );
  console.log(`[otop:revenue] degraded — ${reason}`);
}

if (!fs.existsSync(RAW)) {
  degrade(`raw revenue file ${REVENUE_RESOURCE_ID}.json not cached; run npm run otop:fetch first`);
  process.exit(0);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
} catch (e) {
  degrade(`corrupt JSON in ${REVENUE_RESOURCE_ID}.json: ${e.message}`);
  process.exit(0);
}
const rows = raw.rows ?? [];
if (rows.length === 0) {
  degrade('raw revenue file cached but holds zero rows');
  process.exit(0);
}

// The join. Fail loudly on any unresolvable name.
const unmapped = [...new Set(rows.map((r) => r.Province))].filter((name) => !byThaiName.has(name));
if (unmapped.length > 0) {
  console.error(
    `[otop:revenue] ${unmapped.length} province name(s) do not resolve to PROVINCES: ${unmapped.join(', ')}. ` +
      'Refusing to publish partial totals.',
  );
  process.exit(1);
}

const months = {};
for (const [th, n] of Object.entries(THAI_MONTHS)) months[th] = n;

const perProvince = new Map(); // code -> { monthly: Map<ceYear*100+month, value|null> }
for (const r of rows) {
  const p = byThaiName.get(r.Province);
  const ceYear = Number(r.Year) - 543; // Buddhist Era → CE
  const month = months[r.Month];
  if (!Number.isInteger(ceYear) || ceYear < 2000 || ceYear > 2100 || !month) {
    console.error(`[otop:revenue] unparseable year/month: ${JSON.stringify({ Year: r.Year, Month: r.Month })}. Refusing to guess.`);
    process.exit(1);
  }
  if (!perProvince.has(p.code)) perProvince.set(p.code, { province: p, monthly: new Map() });
  const key = ceYear * 100 + month;
  if (perProvince.get(p.code).monthly.has(key)) {
    console.error(`[otop:revenue] duplicate month ${ceYear}-${month} for ${p.th}. Refusing to double-count.`);
    process.exit(1);
  }
  const value = r.Value == null || r.Value === '' ? null : Number(r.Value);
  if (value != null && (!Number.isFinite(value) || value < 0)) {
    console.error(`[otop:revenue] non-numeric/negative value for ${p.th} ${ceYear}-${month}: ${JSON.stringify(r.Value)}.`);
    process.exit(1);
  }
  perProvince.get(p.code).monthly.set(key, value);
}

const yearOf = (key) => Math.floor(key / 100);

const byProvince = [...perProvince.values()]
  .map(({ province, monthly }) => {
    const years = {};
    for (const [key, value] of monthly) {
      const y = yearOf(key);
      years[y] = years[y] || { months: {}, total: 0, monthsReported: 0, monthsHeld: 0 };
      years[y].months[key % 100] = value;
      years[y].monthsHeld += 1;
      if (value != null) {
        years[y].total += value;
        years[y].monthsReported += 1;
      }
    }
    const withData = Object.values(years).some((y) => y.monthsReported > 0);
    return {
      code: province.code,
      th: province.th,
      en: province.en,
      region: province.region,
      years,
      hasData: withData,
    };
  })
  .sort((a, b) => a.code - b.code);

// National series: month-by-month across reporting provinces.
const nationalMonthly = new Map();
for (const { monthly } of perProvince.values()) {
  for (const [key, value] of monthly) {
    if (value == null) continue;
    nationalMonthly.set(key, (nationalMonthly.get(key) ?? 0) + value);
  }
}
const nationalAnnual = {};
for (const [key, value] of nationalMonthly) {
  const y = yearOf(key);
  nationalAnnual[y] = nationalAnnual[y] || { total: 0, months: 0 };
  nationalAnnual[y].total += value;
  nationalAnnual[y].months += 1;
}

const missing = byProvince.filter((p) => !p.hasData).map((p) => p.th);
const fullYears = Object.entries(nationalAnnual)
  .filter(([, a]) => a.months === 12)
  .map(([y]) => Number(y))
  .sort();

/**
 * Category × channel table. Optional: absent file → `byCategory: null` and the
 * page hides that chart, same rule as the monthly series.
 */
function parseCategoryTable() {
  if (!fs.existsSync(RAW_CATEGORY)) return null;
  const catRows = JSON.parse(fs.readFileSync(RAW_CATEGORY, 'utf8')).rows ?? [];
  if (catRows.length === 0) return null;

  const badProv = [...new Set(catRows.map((r) => r.Province))].filter((x) => !byThaiName.has(x));
  const badCat = [...new Set(catRows.map((r) => r.List))].filter((x) => !(x in CATEGORY_LABELS));
  if (badProv.length || badCat.length) {
    console.error(`[otop:revenue] category table: unresolved province ${JSON.stringify(badProv)} / category ${JSON.stringify(badCat)}. Refusing to guess.`);
    process.exit(1);
  }
  const num = (v) => {
    if (v == null || v === '') return 0;
    const x = Number(v);
    if (!Number.isFinite(x) || x < 0) { console.error(`[otop:revenue] category table: bad value ${JSON.stringify(v)}`); process.exit(1); }
    return x;
  };

  // The source carries two duplicate keys (2026-09-09 vintage): Bangkok
  // 2567 beverage twice with identical zeros, and Nakhon Nayok 2566 herbal
  // twice with DIFFERENT values while that year's food and beverage rows are
  // one short — a mislabelled row. An identical duplicate collapses; a
  // conflicting one cannot be resolved without guessing which label is
  // wrong, so that whole province-year is excluded and named in the output.
  const seen = new Map();
  const excluded = new Set();
  const cells = [];
  for (const r of catRows) {
    const p = byThaiName.get(r.Province);
    const year = Number(r.Year) - 543;
    const cat = CATEGORY_LABELS[r.List];
    const offline = num(r['Value (offline)']);
    const online = num(r['Value (online)'] ?? r['Value (Online)']);
    const key = `${p.code}:${year}:${cat}`;
    const prior = seen.get(key);
    if (prior) {
      if (prior.offline === offline && prior.online === online) continue;
      excluded.add(`${p.code}:${year}`);
      console.warn(`[otop:revenue] category table: conflicting duplicate ${p.th} ${year} ${cat} — excluding that province-year`);
      continue;
    }
    seen.set(key, { offline, online });
    cells.push({ p, year, cat, offline, online });
  }

  // provinces[code][year] = { food: {offline, online}, ... }
  const provinces = new Map();
  const national = {}; // year -> { categories: {id: {offline, online}}, offline, online, total }
  for (const { p, year, cat, offline, online } of cells) {
    if (excluded.has(`${p.code}:${year}`)) continue;
    if (!provinces.has(p.code)) provinces.set(p.code, {});
    const py = (provinces.get(p.code)[year] ??= { categories: {}, offline: 0, online: 0, total: 0 });
    py.categories[cat] = { offline, online, total: offline + online };
    py.offline += offline; py.online += online; py.total += offline + online;
    const ny = (national[year] ??= { categories: {}, offline: 0, online: 0, total: 0 });
    const nc = (ny.categories[cat] ??= { offline: 0, online: 0, total: 0 });
    nc.offline += offline; nc.online += online; nc.total += offline + online;
    ny.offline += offline; ny.online += online; ny.total += offline + online;
  }
  return {
    resourceId: CATEGORY_RESOURCE_ID,
    categories: CATEGORIES.map((c) => ({ id: c.id, th: c.th, en: c.en })),
    years: Object.keys(national).map(Number).sort(),
    national,
    provinces: Object.fromEntries(provinces),
    excluded: [...excluded].map((k) => { const [code, year] = k.split(':').map(Number); return { code, year, th: PROVINCES.find((x) => x.code === code)?.th, reason: 'conflicting duplicate row in source' }; }),
  };
}

const byCategory = parseCategoryTable();

/**
 * Do the two filings agree? Compared only where both hold a full year. A gap
 * under 1% is "matching". This is published as a finding, not hidden — the
 * reader is owed the fact that one department's two tables disagree.
 */
const reconciliation = (() => {
  if (!byCategory) return null;
  const gaps = [];
  for (const p of byProvince) {
    for (const [y, yr] of Object.entries(p.years)) {
      if (yr.monthsReported < 12) continue;
      const annual = byCategory.provinces[p.code]?.[y]?.total;
      if (annual == null || (annual === 0 && yr.total === 0)) continue;
      gaps.push(Math.abs(annual - yr.total) / Math.max(annual, yr.total));
    }
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  return {
    comparedProvinceYears: gaps.length,
    matching: gaps.filter((g) => g < 0.01).length,
    mismatching: gaps.filter((g) => g >= 0.01).length,
    medianGapPct: median == null ? null : Math.round(median * 1000) / 10,
    note: 'Monthly series (c1c39e6a) summed per full year vs the annual category table (000017df), same department. Neither is corrected toward the other.',
  };
})();

const out = {
  builtAt: new Date().toISOString(),
  degraded: false,
  reason: null,
  source: {
    resourceId: REVENUE_RESOURCE_ID,
    datasetTitle: raw.datasetTitle ?? 'ยอดจำหน่ายสินค้า OTOP',
    organization: raw.organization ?? null,
    seriesSource: 'กรมพัฒนาชุมชน',
    unit: 'บาท',
  },
  coverage: {
    provinces: perProvince.size,
    provincesWithData: perProvince.size - missing.length,
    provincesMissing: missing,
    monthsPerProvince: 33,
    fullYears,
    note: 'BE 2565 and 2566 are full years; BE 2567 (2024) covers January–September only. Bangkok reports no values in any month.',
  },
  nationalAnnual,
  byProvince,
  byCategory,
  reconciliation,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const latest = Object.keys(nationalAnnual).length
  ? Math.max(...Object.keys(nationalAnnual).map(Number))
  : null;
console.log(
  `[otop:revenue] ${out.coverage.provincesWithData}/${out.coverage.provinces} provinces with data · ` +
    Object.entries(nationalAnnual)
      .map(([y, a]) => `${y}: ${(a.total / 1e9).toFixed(2)}B baht over ${a.months}mo`)
      .join(' · ') +
    (latest != null ? ` · latest month key ${latest}` : ''),
);
