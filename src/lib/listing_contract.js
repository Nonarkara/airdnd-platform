import { CITY_PATTERNS, cleanDisplayText, normalizeText, normalizePhone, inferCityFromLocation } from './normalization.js';
import { rewriteMediaUrl, rewriteMediaUrls } from './media.js';

export const DEFAULT_PUBLIC_LOCATION = 'Bangkok, Thailand';
export const DEFAULT_PUBLIC_IMAGE = '/mockups/109748.jpg';

// Re-export from normalization utility for backward compatibility
export { CITY_PATTERNS, cleanDisplayText, normalizeText, normalizePhone, inferCityFromLocation };

const PLACEHOLDER_LOCATIONS = new Set([
  '',
  'bangkok',
  'bangkok, thailand',
  'thailand',
  'null',
  'undefined',
  'ร้าน',
  'ร้านนวดใกล้ฉัน',
]);

const SERVICE_NAME_RE = /massage|spa|นวด|สปา|เพื่อสุขภาพ|wellness|therapy|therapist|คลินิก|clinic|health|สุขภาพ/i;
const CONTACT_NAME_RE = /^(?:โทร|ติดต่อ(?:สอบถาม)?|จอง(?:คิว)?|แอด(?:ไลน์|ไลน)?|โทรศัพท์)|^(?:line|id line)(?=\s|[:：\d@]|$)|(?:โทรศัพท์|ติดต่อไลน์|แอดไอดีไลน์|line\s*id|id\s*line|จอง\d)/i;
const STAFF_LINEUP_RE = /(?:น้องๆวันที่|รายชื่อ|line\s*up|lineup|update\s*(?:today|now)|อัพเดต|อัพเดท|แจ้งเข้า|รอบดึก|เปิดรับรอบจองด่วน|คิวว่างตอนนี้|เลือกน้อง|เลือกหมอ|เลือกสาว|น้อง\s*\S{1,12}\s*(?:อายุ|age|สูง|น้ำหนัก|weight|height))/i;
const META_NAME_RE = /^(?:หมายเหตุ|หมายเหต|นวดแนะนำ|เปิด\s*(?:ทุกวัน|บริการ)|ทุกรายการนวด)/i;
const AD_COPY_RE = /(?:หุ่น|หน้าคม|ไฟหน้า|ตัวเล็ก|สเป็ค|เสี่ย|งานดี|เด็ด|แซ่บ|ฟิน|ตัวจริง|ไม่ผิดหวัง|พร้อมให้บริการ|งานครบ|การบ้าน|โปรโมชั่น|โปรโมชัน|ส่งท้ายเดือน|กินตอนดึก|ใกล้เสร็จ|อดทนหน่อย|หื่น|บริการพิเศษ|full\s*service|escort|listing)/i;
const ADULT_OR_SPAM_RE = /(?:xxx|porn|18\+|โป้|โป๊|หลุด|เสียว|เสร[็้]จ|นวดเสียว|อม(?:ไม่)?อั้?น|อมไม|จบ\s*\d{3,5}|nude|naked|onlyfans|กลุ่มลับ|vip\s*group|ขาย\s*(?:คลิป|clip|vdo|video)|คลิป\s*(?:โป้|โป๊|18\+|ลับ)|children'?s only|group joining details)/i;
const LOCATION_NOISE_RE = /(?:เปิดบริการ|สวัสดี|line|โทร|#|บริการทุกวัน|จองคิว|แอดไลน์|หื่น|กินตอนดึก|ใกล้เสร็จ|งานนวดจัดจ้าน|การันตี|ฟิว|โปรโมชั่น|\d{1,2}[:.]\d{2})/i;

// inferCityFromText is an alias for inferCityFromLocation (imported above)
export const inferCityFromText = inferCityFromLocation;

export function cleanLocationLabel(location) {
  const cleaned = cleanDisplayText(
    normalizeText(location, '')
      .replace(/^#/, '')
      .replace(/^(?:พิกัด|พิกัดฐานทัพ|location|map|maps)\s*[:：]?\s*/i, '')
      .replace(/^แผนที่ร้านนวดใกล้ฉัน\s*/i, '')
      .replace(/\([^)]*\)/g, ' '),
  );

  return cleaned;
}

export function isValidCoordinates(latitude, longitude) {
  const lat = typeof latitude === 'number' ? latitude : Number.parseFloat(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number.parseFloat(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function hasStoredCoordinates(listing) {
  return isValidCoordinates(listing?.latitude, listing?.longitude);
}

function normalizeAddressText(value) {
  return normalizeText(value, '')
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMapsAddress(value) {
  const raw = normalizeText(value, '');
  if (!raw) {
    return '';
  }

  const fromSearchParam = (candidate) => {
    const address = normalizeAddressText(candidate || '');
    if (address && !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(address)) {
      return address.slice(0, 120);
    }
    return '';
  };

  try {
    const url = new URL(raw);
    const address = fromSearchParam(url.searchParams.get('q'));
    if (address) {
      return address;
    }
  } catch {
    // Ignore malformed URLs.
  }

  const decoded = decodeURIComponent(raw.replace(/&amp;/g, '&').replace(/\+/g, ' '));
  const paramMatch = decoded.match(/[?&](?:q|query)=([^"&<>]+)/i);
  const embeddedAddress = fromSearchParam(paramMatch?.[1]);
  if (embeddedAddress) {
    return embeddedAddress;
  }

  const placeMatch = decoded.match(/\/maps\/(?:place|search)\/([^/?#"<>]+)/i);
  const placeAddress = fromSearchParam(placeMatch?.[1]);
  if (placeAddress && !/^(?:data|dir|@)/i.test(placeAddress)) {
    return placeAddress;
  }

  return '';
}

export function isVerifiedLocation(valueOrListing) {
  if (hasStoredCoordinates(valueOrListing)) {
    return true;
  }

  const location = typeof valueOrListing === 'object'
    ? valueOrListing?.location
    : valueOrListing;
  const cleaned = cleanLocationLabel(location);
  const comparable = cleaned.toLowerCase();

  if (PLACEHOLDER_LOCATIONS.has(comparable)) {
    return false;
  }

  if (!cleaned || cleaned.length < 3 || cleaned.length > 96) {
    return false;
  }

  if (LOCATION_NOISE_RE.test(cleaned) || ADULT_OR_SPAM_RE.test(cleaned) || AD_COPY_RE.test(cleaned)) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(cleaned);
}

export function extractPhoneCandidates(value) {
  const matches = String(value || '').match(/(?:\+?66|0)\d[\d .-]{6,}\d/g) || [];
  return [...new Set(matches.map((match) => normalizePhone(match)).filter(Boolean))];
}


export function buildPhoneKey(value) {
  const candidates = extractPhoneCandidates(value);
  const phone = candidates[0] || normalizePhone(value);
  return phone || '';
}

function normalizeUrl(value) {
  return normalizeText(value, '').replace(/[)\]}>,.]+$/g, '');
}

function getNormalizedHostname(value) {
  return String(value || '').toLowerCase().replace(/\.+$/g, '').replace(/^www\./, '');
}

function isGoogleDomain(hostname) {
  const host = getNormalizedHostname(hostname);
  return host === 'google.com'
    || host.endsWith('.google.com')
    || /^(.+\.)?google\.[a-z]{2,}(?:\.[a-z]{2})?$/.test(host);
}

export function isGoogleMapsUrl(value) {
  const raw = normalizeUrl(value);
  if (!raw) {
    return false;
  }

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const host = getNormalizedHostname(url.hostname);
    const path = normalizePath(url.pathname);

    if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && path.startsWith('/maps'))) {
      return true;
    }

    if ((host === 'g.co' && path.startsWith('/kgs')) || host === 'share.google') {
      return true;
    }

    const isMapsGoogleHost = (host === 'maps.google.com' || host.startsWith('maps.google.')) && isGoogleDomain(host);
    return isMapsGoogleHost
      || (isGoogleDomain(host) && path.includes('/maps'));
  } catch {
    return false;
  }
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/g, '').toLowerCase();
}

function normalizeToken(value) {
  return normalizeText(value, '')
    .toLowerCase()
    .replace(/[\s/_-]+/g, '')
    .replace(/[^\p{L}\p{N}@.]+/gu, '');
}

export function buildMapsKey(value) {
  const raw = normalizeUrl(value);
  if (!raw) {
    return '';
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = normalizePath(url.pathname);

    if (host === 'maps.app.goo.gl' || host === 'goo.gl') {
      return `${host}${path}`;
    }

    if (host.endsWith('google.com') && path.includes('/maps')) {
      const ftid = normalizeText(url.searchParams.get('ftid'), '');
      if (ftid) {
        return `google-ftid:${ftid.toLowerCase()}`;
      }

      const cid = normalizeText(url.searchParams.get('cid'), '');
      if (cid) {
        return `google-cid:${cid.toLowerCase()}`;
      }

      const q = normalizeToken(url.searchParams.get('q'));
      if (q) {
        return `google-q:${q}`;
      }
    }
  } catch {
    return raw.toLowerCase();
  }

  return raw.toLowerCase();
}

export function buildLineKey(value) {
  const raw = normalizeUrl(value);
  if (!raw) {
    return '';
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('line.me')) {
      return '';
    }
    return `${host}${normalizePath(url.pathname)}${url.search ? url.search.toLowerCase() : ''}`;
  } catch {
    return normalizeToken(raw);
  }
}

export function normalizeNameForIdentity(name) {
  return cleanDisplayText(name)
    .toLowerCase()
    .replace(/^(?:ร้าน|🙏\s*#?|#)/u, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

export function normalizeLocationForIdentity(location) {
  return cleanLocationLabel(location)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

export function isBadPublicName(name) {
  const normalized = cleanDisplayText(name);
  const comparable = normalized.toLowerCase();

  if (!normalized || normalized.length < 3) {
    return true;
  }

  if (
    /^(?:group joining details|group|telegram|open|เปิด|นี้|massage|spa|สปา|line|new|unknown)$/i.test(normalized) ||
    CONTACT_NAME_RE.test(normalized) ||
    STAFF_LINEUP_RE.test(normalized) ||
    META_NAME_RE.test(normalized) ||
    AD_COPY_RE.test(normalized) ||
    ADULT_OR_SPAM_RE.test(normalized) ||
    /^@[\w.-]{3,}$/i.test(normalized) ||
    /^\d[\d -]{7,}$/.test(normalized) ||
    /^\d{1,2}[:.]\d{2}/.test(normalized) ||
    /[:：=]/.test(normalized) ||
    (/society/i.test(normalized) && !SERVICE_NAME_RE.test(normalized)) ||
    /^น้อง[\p{L}\p{N}_-]{1,16}$/u.test(normalized) ||
    /^หมอ[\p{L}\p{N}_-]{1,16}$/u.test(normalized) ||
    (/^[\u0E00-\u0E7F]{1,5}$/.test(normalized) && !SERVICE_NAME_RE.test(normalized))
  ) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (!SERVICE_NAME_RE.test(normalized) && wordCount >= 5) {
    return true;
  }

  if (!SERVICE_NAME_RE.test(normalized) && comparable.length > 42) {
    return true;
  }

  return false;
}

export function hasAdultOrSpamSignal(listing) {
  const text = [
    listing?.name,
    listing?.location,
    listing?.description,
    listing?.rawText,
    listing?.raw_text,
  ].filter(Boolean).join(' ');

  return ADULT_OR_SPAM_RE.test(text);
}

export function buildCanonicalKey(listing) {
  // Phone is the strongest identity signal (same number = same operator,
  // regardless of staff aliases or recycled Maps links). Maps-first merging
  // previously absorbed distinct booking phones into one card and undercounted
  // the inventory — fatal for any official brief.
  const phoneKey = buildPhoneKey(listing?.phone);
  if (phoneKey) {
    return `phone:${phoneKey}`;
  }

  const mapsKey = buildMapsKey(listing?.mapsUrl || listing?.maps_url);
  if (mapsKey) {
    return `maps:${mapsKey}`;
  }

  const lineKey = buildLineKey(listing?.lineUrl || listing?.line_url);
  if (lineKey) {
    return `line:${lineKey}`;
  }

  const nameKey = normalizeNameForIdentity(listing?.name);
  const locationKey = normalizeLocationForIdentity(listing?.location);
  if (nameKey && locationKey && isVerifiedLocation(listing?.location)) {
    return `name-location:${nameKey}:${locationKey}`;
  }

  return '';
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

function extractPriceValue(priceLabel) {
  const numeric = String(priceLabel || '').replace(/[^\d]/g, '');
  if (!numeric) {
    return null;
  }

  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sanitizePriceLabel(rawPriceLabel) {
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
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return {};
  }

  const nextMetrics = {};
  if (metrics.height) {
    nextMetrics.height = String(metrics.height).trim();
  }
  if (metrics.weight) {
    nextMetrics.weight = String(metrics.weight).trim();
  }
  const availabilityStatus = String(metrics.availability_status || metrics.availabilityStatus || '').toLowerCase();
  if (['available', 'unavailable', 'unknown'].includes(availabilityStatus)) {
    nextMetrics.availability_status = availabilityStatus;
  }
  if (metrics.availability_evidence || metrics.availabilityEvidence) {
    nextMetrics.availability_evidence = normalizeText(
      metrics.availability_evidence || metrics.availabilityEvidence,
      null,
    );
  }
  const availableStaffCount = normalizeInteger(
    metrics.available_staff_count ?? metrics.availableStaffCount,
  );
  if (availableStaffCount !== null && availableStaffCount >= 0 && availableStaffCount <= 100) {
    nextMetrics.available_staff_count = availableStaffCount;
  }
  return nextMetrics;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeText(String(item), '')).filter(Boolean);
}

function pickNewestTimestamp(...values) {
  return values
    .map((value) => normalizeText(value, ''))
    .filter(Boolean)
    .map((value) => ({ value, timestamp: new Date(value).getTime() }))
    .filter((candidate) => Number.isFinite(candidate.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp)[0]?.value || null;
}

function normalizeSourceMeta(rawListing) {
  const rawMetrics =
    rawListing?.metrics && typeof rawListing.metrics === 'object' ? rawListing.metrics : {};

  return {
    postedAt: pickNewestTimestamp(
      rawListing?.postedAt,
      rawListing?.posted_at,
      rawMetrics.__postedAt,
      rawMetrics.postedAt,
      rawMetrics.posted_at,
    ),
    sourceChannel: normalizeText(
      rawListing?.sourceChannel ||
        rawListing?.source_channel ||
        rawMetrics.__sourceChannel ||
        rawMetrics.sourceChannel ||
        rawMetrics.source_channel,
      null,
    ),
    sourceTarget: normalizeText(
      rawListing?.sourceTarget ||
        rawListing?.source_target ||
        rawMetrics.__sourceTarget ||
        rawMetrics.sourceTarget ||
        rawMetrics.source_target,
      null,
    ),
  };
}

export function normalizePublicListing(rawListing, options = {}) {
  if (!rawListing || typeof rawListing !== 'object') {
    return null;
  }

  const source = options.source || rawListing.dataSource || rawListing.data_source || 'snapshot';
  const allowUnverified = options.allowUnverified === true || source === 'backup';
  const sourceMeta = normalizeSourceMeta(rawListing);
  const location = cleanLocationLabel(rawListing.location);
  const mapsUrl = normalizeUrl(rawListing.mapsUrl || rawListing.maps_url);
  const imageUrl = rewriteMediaUrl(normalizeText(rawListing.imageUrl || rawListing.image_url, null));
  const isSafeImage = rawListing.is_safe_image !== false && rawListing.isSafeImage !== false;
  const safeImageUrl =
    isSafeImage && (source === 'backup' || !imageUrl?.startsWith('/mockups/'))
      ? imageUrl
      : null;
  const latitude = normalizeNumber(rawListing.latitude);
  const longitude = normalizeNumber(rawListing.longitude);
  const priceLabel = sanitizePriceLabel(rawListing.priceLabel || rawListing.price);
  const rating = normalizeNumber(rawListing.rating);
  const reviews = normalizeInteger(rawListing.reviews);
  const userRating = normalizeNumber(rawListing.user_rating || rawListing.userRating);
  const mentionCount = normalizeInteger(rawListing.mention_count || rawListing.mentionCount) || 0;

  const listing = {
    id: rawListing.id ?? null,
    name: cleanDisplayText(rawListing.name),
    age: normalizeInteger(rawListing.age),
    location,
    city: inferCityFromText(rawListing.city) || inferCityFromText(location) || normalizeText(rawListing.city, null),
    priceLabel,
    priceValue: extractPriceValue(priceLabel),
    description: normalizeText(rawListing.description, ''),
    tags: normalizeArray(rawListing.tags),
    metrics: normalizeMetrics(rawListing.metrics),
    imageUrl: safeImageUrl,
    rating: rating && rating > 0 ? rating : null,
    reviews: reviews && reviews > 0 ? reviews : null,
    updatedAt: normalizeText(rawListing.updatedAt || rawListing.updated_at || rawListing.created_at, null),
    createdAt: normalizeText(rawListing.createdAt || rawListing.created_at, null),
    postedAt: sourceMeta.postedAt,
    sourceChannel: sourceMeta.sourceChannel,
    sourceTarget: sourceMeta.sourceTarget,
    phone: normalizeText(rawListing.phone, null),
    hours: normalizeText(rawListing.hours, null),
    lineUrl: normalizeUrl(rawListing.lineUrl || rawListing.line_url) || null,
    telegramUrl: normalizeUrl(rawListing.telegramUrl || rawListing.telegram_url) || null,
    mapsUrl: mapsUrl || null,
    latitude: isValidCoordinates(latitude, longitude) ? latitude : null,
    longitude: isValidCoordinates(latitude, longitude) ? longitude : null,
    rawText: normalizeText(rawListing.rawText || rawListing.raw_text, null),
    sourceMessageIds: normalizeArray(rawListing.sourceMessageIds || rawListing.source_message_ids),
    allPhotoUrls: rewriteMediaUrls(normalizeArray(rawListing.allPhotoUrls || rawListing.photo_urls)),
    drivePhotoUrls: rewriteMediaUrls(normalizeArray(rawListing.drivePhotoUrls || rawListing.drive_photo_urls)),
    userRating: userRating && userRating > 0 && userRating <= 5 ? userRating : null,
    serviceTags: normalizeArray(rawListing.serviceTags || rawListing.service_quality || rawListing.service_tags),
    userFeedbackSummary: normalizeText(rawListing.userFeedbackSummary || rawListing.user_feedback_summary || rawListing.discussion_notes, null),
    isSafeImage,
    mentionCount,
    aliasNames: normalizeArray(rawListing.aliasNames || rawListing.alias_names)
      .map((name) => cleanDisplayText(name))
      .filter(Boolean),
    aliasCount: normalizeInteger(rawListing.aliasCount || rawListing.alias_count) || 0,
    credibility: Number.isFinite(rawListing.credibility) ? Number(rawListing.credibility) : null,
    dataSource: source,
    isFallback: Boolean(options.isFallback),
  };

  listing.canonicalKey = normalizeText(rawListing.canonical_key || rawListing.canonicalKey, '') || buildCanonicalKey(listing);
  listing.city = listing.city || inferCityFromText([listing.location, listing.description, listing.rawText].filter(Boolean).join(' '));

  if (!allowUnverified && !validatePublicListing(listing).ok) {
    return null;
  }

  return listing;
}

export function validatePublicListing(listing) {
  if (!listing) {
    return { ok: false, reason: 'missing listing' };
  }

  if (hasAdultOrSpamSignal(listing)) {
    return { ok: false, reason: 'adult or spam signal' };
  }

  if (isBadPublicName(listing.name)) {
    return { ok: false, reason: 'bad public name' };
  }

  // Coordinates are only required for the map. The directory should show
  // every legitimate listing, geocoded or not — the map's pendingListings
  // section already surfaces uncoordinated rows separately.
  // Location verification falls back to "has SOME location text" so we
  // don't drop listings whose Telegram post used an informal location.
  if (!isVerifiedLocation(listing.location) && !hasStoredCoordinates(listing) && !listing.mapsUrl && !listing.lineUrl && !listing.phone) {
    return { ok: false, reason: 'no identifiable location or contact' };
  }

  // A public card without a phone must still look like a shop — otherwise
  // channel chrome ("Teleg", "สอบถามและจองคิว") pads the inventory.
  if (!buildPhoneKey(listing.phone) && !SERVICE_NAME_RE.test(listing.name || '')) {
    return { ok: false, reason: 'no phone and no shop name' };
  }

  if (!buildCanonicalKey(listing)) {
    return { ok: false, reason: 'missing canonical identity' };
  }

  return { ok: true, reason: null };
}

export function hasMatchedPublicMedia(listing) {
  const imageUrl = normalizeText(listing?.imageUrl || listing?.image_url, '');
  return Boolean(imageUrl) && !imageUrl.startsWith('/mockups/');
}

function getFreshnessValue(listing) {
  const value = listing?.postedAt || listing?.posted_at || listing?.updatedAt || listing?.updated_at || listing?.createdAt || listing?.created_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function scoreCanonicalCandidate(listing) {
  let score = 0;
  if (hasStoredCoordinates(listing)) score += 60;
  if (buildMapsKey(listing?.mapsUrl || listing?.maps_url)) score += 35;
  if (buildPhoneKey(listing?.phone)) score += 25;
  if (buildLineKey(listing?.lineUrl || listing?.line_url)) score += 15;
  if (isVerifiedLocation(listing)) score += 20;
  if (SERVICE_NAME_RE.test(listing?.name || '')) score += 18;
  if (!isBadPublicName(listing?.name)) score += 12;
  if (hasMatchedPublicMedia(listing)) score += 8;
  if (listing?.description) score += Math.min(10, Math.floor(String(listing.description).length / 40));
  if (listing?.mentionCount || listing?.mention_count) score += Math.min(10, Number(listing.mentionCount || listing.mention_count) || 0);
  if (hasAdultOrSpamSignal(listing)) score -= 80;
  if (isBadPublicName(listing?.name)) score -= 50;
  if (!isVerifiedLocation(listing)) score -= 40;
  return score;
}

function chooseBestValue(listings, field, scorer) {
  return [...listings]
    .map((listing) => ({
      value: listing[field],
      score: scorer(listing[field], listing),
    }))
    .filter((row) => normalizeText(row.value, ''))
    .sort((left, right) => right.score - left.score)[0]?.value || null;
}

function unionArrays(listings, field) {
  return [
    ...new Set(
      listings.flatMap((listing) => normalizeArray(listing[field])),
    ),
  ];
}

export function mergeCanonicalGroup(listings) {
  const normalized = (Array.isArray(listings) ? listings : [])
    .map((listing) => normalizePublicListing(listing, {
      source: listing?.dataSource || listing?.data_source || 'supabase',
      allowUnverified: true,
    }))
    .filter(Boolean)
    // Freshest mention first, so unioned photos/tags lead with the newest post.
    .sort((left, right) => getFreshnessValue(right) - getFreshnessValue(left));

  if (normalized.length === 0) {
    return null;
  }

  const survivor = [...normalized].sort((left, right) => {
    const scoreDelta = scoreCanonicalCandidate(right) - scoreCanonicalCandidate(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return getFreshnessValue(right) - getFreshnessValue(left);
  })[0];

  const merged = {
    ...survivor,
    name: chooseBestValue(normalized, 'name', (value) => {
      if (isBadPublicName(value)) return -100;
      return (SERVICE_NAME_RE.test(value) ? 40 : 10) + Math.min(20, String(value).length);
    }) || survivor.name,
    location: chooseBestValue(normalized, 'location', (value, listing) => {
      if (!isVerifiedLocation({ ...listing, location: value })) return -100;
      return (hasStoredCoordinates(listing) ? 30 : 0) + Math.min(50, String(value).length);
    }) || survivor.location,
    description: chooseBestValue(normalized, 'description', (value) => {
      if (ADULT_OR_SPAM_RE.test(value) || AD_COPY_RE.test(value)) return -100;
      return Math.min(100, String(value).length);
    }) || survivor.description,
    phone: chooseBestValue(normalized, 'phone', (value) => buildPhoneKey(value) ? 10 + String(value).length : -100) || survivor.phone,
    hours: chooseBestValue(normalized, 'hours', (value) => String(value || '').length) || survivor.hours,
    lineUrl: chooseBestValue(normalized, 'lineUrl', (value) => buildLineKey(value) ? 10 : -100) || survivor.lineUrl,
    telegramUrl: chooseBestValue(normalized, 'telegramUrl', (value) => normalizeUrl(value) ? 10 : -100) || survivor.telegramUrl,
    mapsUrl: chooseBestValue(normalized, 'mapsUrl', (value) => buildMapsKey(value) ? 10 : -100) || survivor.mapsUrl,
    tags: unionArrays(normalized, 'tags').slice(0, 6),
    serviceTags: unionArrays(normalized, 'serviceTags'),
    sourceMessageIds: unionArrays(normalized, 'sourceMessageIds'),
    allPhotoUrls: unionArrays(normalized, 'allPhotoUrls'),
    drivePhotoUrls: unionArrays(normalized, 'drivePhotoUrls'),
    mentionCount: normalized.reduce((sum, listing) => sum + (Number(listing.mentionCount) || 1), 0),
    isSafeImage: normalized.every((listing) => listing.isSafeImage !== false),
  };

  // A parlour that re-posts keeps its best-quality fields, but its timestamps
  // follow the latest Telegram mention — otherwise a venue advertising every
  // hour still reads "posted 6 days ago" and drops down the freshness sort.
  const freshest = normalized[0];
  if (getFreshnessValue(freshest) > getFreshnessValue(survivor)) {
    if (freshest.postedAt) merged.postedAt = freshest.postedAt;
    if (freshest.updatedAt) merged.updatedAt = freshest.updatedAt;
  }

  const primaryName = String(merged.name || '').trim();
  merged.aliasNames = [
    ...new Set(
      [
        ...normalized.flatMap((listing) => normalizeArray(listing.aliasNames)),
        ...normalized.map((listing) => String(listing.name || '').trim()),
      ]
        .map((name) => String(name || '').trim())
        .filter((name) => name.length >= 2 && name !== primaryName),
    ),
  ];
  merged.aliasCount = merged.aliasNames.length + (primaryName ? 1 : 0);

  const coordSource = normalized.find((listing) => hasStoredCoordinates(listing));
  if (coordSource) {
    merged.latitude = coordSource.latitude;
    merged.longitude = coordSource.longitude;
  }

  merged.city = inferCityFromText(merged.city) || inferCityFromText(merged.location) || survivor.city;
  merged.canonicalKey = buildCanonicalKey(merged);
  return merged;
}

export function canonicalizePublicListings(listings, options = {}) {
  const normalized = (Array.isArray(listings) ? listings : [])
    .map((listing) => normalizePublicListing(listing, {
      source: options.source || listing?.dataSource || listing?.data_source || 'snapshot',
      isFallback: options.isFallback,
      allowUnverified: options.allowUnverified,
    }))
    .filter(Boolean);

  const groups = new Map();
  normalized.forEach((listing) => {
    // Always recompute identity. Stored canonical_key values may predate
    // phone-first dedup and would silently re-merge distinct booking numbers.
    const key = buildCanonicalKey(listing) || (options.allowUnverified && listing.id ? `id:${listing.id}` : '');
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(listing);
  });

  return [...groups.values()]
    .map((group) => mergeCanonicalGroup(group))
    .filter((listing) => listing && (options.allowUnverified || validatePublicListing(listing).ok))
    .sort((left, right) => getFreshnessValue(right) - getFreshnessValue(left));
}

function parseCoordinatePair(latitude, longitude) {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  return isValidCoordinates(lat, lng) ? [lat, lng] : null;
}

// Google's static place-page HTML (post-2024) embeds the same chrome fixture
// `13.95218835, 100.564992` in every page (server-side default before the JS
// hydrates with the real coords). Any bare-text scan would match this for
// every URL — we explicitly reject it.
const GOOGLE_CHROME_FIXTURES = new Set([
  '13.95218835,100.564992',
  '13.9521,100.5650',
]);

function isChromeFixture(lat, lng) {
  return GOOGLE_CHROME_FIXTURES.has(`${lat},${lng}`)
    || GOOGLE_CHROME_FIXTURES.has(`${lat.toFixed(4)},${lng.toFixed(4)}`);
}

// Final fallback for Google's JS-rendered place pages, where the static HTML
// no longer contains @lat,lng or !3d!4d markers. Without a real geocoding API,
// bare-text bbox scanning is unreliable (Google's HTML chrome contains the
// same default coordinates on every page) — so this fallback is intentionally
// conservative: it only returns a hit when the float pair sits in Thailand's
// bbox AND is not the known chrome fixture.
function extractThailandBboxCoords(text) {
  const re = /(-?\d{1,3}\.\d{4,10})/g;
  const found = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = Number.parseFloat(m[1]);
    if (Number.isFinite(val)) {
      found.push({ val, pos: m.index });
    }
  }
  for (let i = 0; i < found.length; i += 1) {
    const a = found[i];
    if (a.val < 5 || a.val > 21) continue;
    for (let j = i + 1; j < found.length && found[j].pos - a.pos < 800; j += 1) {
      const b = found[j];
      if (b.val < 97 || b.val > 106) continue;
      if (isChromeFixture(a.val, b.val)) continue;
      return parseCoordinatePair(a.val, b.val);
    }
  }
  return null;
}

export function extractCoordinatesFromText(value) {
  const text = normalizeText(value, '');
  if (!text) {
    return null;
  }

  // Best-effort URL decode. HTML bodies often contain bare `%` characters
  // that decodeURIComponent rejects; if so, fall back to the raw text.
  let decoded = text.replace(/&amp;/g, '&');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw text — the bare-bbox fallback below handles the JS-rendered case.
  }
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /\/dir\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[/?#]|$)/,
    /(?:center|ll)=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const coords = match ? parseCoordinatePair(match[1], match[2]) : null;
    if (coords) {
      return coords;
    }
  }

  const lngLatMatch = decoded.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (lngLatMatch) {
    const swapped = parseCoordinatePair(lngLatMatch[2], lngLatMatch[1]);
    if (swapped) return swapped;
  }

  // Google JS-rendered place pages: pair bare floats inside Thailand's bbox.
  return extractThailandBboxCoords(decoded);
}

async function followMapsRedirects(fetchImpl, initialUrl, options) {
  const urls = [initialUrl];
  let currentUrl = initialUrl;
  let response = null;

  for (let index = 0; index < 5; index += 1) {
    try {
      response = await fetchImpl(currentUrl, {
        ...options,
        redirect: 'manual',
      });
    } catch (error) {
      if (urls.length > 1) {
        return { response, finalUrl: currentUrl, urls, error };
      }
      throw error;
    }

    const location = typeof response?.headers?.get === 'function'
      ? response.headers.get('location')
      : null;
    const status = Number(response?.status) || 0;
    const isRedirect = [301, 302, 303, 307, 308].includes(status);

    if (!isRedirect || !location) {
      return { response, finalUrl: currentUrl, urls };
    }

    const nextUrl = new URL(location, currentUrl).toString();
    if (!isGoogleMapsUrl(nextUrl)) {
      return {
        response,
        finalUrl: currentUrl,
        urls,
        error: new Error(`Blocked non-Google Maps redirect: ${nextUrl}`),
      };
    }

    currentUrl = nextUrl;
    urls.push(currentUrl);
  }

  return { response, finalUrl: currentUrl, urls };
}

export async function resolveGoogleMapsData(mapsUrl, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!mapsUrl || typeof fetchImpl !== 'function' || !isGoogleMapsUrl(mapsUrl)) {
    return null;
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 5000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const { fetchImpl: _fetchImpl, timeoutMs: _timeoutMs, headers = {}, ...fetchOptions } = options;
    const requestOptions = {
      ...fetchOptions,
      signal: controller?.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', ...headers },
    };
    const redirectResult = await followMapsRedirects(fetchImpl, mapsUrl, requestOptions);
    const finalUrl = redirectResult.finalUrl || redirectResult.response?.url || mapsUrl;
    const urlCandidates = redirectResult.urls.join(' ');
    let coords = extractCoordinatesFromText(urlCandidates);
    let address = redirectResult.urls.map((url) => extractMapsAddress(url)).find(Boolean) || '';

    if ((!coords || !address) && !redirectResult.error && typeof redirectResult.response?.text === 'function') {
      try {
        const body = await redirectResult.response.text();
        coords = coords || extractCoordinatesFromText(body);
        address = address || extractMapsAddress(body) || extractMapsAddress(finalUrl);
      } catch {
        address = address || extractMapsAddress(finalUrl);
      }
    }

    return {
      finalUrl,
      latitude: coords?.[0] ?? null,
      longitude: coords?.[1] ?? null,
      address,
      canonicalMapsKey: buildMapsKey(mapsUrl),
    };
  } catch {
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
