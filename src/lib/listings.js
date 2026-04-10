const DEFAULT_LOCATION = 'Bangkok, Thailand';
const DEFAULT_IMAGE = '/mockups/109748.jpg';

export const SOURCE_LABELS = {
  supabase: 'Live sync',
  snapshot: 'Verified snapshot',
  backup: 'Cached fallback',
};

const VALID_SERVICE_TAGS = new Set([
  '4 Hand Massage',
  'Adult Entertainment',
  'Adult Services',
  'Aroma Massage',
  'B2B Massage',
  'Erotic Massage',
  'Escort',
  'Health Massage',
  'Massage',
  'Model',
  'Multiple Providers',
  'New Provider',
  'Spa',
  'Wellness',
  'Young Talent',
]);

const CITY_PATTERNS = [
  {
    canonical: 'Bangkok',
    patterns: [
      'bangkok',
      'กรุงเทพ',
      'กรุงเทพมหานคร',
      'สุขุมวิท',
      'ทองหล่อ',
      'เอกมัย',
      'อโศก',
      'ลาดพร้าว',
      'รามอินทรา',
      'พระราม',
      'รัชดา',
      'ห้วยขวาง',
      'สาทร',
      'สีลม',
      'บางนา',
      'นวมินทร์',
      'มีนบุรี',
      'ฉลองกรุง',
      'คลองสอง',
      'ศาลายา',
    ],
  },
  {
    canonical: 'Nonthaburi',
    patterns: ['nonthaburi', 'นนทบุรี', 'นนทบุร', 'บางใหญ่', 'ปากเกร็ด', 'บางกรวย', 'วัดลาดปลาดุก'],
  },
  {
    canonical: 'Pathum Thani',
    patterns: ['pathum thani', 'ปทุมธานี', 'รังสิต', 'ลำลูกกา'],
  },
  {
    canonical: 'Samut Prakan',
    patterns: ['samut prakan', 'สมุทรปราการ', 'สำโรง', 'แบริ่ง'],
  },
  {
    canonical: 'Chonburi',
    patterns: ['chonburi', 'ชลบุรี', 'pattaya', 'พัทยา', 'jomtien'],
  },
  {
    canonical: 'Phuket',
    patterns: ['phuket', 'ภูเก็ต', 'patong'],
  },
  {
    canonical: 'Chiang Mai',
    patterns: ['chiang mai', 'เชียงใหม่'],
  },
  {
    canonical: 'Saraburi',
    patterns: ['saraburi', 'สระบุรี'],
  },
];

function isValidServiceTag(tag) {
  if (VALID_SERVICE_TAGS.has(tag)) {
    return true;
  }

  // Reject tags that look like locations (Thai text, area names)
  if (/^[\u0E00-\u0E7F]/.test(tag)) {
    return false;
  }

  // Reject known location patterns
  if (/^(Bangkok|Bangyai|Pathum Thani|Rangsit|Rama\s*\d|Rama\s*II|Nawamin|Khlong|Bhumibol|Nonthaburi|Samut|Nakhon|Chiang|Phuket|Pattaya)/i.test(tag)) {
    return false;
  }

  return true;
}

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

function hasServiceNameSignal(value) {
  return /massage|spa|นวด|สปา|เพื่อสุขภาพ|wellness|therapy|therapist|คลินิก|clinic/i.test(value);
}

function inferCityFromText(value) {
  const normalized = normalizeText(value, '').toLowerCase();
  if (!normalized) {
    return null;
  }

  const matchedCity = CITY_PATTERNS.find(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern.toLowerCase())),
  );

  return matchedCity?.canonical || null;
}

export function formatSourceChannelName(sourceChannel) {
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

  if (!cleaned || cleaned === 'ร้าน') {
    return DEFAULT_LOCATION;
  }

  if (
    cleaned.length > 72 ||
    /เปิดบริการ|สวัสดี|line|โทร|#|บริการทุกวัน|\d{1,2}[:.]\d{2}/i.test(cleaned)
  ) {
    const inferredCity = inferCityFromText(cleaned);
    return inferredCity ? `${inferredCity}, Thailand` : DEFAULT_LOCATION;
  }

  return cleaned || DEFAULT_LOCATION;
}

