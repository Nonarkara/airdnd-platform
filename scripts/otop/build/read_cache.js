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
    // SORTED, so the order the cache is read in does not depend on the
    // filesystem's directory order.
    //
    // The README claimed stage ② was pure — same files in, byte-identical
    // output. It was not quite true: the merge order, and therefore the
    // order of the certificates inside each record, followed whatever order
    // readdirSync happened to return. The certificate VALUES were
    // order-independent (the first non-empty value for each field wins), so
    // the numbers never moved — but the bytes did, and two builds of the
    // same cache could disagree on disk.
    //
    // A build that is claimed to be reproducible has to be reproducible in
    // its bytes, not only in its conclusions.
    .sort()
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