import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './OtopMap.css';

const THAILAND_CENTER = [13.2, 101.0];
const DEFAULT_ZOOM = 6;

// Marks are sized by area, not radius — a province with 4× the datasets should
// look 4× as heavy, and radius-scaling would make it look 16×.
function markRadius(count, max) {
  if (!count) return 4;
  const scaled = Math.sqrt(count / Math.max(1, max));
  return 5 + scaled * 22;
}

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

export default function OtopMap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/otop_coverage.json')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const maxCount = useMemo(
    () => (data ? Math.max(1, ...data.provinces.map((p) => p.datasets)) : 1),
    [data],
  );

  // Map init — once, when data first arrives.
  useEffect(() => {
    if (!data || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: THAILAND_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 12,
      minZoom: 5,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, [data]);

  // Draw marks. Silence is the subject of this map, so silent provinces get a
  // hollow ring rather than no mark at all — an absent dot reads as an oversight.
  useEffect(() => {
    if (!data || !layerRef.current) return;
    layerRef.current.clearLayers();

    for (const p of data.provinces) {
      const silent = p.datasets === 0;
      const marker = L.circleMarker(p.coords, {
        radius: markRadius(p.datasets, maxCount),
        color: silent ? '#dc2626' : '#f59e0b',
        weight: silent ? 1 : 0,
        fillColor: '#f59e0b',
        fillOpacity: silent ? 0 : 0.55,
        interactive: true,
      });
      marker.bindTooltip(
        `<strong>${p.th}</strong> ${p.en}<br>${silent ? 'no datasets published' : `${p.datasets} datasets · ${p.resources} files`}`,
        { direction: 'top', opacity: 0.95 },
      );
      marker.on('click', () => setSelected(p.code));
      marker.addTo(layerRef.current);
    }
  }, [data, maxCount]);

  // Pan to the selected province when chosen from the list.
  useEffect(() => {
    if (!selected || !mapRef.current || !data) return;
    const p = data.provinces.find((x) => x.code === selected);
    if (p) mapRef.current.panTo(p.coords, { animate: true });
  }, [selected, data]);

  if (error) {
    return (
      <div className="otop">
        <div className="otop-empty">
          <p>No coverage layer yet — <code>public/otop_coverage.json</code> is missing.</p>
          <p>Build it with:</p>
          <p><code>node scripts/otop_catalog.js && node scripts/build_otop_coverage.js</code></p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="otop"><div className="otop-empty">Loading coverage…</div></div>;

  const s = data.summary;
  const detail = selected ? data.provinces.find((p) => p.code === selected) : null;

  return (
    <div className="otop">
      <header className="otop-head">
        <h1>OTOP · data coverage</h1>
        <p>
          Every OTOP dataset published to Thailand&rsquo;s open-data portals, resolved to the
          province that published it. Filled marks are provinces with published data; hollow
          rings are provinces that have published none. The gaps are the finding.
        </p>
      </header>

      <dl className="otop-stats">
        <div className="otop-stat">
          <dt>Datasets</dt><dd>{fmt(s.datasets)}</dd>
        </div>
        <div className="otop-stat">
          <dt>Files</dt><dd>{fmt(s.resources)}</dd>
        </div>
        <div className="otop-stat">
          <dt>Machine-readable</dt>
          <dd>{(s.machine_readable_share * 100).toFixed(0)}<span className="unit">%</span></dd>
        </div>
        <div className="otop-stat">
          <dt>Provinces covered</dt>
          <dd>{s.provinces_covered}<span className="unit">/ 77</span></dd>
        </div>
        <div className={`otop-stat${s.provinces_silent > 0 ? ' is-alarm' : ''}`}>
          <dt>Provinces silent</dt><dd>{fmt(s.provinces_silent)}</dd>
        </div>
        <div className="otop-stat">
          <dt>National scope</dt><dd>{fmt(s.national_scope_datasets)}</dd>
        </div>
      </dl>

      <div className="otop-legend">
        <span><i className="filled" /> published data — area &prop; dataset count</span>
        <span><i className="hollow" /> nothing published</span>
      </div>

      <div className="otop-body">
        <div className="otop-canvas" ref={containerRef} />

        <aside className="otop-side">
          {detail && (
            <div className="otop-detail">
              <h3>{detail.th} <span style={{ color: '#737373', fontWeight: 300 }}>{detail.en}</span></h3>
              <p className="sub">
                {detail.region_th} · {detail.datasets} datasets · {detail.resources} files
                {detail.latest_modified ? ` · updated ${detail.latest_modified.slice(0, 10)}` : ''}
              </p>
              <ul>
                {detail.samples.length
                  ? detail.samples.map((sample) => (
                      <li key={sample.url}>
                        <a href={sample.url} target="_blank" rel="noreferrer">{sample.title}</a>
                      </li>
                    ))
                  : <li style={{ color: '#dc2626' }}>No OTOP dataset published by this province.</li>}
              </ul>
            </div>
          )}

          <h2>Provinces · by dataset count</h2>
          {data.provinces.map((p) => (
            <button
              key={p.code}
              type="button"
              className={`otop-row${p.datasets === 0 ? ' is-silent' : ''}${selected === p.code ? ' is-active' : ''}`}
              onClick={() => setSelected(p.code)}
            >
              <span className="code">{p.code}</span>
              <span className="name">{p.th}<small>{p.en} · {p.region_th}</small></span>
              <span className="count">{p.datasets || '—'}</span>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
