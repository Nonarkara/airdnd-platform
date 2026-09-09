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
 * Reads  otop/data/raw/c1c39e6a-c6ab-4d31-a911-44517db7f2eb.json
 * Writes otop/public/otop_revenue.json (or a degraded artefact if the raw
 *         file is absent, so a fetch gap degrades the revenue section
 *         instead of breaking the build)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVINCES } from '../../otop/core/provinces.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW = path.join(
  ROOT,
  'otop/data/raw/c1c39e6a-c6ab-4d31-a911-44517db7f2eb.json',
);
const OUT = path.join(ROOT, 'otop/public/otop_revenue.json');

const REVENUE_RESOURCE_ID = 'c1c39e6a-c6ab-4d31-a911-44517db7f2eb';

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

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
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
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const latest = Math.max(...Object.keys(nationalAnnual).map(Number));
console.log(
  `[otop:revenue] ${out.coverage.provincesWithData}/${out.coverage.provinces} provinces with data · ` +
    Object.entries(nationalAnnual)
      .map(([y, a]) => `${y}: ${(a.total / 1e9).toFixed(2)}B baht over ${a.months}mo`)
      .join(' · ') +
    ` · latest month key ${latest}`,
);
