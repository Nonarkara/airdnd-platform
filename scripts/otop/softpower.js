#!/usr/bin/env node
/**
 * Soft power — stage 1: pull the national registers that measure how Thai
 * culture reaches the world.
 *
 * The argument this platform makes is simple: soft power is usually measured
 * by polling foreigners, and the supply side is almost never measured at all.
 * But the supply side is public. The same portal that carries 154,050 OTOP
 * records also carries the export tables, the national film-heritage list,
 * the handicraft reports, the Thai Select food standard, the fisheries
 * export series and the outbound labour register. Every one of them is a
 * number that can be pulled, dated and cited.
 *
 * This script only FETCHES. It writes each dataset to a raw cache and
 * transforms nothing, so the same discipline as the OTOP pipeline holds: the
 * cache is an archive, and the build is a pure function of what is on disk.
 *
 *   node scripts/otop/softpower.js --fetch
 *   node scripts/otop/softpower.js            # build only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CkanClient } from '../../otop/core/ckan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(ROOT, 'otop/data/softpower');

/**
 * The instruments. Each is a real national register on data.go.th, named by
 * the dataset that carries it. `q` is the catalogue query; the title match
 * is what identifies the dataset, because the query alone returns neighbours.
 *
 * layer — where the instrument sits in the argument:
 *   supply      — the capacity to make it (producers, workshops, kitchens)
 *   conveyance  — the machinery that carries it (exports, visitors, workers)
 *   recognition — the state and the market saying so (heritage, standards)
 */
