/**
 * Civic live pulse — atlas-portable fetchers.
 *
 * Grammar taken from God's Eye View (MIT, code only): every live layer
 * returns `{ state, source, fetchedAt, attribution, items, error }` where
 * `state` is `live` | `delayed` | `unavailable`. Atlas already labels
 * flood envelopes `schematic`; these three feeds never are.
 *
 * atlas.nonarkara.org (BKKx 3D Atlas, MapLibre `LAYERS` registry) already
 * has traffic, CCTV, rain, AQI, flood sensors, and iTIC incident *labels*.
 * It does not have:
 *   1. ADS-B aircraft over Bangkok
 *   2. USGS earthquakes (iTIC "earthquake" is an incident type, not the feed)
 *   3. wildfire detections for the haze / AQI story
 *   4. a share URL that encodes *enabled layers* (atlas hash is camera/area)
 *
 * Drop these into atlas `LAYERS` as GeoJSON sources — `toGeoJSON(bundle)`.
 * Do not port Cesium, Google Photorealistic 3D, OpenAI voice, military HUD,
 * person tracking, Starlink catalogs, or TeleGeography cables (CC BY-NC-SA).
 * OpenSky Network terms are non-commercial; public sites use adsb.lol.
 */

export const BANGKOK = Object.freeze({ lat: 13.7563, lon: 100.5018 });
/** adsb.lol `/dist/` is nautical miles. 50 NM covers both airports plus inbound. */
export const FLIGHT_RADIUS_NM = 50;
export const FLIGHT_RADIUS_KM = Math.round(FLIGHT_RADIUS_NM * 1.852);
/** Philippines / Sumatra / Andaman — distances Bangkok actually feels. */
export const QUAKE_RADIUS_KM = 3500;
/** Mainland SE Asia + the haze corridor (Sumatra / Borneo). */
export const FIRE_BBOX = Object.freeze({
  minLat: -8,
  maxLat: 23,
  minLon: 92,
  maxLon: 125,
});
export const FIRE_MAX_AGE_DAYS = 14;

export const ADSB_LOL_URL = (lat, lon, distNm) =>
  `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${distNm}`;

/**
 * Browser calls must go through a same-origin proxy: adsb.lol GET responses
 * omit Access-Control-Allow-Origin (verified 2026-08-31). Atlas should use
 * the existing Cloudflare Worker the same way; Node tests hit upstream
 * directly.
 */
export function resolveAdsbUrl(lat, lon, distNm = FLIGHT_RADIUS_NM) {
  if (typeof window !== 'undefined') {
    return `/api/civic/adsb?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&dist=${encodeURIComponent(distNm)}`;
  }
  return ADSB_LOL_URL(lat, lon, distNm);
}

export async function handleCivicAdsbProxy(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const lat = finiteNumber(req.query?.lat ?? url.searchParams.get('lat'));
  const lon = finiteNumber(req.query?.lon ?? url.searchParams.get('lon'));
  const distNm = finiteNumber(req.query?.dist ?? url.searchParams.get('dist')) ?? FLIGHT_RADIUS_NM;
  if (lat === null || lon === null) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ error: 'lat, lon, dist required' }));
    return;
  }
  try {
    const upstream = await fetch(ADSB_LOL_URL(lat, lon, distNm), {
      headers: { accept: 'application/json' },
    });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ error: 'adsb.lol upstream failed' }));
  }
}
export const USGS_DAY_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
export const EONET_WILDFIRES_URL =
  'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires';

export const ATLAS_LAYER_SPECS = Object.freeze([
  {
    id: 'flights',
    name: 'Live flights',
    description: 'adsb.lol · 50 NM of Bangkok',
    defaultOn: false,
    freshness: 'live',
    source: 'adsb.lol',
    attribution: 'Aircraft positions © adsb.lol contributors (ADS-B)',
  },
  {
    id: 'quakes',
    name: 'Earthquakes',
    description: 'USGS · M2.5+ last 24h',
    defaultOn: false,
    freshness: 'live',
    source: 'USGS',
    attribution: 'USGS Earthquake Hazards Program',
  },
  {
    id: 'fires',
    name: 'Regional fires',
    description: 'NASA EONET · open wildfires, 14 days',
    defaultOn: false,
    freshness: 'delayed',
    source: 'NASA EONET',
    attribution: 'NASA Earth Observatory Natural Event Tracker',
  },
]);

