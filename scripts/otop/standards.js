#!/usr/bin/env node
/**
 * Ingest Community Product Standards (มผช. / TCPS).
 *
 * Reads  otop/data/raw/19fb1dfe-df85-46c8-b63b-5e49e568b2ee.json (or cache search)
 * Writes otop/public/otop_standards.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStandardCategory } from '../../otop/core/standards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(ROOT, 'otop/data/raw');
const PUB_DIR = path.join(ROOT, 'otop/public');

function findStandardsSource() {
  const preferred = path.join(RAW_DIR, '19fb1dfe-df85-46c8-b63b-5e49e568b2ee.json');
  if (fs.existsSync(preferred)) return preferred;

  if (fs.existsSync(RAW_DIR)) {
    const files = fs.readdirSync(RAW_DIR);
    for (const f of files) {
      if (!f.endsWith('.json') || f === 'manifest.json') continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf8'));
        if (d.datasetTitle && (d.datasetTitle.includes('มาตรฐานผลิตภัณฑ์ชุมชน') || d.datasetTitle.includes('มผช.')) && Array.isArray(d.rows) && d.rows.length > 500) {
          return path.join(RAW_DIR, f);
        }
      } catch {}
    }
  }

  return null;
}

export function compileStandards() {
  const file = findStandardsSource();
  if (!file) {
    console.warn('[otop:standards] No standards dataset found in raw cache. Skipping.');
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(raw.rows) ? raw.rows : [];

  const standards = [];
  const byCategory = {
    food: 0,
    beverage: 0,
    decor: 0,
    textile: 0,
    herbal: 0,
  };

  for (const r of rows) {
    const code = (r['เลขที่ มผช.'] || '').trim();
    const titleTh = (r['ชื่อ มผช. ภาษาไทย'] || '').trim();
    const titleEn = (r['ชื่อ มผช. ภาษาอังกฤษ'] || '').trim();
    const groupRaw = (r['กลุ่มผลิตภัณฑ์'] || '').trim();
    const category = normalizeStandardCategory(groupRaw) || 'decor';
    const announcedRaw = (r['วันที่ประกาศ'] || '').trim();
    const announcedDate = announcedRaw.slice(0, 10) || null;
    const pdfUrl = (r['ไฟล์เอกสาร'] || r['url'] || '').trim();

    if (!code && !titleTh) continue;

    if (byCategory[category] != null) {
      byCategory[category] += 1;
    }

    standards.push({
      id: r._id || standards.length + 1,
      code,
      titleTh,
      titleEn,
      category,
      categoryTh: groupRaw,
      announcedDate,
      pdfUrl,
    });
  }

  const payload = {
    builtAt: new Date().toISOString(),
    source: 'Thai Industrial Standards Institute (TISI / สมอ.)',
    total: standards.length,
    byCategory,
    standards,
  };

  if (!fs.existsSync(PUB_DIR)) fs.mkdirSync(PUB_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUB_DIR, 'otop_standards.json'), JSON.stringify(payload, null, 2));

  console.log(`[otop:standards] Compiled ${standards.length} standards across 5 categories.`);
  console.log(`[otop:standards] Food: ${byCategory.food} · Decor: ${byCategory.decor} · Beverage: ${byCategory.beverage} · Textile: ${byCategory.textile} · Herbal: ${byCategory.herbal}`);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compileStandards();
}
