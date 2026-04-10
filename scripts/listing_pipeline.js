import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.join(__dirname, '../public/data.json');

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

/**
 * Resolve lat/lng from a Google Maps short URL by following the redirect.
 * Returns [lat, lng] or null.
 */
async function resolveGoogleMapsCoordinates(mapsUrl) {
  if (!mapsUrl) return null;
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const response = await fetch(mapsUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const finalUrl = response.url || '';
    // Extract coordinates from patterns like @13.7563,100.5018 or !3d13.7563!4d100.5018
    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return [parseFloat(atMatch[1]), parseFloat(atMatch[2])];
    }
    const dMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (dMatch) {
      return [parseFloat(dMatch[1]), parseFloat(dMatch[2])];
    }
  } catch {
    // Timeout or network error — non-critical
  }
  return null;
}

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
    normalizeText(location, 'Bangkok, Thailand')
      .replace(/^#/, '')
      .replace(/^(?:พิกัด|พิกัดฐานทัพ|location|map|maps)\s*[:：]?\s*/i, '')
      .replace(/^แผนที่ร้านนวดใกล้ฉัน\s*/i, '')
      .replace(/\([^)]*\)/g, ' '),
  );

  if (!cleaned || cleaned === 'ร้าน') {
    return 'Bangkok, Thailand';
  }

  if (
    cleaned.length > 72 ||
    /เปิดบริการ|สวัสดี|line|โทร|#|บริการทุกวัน|\d{1,2}[:.]\d{2}/i.test(cleaned)
  ) {
    const inferredCity = inferCityFromText(cleaned);
    return inferredCity ? `${inferredCity}, Thailand` : 'Bangkok, Thailand';
  }

  return cleaned || 'Bangkok, Thailand';
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
  const inferredCity = inferCityFromText(location);
  if (inferredCity) {
    return inferredCity;
  }

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
      const sourceChannel = normalizeText(listing?.sourceChannel || options?.sourceChannel, null);
      const location = cleanLocationLabel(listing?.location);
      const name = resolveDisplayName(listing?.name, sourceChannel, location);
      if (!name) {
        return null;
      }

      if (name.startsWith('Massage Listing') && location === 'Bangkok, Thailand') {
        return null;
      }

      const priceLabel = sanitizePriceLabel(listing?.priceLabel || listing?.price);
      const rating = normalizeNumber(listing?.rating);
      const reviews = normalizeInteger(listing?.reviews);

      // BI enrichment fields
      const userRating = normalizeNumber(listing?.user_rating || listing?.userRating);
      const serviceTags = Array.isArray(listing?.service_quality || listing?.serviceTags)
        ? (listing.service_quality || listing.serviceTags).map((t) => String(t).trim()).filter(Boolean)
        : [];
      const userFeedbackSummary = normalizeText(listing?.user_feedback_summary || listing?.userFeedbackSummary, null);
      const allPhotoUrls = Array.isArray(listing?.allPhotoUrls) ? listing.allPhotoUrls.filter(Boolean) : [];

      return {
        id: listing?.id ?? `${source}-${Date.now()}-${index + 1}`,
        name,
        age: normalizeInteger(listing?.age),
        location,
        city: resolveCity(listing?.city, location),
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
        sourceChannel,
        sourceTarget: normalizeText(listing?.sourceTarget, null),
        phone: normalizeText(listing?.phone, null),
        hours: normalizeText(listing?.hours, null),
        lineUrl: normalizeText(listing?.lineUrl, null),
        telegramUrl: normalizeText(listing?.telegramUrl, null),
        mapsUrl: normalizeText(listing?.mapsUrl, null),
        dataSource: source,
        isFallback: source !== 'supabase',
        // BI enrichment fields
        rawText: normalizeText(listing?.rawText, null),
        sourceMessageIds: Array.isArray(listing?.sourceMessageIds) ? listing.sourceMessageIds : [],
        allPhotoUrls,
        userRating: userRating && userRating > 0 && userRating <= 5 ? userRating : null,
        serviceTags,
        userFeedbackSummary,
        isSafeImage: listing?.isSafeImage !== false,
      };
    })
    .filter(Boolean);

  // Second-pass sweeper: catch fields Gemini/deterministic parser missed
  const swept = normalized.map((listing) => {
    if (!listing.rawText) return listing;
    const t = listing.rawText;
    const updates = {};

    if (!listing.phone) {
      const m = t.match(/(?:\+?66|0)\d[\d -]{7,}/);
      if (m) updates.phone = m[0].trim();
    }
    if (!listing.hours) {
      const m = t.match(/(\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})/);
      if (m) updates.hours = m[1].trim();
    }
    if (!listing.priceLabel || listing.priceLabel === 'Rate on request') {
      const m = t.match(/(\d{3,5})\s*(?:บาท|฿|THB|baht)/i);
      if (m) {
        const val = Number.parseInt(m[1], 10);
        if (val >= 100 && val <= 20000) {
          updates.priceLabel = `${val} THB`;
          updates.priceValue = val;
        }
      }
    }
    if (!listing.lineUrl) {
      const urlMatch = t.match(/https?:\/\/line\.me\/\S+/i);
      if (urlMatch) updates.lineUrl = urlMatch[0];
    }
    if (!listing.mapsUrl) {
      const m = t.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com)\S+/i);
      if (m) updates.mapsUrl = m[0];
    }

    return Object.keys(updates).length > 0 ? { ...listing, ...updates } : listing;
  });

  return dedupeListings(swept);
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
  const normalizedListings = normalizeExtractedListings(Array.isArray(listings) ? listings : [], {
    source: 'snapshot',
  });

  if (normalizedListings.length === 0) {
    console.log('Skipping snapshot write because no valid listings were extracted.');
    return false;
  }

  // Strip bulky BI fields from snapshot to keep frontend payload slim
  const slimListings = normalizedListings.map(({ rawText, sourceMessageIds, allPhotoUrls, userFeedbackSummary, userRating, serviceTags, ...rest }) => rest);

  fs.writeFileSync(snapshotPath, JSON.stringify(slimListings, null, 2));
  console.log(`Saved ${slimListings.length} listing(s) to public/data.json`);
  return true;
}

