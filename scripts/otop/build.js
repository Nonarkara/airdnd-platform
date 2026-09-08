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
import { discoverFieldMap, isUsableMapping, applyFieldMap } from '../../otop/core/field_map.js';
import { buildRecord, gradeRecord, mergeRecords } from '../../otop/core/record.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(ROOT, 'otop/data/raw');
const FIXTURE_DIR = path.join(ROOT, 'otop/fixtures');
const OUT_DIR = path.join(ROOT, 'otop/public');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'otop.config.json'), 'utf8'));

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

function readCache(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
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

  const records = [];
  const resourceReports = [];
  const rejectTally = new Map();

  for (const entry of cache) {
    const headers = entry.fields?.length ? entry.fields : Object.keys(entry.rows[0] ?? {});
    const { map, unmapped, ambiguous } = discoverFieldMap(headers, CONFIG.fieldAliases);
    const usable = isUsableMapping(map);

    const report = {
      resourceId: entry.resourceId,
      datasetTitle: entry.datasetTitle,
      organization: entry.organization,
      method: entry.method,
      encoding: entry.encoding ?? null,
      rowsIn: entry.rows.length,
      usable,
      mappedFields: Object.keys(map).length,
      map,
      unmappedColumns: unmapped,
      ambiguous,
      rowsAccepted: 0,
      rowsRejected: 0,
    };

    if (!usable) {
      // Loud skip. A resource dropped for lack of a name or area column is
      // reported with its columns so the alias dictionary can be extended,
      // rather than vanishing into a row count that never adds up.
      report.skipReason = 'no name column and/or no area column after field discovery';
      resourceReports.push(report);
      console.warn(`[otop:build] SKIP ${entry.datasetTitle ?? entry.resourceId} — ${report.skipReason}; columns: ${headers.slice(0, 12).join(', ')}`);
      continue;
    }

    const provenance = {
      datasetId: entry.datasetId,
      datasetTitle: entry.datasetTitle ?? null,
      resourceId: entry.resourceId,
      organization: entry.organization ?? null,
      retrievedAt: entry.retrievedAt ?? null,
      licence: entry.licence ?? null,
    };

    entry.rows.forEach((row, index) => {
      const mapped = applyFieldMap(row, map);
      mapped.sourceRowId = `${entry.resourceId}#${index}`;
      const record = buildRecord(mapped, provenance);
      const grade = gradeRecord(record);
      if (grade.ok) {
        records.push(record);
        report.rowsAccepted += 1;
      } else {
        report.rowsRejected += 1;
        for (const reason of grade.rejects) rejectTally.set(reason, (rejectTally.get(reason) ?? 0) + 1);
      }
    });

    resourceReports.push(report);
    console.log(`[otop:build] ${entry.datasetTitle ?? entry.resourceId}: ${report.rowsAccepted} accepted, ${report.rowsRejected} rejected`);
  }

  const merged = mergeRecords(records).sort((a, b) => {
    const province = (a.province ?? '').localeCompare(b.province ?? '', 'th');
    if (province !== 0) return province;
    return (a.productName ?? a.producerName ?? '').localeCompare(b.productName ?? b.producerName ?? '', 'th');
  });

  // Two different questions, kept apart on purpose: what *merged* a group
  // (null for singletons), and what identity a record can support at all.
  const mergeBasis = {};
  const strongestSignal = {};
  for (const r of merged) {
    if (r.mergeBasis) mergeBasis[r.mergeBasis] = (mergeBasis[r.mergeBasis] ?? 0) + 1;
    strongestSignal[r.strongestSignal] = (strongestSignal[r.strongestSignal] ?? 0) + 1;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'otop.json'), JSON.stringify(merged));

  const degraded = source === 'fixture';
  const meta = {
    builtAt: new Date().toISOString(),
    source,
    degraded,
    reason: degraded
      ? 'Built from the committed development fixture, NOT from data.go.th. These records are synthetic and exist only to exercise the pipeline. Run `npm run otop:fetch` from a network that can reach data.go.th, then rebuild.'
      : null,
    portal: CONFIG.source.portal,
    counts: {
      resourcesCached: cache.length,
      resourcesUsable: resourceReports.filter((r) => r.usable).length,
      rowsIn: resourceReports.reduce((n, r) => n + r.rowsIn, 0),
      rowsAccepted: records.length,
      rowsRejected: resourceReports.reduce((n, r) => n + r.rowsRejected, 0),
      recordsAfterMerge: merged.length,
      duplicatesCollapsed: records.length - merged.length,
    },
    rejectReasons: Object.fromEntries(rejectTally),
    mergeBasis,
    strongestSignal,
    mergedRecords: merged.filter((r) => r.mergedFrom > 1).length,
    resources: resourceReports,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'otop_meta.json'), JSON.stringify(meta, null, 2));

  console.log(
    `[otop:build] ${meta.counts.rowsAccepted} accepted → ${merged.length} records ` +
      `(${meta.counts.duplicatesCollapsed} duplicates collapsed) · degraded=${degraded}`,
  );
  console.log(`[otop:build] merged by: ${Object.entries(mergeBasis).map(([k, v]) => `${k}=${v}`).join(' ') || '(nothing merged)'}`);
  console.log(`[otop:build] strongest signal available: ${Object.entries(strongestSignal).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

main();
