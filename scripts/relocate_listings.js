#!/usr/bin/env node
/**
 * Re-place every listing from evidence: its own Google Maps link (re-resolved
 * through the fixed resolver) and its own address text.
 *
 *   node scripts/relocate_listings.js                      # dry run against the live DB
 *   node scripts/relocate_listings.js --apply              # write the result
 *   node scripts/relocate_listings.js --source public/data.json   # offline report
 *
 * Why this exists: the old resolver read coordinates out of Google's HTML page
 * chrome and cached them forever, and two helper scripts filled gaps with
 * hand-typed area constants. Both produced points that look exact and are not.
 * This script replaces them. It needs a network that can reach Google Maps
 * (run it on the Mac, not in a sandbox).
 *
 * What it writes, and only with --apply:
 *   - latitude/longitude = the exact point, when one is supported by the
 *     shop's own link and not contradicted by its address;
 *   - latitude/longitude = NULL, when the stored point is proven wrong
 *     (a placeholder, a fabricated cluster, or contradicted by the address).
 * Approximate placements (subdistrict/district centroids) are never written to
 * the database: they are a statement about uncertainty, recomputed from the
 * address at export time, and must not come back later disguised as a point.
 * A link that fails to resolve leaves its row untouched — a network error is
 * not evidence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolveGoogleMapsDataCached } from './geocoder_cache.js';
import { getGeoIndex } from './lib/geo.js';
import { placeListings, haversineKm } from '../src/lib/place_resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const sourceIdx = argv.indexOf('--source');
const SOURCE = sourceIdx >= 0 ? argv[sourceIdx + 1] : null;
const OFFLINE = argv.includes('--offline'); // skip link resolution (no network)

function loadFromFile(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  return rows.map((r) => ({
    id: r.id, name: r.name, location: r.location, city: r.city,
    mapsUrl: r.mapsUrl || r.maps_url || null, latitude: r.latitude, longitude: r.longitude,
  }));
}

async function loadFromDb() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY, or pass --source <file.json>');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('companions')
    .select('id, name, location, city, maps_url, latitude, longitude')
    .limit(10000);
  if (error) throw new Error(`companions: ${error.message}`);
  return {
    db,
    rows: data.map((r) => ({ ...r, mapsUrl: r.maps_url })),
  };
}

async function main() {
  const { db = null, rows } = SOURCE ? { rows: loadFromFile(SOURCE) } : await loadFromDb();
  if (APPLY && !db) throw new Error('--apply writes to the database; it cannot be combined with --source');
  console.log(`${rows.length} listings · ${APPLY ? 'APPLY' : 'dry run'}${OFFLINE ? ' · links not re-resolved' : ''}\n`);

  // 1. Re-resolve each distinct Maps link through the fixed resolver.
  const linkResult = new Map();
  if (!OFFLINE) {
    const links = [...new Set(rows.map((r) => r.mapsUrl).filter(Boolean))];
    let i = 0;
    for (const link of links) {
      i += 1;
      process.stdout.write(`\rresolving links ${i}/${links.length}`);
      let result = null;
      try { result = await resolveGoogleMapsDataCached(link); } catch { result = null; }
      linkResult.set(link, result);
    }
    process.stdout.write('\n\n');
  }

  // 2. Candidate point per row: the re-resolved link wins; a stored point that
  //    came from a link the fixed resolver cannot confirm is withdrawn.
  const candidates = rows.map((r) => {
    if (!r.mapsUrl || OFFLINE) return { ...r, _linkResolved: false };
    const res = linkResult.get(r.mapsUrl);
    if (res?.latitude && res?.longitude) return { ...r, latitude: res.latitude, longitude: res.longitude, _linkResolved: true };
    return { ...r, latitude: null, longitude: null, _linkResolved: false, _withdrawn: r.latitude != null };
  });

  // 3. Place the whole set (fabricated clusters are only visible in aggregate).
  const placed = placeListings(candidates, getGeoIndex());

  const before = {};
  const after = {};
  const writes = [];
  for (const r of rows) {
    const g = placed.get(r.id);
    const c = candidates.find((x) => x.id === r.id);
    before[r.latitude != null ? 'had a point' : 'no point'] = (before[r.latitude != null ? 'had a point' : 'no point'] || 0) + 1;
    after[g.geoPrecision] = (after[g.geoPrecision] || 0) + 1;

    const newPoint = g.geoPrecision === 'exact' ? [g.latitude, g.longitude] : null;
    const oldPoint = r.latitude != null && r.longitude != null ? [Number(r.latitude), Number(r.longitude)] : null;
    const same = (oldPoint && newPoint && haversineKm(oldPoint, newPoint) < 0.01) || (!oldPoint && !newPoint);
    // A link that failed to resolve is not evidence against the stored point
    // unless placement independently proved that point wrong.
    const provenWrong = Boolean(g.geoNote);
    if (same) continue;
    if (!newPoint && c._withdrawn && !provenWrong) continue;
    writes.push({ id: r.id, name: r.name, oldPoint, newPoint, precision: g.geoPrecision, note: g.geoNote, unit: g.geoUnit });
  }

  console.log('before:', before);
  console.log('after: ', after, '\n');
  for (const w of writes) {
    const moved = w.oldPoint && w.newPoint ? `${haversineKm(w.oldPoint, w.newPoint).toFixed(1)} km` : w.newPoint ? 'new point' : 'point withdrawn';
    const where = w.unit ? [w.unit.tambon?.th, w.unit.district?.th, w.unit.province?.th].filter(Boolean).join(' · ') : '';
    console.log(`#${w.id}`.padEnd(7), moved.padEnd(15), w.precision.padEnd(9), where, w.note ? `\n        ${w.note}` : '');
  }
  console.log(`\n${writes.length} rows would change.`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
    return;
  }
  for (const w of writes) {
    const { error } = await db.from('companions')
      .update({ latitude: w.newPoint?.[0] ?? null, longitude: w.newPoint?.[1] ?? null })
      .eq('id', w.id);
    if (error) console.error(`#${w.id}: ${error.message}`);
  }
  console.log(`Wrote ${writes.length} rows.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
