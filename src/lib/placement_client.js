/**
 * Browser bridge for placement.
 *
 * The pipeline attaches a placement verdict (geoPrecision …) to every listing it
 * exports. Data written before that change — or by a pipeline not yet updated —
 * arrives without one, still carrying coordinates that may be fabricated. This
 * places those listings in the browser with the same resolver the pipeline
 * uses, so every consumer (map, proximity finder, detail modal) sees one
 * corrected truth. The admin index (~57 KB gzip) is fetched only when needed.
 */

import { applyPlacement } from './listing_contract.js';
import { prepareAdminIndex } from './place_resolver.js';

const INDEX_URL = '/geo/admin_index.json';
let indexPromise = null;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`admin index ${response.status}`);
        return response.json();
      })
      .then(prepareAdminIndex)
      .catch((error) => {
        indexPromise = null; // allow a later retry
        throw error;
      });
  }
  return indexPromise;
}

/** Listings with a verdict pass through untouched; the rest are placed. */
export async function ensurePlacement(listings) {
  if (!Array.isArray(listings) || listings.every((listing) => listing?.geoPrecision)) return listings;
  try {
    const index = await loadIndex();
    // Placement runs over the whole set — fabricated clusters are only visible
    // in aggregate — but only listings without a verdict take its result.
    const placed = applyPlacement(listings, index);
    return listings.map((listing, i) => (listing?.geoPrecision ? listing : placed[i]));
  } catch (error) {
    // Without the index we cannot tell a real coordinate from a fabricated one.
    // Showing nothing is honest; showing a possibly-invented pin is not.
    console.warn('Placement index unavailable; unverified coordinates withheld:', error.message);
    return listings.map((listing) => (listing?.geoPrecision ? listing : {
      ...listing, latitude: null, longitude: null, geoPrecision: 'none', geoNote: 'placement index unavailable',
    }));
  }
}
