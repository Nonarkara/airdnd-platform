#!/usr/bin/env node
/**
 * Write province shards and the national index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../../otop/core/taxonomy.js';
import { PROVINCE_BY_CODE } from '../../../otop/core/provinces.js';

export function writeShards(OUT_DIR, SHARD_DIR, merged) {
  fs.mkdirSync(SHARD_DIR, { recursive: true });
  for (const stale of fs.readdirSync(SHARD_DIR)) {
    if (stale.endsWith('.json')) fs.rmSync(path.join(SHARD_DIR, stale));
  }

  const byProvince = new Map();
  for (const record of merged) {
    if (record.provinceCode == null) continue;
    if (!byProvince.has(record.provinceCode)) byProvince.set(record.provinceCode, []);
    byProvince.get(record.provinceCode).push(record);
  }

  const shards = [];
  for (const [code, items] of [...byProvince].sort((a, b) => a[0] - b[0])) {
    const file = path.join(SHARD_DIR, `${code}.json`);
    fs.writeFileSync(file, JSON.stringify(items));
    const province = PROVINCE_BY_CODE.get(code);
    shards.push({
      code,
      th: province?.th ?? null,
      en: province?.en ?? null,
      region: province?.region ?? null,
      records: items.length,
      producers: new Set(items.map((r) => r.identityKey)).size,
      bytes: fs.statSync(file).size,
      categories: Object.fromEntries(
        CATEGORIES.map((c) => [c.id, items.filter((r) => r.category === c.id).length]),
      ),
      unclassified: items.filter((r) => !r.category).length,
      stars: Object.fromEntries([0, 1, 2, 3, 4, 5].map((s) => [s, items.filter((r) => r.stars === s).length])),
      graded: items.filter((r) => r.stars != null).length,
      reachable: items.filter((r) => r.phone || r.email || r.website).length,
      corroborated: items.filter((r) => r.sourceCount > 1).length,
      certified: items.filter((r) => r.certs.length > 0).length,
      certValid: items.filter((r) => r.certStatus === 'valid').length,
      latestFiling: items.reduce((y, r) => (r.registeredYear != null && (y == null || r.registeredYear > y) ? r.registeredYear : y), null),
    });
  }
  return shards;
}