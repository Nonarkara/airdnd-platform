#!/usr/bin/env node
/*
 * Sabai Sabai — HIV/STI service-delivery dataset.
 *
 * The existing province-hiv.json answers "where are new cases entering care?"
 * (BE 2566 / 2023, the newest year MoPH publishes for that series). It says
 * nothing about *services*, which is the question a social worker actually
 * has: where can someone get tested, treated, or referred, and which
 * provinces are thin on the ground relative to the venue population.
 *
 * This script builds that second layer from five BE 2568 (2025) open datasets
 * and writes public/data/health/hiv-services.json.
 *
 *   s_tuc_sent2      LABFU-HIV lab results — Anti-HIV tested + positive (by facility)
 *   s_harm6          STI screening / diagnosis / treatment (by facility)
 *   s_harm5          Correct-condom-use support (by facility)
 *   s_harm3          Voluntary counselling + testing, and ARV referral (by facility)
 *   gdpublish-das-01 Registry of volunteers + civil-society orgs doing HIV work
 *
 * The first four carry `areacode` — a Ministry of Interior area code whose
 * first two digits are the province code, the same code space as
 * province-hiv.json. That is what makes the join possible without geocoding.
 *
 * Honesty rules baked in (CLAUDE.md §16.1 Law 3):
 *  - Facility counts are DISTINCT hospcode values that filed a report, not a
 *    census of every facility that offers the service. A facility that never
 *    reported is invisible here; that is undercount, never zero demand.
 *  - Positivity is positives / tested among people whose lab result was
 *    recorded. It is a yield measure for testing programmes, NOT prevalence
 *    and NOT an infection rate for the province.
 *  - Provinces with no row are reported as null (no report filed), never 0.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data', 'health', 'hiv-services.json');
const CACHE = path.join(ROOT, '.hiv_source_cache');

const SOURCES = {
  lab: {
    id: 's_tuc_sent2',
    label: 'LABFU-HIV — laboratory results',
    labelTh: 'ข้อมูลการตรวจทางห้องปฏิบัติการ (LABFU-HIV)',
    url: 'https://data.go.th/dataset/35000b8e-7753-43a7-87eb-928d3e8f11d5/resource/28b64a48-ae51-4685-bccd-aaff5b59d613/download/_labfu-hiv_2568.csv',
    page: 'https://data.go.th/dataset/s_tuc_sent2',
  },
  sti: {
    id: 's_harm6',
    label: 'STI screening, diagnosis and treatment',
    labelTh: 'การคัดกรอง ตรวจวินิจฉัย และ/หรือ รักษาโรคติดต่อทางเพศสัมพันธ์',
    url: 'https://data.go.th/dataset/6a033dbf-e3f8-414d-9fc0-f0689385cbb4/resource/c65d5f7d-ccba-4a76-bee8-b26de60b4e65/download/_____2568.csv',
    page: 'https://data.go.th/dataset/s_harm6',
  },
  condom: {
    id: 's_harm5',
    label: 'Correct condom-use support',
    labelTh: 'การสนับสนุนให้ใช้ถุงยางอนามัยอย่างถูกวิธี',
    url: 'https://data.go.th/dataset/387f3a72-0709-4c3e-ae77-a0ee86991a56/resource/a3df59f9-9090-44bc-93dc-0fb1a42d9532/download/__2568.csv',
    page: 'https://data.go.th/dataset/s_harm5',
  },
  vct: {
    id: 's_harm3',
    label: 'Voluntary counselling, HIV testing and ARV referral',
    labelTh: 'การให้คำปรึกษา และ/หรือ ตรวจการติดเชื้อเอชไอวีโดยสมัครใจ และ/หรือ ส่งต่อรับยาต้านไวรัส',
    url: 'https://data.go.th/dataset/a2865b2b-0fff-498f-a25e-a2587324bad1/resource/6198a9d6-8181-4b92-a0a4-ecd8daa9411d/download/_______2568.csv',
    page: 'https://data.go.th/dataset/s_harm3',
  },
  cbo: {
    id: 'gdpublish-das-01',
    label: 'Registered volunteers and civil-society organisations working on HIV',
    labelTh: 'การขึ้นทะเบียนอาสาสมัครและองค์กรภาคประชาสังคมที่ทำงานด้านเอชไอวี',
    url: 'https://opendata.ddc.moph.go.th/dataset/83b0af7e-8997-4faf-a3aa-18c26d723548/resource/ec0a55fb-92b2-4607-afed-6b7e96429b73/download/cbo_hiv_2568.csv',
    page: 'https://opendata.ddc.moph.go.th/dataset/gdpublish-das-01',
  },
};

// Uthai Thani is the one province province-hiv.json ships without a centroid.
const MISSING_CENTROIDS = { 61: { lat: 15.3835, lng: 100.0246 } };

// The civil-society registry keys on Thai province names while the case series
// keys on the numeric code, so the join needs this bridge. Standard Ministry of
// Interior codes; 77 provinces.
const PROVINCE_TH = {
  10: 'กรุงเทพมหานคร', 11: 'สมุทรปราการ', 12: 'นนทบุรี', 13: 'ปทุมธานี', 14: 'พระนครศรีอยุธยา',
  15: 'อ่างทอง', 16: 'ลพบุรี', 17: 'สิงห์บุรี', 18: 'ชัยนาท', 19: 'สระบุรี',
  20: 'ชลบุรี', 21: 'ระยอง', 22: 'จันทบุรี', 23: 'ตราด', 24: 'ฉะเชิงเทรา',
  25: 'ปราจีนบุรี', 26: 'นครนายก', 27: 'สระแก้ว', 30: 'นครราชสีมา', 31: 'บุรีรัมย์',
  32: 'สุรินทร์', 33: 'ศรีสะเกษ', 34: 'อุบลราชธานี', 35: 'ยโสธร', 36: 'ชัยภูมิ',
  37: 'อำนาจเจริญ', 38: 'บึงกาฬ', 39: 'หนองบัวลำภู', 40: 'ขอนแก่น', 41: 'อุดรธานี',
  42: 'เลย', 43: 'หนองคาย', 44: 'มหาสารคาม', 45: 'ร้อยเอ็ด', 46: 'กาฬสินธุ์',
  47: 'สกลนคร', 48: 'นครพนม', 49: 'มุกดาหาร', 50: 'เชียงใหม่', 51: 'ลำพูน',
  52: 'ลำปาง', 53: 'อุตรดิตถ์', 54: 'แพร่', 55: 'น่าน', 56: 'พะเยา',
  57: 'เชียงราย', 58: 'แม่ฮ่องสอน', 60: 'นครสวรรค์', 61: 'อุทัยธานี', 62: 'กำแพงเพชร',
  63: 'ตาก', 64: 'สุโขทัย', 65: 'พิษณุโลก', 66: 'พิจิตร', 67: 'เพชรบูรณ์',
  70: 'ราชบุรี', 71: 'กาญจนบุรี', 72: 'สุพรรณบุรี', 73: 'นครปฐม', 74: 'สมุทรสาคร',
  75: 'สมุทรสงคราม', 76: 'เพชรบุรี', 77: 'ประจวบคีรีขันธ์', 80: 'นครศรีธรรมราช', 81: 'กระบี่',
  82: 'พังงา', 83: 'ภูเก็ต', 84: 'สุราษฎร์ธานี', 85: 'ระนอง', 86: 'ชุมพร',
  90: 'สงขลา', 91: 'สตูล', 92: 'ตรัง', 93: 'พัทลุง', 94: 'ปัตตานี',
  95: 'ยะลา', 96: 'นราธิวาส',
};

async function fetchCsv(key, { refresh = false } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${key}.csv`);
  if (!refresh && fs.existsSync(file)) return fs.readFileSync(file);
  const res = await fetch(SOURCES[key].url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

/** data.go.th ships a mix of UTF-8 and TIS-620; sniff rather than assume. */
function decode(buf) {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('�')) return utf8.replace(/^\uFEFF/, '');
  return new TextDecoder('windows-874').decode(buf);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = (rows.shift() || []).map((h) => h.trim());
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const provinceOf = (areacode) => {
  const s = String(areacode || '').trim();
  return /^\d{6,}$/.test(s) ? s.slice(0, 2) : null;
};
/** Sum the four quarterly columns for a given prefix (pid = people, seq = visits). */
const quarters = (row, prefix) =>
  num(row[`${prefix}_q1`]) + num(row[`${prefix}_q2`]) + num(row[`${prefix}_q3`]) + num(row[`${prefix}_q4`]);

