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

function extractListingMeta(rawListing) {
  const rawMetrics =
    rawListing?.metrics && typeof rawListing.metrics === 'object' ? rawListing.metrics : {};

  return {
    postedAt: normalizeText(
      rawListing?.postedAt ||
        rawListing?.posted_at ||
        rawMetrics.__postedAt ||
        rawMetrics.postedAt ||
        rawMetrics.posted_at,
      null,
    ),
    sourceChannel: normalizeText(
      rawListing?.sourceChannel ||
        rawListing?.source_channel ||
        rawMetrics.__sourceChannel ||
        rawMetrics.sourceChannel ||
        rawMetrics.source_channel,
      null,
    ),
  };
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
  const listingMeta = extractListingMeta(rawListing);
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
    postedAt: listingMeta.postedAt,
    sourceChannel: listingMeta.sourceChannel,
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

export function getIngestTimestamp(listing) {
  return parseTimestamp(listing?.updatedAt || listing?.created_at);
}

export function getListingTimestamp(listing) {
  return parseTimestamp(listing?.postedAt || listing?.posted_at || listing?.updatedAt || listing?.created_at);
}

export function getListingTimestampValue(listing) {
  const date = getListingTimestamp(listing);
  return date ? date.getTime() : 0;
}

export function hasMatchedMedia(listing) {
  const imageUrl = normalizeText(listing?.imageUrl || listing?.image_url, '');
  return Boolean(imageUrl) && !imageUrl.startsWith('/mockups/');
}

export function createIntakeSummary(listings) {
  const normalizedListings = Array.isArray(listings) ? listings : [];
  const newestListings = [...normalizedListings].sort(
    (left, right) => getListingTimestampValue(right) - getListingTimestampValue(left),
  );
  const currentFeedListings = newestListings.slice(0, 60);
  const latestSourceDate = newestListings.length > 0 ? getListingTimestamp(newestListings[0]) : null;
  const latestIngestDate = currentFeedListings
    .map((listing) => getIngestTimestamp(listing))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;
  const referenceDate = latestSourceDate || latestIngestDate;
  const countWithinWindow = (windowMinutes) => {
    if (!referenceDate) {
      return 0;
    }

    return currentFeedListings.filter((listing) => {
      const listingDate = getListingTimestamp(listing) || getIngestTimestamp(listing);
      if (!listingDate) {
        return false;
      }

      const distance = referenceDate.getTime() - listingDate.getTime();
      return distance >= 0 && distance <= windowMinutes * 60 * 1000;
    }).length;
  };

  const channelCounts = new Map();
  currentFeedListings.forEach((listing) => {
    const channel = normalizeText(listing?.sourceChannel, null);
    if (!channel) {
      return;
    }

    channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
  });

  return {
    latestSourceTimestamp: latestSourceDate ? latestSourceDate.toISOString() : null,
    latestIngestTimestamp: latestIngestDate ? latestIngestDate.toISOString() : null,
    last15Minutes: countWithinWindow(15),
    last60Minutes: countWithinWindow(60),
    matchedRate: currentFeedListings.length
      ? Math.round((currentFeedListings.filter((listing) => hasMatchedMedia(listing)).length / currentFeedListings.length) * 100)
      : 0,
    channelCount: channelCounts.size,
    channelLeaders: [...channelCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([channel, count]) => ({
        channel,
        count,
        share: currentFeedListings.length ? Math.round((count / currentFeedListings.length) * 100) : 0,
      })),
    newestListings: newestListings.slice(0, 8),
  };
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
    .map((listing) => getListingTimestamp(listing))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime());
  const latestDate = timestamps[0] || null;
  const liveWindowCount = latestDate
    ? normalizedListings.filter((listing) => {
        const listingDate = getListingTimestamp(listing);
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
  const sourceChannelCount = new Set(
    normalizedListings
      .map((listing) => listing.sourceChannel)
      .filter(Boolean),
  ).size;
  const matchedMediaCount = normalizedListings.filter((listing) => hasMatchedMedia(listing)).length;

  return {
    total: normalizedListings.length,
    bangkokCount,
    cityCount,
    sourceChannelCount,
    matchedMediaCount,
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
