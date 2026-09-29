import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  formatTelLink,
  formatTelDisplay,
  formatLineUrl,
  formatMapsUrl,
} from '../lib/normalization';
import {
  distanceKm,
  formatDistance,
  formatFreshness,
  getAvailability,
} from '../lib/mapAvailability';
import MapMarketBar from './MapMarketBar';
import SpatialAnalyticsPanel from './SpatialAnalyticsPanel';
import { buildHealthMatrix, loadFormalization, loadProvinceHiv } from '../lib/health';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.heat';
import './ListingMap.css';

const BANGKOK_CENTER = [13.7563, 100.5018];
const DEFAULT_ZOOM = 11;
const CITY_COORDINATES = {
  Bangkok: BANGKOK_CENTER,
  Nonthaburi: [13.86, 100.514],
  'Pathum Thani': [14.02, 100.525],
  'Samut Prakan': [13.599, 100.599],
  Chonburi: [13.361, 100.985],
  Phuket: [7.88, 98.392],
  'Chiang Mai': [18.788, 98.985],
  'Chiang Rai': [19.91, 99.84],
  Saraburi: [14.528, 100.91],
  'Khon Kaen': [16.441, 102.836],
  'Udon Thani': [17.414, 102.786],
  'Nakhon Ratchasima': [14.979, 102.097],
  Songkhla: [7.19, 100.595],
  'Prachuap Khiri Khan': [11.812, 99.797],
  Rayong: [12.682, 101.278],
  Ayutthaya: [14.353, 100.568],
  'Nakhon Pathom': [13.819, 100.064],
  'Surat Thani': [9.14, 99.333],
  // --- Additional Provinces ---
  'Mae Hong Son': [19.300, 97.960],
  Lampang: [18.290, 99.500],
  Lamphun: [18.580, 99.040],
  Phrae: [18.140, 100.140],
  Nan: [18.780, 100.780],
  Phayao: [19.160, 99.900],
  Uttaradit: [17.620, 100.100],
  Phitsanulok: [16.820, 100.260],
  Sukhothai: [17.010, 99.820],
  Tak: [16.880, 99.120],
  'Kamphaeng Phet': [16.480, 99.520],
  Phichit: [16.440, 100.350],
  Phetchabun: [16.420, 101.160],
  'Nakhon Sawan': [15.700, 100.120],
  'Uthai Thani': [15.380, 100.020],
  'Chai Nat': [15.180, 100.120],
  'Sing Buri': [14.890, 100.400],
  'Ang Thong': [14.590, 100.450],
  Lopburi: [14.800, 100.620],
  'Nakhon Nayok': [14.200, 101.210],
  Kanchanaburi: [14.020, 99.530],
  Ratchaburi: [13.520, 99.820],
  'Suphan Buri': [14.470, 100.120],
  'Samut Sakhon': [13.547, 100.274],
  'Samut Songkhram': [13.410, 100.000],
  Phetchaburi: [13.110, 99.940],
  'Sa Kaeo': [13.810, 102.070],
  'Prachin Buri': [14.050, 101.370],
  Chachoengsao: [13.690, 101.070],
  Chanthaburi: [12.610, 102.110],
  Trat: [12.240, 102.510],
  'Nong Khai': [17.880, 102.740],
  'Bueng Kan': [18.360, 103.650],
  Loei: [17.490, 101.730],
  'Sakon Nakhon': [17.160, 104.140],
  'Nakhon Phanom': [17.400, 104.780],
  'Nong Bua Lamphu': [17.200, 102.440],
  Mukdahan: [16.540, 104.720],
  Kalasin: [16.430, 103.520],
  Chaiyaphum: [15.800, 102.030],
  'Maha Sarakham': [16.180, 103.300],
  'Roi Et': [16.050, 103.650],
  Yasothon: [15.800, 104.140],
  'Amnat Charoen': [15.850, 104.620],
  'Ubon Ratchathani': [15.230, 104.850],
  'Si Sa Ket': [15.110, 104.320],
  Surin: [14.880, 103.490],
  Buriram: [15.000, 103.100],
  Chumphon: [10.490, 99.180],
  Ranong: [9.960, 98.630],
  'Phang Nga': [8.440, 98.520],
  Krabi: [8.080, 98.910],
  'Nakhon Si Thammarat': [8.430, 99.960],
  Trang: [7.560, 99.610],
  Phatthalung: [7.620, 100.080],
  Satun: [6.610, 100.060],
  Pattani: [6.860, 101.250],
  Yala: [6.540, 101.280],
  Narathiwat: [6.420, 101.820],
};

