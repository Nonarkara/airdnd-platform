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

function normalizeComparable(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : '';
}

function hasMatchedMedia(listing) {
  return Boolean(normalizeText(listing?.imageUrl || listing?.image_url)) &&
    !normalizeText(listing?.imageUrl || listing?.image_url).startsWith('/mockups/');
}

function createDatabaseMetrics(listing, existingMetrics = null) {
  const baseMetrics =
    existingMetrics && typeof existingMetrics === 'object' && !Array.isArray(existingMetrics)
      ? { ...existingMetrics }
      : {};
  const listingMetrics =
    listing?.metrics && typeof listing.metrics === 'object' && !Array.isArray(listing.metrics)
      ? listing.metrics
      : {};

  Object.assign(baseMetrics, listingMetrics);

  if (listing?.postedAt) {
    baseMetrics.__postedAt = listing.postedAt;
  }

  if (listing?.sourceChannel) {
    baseMetrics.__sourceChannel = listing.sourceChannel;
  }

  if (listing?.sourceTarget) {
    baseMetrics.__sourceTarget = listing.sourceTarget;
  }

  if (typeof listing?.imageUrl === 'string' && listing.imageUrl.trim()) {
    baseMetrics.__matchedMedia = hasMatchedMedia(listing);
  }

  return baseMetrics;
}

function getFreshnessValue(listing) {
  const value = listing?.postedAt || listing?.posted_at || listing?.updatedAt || listing?.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildIdentifierKey(listing) {
  const phone = normalizePhone(listing?.phone);
  if (phone) {
    return `phone:${phone}`;
  }

  const mapsUrl = normalizeComparable(listing?.mapsUrl);
  if (mapsUrl) {
    return `maps:${mapsUrl}`;
  }

  const lineUrl = normalizeComparable(listing?.lineUrl);
  if (lineUrl) {
    return `line:${lineUrl}`;
  }

  return '';
}

function buildNameLocationKey(listing) {
  const name = normalizeComparable(listing?.name);
  const location = normalizeComparable(listing?.location);
  if (!name || !location) {
    return '';
  }

  return `${name}|${location}`;
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
        sourceTarget: normalizeText(listing?.sourceTarget, null),
        phone: normalizeText(listing?.phone, null),
        hours: normalizeText(listing?.hours, null),
        lineUrl: normalizeText(listing?.lineUrl, null),
        telegramUrl: normalizeText(listing?.telegramUrl, null),
        mapsUrl: normalizeText(listing?.mapsUrl, null),
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
  const seenIdentifiers = new Set();
  const seenNameLocations = new Set();
  const seenFingerprints = new Set();
  const deduped = [];

  const prioritizedListings = [...(Array.isArray(listings) ? listings : [])].sort((left, right) => {
    const matchedDelta = Number(hasMatchedMedia(right)) - Number(hasMatchedMedia(left));
    if (matchedDelta !== 0) {
      return matchedDelta;
    }

    const freshnessDelta = getFreshnessValue(right) - getFreshnessValue(left);
    if (freshnessDelta !== 0) {
      return freshnessDelta;
    }

    return normalizeText(right?.description).length - normalizeText(left?.description).length;
  });

  for (const listing of prioritizedListings) {
    const identifierKey = buildIdentifierKey(listing);
    const nameLocationKey = buildNameLocationKey(listing);
    const fingerprint = buildFingerprint(listing);

    if (identifierKey && seenIdentifiers.has(identifierKey)) {
      continue;
    }

    if (nameLocationKey && seenNameLocations.has(nameLocationKey)) {
      continue;
    }

    if (!fingerprint || seenFingerprints.has(fingerprint)) {
      continue;
    }

    if (identifierKey) {
      seenIdentifiers.add(identifierKey);
    }
    if (nameLocationKey) {
      seenNameLocations.add(nameLocationKey);
    }
    seenFingerprints.add(fingerprint);
    deduped.push(listing);
  }

  return sortListingsByUpdatedAt(deduped);
}

function getTimestampValue(listing) {
  return getFreshnessValue(listing);
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
        .select('id,image_url,metrics')
        .eq('name', listing.name)
        .eq('location', listing.location)
        .limit(1);

      if (lookupError) {
        throw lookupError;
      }

      if (existingRows && existingRows.length > 0) {
        const existingRow = existingRows[0];
        const nextMetrics = createDatabaseMetrics(listing, existingRow.metrics);
        const nextMetricsJson = JSON.stringify(nextMetrics);
        const existingMetricsJson = JSON.stringify(existingRow.metrics || {});
        const existingImageUrl = normalizeText(existingRow.image_url, '');
        const updatePayload = {};

        if (nextMetricsJson !== existingMetricsJson) {
          updatePayload.metrics = nextMetrics;
        }

        if (hasMatchedMedia(listing) && (!existingImageUrl || existingImageUrl.startsWith('/mockups/'))) {
          updatePayload.image_url = listing.imageUrl;
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabase
            .from('companions')
            .update(updatePayload)
            .eq('id', existingRow.id);

          if (updateError) {
            throw updateError;
          }
        }

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
        metrics: createDatabaseMetrics(listing),
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
