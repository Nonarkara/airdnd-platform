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
    .not('maps_url', 'is', null)
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

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${row.name?.slice(0, 40) || row.id} ... `);

    if (!cache.has(row.maps_url)) {
      try {
        cache.set(row.maps_url, await resolveGoogleMapsData(row.maps_url));
      } catch (err) {
        cache.set(row.maps_url, null);
        failures.push({ id: row.id, name: row.name, reason: err.message });
        console.log('FAIL (' + err.message.slice(0, 50) + ')');
        continue;
      }
    }

    const mapsData = cache.get(row.maps_url);
    if (!mapsData?.latitude || !mapsData?.longitude) {
      failures.push({ id: row.id, name: row.name, reason: 'no coords resolved' });
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
