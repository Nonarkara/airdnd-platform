// Lightweight geo utilities for the proximity finder — "near {area}, under ฿{x}".
// No API calls: a curated Bangkok-area gazetteer + haversine distance.

// Searchable areas. `keywords` are matched case-insensitively against free text
// (EN + Thai). Coordinates are the area centroid.
export const AREAS = [
  { id: 'sukhumvit', label: 'Sukhumvit', coords: [13.735, 100.566], keywords: ['sukhumvit', 'สุขุมวิท', 'asok', 'อโศก', 'nana', 'นานา', 'phrom phong', 'พร้อมพงษ์'] },
  { id: 'thonglor', label: 'Thonglor / Ekkamai', coords: [13.726, 100.578], keywords: ['thonglor', 'thong lo', 'ทองหล่อ', 'ekkamai', 'เอกมัย'] },
  { id: 'silom', label: 'Silom / Sathorn', coords: [13.724, 100.529], keywords: ['silom', 'สีลม', 'sathorn', 'sathon', 'สาทร', 'sala daeng', 'ศาลาแดง'] },
  { id: 'siam', label: 'Siam / Pratunam', coords: [13.745, 100.535], keywords: ['siam', 'สยาม', 'pratunam', 'ประตูน้ำ', 'ratchaprasong', 'ราชประสงค์', 'chidlom', 'ชิดลม', 'ploenchit', 'เพลินจิต'] },
  { id: 'ari', label: 'Ari / Saphan Khwai', coords: [13.783, 100.545], keywords: ['ari', 'อารีย์', 'saphan khwai', 'สะพานควาย', 'sanam pao', 'สนามเป้า'] },
  { id: 'ladprao', label: 'Lat Phrao', coords: [13.81, 100.594], keywords: ['ladprao', 'lat phrao', 'ลาดพร้าว', 'โชคชัย', 'chok chai'] },
  { id: 'ratchada', label: 'Ratchada / Huai Khwang', coords: [13.773, 100.574], keywords: ['ratchada', 'รัชดา', 'huai khwang', 'ห้วยขวาง', 'thailand cultural centre', 'ศูนย์วัฒนธรรม'] },
  { id: 'chatuchak', label: 'Chatuchak / Mo Chit', coords: [13.799, 100.553], keywords: ['chatuchak', 'จตุจักร', 'mo chit', 'หมอชิต', 'phahon', 'พหลโยธิน'] },
  { id: 'ramintra', label: 'Ram Inthra', coords: [13.852, 100.626], keywords: ['ramintra', 'ram inthra', 'รามอินทรา', 'nawamin', 'นวมินทร์'] },
  { id: 'onnut', label: 'On Nut / Udom Suk', coords: [13.7, 100.605], keywords: ['on nut', 'onnut', 'อ่อนนุช', 'udom suk', 'udomsuk', 'อุดมสุข', 'bang chak', 'บางจาก'] },
  { id: 'bangna', label: 'Bang Na / Samrong', coords: [13.666, 100.612], keywords: ['bang na', 'bangna', 'บางนา', 'samrong', 'สำโรง', 'bearing', 'แบริ่ง'] },
  { id: 'rama9', label: 'Rama 9 / Phatthakan', coords: [13.756, 100.565], keywords: ['rama 9', 'rama9', 'พระราม 9', 'พระราม9', 'phatthakan', 'พัฒนาการ'] },
  { id: 'bangkapi', label: 'Bang Kapi / The Mall', coords: [13.765, 100.643], keywords: ['bang kapi', 'bangkapi', 'บางกะปิ', 'the mall', 'ramkhamhaeng', 'รามคำแหง'] },
  { id: 'pinklao', label: 'Pinklao / Thonburi', coords: [13.771, 100.485], keywords: ['pinklao', 'pin klao', 'ปิ่นเกล้า', 'thonburi', 'ธนบุรี', 'wong wian yai', 'วงเวียนใหญ่'] },
  { id: 'nonthaburi', label: 'Nonthaburi / Pak Kret', coords: [13.9, 100.53], keywords: ['nonthaburi', 'นนทบุรี', 'pak kret', 'ปากเกร็ด', 'muang thong', 'เมืองทอง', 'แจ้งวัฒนะ', 'chaeng watthana'] },
  { id: 'rangsit', label: 'Rangsit / Pathum Thani', coords: [13.99, 100.617], keywords: ['rangsit', 'รังสิต', 'pathum thani', 'ปทุมธานี', 'ธรรมศาสตร์', 'thammasat'] },
];

const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in kilometres.
export function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Resolve free text to an area centroid. Returns { coords, label } or null.
export function resolveLocation(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return null;
  for (const area of AREAS) {
    if (area.keywords.some((k) => q.includes(k.toLowerCase()) || k.toLowerCase().includes(q))) {
      return { coords: area.coords, label: area.label };
    }
  }
  return null;
}

// Classify a listing to its best-matching area label (for supply-by-district),
// falling back to the city or "Other".
export function classifyArea(listing) {
  const hay = [listing?.location, listing?.name, listing?.city]
    .filter(Boolean).join(' ').toLowerCase();
  for (const area of AREAS) {
    if (area.keywords.some((k) => hay.includes(k.toLowerCase()))) return area.label;
  }
  return null;
}

export function listingCoords(listing) {
  const lat = Number.parseFloat(listing?.latitude);
  const lng = Number.parseFloat(listing?.longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  // The placement verdict (src/lib/place_resolver.js) decides what a stored
  // coordinate means. Without this, "nearest to you" ranked by points that were
  // fabricated — the same fourteen shops always "closest" to north Bangkok.
  const precision = listing?.geoPrecision;
  if (hasPoint && (precision === undefined || precision === 'exact')) {
    return { coords: [lat, lng], precision: 'exact', areaLabel: null };
  }
  if (hasPoint && (precision === 'tambon' || precision === 'district')) {
    const unit = listing.geoUnit || {};
    const areaLabel = [unit.tambon?.th, unit.district?.th].filter(Boolean).join(' · ') || null;
    return { coords: [lat, lng], precision: 'approximate', areaLabel };
  }
  const areaName = classifyArea(listing);
  if (areaName) {
    const areaObj = AREAS.find((a) => a.label === areaName);
    if (areaObj) {
      return { coords: areaObj.coords, precision: 'approximate', areaLabel: areaName };
    }
  }
  return null;
}

// Rank listings by distance from `origin`, applying an optional budget ceiling.
// Listings priced within budget rank first; "rate on request" listings are kept
// (flagged askRate) but ranked after priced matches at the same distance.
export function nearestListings(listings, origin, { maxBudget = null, limit = 12 } = {}) {
  if (!origin || !Array.isArray(listings)) return [];
  const scored = [];
  for (const listing of listings) {
    const coordInfo = listingCoords(listing);
    if (!coordInfo) continue;
    const distanceKm = haversineKm(origin, coordInfo.coords);
    const price = Number.isFinite(listing.priceValue) && listing.priceValue > 0 ? listing.priceValue : null;
    const askRate = price === null;
    if (maxBudget && price !== null && price > maxBudget) continue;
    scored.push({
      listing,
      distanceKm,
      price,
      askRate,
      precision: coordInfo.precision,
      areaLabel: coordInfo.areaLabel,
    });
  }
  // "Closest place I can get a massage" → rank purely by distance. The budget
  // ceiling has already removed priced listings that are too expensive; ask-rate
  // listings stay eligible (price unknown, not disqualifying).
  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  return scored.slice(0, limit);
}
