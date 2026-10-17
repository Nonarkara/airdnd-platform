// scripts/build_place_photos.js
//
// Builds the /places photo-archive gallery from Supabase `photo_archive`
// (the durable cloud source of truth), NOT from the local disk archive.
//
// Why not local disk: the previous version walked /public/images/{venue}/…
// and emitted local `/images/*` paths. That broke for three reasons — the
// archive is gitignored wholesale, only a handful of files ever shipped to
// Cloudflare, and the terms that generate the shapped paths on a different
// machine than the scraper. `photo_archive.supabase_url` is the URL the
// frontend already uses for every hero (80/80 in data.json), so sourcing the
// gallery from the same table keeps one consistent data plane.
//
// Emits:
//   1. public/data/place_photos_index.json           — venue-level metadata
//   2. public/data/place_photos/{slug}.json          — full photo list per venue
//
// Degrades gracefully: if Supabase is unreachable this writes an empty index
// (marked `degraded`) and exits 0, so `npm run build` never fails a deploy
// over an offline data plane. The /places page must show the empty state.

import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDataClient, closeDataClient } from './lib/local_db.js';
import { rewriteMediaUrl } from '../src/lib/media.js';
import dotenv from 'dotenv';
import { channelSlug } from '../src/lib/channel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'data', 'place_photos');
const INDEX_FILE = join(ROOT, 'public', 'data', 'place_photos_index.json');

