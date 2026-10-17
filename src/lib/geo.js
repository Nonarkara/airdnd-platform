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
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    return { coords: [lat, lng], precision: 'exact', areaLabel: null };
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

export const TRANSIT_STATIONS = [
  // BTS Sukhumvit Line
  { name: 'BTS Siam', line: 'BTS', coords: [13.7456, 100.5342] },
  { name: 'BTS Chit Lom', line: 'BTS', coords: [13.7441, 100.5431] },
  { name: 'BTS Ploen Chit', line: 'BTS', coords: [13.7431, 100.5491] },
  { name: 'BTS Nana', line: 'BTS', coords: [13.7401, 100.5555] },
  { name: 'BTS Asok', line: 'BTS', coords: [13.7367, 100.5604] },
  { name: 'BTS Phrom Phong', line: 'BTS', coords: [13.7303, 100.5698] },
  { name: 'BTS Thong Lo', line: 'BTS', coords: [13.7242, 100.5779] },
  { name: 'BTS Ekkamai', line: 'BTS', coords: [13.7196, 100.5852] },
  { name: 'BTS Phra Khanong', line: 'BTS', coords: [13.7153, 100.5915] },
  { name: 'BTS On Nut', line: 'BTS', coords: [13.7058, 100.6010] },
  { name: 'BTS Udom Suk', line: 'BTS', coords: [13.6802, 100.6099] },
  { name: 'BTS Bang Na', line: 'BTS', coords: [13.6682, 100.6048] },
  { name: 'BTS Ari', line: 'BTS', coords: [13.7797, 100.5447] },
  { name: 'BTS Saphan Khwai', line: 'BTS', coords: [13.7937, 100.5497] },
  { name: 'BTS Mo Chit', line: 'BTS', coords: [13.8024, 100.5538] },
  // BTS Silom Line
  { name: 'BTS Sala Daeng', line: 'BTS', coords: [13.7285, 100.5342] },
  { name: 'BTS Chong Nonsi', line: 'BTS', coords: [13.7237, 100.5298] },
  // MRT Blue Line
  { name: 'MRT Sukhumvit', line: 'MRT', coords: [13.7371, 100.5614] },
  { name: 'MRT Phetchaburi', line: 'MRT', coords: [13.7489, 100.5636] },
  { name: 'MRT Rama 9', line: 'MRT', coords: [13.7570, 100.5650] },
  { name: 'MRT Thailand Cultural Centre', line: 'MRT', coords: [13.7663, 100.5714] },
  { name: 'MRT Huai Khwang', line: 'MRT', coords: [13.7770, 100.5730] },
  { name: 'MRT Sutthisan', line: 'MRT', coords: [13.7890, 100.5740] },
  { name: 'MRT Lat Phrao', line: 'MRT', coords: [13.8062, 100.5724] },
  { name: 'MRT Silom', line: 'MRT', coords: [13.7292, 100.5372] },
  { name: 'MRT Sam Yan', line: 'MRT', coords: [13.7327, 100.5284] },
];

export function getNearestTransit(coords) {
  if (!coords || !Array.isArray(coords)) return null;
  let nearest = null;
  let minDist = Infinity;
  for (const st of TRANSIT_STATIONS) {
    const d = haversineKm(coords, st.coords);
    if (d < minDist) {
      minDist = d;
      nearest = st;
    }
  }
  if (nearest && minDist <= 3.5) {
    const distMeters = Math.round(minDist * 1000);
    const distLabel = distMeters < 1000 ? `${distMeters}m` : `${minDist.toFixed(1)}km`;
    return {
      station: nearest.name,
      line: nearest.line,
      distanceKm: minDist,
      distLabel,
      // No emoji — house style: typography-only hierarchy, zero decoration.
      // The line name (BTS/MRT/ARL) is the only typographic signal the eye needs.
      tag: `${nearest.line} ${distLabel} ${nearest.name}`
    };
  }
  return null;
}

// Rank listings by distance from `origin`, applying optional budget and vibe/mood filters.
export function nearestListings(listings, origin, { maxBudget = null, vibe = 'any', limit = 12 } = {}) {
  if (!origin || !Array.isArray(listings)) return [];
  const scored = [];
  for (const listing of listings) {
    const coordInfo = listingCoords(listing);
    if (!coordInfo) continue;
    const distanceKm = haversineKm(origin, coordInfo.coords);
    const price = Number.isFinite(listing.priceValue) && listing.priceValue > 0 ? listing.priceValue : null;
    const askRate = price === null;
    if (maxBudget && price !== null && price > maxBudget) continue;

    // Vibe / Mood filter
    if (vibe && vibe !== 'any') {
      const textBlob = `${listing.name} ${listing.description || ''} ${(listing.tags || []).join(' ')} ${(listing.serviceTags || []).join(' ')}`.toLowerCase();
      if (vibe === 'oil' && !/oil|อโรม่า|aroma|sensual|นวดน้ำมัน|ผ่อนคลาย|ผ่อนคลายสบาย|ฟิน/i.test(textBlob)) continue;
      if (vibe === 'thai' && !/thai|แผนไทย|นวดไทย|รีดเส้น|คลายเส้น|ดัด|จับเส้น/i.test(textBlob)) continue;
      if (vibe === 'vip' && !/vip|private|ส่วนตัว|พรีเมียม|premium|suite|หรู/i.test(textBlob)) continue;
      // "24" must be an actual 24-hour claim (24/7, 24 ชม, 24 hours): on its
      // own it matches house numbers ("24 Sukhumvit Soi 11") and phone digits.
      // "late" is word-bounded so it stops matching inside "chocolate".
      if (vibe === 'latenight' && !/24\s*\/\s*7|24\s*(?:ชม|ชั่วโมง|hrs?|hours?)|ดึก|รอบดึก|คืนนี้|ตี\d|\blate\b|open.*night/i.test(textBlob)) continue;
      if (vibe === 'now' && !/ว่าง|พร้อม|available|walk[ -]?in|คิวว่าง/i.test(textBlob)) continue;
    }

    const transit = getNearestTransit(coordInfo.coords);

    scored.push({
      listing,
      distanceKm,
      price,
      askRate,
      precision: coordInfo.precision,
      areaLabel: coordInfo.areaLabel,
      transit,
    });
  }

  // Rank by proximity
  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  return scored.slice(0, limit);
}
