import {
  canonicalizePublicListings,
  hasMatchedPublicMedia,
  isBadPublicName,
  buildPhoneKey,
  normalizePublicListing,
  validatePublicListing,
} from './listing_contract.js';
import {
  cleanDisplayText,
  inferCityFromLocation as inferCityFromText,
  normalizePhone,
  normalizeText,
} from './normalization.js';

const DEFAULT_LOCATION = 'Bangkok, Thailand';

// Softer than isBadPublicName: น้อง… nicknames are named faces for labour
// counts even when they are too thin to be a directory card title.
function isCountableFaceName(name) {
  const value = String(name || '').trim();
  if (value.length < 2) return false;
  if (/^https?:\/\//i.test(value) || /^www\./i.test(value)) return false;
  if (/^@[\w.-]{3,}$/i.test(value)) return false;
  if (/^\d{1,2}[:.]\d{2}/.test(value)) return false;
  if (/^(?:teleg|telegram|openchat|location|gps|line|update|facebook\s*page)$/i.test(value)) return false;
  if (/group joining details|คำเชิญให้เข้าร่วม/i.test(value)) return false;
  if (isBadPublicName(value) && !/^น้อง[\p{L}\p{N}_-]{1,16}$/u.test(value)) return false;
  return true;
}

export const SOURCE_LABELS = {
  supabase: 'Live sync',
  firestore: 'Live sync (Firestore)',
  snapshot: 'Verified snapshot',
  backup: 'Cached fallback',
};

const UNSAFE_VISUAL_TAGS = new Set([
  'Adult Entertainment',
  'Adult Services',
  'Erotic Massage',
  'Escort',
  'Model',
  'Young Talent',
]);

const UNSAFE_VISUAL_RE =
  /(?:adult|erotic|escort|full\s*service|xxx|porn|nude|naked|onlyfans|18\+|vip\s*group|งานแรง|งานครบ|บริการพิเศษ|เสียว|เสร[็้]จ|อม(?:ไม่)?อั้?น|อมไม|จบ\s*\d{3,5}|โป้|โป๊|กลุ่มลับ|คลิป(?:โป้|โป๊|ลับ))/i;

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
  const normalized = normalizePublicListing(rawListing, {
    source,
    isFallback: options.isFallback,
    allowUnverified: source === 'backup',
  });

  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    id: normalized.id ?? `${source}-${normalized.name}-${normalized.location}`,
    city: normalized.city || resolveCity(rawListing?.city, normalized.location),
    description: normalized.description || 'Details for this listing are still being collected.',
    photoCount: Array.isArray(rawListing?.photo_urls) ? rawListing.photo_urls.length :
      Array.isArray(rawListing?.allPhotoUrls) ? rawListing.allPhotoUrls.length :
      Array.isArray(normalized.allPhotoUrls) ? normalized.allPhotoUrls.length : 0,
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
  return parseTimestamp(listing?.updatedAt || listing?.updated_at || listing?.createdAt || listing?.created_at);
}

export function getListingTimestamp(listing) {
  return parseTimestamp(
    listing?.postedAt ||
      listing?.posted_at ||
      listing?.updatedAt ||
      listing?.updated_at ||
      listing?.createdAt ||
      listing?.created_at,
  );
}

export function getListingTimestampValue(listing) {
  const date = getListingTimestamp(listing);
  return date ? date.getTime() : 0;
}

export function hasMatchedMedia(listing) {
  return getSafeListingGalleryUrls(listing).length > 0 || (isListingMediaSafe(listing) && hasMatchedPublicMedia(listing));
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

  // Normalize every persona-post first — including ones with junk titles —
  // then merge by phone. Filtering quality *before* merge drops staff aliases
  // and can erase the only post that carried a real phone number.
  const normalized = listings
    .map((listing, index) =>
      normalizeListing(
        {
          ...listing,
          id: listing?.id ?? `${options.source || 'backup'}-${index + 1}`,
        },
        { ...options, allowUnverified: true },
      ),
    )
    .filter(Boolean);

  const canonicalized = canonicalizePublicListings(normalized, {
    source: options.source || 'backup',
    isFallback: options.isFallback,
    allowUnverified: true,
  });

  const gated = canonicalized.filter(
    (listing) => options.source === 'backup' || validatePublicListing(listing).ok,
  );

  return visualDeduplication(gated);
}

