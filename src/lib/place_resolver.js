/**
 * Where is this listing, and how sure are we?
 *
 * A pin is a promise. Someone looking for a service near them will walk, ride
 * or drive to it. A pin 60 km from the shop is worse than no pin: it sends a
 * real person to the wrong place and makes the whole directory untrustworthy.
 *
 * The audit that produced this module (tasks/supabase-exit.md) found stored
 * coordinates that were not approximations but fabrications: fourteen different
 * businesses, with fourteen different Google Maps links, all resolved to one
 * point in north Bangkok; a shop beside Phra Pathom Chedi pinned in Bang Khen;
 * nine shops in Min Buri sitting on a point near the Pathum Thani centroid.
 * The Maps resolver had been reading coordinates out of page chrome.
 *
 * So the rule here is the one the OTOP registry already lives by: an unplaced
 * record is honest, a mis-placed one is a lie on a map. Every listing gets:
 *
 *   geoPrecision  exact | tambon | district | province | none
 *   geoRadiusKm   how far the true location may be from the pin
 *   geoSource     where the coordinate came from
 *   geoUnit       the administrative unit the listing's own address names
 *   geoNote       why a stored coordinate was rejected, when it was
 *
 * The listing's own words are the ground truth we can check against. A stored
 * coordinate survives only if it is consistent with the district the address
 * names, and is not part of a cluster the data itself proves is fabricated.
 *
 * Pure module: runs in the browser and in Node. It takes the admin index built
 * by scripts/lib/geo_index.js as an argument rather than importing it.
 */

// ── normalisation ───────────────────────────────────────────────────────────

// Tone marks, thanthakhat, mai taikhu and paiyannoi. Listings drop and misplace
// these constantly ("บางใหญ" for บางใหญ่); matching without them is safe
// because no two administrative names differ only by tone mark.
const THAI_MARKS = /[\u0E47-\u0E4C\u0E2F]/g;
const INVISIBLES = /[\u200B-\u200D\uFEFF\u00A0]/g;

export function thKey(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(INVISIBLES, ' ')
    .replace(THAI_MARKS, '')
    .replace(/\s+/g, '');
}

export function enKey(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ue/g, 'u') // Bueng / Bung, Mueang / Muang: both romanisations circulate
    .replace(/[^a-z]/g, '');
}

// Keep single spaces (they carry the context the road guard needs), strip marks.
function prepareText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(INVISIBLES, ' ')
    .replace(THAI_MARKS, '')
    .replace(/(?:ตัว)?เมือง\s+/g, 'เมือง') // "เมือง ชลบุรี", "ตัวเมืองนครปฐม" → เมืองชลบุรี
    .replace(/\s+/g, ' ')
    .trim();
}

const BANGKOK_ALIASES = ['กรุงเทพ', 'กทม', 'krungthep', 'bkk'];

// ── index ───────────────────────────────────────────────────────────────────

const DEG_KM = 111.32;

function radiusFromArea(areaKm2) {
  return areaKm2 ? Math.sqrt(areaKm2 / Math.PI) : null;
}

/** Turn the positional index into lookup structures. Build once, reuse. */
export function prepareAdminIndex(raw) {
  const provinces = new Map();
  const districts = new Map();
  const districtsByProvince = new Map();
  const tambonsByDistrict = new Map();
  const tambonsByProvince = new Map();

  for (const [code, th, en, lat, lng, bbox, area] of raw.provinces) {
    provinces.set(code, { level: 'province', code, th, en, lat, lng, bbox, radiusKm: radiusFromArea(area), thK: thKey(th), enK: enKey(en) });
  }
  for (const [code, pcode, th, en, lat, lng, bbox, area, tambonCount] of raw.districts) {
    const d = {
      level: 'district', code, provinceCode: pcode, th, en, lat, lng, bbox,
      radiusKm: radiusFromArea(area),
      tambonRadiusKm: area && tambonCount ? radiusFromArea(area / tambonCount) : null,
      thK: thKey(th), enK: enKey(en),
    };
    districts.set(code, d);
    if (!districtsByProvince.has(pcode)) districtsByProvince.set(pcode, []);
    districtsByProvince.get(pcode).push(d);
  }
  for (const [code, dcode, th, en, lat, lng, postal] of raw.tambons) {
    const district = districts.get(dcode);
    if (!district) continue;
    const t = { level: 'tambon', code, districtCode: dcode, provinceCode: district.provinceCode, th, en, lat, lng, postal, thK: thKey(th), enK: enKey(en) };
    if (!tambonsByDistrict.has(dcode)) tambonsByDistrict.set(dcode, []);
    tambonsByDistrict.get(dcode).push(t);
    if (!tambonsByProvince.has(t.provinceCode)) tambonsByProvince.set(t.provinceCode, []);
    tambonsByProvince.get(t.provinceCode).push(t);
  }

  // District names that exist in exactly one province nationwide: safe to use
  // without a province in the text ("คลองหลวง" can only be Pathum Thani).
  const districtNameCount = new Map();
  for (const d of districts.values()) districtNameCount.set(d.thK, (districtNameCount.get(d.thK) || 0) + 1);
  const uniqueDistricts = [...districts.values()].filter((d) => d.thK.length >= 4 && districtNameCount.get(d.thK) === 1);

  return { provinces, districts, districtsByProvince, tambonsByDistrict, tambonsByProvince, uniqueDistricts, tambonScope: raw.tambonScope };
}

