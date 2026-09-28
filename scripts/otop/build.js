#!/usr/bin/env node
/**
 * Stage 2 of 2 — turn the raw cache into the canonical OTOP dataset.
 *
 * Pure function of files on disk. No network. Reproducible: same inputs, same
 * output, so a reviewer can rerun it and get byte-identical results.
 *
 * The output is a pair:
 *   otop/public/otop.json       — a bare array of canonical records
 *   otop/public/otop_meta.json  — provenance, counts, rejects, and `degraded`
 *
 * The sidecar is not optional. Sabai Sabai shipped a LIVE tab that was a
 * byte-for-byte copy of its directory for six days because a fallback silently
 * changed the *shape* of the data and wrote it to the same filename with no
 * marker (tasks/lessons.md · 2026-08-24). Here the equivalent hazard is running
 * against the fixture and presenting it as national open data. So: the source
 * is named in the sidecar, the frontend reads the sidecar, and a fixture build
 * is `degraded: true` with a reason string that says so in plain words.
 *
 * Usage:
 *   node scripts/otop/build.js                 # raw cache if present, else fixture
 *   node scripts/otop/build.js --source raw
 *   node scripts/otop/build.js --source fixture
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCache, resolveSource } from './build/read_cache.js';
import { processResources } from './build/process_resources.js';
import { calculateCertStatus } from './build/certificate.js';
import { placeRecords } from './build/tambon.js';
import { writeShards } from './build/shards.js';
import { writeIndex } from './build/index.js';
import { writeMeta } from './build/meta.js';
import { mergeRecords } from '../../otop/core/record.js';
import { GEO_SOURCE } from '../../otop/core/geo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'otop/public');
const SHARD_DIR = path.join(OUT_DIR, 'p');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'otop.config.json'), 'utf8'));

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

function main() {
  const { dir, source } = resolveSource(arg('source'));
  const cache = readCache(dir);

  if (cache.length === 0) {
    console.error(`[otop:build] no usable cache in ${path.relative(ROOT, dir)}.`);
    console.error('[otop:build] run `npm run otop:fetch` from a network that can reach data.go.th.');
    process.exitCode = 1;
    return;
  }

  console.log(`[otop:build] source=${source} · ${cache.length} cached resources`);

  const { records, resourceReports, rejectTally } = processResources(cache, CONFIG);
  const merged = mergeRecords(records).sort((a, b) => {
    const province = (a.province ?? '').localeCompare(b.province ?? '', 'th');
    if (province !== 0) return province;
    return (a.productName ?? a.producerName ?? '').localeCompare(b.productName ?? b.producerName ?? '', 'th');
  });

  // ── certification standing ────────────────────────────────────────────
  const certAsOf = new Date().toISOString().slice(0, 10);
  calculateCertStatus(merged, certAsOf);

  // ── tambon placement ──────────────────────────────────────────────────────
  const { tambons, geoCoverage } = placeRecords(merged);
  fs.writeFileSync(path.join(OUT_DIR, 'otop_tambons.json'), JSON.stringify({
    builtAt: new Date().toISOString(),
    source: GEO_SOURCE,
    precision: 'tambon centroid — the administrative unit the record names, not the producer address',
    coverage: geoCoverage,
    tambons,
  }));
  console.log(`[otop:build] tambon placement: ${geoCoverage.placed}/${geoCoverage.withSubdistrict} subdistrict-bearing records placed (${geoCoverage.placedShare}% of all) across ${tambons.length} tambons`);

  // ── publish ───────────────────────────────────────────────────────────────
  const shards = writeShards(OUT_DIR, SHARD_DIR, merged);

  // The index is what the app loads first: the whole national picture, small
  // enough to arrive instantly, and enough per-province detail for the matching
  // engine to decide which shards are worth fetching at all.
  writeIndex(OUT_DIR, source, source === 'fixture', shards, merged);

  // Two different questions, kept apart on purpose: what *merged* a group
  // (null for singletons), and what identity a record can support at all.
  const meta = writeMeta(OUT_DIR, source, source === 'fixture', CONFIG, cache.length, records.length, merged, resourceReports, rejectTally, certAsOf, geoCoverage, shards);

  console.log(
    `[otop:build] ${meta.counts.rowsAccepted} accepted → ${merged.length} records ` +
      `(${meta.counts.duplicatesCollapsed} duplicates collapsed) · degraded=${meta.degraded}`,
  );
  console.log(`[otop:build] ${shards.length} province shards written to otop/public/p/`);
  console.log(`[otop:build] merged by: ${Object.entries(meta.mergeBasis).map(([k, v]) => `${k}=${v}`).join(' ') || '(nothing merged)'}`);
  console.log(`[otop:build] strongest signal available: ${Object.entries(meta.strongestSignal).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

main();