export function classifyMessageType(text) {
  if (!text || text.length < 5) return 'unknown';
  if (/(?:คลิป|clip|vdo|video|โป้|โป๊|18\+|xxx|porn|nude|onlyfans|เสียว|หลุด|กลุ่มลับ|vip\s*group)/i.test(text)) return 'spam';
  if (/(?:ประกาศ|announcement|admin|rule|กฎ|กติกา|ข้อตกลง)/i.test(text)) return 'admin';
  if (/(?:รีวิว|review|ประสบการณ์|experience|ไปมา|เคยไป|recommend|แนะนำ|ดีมาก|แย่|สะอาด|clean|คุ้ม|worth|ประทับใจ|ไม่ประทับ)/i.test(text)) return 'feedback';
  if (/(?:ใครเคย|สอบถาม|เป็นยังไง|ที่ไหน|ราคาเท่าไหร่|มีใครรู้|แนะนำหน่อย|\?$)/i.test(text)) return 'discussion';
  if (/(?:ร้าน|shop|spa|สปา|นวด|massage|clinic|คลินิก|health|สุขภาพ|therap|ราคา|price|baht|บาท|฿|โทร|tel|phone|line\s*(?:id)?|จอง|booking)/i.test(text)) return 'listing';
  return 'unknown';
}

export async function archiveChannelMessages(supabase, messages, channelId, channelName, companionIdMap = new Map()) {
  if (!supabase || !Array.isArray(messages) || messages.length === 0) return 0;

  let archived = 0;
  const batch = [];

  for (const msg of messages) {
    const msgId = Number(msg.id);
    if (!msgId) continue;

    const text = msg.message || '';
    const messageType = classifyMessageType(text);

    batch.push({
      telegram_message_id: msgId,
      channel_id: String(channelId),
      channel_name: channelName || null,
      sender_id: msg.fromId ? String(msg.fromId.userId || msg.fromId.channelId || msg.fromId) : null,
      message_text: text || null,
      message_date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
      has_media: Boolean(msg.media),
      media_type: msg.media?.photo ? 'photo' : msg.media?.document ? 'document' : msg.media?.video ? 'video' : null,
      reply_to_message_id: msg.replyTo?.replyToMsgId || null,
      grouped_id: msg.groupedId ? String(msg.groupedId) : null,
      message_type: messageType,
      linked_companion_id: companionIdMap.get(msgId) || null,
    });
  }

  // Upsert in batches of 50
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    try {
      const { error } = await supabase
        .from('channel_messages')
        .upsert(chunk, { onConflict: 'channel_id,telegram_message_id', ignoreDuplicates: true });

      if (error && !error.message?.includes('column') && !error.message?.includes('channel_messages')) {
        console.warn(`Archive batch error: ${error.message}`);
      } else {
        archived += chunk.length;
      }
    } catch (err) {
      // Table might not exist yet — skip gracefully
      if (!err.message?.includes('channel_messages')) {
        console.warn(`Archive error: ${err.message}`);
      }
      break;
    }
  }

  return archived;
}

/**
 * Quality gate: reject listings that are too low quality to store.
 * Returns null if the listing passes, or a rejection reason string.
 */
