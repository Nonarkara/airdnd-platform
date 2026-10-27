/**
 * Build the administrative index the place resolver runs on.
 *
 * Source: Thailand Canonical Admin Names v1.0.0 (William J. Reynolds, CC BY 4.0)
 *   otop/data/ref/thailand-adm2-districts-v1.0.0.csv    928 districts, with bbox
 *   otop/data/ref/thailand-adm3-subdistricts-v1.0.0.csv 7,436 subdistricts
 * Province names and centroids come from otop/core/provinces.js, so the
 * directory and the OTOP registry resolve places against one spine, not two.
 *
 * Compact positional arrays keep the browser copy small:
 *   provinces [code, th, en, lat, lng, bbox, areaKm2]
 *   districts [code, provinceCode, th, en, lat, lng, bbox, areaKm2, tambonCount]
 *   tambons   [code, districtCode, th, en, lat, lng, postal]
 * bbox is [minLat, minLng, maxLat, maxLng].
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../otop/core/text_decode.js';
import { PROVINCES } from '../../otop/core/provinces.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REF_DIR = path.resolve(__dirname, '../../otop/data/ref');

function readCsv(file) {
  const [header, ...rows] = parseCsv(fs.readFileSync(path.join(REF_DIR, file), 'utf8'));
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

const round = (v, dp = 5) => Number(Number(v).toFixed(dp));

/**
 * @param {object} [opts]
 * @param {Set<string>|null} [opts.tambonProvinces] limit subdistricts to these
 *   province codes (the browser copy); null keeps the whole country.
 */
export function buildAdminIndex({ tambonProvinces = null } = {}) {
  const districtRows = readCsv('thailand-adm2-districts-v1.0.0.csv');
  const tambonRows = readCsv('thailand-adm3-subdistricts-v1.0.0.csv');

  const districts = districtRows.map((d) => [
    d.tis1099_district_code,
    d.parent_province_tis1099_code,
    d.name_th,
    d.name_en,
    round(d.centroid_lat),
    round(d.centroid_lon),
    [round(d.bbox_minlat), round(d.bbox_minlon), round(d.bbox_maxlat), round(d.bbox_maxlon)],
    Number(d.area_km2) || null,
    Number(d.num_tambon) || null,
  ]);

  const provinceBox = new Map();
  const provinceArea = new Map();
  for (const [, pcode, , , , , [a, b, c, d], area] of districts) {
    const box = provinceBox.get(pcode) || [90, 180, -90, -180];
    provinceBox.set(pcode, [Math.min(box[0], a), Math.min(box[1], b), Math.max(box[2], c), Math.max(box[3], d)]);
    provinceArea.set(pcode, (provinceArea.get(pcode) || 0) + (area || 0));
  }

  const provinces = PROVINCES.map((p) => {
    const code = String(p.code).padStart(2, '0');
    return [code, p.th, p.en, round(p.lat), round(p.lng), provinceBox.get(code) || null, Math.round(provinceArea.get(code) || 0) || null];
  });

  const tambons = tambonRows
    .filter((t) => !tambonProvinces || tambonProvinces.has(t.parent_province_tis1099_code))
    .map((t) => [
      t.tis1099_subdistrict_code,
      t.parent_district_tis1099_code,
      t.name_th,
      t.name_en,
      round(t.centroid_lat),
      round(t.centroid_lon),
      t.postal_code || null,
    ]);

  return {
    version: 1,
    source: 'Thailand Canonical Admin Names v1.0.0 (William J. Reynolds), CC BY 4.0',
    tambonScope: tambonProvinces ? [...tambonProvinces].sort() : 'all',
    provinces,
    districts,
    tambons,
  };
}
