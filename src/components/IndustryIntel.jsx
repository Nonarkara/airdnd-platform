import { useEffect, useState, useMemo } from 'react';
import PageBanner from './PageBanner';
import { useLanguage } from '../context/LanguageContext';
import './IndustryIntel.css';

function formatTimestampAgo(isoString) {
  if (!isoString) return '—';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function IndustryIntel() {
  const { t } = useLanguage();
  const [intel, setIntel] = useState(null);
  const [activeWireFilter, setActiveWireFilter] = useState('ALL');
  const [activeCity, setActiveCity] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    fetch('/data/industry_intel.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setIntel(data);
      })
      .catch((err) => console.error('Failed to load industry intel:', err));

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWire = useMemo(() => {
    if (!Array.isArray(intel?.tacticalWire)) return [];
    return intel.tacticalWire.filter((item) => {
      if (activeWireFilter !== 'ALL' && item.type !== activeWireFilter) return false;
      if (activeCity !== 'ALL' && item.city !== activeCity) return false;
      return true;
    });
  }, [intel, activeWireFilter, activeCity]);

  // Defensive defaults — a missing array in the data file would
  // otherwise crash the whole page (the top-level ErrorBoundary
  // surfaces the failure as "A critical error prevented the
  // application from loading").
  const safeData = intel ? {
    sources: Array.isArray(intel.sources) ? intel.sources : [],
    communityReviews: Array.isArray(intel.communityReviews) ? intel.communityReviews : [],
    microClusters: Array.isArray(intel.microClusters) ? intel.microClusters : [],
    priceBenchmarks: Array.isArray(intel.priceBenchmarks) ? intel.priceBenchmarks : [],
    keywordVelocity: Array.isArray(intel.keywordVelocity) ? intel.keywordVelocity : [],
    whisperRadar: Array.isArray(intel.whisperRadar) ? intel.whisperRadar : [],
  } : null;

  if (!intel || !safeData) {
    return (
      <div className="intel-page intel-loading">
        <div className="mono">CONNECTING TO MULTI-SOURCE INTEL STREAMS…</div>
      </div>
    );
  }

  return (
    <div className="intel-page">
      {/* ── Page Masthead ────────────────────────────────────────────── */}
      <PageBanner
        image="/heroes/insights.jpg"
        tone="dark"
        compact
        ariaLabelledBy="intel-title"
        className="intel-hero-banner"
      >
        <p className="eyebrow masthead__eyebrow">
          // MULTI-SOURCE INDUSTRY INTELLIGENCE TERMINAL
        </p>
        <h1 id="intel-title" className="intel-hero-title">
          Live Industry Telemetry & Field Radar
        </h1>
        <p className="intel-hero-sub">
          Aggregating real-time data across specialized web directories (ThaiNuru, HappyMassage, ThaiNightSpot), community review forums (Reddit r/ThailandBarGirls, AMP Boards), keyword velocity trends, and verified Telegram broadcast lineups.
        </p>
      </PageBanner>

      <div className="intel-content wrap">
        {/* ── Top Telemetry Instruments ──────────────────────────────── */}
        <section className="intel-telemetry">
          <div className="intel-telemetry-box">
            <span className="intel-telemetry-label">INDEXED VENUES (NATIONWIDE)</span>
            <span className="intel-telemetry-val mono">{(intel.meta?.totalVenuesIndexed ?? 0).toLocaleString()}</span>
            <span className="intel-telemetry-sub">Across 5 major provinces</span>
          </div>
          <div className="intel-telemetry-box">
            <span className="intel-telemetry-label">MONITORED ACCESS POINTS</span>
            <span className="intel-telemetry-val mono">{intel.meta?.sourcesMonitoredCount ?? '—'}</span>
            <span className="intel-telemetry-sub">Directories · Forums · Telegram</span>
          </div>
          <div className="intel-telemetry-box">
            <span className="intel-telemetry-label">STREAM STATUS</span>
            <div className="intel-status-indicator">
              <span className="live-dot" />
              <span className="mono" style={{ color: 'var(--mango)', fontWeight: 700 }}>
                {intel.meta?.status || 'OFFLINE'}
              </span>
            </div>
            <span className="intel-telemetry-sub">30-sec polling cadence</span>
          </div>
          <div className="intel-telemetry-box">
            <span className="intel-telemetry-label">AVG PRICE BENCHMARK</span>
            <span className="intel-telemetry-val mono">฿1,850</span>
            <span className="intel-telemetry-sub">Bangkok Metro composite</span>
          </div>
        </section>

        {/* ── Tactical Live Wire & Real-Time Dispatches ────────────────── */}
        <section className="intel-card intel-wire-section">
          <div className="intel-card-header">
            <div>
              <span className="section-kicker">📡 REAL-TIME FIELD REPORTS</span>
              <h2>Tactical Wire & Intelligence Stream</h2>
              <p className="intel-card-sub">
                Live chronological updates across lineups, rate fluctuations, regulatory checks, and community whisper alerts.
              </p>
            </div>
            <div className="intel-wire-filters">
              {['ALL', 'LINEUP_DISPATCH', 'PRICE_UPDATE', 'SAFETY_ADVISORY', 'NEW_OPENING'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`intel-filter-btn${activeWireFilter === filter ? ' is-active' : ''}`}
                  onClick={() => setActiveWireFilter(filter)}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="intel-wire-list">
            {filteredWire.map((item) => {
              // Every property access is defensive — the data file is
              // hand-edited and a missing field here used to crash the
              // entire React tree (which the top-level ErrorBoundary
              // then surfaced as "A critical error prevented the
              // application from loading").
              const urgency = (item.urgency || 'standard').toLowerCase();
              const type = (item.type || 'dispatch').replace(/_/g, ' ');
              return (
                <article key={item.id} className={`intel-wire-item intel-wire-item--${urgency}`}>
                  <div className="intel-wire-meta">
                    <span className="intel-wire-tag mono">{type}</span>
                    <span className="intel-wire-time mono">{formatTimestampAgo(item.timestamp)}</span>
                    <span className="intel-wire-geo">📍 {item.area || '—'}, {item.city || '—'}</span>
                    <span className="intel-wire-source">via {item.source || 'unknown'}</span>
                  </div>
                  <h3 className="intel-wire-title">{item.title || 'Untitled dispatch'}</h3>
                  <p className="intel-wire-details">{item.details || ''}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Multi-Source Ingestion Registry ──────────────────────────── */}
        <section className="intel-card">
          <div className="intel-card-header">
            <div>
              <span className="section-kicker">🌐 INGESTION MAPPING</span>
              <h2>Cross-Platform Source Registry</h2>
              <p className="intel-card-sub">
                The primary directories, review forums, and search indices systematically monitored by our pipeline.
              </p>
            </div>
          </div>

          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Access Point / Name</th>
                  <th>Source Type</th>
                  <th>Geographic Coverage</th>
                  <th>Core Focus & Tiers</th>
                  <th>Polling Frequency</th>
                  <th>Trust Score</th>
                </tr>
              </thead>
              <tbody>
                {safeData.sources.map((s) => (
                  <tr key={s.id || s.name}>
                    <td>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mango)', textDecoration: 'none', fontWeight: 600 }}>
                          {s.name || 'Unnamed source'} ↗
                        </a>
                      ) : (
                        <strong>{s.name || 'Unnamed source'}</strong>
                      )}
                    </td>
                    <td><span className="intel-badge">{s.type || '—'}</span></td>
                    <td>{s.coverage || '—'}</td>
                    <td>{s.focus || '—'}</td>
                    <td className="mono">{s.freshness || '—'}</td>
                    <td>
                      <span className="intel-trust-pill mono">{typeof s.trustScore === 'number' ? `${s.trustScore}%` : '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Thai Community Review Pulse (ติดหม้อ & 4bathreview2 Spotlight) ── */}
        {safeData.communityReviews.length > 0 && (
          <section className="intel-card">
            <div className="intel-card-header">
              <div>
                <span className="section-kicker">🔥 THAI SOCIAL REVIEW PULSE</span>
                <h2>Consumer Review Channels: ติดหม้อ & 4bathreview</h2>
                <p className="intel-card-sub">
                  Curated intelligence dispatches from Thailand's most influential massage review communities on Facebook.
                </p>
              </div>
            </div>

            <div className="intel-review-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {safeData.communityReviews.map((rev) => (
                <article key={rev.id} style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href={rev.sourceUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--mango)', fontWeight: 700, textDecoration: 'none' }}>
                      {rev.source || 'Unknown source'} ↗
                    </a>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', background: 'var(--mango-dim)', color: 'var(--mango)', padding: '2px 6px', border: '1px solid var(--mango)' }}>
                      {rev.badge || '—'}
                    </span>
                  </div>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.05rem', color: 'var(--ink)' }}>{rev.title || 'Untitled review'}</h3>
                  <p style={{ margin: '4px 0 8px', fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.45 }}>{rev.summary || ''}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed var(--line-2)' }}>
                    {(Array.isArray(rev.keySignals) ? rev.keySignals : []).map((sig) => (
                      <span key={sig} style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                        ✓ {sig}
                      </span>
                    ))}
                    <span className="mono" style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>
                      ★ {rev.rating ?? '—'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Soi-Level Micro-Cluster Breakdown ───────────────────────── */}
        <section className="intel-card">
          <div className="intel-card-header">
            <div>
              <span className="section-kicker">📍 URBAN GEOGRAPHY</span>
              <h2>Soi-Level Micro-Cluster Breakdown</h2>
              <p className="intel-card-sub">
                Granular intelligence on high-density nightlife and massage corridors across Bangkok, Pattaya, and resort destinations.
              </p>
            </div>
          </div>

          <div className="intel-cluster-grid">
            {safeData.microClusters.map((cluster) => {
              const density = (cluster.densityLevel || 'unknown').toLowerCase().replace(/\s+/g, '-');
              return (
              <div key={cluster.name} className="intel-cluster-card">
                <div className="intel-cluster-top">
                  <span className="intel-cluster-city">{cluster.city || '—'}</span>
                  <span className={`intel-cluster-density intel-cluster-density--${density}`}>
                    {cluster.densityLevel || 'Unknown'} DENSITY
                  </span>
                </div>
                <h3 className="intel-cluster-name">{cluster.name || 'Unnamed cluster'}</h3>
                <div className="intel-cluster-transit mono">🚇 {cluster.transit || '—'}</div>
                <p className="intel-cluster-desc">{cluster.description}</p>
                
                <div className="intel-cluster-metrics">
                  <div className="intel-cluster-stat">
                    <span className="intel-cluster-label">Estimated Active Venues</span>
                    <strong className="mono">{cluster.activeVenues}</strong>
                  </div>
                  <div className="intel-cluster-stat">
                    <span className="intel-cluster-label">Rate Baseline</span>
                    <strong className="mono">{cluster.typicalPriceRange}</strong>
                  </div>
                  <div className="intel-cluster-stat">
                    <span className="intel-cluster-label">Peak Hours</span>
                    <strong className="mono">{cluster.peakHours}</strong>
                  </div>
                </div>

                <div className="intel-cluster-safety">
                  <strong>💡 Ground Tip:</strong> {cluster.safetyTips || 'Exercise usual caution.'}
                </div>
              </div>
              );
            })}
          </div>
        </section>

        {/* ── Cross-Service Price Benchmark Matrix ────────────────────── */}
        <section className="intel-card">
          <div className="intel-card-header">
            <div>
              <span className="section-kicker">💵 PRICING MATRIX</span>
              <h2>Cross-Service Pricing Benchmark Matrix</h2>
              <p className="intel-card-sub">
                Market rates compiled across web listings, customer forum reports, and direct broadcaster menus.
              </p>
            </div>
          </div>

          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Service Tier / Category</th>
                  <th>Typical Duration</th>
                  <th>Value / Budget</th>
                  <th>Market Average</th>
                  <th>Premium / VIP</th>
                  <th>Standard Inclusions</th>
                  <th>Primary Corridors</th>
                </tr>
              </thead>
              <tbody>
                {safeData.priceBenchmarks.map((p) => (
                  <tr key={p.category}>
                    <td><strong>{p.category || '—'}</strong></td>
                    <td className="mono">{p.duration || '—'}</td>
                    <td className="mono" style={{ color: 'var(--data)' }}>{p.lowEnd || '—'}</td>
                    <td className="mono" style={{ color: 'var(--mango)', fontWeight: 700 }}>{p.average || '—'}</td>
                    <td className="mono" style={{ color: 'var(--ink)' }}>{p.premium || '—'}</td>
                    <td className="intel-inclusions-cell">{p.inclusions || '—'}</td>
                    <td>{p.keyHubs || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Search Keyword Velocity & Community Heat ──────────────────── */}
        <div className="intel-two-col">
          <section className="intel-card">
            <div className="intel-card-header">
              <div>
                <span className="section-kicker">🔍 SEARCH VELOCITY</span>
                <h2>Keyword Velocity Index</h2>
                <p className="intel-card-sub">Google Search & Web Query Heat (0–100 index)</p>
              </div>
            </div>

            <div className="intel-velocity-list">
              {safeData.keywordVelocity.map((k) => {
                const trend = k.trend || '—';
                const trendIsUp = typeof trend === 'string' && trend.startsWith('+');
                return (
                  <div key={k.keyword} className="intel-velocity-row">
                    <div className="intel-velocity-info">
                      <span className="intel-velocity-term">{k.keyword || '—'}</span>
                      <span className="intel-velocity-top">Top Hub: {k.topArea || '—'}</span>
                    </div>
                    <div className="intel-velocity-bar-wrap">
                      <div className="intel-velocity-bar-track">
                        <div className="intel-velocity-bar-fill" style={{ width: `${k.velocity || 0}%` }} />
                      </div>
                      <span className="mono intel-velocity-num">{k.velocity || 0}</span>
                    </div>
                    <span className="intel-velocity-trend mono" style={{ color: trendIsUp ? '#34d399' : '#f87171' }}>
                      {trend}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Whisper Network Scam & Safety Radar ────────────────────── */}
          <section className="intel-card">
            <div className="intel-card-header">
              <div>
                <span className="section-kicker">🛡️ WHISPER RADAR</span>
                <h2>Safety & Scam Countermeasures</h2>
                <p className="intel-card-sub">Common pitfalls reported in community forums</p>
              </div>
            </div>

            <div className="intel-whisper-list">
              {safeData.whisperRadar.map((w) => {
                const severity = (w.severity || 'medium').toLowerCase();
                return (
                  <div key={w.id} className="intel-whisper-item">
                    <div className="intel-whisper-top">
                      <strong className="intel-whisper-title">{w.title || 'Untitled alert'}</strong>
                      <span className={`intel-severity-tag intel-severity-tag--${severity}`}>
                        {w.severity || 'Medium'} RISK
                      </span>
                    </div>
                    <p className="intel-whisper-desc">{w.description || ''}</p>
                    <div className="intel-whisper-counter">
                      <strong>🛡️ Verification Protocol:</strong> {w.countermeasure || 'Verify before engaging.'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default IndustryIntel;