// ── address parsing ─────────────────────────────────────────────────────────

/** Rightmost occurrence wins: addresses run small-to-large, so the province is
 *  written last. "Rangsit-Nakhon Nayok 34/1, Pathum Thani" names a road, then
 *  the province — longest-match would pick the road. */
function findProvince(text, index) {
  const th = thKey(text);
  const en = enKey(text);
  let best = null;
  const consider = (province, end, len) => {
    if (!best || end > best.end || (end === best.end && len > best.len)) best = { province, end, len };
  };
  for (const p of index.provinces.values()) {
    const ti = th.lastIndexOf(p.thK);
    if (ti >= 0) consider(p, (ti + p.thK.length) / th.length, p.thK.length);
    // Posters drop a trailing vowel ("พิกัดสระบุร", "ปทุมธาน"). Accept the
    // truncated name only where nothing Thai follows it.
    if (ti < 0 && p.thK.length >= 6 && /[\u0E31\u0E34-\u0E3A]$/.test(p.thK)) {
      const cut = p.thK.slice(0, -1);
      const ci = th.lastIndexOf(cut);
      if (ci >= 0 && !/[\u0E00-\u0E7F]/.test(th[ci + cut.length] || '')) consider(p, (ci + cut.length) / th.length, cut.length);
    }
    if (p.enK.length >= 4) {
      const ei = en.lastIndexOf(p.enK);
      if (ei >= 0) consider(p, (ei + p.enK.length) / en.length, p.enK.length);
    }
  }
  const bangkok = index.provinces.get('10');
  for (const alias of BANGKOK_ALIASES) {
    const hay = /^[a-z]+$/.test(alias) ? en : th;
    const key = /^[a-z]+$/.test(alias) ? alias : thKey(alias);
    const i = hay.lastIndexOf(key);
    if (i >= 0 && bangkok) consider(bangkok, (i + key.length) / hay.length, key.length);
  }
  return best?.province || null;
}

const DISTRICT_MARKER = /(?:เขต|อำเภอ|อ\.)\s*([\u0E00-\u0E7F]+)/g;
const TAMBON_MARKER = /(?:แขวง|ตำบล|ต\.)\s*([\u0E00-\u0E7F]+)/g;

function markedNames(text, pattern) {
  const out = [];
  for (const m of text.matchAll(pattern)) out.push(thKey(m[1]));
  return out;
}

/** A captured word may run on ("คลองสามวากรุงเทพมหานคร"); take the longest
 *  candidate name it begins with. */
function matchMarked(captures, candidates) {
  let best = null;
  for (const cap of captures) {
    for (const c of candidates) {
      if (cap.startsWith(c.thK) && (!best || c.thK.length > best.thK.length)) best = c;
    }
  }
  return best;
}

/** Bare Thai names — no แขวง/เขต marker. Many district names are also road
 *  names: ลาดพร้าว 71 is a soi in Wang Thonglang, not Lat Phrao district;
 *  รามอินทรา, พระราม 2, บางนา and ลาดกระบัง all run across several districts.
 *  A bare name counts only when it is not being used as a road: not after
 *  ถ./ถนน/ซ./ซอย/แยก, and not followed by a soi number. A 5-digit postal code
 *  after the name is fine. */
