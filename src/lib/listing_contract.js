// Coordinate extraction helpers and Maps URL resolver.
// Used by the geocode pipeline to derive lat/lng from stored maps_url values.

const SHORTLINK_HOSTS = new Set(['maps.app.goo.gl']);
const USER_AGENT = 'Sabai-Sabai/1.0 (+https://sabaisabai-airdnd.pages.dev)';
const TIMEOUT_MS = 5000;

function extractCoordsFromUrl(url) {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
  }
  const dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dMatch) {
    return { latitude: parseFloat(dMatch[1]), longitude: parseFloat(dMatch[2]) };
  }
  return null;
}

function isShortLink(urlObj) {
  if (SHORTLINK_HOSTS.has(urlObj.hostname)) return true;
  // goo.gl/maps/... shortlinks
  if (urlObj.hostname === 'goo.gl' && urlObj.pathname.startsWith('/maps')) return true;
  return false;
}

/**
 * Resolve lat/lng from a Google Maps URL.
 *
 * Direct URLs (google.com/maps/place/...): coordinates are extracted from the
 * URL string — no network request.
 *
 * Shortlinks (maps.app.goo.gl, goo.gl/maps): HTTP redirects are followed and
 * coordinates are extracted from the final resolved URL.
 *
 * Returns { latitude, longitude } or null.
 */
export async function resolveGoogleMapsData(mapsUrl) {
  if (!mapsUrl) return null;

  let urlObj;
  try {
    urlObj = new URL(mapsUrl);
  } catch {
    console.error('[resolveGoogleMapsData] Invalid URL:', mapsUrl);
    return null;
  }

  if (!isShortLink(urlObj)) {
    return extractCoordsFromUrl(mapsUrl);
  }

  try {
    const response = await fetch(mapsUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    const finalUrl = response.url || '';
    const coords = extractCoordsFromUrl(finalUrl);
    if (!coords) {
      console.error('[resolveGoogleMapsData] No coordinates in resolved URL:', finalUrl);
    }
    return coords;
  } catch (err) {
    console.error('[resolveGoogleMapsData] Shortlink resolution failed:', mapsUrl, err.message);
    return null;
  }
}
