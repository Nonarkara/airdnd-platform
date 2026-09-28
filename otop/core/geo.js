/**
 * Tambon placement.
 *
 * The registry records no producer coordinates (0.43% carry any), but 87.9%
 * of records name their ตำบล. A tambon is an administrative unit the record
 * itself asserts, so placing the record at that tambon's centroid is not
 * geocoding an address — it is drawing the unit the source already named, at
 * the precision the source already has. The map caption says so.
 *
 * Reference: Thailand Canonical Admin Names v1.0.0 (William J. Reynolds,
 * CC BY 4.0) — 7,436 ADM3 centroids keyed by TIS-1099 code.
 *   otop/data/ref/thailand-adm3-subdistricts-v1.0.0.csv
 *   otop/data/ref/thailand-adm2-districts-v1.0.0.csv
 *
 * Join: (province code, district name, tambon name) exact; fall back to
 * (province code, tambon name) only when that name is unique within the
 * province. Never guess across an ambiguity — an unplaced record is honest,
 * a mis-placed one is a lie on a map.
 *
 * ponytail: name-key join, 99.7% exact on the live registry. Misses are source
 * junk ('FALSE', '0') and a handful of renamed tambons; upgrade path is an
 * alias table like provinces.js if the miss list ever grows.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvToObjects } from './text_decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(__dirname, '../data/ref');
export const GEO_SOURCE = {
  name: 'Thailand Canonical Admin Names v1.0.0',
  author: 'William J. Reynolds',
  licence: 'CC BY 4.0',
  url: 'https://github.com/DevelopedbyWill/thailand-canonical-admin-names',
};

/** Area-name key: strips the administrative prefix the registry sometimes carries. */
export function areaNameKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/^(?:กิ่งอำเภอ|อำเภอ|อ\.|เขต|ตำบล|ต\.|แขวง)\s*/u, '')
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '')
    .toLowerCase();
}

/** @returns {{ byCode: Map<string, object>, exact: Map<string,string>, byTambon: Map<string,string[]> }} */
export function loadTambons(refDir = REF) {
  const adm2 = csvToObjects(fs.readFileSync(path.join(refDir, 'thailand-adm2-districts-v1.0.0.csv'), 'utf8'));
  const adm3 = csvToObjects(fs.readFileSync(path.join(refDir, 'thailand-adm3-subdistricts-v1.0.0.csv'), 'utf8'));
  const districtName = new Map(adm2.map((d) => [d.tis1099_district_code, d.name_th]));

  const byCode = new Map();
  const exact = new Map();
  const byTambon = new Map();
  for (const t of adm3) {
    const code = t.tis1099_subdistrict_code;
    const provinceCode = Number(t.parent_province_tis1099_code);
    byCode.set(code, {
      code,
      provinceCode,
      districtCode: t.parent_district_tis1099_code,
      th: t.name_th,
      en: t.name_en,
      districtTh: districtName.get(t.parent_district_tis1099_code) ?? null,
      lat: Number(t.centroid_lat),
      lng: Number(t.centroid_lon),
    });
    const tKey = areaNameKey(t.name_th);
    exact.set(`${provinceCode}:${areaNameKey(districtName.get(t.parent_district_tis1099_code))}:${tKey}`, code);
    const k = `${provinceCode}:${tKey}`;
    if (!byTambon.has(k)) byTambon.set(k, []);
    byTambon.get(k).push(code);
  }
  if (byCode.size < 7000) throw new Error(`[otop:geo] only ${byCode.size} tambons loaded from ${refDir} — reference file truncated?`);
  return { byCode, exact, byTambon };
}

/** TIS-1099 tambon code for a record, or null when it cannot be placed honestly. */
export function tambonFor(record, index) {
  if (record.provinceCode == null || !record.subdistrict) return null;
  const tKey = areaNameKey(record.subdistrict);
  if (!tKey) return null;
  const hit = index.exact.get(`${record.provinceCode}:${areaNameKey(record.district)}:${tKey}`);
  if (hit) return hit;
  const candidates = index.byTambon.get(`${record.provinceCode}:${tKey}`);
  return candidates && candidates.length === 1 ? candidates[0] : null;
}