export const TOOLS = [
  {
    id: 'otop',
    layer: 'supply',
    en: 'One Tambon One Product',
    th: 'หนึ่งตำบลหนึ่งผลิตภัณฑ์',
    local: true,
    measuresEn: 'The registered producers behind Thailand\'s craft economy, one tambon at a time.',
    measuresTh: 'ผู้ผลิตที่ลงทะเบียนในเศรษฐกิจหัตถกรรมของไทย ทีละตำบล',
    notEn: 'A registry of filings, not a measure of demand, price or quality.',
    notTh: 'ทะเบียนของการยื่นเอกสาร ไม่ใช่การวัดอุปสงค์ ราคา หรือคุณภาพ',
  },
  {
    id: 'handicraft',
    layer: 'supply',
    q: 'ภาพรวมรายงานผลิตภัณฑ์ศิลปหัตถกรรมไทย',
    title: 'ภาพรวมรายงานผลิตภัณฑ์ศิลปหัตถกรรมไทย',
    en: 'Thai handicraft products',
    th: 'ผลิตภัณฑ์ศิลปหัตถกรรมไทย',
    measuresEn: 'The national report on Thai handicraft products — what is made, by how many makers, for which province.',
    measuresTh: 'รายงานผลิตภัณฑ์ศิลปหัตถกรรมไทย — ผลิตอะไร โดยใคร และของจังหวัดใด',
    notEn: 'A production report. It does not say what was sold, or where.',
    notTh: 'รายงานการผลิต ไม่ได้บอกว่าขายได้เท่าไร และขายที่ไหน',
  },
  {
    id: 'local-food',
    layer: 'recognition',
    q: 'อาหารไทยพื้นถิ่น',
    title: 'อาหารไทยพื้นถิ่น',
    en: 'Local Thai food',
    th: 'อาหารไทยพื้นถิ่น',
    measuresEn: 'The Ministry of Culture\'s register of local Thai dishes, with their ingredients, checked so they can be taught and remade.',
    measuresTh: 'ทะเบียนอาหารไทยพื้นถิ่นของกรมส่งเสริมวัฒนธรรม พร้อมส่วนประกอบ ที่ตรวจสอบแล้วเพื่อเผยแพร่และนำไปใช้ต่อยอด',
    notEn: 'A domestic register of dishes. It is not a count of Thai restaurants abroad.',
    notTh: 'เป็นทะเบียนอาหารในประเทศ ไม่ใช่จำนวนร้านอาหารไทยในต่างประเทศ',
  },
  {
    id: 'film-heritage',
    layer: 'recognition',
    q: 'ภาพยนตร์ที่ได้รับการขึ้นทะเบียนเป็นมรดกภาพยนตร์ของชาติ',
    title: 'ข้อมูลภาพยนตร์ที่ได้รับการขึ้นทะเบียนเป็นมรดกภาพยนตร์ของชาติ',
    en: 'National film heritage',
    th: 'มรดกภาพยนตร์ของชาติ',
    measuresEn: 'The Thai Film Archive\'s register of films recognised as national film heritage.',
    measuresTh: 'ทะเบียนภาพยนตร์ที่ขึ้นทะเบียนเป็นมรดกภาพยนตร์ของชาติ จากหอภาพยนตร์',
    notEn: 'A heritage register. It is the state\'s memory, not the audience\'s reach.',
    notTh: 'ทะเบียนมรดก เป็นความทรงจำของรัฐ ไม่ใช่การเข้าถึงของผู้ชม',
  },
  {
    id: 'exports',
    layer: 'conveyance',
    q: 'มูลค่าการส่งออกของสินค้า',
    title: 'มูลค่าการส่งออกของสินค้า',
    en: 'Export value by commodity',
    th: 'มูลค่าการส่งออกตามกลุ่มสินค้า',
    measuresEn: 'The Department of International Trade\'s export values by commodity — the taste of Thailand, priced.',
    measuresTh: 'มูลค่าการส่งออกตามกลุ่มสินค้า ของกรมการค้าต่างประเทศ — รสชาติของไทยในราคา',
    notEn: 'Export value, not soft power. Value moves for reasons the culture does not explain.',
    notTh: 'เป็นมูลค่าการส่งออก ไม่ใช่พลังอ่อน มูลค่าขยับด้วยเหตุผลที่วัฒนธรรมไม่ได้อธิบาย',
  },
  {
    id: 'fisheries',
    layer: 'conveyance',
    q: 'ปริมาณและมูลค่าการนำเข้าส่งออกสินค้าประมงของไทย',
    maxRows: 60000,
    title: 'ปริมาณและมูลค่าการนำเข้าส่งออกสินค้าประมงของไทย',
    en: 'Fishery exports',
    th: 'การส่งออกสินค้าประมง',
    measuresEn: 'The Department of Fisheries\' volume and value of Thai fishery exports.',
    measuresTh: 'ปริมาณและมูลค่าการส่งออกสินค้าประมงของไทย จากกรมประมง',
    notEn: 'A trade series. It counts what crossed the border, not who ate it.',
    notTh: 'เป็นสถิติการค้า นับสินค้าที่ข้ามพรมแดน ไม่ใช่คนที่กิน',
  },
  {
    id: 'labour',
    layer: 'conveyance',
    q: 'สถิติแรงงานไทยเดินทางไปทำงานต่างประเทศ',
    title: 'สถิติแรงงานไทยเดินทางไปทำงานต่างประเทศ',
    en: 'Thai workers abroad',
    th: 'แรงงานไทยที่ไปทำงานต่างประเทศ',
    measuresEn: 'The registered outbound Thai workforce — the human carrier of Thai culture.',
    measuresTh: 'แรงงานไทยที่ลงทะเบียนเดินทางไปทำงานต่างประเทศ — ผู้นำวัฒนธรรมไทยไปพร้อมกับคน',
    notEn: 'Registered intent to travel. Not the number abroad, and not what they carry with them.',
    notTh: 'เป็นความตั้งใจที่ลงทะเบียน ไม่ใช่จำนวนคนที่อยู่ต่างประเทศ และไม่ใช่สิ่งที่พวกเขานำไป',
  },
];

const client = new CkanClient();

