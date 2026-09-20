#!/usr/bin/env node
/**
 * Write the metadata sidecar.
 */

import fs from 'node:fs';
import path from 'node:path';

const FLAT_LIMIT = 20_000;

export function writeMeta(OUT_DIR, source, degraded, config, cacheLength, recordsLength, merged, resourceReports, rejectTally, certAsOf, geoCoverage, shards) {
  const flatPath = path.join(OUT_DIR, 'otop.json');
  if (merged.length <= FLAT_LIMIT) {
    fs.writeFileSync(flatPath, JSON.stringify(merged));
  } else if (fs.existsSync(flatPath)) {
    fs.rmSync(flatPath);
    console.warn(`[otop:build] ${merged.length} records exceeds the ${FLAT_LIMIT} flat-file limit — removed stale otop.json; use the province shards`);
  }

  const mergeBasis = {};
  const strongestSignal = {};
  for (const r of merged) {
    if (r.mergeBasis) mergeBasis[r.mergeBasis] = (mergeBasis[r.mergeBasis] ?? 0) + 1;
    strongestSignal[r.strongestSignal] = (strongestSignal[r.strongestSignal] ?? 0) + 1;
  }

  const meta = {
    builtAt: new Date().toISOString(),
    source,
    degraded,
    reason: degraded
      ? 'Built from the committed development fixture, NOT from data.go.th. These records are synthetic and exist only to exercise the pipeline. Run `npm run otop:fetch` from a network that can reach data.go.th, then rebuild.'
      : null,
    portal: config.source.portal,
    shardCount: shards.length,
    flatFileWritten: merged.length <= FLAT_LIMIT,
    counts: {
      resourcesCached: cacheLength,
      resourcesUsable: resourceReports.filter((r) => r.usable).length,
      resourcesSkipped: resourceReports.filter((r) => !r.usable).length,
      resourcesAggregateEconomic: resourceReports.filter((r) => r.kind === 'aggregate-economic').length,
      resourcesExcludedByTitle: resourceReports.filter((r) => r.skipReason?.startsWith('excluded by title')).length,
      rowsIn: resourceReports.reduce((n, r) => n + r.rowsIn, 0),
      rowsAccepted: recordsLength,
      rowsRejected: resourceReports.reduce((n, r) => n + r.rowsRejected, 0),
      recordsAfterMerge: merged.length,
      duplicatesCollapsed: recordsLength - merged.length,
      tambonPlaced: geoCoverage.placed,
      certified: merged.filter((r) => r.certs.length > 0).length,
      certValid: merged.filter((r) => r.certStatus === 'valid').length,
      certExpired: merged.filter((r) => r.certStatus === 'expired').length,
      certUnknown: merged.filter((r) => r.certStatus === 'unknown').length,
      certAsOf,
    },
    geo: geoCoverage,
    rejectReasons: Object.fromEntries(rejectTally),
    mergeBasis,
    strongestSignal,
    mergedRecords: merged.filter((r) => r.mergedFrom > 1).length,
    resources: resourceReports,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'otop_meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}