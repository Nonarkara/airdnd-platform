#!/usr/bin/env node
/**
 * Write the national index, flat file, and metadata sidecar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PROVINCES } from '../../../otop/core/provinces.js';
import { CATEGORIES } from '../../../otop/core/taxonomy.js';

export function writeIndex(OUT_DIR, source, degraded, shards, merged) {
  const index = {
    builtAt: new Date().toISOString(),
    source,
    degraded,
    totals: {
      records: merged.length,
      producers: new Set(merged.map((r) => r.identityKey)).size,
      provincesWithRecords: shards.length,
      provincesTotal: PROVINCES.length,
    },
    categories: CATEGORIES.map((c) => ({ id: c.id, th: c.th, en: c.en })),
    provinces: shards,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'otop_index.json'), JSON.stringify(index));
  return index;
}