function isBadDisplayName(name) {
  const normalized = cleanDisplayText(name);
  if (!normalized) {
    return true;
  }

  return (
    /^(group joining details|group|telegram|open|เปิด|นี้|massage|spa|สปา|line|new)$/i.test(normalized) ||
    /group|joining|children'?s only|line\s*id|id\s*line|new group|telegram|เปิดให้บริการ|ได้เลยนะ|มีน้องคนไหน|ด่วนโทร|เอาใจ|แซ่บ|ส่งไรนักหนา|ประกาศภาวะฉุกเฉิน|จะดู|ครับ|ค่ะ|คะ|สะอาด|ปลอดภัย|คนไม่พลุกพล่าน|private room|parking|บรรยากาศ|เงียบสงบ|น้องใหม่|บริการทุกวัน|จับจอง|แล้วค่า|แล้วครับ|แล้วค่ะ/i.test(normalized) ||
    /^\d[\d -]{7,}$/.test(normalized) ||
    /^\d{1,2}[:.]\d{2}/.test(normalized) ||
    /[:：]/.test(normalized) ||
    (/society/i.test(normalized) && !hasServiceNameSignal(normalized)) ||
    (!hasServiceNameSignal(normalized) && normalized.split(/\s+/).filter(Boolean).length >= 5) ||
    (!hasServiceNameSignal(normalized) && normalized.length > 36) ||
    (/^[\u0E00-\u0E7F]{1,4}$/.test(normalized) && !hasServiceNameSignal(normalized)) ||
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

function sanitizePriceLabel(rawPriceLabel) {
  const normalized = normalizeText(rawPriceLabel, '');
  if (!normalized) {
    return 'Rate on request';
  }

  const value = extractPriceValue(normalized);
  if (!Number.isFinite(value) || value < 100 || value > 20000) {
    return 'Rate on request';
  }

  return `${value} THB`;
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

function resolveCity(rawCity, location) {
  const locationCity = inferCityFromText(location);
  const cleanedCity = cleanDisplayText(rawCity);
  const explicitCity = inferCityFromText(cleanedCity);

  if (explicitCity) {
    return explicitCity;
  }

  if (locationCity) {
    return locationCity;
  }

  if (
    cleanedCity &&
    cleanedCity.length <= 32 &&
    !/ร้าน|เปิด|บริการ|สะอาด|ปลอดภัย|ใกล้|พิกัด|ซอย|ถนน|บาท|thb|นวด/i.test(cleanedCity)
  ) {
    return cleanedCity;
  }

  return 'Bangkok';
}

export function extractCity(location) {
  const inferredCity = inferCityFromText(location);
  if (inferredCity) {
    return inferredCity;
  }

  const normalizedLocation = normalizeText(location, DEFAULT_LOCATION);

  // Thai street addresses (ถนน, ถ., ซอย, รามอินทรา, etc.) are Bangkok unless specified otherwise
  if (/^[\u0E00-\u0E7F]/.test(normalizedLocation) && !/,/.test(normalizedLocation)) {
    return 'Bangkok';
  }

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
  const priceLabel = sanitizePriceLabel(rawListing?.priceLabel || rawListing?.price);
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
        .filter((tag) => tag && isValidServiceTag(tag))
    : [];

  const updatedAt = normalizeText(rawListing?.updatedAt || rawListing?.created_at, null);

  return {
    id: rawListing?.id ?? `${source}-${name}-${location}`,
    name,
    age: Number.isFinite(normalizedAge) ? normalizedAge : null,
    location,
    city: resolveCity(rawListing?.city, location),
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
    phone: normalizeText(rawListing?.phone, null),
    hours: normalizeText(rawListing?.hours, null),
    lineUrl: normalizeText(rawListing?.lineUrl || rawListing?.line_url, null),
    mapsUrl: normalizeText(rawListing?.mapsUrl || rawListing?.maps_url, null),
    telegramUrl: normalizeText(rawListing?.telegramUrl || rawListing?.telegram_url, null),
    latitude: typeof rawListing?.latitude === 'number' ? rawListing.latitude : null,
    longitude: typeof rawListing?.longitude === 'number' ? rawListing.longitude : null,
    isSafeImage: rawListing?.is_safe_image !== false && rawListing?.isSafeImage !== false,
    mentionCount: rawListing?.mention_count || rawListing?.mentionCount || 0,
    photoCount: Array.isArray(rawListing?.photo_urls) ? rawListing.photo_urls.length :
      Array.isArray(rawListing?.allPhotoUrls) ? rawListing.allPhotoUrls.length : 0,
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
  const currentFeedTimestamps = currentFeedListings
    .map((listing) => getListingTimestamp(listing) || getIngestTimestamp(listing))
    .filter(Boolean)
    .map((date) => date.getTime())
    .sort((left, right) => right - left);
  const feedWindowHours =
    currentFeedTimestamps.length > 1
      ? Math.max(0.25, (currentFeedTimestamps[0] - currentFeedTimestamps.at(-1)) / 3_600_000)
      : 1;
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
    feedCount: currentFeedListings.length,
    last15Minutes: countWithinWindow(15),
    last60Minutes: countWithinWindow(60),
    last240Minutes: countWithinWindow(240),
    throughputPerHour: currentFeedListings.length
      ? Math.max(1, Math.round(currentFeedListings.length / feedWindowHours))
      : 0,
    matchedRate: currentFeedListings.length
      ? Math.round((currentFeedListings.filter((listing) => hasMatchedMedia(listing)).length / currentFeedListings.length) * 100)
      : 0,
    matchedCount: currentFeedListings.filter((listing) => hasMatchedMedia(listing)).length,
    channelCount: channelCounts.size,
    topChannel: [...channelCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([channel, count]) => ({ channel, count }))[0] || null,
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

  const normalized = listings
    .map((listing, index) =>
      normalizeListing(
        {
          ...listing,
          id: listing?.id ?? `${options.source || 'backup'}-${index + 1}`,
        },
        options,
      ),
    )
    .filter((listing) => !(listing.name.startsWith('Massage Listing') && listing.location === DEFAULT_LOCATION));

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