function validateListingQuality(listing) {
  const name = normalizeText(listing?.name).toLowerCase();
  const desc = normalizeText(listing?.description).toLowerCase();
  const combined = `${name} ${desc}`;

  // Reject spam/noise that slipped through
  if (/group\s*joining|children'?s\s*only|new\s*group|เข้ากลุ่ม|กลุ่มลับ|vip\s*group/i.test(combined)) {
    return 'spam content';
  }
  if (/xxx|porn|18\+|โป้|โป๊|หลุด|เสียว|nude|onlyfans/i.test(combined)) {
    return 'adult spam';
  }

  // Reject generic/placeholder names
  if (/^listing\s*\d|^massage listing\s|^unknown$/i.test(name)) {
    return 'generic name';
  }

  // Reject names that are only digits or phone-number-like
  if (/^\d+$/.test(name) || /^\d[\d -]{7,}$/.test(name)) {
    return 'numeric-only name';
  }

  // Reject extremely short names (likely noise)
  if (name.length < 2) {
    return 'name too short';
  }

  // Reject if description is too short to be useful
  if (desc && desc.length > 0 && desc.length < 8 && desc !== 'details for this listing are still being collected.') {
    return 'description too short';
  }

  return null;
}

/**
 * Fuzzy name matching: check if a listing name is substantially similar to an existing one.
 * Catches cases like "ร้านกุหลาบ นวดเพื่อสุขภาพ" vs "กุหลาบ นวดเพื่อสุขภาพ"
 */
