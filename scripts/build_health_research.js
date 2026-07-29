#!/usr/bin/env node
/**
 * Aggregate data.go.th health/legitimacy sources → public/data/health/*.json
 *
 * Sources:
 *   sasuk01        — Roi Et STI key-pop screening (uptake, not incidence)
 *   03_1201        — Excise tax on bath/massage establishments (TIS-620)
 *   ttamc_op_12_02 — MoPH traditional-medicine massage visits
 *   hss_11_49      — HSS certified นวด สปา providers (aggregate only — no PII)
 *
 * Usage: node scripts/build_health_research.js
 * Caches CSVs under .firecrawl/health/raw/ when network is available.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, '.firecrawl/health/raw');
const OUT = path.join(ROOT, 'public/data/health');

/** Minimal RFC4180-ish CSV → objects. */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => {
    if (row.length === 1 && row[0] === '' && rows.length === 0) { row = []; return; }
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') pushField();
    else if (c === '\n') { pushField(); pushRow(); }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
    return obj;
  });
}

const SOURCES = {
  sasuk01: {
    url: 'https://roiet.gdcatalog.go.th/dataset/4e42d133-2212-4462-8d1b-16f29c5ceb5f/resource/f913e550-d19f-4143-95e5-2ae693c0837c/download/untitled.c',
    file: 'sasuk01.csv',
    encoding: 'utf8',
  },
  excise: {
    url: 'https://catalog.excise.go.th/base/catalog/excise/file/03_1201.csv',
    file: '03_1201.csv',
    encoding: 'tis-620',
  },
  ttamc: {
    url: 'https://gdc.dtam.moph.go.th/dataset/de6e3725-d9ed-4117-a488-86cc3f34ee14/resource/022f2073-a5c9-4ab8-b887-9a24d7e8cab1/download/untitled.csv',
    file: 'ttamc_op_12_02.csv',
    encoding: 'utf8',
  },
  hss: {
    url: 'https://hss.gdcatalog.go.th/dataset/a3f0546b-f522-4780-a3c4-c97c103d3b1b/resource/31390f86-9043-4b2c-9035-ce9ee8b78540/download/.csv',
    file: 'hss_11_49.csv',
    encoding: 'utf8',
  },
};

/** Thai province name → English (matches province-hiv.json). */
const TH_TO_EN = {
  กรุงเทพมหานคร: 'Bangkok',
  กรุงเทพ: 'Bangkok',
  กระบี่: 'Krabi',
  กาญจนบุรี: 'Kanchanaburi',
  กาฬสินธุ์: 'Kalasin',
  กำแพงเพชร: 'Kamphaeng Phet',
  ขอนแก่น: 'Khon Kaen',
  จันทบุรี: 'Chanthaburi',
  ฉะเชิงเทรา: 'Chachoengsao',
  ชลบุรี: 'Chonburi',
  ชัยนาท: 'Chai Nat',
  ชัยภูมิ: 'Chaiyaphum',
  ชุมพร: 'Chumphon',
  เชียงราย: 'Chiang Rai',
  เชียงใหม่: 'Chiang Mai',
  ตรัง: 'Trang',
  ตราด: 'Trat',
  ตาก: 'Tak',
  นครนายก: 'Nakhon Nayok',
  นครปฐม: 'Nakhon Pathom',
  นครพนม: 'Nakhon Phanom',
  นครราชสีมา: 'Nakhon Ratchasima',
  นครศรีธรรมราช: 'Nakhon Si Thammarat',
  นครสวรรค์: 'Nakhon Sawan',
  นนทบุรี: 'Nonthaburi',
  นราธิวาส: 'Narathiwat',
  น่าน: 'Nan',
  บึงกาฬ: 'Bueng Kan',
  บุรีรัมย์: 'Buriram',
  ปทุมธานี: 'Pathum Thani',
  ประจวบคีรีขันธ์: 'Prachuap Khiri Khan',
  ปราจีนบุรี: 'Prachinburi',
  ปัตตานี: 'Pattani',
  พระนครศรีอยุธยา: 'Phra Nakhon Si Ayutthaya',
  พังงา: 'Phang Nga',
  พัทลุง: 'Phatthalung',
  พิจิตร: 'Phichit',
  พิษณุโลก: 'Phitsanulok',
  เพชรบุรี: 'Phetchaburi',
  เพชรบูรณ์: 'Phetchabun',
  แพร่: 'Phrae',
  พะเยา: 'Phayao',
  ภูเก็ต: 'Phuket',
  มหาสารคาม: 'Maha Sarakham',
  มุกดาหาร: 'Mukdahan',
  แม่ฮ่องสอน: 'Mae Hong Son',
  ยะลา: 'Yala',
  ยโสธร: 'Yasothon',
  ร้อยเอ็ด: 'Roi Et',
  ระนอง: 'Ranong',
  ระยอง: 'Rayong',
  ราชบุรี: 'Ratchaburi',
  ลพบุรี: 'Lopburi',
  ลำปาง: 'Lampang',
  ลำพูน: 'Lamphun',
  เลย: 'Loei',
  ศรีสะเกษ: 'Si Sa Ket',
  สกลนคร: 'Sakon Nakhon',
  สงขลา: 'Songkhla',
  สตูล: 'Satun',
  สมุทรปราการ: 'Samut Prakan',
  สมุทรสงคราม: 'Samut Songkhram',
  สมุทรสาคร: 'Samut Sakhon',
  สระแก้ว: 'Sa Kaeo',
  สระบุรี: 'Saraburi',
  สิงห์บุรี: 'Sing Buri',
  สุโขทัย: 'Sukhothai',
  สุพรรณบุรี: 'Suphan Buri',
  สุราษฎร์ธานี: 'Surat Thani',
  สุรินทร์: 'Surin',
  หนองคาย: 'Nong Khai',
  หนองบัวลำภู: 'Nong Bua Lamphu',
  อ่างทอง: 'Ang Thong',
  อำนาจเจริญ: 'Amnat Charoen',
  อุดรธานี: 'Udon Thani',
  อุตรดิตถ์: 'Uttaradit',
  อุทัยธานี: 'Uthai Thani',
  อุบลราชธานี: 'Ubon Ratchathani',
};