// Alias-aware dedup: one business = one phone number. The corpus shows a 31×
// duplication factor (2,770 persona-posts → ~90 real phones; one operator used
// 38 names), so instead of silently dropping duplicates we merge them — the
// canonical card is the freshest post, and the identities/photos/mentions of
// every other persona roll up into it.
function visualDeduplication(listings) {
  const seenImages = new Set();
  const byPhone = new Map();
  const deduped = [];

  for (const listing of listings) {
    const imageUrl = listing.imageUrl;
    const phone = normalizePhone(listing.phone);
    const isMock = !imageUrl || imageUrl.startsWith('/mockups/');

    if (phone) {
      const phoneKey = buildPhoneKey(listing.phone) || phone;
      const canonical = byPhone.get(phoneKey);
      if (canonical) {
        // Roll this persona up into the canonical business
        const name = (listing.name || '').trim();
        if (name && name !== canonical.name && !canonical.aliasNames.includes(name)) {
          canonical.aliasNames.push(name);
        }
        canonical.aliasCount = canonical.aliasNames.length + 1;
        canonical.mentionCount =
          (Number(canonical.mentionCount) || 1) + (Number(listing.mentionCount) || 1);
        // Merge photo archives (newest-first canonical set stays in front)
        const extraPhotos = Array.isArray(listing.allPhotoUrls) ? listing.allPhotoUrls : [];
        if (extraPhotos.length) {
          const merged = [...new Set([...(canonical.allPhotoUrls || []), ...extraPhotos])];
          canonical.allPhotoUrls = merged.slice(0, 24);
        }
        // Keep contact fields the canonical post lacks
        for (const field of ['hours', 'lineUrl', 'telegramUrl', 'mapsUrl', 'priceValue', 'priceLabel']) {
          if (!canonical[field] && listing[field]) canonical[field] = listing[field];
        }
        continue;
      }
      const entry = {
        ...listing,
        aliasNames: Array.isArray(listing.aliasNames) ? [...listing.aliasNames] : [],
        aliasCount: listing.aliasCount || 1,
      };
      byPhone.set(phoneKey, entry);
      deduped.push(entry);
      if (!isMock) seenImages.add(imageUrl);
      continue;
    }

    // No phone: dedup by image only
    if (!isMock) {
      if (seenImages.has(imageUrl)) continue;
      seenImages.add(imageUrl);
    }

    deduped.push(listing);
  }

  return deduped;
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
  const withPhone = normalizedListings.filter((listing) => listing.phone).length;
  const withContact = normalizedListings.filter((listing) =>
    listing.phone || listing.lineUrl || listing.telegramUrl || listing.mapsUrl,
  ).length;
  const uniquePhones = new Set(
    normalizedListings
      .map((listing) => buildPhoneKey(listing.phone))
      .filter(Boolean),
  ).size;
  // Named faces = every advertised identity on the card, not only the
  // canonical title. Phone-dedup collapses LOUISSPA-style chains to one
  // venue; the minister still needs the labour-surface count of names aired.
  // Soft filter only: keep น้อง… staff nicknames (those ARE faces); drop
  // channel chrome, URLs, hours, and pure spam that isBadPublicName catches
  // for card titles.
  const uniqueNames = new Set();
  for (const listing of normalizedListings) {
    const candidates = [listing.name, ...(listing.aliasNames || [])];
    for (const candidate of candidates) {
      const name = String(candidate || '').trim();
      if (!isCountableFaceName(name)) continue;
      uniqueNames.add(name.toLowerCase());
    }
  }

  return {
    total: normalizedListings.length,
    bangkokCount,
    cityCount,
    sourceChannelCount,
    matchedMediaCount,
    withPhone,
    withContact,
    uniquePhones,
    uniqueNames: uniqueNames.size,
    mediaRate: normalizedListings.length
      ? Math.round((matchedMediaCount / normalizedListings.length) * 100)
      : 0,
    contactRate: normalizedListings.length
      ? Math.round((withContact / normalizedListings.length) * 100)
      : 0,
    coverage: normalizedListings.length
      ? Math.round((bangkokCount / normalizedListings.length) * 100)
      : 0,
    liveWindowCount,
    latestTimestamp: latestDate ? latestDate.toISOString() : null,
  };
}