dotenv.config({ path: join(ROOT, '.env'), quiet: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Supabase free tier caps a single select at 1000 rows regardless of range
// width — a wider PHOTO_PAGE silently returns only 1000 rows and the
// `data.length < PHOTO_PAGE` end-detection would wrongly stop after one page.
const PHOTO_PAGE = 1000;
// The galleries are served from the free airdnd-media Pages project (20k-file
// cap), so each venue shard keeps only its newest N photos.
const PER_VENUE = Number(process.env.PLACE_PHOTOS_PER_VENUE || 200);

function slugifyChannel(channelId) {
  const cleaned = channelSlug(channelId);
  if (!cleaned) return null;
  // The dialogue tokens (`dialog:2381945815`) carry the numeric ID; a channel
  // label is what the frontend links by, so prefer the readable form.
  return cleaned;
}

// How many listings in the snapshot come from a channel. The scraper records
// listings under sourceTarget (the token) or sourceChannel (the label); the
// builder links the archive shard back to those listings for the "N listing
// match" pill on the /places wall.
let cachedListings = null;
function readListings() {
  if (cachedListings) return cachedListings;
  try {
    const raw = readFileSync(join(ROOT, 'public', 'data.json'), 'utf8');
    cachedListings = JSON.parse(raw);
  } catch {
    cachedListings = [];
  }
  return Array.isArray(cachedListings) ? cachedListings : [];
}

function listingsForChannel(label, channelId) {
  const listings = readListings();
  const labelSlug = slugifyChannel(label);
  const idSlug = slugifyChannel(channelId);
  return listings.filter((l) => {
    if (!l) return false;
    const srcTarget = slugifyChannel(l.sourceTarget);
    const srcChannel = slugifyChannel(l.sourceChannel);
    return srcTarget === idSlug || srcChannel === labelSlug || srcChannel === idSlug;
  });
}

function establishSupabase() {
  // Local Postgres on the M3 (DATABASE_URL); Supabase is retired.
  return createDataClient();
}

async function pullAllPhotos(supabase) {
  const rows = [];
  let from = 0;
  for (let page = 0; page < 2000; page += 1) {
    const { data, error } = await supabase
      .from('photo_archive')
      .select('channel_id,channel_name,supabase_url,local_path,message_date,stored_filename')
      .order('message_date', { ascending: false, nullsFirst: false })
      .range(from, from + PHOTO_PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PHOTO_PAGE) break;
    from += PHOTO_PAGE;
  }
  return rows;
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  // Clear stale shards from previous builds — venues that disappeared from the
  // archive (or were keyed by an older scheme) must not keep delivering 404s.
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.json')) rmSync(join(OUT_DIR, f), { force: true });
  }

  const supabase = establishSupabase();
  if (!supabase) {
    console.error('[place-photos] VITE_SUPABASE_URL / SERVICE_ROLE_KEY not set; writing empty index.');
    writeFileSync(
      INDEX_FILE,
      JSON.stringify(
        { meta: { source: 'supabase photo_archive', generatedAt: new Date().toISOString(), totalVenues: 0, totalPhotos: 0, degraded: true, error: 'supabase credentials missing' }, venues: [] },
        null,
        0,
      ),
    );
    process.exit(0);
  }

  let rows;
  try {
    rows = await pullAllPhotos(supabase);
  } catch (err) {
    console.error(`[place-photos] Supabase photo_archive unavailable (${err.message}); writing empty index.`);
    writeFileSync(
      INDEX_FILE,
      JSON.stringify(
        { meta: { source: 'supabase photo_archive', generatedAt: new Date().toISOString(), totalVenues: 0, totalPhotos: 0, degraded: true, error: err.message }, venues: [] },
        null,
        0,
      ),
    );
    process.exit(0);
  }

  // Group by channel. A venue = a Telegram channel in the archive. Key on the
  // channel LABEL (photo_archive.channel_name) with the numeric channel_id as
  // fallback — the frontend (ListingMap) deep-links to /places/{label}, so the
  // shard slug must be the label, not the numeric token.
  const byChannel = new Map();
  let usable = 0;
  for (const row of rows) {
    const label = (row.channel_name || '').trim();
    const channelId = (row.channel_id || '').trim();
    const slug = slugifyChannel(label || channelId);
    if (!slug) continue;
    const url = rewriteMediaUrl(row.supabase_url || row.local_path);
    if (!url) continue;
    usable += 1;
    if (!byChannel.has(slug)) {
      byChannel.set(slug, {
        slug,
        channelLabel: label || channelId,
        channelId,
        photos: [],
      });
    }
    byChannel.get(slug).photos.push({
      url,
      date: row.message_date ? String(row.message_date).slice(0, 10) : null,
      filename: row.stored_filename || null,
    });
  }

  const venues = [...byChannel.values()]
    .map((v) => {
      v.photos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      v.archiveCount = v.photos.length;
      if (PER_VENUE > 0) v.photos = v.photos.slice(0, PER_VENUE);
      const dates = v.photos.map((p) => p.date).filter(Boolean);
      const earliest = dates.length ? dates[dates.length - 1] : null;
      const latest = dates.length ? dates[0] : null;
      const sample = v.photos.slice(0, 6).map((p) => p.url);
      const matched = listingsForChannel(v.channelLabel, v.channelId);
      return {
        slug: v.slug,
        name: v.channelLabel,
        channel: v.channelLabel,
        photoCount: v.photos.length,
        archiveCount: v.archiveCount,
        earliest,
        latest,
        matchedListingCount: matched.length,
        sample,
        perVenueUrl: `/data/place_photos/${v.slug}.json`,
      };
    })
    .sort((a, b) => b.photoCount - a.photoCount);

  // Write per-venue shards + the index.
  for (const venue of venues) {
    const shard = byChannel.get(venue.slug);
    writeFileSync(
      join(OUT_DIR, `${venue.slug}.json`),
      JSON.stringify(
        {
          slug: venue.slug,
          channel: venue.channel,
          displayName: venue.name,
          total: shard.photos.length,
          earliest: venue.earliest,
          latest: venue.latest,
          photoCount: shard.photos.length,
          photos: shard.photos,
        },
        null,
        0,
      ),
    );
  }

  writeFileSync(
    INDEX_FILE,
    JSON.stringify(
      {
        meta: {
          source: 'local photo_archive',
          generatedAt: new Date().toISOString(),
          totalVenues: venues.length,
          totalPhotos: venues.reduce((n, v) => n + v.photoCount, 0),
          archivePhotos: usable,
          perVenueCap: PER_VENUE,
        },
        venues,
      },
      null,
      0,
    ),
  );

  console.log(`[place-photos] wrote ${venues.length} venues, ${usable} archived photos from local photo_archive (newest ${PER_VENUE}/venue published)`);
}

main().catch((err) => {
  console.error('[place-photos] failed:', err);
  process.exit(1);
});