const CATEGORY_EN = {
  ชายที่มีเพศสัมพันธ์กับชาย: 'msm',
  ผู้หญิงข้ามเพศ: 'transgender_women',
  พนักงานบริการทางเพศชาย: 'sex_worker_male',
  พนักงานบริการทางเพศหญิง: 'sex_worker_female',
  พนักงานบริการทางเพศข้ามเพศ: 'sex_worker_transgender',
  ผู้ใช้ยาเสพติดด้วยวิธีฉีด: 'pwid',
};

function classifyExciseProduct(name) {
  const n = String(name || '').trim();
  if (n.includes('โรงพยาบาล') || n.includes('สถานพยาบาล')) return 'hospital';
  if (n.includes('สถานอาบน้ำ') || n === 'สถานอาบน้ำ อบตัวและนวด') return 'establishment';
  if (n.includes('ผู้ให้บริการ')) return 'service_provider_revenue';
  if (n.includes('เสริมความงาม') || n.includes('สุขภาพ')) return 'beauty_wellness_venue';
  return 'other';
}

async function ensureRaw(key) {
  const spec = SOURCES[key];
  const dest = path.join(RAW, spec.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
    console.log(`  cache hit ${spec.file}`);
    return dest;
  }
  fs.mkdirSync(RAW, { recursive: true });
  console.log(`  fetching ${key}…`);
  const res = await fetch(spec.url);
  if (!res.ok) throw new Error(`Fetch failed ${key}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

function readCsv(filePath, encoding) {
  const buf = fs.readFileSync(filePath);
  let decoded;
  if (encoding === 'tis-620') {
    decoded = new TextDecoder('windows-874').decode(buf);
  } else {
    decoded = buf.toString('utf8').replace(/^\uFEFF/, '');
  }
  return parseCsv(decoded);
}

function loadHivCoords() {
  const hivPath = path.join(OUT, 'province-hiv.json');
  const hiv = JSON.parse(fs.readFileSync(hivPath, 'utf8'));
  const byName = new Map();
  const byCode = new Map();
  for (const row of hiv.provinces || []) {
    byName.set(row.name, row);
    byCode.set(String(row.code).padStart(2, '0'), row);
    byCode.set(String(Number(row.code)), row);
  }
  return { byName, byCode, hiv };
}

function toEnProvince(thaiOrEn, provinceId, coords) {
  const raw = String(thaiOrEn || '').trim();
  if (TH_TO_EN[raw]) return TH_TO_EN[raw];
  if (coords.byName.has(raw)) return raw;
  const code = String(provinceId || '').padStart(2, '0');
  const hit = coords.byCode.get(code) || coords.byCode.get(String(Number(provinceId)));
  if (hit) return hit.name;
  return raw;
}

function buildSasuk(rows) {
  const byYear = {};
  for (const row of rows) {
    const year = Number(row['ปี'] || row.year);
    const catTh = String(row['ประเภท'] || '').trim();
    const cat = CATEGORY_EN[catTh] || catTh;
    const value = Number(String(row['ค่า'] || '0').replace(/,/g, '')) || 0;
    if (!year) continue;
    if (!byYear[year]) byYear[year] = {};
    byYear[year][cat] = value;
    byYear[year][`${cat}_th`] = catTh;
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const latest = years[years.length - 1];
  const latestRow = byYear[latest] || {};
  const sexWorkerLatest =
    (latestRow.sex_worker_male || 0)
    + (latestRow.sex_worker_female || 0)
    + (latestRow.sex_worker_transgender || 0);

  return {
    source: {
      package: 'sasuk01',
      url: 'https://data.go.th/dataset/sasuk01',
      publisher: 'สำนักงานจังหวัดร้อยเอ็ด',
      scope: 'Roi Et province only',
      note: 'Key-population STI screening service counts — uptake, not incidence or prevalence.',
    },
    unit: 'persons screened',
    yearsBuddhist: years,
    series: years.map((y) => ({
      yearBuddhist: y,
      yearGregorian: y - 543,
      msm: byYear[y].msm || 0,
      transgenderWomen: byYear[y].transgender_women || 0,
      sexWorkerMale: byYear[y].sex_worker_male || 0,
      sexWorkerFemale: byYear[y].sex_worker_female || 0,
      sexWorkerTransgender: byYear[y].sex_worker_transgender || 0,
      pwid: byYear[y].pwid || 0,
      sexWorkerTotal:
        (byYear[y].sex_worker_male || 0)
        + (byYear[y].sex_worker_female || 0)
        + (byYear[y].sex_worker_transgender || 0),
    })),
    latest: {
      yearBuddhist: latest,
      yearGregorian: latest - 543,
      sexWorkerTotal: sexWorkerLatest,
      msm: latestRow.msm || 0,
      transgenderWomen: latestRow.transgender_women || 0,
    },
  };
}

function buildExcise(rows) {
  const byYear = {};
  const byYearProduct = {};
  for (const row of rows) {
    const year = String(row.BUDGET_YEAR || '').trim();
    const amt = Number(String(row.TAX_NETTAX_AMT || '0').replace(/,/g, '').trim()) || 0;
    const product = String(row.PRODUCT_NAME || '').trim();
    const bucket = classifyExciseProduct(product);
    if (!year) continue;
    byYear[year] = (byYear[year] || 0) + amt;
    if (!byYearProduct[year]) byYearProduct[year] = {};
    byYearProduct[year][bucket] = (byYearProduct[year][bucket] || 0) + amt;
  }
  const years = Object.keys(byYear).sort();
  const series = years.map((y) => ({
    yearBuddhist: Number(y),
    yearGregorian: Number(y) - 543,
    taxNetBaht: Math.round(byYear[y]),
    byLine: Object.fromEntries(
      Object.entries(byYearProduct[y] || {}).map(([k, v]) => [k, Math.round(v)]),
    ),
  }));
  const latest = series[series.length - 1];
  return {
    source: {
      package: '03_1201',
      url: 'https://data.go.th/dataset/03_1201',
      publisher: 'กรมสรรพสามิต',
      note: 'National excise tax collection on bath / body steam / massage establishments and related service revenue. Proxy for the tax-paying licensed sector — not a count of Telegram venues.',
    },
    series,
    latest,
  };
}

function buildHss(rows, coords) {
  const MASSAGE = 'นวด สปา';
  const byProvince = new Map();
  let national = 0;
  let female = 0;
  let male = 0;

  for (const row of rows) {
    if (String(row.ServiceType || '').trim() !== MASSAGE) continue;
    national += 1;
    const g = String(row.Gender || '').toUpperCase();
    if (g === 'F') female += 1;
    else if (g === 'M') male += 1;

    const en = toEnProvince(row.Province, row.ProvinceID, coords);
    if (!byProvince.has(en)) {
      const hiv = coords.byName.get(en);
      byProvince.set(en, {
        name: en,
        code: hiv?.code || String(row.ProvinceID || '').padStart(2, '0'),
        lat: hiv?.lat ?? null,
        lng: hiv?.lng ?? null,
        certifiedProviders: 0,
        byGender: { F: 0, M: 0 },
        byCertificateYear: {},
      });
    }
    const entry = byProvince.get(en);
    entry.certifiedProviders += 1;
    if (g === 'F' || g === 'M') entry.byGender[g] += 1;
    const cy = String(row.CertificateYear || '').trim();
    if (cy) entry.byCertificateYear[cy] = (entry.byCertificateYear[cy] || 0) + 1;
  }

  const provinces = [...byProvince.values()].sort(
    (a, b) => b.certifiedProviders - a.certifiedProviders,
  );

  return {
    source: {
      package: 'hss_11_49',
      url: 'https://data.go.th/dataset/hss_11_49',
      publisher: 'กรมสนับสนุนบริการสุขภาพ',
      note: 'Registered providers in certified health establishments (นวด สปา only). Aggregated by province — certificate codes and birth years are not published.',
      serviceTypeFilter: MASSAGE,
    },
    nationalTotal: national,
    byGender: { F: female, M: male },
    provinceCount: provinces.length,
    provinces,
  };
}

function buildTtamc(rows, coords) {
  const massageKw = ['นวด', 'อบ', 'ประคบ'];
  const excludeKw = ['บ่งต้อ'];
  const years = [...new Set(rows.map((r) => String(r['ปี'] || '').trim()).filter(Boolean))]
    .map(Number)
    .filter((y) => y >= 2012 && y <= 2030)
    .sort((a, b) => a - b);

  // Prefer latest year that has broad coverage; skip incomplete current year if thin
  let chosen = years[years.length - 1];
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const y = years[i];
    const provs = new Set();
    let total = 0;
    for (const row of rows) {
      if (Number(row['ปี']) !== y) continue;
      const svc = String(row['บริการ'] || '');
      if (excludeKw.some((k) => svc.includes(k))) continue;
      if (!massageKw.some((k) => svc.includes(k))) continue;
      provs.add(row['จังหวัด']);
      total += Number(row['จำนวนครั้ง'] || 0) || 0;
    }
    if (provs.size >= 8 && total > 1000) {
      chosen = y;
      break;
    }
  }

  const byProv = new Map();
  for (const row of rows) {
    if (Number(row['ปี']) !== chosen) continue;
    const svc = String(row['บริการ'] || '');
    if (excludeKw.some((k) => svc.includes(k))) continue;
    if (!massageKw.some((k) => svc.includes(k))) continue;
    const en = toEnProvince(row['จังหวัด'], null, coords);
    byProv.set(en, (byProv.get(en) || 0) + (Number(row['จำนวนครั้ง'] || 0) || 0));
  }

  const provinces = [...byProv.entries()]
    .map(([name, visits]) => {
      const hiv = coords.byName.get(name);
      return {
        name,
        code: hiv?.code || null,
        lat: hiv?.lat ?? null,
        lng: hiv?.lng ?? null,
        visits,
      };
    })
    .sort((a, b) => b.visits - a.visits);

  return {
    source: {
      package: 'ttamc_op_12_02',
      url: 'https://data.go.th/dataset/ttamc_op_12_02',
      publisher: 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
      note: 'Patient visit counts for massage / herbal steam / compress in MoPH traditional-medicine clinics. Therapeutic public-system volume — not Telegram parlour inventory.',
    },
    yearGregorian: chosen,
    nationalTotal: provinces.reduce((s, p) => s + p.visits, 0),
    provinceCount: provinces.length,
    provinces,
  };
}

async function main() {
  console.log('build_health_research');
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });

  const coords = loadHivCoords();

  const paths = {};
  for (const key of Object.keys(SOURCES)) {
    paths[key] = await ensureRaw(key);
  }

  const sasukRows = readCsv(paths.sasuk01, 'utf8');
  const exciseRows = readCsv(paths.excise, 'tis-620');
  const ttamcRows = readCsv(paths.ttamc, 'utf8');
  const hssRows = readCsv(paths.hss, 'utf8');

  const sti = buildSasuk(sasukRows);
  const hss = buildHss(hssRows, coords);
  const excise = buildExcise(exciseRows);
  const ttamc = buildTtamc(ttamcRows, coords);

  const formalization = {
    generatedAt: new Date().toISOString(),
    source: {
      hss: hss.source,
      excise: excise.source,
      caveat: 'Formalization gap joins inventory venue density to HSS certified counts. It is not a legality verdict for any shop, worker, or listing.',
    },
    hss: {
      nationalTotal: hss.nationalTotal,
      byGender: hss.byGender,
      provinceCount: hss.provinceCount,
    },
    excise,
    provinces: hss.provinces.map((p) => ({
      name: p.name,
      code: p.code,
      lat: p.lat,
      lng: p.lng,
      certifiedProviders: p.certifiedProviders,
      byGender: p.byGender,
    })),
  };

  const write = (name, data) => {
    const dest = path.join(OUT, name);
    fs.writeFileSync(dest, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`  wrote ${path.relative(ROOT, dest)}`);
  };

  write('sti-screening-roiet.json', sti);
  write('therapeutic-massage.json', ttamc);
  write('formalization.json', formalization);

  console.log('done', {
    hssProviders: hss.nationalTotal,
    exciseYears: excise.series.length,
    stiYears: sti.series.length,
    ttamcYear: ttamc.yearGregorian,
    ttamcVisits: ttamc.nationalTotal,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
