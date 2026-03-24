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

function cleanDisplayText(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/^[^\p{L}\p{N}@#]+/gu, '')
    .replace(/[^\p{L}\p{N})]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSourceChannelName(sourceChannel) {
  const raw = normalizeText(sourceChannel, '').replace(/^@/, '');
  if (!raw) {
    return '';
  }

  const spaced = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(massage|spa|club|rama|society|girl|dream|relax)(\d)/gi, '$1 $2')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .replace(/(\d)([a-z])/gi, '$1 $2')
    .replace(/(massage|spa|club|rama|society|girl|dream|relax)/gi, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^[\p{Script=Latin}\d\s]+$/u.test(spaced)) {
    return spaced
      .split(' ')
      .filter(Boolean)
      .map((part) => {
        if (/^\d+$/.test(part)) {
          return part;
        }

        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return spaced;
}

function cleanLocationLabel(location) {
  const cleaned = cleanDisplayText(
    normalizeText(location, DEFAULT_LOCATION)
      .replace(/^#/, '')
      .replace(/^(?:พิกัด|พิกัดฐานทัพ|location|map|maps)\s*[:：]?\s*/i, '')
      .replace(/^แผนที่ร้านนวดใกล้ฉัน\s*/i, '')
      .replace(/\([^)]*\)/g, ' '),
  );

  return cleaned || DEFAULT_LOCATION;
}

function isBadDisplayName(name) {
  const normalized = cleanDisplayText(name);
  if (!normalized) {
    return true;
  }

  return (
    /^(group joining details|group|telegram|open|เปิด|นี้|massage|spa|สปา|line|new)$/i.test(normalized) ||
    /group|joining|children'?s only|new group|line\s*id|telegram|เปิดให้บริการ|ได้เลยนะ|มีน้องคนไหน|ด่วนโทร|เอาใจ|แซ่บ|ส่งไรนักหนา|ประกาศภาวะฉุกเฉิน|จะดู|ครับ|ค่ะ|คะ/i.test(normalized) ||
    /^\d[\d -]{7,}$/.test(normalized) ||
    /^\d{1,2}[:.]\d{2}/.test(normalized) ||
    /[:：]/.test(normalized) ||
    normalized.length < 3
  );
}

function resolveDisplayName(rawName, sourceChannel, location) {
  const cleanedName = cleanDisplayText(rawName);
  if (!isBadDisplayName(cleanedName)) {
    return cleanedName.slice(0, 48);
  }

  const sourceName = formatSourceChannelName(sourceChannel);
  if (sourceName && !isBadDisplayName(sourceName)) {
    return sourceName.slice(0, 48);
  }

  const area = cleanLocationLabel(location).split(',')[0]?.trim();
  return (area ? `Massage Listing ${area}` : 'Massage Listing').slice(0, 48);
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
  const location = cleanLocationLabel(rawListing?.location || fallbackLocation);
  const name = resolveDisplayName(rawListing?.name, listingMeta.sourceChannel, location);
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

  const normalized = listings.map((listing, index) =>
    normalizeListing(
      {
        ...listing,
        id: listing?.id ?? `${options.source || 'backup'}-${index + 1}`,
      },
      options,
    ),
  );

  const deduped = new Map();
  normalized.forEach((listing) => {
    const dedupeKey = listing.sourceChannel && listing.postedAt
      ? `${listing.sourceChannel}|${listing.postedAt}|${listing.location}`
      : `${listing.name}|${listing.location}|${listing.updatedAt || listing.id}`;
    const existing = deduped.get(dedupeKey);

    if (!existing) {
      deduped.set(dedupeKey, listing);
      return;
    }

    const existingBadName = isBadDisplayName(existing.name);
    const nextBadName = isBadDisplayName(listing.name);
    const existingMatchedMedia = hasMatchedMedia(existing);
    const nextMatchedMedia = hasMatchedMedia(listing);

    if (existingBadName && !nextBadName) {
      deduped.set(dedupeKey, listing);
      return;
    }

    if (existingMatchedMedia !== nextMatchedMedia) {
      deduped.set(dedupeKey, nextMatchedMedia ? listing : existing);
      return;
    }

    if ((getListingTimestampValue(listing) || 0) > (getListingTimestampValue(existing) || 0)) {
      deduped.set(dedupeKey, listing);
    }
  });

  return [...deduped.values()];
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
