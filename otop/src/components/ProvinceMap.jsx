import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PROVINCES } from '../../core/provinces.js';
import { tallyByTambon } from '../../core/tambon_tally.js';

/**
 * Supply geography — province circles on a base map.
 *
 * ── Why circles at capitals, and not pins at producers ─────────────────────
 *
 * The OTOP registry records almost no producer coordinates (0.4%). Geocoding
 * 100,000 Thai village addresses would invent point-level precision the source
 * never had, and a pin dropped on a map is read as a verified location.
 *
 * What the source DOES assert, for 88% of records, is the ตำบล. A tambon is an
 * administrative unit with a known centroid (otop_tambons.json, from Thailand
 * Canonical Admin Names, CC BY 4.0). Drawing the record at that centroid is
 * drawing the unit the record itself named, at the precision it already has.
 *
 * So two layers, two honest resolutions: province circles at the capital for
 * the overview (zoomed out), tambon dots once the reader zooms in past 7.
 * Neither is a producer location, and the caption says so.
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

const TAMBON_ZOOM = 7;
const MAX_TAMBON_DOTS = 1500;

export default function ProvinceMap({ basins, records = [], onSelectProvince, degraded }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tambonLayerRef = useRef(null);
  const selectRef = useRef(onSelectProvince);
  const [tambons, setTambons] = useState(null);

  // The tambon reference is ~600KB and only the map wants it: fetch once,
  // after mount, and render nothing tambon-shaped until it arrives.
  useEffect(() => {
    let live = true;
    fetch('/otop_tambons.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.tambons) setTambons(new Map(d.tambons.map((t) => [t.code, t]))); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

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
    tambonLayerRef.current = L.layerGroup(); // attached only past TAMBON_ZOOM
    layerRef.current = L.layerGroup().addTo(map);
    map.on('zoomend', () => {
      const tl = tambonLayerRef.current;
      if (!tl) return;
      if (map.getZoom() >= TAMBON_ZOOM) { if (!map.hasLayer(tl)) tl.addTo(map); }
      else if (map.hasLayer(tl)) map.removeLayer(tl);
    });

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
      tambonLayerRef.current = null;
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

  // Tambon dots: matching records grouped by the tambon they name.
  useEffect(() => {
    const layer = tambonLayerRef.current;
    if (!layer || !tambons) return;
    layer.clearLayers();
    const { rows, maxN } = tallyByTambon(records, { max: MAX_TAMBON_DOTS });
    for (const t of rows) {
      const ref = tambons.get(t.code);
      if (!ref) continue;
      L.circleMarker([ref.lat, ref.lng], {
        radius: 3 + 7 * Math.sqrt(t.n / maxN),
        color: t.reachable > 0 ? '#f59e0b' : '#0e1e3c',
        weight: 1,
        fillColor: '#0e1e3c',
        fillOpacity: 0.55,
      })
        .bindPopup(
          `<strong>ต.${ref.th}</strong> <span style="color:#736f66">${ref.en}</span><br/>` +
            `อ.${ref.districtTh ?? ''} · ${t.n} matching producer${t.n === 1 ? '' : 's'} · ${t.reachable} contactable<br/>` +
            `<span style="color:#736f66">placed at the tambon centroid, not an address</span>`,
        )
        .addTo(layer);
    }
  }, [records, tambons]);

  const { placeable } = tallyByTambon(records, { max: 0 });

  return (
    <figure className="map-fig">
      <div className="map" ref={containerRef} role="application" aria-label="Supply depth by province" />
      <figcaption className="map-cap">
        Circles sit at each <strong>provincial capital</strong> and represent the whole province, sized by
        matching supply depth; an amber ring marks three or more matching producers. Zoom in past level {TAMBON_ZOOM} and
        the map switches to <strong>tambon dots</strong>: {placeable.toLocaleString()} of {records.length.toLocaleString()} matching
        records name their ตำบล and are drawn at that tambon&rsquo;s centroid (Thailand Canonical Admin Names, CC BY 4.0).
        Neither layer is a producer address — the registry records coordinates for 0.4% of producers — and an amber
        rim on a dot means at least one producer there is contactable.
        {degraded && ' Positions are real; the counts behind them are synthetic fixture data.'}
      </figcaption>
    </figure>
  );
}
