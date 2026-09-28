/**
 * The national admin index, built once per process. Every Node path that
 * exports listings (snapshot, heartbeat, Firestore sync) passes it to
 * canonicalizePublicListings({ geoIndex }) so no copy of the data leaves the
 * pipeline without a placement verdict.
 */
import { buildAdminIndex } from './geo_index.js';
import { prepareAdminIndex } from '../../src/lib/place_resolver.js';

let cached = null;

export function getGeoIndex() {
  if (!cached) cached = prepareAdminIndex(buildAdminIndex());
  return cached;
}
