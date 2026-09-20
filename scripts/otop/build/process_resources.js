#!/usr/bin/env node
/**
 * Process each cached resource: discover field maps, build records, grade them.
 *
 * Returns { records, resourceReports, rejectTally }.
 */

import { discoverFieldMap, isUsableMapping, applyFieldMap, classifyResource } from '../../../otop/core/field_map.js';
import { buildRecord, gradeRecord } from '../../../otop/core/record.js';

export function processResources(cache, CONFIG) {
  const records = [];
  const resourceReports = [];
  const rejectTally = new Map();

  for (const entry of cache) {
    const headers = entry.fields?.length ? entry.fields : Object.keys(entry.rows[0] ?? {});
    const { map, unmapped, ambiguous } = discoverFieldMap(headers, CONFIG.fieldAliases);
    const kind = classifyResource({ title: entry.datasetTitle, map, unmapped });
    const excluded = (CONFIG.excludeTitles ?? []).find((p) => new RegExp(p).test(entry.datasetTitle ?? ''));
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

  return { records, resourceReports, rejectTally };
}