// NASA GPM/IMERG precipitation tiles via GIBS — no API key required.
// Date is set 3 days in the past to ensure processing is complete.
const imergDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().slice(0, 10);
})();

// Where a pin goes is decided by the placement verdict (src/lib/place_resolver.js),
// never here. Exact points are drawn as points; a subdistrict or district is
// drawn at its centre with the uncertainty stated; anything vaguer is listed,
// not pinned. There is no jitter: scattering a stack of identical guesses made
// fabricated density look like a real neighbourhood.
const PINNABLE = new Set(['exact', 'tambon', 'district']);

function getListingCoordinates(listing) {
  const latitude = Number.parseFloat(listing?.latitude);
  const longitude = Number.parseFloat(listing?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const precision = listing?.geoPrecision || 'exact';
  if (!PINNABLE.has(precision)) return null;
  return { coords: [latitude, longitude], precision, radiusKm: Number(listing?.geoRadiusKm) || null };
}

function unitLabel(listing, { withProvince = true } = {}) {
  const unit = listing?.geoUnit;
  if (!unit) return '';
  const parts = [unit.tambon?.th, unit.district?.th, withProvince ? unit.province?.th : null].filter(Boolean);
  return parts.join(' · ');
}

function describePrecision(listing, precision) {
  if (precision === 'exact') {
    if (listing?.geoSource === 'maps-verified') return 'Pinned from the shop\'s map link · confirmed by its address';
    if (listing?.geoSource === 'maps-link') return 'Pinned from coordinates in the shop\'s own link';
    return 'Pinned from the shop\'s map link';
  }
  const radius = Number(listing?.geoRadiusKm);
  const within = Number.isFinite(radius) ? ` · within ~${radius < 1 ? radius.toFixed(1) : Math.round(radius)} km` : '';
  const scope = precision === 'tambon' ? 'Somewhere in' : 'Somewhere in district';
  return `${scope} ${unitLabel(listing, { withProvince: false }) || 'the named area'}${within}`;
}

function mapsHrefFor(listing) {
  return formatMapsUrl(listing.mapsUrl, listing.latitude, listing.longitude, {
    precision: listing.geoPrecision || 'exact',
    name: listing.name,
    location: listing.location,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPopupHtml(listing, precision, availability) {
  const lines = [];
  lines.push(`<strong style="font-size:14px">${escapeHtml(listing.name || 'Unknown')}</strong>`);
  if (listing.location) lines.push(`<div style="font-size:11px;color:#888;margin-top:2px">${escapeHtml(listing.location)}</div>`);
  lines.push(`<div class="popup-precision popup-precision--${escapeHtml(precision)}">${escapeHtml(describePrecision(listing, precision))}</div>`);
  lines.push(`<div class="popup-availability popup-availability--${escapeHtml(availability.state)}">${escapeHtml(availability.label)}</div>`);

  const meta = [];
  if (listing.priceLabel && listing.priceLabel !== 'Rate on request') meta.push(listing.priceLabel);
  if (listing.hours) meta.push(listing.hours);
  if (meta.length > 0) lines.push(`<div style="margin-top:6px;font-weight:600;color:#FFD23D">${escapeHtml(meta.join(' · '))}</div>`);

  const links = [];
  const telHref = formatTelLink(listing.phone);
  const lineHref = formatLineUrl(listing.lineUrl);
  const mapsHref = mapsHrefFor(listing);
  if (telHref) links.push(`<a href="${escapeHtml(telHref)}" style="color:#c8102e">Tel</a>`);
  if (lineHref) links.push(`<a href="${escapeHtml(lineHref)}" target="_blank" rel="noopener noreferrer" style="color:#06c755">LINE</a>`);
  if (mapsHref) links.push(`<a href="${escapeHtml(mapsHref)}" target="_blank" rel="noopener noreferrer" style="color:#4285f4">Maps</a>`);
  if (links.length > 0) lines.push(`<div style="margin-top:6px;display:flex;gap:10px;font-size:12px;font-weight:600">${links.join('')}</div>`);

  const mentions = Number(listing.mentionCount) || Number(listing.mention_count) || 0;
  if (mentions > 1) lines.push(`<div style="margin-top:4px;font-size:10px;color:#9fc2ff;font-family:monospace">${mentions}× in feed</div>`);
  if (listing.sourceChannel) lines.push(`<div style="margin-top:4px;font-size:10px;color:#666">${escapeHtml(listing.sourceChannel)}</div>`);

  lines.push(`
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255, 255, 255, 0.08)">
      <button class="popup-view-btn" data-id="${escapeHtml(listing.id)}" style="
        width: 100%;
        height: 32px;
        background: rgba(255, 61, 139, 0.12);
        border: 1px solid #FF3D8B;
        border-radius: 0;
        color: #FF3D8B;
        font-family: 'Hanken Grotesk', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s ease;
    ">View details</button>
    </div>
  `);

  return lines.join('');
}

function getAuraClass(listing) {
  const mentions = Number(listing.mentionCount) || Number(listing.mention_count) || 1;
  const dataScore =
    (listing.description && listing.description.length > 20 && listing.description !== 'Details for this listing are still being collected.' ? 1 : 0) +
    (listing.phone || listing.lineUrl || listing.telegramUrl || listing.mapsUrl ? 1 : 0) +
    (listing.priceLabel && listing.priceLabel !== 'Rate on request' ? 1 : 0) +
    (listing.imageUrl && !listing.imageUrl.startsWith('/mockups/') ? 1 : 0);
  const activityBonus = mentions > 10 ? 2 : mentions > 3 ? 1 : 0;
  const total = dataScore + activityBonus;
  if (total >= 4) return 'aura-level-3';
  if (total >= 2) return 'aura-level-2';
  return 'aura-level-1';
}

function createPinIcon(listing, availability, precision = 'exact') {
  const mentions = Number(listing.mentionCount) || Number(listing.mention_count) || 1;
  const size = mentions > 10 ? 22 : mentions > 3 ? 16 : 10;
  return L.divIcon({
    className: `listing-pin ${getAuraClass(listing)} availability-${availability.state} precision-${precision}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 3)],
    tooltipAnchor: [size / 2 + 3, 0],
  });
}

export default function ListingMap({
  listings,
  onCardClick,
  t,
  viewKey = 'all',
  theme,
  lastUpdatedAt,
  isRefreshing = false,
  dataSource = 'snapshot',
  mapMode = 'directory',
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const listingsRef = useRef(listings);
  const hasFittedInitialRef = useRef(false);
  const lastAutoFitKeyRef = useRef(null);
  const darkLayerRef = useRef(null);
  const lightLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const epidemicLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const reachRingsRef = useRef([]);
  const geoWatchIdRef = useRef(null);
  const [aqiActive, setAqiActive] = useState(false);
  const [rainActive, setRainActive] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [epidemicRows, setEpidemicRows] = useState([]);
  const [epidemicMeta, setEpidemicMeta] = useState(null);

  const { pins, pendingListings } = useMemo(() => {
    if (!Array.isArray(listings)) return { pins: [], pendingListings: [] };
    const withCoords = [];
    const withoutCoords = [];
    listings.forEach((listing) => {
      const coordinateResult = getListingCoordinates(listing);
      if (coordinateResult) withCoords.push({ listing, ...coordinateResult });
      else withoutCoords.push(listing);
    });
    return { pins: withCoords, pendingListings: withoutCoords };
  }, [listings]);
  const exactPinCount = pins.filter((pin) => pin.precision === 'exact').length;
  const areaPinCount = pins.length - exactPinCount;
  const pinSummary = [
    exactPinCount > 0 ? `${exactPinCount} exact` : null,
    areaPinCount > 0 ? `${areaPinCount} by subdistrict or district` : null,
  ].filter(Boolean).join(' · ') || '0 mapped pins';

  const nearby = useMemo(() => {
    if (!userLocation) return null;
    const ranked = pins
      .map((pin) => ({
        ...pin,
        distance: distanceKm(userLocation.coords, pin.coords),
        availability: getAvailability(pin.listing, nowMs),
      }))
      .sort((left, right) => {
        const availabilityDelta = right.availability.rank - left.availability.rank;
        return availabilityDelta || left.distance - right.distance;
      });
    const summarize = (radius) => {
      const matches = ranked.filter((pin) => pin.distance <= radius);
      return {
        total: matches.length,
        available: matches.filter((pin) => pin.availability.state === 'available').length,
        open: matches.filter((pin) => pin.availability.state === 'open').length,
        approximate: matches.filter((pin) => pin.precision !== 'exact').length,
      };
    };
    return {
      oneKm: summarize(1),
      tenKm: summarize(10),
      nearest: ranked.filter((pin) => pin.distance <= 10).slice(0, 5),
    };
  }, [nowMs, pins, userLocation]);

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const fitMapToPins = useCallback(() => {
    if (!mapInstanceRef.current) return;

    if (pins.length === 0) {
      mapInstanceRef.current.setView(BANGKOK_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(pins.map((pin) => pin.coords));
    const span = Math.max(
      bounds.getNorth() - bounds.getSouth(),
      bounds.getEast() - bounds.getWest(),
    );
    const tightCluster = span < 0.25;
    const maxFitZoom = tightCluster ? 11 : 13;
    mapInstanceRef.current.fitBounds(bounds.pad(0.25), { maxZoom: maxFitZoom, animate: false });
  }, [pins]);

  // Keep a live ref to fitMapToPins so the (run-once) init effect's
  // ResizeObserver can call the current version without re-subscribing.
  const fitRef = useRef(fitMapToPins);
  useEffect(() => { fitRef.current = fitMapToPins; }, [fitMapToPins]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError('Location services are not available on this device.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
    }
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocating(false);
        setLocateError(null);
        setUserLocation({
          coords: [position.coords.latitude, position.coords.longitude],
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        setLocating(false);
        const message = error.code === 1
          ? 'Location access was not allowed. Enable it in your browser to use reach mode.'
          : 'Your current location could not be found. Please try again.';
        setLocateError(message);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 15_000 },
    );
  }, []);

  useEffect(() => () => {
    if (geoWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const mapElement = mapRef.current;

    const map = L.map(mapElement, {
      center: BANGKOK_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 5,
      scrollWheelZoom: 'center',
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      zoomControl: true,
      worldCopyJump: false,
      // Smoother, less jumpy zoom on touchpad / scroll wheel.
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelDebounceTime: 80,
      wheelPxPerZoomLevel: 140,
    });

    // Base layers — dark vector, light vector, and satellite.
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    });
    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    });
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      },
    );

    darkLayerRef.current = dark;
    lightLayerRef.current = light;

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (currentTheme === 'light') {
      light.addTo(map);
    } else {
      dark.addTo(map);
    }

    // AQI overlay (AQICN tiles — public demo token; rate-limited but functional).
    const aqi = L.tileLayer(
      'https://tiles.aqicn.org/tiles/usepa-aqi/{z}/{x}/{y}.png?token=demo',
      {
        attribution: 'Air-quality tiles &copy; <a href="https://aqicn.org">aqicn.org</a>',
        maxZoom: 16,
        opacity: 0.55,
      },
    );

    // Precipitation overlay — NASA GPM/IMERG via GIBS (free, no API key).
    // Shows actual satellite-measured precipitation rate, not a forecast model.
    const rain = L.tileLayer(
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${imergDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
      {
        attribution: 'Precipitation &copy; <a href="https://gpm.nasa.gov">NASA GPM/IMERG</a> via <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs">GIBS</a>',
        maxZoom: 6,
        opacity: 0.75,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      },
    );

    // Heatmap layer for spatial mathematics
    const heatLayer = L.heatLayer([], {
      radius: 20,
      blur: 15,
      maxZoom: 13,
      gradient: { 0.4: '#4a607a', 0.6: '#8e7a68', 0.8: '#c4a44a', 1.0: '#ffd23d' }
    });
    heatLayerRef.current = heatLayer;

    L.control
      .layers(
        { 'Dark Map': dark, 'Light Map': light, Satellite: satellite },
        { 'Air Quality (PM2.5)': aqi, 'Precipitation (IMERG)': rain, 'Demand Heatmap': heatLayer },
        { position: 'topright', collapsed: true },
      )
      .addTo(map);

    // Sync legend visibility with overlay toggles.
    map.on('overlayadd', (e) => {
      if (e.layer === aqi) setAqiActive(true);
      if (e.layer === rain) setRainActive(true);
    });
    map.on('overlayremove', (e) => {
      if (e.layer === aqi) setAqiActive(false);
      if (e.layer === rain) setRainActive(false);
    });

    mapInstanceRef.current = map;
    markersRef.current = L.markerClusterGroup({
      maxClusterRadius: 35,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true
    }).addTo(map);

    // Leaflet renders at 0×0 while the Map tab is display:none. The tab-based UI
    // never fires the old #map hash, so the map never re-measured and "didn't
    // load". Watch the container: invalidateSize on every resize, and fit the
    // pins once it first gains real size.
    let hasSized = false;
    const settleTimers = [];
    const settleSize = () => mapInstanceRef.current?.invalidateSize({ animate: false });
    const resizeObserver = new ResizeObserver((entries) => {
      if (!mapInstanceRef.current) return;
      settleSize();
      const rect = entries[0]?.contentRect;
      if (!hasSized && rect && rect.width > 8 && rect.height > 8) {
        hasSized = true;
        // Tile grid often populates only the centre tile when the map is first
        // un-hidden. Re-measure across a few frames so the full grid fills, then
        // fit the pins once on the settled size.
        window.requestAnimationFrame(() => {
          settleSize();
          if (fitRef.current) fitRef.current();
        });
        [120, 350, 700].forEach((d) => settleTimers.push(window.setTimeout(settleSize, d)));
      }
    });
    resizeObserver.observe(mapElement);

    // Click delegation for popup buttons
    const handlePopupClick = (e) => {
      if (e.target.classList.contains('popup-view-btn')) {
        const id = e.target.getAttribute('data-id');
        const listing = listingsRef.current.find((l) => String(l.id) === String(id));
        if (listing && onCardClick) {
          onCardClick(listing);
        }
      }
    };

    mapElement.addEventListener('click', handlePopupClick);

    return () => {
      resizeObserver.disconnect();
      settleTimers.forEach((id) => window.clearTimeout(id));
      mapElement.removeEventListener('click', handlePopupClick);
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
      heatLayerRef.current = null;
      userMarkerRef.current = null;
      accuracyCircleRef.current = null;
      reachRingsRef.current = [];
    };
  }, [onCardClick]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    userMarkerRef.current?.remove();
    accuracyCircleRef.current?.remove();
    reachRingsRef.current.forEach((ring) => ring.remove());

    const [latitude, longitude] = userLocation.coords;
    const accuracyRadius = Math.max(8, Math.min(userLocation.accuracy || 0, 500));
    const tenKmRing = L.circle([latitude, longitude], {
      radius: 10_000,
      color: '#36C7FF',
      fillColor: '#36C7FF',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.025,
      interactive: false,
    }).addTo(map);
    const oneKmRing = L.circle([latitude, longitude], {
      radius: 1_000,
      color: '#FF3D8B',
      fillColor: '#FF3D8B',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.065,
      interactive: false,
    }).addTo(map);
    accuracyCircleRef.current = L.circle([latitude, longitude], {
      radius: accuracyRadius,
      color: '#F7EEF3',
      fillColor: '#F7EEF3',
      weight: 1,
      opacity: 0.45,
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(map);
    userMarkerRef.current = L.circleMarker([latitude, longitude], {
      radius: 7,
      color: '#F7EEF3',
      fillColor: '#FF3D8B',
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
      className: 'user-location-marker',
    }).bindTooltip('You are here', { permanent: true, direction: 'top', className: 'user-location-label' }).addTo(map);
    reachRingsRef.current = [tenKmRing, oneKmRing];
    map.fitBounds(tenKmRing.getBounds(), { padding: [24, 24], animate: true });
  }, [userLocation]);

  useEffect(() => {
    if (window.location.hash !== '#map' || !mapRef.current) return;
    const timeoutIds = [];
    const scrollToMap = () => {
      const section = mapRef.current?.closest('#map');
      if (!section) return;
      const targetTop = window.scrollY + section.getBoundingClientRect().top - 72;
      if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, targetTop);
      }
      document.documentElement.scrollTop = targetTop;
      document.body.scrollTop = targetTop;
      mapInstanceRef.current?.invalidateSize();
    };
    const frameId = window.requestAnimationFrame(() => {
      scrollToMap();
      [150, 600, 1200].forEach((delay) => {
        timeoutIds.push(window.setTimeout(scrollToMap, delay));
      });
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [pins.length]);

  useEffect(() => {
    if (!markersRef.current || !mapInstanceRef.current) return;
    markersRef.current.clearLayers();

    for (const { listing, coords, precision, radiusKm } of pins) {
      const availability = getAvailability(listing, nowMs);
      const marker = L.marker(coords, {
        icon: createPinIcon(listing, availability, precision),
        alt: listing.name || 'Listing location',
        title: listing.name || 'Listing location',
      });
      marker.bindPopup(buildPopupHtml(listing, precision, availability), {
        maxWidth: 260,
        className: 'listing-popup',
      });
      // An approximate pin shows its honest extent while it is being read, so
      // "somewhere in this subdistrict" is drawn as an area, not implied as a point.
      if (precision !== 'exact' && radiusKm) {
        let ring = null;
        marker.on('popupopen', () => {
          ring = L.circle(coords, {
            radius: radiusKm * 1000,
            color: '#f59e0b',
            weight: 1,
            dashArray: '4 4',
            fillColor: '#f59e0b',
            fillOpacity: 0.06,
            interactive: false,
          }).addTo(mapInstanceRef.current);
        });
        marker.on('popupclose', () => {
          if (ring) ring.remove();
          ring = null;
        });
      }
      // Tooltip on hover
      marker.bindTooltip(`<strong>${escapeHtml(listing.name || 'Unknown')}</strong>`, {
        direction: 'top',
        className: 'listing-hover-tooltip',
      });
      markersRef.current.addLayer(marker);
    }
    
    // Update mathematical density heatmap
    if (heatLayerRef.current) {
      const heatData = pins.map(p => {
        const mentions = Number(p.listing.mentionCount) || Number(p.listing.mention_count) || 1;
        // Normalize intensity
        const intensity = Math.min(mentions / 50, 1.0);
        return [p.coords[0], p.coords[1], intensity];
      });
      heatLayerRef.current.setLatLngs(heatData);
    }
  }, [nowMs, pins]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!hasFittedInitialRef.current || lastAutoFitKeyRef.current !== viewKey) {
      fitMapToPins();
      hasFittedInitialRef.current = true;
      lastAutoFitKeyRef.current = viewKey;
    }
  }, [fitMapToPins, viewKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !darkLayerRef.current || !lightLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (theme === 'light') {
      if (map.hasLayer(darkLayerRef.current)) {
        map.removeLayer(darkLayerRef.current);
      }
      lightLayerRef.current.addTo(map);
    } else {
      if (map.hasLayer(lightLayerRef.current)) {
        map.removeLayer(lightLayerRef.current);
      }
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadProvinceHiv(),
      loadFormalization().catch(() => null),
    ])
      .then(([payload, formalization]) => {
        if (cancelled) return;
        const matrix = buildHealthMatrix(payload, listingsRef.current || [], formalization);
        setEpidemicMeta(matrix.meta);
        setEpidemicRows(matrix.provinces.filter((row) => row.lat != null && row.lng != null));
      })
      .catch(() => {
        if (!cancelled) setEpidemicRows([]);
      });
    return () => { cancelled = true; };
  }, [listings]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !heatLayerRef.current) return;
    if (mapMode === 'heatmap') {
      if (!map.hasLayer(heatLayerRef.current)) {
        heatLayerRef.current.addTo(map);
      }
    } else if (map.hasLayer(heatLayerRef.current)) {
      map.removeLayer(heatLayerRef.current);
    }
  }, [mapMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (epidemicLayerRef.current) {
      map.removeLayer(epidemicLayerRef.current);
      epidemicLayerRef.current = null;
    }

    if (mapMode !== 'epidemic' || epidemicRows.length === 0) return;

    const maxCases = Math.max(...epidemicRows.map((row) => row.newCases2566 || 0), 1);
    const layer = L.layerGroup();
    epidemicRows.forEach((row) => {
      const cases = Number(row.newCases2566) || 0;
      const venues = Number(row.venueCount) || 0;
      const radius = 8 + Math.sqrt(cases / maxCases) * 28;
      const circle = L.circleMarker([row.lat, row.lng], {
        radius,
        color: venues > 0 ? '#f59e0b' : '#0e1e3c',
        weight: 1.5,
        fillColor: venues > 0 ? '#f59e0b' : '#0e1e3c',
        fillOpacity: 0.18 + (cases / maxCases) * 0.35,
      });
      circle.bindPopup(
        `<strong>${row.name}</strong><br/>`
        + `New-in-care 2566: <b>${cases.toLocaleString()}</b><br/>`
        + `Inventory venues: <b>${venues}</b><br/>`
        + `HSS certified นวด สปา: <b>${(Number(row.certifiedProviders) || 0).toLocaleString()}</b><br/>`
        + `Co-locate index: <b>${row.colocation || 0}</b><br/>`
        + `<span style="opacity:.7">Public epidemic context — not a venue risk score</span>`,
      );
      circle.on('click', () => {
        map.flyTo([row.lat, row.lng], 9, { duration: 0.8 });
      });
      layer.addLayer(circle);
    });
    layer.addTo(map);
    epidemicLayerRef.current = layer;
    map.setView([13.5, 101.2], 6);

    return () => {
      if (epidemicLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(epidemicLayerRef.current);
        epidemicLayerRef.current = null;
      }
    };
  }, [mapMode, epidemicRows]);

  const provinceMatrix = useMemo(() => {
    const counts = new Map();
    Object.keys(CITY_COORDINATES).forEach((city) => counts.set(city, 0));
    listings.forEach((listing) => {
      const city = listing.city || 'Bangkok';
      counts.set(city, (counts.get(city) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count, coords: CITY_COORDINATES[city] }));
  }, [listings]);

  const handleFlyToCoords = (coords) => {
    if (!mapInstanceRef.current || !coords) return;
    mapInstanceRef.current.flyTo(coords, 13, { duration: 1.2 });
  };

  return (
    <section className="listing-map-section" id="map">
      <div className="listing-map-header">
        <span className="section-kicker">{t.map?.kicker || 'LIVE MAP'}</span>
        <h2>{t.map?.title || 'Massage & Spa Locations'}</h2>
        <p className="listing-map-count">
          {pinSummary}
          {pendingListings.length > 0 && ` · ${pendingListings.length} pending locations`}
        </p>
        <p className="listing-map-subtitle">
          {t.map?.subtitle || 'Click a pin for details.'}
        </p>
      </div>
      <div className="listing-map-toolbar" aria-label="Map tools">
        <div className="map-toolbar-left">
          <button type="button" onClick={fitMapToPins} disabled={pins.length === 0}>
            Fit all
          </button>
          <button
            type="button"
            className={userLocation ? 'is-active' : ''}
            onClick={handleLocate}
            disabled={locating}
            aria-pressed={Boolean(userLocation)}
          >
            {locating ? 'Locating…' : userLocation ? 'Update my location' : 'Use my location'}
          </button>
        </div>
        <span className="map-live-status" aria-live="polite">
          <i className={isRefreshing ? 'is-refreshing' : ''} />
          {isRefreshing ? 'Syncing live data…' : `${formatFreshness(lastUpdatedAt, nowMs)} · ${dataSource}`}
        </span>
      </div>

      {locateError && (
        <div className="listing-map-locate-error" role="alert">{locateError}</div>
      )}
      {nearby ? (
        <div className="map-reach-dashboard" aria-label="Places within reach">
          <div className="map-position-readout">
            <span className="map-reach-label">Your position</span>
            <strong>{userLocation.coords[0].toFixed(5)}, {userLocation.coords[1].toFixed(5)}</strong>
            <small>±{Math.round(userLocation.accuracy || 0)} m accuracy · tracking while this page is open</small>
          </div>
          {[
            { key: 'oneKm', distance: '1 KM', color: 'pink' },
            { key: 'tenKm', distance: '10 KM', color: 'blue' },
          ].map(({ key, distance, color }) => {
            const summary = nearby[key];
            return (
              <div key={key} className={`map-reach-stat map-reach-stat--${color}`}>
                <span className="map-reach-label">Within {distance}</span>
                <strong>{summary.total}</strong>
                <span>{summary.available} available now · {summary.open} open</span>
                {summary.approximate > 0 && <small>{summary.approximate} area-estimated</small>}
              </div>
            );
          })}
          <div className="map-nearest-list">
            <span className="map-reach-label">Best signals within 10 km</span>
            {nearby.nearest.length > 0 ? nearby.nearest.map((pin) => (
              <button
                key={pin.listing.id}
                type="button"
                onClick={() => onCardClick?.(pin.listing)}
                className={`map-nearest-row availability-text--${pin.availability.state}`}
              >
                <span>{pin.listing.name || 'Unknown'}</span>
                <small>{pin.availability.label}</small>
                <strong>{pin.precision !== 'exact' ? '~' : ''}{formatDistance(pin.distance)}</strong>
              </button>
            )) : <small className="map-nearest-empty">No mapped places within 10 km.</small>}
          </div>
        </div>
      ) : (
        <button type="button" className="map-location-invitation" onClick={handleLocate} disabled={locating}>
          <span className="map-location-target" aria-hidden="true" />
          <span>
            <strong>{locating ? 'Finding your position…' : 'See what you can reach now'}</strong>
            <small>Allow location access to draw 1 km and 10 km zones and rank nearby availability.</small>
          </span>
        </button>
      )}
      <div
        ref={mapRef}
        className="listing-map-container"
        role="application"
        aria-label="Interactive listing map"
      >
        {userLocation && (
          <div className="reach-ring-legend" aria-label="Distance ring legend">
            <span><i className="ring-key ring-key--one" />1 km</span>
            <span><i className="ring-key ring-key--ten" />10 km</span>
          </div>
        )}
        <div className="availability-legend" aria-label="Availability legend">
          <span><i className="availability-key availability-key--available" />Available now</span>
          <span><i className="availability-key availability-key--open" />Open · check slot</span>
          <span><i className="availability-key availability-key--unknown" />Check availability</span>
          <span><i className="availability-key availability-key--closed" />Closed / unavailable</span>
        </div>
        <div className={`aqi-legend${aqiActive ? ' is-visible' : ''}`} aria-hidden={!aqiActive}>
          <span className="aqi-legend-title">PM2.5 · US-EPA AQI</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#00e400' }} />0–50  Good</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#ffff00' }} />51–100  Moderate</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#ff7e00' }} />101–150  Unhealthy (sensitive)</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#ff0000' }} />151–200  Unhealthy</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#8f3f97' }} />201+  Very unhealthy</span>
        </div>
        <div className={`rain-legend${rainActive ? ' is-visible' : ''}`} aria-hidden={!rainActive}>
          <span className="rain-legend-title">Precipitation · NASA GPM/IMERG</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#c8f0ff' }} />Light</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#4da6ff' }} />Moderate</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#0033cc' }} />Heavy</span>
          <span className="aqi-legend-row"><i className="aqi-legend-swatch" style={{ background: '#6600cc' }} />Extreme</span>
        </div>
      </div>

      {mapMode === 'epidemic' && (
        <div className="epidemic-panel">
          <p className="section-kicker">HIV / STI · open data</p>
          <p>
            Circle size = new HIV/AIDS cases entering care by domicile (Buddhist 2566 / data.go.th s_tuc2).
            Amber outline = our inventory also has venues in that province.
            Popup includes HSS certified นวด สปา counts — not a risk score for any shop or person.
          </p>
          {epidemicMeta?.caveat && <p className="epidemic-caveat">{epidemicMeta.caveat}</p>}
          <a href="/health">Open four-lens research →</a>
        </div>
      )}

      {/* Axiom 77 Provinces Grid Mode Panel */}
      {mapMode === 'provinces' && (
        <div className="province-panel">
          <div className="province-panel__head">
            <span>Province coverage</span>
            <span>Click to fly</span>
          </div>
          <div className="province-panel__grid">
            {provinceMatrix.map(({ city, count, coords }) => (
              <button
                key={city}
                type="button"
                onClick={() => handleFlyToCoords(coords)}
                className={count > 0 ? 'has-venues' : ''}
                disabled={!coords}
              >
                <span>{city}</span>
                <em className="mono">{count}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <MapMarketBar />
      <SpatialAnalyticsPanel visiblePins={pins} totalListings={listings.length} />
      {pendingListings.length > 0 && (
        <div className="listing-map-pending">
          <div className="pending-header">
            <span className="section-kicker">NOT PINNED</span>
            <p>
              {pendingListings.length} active listings name no place finer than a province, so they are
              listed here rather than given a pin that would imply a location nobody stated.
            </p>
          </div>
          <div className="pending-list">
            {pendingListings.map((listing) => {
              const telHref = formatTelLink(listing.phone);
              const lineHref = formatLineUrl(listing.lineUrl);
              const mapsHref = mapsHrefFor(listing);
              return (
                <div key={listing.id} className="pending-row">
                  <span className="pending-name">
                    <button
                      type="button"
                      className="pending-view-btn"
                      onClick={() => onCardClick?.(listing)}
                      title={`View details for ${listing.name || 'this listing'}`}
                    >
                      {listing.name || '—'}
                    </button>
                  </span>
                  <span className="pending-location">{unitLabel(listing) || listing.location || '—'}</span>
                  <span className="pending-contacts">
                    {telHref && <a href={telHref}>{formatTelDisplay(listing.phone) || listing.phone}</a>}
                    {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer">Maps</a>}
                    {lineHref && <a href={lineHref} target="_blank" rel="noreferrer">LINE</a>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
