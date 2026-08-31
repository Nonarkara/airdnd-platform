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
import {
  fetchCivicFlights,
  fetchCivicQuakes,
  fetchCivicFires,
  formatCivicStatus,
} from '../lib/civicLive';
import {
  readPulseFromHref,
  syncPulseToWindow,
  EMPTY_PULSE,
} from '../lib/civicLayerShare';
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

function buildPopupHtml(listing, precision, availability) {
  const lines = [];
  lines.push(`<strong style="font-size:14px">${escapeHtml(listing.name || 'Unknown')}</strong>`);
  if (listing.location) lines.push(`<div style="font-size:11px;color:#888;margin-top:2px">${escapeHtml(listing.location)}</div>`);
  if (precision === 'area') {
    lines.push('<div style="margin-top:5px;font-size:10px;color:#9fc2ff;font-family:monospace;text-transform:uppercase">Area-level pin</div>');
  }
  lines.push(`<div class="popup-availability popup-availability--${escapeHtml(availability.state)}">${escapeHtml(availability.label)}</div>`);

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

function createPinIcon(listing, availability) {
  const mentions = Number(listing.mentionCount) || Number(listing.mention_count) || 1;
  const size = mentions > 10 ? 22 : mentions > 3 ? 16 : 10;
  return L.divIcon({
    className: `listing-pin ${getAuraClass(listing)} availability-${availability.state}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 3)],
    tooltipAnchor: [size / 2 + 3, 0],
  });
}

// Longdo POI marker — small teal square with a thin amber border. The shape
// difference (square vs circle) means even users with red-green color blindness
// can tell the two datasets apart on the map.
function createLongdoIcon(poi) {
  return L.divIcon({
    className: 'longdo-pin',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
    tooltipAnchor: [10, 0],
  });
}

function buildLongdoPopupHtml(poi) {
  const name = poi.name || 'Longdo POI';
  const nameTh = poi.nameTh && poi.nameTh !== name ? `<div class="popup-sub">${escapeHtml(poi.nameTh)}</div>` : '';
  const address = poi.addressEn || poi.addressTh || poi.location || '';
  const phone = poi.phone ? `<a class="popup-tel" href="tel:${escapeHtml(poi.phone)}">${escapeHtml(poi.phone)}</a>` : '<span class="popup-na">—</span>';
  const website = poi.website
    ? `<a class="popup-link" target="_blank" rel="noreferrer" href="${escapeHtml(poi.website)}">${escapeHtml(poi.website.replace(/^https?:\/\//, ''))}</a>`
    : '<span class="popup-na">—</span>';
  return `
    <div class="longdo-popup-body">
      <div class="popup-kicker">Longdo POI · CC BY-SA 4.0</div>
      <div class="popup-title">${escapeHtml(name)}</div>
      ${nameTh}
      <div class="popup-row"><span class="popup-key">Address</span>${escapeHtml(address)}</div>
      <div class="popup-row"><span class="popup-key">Province</span>${escapeHtml(poi.city || '—')}</div>
      <div class="popup-row"><span class="popup-key">Phone</span>${phone}</div>
      <div class="popup-row"><span class="popup-key">Website</span>${website}</div>
      <div class="popup-row"><span class="popup-key">Source</span><a class="popup-link" target="_blank" rel="noreferrer" href="https://map.longdo.com/p/${escapeHtml(poi.longdoId)}">Longdo Map ↗</a></div>
      ${poi.poiType ? `<div class="popup-row"><span class="popup-key">Type</span>${escapeHtml(poi.poiType)}</div>` : ''}
    </div>
  `;
}

function createFlightIcon(aircraft) {
  const heading = Number.isFinite(aircraft.headingDeg) ? aircraft.headingDeg : 0;
  return L.divIcon({
    className: 'civic-flight-pin',
    html: `<span class="civic-flight-glyph" style="transform:rotate(${heading}deg)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function createFireIcon() {
  return L.divIcon({
    className: 'civic-fire-pin',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

function ensureCivicLayer(map, layersRef, key) {
  let layer = layersRef.current[key];
  if (!map) return null;
  if (!layer || !map.hasLayer(layer)) {
    layer = L.layerGroup().addTo(map);
    layersRef.current[key] = layer;
  }
  return layer;
}

function civicStateLabel(bundle) {
  if (!bundle) return 'off';
  if (bundle.state === 'unavailable') return 'unavailable';
  return bundle.state;
}

function buildFlightPopupHtml(aircraft, bundle) {
  const altitude = aircraft.onGround
    ? 'On the ground'
    : Number.isFinite(aircraft.altitudeM) ? `${aircraft.altitudeM} m` : '—';
  const speed = Number.isFinite(aircraft.speedKmh) ? `${aircraft.speedKmh} km/h` : '—';
  return `
    <div class="longdo-popup-body civic-popup-body">
      <div class="popup-kicker">Civic pulse · ${escapeHtml(civicStateLabel(bundle))} · adsb.lol</div>
      <div class="popup-title">${escapeHtml(aircraft.callsign)}</div>
      <div class="popup-row"><span class="popup-key">Altitude</span>${escapeHtml(altitude)}</div>
      <div class="popup-row"><span class="popup-key">Speed</span>${escapeHtml(speed)}</div>
      <div class="popup-row"><span class="popup-key">From Bangkok</span>${escapeHtml(`${aircraft.distanceKm} km`)}</div>
      <div class="popup-row"><span class="popup-key">Freshness</span>${escapeHtml(`${aircraft.seenSec.toFixed(0)}s behind transponder`)}</div>
    </div>
  `;
}

function buildQuakePopupHtml(quake, bundle) {
  const when = quake.timeMs ? new Date(quake.timeMs).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';
  const mag = Number.isFinite(quake.mag) ? `M${quake.mag.toFixed(1)}` : 'M—';
  const link = quake.url
    ? `<a class="popup-link" target="_blank" rel="noreferrer" href="${escapeHtml(quake.url)}">USGS event ↗</a>`
    : 'USGS';
  return `
    <div class="longdo-popup-body civic-popup-body">
      <div class="popup-kicker">Civic pulse · ${escapeHtml(civicStateLabel(bundle))} · USGS</div>
      <div class="popup-title">${escapeHtml(mag)} · ${escapeHtml(quake.place)}</div>
      <div class="popup-row"><span class="popup-key">Depth</span>${escapeHtml(Number.isFinite(quake.depthKm) ? `${quake.depthKm} km` : '—')}</div>
      <div class="popup-row"><span class="popup-key">From Bangkok</span>${escapeHtml(`${quake.distanceKm} km`)}</div>
      <div class="popup-row"><span class="popup-key">Time</span>${escapeHtml(when)}</div>
      <div class="popup-row"><span class="popup-key">Source</span>${link}</div>
    </div>
  `;
}

function buildFirePopupHtml(fire, bundle) {
  const when = fire.date ? String(fire.date).replace('T', ' ').replace('Z', ' UTC') : '—';
  const link = fire.link
    ? `<a class="popup-link" target="_blank" rel="noreferrer" href="${escapeHtml(fire.link)}">EONET ↗</a>`
    : 'NASA EONET';
  return `
    <div class="longdo-popup-body civic-popup-body">
      <div class="popup-kicker">Civic pulse · ${escapeHtml(civicStateLabel(bundle))} · NASA EONET</div>
      <div class="popup-title">${escapeHtml(fire.title)}</div>
      <div class="popup-row"><span class="popup-key">From Bangkok</span>${escapeHtml(`${fire.distanceKm} km`)}</div>
      <div class="popup-row"><span class="popup-key">Observed</span>${escapeHtml(when)}</div>
      <div class="popup-row"><span class="popup-key">Source</span>${link}</div>
      <div class="popup-row"><span class="popup-key">Note</span>Delayed satellite detections — not a live camera.</div>
    </div>
  `;
}

export default function ListingMap({
  listings,
  longdoPois: longdoPoisProp,
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
  const longdoMarkersRef = useRef(null);
  const civicLayersRef = useRef({ flights: null, quakes: null, fires: null });
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
  // basemap = 'carto' (default) or 'osm' (auto-fallback when Carto tiles fail).
  const [basemapStatus, setBasemapStatus] = useState({ mode: 'carto', errors: 0 });
  const [overlayError, setOverlayError] = useState(null);
  // Mirror of the basemap state for use inside the tile-error closure (avoids
  // re-creating the map effect on every state update).
  const basemapStatusRef = useRef({ mode: 'carto', theme: 'dark' });
  // Longdo POI directory (CC BY-SA 4.0). Parent owns the fetch so the
  // directory and the map share one JSON parse.
  const [fetchedPois, setFetchedPois] = useState([]);
  const longdoPois = longdoPoisProp !== undefined ? longdoPoisProp : fetchedPois;
  const [showTelegram, setShowTelegram] = useState(true);
  const [showLongdo, setShowLongdo] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [pulse, setPulse] = useState(() => (
    typeof window === 'undefined' ? { ...EMPTY_PULSE } : readPulseFromHref(window.location.href)
  ));
  const [civicBundles, setCivicBundles] = useState({ flights: null, quakes: null, fires: null });

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

  const filteredLongdoPois = useMemo(() => {
    const withCoords = (Array.isArray(longdoPois) ? longdoPois : []).filter((poi) => (
      Number.isFinite(Number(poi.latitude)) && Number.isFinite(Number(poi.longitude))
    ));
    if (!searchQuery.trim()) return withCoords;
    const q = searchQuery.trim().toLowerCase();
    return withCoords.filter((poi) => {
      const haystack = `${poi.name || ''} ${poi.nameTh || ''} ${poi.nameEn || ''} ${poi.city || ''} ${poi.addressEn || ''} ${poi.addressTh || ''} ${poi.location || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [longdoPois, searchQuery]);

  const visiblePins = useMemo(() => {
    if (!showTelegram) return [];
    if (!searchQuery.trim()) return pins;
    const q = searchQuery.trim().toLowerCase();
    return pins.filter((p) => {
      const l = p.listing || {};
      const haystack = `${l.name || ''} ${l.city || ''} ${l.location || ''} ${l.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [pins, showTelegram, searchQuery]);

  const pinSummary = [
    exactPinCount > 0 ? `${exactPinCount} verified pins` : null,
    areaPinCount > 0 ? `${areaPinCount} area pins` : null,
    filteredLongdoPois.length > 0 ? `${filteredLongdoPois.length} Longdo POIs` : null,
  ].filter(Boolean).join(' · ') || '0 mapped pins';

  const nearby = useMemo(() => {
    if (!userLocation) return null;
    const telegramRanked = (showTelegram ? pins : []).map((pin) => ({
      ...pin,
      distance: distanceKm(userLocation.coords, pin.coords),
      availability: getAvailability(pin.listing, nowMs),
    }));
    const longdoRanked = (showLongdo ? filteredLongdoPois : []).map((poi) => ({
      listing: poi,
      coords: [Number(poi.latitude), Number(poi.longitude)],
      precision: 'exact',
      distance: distanceKm(userLocation.coords, [Number(poi.latitude), Number(poi.longitude)]),
      availability: { state: 'unknown', rank: 0, label: 'Longdo POI' },
    }));
    const ranked = [...telegramRanked, ...longdoRanked].sort((left, right) => {
      const availabilityDelta = right.availability.rank - left.availability.rank;
      return availabilityDelta || left.distance - right.distance;
    });
    const summarize = (radius) => {
      const matches = ranked.filter((pin) => pin.distance <= radius);
      return {
        total: matches.length,
        available: matches.filter((pin) => pin.availability.state === 'available').length,
        open: matches.filter((pin) => pin.availability.state === 'open').length,
        approximate: matches.filter((pin) => pin.precision === 'area').length,
      };
    };
    return {
      oneKm: summarize(1),
      tenKm: summarize(10),
      nearest: ranked.filter((pin) => pin.distance <= 10).slice(0, 5),
    };
  }, [filteredLongdoPois, nowMs, pins, showLongdo, showTelegram, userLocation]);

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const togglePulseLayer = useCallback((id) => {
    setPulse((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const fitMapToPins = useCallback(() => {
    if (!mapInstanceRef.current) return;

    const telegramCoords = (showTelegram ? pins : []).map((pin) => pin.coords);
    const longdoCoords = (showLongdo ? filteredLongdoPois : [])
      .map((poi) => [Number(poi.latitude), Number(poi.longitude)]);
    const all = [...telegramCoords, ...longdoCoords];
    if (all.length === 0) {
      mapInstanceRef.current.setView(BANGKOK_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(all);
    const span = Math.max(
      bounds.getNorth() - bounds.getSouth(),
      bounds.getEast() - bounds.getWest(),
    );
    const tightCluster = span < 0.25;
    const maxFitZoom = tightCluster ? 11 : 13;
    mapInstanceRef.current.fitBounds(bounds.pad(0.25), { maxZoom: maxFitZoom, animate: false });
  }, [filteredLongdoPois, pins, showLongdo, showTelegram]);

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
    // OSM raster fallback — used automatically if Carto tiles fail (rate-limit,
    // network, or "API Key Required" from a corporate proxy). No key required.
    const osmDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      crossOrigin: true,
    });
    const osmLight = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      crossOrigin: true,
    });

    darkLayerRef.current = dark;
    lightLayerRef.current = light;

    // If Carto tiles keep failing, auto-switch to OSM raster so the basemap
    // never goes blank. Threshold: 8 errors within 30s of mount.
    const tileErrorCounters = new Map();
    let cartoErrors = 0;
    const cartoErrorWindow = [];
    const handleTileError = (label, fallback) => (e) => {
      const now = Date.now();
      const next = (tileErrorCounters.get(label) || 0) + 1;
      tileErrorCounters.set(label, next);
      if (label === 'carto') {
        cartoErrorWindow.push(now);
        while (cartoErrorWindow.length && now - cartoErrorWindow[0] > 30_000) cartoErrorWindow.shift();
        cartoErrors = cartoErrorWindow.length;
        if (cartoErrors >= 8 && basemapStatusRef.current.mode === 'carto') {
          const currentBase = basemapStatusRef.current.theme === 'light' ? light : dark;
          map.removeLayer(currentBase);
          fallback.addTo(map);
          setBasemapStatus({ mode: 'osm', errors: cartoErrors });
        }
      } else {
        if (next === 5) {
          setOverlayError(label === 'aqi' ? 'Air-quality tiles unavailable right now' : 'Precipitation tiles unavailable right now');
        }
      }
      // eslint-disable-next-line no-console
      console.warn(`[ListingMap] tile error (${label})`, e?.error || e);
    };
    dark.on('tileerror', handleTileError('carto', osmDark));
    light.on('tileerror', handleTileError('carto', osmLight));
    basemapStatusRef.current = { mode: 'carto', theme: 'dark' };

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (currentTheme === 'light') {
      light.addTo(map);
      basemapStatusRef.current.theme = 'light';
    } else {
      dark.addTo(map);
      basemapStatusRef.current.theme = 'dark';
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
    aqi.on('tileerror', handleTileError('aqi'));

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
    rain.on('tileerror', handleTileError('rain'));

    // Heatmap layer for spatial mathematics
    const heatLayer = L.heatLayer([], {
      radius: 20,
      blur: 15,
      maxZoom: 13,
      gradient: { 0.4: '#4a607a', 0.6: '#8e7a68', 0.8: '#c4a44a', 1.0: '#ffd23d' }
    });
    heatLayerRef.current = heatLayer;

    const layerControl = L.control
      .layers(
        { 'Dark Map': dark, 'Light Map': light, Satellite: satellite, 'OSM (fallback)': osmDark },
        { 'Air Quality (PM2.5)': aqi, 'Precipitation (IMERG)': rain, 'Demand Heatmap': heatLayer },
        { position: 'topright', collapsed: true },
      )
      .addTo(map);

    // Fetch infrastructure data and add layers
    fetch('/data/infrastructure.json')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;

        // Transit Corridors
        const transitGroup = L.featureGroup();
        data.transitCorridors.forEach(corridor => {
          const latlngs = corridor.stations.map(s => [s.lat, s.lng]);
          L.polyline(latlngs, {
            color: corridor.color,
            weight: 4,
            opacity: 0.8
          }).bindPopup(`<b>${corridor.line}</b><br/>${corridor.stations.length} stations`).addTo(transitGroup);

          corridor.stations.forEach(s => {
            L.circleMarker([s.lat, s.lng], {
              radius: 4,
              color: corridor.color,
              fillColor: '#fff',
              fillOpacity: 1,
              weight: 2
            }).bindPopup(`<b>${s.name}</b><br/>${corridor.line}`).addTo(transitGroup);
          });
        });
        layerControl.addOverlay(transitGroup, 'Transit Corridors');

        // Zoning Districts
        const zoningGroup = L.featureGroup();
        data.zoningDistricts.forEach(zone => {
          // Some zones carry summary metadata without a polygon outline; skip
          // them rather than crash the whole map effect.
          if (!Array.isArray(zone.polygon) || zone.polygon.length === 0) return;
          L.polygon(zone.polygon.map(p => [p.lat, p.lng]), {
            color: zone.type === 'Commercial' ? '#f59e0b' : '#3b82f6',
            weight: 2,
            opacity: 0.6,
            fillOpacity: 0.1
          }).bindPopup(`<b>${zone.name}</b><br/>${zone.type} (${zone.code})`).addTo(zoningGroup);
        });
        layerControl.addOverlay(zoningGroup, 'Municipal Zoning');
      })
      .catch(console.error);


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

    // Second cluster group for the Longdo POI layer (CC BY-SA 4.0). Slightly
    // larger cluster radius keeps the teal cluster bubbles visually distinct
    // from the Telegram ones, and a teal "Longdo" icon-color so the two
    // datasets read as different sources on the map.
    civicLayersRef.current = {
      flights: L.layerGroup().addTo(map),
      quakes: L.layerGroup().addTo(map),
      fires: L.layerGroup().addTo(map),
    };

    longdoMarkersRef.current = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="longdo-cluster"><span>${count}</span></div>`,
          className: 'longdo-cluster-wrapper',
          iconSize: L.point(40, 40),
        });
      },
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
    setMapReady(true);

    return () => {
      resizeObserver.disconnect();
      settleTimers.forEach((id) => window.clearTimeout(id));
      mapElement.removeEventListener('click', handlePopupClick);
      setMapReady(false);
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
      longdoMarkersRef.current = null;
      civicLayersRef.current = { flights: null, quakes: null, fires: null };
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

    for (const { listing, coords, precision } of visiblePins) {
      const availability = getAvailability(listing, nowMs);
      const marker = L.marker(coords, {
        icon: createPinIcon(listing, availability),
        alt: listing.name || 'Listing location',
        title: listing.name || 'Listing location',
      });
      marker.bindPopup(buildPopupHtml(listing, precision, availability), {
        maxWidth: 260,
        className: 'listing-popup',
      });
      marker.bindTooltip(`<strong>${escapeHtml(listing.name || 'Unknown')}</strong>`, {
        direction: 'top',
        className: 'listing-hover-tooltip',
      });
      markersRef.current.addLayer(marker);
    }
  }, [nowMs, visiblePins]);

  useEffect(() => {
    if (!longdoMarkersRef.current) return;
    longdoMarkersRef.current.clearLayers();
    if (!showLongdo) return;
    for (const poi of filteredLongdoPois) {
      const marker = L.marker([Number(poi.latitude), Number(poi.longitude)], {
        icon: createLongdoIcon(poi),
        alt: poi.name || 'Longdo POI',
        title: poi.name || 'Longdo POI',
      });
      marker.bindPopup(buildLongdoPopupHtml(poi), {
        maxWidth: 280,
        className: 'longdo-popup',
      });
      marker.bindTooltip(
        `<strong>${escapeHtml(poi.name || 'Longdo POI')}</strong><br><span style="opacity:.7">${escapeHtml(poi.city || '')} · Longdo</span>`,
        { direction: 'top', className: 'listing-hover-tooltip' },
      );
      longdoMarkersRef.current.addLayer(marker);
    }
  }, [filteredLongdoPois, showLongdo]);

  useEffect(() => {
    syncPulseToWindow(pulse);
  }, [pulse]);

  useEffect(() => {
    if (!pulse.flights) return undefined;
    let cancelled = false;
    const load = async () => {
      const bundle = await fetchCivicFlights();
      if (!cancelled) setCivicBundles((prev) => ({ ...prev, flights: bundle }));
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pulse.flights]);

  useEffect(() => {
    if (!pulse.quakes) return undefined;
    let cancelled = false;
    const load = async () => {
      const bundle = await fetchCivicQuakes();
      if (!cancelled) setCivicBundles((prev) => ({ ...prev, quakes: bundle }));
    };
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pulse.quakes]);

  useEffect(() => {
    if (!pulse.fires) return undefined;
    let cancelled = false;
    const load = async () => {
      const bundle = await fetchCivicFires();
      if (!cancelled) setCivicBundles((prev) => ({ ...prev, fires: bundle }));
    };
    load();
    const timer = window.setInterval(load, 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pulse.fires]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = ensureCivicLayer(map, civicLayersRef, 'flights');
    if (!layer) return;
    layer.clearLayers();
    if (!pulse.flights || !civicBundles.flights?.items) return;
    for (const aircraft of civicBundles.flights.items) {
      const marker = L.marker([aircraft.lat, aircraft.lon], {
        icon: createFlightIcon(aircraft),
        alt: aircraft.callsign,
        title: aircraft.callsign,
        zIndexOffset: 400,
      });
      marker.bindPopup(buildFlightPopupHtml(aircraft, civicBundles.flights), {
        maxWidth: 280,
        className: 'longdo-popup',
      });
      layer.addLayer(marker);
    }
  }, [civicBundles.flights, mapReady, pulse.flights]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = ensureCivicLayer(map, civicLayersRef, 'quakes');
    if (!layer) return;
    layer.clearLayers();
    if (!pulse.quakes || !civicBundles.quakes?.items) return;
    for (const quake of civicBundles.quakes.items) {
      const mag = Number.isFinite(quake.mag) ? quake.mag : 2.5;
      const marker = L.circleMarker([quake.lat, quake.lon], {
        radius: Math.max(5, mag * 3),
        color: '#A51931',
        weight: 1,
        fillColor: '#A51931',
        fillOpacity: 0.35,
      });
      marker.bindPopup(buildQuakePopupHtml(quake, civicBundles.quakes), {
        maxWidth: 280,
        className: 'longdo-popup',
      });
      layer.addLayer(marker);
    }
  }, [civicBundles.quakes, mapReady, pulse.quakes]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = ensureCivicLayer(map, civicLayersRef, 'fires');
    if (!layer) return;
    layer.clearLayers();
    if (!pulse.fires || !civicBundles.fires?.items) return;
    for (const fire of civicBundles.fires.items) {
      const marker = L.marker([fire.lat, fire.lon], {
        icon: createFireIcon(),
        alt: fire.title,
        title: fire.title,
        zIndexOffset: 350,
      });
      marker.bindPopup(buildFirePopupHtml(fire, civicBundles.fires), {
        maxWidth: 280,
        className: 'longdo-popup',
      });
      layer.addLayer(marker);
    }
  }, [civicBundles.fires, mapReady, pulse.fires]);

  useEffect(() => {
    if (!heatLayerRef.current) return;
    const heatData = [];
    for (const p of visiblePins) {
      const mentions = Number(p.listing.mentionCount) || Number(p.listing.mention_count) || 1;
      heatData.push([p.coords[0], p.coords[1], Math.min(mentions / 50, 1.0)]);
    }
    if (showLongdo) {
      for (const poi of filteredLongdoPois) {
        heatData.push([Number(poi.latitude), Number(poi.longitude), 0.5]);
      }
    }
    heatLayerRef.current.setLatLngs(heatData);
  }, [filteredLongdoPois, showLongdo, visiblePins]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!hasFittedInitialRef.current || lastAutoFitKeyRef.current !== viewKey) {
      fitMapToPins();
      hasFittedInitialRef.current = true;
      lastAutoFitKeyRef.current = viewKey;
    }
  }, [fitMapToPins, viewKey]);

  // Fallback fetch only when the parent did not pass the snapshot.
  useEffect(() => {
    if (longdoPoisProp !== undefined) return undefined;
    let cancelled = false;
    fetch('/data/longdo_pois.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setFetchedPois(Array.isArray(data.pois) ? data.pois : []);
      })
      .catch(() => {
        if (!cancelled) setFetchedPois([]);
      });
    return () => {
      cancelled = true;
    };
  }, [longdoPoisProp]);

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
    (Array.isArray(longdoPois) ? longdoPois : []).forEach((poi) => {
      const city = poi.city || 'Thailand';
      counts.set(city, (counts.get(city) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count, coords: CITY_COORDINATES[city] }));
  }, [listings, longdoPois]);

  const handleFlyToCoords = (coords) => {
    if (!mapInstanceRef.current || !coords) return;
    mapInstanceRef.current.flyTo(coords, 13, { duration: 1.2 });
  };

  // Quick-jump cities for the toolbar chips. Counts come from the live data so
  // a chip with "0" gets dimmed — the user immediately knows which cities have
  // coverage and which don't.
  const QUICK_CITIES = [
    { key: 'Bangkok', label: 'Bangkok', count: 0 },
    { key: 'Nonthaburi', label: 'Nonthaburi', count: 0 },
    { key: 'Chiang Mai', label: 'Chiang Mai', count: 0 },
    { key: 'Chonburi', label: 'Pattaya', count: 0 },
    { key: 'Phuket', label: 'Phuket', count: 0 },
    { key: 'Khon Kaen', label: 'Khon Kaen', count: 0 },
  ];
  const quickCityCounts = [...pins, ...filteredLongdoPois].reduce((acc, item) => {
    const city = item.listing?.city || item.city;
    if (city) acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});
  const quickCityData = QUICK_CITIES.map((c) => ({
    ...c,
    coords: CITY_COORDINATES[c.key],
    count: quickCityCounts[c.key] || 0,
  }));

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
          <button type="button" onClick={fitMapToPins} disabled={pins.length === 0 && filteredLongdoPois.length === 0}>
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

      <div className="listing-map-datasources" aria-label="Data source filter">
        <span className="map-quickjump-label">{t.filters.dataSource || 'Source'}</span>
        <button
          type="button"
          className={`map-source-chip${showTelegram ? ' is-active' : ''}`}
          onClick={() => setShowTelegram((v) => !v)}
          aria-pressed={showTelegram}
        >
          <i className="map-source-swatch map-source-swatch--telegram" />
          {t.filters.sourceTelegram || 'Telegram broadcasts'}
          <span className="map-source-count">{pins.length}</span>
        </button>
        <button
          type="button"
          className={`map-source-chip${showLongdo ? ' is-active' : ''}`}
          onClick={() => setShowLongdo((v) => !v)}
          aria-pressed={showLongdo}
        >
          <i className="map-source-swatch map-source-swatch--longdo" />
          {t.filters.sourceLongdo || 'Longdo POI directory'}
          <span className="map-source-count">{longdoPois.length}</span>
        </button>
        <div className="map-source-search">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.filters.searchPlaceholder || 'Search name, province, address…'}
            aria-label={t.filters.searchLabel || 'Search'}
          />
          {searchQuery && (
            <button
              type="button"
              className="map-source-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          {(searchQuery || (!showTelegram && !showLongdo)) && (
            <span className="map-source-result-count">
              {visiblePins.length + filteredLongdoPois.length} match{visiblePins.length + filteredLongdoPois.length === 1 ? '' : 'es'}
            </span>
          )}
        </div>
      </div>

      <div className="listing-map-datasources listing-map-civic" aria-label="Civic live pulse">
        <span className="map-quickjump-label">Civic pulse</span>
        <button
          type="button"
          className={`map-source-chip${pulse.flights ? ' is-active' : ''}`}
          onClick={() => togglePulseLayer('flights')}
          aria-pressed={pulse.flights}
          title={pulse.flights ? formatCivicStatus(civicBundles.flights) : 'Aircraft within 50 NM of Bangkok · adsb.lol'}
        >
          <i className="map-source-swatch map-source-swatch--flights" />
          Flights
          <span className="map-source-count">
            {pulse.flights ? (civicBundles.flights ? civicBundles.flights.count : '…') : '—'}
          </span>
        </button>
        <button
          type="button"
          className={`map-source-chip${pulse.quakes ? ' is-active' : ''}`}
          onClick={() => togglePulseLayer('quakes')}
          aria-pressed={pulse.quakes}
          title={pulse.quakes ? formatCivicStatus(civicBundles.quakes) : 'USGS M2.5+ last 24h within 3,500 km'}
        >
          <i className="map-source-swatch map-source-swatch--quakes" />
          Quakes
          <span className="map-source-count">
            {pulse.quakes ? (civicBundles.quakes ? civicBundles.quakes.count : '…') : '—'}
          </span>
        </button>
        <button
          type="button"
          className={`map-source-chip${pulse.fires ? ' is-active' : ''}`}
          onClick={() => togglePulseLayer('fires')}
          aria-pressed={pulse.fires}
          title={pulse.fires ? formatCivicStatus(civicBundles.fires) : 'NASA EONET wildfires in the haze corridor · 14 days'}
        >
          <i className="map-source-swatch map-source-swatch--fires" />
          Fires
          <span className="map-source-count">
            {pulse.fires ? (civicBundles.fires ? civicBundles.fires.count : '…') : '—'}
          </span>
        </button>
        <span className="civic-pulse-note">
          {pulse.flights || pulse.quakes || pulse.fires
            ? [
              pulse.flights && `Flights ${civicBundles.flights ? formatCivicStatus(civicBundles.flights) : 'fetching'}`,
              pulse.quakes && `Quakes ${civicBundles.quakes ? formatCivicStatus(civicBundles.quakes) : 'fetching'}${civicBundles.quakes?.count === 0 && civicBundles.quakes?.nearest ? ` · nearest M${civicBundles.quakes.nearest.mag} ${civicBundles.quakes.nearest.place}` : ''}`,
              pulse.fires && `Fires ${civicBundles.fires ? formatCivicStatus(civicBundles.fires) : 'fetching'}${civicBundles.fires?.staleWithheld ? ` · ${civicBundles.fires.staleWithheld} stale withheld` : ''}`,
            ].filter(Boolean).join(' · ')
            : 'adsb.lol · USGS · NASA EONET · no API key · live / delayed / unavailable'}
        </span>
      </div>

      <div className="listing-map-quickjump" aria-label="Quick city navigation">
        <span className="map-quickjump-label">Jump to</span>
        {quickCityData.map((city) => (
          <button
            key={city.key}
            type="button"
            className={`map-quickjump-chip${city.count > 0 ? ' has-data' : ''}`}
            onClick={() => handleFlyToCoords(city.coords)}
            disabled={!city.coords}
            title={`${city.label} · ${city.count} venue${city.count === 1 ? '' : 's'}`}
          >
            <span className="map-quickjump-name">{city.label}</span>
            <span className="map-quickjump-count">{city.count}</span>
          </button>
        ))}
      </div>

      {basemapStatus.mode === 'osm' && (
        <div className="listing-map-fallback-note" role="status">
          Carto tiles unreachable — basemap switched to <strong>OpenStreetMap</strong> automatically. No API key required for any layer shown here.
        </div>
      )}
      {overlayError && (
        <div className="listing-map-fallback-note" role="status">
          {overlayError}. Layer turned off — base map unaffected.
        </div>
      )}

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
                <strong>{pin.precision === 'area' ? '~' : ''}{formatDistance(pin.distance)}</strong>
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
        <div className="data-source-legend" aria-label="Data source legend">
          <span><i className="map-source-swatch map-source-swatch--telegram" />Telegram broadcasts ({pins.length})</span>
          <span><i className="map-source-swatch map-source-swatch--longdo" />Longdo POI · CC BY-SA 4.0 ({longdoPois.length})</span>
          {(pulse.flights || pulse.quakes || pulse.fires) && (
            <>
              {pulse.flights && <span><i className="map-source-swatch map-source-swatch--flights" />Flights · adsb.lol</span>}
              {pulse.quakes && <span><i className="map-source-swatch map-source-swatch--quakes" />Quakes · USGS</span>}
              {pulse.fires && <span><i className="map-source-swatch map-source-swatch--fires" />Fires · NASA EONET</span>}
            </>
          )}
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
        <div className="map-architecture-strip" aria-label="Map architecture">
          <span className="map-architecture-pill">
            <i className="map-architecture-dot map-architecture-dot--carto" />Basemap · {basemapStatus.mode === 'osm' ? 'OpenStreetMap (fallback)' : 'CARTO'}
          </span>
          <span className="map-architecture-pill" aria-live="polite">
            <i className={`map-architecture-dot${aqiActive ? ' is-on' : ''}`} />AQI {aqiActive ? 'on' : 'off'}
          </span>
          <span className="map-architecture-pill" aria-live="polite">
            <i className={`map-architecture-dot${rainActive ? ' is-on' : ''}`} />Rain {rainActive ? 'on' : 'off'}
          </span>
          {pulse.flights && (
            <span className="map-architecture-pill" aria-live="polite">
              <i className="map-architecture-dot is-on" />Flights {formatCivicStatus(civicBundles.flights)}
            </span>
          )}
          {pulse.quakes && (
            <span className="map-architecture-pill" aria-live="polite">
              <i className="map-architecture-dot is-on" />Quakes {formatCivicStatus(civicBundles.quakes)}
            </span>
          )}
          {pulse.fires && (
            <span className="map-architecture-pill" aria-live="polite">
              <i className="map-architecture-dot is-on" />Fires {formatCivicStatus(civicBundles.fires)}
            </span>
          )}
          <span className="map-architecture-pill map-architecture-reassure">
            <i className="map-architecture-dot map-architecture-dot--ok" />No API key required for any layer
          </span>
          {longdoPois.length > 0 && (
            <a
              className="map-architecture-pill map-architecture-attrib"
              href="https://map.longdo.com"
              target="_blank"
              rel="noreferrer"
              title="POI data from Longdo Map under CC BY-SA 4.0"
            >
              <i className="map-source-swatch map-source-swatch--longdo" />POI data: Longdo Map · CC BY-SA 4.0
            </a>
          )}
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
