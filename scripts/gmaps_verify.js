/**
 * gmaps_verify.js — Batch Google Maps verification for Sabai Sabai listings
 *
 * For each listing, uses the Google Places Text Search API to:
 *   1. Search by business name + city
 *   2. Compare returned name, address, phone against scraped data
 *   3. Write results to Supabase: maps_verified, maps_name, maps_address, maps_phone, phone_match
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=AIza... node scripts/gmaps_verify.js
 *   GOOGLE_MAPS_API_KEY=AIza... node scripts/gmaps_verify.js --dry-run   (no DB writes)
 *   GOOGLE_MAPS_API_KEY=AIza... node scripts/gmaps_verify.js --limit 20   (first 20 only)
 *
 * Requires: GOOGLE_MAPS_API_KEY in env (or .env)
 *           VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY for DB writes
 *
 * Free tier: 2,500 requests/month · $0.017/request beyond that
 * At 73 listings: ~73 requests = $0 cost on free tier.
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : Infinity;
const DELAY_MS = 300; // stay well within 50 QPS limit

if (!API_KEY) {
  console.error('❌  GOOGLE_MAPS_API_KEY not set. Run with: GOOGLE_MAPS_API_KEY=AIza... node scripts/gmaps_verify.js');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
);

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizePhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '').replace(/^0/, '+66');
}

function phoneMatch(scraped, googled) {
  if (!scraped || !googled) return false;
  const a = normalizePhone(scraped);
  const b = normalizePhone(String(googled).replace(/\D/g, '').replace(/^0/, '+66'));
  // Last 9 digits sufficient — country prefix varies
  return a.slice(-9) === b.slice(-9);
}

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
  const ca = clean(a), cb = clean(b);
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) return 0.8;
  return 0;
}

// ── Google Places Text Search ──────────────────────────────────────────────

async function searchPlace(name, city) {
  const query = encodeURIComponent(`${name} massage ${city || ''} Thailand`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API status: ${json.status}`);
  }
  return json.results?.[0] || null;
}

// Get phone from Place Details (requires a second call — only when text search found a match)
async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,rating&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place Details HTTP ${res.status}`);
  const json = await res.json();
  return json.result || null;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🔍  Sabai Sabai · Google Maps Verification${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`    API key: ${API_KEY.slice(0, 8)}…\n`);

  // Load listings from Supabase
  const { data: listings, error } = await supabase
    .from('companions')
    .select('id, name, location, city, phone, maps_url')
    .is('maps_verified', null)   // only unverified
    .order('mention_count', { ascending: false });

  if (error) {
    console.error('❌  Supabase error:', error.message);
    process.exit(1);
  }

  const targets = listings.slice(0, LIMIT);
  console.log(`📋  ${targets.length} listings to verify (${listings.length} total unverified)\n`);

  let confirmed = 0, notFound = 0, phoneMismatch = 0;

  for (let i = 0; i < targets.length; i++) {
    const listing = targets[i];
    const city = listing.city || listing.location || 'Bangkok';
    process.stdout.write(`[${String(i + 1).padStart(3)}/${targets.length}] ${listing.name} (${city}) … `);

    try {
      const place = await searchPlace(listing.name, city);

      if (!place) {
        console.log('NOT FOUND');
        notFound++;
        if (!DRY_RUN) {
          await supabase.from('companions').update({
            maps_verified: false,
            maps_name: null,
            maps_address: null,
            maps_phone: null,
            phone_match: false,
          }).eq('id', listing.id);
        }
        await sleep(DELAY_MS);
        continue;
      }

      // Check name similarity
      const similarity = nameSimilarity(listing.name, place.name);
      if (similarity < 0.5) {
        console.log(`LOW MATCH — found "${place.name}" (sim=${similarity.toFixed(2)})`);
        notFound++;
        if (!DRY_RUN) {
          await supabase.from('companions').update({ maps_verified: false }).eq('id', listing.id);
        }
        await sleep(DELAY_MS);
        continue;
      }

      // Get phone from details
      const details = await getPlaceDetails(place.place_id);
      await sleep(DELAY_MS);

      const mapsPhone = details?.formatted_phone_number || null;
      const matched = listing.phone ? phoneMatch(listing.phone, mapsPhone) : false;
      const verified = similarity >= 0.8;

      if (matched) {
        console.log(`✓ CONFIRMED — phone match · "${place.name}"`);
        confirmed++;
      } else if (verified) {
        console.log(`~ NAME MATCH — phone: ${mapsPhone || 'none'} (scraped: ${listing.phone || 'none'})`);
        phoneMismatch++;
      }

      if (!DRY_RUN) {
        await supabase.from('companions').update({
          maps_verified: verified,
          maps_name: place.name,
          maps_address: place.formatted_address || details?.formatted_address || null,
          maps_phone: mapsPhone,
          phone_match: matched,
        }).eq('id', listing.id);
      }
    } catch (err) {
      console.log(`ERROR — ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n── Results ──────────────────────────────────`);
  console.log(`  ✓ Confirmed (name + phone)  : ${confirmed}`);
  console.log(`  ~ Name match (phone differs): ${phoneMismatch}`);
  console.log(`  ✗ Not found / low similarity: ${notFound}`);
  console.log(`  Total processed             : ${targets.length}`);
  if (DRY_RUN) console.log('\n  [DRY RUN — no database writes]');
  console.log('');
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
