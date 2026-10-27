#!/usr/bin/env node
/**
 * Write public/geo/admin_index.json — the browser copy of the admin index.
 *
 * Nationwide provinces and districts; subdistricts only for Greater Bangkok,
 * where the directory's supply actually sits. The pipeline resolves against
 * the full country (buildAdminIndex() with no scope) before data ever reaches
 * the browser; this copy only bridges records the pipeline has not re-placed.
 *
 *   node scripts/build_geo_index.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildAdminIndex } from './lib/geo_index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/geo/admin_index.json');

// กรุงเทพฯ, สมุทรปราการ, นนทบุรี, ปทุมธานี, นครปฐม, สมุทรสาคร
const GREATER_BANGKOK = new Set(['10', '11', '12', '13', '73', '74']);

const index = buildAdminIndex({ tambonProvinces: GREATER_BANGKOK });
const json = JSON.stringify(index);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`provinces ${index.provinces.length} · districts ${index.districts.length} · tambons ${index.tambons.length}`);
console.log(`${path.relative(process.cwd(), OUT)}  ${kb(json.length)} raw · ${kb(gzipSync(json).length)} gzip`);