function matchBare(text, candidates, { exclude = null } = {}) {
  let best = null;
  for (const c of candidates) {
    if (c.thK.length < 4) continue;
    // Mueang districts often contain a subdistrict carrying the province's own
    // name; "นครปฐม" in an address means the province, never that subdistrict.
    if (exclude && c.thK === exclude) continue;
    let from = 0;
    while (true) {
      const i = text.indexOf(c.thK, from);
      if (i < 0) break;
      from = i + 1;
      const before = text.slice(Math.max(0, i - 5), i).replace(/\s+/g, '');
      const after = text.slice(i + c.thK.length);
      if (/(?:ถ\.|ถนน|ซ\.|ซอย|แยก)$/.test(before)) continue;
      if (/^\s?\d{1,3}(?!\d)/.test(after) || /^\s?\d+\//.test(after)) continue;
      if (!best || c.thK.length > best.thK.length) best = c;
      break;
    }
  }
  return best;
}

function matchEnglish(text, candidates, { exclude = null } = {}) {
  const hay = enKey(text);
  let best = null;
  for (const c of candidates) {
    if (c.enK.length < 5) continue;
    if (exclude && c.enK === exclude) continue;
    if (hay.includes(c.enK) && (!best || c.enK.length > best.enK.length)) best = c;
  }
  return best;
}

function postalCodes(text) {
  return [...String(text).matchAll(/(?<!\d)([1-9]\d{4})(?!\d)/g)].map((m) => m[1]);
}

/** Among same-named subdistricts (Bangkok has two บางจาก), a postal code in the
 *  address settles which one is meant; without one, refuse to choose. */
function disambiguate(matches, postals) {
  if (matches.length <= 1) return matches[0] || null;
  const byPostal = matches.filter((t) => t.postal && postals.includes(t.postal));
  return byPostal.length === 1 ? byPostal[0] : null;
}

function tambonsNamed(pool, key) {
  return pool.filter((t) => t.thK === key || (key && key.startsWith(t.thK) && t.thK.length >= 4));
}

/**
 * Resolve free-text address to the most specific administrative unit it names.
 * Returns null when the text names nothing we can place.
 *
 * @param {string} text   the listing's location text (and anything else useful)
 * @param {object} index  prepareAdminIndex() output
 * @param {object} [opts]
 * @param {string} [opts.cityHint] weak hint (e.g. the pipeline's `city` field,
 *   which defaults to "Bangkok" and is often wrong) — used only when the text
 *   itself names no province.
 */
export function resolvePlace(text, index, { cityHint = '' } = {}) {
  const t = prepareText(text);
  if (!t) return null;
  const postals = postalCodes(t);
  const compact = thKey(t);

  let province = findProvince(t, index);
  const provinceFromText = Boolean(province);
  if (!province && cityHint) province = findProvince(cityHint, index);

  const districtCaptures = markedNames(t, DISTRICT_MARKER);
  const tambonCaptures = markedNames(t, TAMBON_MARKER);

  let district = null;
  let matchedBy = null;
  if (province) {
    const pool = index.districtsByProvince.get(province.code) || [];
    district = matchMarked(districtCaptures, pool);
    matchedBy = district ? 'marked' : null;
    if (!district) { district = matchEnglish(t, pool); matchedBy = district ? 'english' : null; }
    if (!district) { district = matchBare(t, pool); matchedBy = district ? 'bare' : null; }
  }
  if (!district) {
    // Nationwide-unique district names need no province to be certain.
    const d = matchMarked(districtCaptures, index.uniqueDistricts) || matchBare(t, index.uniqueDistricts);
    if (d && (!provinceFromText || d.provinceCode === province?.code)) {
      district = d;
      matchedBy = 'unique-name';
      province = index.provinces.get(d.provinceCode) || province;
    }
  }

  let tambon = null;
  if (district) {
    const pool = index.tambonsByDistrict.get(district.code) || [];
    for (const cap of tambonCaptures) {
      tambon = disambiguate(tambonsNamed(pool, cap), postals);
      if (tambon) break;
    }
    // Most districts contain a subdistrict of the same name, so "Saphansong,
    // Wang Thonglang" names both. Try every other subdistrict first; fall back
    // to the namesake only when nothing else is named.
    if (!tambon) tambon = matchEnglish(t, pool, { exclude: district.enK }) || null;
    if (!tambon) tambon = matchBare(t, pool, { exclude: province?.thK });
  } else if (province) {
    // A marked subdistrict can imply its district when the name is unique in
    // the province ("แขวงลาดพร้าว" → Lat Phrao district).
    const pool = index.tambonsByProvince.get(province.code) || [];
    for (const cap of tambonCaptures) {
      tambon = disambiguate(tambonsNamed(pool, cap), postals);
      if (tambon) break;
    }
    if (!tambon && provinceFromText) {
      const bare = matchBare(t, pool, { exclude: province.thK });
      if (bare && pool.filter((x) => x.thK === bare.thK).length === 1) tambon = bare;
    }
    if (tambon) {
      district = index.districts.get(tambon.districtCode);
      matchedBy = 'via-tambon';
    }
  }

  if (tambon && district) {
    return {
      level: 'tambon', lat: tambon.lat, lng: tambon.lng,
      radiusKm: district.tambonRadiusKm ?? 2,
      province, district, tambon, matchedBy, postals,
    };
  }
  if (district) {
    return { level: 'district', lat: district.lat, lng: district.lng, radiusKm: district.radiusKm, province, district, tambon: null, matchedBy, postals };
  }
  if (province) {
    return { level: 'province', lat: province.lat, lng: province.lng, radiusKm: province.radiusKm, province, district: null, tambon: null, matchedBy: provinceFromText ? 'text' : 'city-hint', postals };
  }
  return compact ? null : null;
}

// ── coordinates ─────────────────────────────────────────────────────────────

function inBox([lat, lng], bbox, marginKm) {
  if (!bbox) return true;
  const m = marginKm / DEG_KM;
  return lat >= bbox[0] - m && lat <= bbox[2] + m && lng >= bbox[1] - m && lng <= bbox[3] + m;
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Is a coordinate consistent with the unit the address names?
 *  'consistent' | 'contradicted' | 'unverifiable' */
export function assessPoint(point, place) {
  if (!place || place.matchedBy === 'city-hint') return 'unverifiable';
  if (place.district) return inBox(point, place.district.bbox, 1.5) ? 'consistent' : 'contradicted';
  if (place.province) return inBox(point, place.province.bbox, 3) ? 'consistent' : 'contradicted';
  return 'unverifiable';
}

/** Coordinates written into the link itself — the one source that cannot be
 *  page chrome, because the person who shared the link put them there. */
export function coordinatesInMapsLink(url) {
  const s = decodeURIComponent(String(url || '')).replace(/%2C/gi, ',');
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|ll|query|destination)=(-?\d+\.\d{3,}),\s*(-?\d+\.\d{3,})/,
    /@(-?\d+\.\d{3,}),(-?\d+\.\d{3,})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (lat > 5 && lat < 21 && lng > 97 && lng < 106) return [lat, lng];
    }
  }
  return null;
}

