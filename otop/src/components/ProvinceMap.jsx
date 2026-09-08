import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PROVINCES } from '../../core/provinces.js';

/**
 * Supply geography — province circles on a base map.
 *
 * ── Why circles at capitals, and not pins at producers ─────────────────────
 *
 * The OTOP registry records no producer coordinates. Not "some are missing" —
 * none. Geocoding 100,000 Thai village addresses would invent point-level
 * precision the source never had, and a pin dropped on a map is read as a
 * verified location, which it would not be.
 *
 * So the unit drawn is the province, positioned at its capital (อำเภอเมือง),
 * sized by matching supply depth. That is exactly the resolution the data
 * actually supports, and it happens to be the resolution a B2B sourcing
 * decision is made at anyway — you choose a province to visit, then a producer.
 * The caption states this rather than leaving the reader to assume otherwise.
 *
 * ── The Leaflet trap this avoids ───────────────────────────────────────────
 *
 * A Leaflet map instantiated inside a container that is display:none, or that
 * resizes after mount, renders at 0x0 and never recovers on its own
 * (tasks/lessons.md · 2026-05-31). A ResizeObserver calling invalidateSize on
 * every resize is the canonical fix and is wired in from the start here rather
 * than after someone reports "the map didn't load".
 */
const BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

export default function ProvinceMap({ basins, onSelectProvince, degraded }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const selectRef = useRef(onSelectProvince);

  // Keep the click handler current without tearing down the map on every render.
  useEffect(() => { selectRef.current = onSelectProvince; }, [onSelectProvince]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [13.2, 101.0],
      zoom: 5,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      minZoom: 4,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    // A couple of settle passes: fonts and the surrounding grid can change the
    // container's height just after mount.
    const timers = [60, 250, 700].map((ms) => setTimeout(() => map.invalidateSize(), ms));

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (basins.length === 0) return;

    const maxDepth = Math.max(...basins.map((b) => b.depth));
    const points = [];

    for (const basin of basins) {
      const province = BY_CODE.get(basin.code);
      if (!province) continue;

      // Area, not radius, scales with depth — a radius-linear circle
      // overstates a large province by the square of its lead.
      const radius = 6 + 22 * Math.sqrt(basin.depth / maxDepth);
      points.push([province.lat, province.lng]);

      const marker = L.circleMarker([province.lat, province.lng], {
        radius,
        // One accent. Ink fill for the mark, amber ring only where the province
        // clears the depth that makes it a genuine sourcing basin.
        color: basin.depth >= 3 ? '#f59e0b' : '#0e1e3c',
        weight: basin.depth >= 3 ? 2 : 1,
        fillColor: '#0e1e3c',
        fillOpacity: 0.35,
      });

      marker.bindPopup(
        `<strong>${province.th}</strong> <span style="color:#736f66">${province.en}</span><br/>` +
          `${basin.depth} matching producers · ${basin.reachable} contactable · ${basin.graded4Plus} at OPC 4★+<br/>` +
          `<span style="color:#736f66">across ${basin.districts} district(s) · mean fit ${basin.meanScore}</span>`,
      );
      marker.on('click', () => selectRef.current?.(basin.code));
      marker.addTo(layer);
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: false, maxZoom: 9 });
    }
  }, [basins]);

  return (
    <figure className="map-fig">
      <div className="map" ref={containerRef} role="application" aria-label="Supply depth by province" />
      <figcaption className="map-cap">
        Circles sit at each <strong>provincial capital</strong> and represent the whole province, sized by
        matching supply depth. The registry records <strong>no producer coordinates</strong>, so these are
        not producer locations. An amber ring marks a province holding three or more matching producers.
        {degraded && ' Positions are real; the counts behind them are synthetic fixture data.'}
      </figcaption>
    </figure>
  );
}