function normalizeNameForDedup(name) {
  return normalizeText(name)
    .toLowerCase()
    .replace(/^(ร้าน|🙏\s*#?|#)/g, '')  // strip common Thai prefixes
    .replace(/[^\p{L}\p{N}]/gu, '')       // strip all non-alphanumeric
    .trim();
}

export async function insertListingsIfPossible(supabase, listings) {
  if (!supabase || !Array.isArray(listings) || listings.length === 0) {
    return { inserted: 0, skipped: listings?.length || 0, rejected: 0, newListings: [] };
  }

  let inserted = 0;
  let skipped = 0;
  let rejected = 0;
  const newListings = [];

  for (const listing of listings) {
    // Quality gate
    const rejectReason = validateListingQuality(listing);
    if (rejectReason) {
      rejected += 1;
      console.log(`  Rejected "${listing.name}": ${rejectReason}`);
      continue;
    }

    try {
      const selectCols = 'id,name,location,image_url,metrics,phone,hours,line_url,telegram_url,maps_url,source_channel,city,mention_count,photo_urls,source_message_ids,user_rating,service_tags,discussion_notes,raw_text';

      // FIRST: Check phone match (same phone = same business, regardless of name)
      let phoneMatch = null;
      if (listing.phone) {
        const digits = listing.phone.replace(/[^\d]/g, '');
        if (digits.length >= 8) {
          const suffix = digits.slice(-8);
          const { data: phoneRows } = await supabase
            .from('companions')
            .select(selectCols)
            .like('phone', `%${suffix}%`)
            .limit(1);
          if (phoneRows?.length > 0) {
            phoneMatch = phoneRows[0];
          }
        }
      }

      // SECOND: Check for exact name+location match
      const { data: existingRows, error: lookupError } = phoneMatch ? { data: [], error: null } : await supabase
        .from('companions')
        .select(selectCols)
        .eq('name', listing.name)
        .eq('location', listing.location)
        .limit(1);

      // THIRD: Fuzzy name match (catches prefix/suffix variations)
      let fuzzyMatch = null;
      if ((!existingRows || existingRows.length === 0) && !lookupError) {
        const normalizedName = normalizeNameForDedup(listing.name);
        if (normalizedName.length >= 4) {
          const { data: allRows } = await supabase
            .from('companions')
            .select('id,name,location,image_url,metrics,phone,hours,line_url,telegram_url,maps_url,source_channel,city,mention_count,photo_urls,source_message_ids,user_rating,service_tags,discussion_notes,raw_text')
            .eq('location', listing.location)
            .limit(100);

          if (allRows) {
            fuzzyMatch = allRows.find((r) => {
              const existingNorm = normalizeNameForDedup(r.name);
              // Exact normalized match (catches prefix stripping like ร้าน)
              if (existingNorm === normalizedName) return true;
              // Substring match only for long names (10+ chars) to avoid false positives
              if (existingNorm.length >= 10 && normalizedName.length >= 10 &&
                  (existingNorm.includes(normalizedName) || normalizedName.includes(existingNorm))) return true;
              return false;
            });
          }
        }
      }

      const matchedRow = phoneMatch || ((existingRows && existingRows.length > 0) ? existingRows[0] : fuzzyMatch);

      if (lookupError) {
        throw lookupError;
      }

      if (matchedRow) {
        const existingRow = matchedRow;
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

        // Update contact/business info if we have new data the existing row lacks
        if (listing.phone && !existingRow.phone) updatePayload.phone = listing.phone;
        if (listing.hours && !existingRow.hours) updatePayload.hours = listing.hours;
        if (listing.lineUrl && !existingRow.line_url) updatePayload.line_url = listing.lineUrl;
        if (listing.telegramUrl && !existingRow.telegram_url) updatePayload.telegram_url = listing.telegramUrl;
        if (listing.mapsUrl && !existingRow.maps_url) updatePayload.maps_url = listing.mapsUrl;
        if (listing.sourceChannel && !existingRow.source_channel) updatePayload.source_channel = listing.sourceChannel;
        if (listing.city && !existingRow.city) updatePayload.city = listing.city;
        updatePayload.updated_at = new Date().toISOString();
        updatePayload.mention_count = (existingRow.mention_count || 1) + 1;

        // BI enrichment: merge photo arrays, append feedback, preserve ratings
        if (listing.allPhotoUrls?.length) {
          const existingPhotos = Array.isArray(existingRow.photo_urls) ? existingRow.photo_urls : [];
          const merged = [...new Set([...existingPhotos, ...listing.allPhotoUrls])];
          if (merged.length > existingPhotos.length) updatePayload.photo_urls = merged;
        }
        if (listing.sourceMessageIds?.length) {
          const existingIds = Array.isArray(existingRow.source_message_ids) ? existingRow.source_message_ids : [];
          const merged = [...new Set([...existingIds, ...listing.sourceMessageIds])];
          if (merged.length > existingIds.length) updatePayload.source_message_ids = merged;
        }
        if (listing.userRating && !existingRow.user_rating) {
          updatePayload.user_rating = listing.userRating;
        }
        if (listing.serviceTags?.length) {
          const existingTags = Array.isArray(existingRow.service_tags) ? existingRow.service_tags : [];
          const merged = [...new Set([...existingTags, ...listing.serviceTags])];
          if (merged.length > existingTags.length) updatePayload.service_tags = merged;
        }
        if (listing.userFeedbackSummary) {
          const existing = existingRow.discussion_notes || '';
          if (!existing.includes(listing.userFeedbackSummary)) {
            updatePayload.discussion_notes = existing
              ? `${existing}\n---\n${listing.userFeedbackSummary}`
              : listing.userFeedbackSummary;
          }
        }
        if (listing.rawText && !existingRow.raw_text) {
          updatePayload.raw_text = listing.rawText;
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabase
            .from('companions')
            .update(updatePayload)
            .eq('id', existingRow.id);

          if (updateError && !updateError.message?.includes('column')) {
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

      // Add all available business data columns
      if (listing.postedAt) row.posted_at = listing.postedAt;
      if (listing.sourceChannel) row.source_channel = listing.sourceChannel;
      if (listing.phone) row.phone = listing.phone;
      if (listing.hours) row.hours = listing.hours;
      if (listing.lineUrl) row.line_url = listing.lineUrl;
      if (listing.telegramUrl) row.telegram_url = listing.telegramUrl;
      if (listing.mapsUrl) row.maps_url = listing.mapsUrl;
      if (listing.city) row.city = listing.city;
      row.updated_at = new Date().toISOString();

      // BI enrichment columns
      if (listing.rawText) row.raw_text = listing.rawText;
      if (listing.sourceMessageIds?.length) row.source_message_ids = listing.sourceMessageIds;
      if (listing.allPhotoUrls?.length) row.photo_urls = listing.allPhotoUrls;
      if (listing.userRating) row.user_rating = listing.userRating;
      if (listing.serviceTags?.length) row.service_tags = listing.serviceTags;
      if (listing.userFeedbackSummary) row.discussion_notes = listing.userFeedbackSummary;
      if (listing.isSafeImage === false) row.is_safe_image = false;

      // Geocoding: resolve coordinates from Google Maps URL
      if (listing.mapsUrl && !row.latitude) {
        const coords = await resolveGoogleMapsCoordinates(listing.mapsUrl);
        if (coords) {
          row.latitude = coords[0];
          row.longitude = coords[1];
        }
      }

      let { error } = await supabase.from('companions').insert([row]);

      // If new columns don't exist yet, retry with only base columns
      if (error && error.message?.includes('column')) {
        const baseRow = {
          name: row.name, age: row.age, location: row.location, price: row.price,
          description: row.description, image_url: row.image_url, rating: row.rating,
          reviews: row.reviews, tags: row.tags, metrics: row.metrics,
        };
        ({ error } = await supabase.from('companions').insert([baseRow]));
      }

      if (error) {
        throw error;
      }

      inserted += 1;
      newListings.push(listing);
    } catch (error) {
      skipped += 1;
      console.error(`Failed to insert ${listing.name}:`, error.message);
    }
  }

  return { inserted, skipped, rejected, newListings };
}
