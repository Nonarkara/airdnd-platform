import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.join(__dirname, '../public/data.json');

function createCaptureTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractCity(location) {
  const normalizedLocation = normalizeText(location, 'Bangkok, Thailand');
  const segments = normalizedLocation
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return 'Bangkok';
  }

  if (segments.length === 1) {
    return segments[0];
  }

  const lastSegment = segments.at(-1)?.toLowerCase();
  if (lastSegment === 'th' || lastSegment === 'thailand') {
    return segments.at(-2) || 'Bangkok';
  }

  return segments.at(-1) || 'Bangkok';
}

function extractPriceValue(priceLabel) {
  const numeric = String(priceLabel || '').replace(/[^\d]/g, '');
  if (!numeric) {
    return null;
  }

  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return {};
  }

  const nextMetrics = {};
  if (metrics.height) {
    nextMetrics.height = String(metrics.height).trim();
  }
  if (metrics.weight) {
    nextMetrics.weight = String(metrics.weight).trim();
  }
  return nextMetrics;
}

export function parseModelJson(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && Array.isArray(parsed.listings)) {
    return parsed.listings;
  }

  return [];
}

export function normalizeExtractedListings(rawListings, options = {}) {
  const source = options.source || 'snapshot';
  const timestamp = options.timestamp || createCaptureTimestamp();
  const defaultImage = options.defaultImage || '/mockups/109748.jpg';

  const normalized = (Array.isArray(rawListings) ? rawListings : [])
    .map((listing, index) => {
      const name = normalizeText(listing?.name);
      if (!name) {
        return null;
      }

      const location = normalizeText(listing?.location, 'Bangkok, Thailand');
      const priceLabel = normalizeText(listing?.priceLabel || listing?.price, 'Rate on request');
      const rating = normalizeNumber(listing?.rating);
      const reviews = normalizeInteger(listing?.reviews);

      return {
        id: listing?.id ?? `${source}-${Date.now()}-${index + 1}`,
        name,
        age: normalizeInteger(listing?.age),
        location,
        city: normalizeText(listing?.city, extractCity(location)),
        priceLabel,
        priceValue: extractPriceValue(priceLabel),
        description: normalizeText(
          listing?.description,
          'Details for this listing are still being collected.',
        ),
        tags: Array.isArray(listing?.tags)
          ? listing.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [],
        metrics: normalizeMetrics(listing?.metrics),
        imageUrl: normalizeText(listing?.imageUrl || listing?.image_url, defaultImage),
        rating: rating && rating > 0 ? rating : null,
        reviews: reviews && reviews > 0 ? reviews : null,
        updatedAt: normalizeText(listing?.updatedAt || listing?.created_at, timestamp),
        postedAt: normalizeText(listing?.postedAt, null),
        sourceChannel: normalizeText(listing?.sourceChannel, null),
        dataSource: source,
        isFallback: source !== 'supabase',
      };
    })
    .filter(Boolean);

  return dedupeListings(normalized);
}

export function buildFingerprint(listing) {
  return [
    normalizeText(listing?.name).toLowerCase(),
    normalizeText(listing?.location).toLowerCase(),
    normalizeText(listing?.priceLabel || listing?.price).toLowerCase(),
    normalizeText(listing?.description).toLowerCase(),
  ].join('|');
}

export function dedupeListings(listings) {
  const seen = new Set();
  const deduped = [];

  for (const listing of listings) {
    const fingerprint = buildFingerprint(listing);
    if (!fingerprint || seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    deduped.push(listing);
  }

  return deduped;
}

function getTimestampValue(listing) {
  const value = listing?.updatedAt || listing?.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortListingsByUpdatedAt(listings) {
  return [...(Array.isArray(listings) ? listings : [])].sort((left, right) => {
    const timestampDelta = getTimestampValue(right) - getTimestampValue(left);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    const leftId = Number.parseInt(String(left?.id ?? 0), 10);
    const rightId = Number.parseInt(String(right?.id ?? 0), 10);
    if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) {
      return rightId - leftId;
    }

    return buildFingerprint(right).localeCompare(buildFingerprint(left));
  });
}

export function mergeSnapshotListings(newListings, existingListings = [], options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 180;
  const merged = dedupeListings([
    ...(Array.isArray(newListings) ? newListings : []),
    ...(Array.isArray(existingListings) ? existingListings : []),
  ]);

  return sortListingsByUpdatedAt(merged).slice(0, limit);
}

export function readSnapshotListings() {
  try {
    const raw = fs.readFileSync(snapshotPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSnapshotListings(listings) {
  if (!Array.isArray(listings) || listings.length === 0) {
    console.log('Skipping snapshot write because no valid listings were extracted.');
    return false;
  }

  fs.writeFileSync(snapshotPath, JSON.stringify(listings, null, 2));
  console.log(`Saved ${listings.length} listing(s) to public/data.json`);
  return true;
}

export async function insertListingsIfPossible(supabase, listings) {
  if (!supabase || !Array.isArray(listings) || listings.length === 0) {
    return { inserted: 0, skipped: listings?.length || 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (const listing of listings) {
    try {
      const { data: existingRows, error: lookupError } = await supabase
        .from('companions')
        .select('id')
        .eq('name', listing.name)
        .eq('location', listing.location)
        .eq('price', listing.priceLabel)
        .eq('description', listing.description)
        .limit(1);

      if (lookupError) {
        throw lookupError;
      }

      if (existingRows && existingRows.length > 0) {
        skipped += 1;
        continue;
      }

      const row = {
        name: listing.name,
        age: listing.age,
        location: listing.location,
        price: listing.priceLabel,
        description: listing.description,
        image_url: listing.imageUrl,
        rating: listing.rating ?? 0,
        reviews: listing.reviews ?? 0,
        tags: listing.tags,
        metrics: listing.metrics,
      };

      // Try with origin metadata first, fall back without if columns don't exist
      if (listing.postedAt) {
        row.posted_at = listing.postedAt;
      }
      if (listing.sourceChannel) {
        row.source_channel = listing.sourceChannel;
      }

      let { error } = await supabase.from('companions').insert([row]);

      // If columns don't exist yet, retry without them
      if (error && error.message?.includes('column')) {
        delete row.posted_at;
        delete row.source_channel;
        ({ error } = await supabase.from('companions').insert([row]));
      }

      if (error) {
        throw error;
      }

      inserted += 1;
    } catch (error) {
      skipped += 1;
      console.error(`Failed to insert ${listing.name}:`, error.message);
    }
  }

  return { inserted, skipped };
}