function cacheFile(id) {
  return path.join(RAW_DIR, `${String(id).replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);
}

async function fetchTool(tool) {
  const outFile = cacheFile(tool.id);
  if (fs.existsSync(outFile) && !process.argv.includes('--refetch')) {
    return JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }
  const search = await client.searchPackages({ q: tool.q, rows: 40, max: 40 });
  const pkgs = search.packages ?? [];
  // The exact title wins; otherwise the closest one by title length.
  const exact = pkgs.find((p) => p.title === tool.title);
  const near = pkgs
    .filter((p) => (p.title ?? '').includes(tool.title.slice(0, 12)))
    .sort((a, b) => (a.title ?? '').length - (b.title ?? '').length)[0];
  const pkg = exact ?? near ?? pkgs[0];
  if (!pkg) {
    const record = { id: tool.id, ok: false, reason: 'no matching dataset in the catalogue', retrieved: new Date().toISOString() };
    fs.writeFileSync(outFile, JSON.stringify(record, null, 1));
    return record;
  }

  const record = {
    id: tool.id,
    ok: false,
    packageId: pkg.id,
    title: pkg.title,
    org: pkg.organization?.title ?? pkg.organization?.name ?? null,
    notes: (pkg.notes ?? '').slice(0, 400),
    url: `https://data.go.th/dataset/${pkg.id}`,
    retrieved: new Date().toISOString(),
    resources: [],
    rows: null,
    fields: null,
    source: null,
  };

  // Try each tabular resource: the DataStore first, then the blob.
  for (const res of pkg.resources ?? []) {
    const format = String(res.format ?? '').toUpperCase();
    if (!['CSV', 'JSON', 'TSV', 'ODS', ''].includes(format)) {
      record.resources.push({ id: res.id, name: res.name, format, read: false, reason: 'format not readable here' });
      continue;
    }
    let rows = null;
    let fields = null;
    let how = null;
    let total = null;
    const ds = await client.datastoreRows(res.id, { max: tool.maxRows ?? 5000 }).catch(() => null);
    if (ds?.rows?.length) {
      rows = ds.rows;
      fields = ds.fields ?? Object.keys(rows[0] ?? {});
      how = 'datastore';
      // The DataStore's own count, so a truncated pull is never published
      // as if it were the whole table.
      const head = await client.action('datastore_search', { resource_id: res.id, limit: 1 }).catch(() => null);
      total = head?.total ?? rows.length;
    } else if (res.url) {
      const blob = await client.downloadRows(res.url).catch(() => null);
      if (blob?.rows?.length) {
        rows = blob.rows;
        fields = Object.keys(rows[0] ?? {});
        how = blob.format;
        total = rows.length;
      }
    }
    if (!rows?.length) {
      record.resources.push({ id: res.id, name: res.name, format, read: false, reason: 'no rows read' });
      continue;
    }
    record.resources.push({ id: res.id, name: res.name, format, read: true, rows: rows.length, total, how });
    record.total = total;
    record.rows = rows;
    record.fields = fields;
    record.source = { resourceId: res.id, resourceName: res.name, format, how };
    break;
  }
  record.ok = !!record.rows;
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(record, null, 1));
  return record;
}

if (process.argv.includes('--fetch')) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const tool of TOOLS) {
    if (tool.local) continue;
    process.stdout.write(`→ ${tool.id} … `);
    try {
      const r = await fetchTool(tool);
      console.log(r.ok ? `read ${r.rows.length} rows from “${r.title}”` : `not read (${r.reason ?? 'no rows'})`);
    } catch (e) {
      console.log(`failed: ${e.message}`);
    }
  }
}

/* ── stage 2: build the indicator registry ──────────────────────────────────
 *
 * A pure function of the raw cache and the OTOP build. Every number below is
 * counted from the rows that were read; nothing is estimated, interpolated or
 * carried over from a previous build. Each indicator carries its scope,
 * because a number without a scope is a claim, not a measurement.
 * ------------------------------------------------------------------------ */

const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const be2ce = (be) => {
  const n = Number(be);
  return Number.isFinite(n) && n > 2000 ? n - 543 : null;
};
const tally = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (k == null || k === '') continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const sum = (rows, key) => rows.reduce((a, r) => a + (num(key(r)) ?? 0), 0);