// True relative time for the realtime feel: "12m ago", "3h ago", "2d ago".
export function formatTimeAgo(value) {
  const date = parseTimestamp(value);
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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

export function isListingNew(listing) {
  const timestamp =
    listing?.updatedAt ||
    listing?.updated_at ||
    listing?.postedAt ||
    listing?.posted_at ||
    listing?.createdAt ||
    listing?.created_at;
  if (!timestamp) return false;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return false;
  const diffHours = (new Date() - date) / 3600000;
  return diffHours <= 24;
}

export function getListingMediaCount(listing) {
  return getListingGalleryUrls(listing).length;
}

// ─── Venue identity (shared by ListingCard + FeedCard) ─────────────────────
// One implementation instead of two — previously ListingCard alone had this
// letter-avatar fallback and FeedCard had none, so a broken feed photo just
// rendered as a browser broken-image icon forever.

export function coverVariant(identity) {
  const key = String(identity || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `cv${(hash % 6) + 1}`;
}

export function venueInitial(name) {
  const clean = String(name || '').replace(/^[^A-Za-z฀-๿]+/, '').trim();
  return (clean[0] || '·').toUpperCase();
}

export function getListingGalleryUrls(listing) {
  if (!listing) return [];

  // Hero image first (pipeline rotates it to the latest post's photo), then the
  // archived photo arrays reversed so newest uploads lead — never the same
  // first-ever photo forever.
  const urls = [
    listing.imageUrl,
    listing.image_url,
    ...(Array.isArray(listing.allPhotoUrls) ? [...listing.allPhotoUrls].reverse() : []),
    ...(Array.isArray(listing.photo_urls) ? [...listing.photo_urls].reverse() : []),
  ];

  return [...new Set(
    urls
      .filter(Boolean)
      .map((url) => String(url).trim())
      .filter((url) => url && !url.startsWith('/mockups/')),
  )];
}

export function hasUnsafeVisualSignal(listing) {
  const tags = [
    ...(Array.isArray(listing?.tags) ? listing.tags : []),
    ...(Array.isArray(listing?.serviceTags) ? listing.serviceTags : []),
    ...(Array.isArray(listing?.service_tags) ? listing.service_tags : []),
  ].map((tag) => String(tag).trim());

  if (tags.some((tag) => UNSAFE_VISUAL_TAGS.has(tag))) {
    return true;
  }

  const text = [
    listing?.name,
    listing?.location,
    listing?.description,
    listing?.rawText,
    listing?.raw_text,
    ...tags,
  ].filter(Boolean).join(' ');

  return UNSAFE_VISUAL_RE.test(text);
}

export function isListingMediaSafe(listing) {
  return listing?.isSafeImage !== false && !hasUnsafeVisualSignal(listing);
}

export function getSafeListingGalleryUrls(listing) {
  if (!isListingMediaSafe(listing)) return [];
  return getListingGalleryUrls(listing);
}

// ─── Grey Score ───────────────────────────────────────────────────────────────
// Probability (0–100) that this listing is NOT a standard therapeutic massage.
// Based on the alibi-structure research: the vocabulary is shared, but signal
// combinations within it indicate which side of สายขาว/สายดำ a listing sits on.
// Score ≤ 30 = likely legitimate | 31–54 = ambiguous | 55–74 = grey signal | ≥ 75 = strong grey

export function computeGreyScore(listing) {
  if (!listing) return { score: 35, level: 'ambiguous', signals: [] };

  let points = 0;
  const signals = [];

  const allTags = [
    ...(Array.isArray(listing.tags) ? listing.tags : []),
    ...(Array.isArray(listing.serviceTags) ? listing.serviceTags : []),
  ].map((t) => String(t).toLowerCase());

  const raw = [
    listing.rawText || listing.raw_text || '',
    listing.description || '',
    allTags.join(' '),
    listing.name || '',
  ].join(' ').toLowerCase();

  // ── STRONG GREY signals ──────────────────────────────────────────────────

  if (listing.isSafeImage === false) {
    points += 40;
    signals.push({ w: 'strong', t: 'NSFW content flagged' });
  }

  const EXPLICIT_TAGS = ['erotic massage', 'adult services', 'escort', 'full service', 'adult entertainment'];
  if (allTags.some((t) => EXPLICIT_TAGS.some((e) => t.includes(e)))) {
    points += 35;
    signals.push({ w: 'strong', t: 'Explicit service category' });
  }

  if (/บริการพิเศษ|จบ\s*\d|อมไม่|อมได้|เสียว|โป้|โป๊|งานครบ|งานแรง/.test(raw)) {
    points += 30;
    signals.push({ w: 'strong', t: 'Coded vocabulary (research-identified)' });
  }

  // ── MEDIUM GREY signals ──────────────────────────────────────────────────

  if (/body|บอดี้|b2b|body.to.body/.test(raw)) {
    points += 18;
    signals.push({ w: 'medium', t: 'Body-to-body service' });
  }

  if (/outcall|out.call|รับออก|เอ้าท์/.test(raw)) {
    points += 12;
    signals.push({ w: 'medium', t: 'Outcall service' });
  }

  if (/อาบน้ำให้|อาบน้ำด้วย|shower together|อาบด้วยกัน/.test(raw)) {
    points += 15;
    signals.push({ w: 'medium', t: 'Shared shower offered' });
  }

  const mentions = Number(listing.mentionCount || 0);
  if (mentions >= 20) {
    points += 15;
    signals.push({ w: 'medium', t: `${mentions}× repeat posts` });
  } else if (mentions >= 8) {
    points += 7;
    signals.push({ w: 'low', t: `${mentions}× repeat posts` });
  }

  const price = Number(listing.priceValue || 0);
  if (price >= 400 && price <= 800) {
    points += 7;
    signals.push({ w: 'low', t: `฿${price} — alibi price range` });
  }

  // Oil as SOLE service (no traditional Thai / foot listed alongside)
  const hasOil = /อโรม่า|aroma|น้ำมัน|oil massage/.test(raw);
  const hasTrad = /แผนไทย|foot|reflexol|เท้า/.test(raw);
  if (hasOil && !hasTrad) {
    points += 10;
    signals.push({ w: 'low', t: 'Oil-only (no traditional service)' });
  }

  // ── LEGITIMACY signals ───────────────────────────────────────────────────

  if (listing.mapsUrl) {
    points -= 22;
    signals.push({ w: 'green', t: 'Maps URL — operator-confirmed listing' });
  }

  if (/แผนไทย|nuad thai|traditional thai|reflexol/.test(raw)) {
    points -= 12;
    signals.push({ w: 'green', t: 'Traditional Thai / reflexology' });
  }

  if (allTags.length >= 5) {
    points -= 8;
    signals.push({ w: 'green', t: 'Full service menu (spa profile)' });
  }

  if (Number(listing.credibility || 0) >= 75) {
    points -= 8;
    signals.push({ w: 'green', t: 'High credibility score' });
  }

  // Baseline 35%: the corpus is ambiguous by design (the alibi thesis)
  const score = Math.max(8, Math.min(92, 35 + points));
  const level =
    score < 30 ? 'legit' :
    score < 55 ? 'ambiguous' :
    score < 75 ? 'grey' : 'strong';

  return { score, level, signals };
}

// ─── Maps Verification Status ────────────────────────────────────────────────
// Returns the best available Maps link and its verification tier:
//   'confirmed' — operator provided their own Maps URL (strongest signal)
//   'coords'    — system has geocoded coordinates, link to place on map
//   'search'    — no location data; construct a text-search URL

export function getMapsStatus(listing) {
  if (listing?.mapsUrl) {
    return { status: 'confirmed', link: listing.mapsUrl };
  }
  const lat = Number(listing?.latitude);
  const lng = Number(listing?.longitude);
  if (lat && lng && Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01) {
    return {
      status: 'coords',
      link: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }
  const q = encodeURIComponent(
    [listing?.name, listing?.location, listing?.city, 'Thailand']
      .filter(Boolean).join(' '),
  );
  return {
    status: 'search',
    link: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}