// Google's static place-page HTML embeds this default in every page. Any value
// read from it is page chrome, never a place.
const KNOWN_FIXTURES = [[13.95218835, 100.564992]];

function isFallbackConstant(point, index) {
  if (KNOWN_FIXTURES.some((f) => Math.abs(f[0] - point[0]) < 0.0006 && Math.abs(f[1] - point[1]) < 0.0006)) {
    return 'google-page-default';
  }
  for (const p of index.provinces.values()) {
    if (Math.abs(p.lat - point[0]) < 0.0006 && Math.abs(p.lng - point[1]) < 0.0006) return `centroid-of-${p.en}`;
  }
  return null;
}

/** Single-linkage clusters of stored points within ~0.9 km. */
function clusterPoints(items, thresholdDeg = 0.008) {
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const [a, b] = [items[i].point, items[j].point];
      if (Math.abs(a[0] - b[0]) <= thresholdDeg && Math.abs(a[1] - b[1]) <= thresholdDeg) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  });
  return [...groups.values()];
}

function canonicalLink(url) {
  return String(url || '').trim().replace(/[?#].*$/, '').replace(/…$/, '');
}

/**
 * Place a whole set of listings. Needs the set, not one listing at a time,
 * because fabrication is only visible in aggregate: a cluster is declared
 * fabricated when at least three distinct Maps links resolve into it and at
 * least two of its members' own addresses put them somewhere else. That is
 * the data proving the resolver wrong — not a guess about what looks dense.
 *
 * @param {Array<object>} listings  need location/city/mapsUrl/latitude/longitude
 * @returns {Map<any, object>} keyed by listing.id → geo fields
 */
// scripts/listing_pipeline.js writes this when it knows nothing about the
// location, and scripts/enrich_coordinates.js then turned it into the city-centre
// coordinate. It is a placeholder, not something the poster said.
const PIPELINE_DEFAULT_LOCATION = /^\s*bangkok,\s*thailand\s*$/i;

const PRECISION_RANK = { tambon: 3, district: 2, province: 1 };

/** Resolve from the location text, then from the listing name, which often
 *  carries the branch ("… สาขาลาดปลาดุก", "… พิกัด ศาลายา นครปฐม"). Keep
 *  whichever names the more specific unit; the city field is only a last hint. */
export function resolveListingPlace(listing, index) {
  const location = [listing.location, listing.address].filter(Boolean).join(' ');
  const said = PIPELINE_DEFAULT_LOCATION.test(location) ? '' : location;
  const fromLocation = said ? resolvePlace(said, index) : null;
  const fromName = listing.name ? resolvePlace(listing.name, index) : null;
  const rank = (p) => (p ? PRECISION_RANK[p.level] || 0 : 0);
  let place = rank(fromName) > rank(fromLocation) ? fromName : fromLocation;
  if (!place && listing.city) {
    place = resolvePlace(listing.city, index);
    if (place) place = { ...place, matchedBy: 'city-hint' };
  }
  return place;
}

export function placeListings(listings, index) {
  const rows = listings.map((listing) => {
    const place = resolveListingPlace(listing, index);
    const lat = Number.parseFloat(listing.latitude);
    const lng = Number.parseFloat(listing.longitude);
    const point = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    const mapsUrl = listing.mapsUrl || listing.maps_url || '';
    return {
      listing, place, point, mapsUrl,
      linkPoint: coordinatesInMapsLink(mapsUrl),
      verdict: point ? assessPoint(point, place) : null,
      fallback: point ? isFallbackConstant(point, index) : null,
    };
  });

  const fabricated = new Set();
  for (const group of clusterPoints(rows.filter((r) => r.point && !r.linkPoint))) {
    const links = new Set(group.map((r) => canonicalLink(r.mapsUrl)).filter(Boolean));
    const contradicted = group.filter((r) => r.verdict === 'contradicted').length;
    if (group.length >= 3 && links.size >= 3 && contradicted >= 2) group.forEach((r) => fabricated.add(r));
  }

  const out = new Map();
  for (const r of rows) {
    const { place } = r;
    const unit = place ? {
      province: place.province ? { code: place.province.code, th: place.province.th, en: place.province.en } : null,
      district: place.district ? { code: place.district.code, th: place.district.th, en: place.district.en } : null,
      tambon: place.tambon ? { code: place.tambon.code, th: place.tambon.th, en: place.tambon.en } : null,
    } : null;
    const fromUnit = (source, note) => (place
      ? { latitude: place.lat, longitude: place.lng, geoPrecision: place.level, geoRadiusKm: round2(place.radiusKm), geoSource: source, geoUnit: unit, geoNote: note }
      : { latitude: null, longitude: null, geoPrecision: 'none', geoRadiusKm: null, geoSource: null, geoUnit: null, geoNote: note });

    let result;
    if (r.linkPoint && assessPoint(r.linkPoint, place) !== 'contradicted') {
      result = { latitude: r.linkPoint[0], longitude: r.linkPoint[1], geoPrecision: 'exact', geoRadiusKm: 0.05, geoSource: 'maps-link', geoUnit: unit, geoNote: null };
    } else if (!r.point) {
      result = fromUnit('address', null);
    } else if (r.fallback) {
      result = fromUnit('address', `stored point was a placeholder (${r.fallback})`);
    } else if (fabricated.has(r)) {
      result = fromUnit('address', 'stored point belongs to a cluster the listings\' own addresses contradict');
    } else if (r.verdict === 'contradicted') {
      const km = Math.round(haversineKm(r.point, [place.lat, place.lng]));
      result = fromUnit('address', `stored point lay ~${km} km from the ${place.level} the address names`);
    } else {
      result = {
        latitude: r.point[0], longitude: r.point[1], geoPrecision: 'exact', geoRadiusKm: 0.05,
        geoSource: r.verdict === 'consistent' ? 'maps-verified' : 'maps-unverified', geoUnit: unit, geoNote: null,
      };
    }
    out.set(r.listing.id, result);
  }
  return out;
}

function round2(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}
