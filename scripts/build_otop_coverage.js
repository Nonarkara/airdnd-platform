#!/usr/bin/env node
/**
 * Turn the harvested CKAN manifest into a province-level coverage layer.
 *
 *   node scripts/otop_catalog.js && node scripts/build_otop_coverage.js
 *
 * Reads  data/otop_catalog.json
 * Writes public/otop_coverage.json
 *
 * This runs on metadata alone — no data file is downloaded. That is deliberate:
 * the first question the paper asks is not "what is in the data" but "does the
 * data exist at all, and where". Coverage is answerable from the manifest, and
 * the silence it exposes is itself the finding.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROVINCES, REGION_TH, resolveProvince } from '../src/lib/thailand.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN_FILE = path.join(__dirname, '../data/otop_catalog.json');
const OUT_FILE = path.join(__dirname, '../public/otop_coverage.json');

// Formats a machine can join without a human opening a file first.
const MACHINE_READABLE = new Set(['CSV', 'JSON', 'XLSX', 'XLS', 'XML', 'GEOJSON', 'API']);

const THEMES = [
  { id: 'entrepreneurs', label: 'Producers / entrepreneurs', re: /ผู้ประกอบการ|ผู้ผลิต|entrepreneur|producer|ทะเบียน/i },
  { id: 'products', label: 'Products', re: /ผลิตภัณฑ์|สินค้า|product/i },
  { id: 'sales', label: 'Sales / market value', re: /ยอดขาย|มูลค่า|รายได้|จำหน่าย|sales|revenue|income/i },
  { id: 'stars', label: 'Star grading (คัดสรร)', re: /คัดสรร|ดาว|champion|star|opc/i },
  { id: 'tourism', label: 'Nawatwithi / tourism', re: /นวัตวิถี|ท่องเที่ยว|nawatwithi|tourism|หมู่บ้าน/i },
  { id: 'outlets', label: 'Outlets / markets', re: /ร้าน|ตลาด|จุดจำหน่าย|outlet|shop|market/i },
];

function classifyTheme(text) {
  const hits = THEMES.filter((t) => t.re.test(text)).map((t) => t.id);
  return hits.length ? hits : ['other'];
}

// Resolve a province from the dataset's metadata, in descending order of trust.
// Organization first: a provincial statistics office publishing a file is a
// stronger claim about coverage than the word appearing somewhere in a title.
function locateDataset(ds) {
  const candidates = [
    ['organization', ds.organization],
    ['title', ds.title],
    ...(ds.tags || []).map((t) => ['tag', t]),
    ['notes', ds.notes],
  ];
  for (const [via, value] of candidates) {
    const hit = resolveProvince(value);
    if (hit) return { province: hit, via };
  }
  return { province: null, via: null };
}

function main() {
  if (!fs.existsSync(IN_FILE)) {
    console.error(`Missing ${path.relative(process.cwd(), IN_FILE)}`);
    console.error('Run:  node scripts/otop_catalog.js');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  const datasets = manifest.datasets || [];

  const byCode = new Map(
    PROVINCES.map((p) => [
      p.code,
      {
        code: p.code, th: p.th, en: p.en, region: p.region, region_th: REGION_TH[p.region],
        coords: p.coords,
        datasets: 0, resources: 0, machine_readable: 0,
        themes: {}, formats: {}, latest_modified: null, samples: [],
      },
    ]),
  );

  const national = [];       // datasets with no province — national-scope files
  const themeTotals = {};
  const formatTotals = {};
  let machineReadable = 0;
  let totalResources = 0;

  for (const ds of datasets) {
    const haystack = [ds.title, ds.notes, ...(ds.tags || [])].filter(Boolean).join(' ');
    const themes = classifyTheme(haystack);
    for (const t of themes) themeTotals[t] = (themeTotals[t] || 0) + 1;

    for (const r of ds.resources || []) {
      totalResources += 1;
      const f = r.format || 'UNKNOWN';
      formatTotals[f] = (formatTotals[f] || 0) + 1;
      if (MACHINE_READABLE.has(f)) machineReadable += 1;
    }

    const { province, via } = locateDataset(ds);
    if (!province) {
      national.push({ name: ds.name, title: ds.title, portal: ds.portal, themes });
      continue;
    }

    const entry = byCode.get(province.code);
    entry.datasets += 1;
    entry.resources += (ds.resources || []).length;
    for (const r of ds.resources || []) {
      const f = r.format || 'UNKNOWN';
      entry.formats[f] = (entry.formats[f] || 0) + 1;
      if (MACHINE_READABLE.has(f)) entry.machine_readable += 1;
    }
    for (const t of themes) entry.themes[t] = (entry.themes[t] || 0) + 1;
    if (ds.modified && (!entry.latest_modified || ds.modified > entry.latest_modified)) {
      entry.latest_modified = ds.modified;
    }
    if (entry.samples.length < 5) entry.samples.push({ title: ds.title, url: ds.url, via });
  }

  const provinces = [...byCode.values()];
  const covered = provinces.filter((p) => p.datasets > 0);
  const silent = provinces.filter((p) => p.datasets === 0);

  const byRegion = {};
  for (const p of provinces) {
    const r = (byRegion[p.region] ||= { region: p.region, region_th: p.region_th, provinces: 0, covered: 0, datasets: 0 });
    r.provinces += 1;
    r.datasets += p.datasets;
    if (p.datasets > 0) r.covered += 1;
  }

  const out = {
    generated_at: new Date().toISOString(),
    source: {
      harvested_at: manifest.harvested_at,
      query: manifest.query,
      portals: manifest.portals,
      dataset_count: manifest.dataset_count,
    },
    summary: {
      datasets: datasets.length,
      resources: totalResources,
      machine_readable_resources: machineReadable,
      machine_readable_share: totalResources ? +(machineReadable / totalResources).toFixed(3) : 0,
      provinces_total: provinces.length,
      provinces_covered: covered.length,
      provinces_silent: silent.length,
      coverage_share: +(covered.length / provinces.length).toFixed(3),
      national_scope_datasets: national.length,
      max_datasets_in_one_province: Math.max(0, ...provinces.map((p) => p.datasets)),
    },
    themes: THEMES.map((t) => ({ id: t.id, label: t.label, datasets: themeTotals[t.id] || 0 }))
      .concat([{ id: 'other', label: 'Unclassified', datasets: themeTotals.other || 0 }])
      .sort((a, b) => b.datasets - a.datasets),
    formats: Object.fromEntries(Object.entries(formatTotals).sort((a, b) => b[1] - a[1])),
    regions: Object.values(byRegion).sort((a, b) => b.datasets - a.datasets),
    silent_provinces: silent.map((p) => ({ code: p.code, th: p.th, en: p.en, region: p.region })),
    provinces: provinces.sort((a, b) => b.datasets - a.datasets || a.code.localeCompare(b.code)),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

  const s = out.summary;
  console.log('='.repeat(56));
  console.log(`datasets              ${s.datasets}`);
  console.log(`resources             ${s.resources}`);
  console.log(`machine-readable      ${s.machine_readable_resources} (${(s.machine_readable_share * 100).toFixed(1)}%)`);
  console.log(`provinces with data   ${s.provinces_covered}/77 (${(s.coverage_share * 100).toFixed(1)}%)`);
  console.log(`provinces SILENT      ${s.provinces_silent}`);
  console.log(`national-scope files  ${s.national_scope_datasets}`);
  console.log('='.repeat(56));
  console.log('top provinces:');
  for (const p of out.provinces.slice(0, 8)) console.log(`  ${p.datasets.toString().padStart(4)}  ${p.th} (${p.en})`);
  if (out.silent_provinces.length) {
    console.log('silent:', out.silent_provinces.map((p) => p.en).join(', '));
  }
  console.log(`\nwritten to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main();