const KNOT_TO_KMH = 1.852;
const FOOT_TO_M = 0.3048;

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function haversineKm(from, to) {
  const lat1 = Number(from?.lat ?? from?.[0]);
  const lon1 = Number(from?.lon ?? from?.[1]);
  const lat2 = Number(to?.lat ?? to?.[0]);
  const lon2 = Number(to?.lon ?? to?.[1]);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bundle({
  state,
  source,
  fetchedAt,
  attribution,
  items = [],
  error = null,
  extra = {},
}) {
  return {
    state,
    source,
    fetchedAt: fetchedAt || null,
    attribution: attribution || '',
    items,
    error: error || null,
    count: items.length,
    ...extra,
  };
}

function epochMs(value) {
  const number = finiteNumber(value);
  if (number === null) return Date.now();
  return number > 10_000_000_000 ? number : number * 1000;
}

/**
 * Parse an adsb.lol v2 `{ ac, now, total }` snapshot.
 * `now` arrives in milliseconds; `seen` / `seen_pos` are age in seconds.
 */
export function parseAdsbLol(payload, { origin = BANGKOK, nowMs = Date.now() } = {}) {
  const rows = Array.isArray(payload?.ac) ? payload.ac : [];
  const fetchedAt = epochMs(payload?.now) || nowMs;
  const items = [];
  for (const aircraft of rows) {
    const lat = finiteNumber(aircraft?.lat);
    const lon = finiteNumber(aircraft?.lon);
    const hex = String(aircraft?.hex || '').trim().toLowerCase();
    if (!hex || lat === null || lon === null) continue;
    const onGround = aircraft?.alt_baro === 'ground';
    const altitudeFt = onGround ? 0 : finiteNumber(aircraft?.alt_baro);
    const speedKt = finiteNumber(aircraft?.gs);
    const headingDeg = finiteNumber(aircraft?.track);
    const seenSec = Math.max(0, finiteNumber(aircraft?.seen_pos) ?? finiteNumber(aircraft?.seen) ?? 0);
    items.push({
      id: hex,
      callsign: String(aircraft?.flight || aircraft?.r || '').trim() || hex.toUpperCase(),
      registration: String(aircraft?.r || '').trim() || null,
      lat,
      lon,
      altitudeFt,
      altitudeM: altitudeFt === null ? null : Math.round(altitudeFt * FOOT_TO_M),
      speedKt,
      speedKmh: speedKt === null ? null : Math.round(speedKt * KNOT_TO_KMH),
      headingDeg,
      onGround,
      squawk: aircraft?.squawk ? String(aircraft.squawk) : null,
      seenSec,
      distanceKm: Math.round(haversineKm(origin, { lat, lon }) * 10) / 10,
    });
  }
  const stale = items.length > 0
    && items.filter((row) => row.seenSec > 60).length / items.length > 0.5;
  return bundle({
    state: items.length === 0 ? 'live' : stale ? 'delayed' : 'live',
    source: 'adsb.lol',
    fetchedAt,
    attribution: ATLAS_LAYER_SPECS[0].attribution,
    items,
    extra: { total: finiteNumber(payload?.total) ?? items.length, radiusNm: FLIGHT_RADIUS_NM, radiusKm: FLIGHT_RADIUS_KM },
  });
}

export function parseUsgsGeojson(payload, {
  origin = BANGKOK,
  maxKm = QUAKE_RADIUS_KM,
} = {}) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const ranked = [];
  for (const feature of features) {
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = finiteNumber(coords[0]);
    const lat = finiteNumber(coords[1]);
    const depthKm = finiteNumber(coords[2]);
    if (lat === null || lon === null) continue;
    const props = feature.properties || {};
    const mag = finiteNumber(props.mag);
    const timeMs = finiteNumber(props.time);
    const distanceKm = Math.round(haversineKm(origin, { lat, lon }));
    ranked.push({
      id: String(feature.id || props.ids || `quake-${ranked.length}`),
      mag,
      place: String(props.place || '').trim() || 'Unknown location',
      lat,
      lon,
      depthKm,
      timeMs,
      url: props.url || null,
      distanceKm,
    });
  }
  ranked.sort((a, b) => a.distanceKm - b.distanceKm);
  const items = ranked.filter((row) => row.distanceKm <= maxKm);
  const generated = payload?.metadata?.generated;
  return bundle({
    state: 'live',
    source: 'USGS',
    fetchedAt: finiteNumber(generated) || Date.now(),
    attribution: ATLAS_LAYER_SPECS[1].attribution,
    items,
    extra: {
      nearest: ranked[0] || null,
      worldwide: ranked.length,
      radiusKm: maxKm,
    },
  });
}

function geometryPoints(geometry) {
  if (!geometry) return [];
  if (Array.isArray(geometry)) return geometry.flatMap(geometryPoints);
  const type = geometry.type;
  const coords = geometry.coordinates;
  if (type === 'Point' && Array.isArray(coords) && typeof coords[0] === 'number') {
    return [{ lon: coords[0], lat: coords[1], date: geometry.date || null }];
  }
  if (type === 'Polygon' && Array.isArray(coords?.[0])) {
    const ring = coords[0];
    if (!Array.isArray(ring) || ring.length === 0) return [];
    const sum = ring.reduce((acc, pair) => {
      acc.lon += Number(pair[0]) || 0;
      acc.lat += Number(pair[1]) || 0;
      return acc;
    }, { lon: 0, lat: 0 });
    return [{ lon: sum.lon / ring.length, lat: sum.lat / ring.length, date: geometry.date || null }];
  }
  return [];
}

