#!/usr/bin/env node
/**
 * Stage 2 appendix — publish the Data Bank inventory.
 *
 * The registry build consumes a few dozen producer lists and drops the rest
 * silently into skip reasons. This artefact keeps the whole discovered
 * universe visible: every dataset data.go.th returned for the OTOP catalogue
 * search, grouped by what kind of record it holds, joined with what the
 * build actually pulled from it (rows in, usable or why skipped).
 *
 * Pure function of files on disk. No network.
 * Reads:  otop/data/raw/manifest.json + otop/public/otop_meta.json
 * Writes: otop/public/otop_datasets.json
 *
 * Usage:
 *   node scripts/otop/datasets.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MANIFEST = path.join(ROOT, 'otop/data/raw/manifest.json');
const META = path.join(ROOT, 'otop/public/otop_meta.json');
const OUT = path.join(ROOT, 'otop/public/otop_datasets.json');

// Order matters: first matching shelf wins. A revenue table for producers is
// money first, registry second — the bank shelves by what a reader comes to
// do with the dataset, not by every noun in its title.
const SHELVES = [
  { id: 'money', th: 'รายได้และยอดขาย', en: 'Revenue & sales', keys: ['รายได้', 'มูลค่า', 'จำหน่าย', 'ยอดขาย', 'งบ'], blurb: 'Baht tables: who earned what, where, and when.' },
  { id: 'tourism', th: 'ท่องเที่ยวชุมชน', en: 'Community tourism', keys: ['ท่องเที่ยว', 'นวัตวิถี', 'หมู่บ้าน'], blurb: 'OTOP tourism villages and visitor-facing lists.' },
  { id: 'standards', th: 'มาตรฐานและการคัดสรร', en: 'Standards & grading', keys: ['มาตรฐาน', 'มผช', 'รับรอง', 'คัดสรร', 'ระดับดาว', 'ดาว'], blurb: 'Grades, certificates, and the OPC star selections.' },
  { id: 'products', th: 'สินค้าและผลิตภัณฑ์', en: 'Products', keys: ['สินค้า', 'ผลิตภัณฑ์', 'อาหาร', 'ผ้า', 'สมุนไพร'], blurb: 'Product catalogues: what is made, not who makes it.' },
  { id: 'registry', th: 'ทะเบียนผู้ผลิต', en: 'Producer registry', keys: ['ทะเบียน', 'ผู้ประกอบการ', 'ผู้ผลิต', 'ลงทะเบียน', 'รายชื่อ'], blurb: 'Who the producers are and where they are registered.' },
  { id: 'groups', th: 'กลุ่มและจำนวน', en: 'Groups & headcounts', keys: ['จำนวน', 'กลุ่ม', 'ชุมชน'], blurb: 'Counts of groups and communities by place.' },
];

function shelfOf(title) {
  const t = title ?? '';
  for (const shelf of SHELVES) {
    if (shelf.keys.some((k) => t.includes(k))) return shelf.id;
  }
  return 'other';
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('[otop:datasets] no manifest — run `npm run otop:fetch` first.');
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const discovered = manifest.datasets ?? [];
  const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : null;
  const byTitle = new Map();
  for (const r of meta?.resources ?? []) {
    if (!byTitle.has(r.datasetTitle)) byTitle.set(r.datasetTitle, r);
  }

  const groups = new Map();
  for (const shelf of SHELVES) groups.set(shelf.id, { ...shelf, keys: undefined, datasets: [] });
  groups.set('other', { id: 'other', th: 'อื่น ๆ', en: 'Everything else', blurb: 'Datasets the shelves above could not place.', datasets: [] });

  for (const d of discovered) {
    const pulled = byTitle.get(d.title);
    groups.get(shelfOf(d.title)).datasets.push({
      title: d.title,
      org: d.organization ?? null,
      licence: d.licence ?? null,
      pulled: pulled ? { rowsIn: pulled.rowsIn, usable: pulled.usable, kind: pulled.kind, skipReason: pulled.skipReason ?? null } : null,
    });
  }

  for (const group of groups.values()) {
    group.datasets.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'th'));
  }

  const ordered = [...groups.values()].filter((g) => g.id !== 'other' || g.datasets.length > 0);
  const pulledCount = ordered.reduce((n, g) => n + g.datasets.filter((d) => d.pulled).length, 0);
  const out = {
    builtAt: new Date().toISOString(),
    source: 'data.go.th',
    degraded: meta?.degraded ?? true,
    totals: {
      discovered: discovered.length,
      pulled: pulledCount,
      rowsIn: (meta?.resources ?? []).reduce((n, r) => n + (r.rowsIn ?? 0), 0),
    },
    groups: ordered.map((g) => ({
      ...g,
      count: g.datasets.length,
      pulled: g.datasets.filter((d) => d.pulled).length,
    })),
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`[otop:datasets] ${out.totals.discovered} discovered · ${pulledCount} pulled · ${ordered.length} shelves → ${path.relative(ROOT, OUT)}`);
}

main();
