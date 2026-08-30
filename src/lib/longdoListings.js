import { buildPhoneKey } from './listing_contract.js';

const LONGDO_LICENSE = 'CC BY-SA 4.0';
const ALL_LOCATIONS = 'all-locations';
const ALL_TAGS = 'all-tags';

export function poiToListing(poi) {
  const longdoId = poi.longdoId || String(poi.id || '').replace(/^longdo-/, '');
  const name = poi.name || poi.nameEn || poi.nameTh || 'Longdo POI';
  const location = poi.addressEn || poi.addressTh || poi.location || '';
  const nameTh = poi.nameTh || null;
  return {
    id: poi.id || `longdo-${longdoId}`,
    longdoId,
    name,
    nameTh,
    nameEn: poi.nameEn || null,
    location,
    addressTh: poi.addressTh || null,
    addressEn: poi.addressEn || null,
    city: poi.city || 'Thailand',
    latitude: Number(poi.latitude),
    longitude: Number(poi.longitude),
    phone: poi.phone || null,
    website: poi.website || null,
    mapsUrl: `https://map.longdo.com/p/${longdoId}`,
    source: 'longdo',
    dataSource: 'longdo',
    sourceChannel: 'Longdo Map',
    tags: ['Longdo POI'],
    serviceTags: [],
    description: [nameTh && nameTh !== name ? nameTh : null, location]
      .filter(Boolean)
      .join(' · '),
    isSafeImage: true,
    mentionCount: 0,
    aliasNames: nameTh && nameTh !== name ? [nameTh] : [],
    license: LONGDO_LICENSE,
    poiType: poi.poiType || 'spa',
    fromOfficialList: Boolean(poi.fromOfficialList),
    updatedAt: poi.lastupdate || poi.generatedAt || null,
    priceLabel: '—',
    hours: null,
  };
}

function nameKeys(row) {
  const city = String(row.city || '').trim().toLowerCase();
  const names = [row.name, row.nameTh, row.nameEn, ...(row.aliasNames || [])]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => value.length > 1);
  return names.map((name) => `${name}|${city}`);
}

export function mergeDirectory(telegramListings, longdoListings) {
  const telegram = Array.isArray(telegramListings) ? telegramListings : [];
  const longdo = Array.isArray(longdoListings) ? longdoListings : [];
  const phones = new Set(telegram.map((row) => buildPhoneKey(row.phone)).filter(Boolean));
  const names = new Set(telegram.flatMap(nameKeys).filter((key) => key.length > 3));

  const extra = [];
  for (const row of longdo) {
    const phone = buildPhoneKey(row.phone);
    if (phone && phones.has(phone)) continue;
    if (nameKeys(row).some((key) => names.has(key))) continue;
    extra.push(row);
  }
  return telegram.concat(extra);
}

export function listingMatchesFilters(listing, {
  location = ALL_LOCATIONS,
  activity = ALL_TAGS,
  search = '',
  priceTier = 'all',
  openStatus = 'all',
} = {}) {
  if (location !== ALL_LOCATIONS && listing.city !== location) return false;

  const tags = Array.isArray(listing.tags) ? listing.tags : [];
  if (activity !== ALL_TAGS && !tags.includes(activity)) return false;

  const query = String(search || '').trim().toLowerCase();
  if (query) {
    const haystack = [
      listing.name,
      listing.nameTh,
      listing.nameEn,
      listing.location,
      listing.description,
      listing.phone,
      listing.hours,
      listing.sourceChannel,
      listing.addressEn,
      listing.addressTh,
      listing.city,
      listing.website,
      ...tags,
      ...(Array.isArray(listing.serviceTags) ? listing.serviceTags : []),
      ...(Array.isArray(listing.aliasNames) ? listing.aliasNames : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (priceTier !== 'all') {
    const price = listing.priceValue;
    if (priceTier === 'economy' && !(Number.isFinite(price) && price > 0 && price < 1000)) return false;
    if (priceTier === 'mid' && !(Number.isFinite(price) && price >= 1000 && price <= 2000)) return false;
    if (priceTier === 'premium' && !(Number.isFinite(price) && price > 2000)) return false;
  }

  if (openStatus !== 'all') {
    const hours = listing.hours || '';
    if (openStatus === '247' && !/24\s*ชั่วโมง|24\s*hrs|24\s*hours/i.test(hours)) return false;
    if (openStatus === 'open' && !(listing.isOpenNow || /24|เปิด|open/i.test(hours))) return false;
  }

  return true;
}

export async function fetchLongdoPois() {
  const response = await fetch('/data/longdo_pois.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Longdo snapshot ${response.status}`);
  const payload = await response.json();
  const pois = Array.isArray(payload?.pois) ? payload.pois : [];
  return {
    meta: payload?.meta || null,
    pois,
    listings: pois.map(poiToListing),
  };
}

