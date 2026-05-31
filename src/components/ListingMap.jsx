import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  formatTelLink,
  formatTelDisplay,
  formatLineUrl,
  formatMapsUrl,
} from '../lib/normalization';
import MapMarketBar from './MapMarketBar';
import './ListingMap.css';

const BANGKOK_CENTER = [13.7563, 100.5018];
const DEFAULT_ZOOM = 11;
const AREA_COORDINATES = [
  // Nonthaburi / North Bangkok
  { patterns: ['เมืองทอง', 'muang thong'], coords: [13.912, 100.548] },
  { patterns: ['ปากเกร็ด', 'pak kret'], coords: [13.914, 100.504] },
  { patterns: ['บางใหญ่', 'bang yai', 'วัดลาดปลาดุก'], coords: [13.876, 100.411] },
  { patterns: ['บางกรวย', 'bang kruai'], coords: [13.805, 100.472] },
  { patterns: ['นนทบุรี', 'นนทบุร', 'nonthaburi'], coords: [13.86, 100.514] },
  { patterns: ['บางพลัด', 'bang phlat', 'บางอ้อ', 'bang o'], coords: [13.795, 100.501] },

  // Pathum Thani / Far North
  { patterns: ['รังสิต', 'rangsit'], coords: [13.99, 100.617] },
  { patterns: ['ลำลูกกา', 'lam luk ka'], coords: [13.932, 100.724] },
  { patterns: ['คลอง 4', 'คลอง4', 'คลอง6', 'คลอง 6'], coords: [13.969, 100.661] },
  { patterns: ['ดอนเมือง', 'don mueang', 'สนามบินดอนเมือง'], coords: [13.926, 100.607] },
  { patterns: ['หลักสี่', 'lak si', 'สะพานใหม่', 'saphan mai'], coords: [13.882, 100.576] },
  { patterns: ['บางเขน', 'bang khen', 'วัดพระศรีมหาธาตุ'], coords: [13.869, 100.571] },
  { patterns: ['พหลโยธิน', 'phahon yothin', 'phahonyothin'], coords: [13.826, 100.567] },

  // East / Lat Phrao / Nawamin
  { patterns: ['ลาดพร้าว', 'lat phrao', 'โชคชัย4', 'โชคชัย 4', 'สตรีวิทยา2', 'สตรีวิทยา 2'], coords: [13.81, 100.594] },
  { patterns: ['รามอินทรา', 'ramintra', 'ram intra'], coords: [13.852, 100.626] },
  { patterns: ['นวมินทร์', 'นวมินทร', 'nawamin'], coords: [13.816, 100.647] },
  { patterns: ['บึงกุ่ม', 'bueng kum'], coords: [13.790, 100.649] },
  { patterns: ['มีนบุรี', 'min buri', 'สามวา', 'sam wa'], coords: [13.814, 100.735] },
  { patterns: ['หนองจอก', 'nong chok'], coords: [13.835, 100.838] },
  { patterns: ['ลาดกระบัง', 'lat krabang'], coords: [13.728, 100.771] },
  { patterns: ['สุวรรณภูมิ', 'suvarnabhumi', 'บางพลี', 'bang phli'], coords: [13.691, 100.750] },

  // Central / Sukhumvit corridor
  { patterns: ['สุขุมวิท', 'sukhumvit', 'ทองหล่อ', 'thonglor', 'อโศก', 'asok', 'เอกมัย', 'ekkamai'], coords: [13.735, 100.566] },
  { patterns: ['รัชดา', 'ratchada', 'ห้วยขวาง', 'huai khwang'], coords: [13.773, 100.574] },
  { patterns: ['จตุจักร', 'chatuchak', 'ม.กษัตริย์ศึก', 'สวนจตุจักร'], coords: [13.799, 100.553] },
  { patterns: ['สะพานควาย', 'saphan khwai', 'อารีย์', 'ari', 'สามเสน', 'sam sen'], coords: [13.783, 100.547] },
  { patterns: ['ปทุมวัน', 'pathum wan', 'สยาม', 'siam', 'ราชประสงค์', 'ratchaprasong', 'ประตูน้ำ', 'pratunam'], coords: [13.744, 100.535] },
  { patterns: ['ดุสิต', 'dusit', 'นางเลิ้ง', 'nang loeng'], coords: [13.773, 100.519] },
  { patterns: ['พระราม9', 'พระราม 9', 'rama 9', 'rama9', 'รามา9', 'รามา 9'], coords: [13.756, 100.563] },

  // Far East / On Nut / Prawet
  { patterns: ['อ่อนนุช', 'on nut', 'on-nut'], coords: [13.704, 100.601] },
  { patterns: ['อุดมสุข', 'udom suk', 'udomsuk'], coords: [13.686, 100.616] },
  { patterns: ['ประเวศ', 'prawet'], coords: [13.698, 100.637] },
  { patterns: ['พัฒนาการ', 'phatthakan', 'pattanakan'], coords: [13.724, 100.617] },

  // South Bangkok
  { patterns: ['บางนา', 'bang na', 'แบริ่ง', 'bearing', 'สำโรง', 'samrong'], coords: [13.666, 100.612] },
  { patterns: ['สาทร', 'sathorn', 'สีลม', 'silom'], coords: [13.724, 100.529] },
  { patterns: ['บางรัก', 'bang rak', 'สี่พระยา', 'si phraya'], coords: [13.726, 100.521] },
  { patterns: ['ยานนาวา', 'yan nawa', 'yannawa'], coords: [13.705, 100.537] },
  { patterns: ['ดาวคะนอง', 'dao khanong', 'ราษฎร์บูรณะ', 'rat burana', 'ratburana'], coords: [13.673, 100.516] },
  { patterns: ['สมุทรปราการ', 'samut prakan', 'ปากน้ำ', 'pak nam', 'พระประแดง', 'phra pradaeng'], coords: [13.599, 100.600] },
  { patterns: ['บางขุนเทียน', 'bang khun thian'], coords: [13.655, 100.468] },

  // West Bangkok / Thonburi
  { patterns: ['ธนบุรี', 'thonburi', 'วงเวียนใหญ่', 'wong wian yai'], coords: [13.722, 100.491] },
  { patterns: ['ปิ่นเกล้า', 'pin klao', 'บางกอกน้อย', 'bang kok noi'], coords: [13.771, 100.485] },
  { patterns: ['ท่าพระ', 'tha phra', 'บางแค', 'bang khae'], coords: [13.712, 100.430] },
  { patterns: ['ตลิ่งชัน', 'taling chan'], coords: [13.784, 100.449] },
  { patterns: ['บางกอกใหญ่', 'bang kok yai', 'บางกอกใหญ', 'วัดอรุณ', 'wat arun'], coords: [13.743, 100.494] },

  // Outlying / Other
  { patterns: ['ศาลายา', 'salaya'], coords: [13.793, 100.322] },
  { patterns: ['สมุทรสาคร', 'samut sakhon', 'มหาชัย', 'mahachai'], coords: [13.547, 100.274] },
  { patterns: ['นครปฐม', 'nakhon pathom', 'nakhonpathom'], coords: [13.819, 100.064] },
  { patterns: ['ปทุมธานี', 'pathum thani', 'pathumthani', 'คลองหลวง', 'khlong luang'], coords: [14.020, 100.525] },
];
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
};

