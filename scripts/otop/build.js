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
import { discoverFieldMap, isUsableMapping, applyFieldMap, classifyResource } from '../../otop/core/field_map.js';
import { PROVINCE_BY_CODE, PROVINCES } from '../../otop/core/provinces.js';
import { CATEGORIES } from '../../otop/core/taxonomy.js';
import { buildRecord, gradeRecord, mergeRecords } from '../../otop/core/record.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(ROOT, 'otop/data/raw');
const FIXTURE_DIR = path.join(ROOT, 'otop/fixtures');
const OUT_DIR = path.join(ROOT, 'otop/public');
const SHARD_DIR = path.join(OUT_DIR, 'p');
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
    const kind = classifyResource({ title: entry.datasetTitle, map, unmapped });
    const excluded = (CONFIG.excludeTitles ?? []).find((p) => new RegExp(p).test(entry.datasetTitle ?? ''));
    // A resource is a producer list only if it has a name + area AND that name
    // is not a monetary field AND its title is not on the exclusion list
    // (ร้านธงฟ้า retail outlets are a Commerce programme, not OTOP producers).
    const usable = isUsableMapping(map) && kind !== 'aggregate-economic' && !excluded;

    const report = {
      resourceId: entry.resourceId,
      datasetTitle: entry.datasetTitle,
      organization: entry.organization,
      method: entry.method,
      encoding: entry.encoding ?? null,
      rowsIn: entry.rows.length,
      usable,
      kind: excluded ? 'other' : kind,
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
      report.skipReason = excluded
        ? `excluded by title (${excluded}): not an OTOP producer list`
        : kind === 'aggregate-economic' && isUsableMapping(map)
          ? 'name column is a monetary field — an aggregate series, not producers'
          : 'no name column and/or no area column after field discovery';
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

  // ── publish ───────────────────────────────────────────────────────────────
  //
  // Sharded by province, ALWAYS — including at fixture scale.
  //
  // The "OTOP" search on data.go.th runs to ~28 pages of datasets. A national
  // pull is plausibly hundreds of thousands of records, and a single otop.json
  // would be tens of megabytes: too slow for a static host and impossible to
  // filter client-side. Sharding solves that, but only if the *same* path runs
  // in development. A build that shards only when it happens to be large ships
  // a loading path nobody ever exercised until production, which is how "works
  // on my machine" gets deployed.
  fs.mkdirSync(SHARD_DIR, { recursive: true });
  for (const stale of fs.readdirSync(SHARD_DIR)) {
    if (stale.endsWith('.json')) fs.rmSync(path.join(SHARD_DIR, stale));
  }

  const byProvince = new Map();
  for (const record of merged) {
    if (record.provinceCode == null) continue; // gated out already; belt and braces
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
      latestFiling: items.reduce((y, r) => (r.registeredYear != null && (y == null || r.registeredYear > y) ? r.registeredYear : y), null),
    });
  }

  // The index is what the app loads first: the whole national picture, small
  // enough to arrive instantly, and enough per-province detail for the matching
  // engine to decide which shards are worth fetching at all.
  const index = {
    builtAt: new Date().toISOString(),
    source,
    degraded: source === 'fixture',
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

  // A whole-corpus file is a convenience for spreadsheet work and scripting,
  // not a load path. Above the threshold it is not written, and any stale copy
  // is removed rather than left to be served as a silently truncated dataset.
  const FLAT_LIMIT = 20_000;
  const flatPath = path.join(OUT_DIR, 'otop.json');
  if (merged.length <= FLAT_LIMIT) {
    fs.writeFileSync(flatPath, JSON.stringify(merged));
  } else if (fs.existsSync(flatPath)) {
    fs.rmSync(flatPath);
    console.warn(`[otop:build] ${merged.length} records exceeds the ${FLAT_LIMIT} flat-file limit — removed stale otop.json; use the province shards`);
  }

  // Two different questions, kept apart on purpose: what *merged* a group
  // (null for singletons), and what identity a record can support at all.
  const mergeBasis = {};
  const strongestSignal = {};
  for (const r of merged) {
    if (r.mergeBasis) mergeBasis[r.mergeBasis] = (mergeBasis[r.mergeBasis] ?? 0) + 1;
    strongestSignal[r.strongestSignal] = (strongestSignal[r.strongestSignal] ?? 0) + 1;
  }

  const degraded = source === 'fixture';
  const meta = {
    builtAt: new Date().toISOString(),
    source,
    degraded,
    reason: degraded
      ? 'Built from the committed development fixture, NOT from data.go.th. These records are synthetic and exist only to exercise the pipeline. Run `npm run otop:fetch` from a network that can reach data.go.th, then rebuild.'
      : null,
    portal: CONFIG.source.portal,
    shardCount: shards.length,
    flatFileWritten: merged.length <= FLAT_LIMIT,
    counts: {
      resourcesCached: cache.length,
      resourcesUsable: resourceReports.filter((r) => r.usable).length,
      resourcesSkipped: resourceReports.filter((r) => !r.usable).length,
      // Pinned to classifyResource() — the one definition of "economic aggregate".
      resourcesAggregateEconomic: resourceReports.filter((r) => r.kind === 'aggregate-economic').length,
      resourcesExcludedByTitle: resourceReports.filter((r) => r.skipReason?.startsWith('excluded by title')).length,
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
  console.log(`[otop:build] ${shards.length} province shards written to otop/public/p/`);
  console.log(`[otop:build] merged by: ${Object.entries(mergeBasis).map(([k, v]) => `${k}=${v}`).join(' ') || '(nothing merged)'}`);
  console.log(`[otop:build] strongest signal available: ${Object.entries(strongestSignal).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

main();
