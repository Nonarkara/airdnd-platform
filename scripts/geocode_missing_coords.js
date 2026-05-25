import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveGoogleMapsDataCached as resolveGoogleMapsData } from './geocoder_cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const apply = process.argv.includes('--apply');

async function run() {
  console.log('\n=== GEOCODE MISSING COORDINATES ===');
  console.log('Mode:', apply ? 'APPLY (writes to DB)' : 'DRY RUN');
  console.log('');

  const { data: rows, error } = await supabase
    .from('companions')
    .select('id, name, location, maps_url, latitude, longitude')
    .or('latitude.is.null,longitude.is.null')
    .limit(10000);

  if (error) {
    console.error('Failed to load:', error.message);
    process.exit(1);
  }

  console.log('Candidates (have maps_url, missing coords):', rows.length);
  console.log('');

  const cache = new Map();
  const updates = [];
  const failures = [];

const LOCATION_FALLBACKS = {
  'กรุงเทพและปริมณฑล': { lat: 13.7563, lng: 100.5018 },
  'bangkok, thailand': { lat: 13.7563, lng: 100.5018 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'นนทบุรีปากเกร็ด': { lat: 13.9133, lng: 100.4988 },
  'ท่าน้ำนนท์, nonthaburi': { lat: 13.8443, lng: 100.4930 },
  'sukhumvit 22, bangkok': { lat: 13.7317, lng: 100.5651 },
  'สุขุมวิท 22, กรุงเทพฯ': { lat: 13.7317, lng: 100.5651 },
  'พริตตี้สปาa5 massage สุขุมวิท22': { lat: 13.7317, lng: 100.5651 },
  'ร้าน📌:ประดิษฐ์มนูธรรมซอย 9': { lat: 13.7915, lng: 100.6120 },
  'เคหะร่มเกล้า 74': { lat: 13.7668, lng: 100.7258 },
  'ร้านนวดแก้ว มาซซาส 📍สาขาลาดปลาดุก': { lat: 13.8967, lng: 100.4072 },
  'ลาดพร้าว 71': { lat: 13.8055, lng: 100.6067 },
  'รามอินทรา14': { lat: 13.8426, lng: 100.6180 }
};

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${row.name?.slice(0, 40) || row.id} ... `);

    let mapsData = null;

    if (row.maps_url) {
      if (!cache.has(row.maps_url)) {
        try {
          cache.set(row.maps_url, await resolveGoogleMapsData(row.maps_url));
        } catch (err) {
          cache.set(row.maps_url, null);
        }
      }
      mapsData = cache.get(row.maps_url);
    }

    if (!mapsData?.latitude || !mapsData?.longitude) {
      // Check fallback dictionary
      const locKey = String(row.location).trim().toLowerCase();
      if (LOCATION_FALLBACKS[locKey]) {
         mapsData = {
           latitude: LOCATION_FALLBACKS[locKey].lat,
           longitude: LOCATION_FALLBACKS[locKey].lng,
           address: row.location
         };
      }
    }

    if (!mapsData?.latitude || !mapsData?.longitude) {
      failures.push({ id: row.id, name: row.name, reason: 'no coords resolved and no fallback' });
      console.log('NO COORDS');
      continue;
    }

    updates.push({
      id: row.id,
      latitude: mapsData.latitude,
      longitude: mapsData.longitude,
      location: row.location && !/^bangkok,?\s*thailand$/i.test(row.location)
        ? row.location
        : (mapsData.address || row.location),
    });
    console.log(`OK (${mapsData.latitude.toFixed(4)}, ${mapsData.longitude.toFixed(4)})`);
  }

  console.log('');
  console.log('Resolved successfully:', updates.length);
  console.log('Failed/unresolvable:', failures.length);

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write coordinates.');
    return;
  }

  console.log('\nApplying updates...');
  let updated = 0;
  for (const u of updates) {
    const { error: updateError } = await supabase
      .from('companions')
      .update({ latitude: u.latitude, longitude: u.longitude, location: u.location, updated_at: new Date().toISOString() })
      .eq('id', u.id);

    if (updateError) {
      console.error(`  FAIL id=${u.id}: ${updateError.message}`);
    } else {
      updated += 1;
    }
  }

  console.log(`\nUpdated ${updated} of ${updates.length} listings with coordinates.`);
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
