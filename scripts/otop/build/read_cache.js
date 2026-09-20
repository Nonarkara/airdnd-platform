#!/usr/bin/env node
/**
 * Read cached data from disk.
 *
 * Supports two sources:
 *   - raw: data.go.th (simulated data)
 *   - fixture: fixtures/ (pre-populated test data)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const RAW_DIR = path.join(ROOT, 'otop/data/raw');
const FIXTURE_DIR = path.join(ROOT, 'otop/fixtures');

function readCache(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch (e) {
        console.warn(`[otop:build] corrupt cache file ${f}: ${e.message}. Skipping.`);
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry) => Array.isArray(entry.rows) && entry.rows.length > 0);
}

function resolveSource(requested) {
  if (requested === 'fixture') return { dir: FIXTURE_DIR, source: 'fixture' };
  if (requested === 'raw') return { dir: RAW_DIR, source: 'data.go.th' };

  const raw = readCache(RAW_DIR);
  return raw.length > 0
    ? { dir: RAW_DIR, source: 'data.go.th' }
    : { dir: FIXTURE_DIR, source: 'fixture' };
}

export { readCache, resolveSource };