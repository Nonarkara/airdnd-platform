const DEFAULT_LOCATION = 'Bangkok, Thailand';
const DEFAULT_IMAGE = '/mockups/109748.jpg';

export const SOURCE_LABELS = {
  supabase: 'Live directory',
  snapshot: 'Recent snapshot',
  backup: 'Cached listings',
};

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
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

function extractPriceValue(priceLabel) {
  const numeric = String(priceLabel || '').replace(/[^\d]/g, '');
  if (!numeric) {
    return null;
  }

  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractCity(location) {
  const normalizedLocation = normalizeText(location, DEFAULT_LOCATION);
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

export function normalizeListing(rawListing, options = {}) {
  const source = options.source || 'backup';
  const fallbackLocation = options.fallbackLocation || DEFAULT_LOCATION;
  const name = normalizeText(rawListing?.name, 'Untitled listing');
  const location = normalizeText(rawListing?.location, fallbackLocation);
  const priceLabel = normalizeText(rawListing?.priceLabel || rawListing?.price, 'Rate on request');
  const ratingValue = rawListing?.rating;
  const reviewsValue = rawListing?.reviews;

  const rating =
    typeof ratingValue === 'number'
      ? ratingValue
      : typeof ratingValue === 'string' && ratingValue.trim()
        ? Number.parseFloat(ratingValue)
        : null;

  const reviews =
    typeof reviewsValue === 'number'
      ? reviewsValue
      : typeof reviewsValue === 'string' && reviewsValue.trim()
        ? Number.parseInt(reviewsValue, 10)
        : null;

  const normalizedAge =
    typeof rawListing?.age === 'number'
      ? rawListing.age
      : typeof rawListing?.age === 'string' && rawListing.age.trim()
        ? Number.parseInt(rawListing.age, 10)
        : null;

  const tags = Array.isArray(rawListing?.tags)
    ? rawListing.tags
        .map((tag) => normalizeText(String(tag)))
        .filter(Boolean)
    : [];

  const updatedAt = normalizeText(rawListing?.updatedAt || rawListing?.created_at, null);

  return {
    id: rawListing?.id ?? `${source}-${name}-${location}`,
    name,
    age: Number.isFinite(normalizedAge) ? normalizedAge : null,
    location,
    city: normalizeText(rawListing?.city, extractCity(location)),
    priceLabel,
    priceValue: extractPriceValue(priceLabel),
    description: normalizeText(
      rawListing?.description,
      'Details for this listing are still being collected.',
    ),
    tags,
    metrics: normalizeMetrics(rawListing?.metrics),
    imageUrl: normalizeText(rawListing?.imageUrl || rawListing?.image_url, DEFAULT_IMAGE),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    reviews: Number.isFinite(reviews) && reviews > 0 ? reviews : null,
    updatedAt,
    dataSource: source,
    isFallback: Boolean(options.isFallback),
  };
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function normalizeListings(listings, options = {}) {
  if (!Array.isArray(listings)) {
    return [];
  }

  return listings.map((listing, index) =>
    normalizeListing(
      {
        ...listing,
        id: listing?.id ?? `${options.source || 'backup'}-${index + 1}`,
      },
      options,
    ),
  );
}

export function createMetrics(listings) {
  const normalizedListings = Array.isArray(listings) ? listings : [];
  const bangkokCount = normalizedListings.filter((listing) => listing.city === 'Bangkok').length;
  const timestamps = normalizedListings
    .map((listing) => parseTimestamp(listing.updatedAt))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime());
  const latestDate = timestamps[0] || null;
  const liveWindowCount = latestDate
    ? normalizedListings.filter((listing) => {
        const listingDate = parseTimestamp(listing.updatedAt);
        if (!listingDate) {
          return false;
        }

        return latestDate.getTime() - listingDate.getTime() <= 90 * 60 * 1000;
      }).length
    : 0;
  const cityCount = new Set(
    normalizedListings
      .map((listing) => listing.city)
      .filter(Boolean),
  ).size;

  return {
    total: normalizedListings.length,
    bangkokCount,
    cityCount,
    coverage: normalizedListings.length
      ? Math.round((bangkokCount / normalizedListings.length) * 100)
      : 0,
    liveWindowCount,
    latestTimestamp: latestDate ? latestDate.toISOString() : null,
  };
}

export function formatRelativeTimestamp(value) {
  const date = parseTimestamp(value);
  if (!date) {
    return 'No timestamp';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatPreciseTimestamp(value) {
  const date = parseTimestamp(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
