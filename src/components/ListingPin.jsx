import L from 'leaflet';
import {
  getPinClassName,
  getPinSize,
  getPinSizeForState,
} from '../lib/listingPin';
import './ListingPin.css';

/**
 * Build a Leaflet divIcon for one listing pin.
 *
 * Encapsulates the freshness + mention-volume classification so the map's
 * marker render effect stays readable. The className is rebuilt every time
 * the map effect re-runs (every 60s nowMs tick) — the popup-stays-open logic
 * in ListingMap catches the brief popup-flicker and reopens by lat/lng.
 *
 * @param {object} listing  — the listing row from data.json
 * @param {object} availability — output of getAvailability() for this listing
 * @param {number} nowMs    — Date.now() at render time
 */
export function createListingPinIcon(listing, availability, nowMs) {
  const state = getPinSizeForState(getPinSize(listing), listing?.__pinState);
  const size = state;
  const className = getPinClassName(listing, availability, nowMs);
  return L.divIcon({
    className,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 3)],
    tooltipAnchor: [size / 2 + 3, 0],
  });
}