// NASA GPM/IMERG precipitation tiles via GIBS — no API key required.
// Date is set 3 days in the past to ensure processing is complete.
const imergDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().slice(0, 10);
})();

function createStableOffset(listing, radius = 0.012) {
  const key = String(listing?.id || listing?.phone || listing?.name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  const angle = ((hash % 360) * Math.PI) / 180;
  const distance = (((hash >>> 8) % 100) / 100) * radius;
  return [Math.sin(angle) * distance, Math.cos(angle) * distance];
}

function getApproximateCoordinates(listing) {
  const haystack = [
    listing?.name,
    listing?.location,
    listing?.city,
    listing?.description,
  ].filter(Boolean).join(' ').toLowerCase();

  const area = AREA_COORDINATES.find(({ patterns }) =>
    patterns.some((pattern) => haystack.includes(pattern.toLowerCase())),
  );
  const cityCoords = CITY_COORDINATES[listing?.city];
  // Every listing earns a pin. Matched district → tight scatter; known city →
  // medium scatter; otherwise fall back to Bangkok with a wide stable scatter
  // so unmapped supply is still visible (approximate, flagged as 'area').
  const baseCoords = area?.coords || cityCoords || BANGKOK_CENTER;
  const radius = area ? 0.008 : cityCoords ? 0.025 : 0.055;

  const [latOffset, lngOffset] = createStableOffset(listing, radius);
  return [baseCoords[0] + latOffset, baseCoords[1] + lngOffset];
}

function getListingCoordinates(listing) {
  const latitude = Number.parseFloat(listing?.latitude);
  const longitude = Number.parseFloat(listing?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { coords: [latitude, longitude], precision: 'exact' };
  }

  const approximate = getApproximateCoordinates(listing);
  if (approximate) {
    return { coords: approximate, precision: 'area' };
  }

  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPopupHtml(listing, precision) {
  const lines = [];
  lines.push(`<strong style="font-size:14px">${escapeHtml(listing.name || 'Unknown')}</strong>`);
  if (listing.location) lines.push(`<div style="font-size:11px;color:#888;margin-top:2px">${escapeHtml(listing.location)}</div>`);
  if (precision === 'area') {
    lines.push('<div style="margin-top:5px;font-size:10px;color:#9fc2ff;font-family:monospace;text-transform:uppercase">Area-level pin</div>');
  }

  const meta = [];
  if (listing.priceLabel && listing.priceLabel !== 'Rate on request') meta.push(listing.priceLabel);
  if (listing.hours) meta.push(listing.hours);
  if (meta.length > 0) lines.push(`<div style="margin-top:6px;font-weight:600;color:#FFD23D">${escapeHtml(meta.join(' · '))}</div>`);

  const links = [];
  const telHref = formatTelLink(listing.phone);
  const lineHref = formatLineUrl(listing.lineUrl);
  const mapsHref = formatMapsUrl(listing.mapsUrl, listing.latitude, listing.longitude);
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
        border-radius: 8px;
        color: #FF3D8B;
        font-family: 'Inter', sans-serif;
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

function createPinIcon(listing) {
  const mentions = Number(listing.mentionCount) || Number(listing.mention_count) || 1;
  const size = mentions > 10 ? 22 : mentions > 3 ? 16 : 10;
  return L.divIcon({
    className: `listing-pin ${getAuraClass(listing)}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 3)],
    tooltipAnchor: [size / 2 + 3, 0],
  });
}

export default function ListingMap({ listings, onCardClick, t, viewKey = 'all', theme }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const listingsRef = useRef(listings);
  const hasFittedInitialRef = useRef(false);
  const lastAutoFitKeyRef = useRef(null);
  const darkLayerRef = useRef(null);
  const lightLayerRef = useRef(null);
  const [aqiActive, setAqiActive] = useState(false);
  const [rainActive, setRainActive] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

  const { pins, pendingListings } = useMemo(() => {
    if (!Array.isArray(listings)) return { pins: [], pendingListings: [] };
    const withCoords = [];
    const withoutCoords = [];
    listings.forEach((listing) => {
      const coordinateResult = getListingCoordinates(listing);
      if (coordinateResult) withCoords.push({ listing, ...coordinateResult });
      else withoutCoords.push(listing);
    });

    // De-stack shared centroids. The scraper assigns a district/province centroid
    // when it can't geocode a precise address, so dozens of listings pile onto a
    // single coordinate (14 on Bangkok-center alone) and the map reads as "1 pin
    // for 100 listings". Spread any shared coordinate with a stable per-listing
    // offset so the real supply density becomes visible.
    const buckets = new Map();
    withCoords.forEach((pin) => {
      const key = `${pin.coords[0].toFixed(3)},${pin.coords[1].toFixed(3)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pin);
    });
    buckets.forEach((group) => {
      if (group.length <= 1) return;
      // Fixed radius — must NOT depend on group.length, or bucket sizes shifting
      // between 30s refreshes would move every pin and make the map "bounce".
      // Each listing's offset is deterministic (hash of its id), so pins are
      // stable across refreshes.
      group.forEach((pin) => {
        const [dLat, dLng] = createStableOffset(pin.listing, 0.016);
        pin.coords = [pin.coords[0] + dLat, pin.coords[1] + dLng];
        pin.precision = 'area';
      });
    });

    return { pins: withCoords, pendingListings: withoutCoords };
  }, [listings]);
  const exactPinCount = pins.filter((pin) => pin.precision === 'exact').length;
  const areaPinCount = pins.length - exactPinCount;
  const pinSummary = [
    exactPinCount > 0 ? `${exactPinCount} verified pins` : null,
    areaPinCount > 0 ? `${areaPinCount} area pins` : null,
  ].filter(Boolean).join(' · ') || '0 mapped pins';

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

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
      setLocateError('Geolocation not supported');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        if (mapInstanceRef.current) {
          const { latitude, longitude } = position.coords;
          mapInstanceRef.current.setView([latitude, longitude], 13);
          L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: '#7aa7ff',
            color: '#7aa7ff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.2,
          }).addTo(mapInstanceRef.current);
        }
      },
      (error) => {
        setLocating(false);
        setLocateError(error.message || 'Unable to retrieve location');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
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

    L.control
      .layers(
        { 'Dark Map': dark, 'Light Map': light, Satellite: satellite },
        { 'Air Quality (PM2.5)': aqi, 'Precipitation (IMERG)': rain },
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
    markersRef.current = L.layerGroup().addTo(map);

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
    };
  }, [onCardClick]);

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

    for (const { listing, coords, precision } of pins) {
      const marker = L.marker(coords, { 
        icon: createPinIcon(listing),
        alt: listing.name || 'Listing location',
        title: listing.name || 'Listing location',
      });
      marker.bindPopup(buildPopupHtml(listing, precision), {
        maxWidth: 260,
        className: 'listing-popup',
      });
      // Tooltip on hover
      marker.bindTooltip(`<strong>${escapeHtml(listing.name || 'Unknown')}</strong>`, {
        direction: 'top',
        className: 'listing-hover-tooltip',
      });
      markersRef.current.addLayer(marker);
    }
  }, [pins]);

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
      darkLayerRef.current.addTo(map);
    }
  }, [theme]);

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
          <button type="button" onClick={handleLocate} disabled={locating}>
            {locating ? 'Locating…' : 'Near me'}
          </button>
        </div>
        <span>{listings.length} listings in current view</span>
      </div>
      {locateError && (
        <div className="listing-map-locate-error">{locateError}</div>
      )}
      <div
        ref={mapRef}
        className="listing-map-container"
        role="application"
        aria-label="Interactive listing map"
      >
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
      <MapMarketBar />
      {pendingListings.length > 0 && (
        <div className="listing-map-pending">
          <div className="pending-header">
            <span className="section-kicker">PENDING LOCATION</span>
            <p>{pendingListings.length} listings are active but have no confirmed map coordinates.</p>
          </div>
          <div className="pending-list">
            {pendingListings.map((listing) => {
              const telHref = formatTelLink(listing.phone);
              const lineHref = formatLineUrl(listing.lineUrl);
              const mapsHref = formatMapsUrl(listing.mapsUrl, listing.latitude, listing.longitude);
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
                  <span className="pending-location">{listing.location || '—'}</span>
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
