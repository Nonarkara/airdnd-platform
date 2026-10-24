#!/usr/bin/env node
/**
 * Soft-power scout — list real datasets on data.go.th that measure how Thai
 * culture reaches the world.
 *
 * Nothing here builds anything. It queries the CKAN catalogue and prints what
 * exists, with the organisation, the resource formats and the row counts where
 * the DataStore reports them, so the choice of what to pull is made from the
 * catalogue rather than from memory.
 *
 *   node scripts/otop/softpower-scout.mjs
 */

import { CkanClient } from '../../otop/core/ckan.js';

const client = new CkanClient();

const QUERIES = [
  ['ส่งออก', 'exports'],
  ['การค้าระหว่างประเทศ', 'international trade'],
  ['มูลค่าการส่งออก', 'export value'],
  ['นักท่องเที่ยว', 'visitors'],
  ['ท่องเที่ยว', 'tourism'],
  ['อาหาร', 'food'],
  ['สินค้า OTOP', 'otop goods'],
  ['หัตถกรรม', 'handicraft'],
  ['อาหารไทย', 'thai food'],
  ['มวยไทย', 'muay thai'],
  ['ภาพยนตร์', 'film'],
  ['ตราสัญลักษณ์', 'geographical indication'],
  ['แรงงานไทย', 'thai labour'],
  ['เศรษฐกิจ', 'economy'],
];

const seen = new Map();

for (const [q, label] of QUERIES) {
  let res;
  try {
    res = await client.searchPackages({ q, rows: 12, max: 12 });
  } catch (e) {
    console.log(`\n### ${label} — query failed: ${e.message}`);
    continue;
  }
  const results = res?.packages ?? [];
  console.log(`\n### ${label} — "${q}" → ${res?.count ?? 0} datasets, showing ${results.length}`);
  for (const p of results) {
    const org = p.organization?.title ?? p.organization?.name ?? '—';
    const formats = [...new Set((p.resources ?? []).map((r) => (r.format || '?').toUpperCase()))];
    const key = p.id;
    if (seen.has(key)) {
      seen.get(key).hits.push(label);
      continue;
    }
    seen.set(key, { title: p.title, org, formats, hits: [label], id: p.id });
  }
}

console.log('\n\n===== consolidated =====');
for (const v of seen.values()) {
  console.log(`\n${v.title}\n   org: ${v.org}\n   id: ${v.id}\n   formats: ${v.formats.join(', ')}\n   matched: ${v.hits.join(' / ')}`);
}
