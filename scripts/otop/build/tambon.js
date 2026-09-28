#!/usr/bin/env node
/**
 * Tambon placement — resolve each record to a tambon centroid.
 */

import { loadTambons, tambonFor } from '../../../otop/core/geo.js';

export function placeRecords(merged) {
  const geo = loadTambons();
  const tambonTally = new Map();
  let placed = 0;
  for (const record of merged) {
    const code = tambonFor(record, geo);
    record.tambonCode = code;
    if (!code) continue;
    placed += 1;
    if (!tambonTally.has(code)) tambonTally.set(code, { records: 0, reachable: 0, graded4Plus: 0 });
    const t = tambonTally.get(code);
    t.records += 1;
    if (record.phone || record.email || record.website) t.reachable += 1;
    if (record.stars != null && record.stars >= 4) t.graded4Plus += 1;
  }
  const tambons = [...tambonTally].map(([code, t]) => {
    const ref = geo.byCode.get(code);
    return { code, provinceCode: ref.provinceCode, th: ref.th, en: ref.en, districtTh: ref.districtTh, lat: ref.lat, lng: ref.lng, ...t };
  }).sort((a, b) => b.records - a.records);
  const withSubdistrict = merged.filter((r) => r.subdistrict).length;
  const geoCoverage = {
    records: merged.length,
    withSubdistrict,
    placed,
    placedShare: merged.length ? Math.round((placed / merged.length) * 1000) / 10 : 0,
    unplacedWithSubdistrict: withSubdistrict - placed,
    tambonsWithRecords: tambons.length,
    tambonsInReference: geo.byCode.size,
  };
  if (withSubdistrict > 0 && placed / withSubdistrict < 0.95) {
    throw new Error(`[otop:build] tambon join placed only ${placed}/${withSubdistrict} subdistrict-bearing records — reference or normalisation drifted`);
  }
  return { tambons, geoCoverage };
}