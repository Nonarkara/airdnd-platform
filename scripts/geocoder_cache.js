import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isGoogleMapsUrl, resolveGoogleMapsData } from '../src/lib/listing_contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '../.maps_cache.json');

const CACHE_FAILURE_TTL_MS = 24 * 60 * 60 * 1000;
// v2: coordinates are read from the redirect chain only. Every v1 entry may
// hold a point scraped from Google page chrome (fourteen businesses resolved to
// one fixture), so v1 entries — successes and failures alike — are ignored and
// re-resolved rather than trusted.
const CACHE_VERSION = 2;
const DEFAULT_DELAY_MS = 500;
const GEOCODER_USER_AGENT = 'SabaiSabaiBot/1.0 (+https://sabaisabai-airdnd.pages.dev)';

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
  } catch (e) {
    console.error('[GEO CACHE] Error loading cache:', e.message);
  }
  return {};
}

function saveCache(cache) {
  try {
    const tempFile = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tempFile, CACHE_FILE);
  } catch (e) {
    console.error('[GEO CACHE] Error saving cache:', e.message);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resolveGoogleMapsDataCached(mapsUrl, options = {}) {
  if (!mapsUrl) return null;
  if (!isGoogleMapsUrl(mapsUrl)) {
    console.warn(`[GEO CACHE] Skipping non-Google Maps URL: ${String(mapsUrl).slice(0, 80)}`);
    return null;
  }
  const { delayMs = DEFAULT_DELAY_MS, ...resolverOptions } = options;

  const cache = loadCache();
  const cached = cache[mapsUrl]?.v === CACHE_VERSION ? cache[mapsUrl] : null;
  const now = Date.now();

  // If successfully resolved before, return it
  if (cached && !cached.failed && cached.latitude && cached.longitude) {
    return {
      finalUrl: cached.finalUrl || mapsUrl,
      latitude: cached.latitude,
      longitude: cached.longitude,
      address: cached.address || '',
      canonicalMapsKey: cached.canonicalMapsKey || '',
    };
  }

  // If failed recently, skip geocoding it again to prevent rate limits
  if (cached && cached.failed && (now - cached.failedAt < CACHE_FAILURE_TTL_MS)) {
    // Return null to bypass retry
    return null;
  }

  await sleep(delayMs);

  const requestOptions = {
    ...resolverOptions,
    headers: {
      ...(resolverOptions.headers || {}),
      'User-Agent': GEOCODER_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  };

  try {
    const result = await resolveGoogleMapsData(mapsUrl, requestOptions);
    if (result && result.latitude && result.longitude) {
      cache[mapsUrl] = {
        v: CACHE_VERSION,
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.address,
        finalUrl: result.finalUrl,
        canonicalMapsKey: result.canonicalMapsKey,
        resolvedAt: now,
        failed: false
      };
      saveCache(cache);
      return result;
    } else {
      cache[mapsUrl] = {
        v: CACHE_VERSION,
        failed: true,
        failedAt: now,
        reason: 'no coords resolved'
      };
      saveCache(cache);
      return null;
    }
  } catch (error) {
    cache[mapsUrl] = {
      failed: true,
      failedAt: now,
      reason: error.message
    };
    saveCache(cache);
    return null;
  }
}