const MEASURE = {
  exports: (raw) => {
    const rows = raw.rows;
    const value = sum(rows, (r) => r['มูลค่าการส่งออก(USD)']);
    const years = [...new Set(rows.map((r) => r['ปี']).filter(Boolean))].sort();
    const markets = tally(rows, (r) => r['ชื่อประเทศ']);
    const byMarket = new Map();
    for (const r of rows) {
      const c = r['ชื่อประเทศ'];
      if (!c) continue;
      byMarket.set(c, (byMarket.get(c) ?? 0) + (num(r['มูลค่าการส่งออก(USD)']) ?? 0));
    }
    const topMarkets = [...byMarket.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      indicators: [
        { id: 'lines', en: 'Export lines in the extract', th: 'รายการส่งออกในชุดข้อมูล', value: rows.length, unitEn: 'lines', unitTh: 'รายการ', scopeEn: 'As published on certificates of origin', scopeTh: 'ตามที่ระบุในหนังสือรับรองถิ่นกำเนิดสินค้า' },
        { id: 'value', en: 'Declared export value', th: 'มูลค่าส่งออกที่ประกาศ', value: Math.round(value), unitEn: 'USD', unitTh: 'ดอลลาร์สหรัฐ', scopeEn: 'Certificates of origin only — not the whole customs total', scopeTh: 'เฉพาะหนังสือรับรองถิ่นกำเนิด ไม่ใช่ยอดรวมศุลกากรทั้งหมด' },
        { id: 'commodities', en: 'Distinct commodities', th: 'กลุ่มสินค้าที่แตกต่างกัน', value: new Set(rows.map((r) => r['HS CODE']).filter(Boolean)).size, unitEn: 'HS codes', unitTh: 'รหัส HS', scopeEn: 'Within this extract', scopeTh: 'ภายในชุดข้อมูลนี้' },
        { id: 'markets', en: 'Destination markets', th: 'ตลาดปลายทาง', value: markets.length, unitEn: 'countries', unitTh: 'ประเทศ', scopeEn: 'Within this extract', scopeTh: 'ภายในชุดข้อมูลนี้' },
      ],
      series: topMarkets.map(([label, v]) => ({ label, value: Math.round(v) })),
      seriesLabelEn: 'Top markets by declared value (USD)',
      seriesLabelTh: 'ตลาดหลักตามมูลค่าที่ประกาศ (ดอลลาร์สหรัฐ)',
      note: `Years covered: ${years.join(', ')}.`,
    };
  },

  fisheries: (raw) => {
    const rows = raw.rows;
    const exports = rows.filter((r) => String(r.tradeflow) === '2');
    const imports = rows.filter((r) => String(r.tradeflow) === '1');
    const years = [...new Set(rows.map((r) => r.year).filter(Boolean))].sort();
    return {
      indicators: [
        { id: 'lines', en: 'Trade lines', th: 'รายการการค้า', value: rows.length, unitEn: 'lines', unitTh: 'รายการ', scopeEn: 'The full published series', scopeTh: 'ชุดข้อมูลฉบับเต็มตามที่เผยแพร่' },
        { id: 'export-lines', en: 'Export lines', th: 'รายการส่งออก', value: exports.length, unitEn: 'lines', unitTh: 'รายการ', scopeEn: 'tradeflow = 2', scopeTh: 'tradeflow = 2' },
        { id: 'import-lines', en: 'Import lines', th: 'รายการนำเข้า', value: imports.length, unitEn: 'lines', unitTh: 'รายการ', scopeEn: 'tradeflow = 1', scopeTh: 'tradeflow = 1' },
        { id: 'products', en: 'Product lines', th: 'กลุ่มสินค้า', value: new Set(rows.map((r) => r.productDetailTH).filter(Boolean)).size, unitEn: 'products', unitTh: 'สินค้า', scopeEn: 'Within the series', scopeTh: 'ภายในชุดข้อมูล' },
        { id: 'markets', en: 'Trading partners', th: 'คู่ค้า', value: new Set(rows.map((r) => r.countryNameTH).filter(Boolean)).size, unitEn: 'countries', unitTh: 'ประเทศ', scopeEn: 'Within the series', scopeTh: 'ภายในชุดข้อมูล' },
      ],
      series: tally(exports, (r) => r.productDetailTH).slice(0, 5).map(([label, value]) => ({ label, value })),
      seriesLabelEn: 'Most-traded export products, by number of trade lines',
      seriesLabelTh: 'สินค้าส่งออกที่ซื้อขายมากที่สุด นับจำนวนรายการ',
      note: `Years covered (B.E.): ${years.join(', ')}.`,
    };
  },

  handicraft: (raw) => {
    const rows = raw.rows;
    const months = Object.keys(rows[0] ?? {}).filter((k) => /^[^.]+\.[^.]+\.\d{2}$/.test(k));
    const ranked = rows.map((r) => {
      let total = 0;
      for (const m of months) total += num(r[m]) ?? 0;
      return { label: r['รายการสินค้า'], value: Math.round(total * 100) / 100 };
    }).filter((x) => x.label && x.label.trim() !== 'รวม').sort((a, b) => b.value - a.value);
    return {
      indicators: [
        { id: 'lines', en: 'Product lines reported', th: 'รายการสินค้าที่รายงาน', value: rows.length, unitEn: 'products', unitTh: 'สินค้า', scopeEn: 'As published', scopeTh: 'ตามที่เผยแพร่' },
        { id: 'months', en: 'Months in the report', th: 'เดือนในรายงาน', value: months.length, unitEn: 'months', unitTh: 'เดือน', scopeEn: 'B.E. 2562 (2019)', scopeTh: 'พ.ศ. 2562 (2019)' },
      ],
      series: ranked.slice(0, 5),
      seriesLabelEn: 'Top product lines by their twelve-month total',
      seriesLabelTh: 'สินค้าที่มีมูลค่ารวมสูงสุดในสิบสองเดือน',
      note: 'The dataset does not state the unit of these figures.',
    };
  },

  'local-food': (raw) => {
    const rows = raw.rows;
    const regions = tally(rows, (r) => r.region);
    return {
      indicators: [
        { id: 'dishes', en: 'Dishes recorded', th: 'รายการอาหารที่บันทึก', value: rows.length, unitEn: 'dishes', unitTh: 'รายการอาหาร', scopeEn: 'Checked for dissemination and training', scopeTh: 'ผ่านการตรวจสอบเพื่อเผยแพร่และใช้ฝึกอาชีพ' },
        { id: 'provinces', en: 'Provinces covered', th: 'จังหวัดที่ครอบคลุม', value: new Set(rows.map((r) => r.province).filter(Boolean)).size, unitEn: 'provinces', unitTh: 'จังหวัด', scopeEn: 'Within this register', scopeTh: 'ภายในทะเบียนนี้' },
        { id: 'regions', en: 'Regions covered', th: 'ภูมิภาคที่ครอบคลุม', value: regions.length, unitEn: 'regions', unitTh: 'ภูมิภาค', scopeEn: 'Within this register', scopeTh: 'ภายในทะเบียนนี้' },
      ],
      series: regions.slice(0, 6).map(([label, value]) => ({ label, value })),
      seriesLabelEn: 'Dishes by region',
      seriesLabelTh: 'รายการอาหารแยกตามภูมิภาค',
      note: '',
    };
  },

  'film-heritage': (raw) => {
    const rows = raw.rows;
    const years = rows.map((r) => be2ce(r['ปีที่สร้าง'])).filter((y) => y && y > 1800);
    const rounds = new Set(rows.map((r) => (r['ครั้งที่'] ?? '').trim()).filter(Boolean));
    const genres = tally(rows, (r) => (r['ประเภท'] ?? '').trim());
    return {
      indicators: [
        { id: 'films', en: 'Films registered', th: 'ภาพยนตร์ที่ขึ้นทะเบียน', value: rows.length, unitEn: 'films', unitTh: 'เรื่อง', scopeEn: 'The Film Archive register as published', scopeTh: 'ทะเบียนของหอภาพยนตร์ตามที่เผยแพร่' },
        { id: 'rounds', en: 'Heritage rounds', th: 'ครั้งการขึ้นทะเบียน', value: rounds.size, unitEn: 'rounds', unitTh: 'ครั้ง', scopeEn: 'Each round is a named selection', scopeTh: 'แต่ละครั้งคือการคัดเลือกหนึ่งชุด' },
        { id: 'earliest', en: 'Earliest production year', th: 'ปีผลิตเรื่องแรก', value: years.length ? Math.min(...years) : null, unitEn: 'CE', unitTh: 'ค.ศ.', scopeEn: 'Converted from the Thai Buddhist year in the dataset', scopeTh: 'แปลงจากปี พ.ศ. ในชุดข้อมูล' },
        { id: 'genres', en: 'Genres', th: 'ประเภทภาพยนตร์', value: genres.length, unitEn: 'genres', unitTh: 'ประเภท', scopeEn: 'As the dataset labels them', scopeTh: 'ตามที่ชุดข้อมูลกำหนด' },
      ],
      series: genres.slice(0, 6).map(([label, value]) => ({ label, value })),
      seriesLabelEn: 'Registered films by genre',
      seriesLabelTh: 'ภาพยนตร์ที่ขึ้นทะเบียนแยกตามประเภท',
      note: years.length ? `Production years run from ${Math.min(...years)} to ${Math.max(...years)}.` : '',
    };
  },

  labour: (raw) => {
    const rows = raw.rows;
    const sorted = [...rows].sort((a, b) => a.Year - b.Year);
    const latest = sorted[sorted.length - 1];
    const channels = Object.entries(latest ?? {})
      .filter(([k]) => k !== 'Year' && k !== '_id' && !/\(Total\)/i.test(k))
      .map(([k, v]) => ({ label: k, value: num(v) ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = channels.reduce((a, c) => a + c.value, 0);
    return {
      indicators: [
        { id: 'outbound', en: 'Outbound workers registered', th: 'แรงงานที่ลงทะเบียนเดินทางไปทำงานต่างประเทศ', value: total, unitEn: 'people', unitTh: 'คน', scopeEn: `Chonburi province, B.E. ${latest?.Year ?? '—'} — a provincial register, not a national one`, scopeTh: `จังหวัดชลบุรี พ.ศ. ${latest?.Year ?? '—'} — เป็นทะเบียนระดับจังหวัด ไม่ใช่ระดับประเทศ` },
        { id: 'years', en: 'Years in the register', th: 'ปีที่มีในทะเบียน', value: rows.length, unitEn: 'years', unitTh: 'ปี', scopeEn: 'As published', scopeTh: 'ตามที่เผยแพร่' },
      ],
      series: channels.slice(0, 6),
      seriesLabelEn: 'Outbound workers by channel',
      seriesLabelTh: 'แรงงานไปทำงานต่างประเทศ แยกตามช่องทาง',
      note: 'A provincial register. It is an instrument, and it is scoped to the province that publishes it.',
    };
  },
};

function otopTool(tool, meta, insights, index) {
  const c = meta.counts ?? {};
  const n = insights?.national ?? {};
  const comp = n.completeness ?? {};
  return {
    ...tool,
    status: 'measured',
    indicators: [
      { id: 'records', en: 'Producers on the register', th: 'ผู้ผลิตในทะเบียน', value: c.recordsAfterMerge, unitEn: 'records', unitTh: 'รายการ', scopeEn: 'One row per producer after entity resolution', scopeTh: 'หนึ่งแถวต่อหนึ่งผู้ผลิต หลังรวมตัวตน' },
      { id: 'provinces', en: 'Provinces covered', th: 'จังหวัดที่ครอบคลุม', value: n.provincesCovered ?? index?.provinces?.length ?? 0, unitEn: 'of 77', unitTh: 'จาก 77', scopeEn: 'Every province shard was read', scopeTh: 'อ่านครบทุกไฟล์จังหวัด' },
      { id: 'placed', en: 'Placed at tambon', th: 'ระบุตำบลได้', value: c.tambonPlaced, unitEn: 'records', unitTh: 'รายการ', scopeEn: 'A location, not a market', scopeTh: 'คือที่ตั้ง ไม่ใช่ตลาด' },
      { id: 'cert', en: 'Certificates valid', th: 'ใบรับรองที่ใช้ได้', value: c.certValid, unitEn: 'certificates', unitTh: 'ใบรับรอง', scopeEn: `As of ${c.certAsOf}`, scopeTh: `ณ ${c.certAsOf}` },
      { id: 'contact', en: 'With a contact channel', th: 'ที่มีช่องทางติดต่อ', value: comp.withContact ?? null, unitEn: '% of records', unitTh: '% ของรายการ', scopeEn: 'A phone, an email or a website on the filing', scopeTh: 'เบอร์โทร อีเมล หรือเว็บไซต์ที่ระบุในการยื่น' },
    ],
    series: [],
    source: {
      dataset: 'OTOP — ผลิตภัณฑ์ชุมชน (this site)',
      org: 'Department of Community Development and partners, via data.go.th',
      url: 'https://otop.nonarkara.org/?view=method',
      retrieved: meta.builtAt,
      rows: c.recordsAfterMerge,
    },
    route: '/?view=find',
  };
}

function build() {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const meta = read('otop/public/otop_meta.json');
  const insights = read('otop/public/otop_insights.json');
  const index = read('otop/public/otop_index.json');

  const tools = [];
  for (const tool of TOOLS) {
    if (tool.local) {
      tools.push(otopTool(tool, meta, insights, index));
      continue;
    }
    const file = cacheFile(tool.id);
    if (!fs.existsSync(file)) {
      tools.push({ ...tool, status: 'listed', indicators: [], source: null, note: 'Not fetched in this build.' });
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw.ok) {
      tools.push({
        ...tool,
        status: 'listed',
        indicators: [],
        source: { dataset: raw.title ?? tool.title, org: raw.org ?? null, url: raw.url ?? null, retrieved: raw.retrieved ?? null, rows: null },
        note: raw.reason ?? 'No rows could be read from this dataset.',
      });
      continue;
    }
    const measured = MEASURE[tool.id]?.(raw) ?? { indicators: [], series: [], note: '' };
    tools.push({
      ...tool,
      status: 'measured',
      indicators: measured.indicators,
      series: measured.series ?? [],
      seriesLabelEn: measured.seriesLabelEn ?? null,
      seriesLabelTh: measured.seriesLabelTh ?? null,
      note: measured.note ?? '',
      source: {
        dataset: raw.title,
        org: raw.org,
        url: raw.url,
        retrieved: raw.retrieved,
        rows: raw.total ?? raw.rows.length,
        resource: raw.source?.resourceName ?? null,
      },
    });
  }

  const out = {
    builtAt: new Date().toISOString(),
    portal: 'https://data.go.th',
    frame: {
      en: 'Soft power is measured abroad by polling. Its supply side is measured here: by the registers that record who makes what, where it goes, and what the state has certified. These are the instruments. One of them is OTOP.',
      th: 'พลังอ่อนถูกวัดจากต่างประเทศด้วยการสำรวจความคิดเห็น แต่ฝั่งของการผลิตถูกวัดที่นี่ ด้วยทะเบียนที่บันทึกว่าใครผลิตอะไร ส่งไปไหน และรัฐรับรองอะไร เหล่านี้คือเครื่องมือ และหนึ่งในนั้นคือ OTOP',
    },
    layers: [
      { id: 'supply', en: 'Supply', th: 'การผลิต', noteEn: 'The capacity to make it: producers, workshops, kitchens.', noteTh: 'ศักยภาพในการผลิต ทั้งผู้ผลิต โรงงาน และครัว' },
      { id: 'conveyance', en: 'Conveyance', th: 'การส่งต่อ', noteEn: 'The machinery that carries it: exports, trade, people abroad.', noteTh: 'เครื่องจักรที่พาออกไป ทั้งการส่งออก การค้า และคนที่อยู่ต่างประเทศ' },
      { id: 'recognition', en: 'Recognition', th: 'การรับรอง', noteEn: 'What the state and the market have already said so.', noteTh: 'สิ่งที่รัฐและตลาดได้รับรองไปแล้ว' },
    ],
    tools,
  };
  const file = path.join(ROOT, 'otop/public/soft_power.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`wrote otop/public/soft_power.json — ${tools.length} tools, ${tools.filter((t) => t.status === 'measured').length} measured`);
}

if (!process.argv.includes('--fetch')) build();