function inBbox(lat, lon, bbox = FIRE_BBOX) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

export function parseEonetEvents(payload, {
  bbox = FIRE_BBOX,
  maxAgeDays = FIRE_MAX_AGE_DAYS,
  nowMs = Date.now(),
} = {}) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const items = [];
  let staleWithheld = 0;
  for (const event of events) {
    const points = geometryPoints(event.geometry).filter((pt) => (
      Number.isFinite(pt.lat) && Number.isFinite(pt.lon) && inBbox(pt.lat, pt.lon, bbox)
    ));
    if (points.length === 0) continue;
    let latest = null;
    for (const pt of points) {
      const ms = pt.date ? Date.parse(pt.date) : NaN;
      if (!Number.isFinite(ms)) continue;
      if (!latest || ms > latest.ms) latest = { ...pt, ms };
    }
    if (!latest || nowMs - latest.ms > maxAgeMs) {
      staleWithheld += 1;
      continue;
    }
    items.push({
      id: String(event.id || `fire-${items.length}`),
      title: String(event.title || 'Wildfire').trim(),
      lat: latest.lat,
      lon: latest.lon,
      date: latest.date,
      timeMs: latest.ms,
      link: event.link || null,
      sources: Array.isArray(event.sources) ? event.sources.map((s) => s.id || s.url).filter(Boolean) : [],
      distanceKm: Math.round(haversineKm(BANGKOK, { lat: latest.lat, lon: latest.lon })),
    });
  }
  items.sort((a, b) => a.distanceKm - b.distanceKm);
  return bundle({
    state: 'delayed',
    source: 'NASA EONET',
    fetchedAt: nowMs,
    attribution: ATLAS_LAYER_SPECS[2].attribution,
    items,
    extra: { staleWithheld, scanned: events.length, maxAgeDays },
  });
}

export function toGeoJSON(bundleLike) {
  const items = Array.isArray(bundleLike?.items) ? bundleLike.items : [];
  return {
    type: 'FeatureCollection',
    features: items.map((item) => ({
      type: 'Feature',
      id: item.id,
      geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
      properties: { ...item },
    })),
  };
}

export function formatCivicStatus(bundle, nowMs = Date.now()) {
  if (!bundle) return 'off';
  if (bundle.state === 'unavailable') {
    return bundle.error ? `unavailable · ${bundle.error}` : 'unavailable';
  }
  const ageMs = bundle.fetchedAt ? Math.max(0, nowMs - bundle.fetchedAt) : 0;
  const age = ageMs < 15_000 ? 'just now'
    : ageMs < 60_000 ? `${Math.floor(ageMs / 1000)}s ago`
      : `${Math.floor(ageMs / 60_000)}m ago`;
  const count = Number.isFinite(bundle.count) ? bundle.count : bundle.items?.length || 0;
  return `${bundle.state} · ${count} · ${age}`;
}

async function fetchJson(url, { fetchImpl = globalThis.fetch, timeoutMs = 12_000 } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch unavailable');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(source, error, extra = {}) {
  return bundle({
    state: 'unavailable',
    source,
    fetchedAt: Date.now(),
    attribution: '',
    items: [],
    error: String(error?.message || error || 'unavailable'),
    extra,
  });
}

export async function fetchCivicFlights({
  lat = BANGKOK.lat,
  lon = BANGKOK.lon,
  distNm = FLIGHT_RADIUS_NM,
  fetchImpl,
} = {}) {
  try {
    const payload = await fetchJson(resolveAdsbUrl(lat, lon, distNm), { fetchImpl });
    return parseAdsbLol(payload, { origin: { lat, lon } });
  } catch (error) {
    return unavailable('adsb.lol', error, { radiusNm: distNm, radiusKm: FLIGHT_RADIUS_KM });
  }
}

export async function fetchCivicQuakes({ fetchImpl, origin = BANGKOK, maxKm = QUAKE_RADIUS_KM } = {}) {
  try {
    const payload = await fetchJson(USGS_DAY_URL, { fetchImpl });
    return parseUsgsGeojson(payload, { origin, maxKm });
  } catch (error) {
    return unavailable('USGS', error, { radiusKm: maxKm });
  }
}

export async function fetchCivicFires({ fetchImpl, bbox = FIRE_BBOX, nowMs } = {}) {
  try {
    const payload = await fetchJson(EONET_WILDFIRES_URL, { fetchImpl });
    return parseEonetEvents(payload, { bbox, nowMs });
  } catch (error) {
    return unavailable('NASA EONET', error);
  }
}
