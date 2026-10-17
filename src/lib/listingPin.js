// Listing pin state — pure helpers used by ListingPin.jsx and any future
// surface that needs the same freshness / size classification.
//
// One source of truth so the map, gallery, and any card-level preview all
// agree on what "fresh" and "stale" mean. The thresholds were tuned against
// the scraper's 30-min polling cadence (matches Telegram's typical broadcast
// rhythm — most posts age out of "fresh" between cycles).

export const PIN_STATES = ['fresh', 'active', 'recent', 'stale'];

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

export function getPinState(listing, nowMs) {
  const postedMs = parsePostedAt(listing);
  if (!Number.isFinite(postedMs)) return 'stale';
  const ageMs = Math.max(0, nowMs - postedMs);
  if (ageMs < 30 * MIN_MS) return 'fresh';
  if (ageMs < 4 * HOUR_MS) return 'active';
  if (ageMs < 24 * HOUR_MS) return 'recent';
  return 'stale';
}

export function getPinSize(listing) {
  const mentions = Number(listing?.mentionCount ?? listing?.mention_count ?? 0);
  if (mentions > 10) return 22;
  if (mentions > 3) return 16;
  // Stale pins collapse to 8px regardless of mention count — visual weight
  // falls with freshness, matching the brutalist discipline that lets older
  // data sink into the map rather than dominate it.
  return 10;
}

export function getPinSizeForState(size, state) {
  if (state === 'stale') return Math.min(size, 10);
  return size;
}

export function getPinClassName(listing, availability, nowMs) {
  const state = getPinState(listing, nowMs);
  const aura = getAuraClass(listing);
  const availabilityClass = availability?.state
    ? `availability-${availability.state}`
    : 'availability-unknown';
  const precisionClass = listing?.precision === 'area' ? 'is-area-level' : '';
  return [
    'listing-pin',
    aura,
    availabilityClass,
    `listing-pin--${state}`,
    precisionClass,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Composite aura classification. Combines data richness (description,
 * contact channels, price, image) with activity (mention count) so a
 * complete-but-quiet listing still rises above a noisy stub. Returns one
 * of `aura-level-1` / `aura-level-2` / `aura-level-3`.
 */
export function getAuraClass(listing) {
  const mentions = Number(listing?.mentionCount ?? listing?.mention_count ?? 0);
  const description = String(listing?.description || '');
  const hasRichDescription =
    description.length > 20 && description !== 'Details for this listing are still being collected.';
  const hasContact = Boolean(
    listing?.phone || listing?.lineUrl || listing?.telegramUrl || listing?.mapsUrl
  );
  const hasPrice =
    Boolean(listing?.priceLabel) && listing.priceLabel !== 'Rate on request';
  const hasImage =
    Boolean(listing?.imageUrl) && !String(listing.imageUrl).startsWith('/mockups/');
  const dataScore =
    (hasRichDescription ? 1 : 0) +
    (hasContact ? 1 : 0) +
    (hasPrice ? 1 : 0) +
    (hasImage ? 1 : 0);
  const activityBonus = mentions > 10 ? 2 : mentions > 3 ? 1 : 0;
  const total = dataScore + activityBonus;
  if (total >= 4) return 'aura-level-3';
  if (total >= 2) return 'aura-level-2';
  return 'aura-level-1';
}

function parsePostedAt(listing) {
  const raw = listing?.postedAt ?? listing?.posted_at ?? listing?.updatedAt ?? listing?.createdAt;
  if (!raw) return NaN;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
}
