import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ListingMap.css';

const BANGKOK_CENTER = [13.7563, 100.5018];
const DEFAULT_ZOOM = 11;

const AREA_CENTROIDS = {
  sukhumvit: [13.7380, 100.5610],
  thonglor: [13.7300, 100.5780],
  silom: [13.7280, 100.5230],
  ratchada: [13.7690, 100.5740],
  ladprao: [13.8167, 100.5614],
  rama2: [13.6540, 100.4760],
  rama9: [13.7400, 100.5830],
  bangna: [13.6630, 100.6200],
  bangkapi: [13.7630, 100.6390],
  chatuchak: [13.8000, 100.5530],
  pattaya: [12.9236, 100.8825],
  chiangmai: [18.7883, 98.9853],
  phuket: [7.8804, 98.3923],
  rayong: [12.6814, 101.2817],
  nonthaburi: [13.8622, 100.5134],
  ramintra: [13.8400, 100.6200],
  bangkruai: [13.8100, 100.4750],
  serithai: [13.7700, 100.6550],
  hathairat: [13.8550, 100.6350],
};

const AREA_PATTERNS = [
  { key: 'sukhumvit', patterns: ['สุขุมวิท', 'sukhumvit', 'asoke', 'อโศก', 'nana', 'นานา', 'phrom phong', 'พร้อมพงษ์'] },
  { key: 'thonglor', patterns: ['ทองหล่อ', 'thonglor', 'thong lo', 'ekkamai', 'เอกมัย'] },
  { key: 'silom', patterns: ['สีลม', 'silom', 'สาทร', 'sathorn', 'sala daeng', 'ศาลาแดง'] },
  { key: 'ratchada', patterns: ['รัชดา', 'ratchada', 'huai khwang', 'ห้วยขวาง', 'din daeng', 'ดินแดง'] },
  { key: 'ladprao', patterns: ['ลาดพร้าว', 'ladprao', 'lat phrao', 'โชคชัย', 'chokchai'] },
  { key: 'rama2', patterns: ['พระราม 2', 'พระราม2', 'rama 2', 'rama2'] },
  { key: 'rama9', patterns: ['พระราม 9', 'พระราม9', 'rama 9', 'rama9', 'ramkhamhaeng', 'รามคำแหง'] },
  { key: 'bangna', patterns: ['บางนา', 'bang na', 'bangna', 'bearing', 'แบริ่ง', 'srinakarin', 'ศรีนครินทร์'] },
  { key: 'bangkapi', patterns: ['บางกะปิ', 'bangkapi', 'bang kapi'] },
  { key: 'chatuchak', patterns: ['จตุจักร', 'chatuchak', 'lat yao', 'ลาดยาว', 'phahon', 'พหล'] },
  { key: 'pattaya', patterns: ['พัทยา', 'pattaya', 'ชลบุรี', 'chonburi', 'jomtien'] },
  { key: 'chiangmai', patterns: ['เชียงใหม่', 'chiang mai', 'chiangmai'] },
  { key: 'phuket', patterns: ['ภูเก็ต', 'phuket', 'patong'] },
  { key: 'rayong', patterns: ['ระยอง', 'rayong'] },
  { key: 'nonthaburi', patterns: ['นนทบุรี', 'nonthaburi', 'nontaburi', 'ปากเกร็ด', 'pak kret', 'บางกรวย', 'bang kruai'] },
  { key: 'ramintra', patterns: ['รามอินทรา', 'ramintra', 'ram intra', 'คู้บอน'] },
  { key: 'serithai', patterns: ['เสรีไทย', 'serithai', 'seri thai'] },
  { key: 'hathairat', patterns: ['หทัยราษฎร์', 'hathairat', 'hathai rat', 'ลำลูกกา', 'lam luk ka'] },
];

function jitter() {
  return (Math.random() - 0.5) * 0.004;
}

function getListingCoordinates(listing) {
  // Tier 1: Use stored coordinates
  if (listing.latitude && listing.longitude) {
    return [listing.latitude, listing.longitude];
  }

  // Tier 2: Match area from location text
  const searchText = `${listing.location || ''} ${listing.city || ''} ${listing.description || ''}`.toLowerCase();
  for (const area of AREA_PATTERNS) {
    for (const pattern of area.patterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        const centroid = AREA_CENTROIDS[area.key];
        if (centroid) {
          return [centroid[0] + jitter(), centroid[1] + jitter()];
        }
      }
    }
  }

  // Tier 3: Default Bangkok center with jitter
  return [BANGKOK_CENTER[0] + jitter(), BANGKOK_CENTER[1] + jitter()];
}

function buildPopupHtml(listing) {
  const lines = [];
  lines.push(`<strong style="font-size:14px">${listing.name || 'Unknown'}</strong>`);
  if (listing.location) lines.push(`<div style="font-size:11px;color:#888;margin-top:2px">${listing.location}</div>`);

  const meta = [];
  if (listing.priceLabel && listing.priceLabel !== 'Rate on request') meta.push(listing.priceLabel);
  if (listing.hours) meta.push(listing.hours);
  if (meta.length > 0) lines.push(`<div style="margin-top:6px;font-weight:600;color:#c4a44a">${meta.join(' · ')}</div>`);

  const links = [];
  if (listing.phone) links.push(`<a href="tel:${listing.phone.replace(/[^\d+]/g, '')}" style="color:#c8102e">Tel</a>`);
  if (listing.lineUrl) links.push(`<a href="${listing.lineUrl}" target="_blank" style="color:#06c755">LINE</a>`);
  if (listing.mapsUrl) links.push(`<a href="${listing.mapsUrl}" target="_blank" style="color:#4285f4">Maps</a>`);
  if (links.length > 0) lines.push(`<div style="margin-top:6px;display:flex;gap:10px;font-size:12px;font-weight:600">${links.join('')}</div>`);

  if (listing.sourceChannel) lines.push(`<div style="margin-top:6px;font-size:10px;color:#666">${listing.sourceChannel}</div>`);

  return lines.join('');
}

// Custom red circle marker icon
const pinIcon = L.divIcon({
  className: 'listing-pin',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

export default function ListingMap({ listings, t }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);

  const pins = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    return listings.map((listing) => ({
      listing,
      coords: getListingCoordinates(listing),
    }));
  }, [listings]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: BANGKOK_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current || !mapInstanceRef.current) return;
    markersRef.current.clearLayers();

    for (const { listing, coords } of pins) {
      const marker = L.marker(coords, { icon: pinIcon });
      marker.bindPopup(buildPopupHtml(listing), {
        maxWidth: 260,
        className: 'listing-popup',
      });
      markersRef.current.addLayer(marker);
    }
  }, [pins]);

  return (
    <section className="listing-map-section">
      <div className="listing-map-header">
        <span className="section-kicker">{t.map?.kicker || 'LIVE MAP'}</span>
        <h2>{t.map?.title || 'Massage & Spa Locations'}</h2>
        <p className="listing-map-subtitle">
          {pins.length} {t.map?.subtitle || 'places mapped across Thailand. Click a pin for details.'}
        </p>
      </div>
      <div ref={mapRef} className="listing-map-container" />
    </section>
  );
}