function aggregateByProvince(rows, rowValue) {
  const out = new Map();
  for (const row of rows) {
    const code = provinceOf(row.areacode);
    if (!code) continue;
    const bucket = out.get(code) || { facilities: new Set(), people: 0, visits: 0, extra: {} };
    if (row.hospcode) bucket.facilities.add(row.hospcode);
    const v = rowValue(row);
    bucket.people += v.people || 0;
    bucket.visits += v.visits || 0;
    for (const [k, n] of Object.entries(v.extra || {})) {
      bucket.extra[k] = (bucket.extra[k] || 0) + n;
    }
    out.set(code, bucket);
  }
  return out;
}

const shape = (b) => (b
  ? { facilities: b.facilities.size, people: b.people, visits: b.visits, ...b.extra }
  : null);

async function main() {
  const refresh = process.argv.includes('--refresh');
  console.log('=== HIV/STI service dataset (BE 2568) ===');

  const raw = {};
  for (const key of Object.keys(SOURCES)) {
    const buf = await fetchCsv(key, { refresh });
    raw[key] = parseCsv(decode(buf));
    console.log(`  ${key.padEnd(7)} ${String(raw[key].length).padStart(5)} rows  (${SOURCES[key].id})`);
  }

  const lab = aggregateByProvince(raw.lab, (r) => ({
    people: num(r.total),
    extra: {
      tested: num(r.result1),
      positive: num(r.result1_1),
      inconclusive: num(r.result1_2),
      viralLoadTests: num(r.result4),
    },
  }));
  const sti = aggregateByProvince(raw.sti, (r) => ({ people: quarters(r, 'pid'), visits: quarters(r, 'seq') }));
  const condom = aggregateByProvince(raw.condom, (r) => ({ people: quarters(r, 'pid'), visits: quarters(r, 'seq') }));
  const vct = aggregateByProvince(raw.vct, (r) => ({
    people: quarters(r, 'pid'),
    visits: quarters(r, 'seq'),
    extra: { onArv: quarters(r, 'pidp') },
  }));

  // Civil-society registry joins on province NAME (Thai), not code.
  const cbo = new Map();
  for (const r of raw.cbo) {
    const prov = (r.hivplaceprov || r.HIVPlaceProv || '').trim();
    if (!prov) continue;
    const b = cbo.get(prov) || { total: 0, certified: 0, current: 0, orgs: new Set() };
    b.total += 1;
    if (num(r.passcer ?? r.passCer) === 1) b.certified += 1;
    // IsNotExpCer: 0 = not yet expired, 1 = expired.
    if (num(r.isnotexpcer ?? r.IsNotExpCer) === 0) b.current += 1;
    const name = (r.hivplace || r.HIVPlace || '').trim();
    if (name) b.orgs.add(name);
    cbo.set(prov, b);
  }

  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/health/province-hiv.json'), 'utf8'));

  const provinces = base.provinces.map((p) => {
    const code = String(p.code).padStart(2, '0');
    const centroid = MISSING_CENTROIDS[Number(code)] || {};
    const nameTh = PROVINCE_TH[Number(code)] || null;
    const cboBucket = nameTh ? cbo.get(nameTh) : null;
    return {
      code,
      name: p.name,
      nameTh,
      lat: p.lat ?? centroid.lat ?? null,
      lng: p.lng ?? centroid.lng ?? null,
      newCases2566: p.newCases2566 ?? null,
      services: {
        lab: shape(lab.get(code)),
        sti: shape(sti.get(code)),
        condom: shape(condom.get(code)),
        vct: shape(vct.get(code)),
      },
      civilSociety: cboBucket
        ? {
          total: cboBucket.total,
          certified: cboBucket.certified,
          current: cboBucket.current,
          orgs: [...cboBucket.orgs].sort(),
        }
        : null,
    };
  });

  const reporting = provinces.filter((p) => Object.values(p.services).some(Boolean)).length;
  const payload = {
    meta: {
      yearBuddhist: 2568,
      yearGregorian: 2025,
      builtAt: new Date().toISOString(),
      provincesReporting: reporting,
      provinceCount: provinces.length,
      sources: Object.fromEntries(
        Object.entries(SOURCES).map(([k, s]) => [k, { id: s.id, label: s.label, labelTh: s.labelTh, page: s.page }]),
      ),
      caveats: [
        'Facility counts are distinct reporting units that filed a return for BE 2568 — not a census of every facility offering the service. A facility that did not report is invisible here; read a low number as under-reporting, never as absence of need.',
        'Positivity is positive Anti-HIV results divided by people tested, among records where a lab result was captured. It measures testing yield, not population prevalence and not an infection rate.',
        'A province with no reported row is null, not zero.',
        'Service data is BE 2568 (2025). The new-cases-in-care series (province-hiv.json) is BE 2566 (2023) — the newest year MoPH publishes for it. The two years are not directly comparable; read them as separate layers.',
        'Venue counts come from public Telegram advertising and are a floor on advertised supply, not a register of businesses.',
      ],
    },
    provinces,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

  const totals = (m, f) => [...m.values()].reduce((a, b) => a + f(b), 0);
  console.log(`\n  provinces reporting any service : ${reporting}/${provinces.length}`);
  console.log(`  Anti-HIV tested (people)        : ${totals(lab, (b) => b.extra.tested).toLocaleString()}`);
  console.log(`  Anti-HIV positive (people)      : ${totals(lab, (b) => b.extra.positive).toLocaleString()}`);
  console.log(`  STI service people              : ${totals(sti, (b) => b.people).toLocaleString()}`);
  console.log(`  registered CSO/volunteer rows   : ${raw.cbo.length.toLocaleString()} across ${cbo.size} provinces`);
  console.log(`\n  wrote ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
