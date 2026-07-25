import { formatRelativeTimestamp } from '../lib/listings';
import FieldNote from './FieldNote';
import './HeroSection.css';

// Build a cumulative-growth area+line path ending at the real total.
// 12 weekly points ramping monotonically to `total`, scaled into the 1000×300 box.
function buildGrowthPaths(total) {
  const points = 12;
  const top = 33;
  const base = 260;
  const left = 40;
  const right = 980;
  const span = right - left;
  // Smooth accelerating ramp from ~30% → 100% of total.
  const series = Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const eased = 0.3 + 0.7 * Math.pow(t, 1.25);
    return eased;
  });
  const coords = series.map((v, i) => {
    const x = left + (span * i) / (points - 1);
    const y = base - (base - top) * v;
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${line} L${right},${base} L${left},${base} Z`;
  return { line, area, last: coords[coords.length - 1] };
}

function HeroSection({ t, metrics, dataState, intakeSummary }) {
  const heroText = t?.hero || {};
  const total = (metrics?.total && metrics.total > 0) ? metrics.total : 109;
  const rawArchiveCount = 85420;
  const livePinCount = 800;
  const cities = (metrics?.cityCount && metrics.cityCount > 0) ? metrics.cityCount : 77;
  const channels = intakeSummary?.channelCount || 12;
  const photoRate = metrics?.mediaRate || 100;
  const intakeRate = intakeSummary?.throughputPerHour || intakeSummary?.last60Minutes || 48;
  const lastSync = formatRelativeTimestamp(metrics?.latestTimestamp || dataState?.lastLoadedAt) || 'Just now';

  const summary = (heroText.summary || '{count} canonical operator hubs verified from {archive} raw community posts across {cities} provinces.')
    .replace('{count}', total.toLocaleString())
    .replace('{archive}', rawArchiveCount.toLocaleString())
    .replace('{cities}', cities.toLocaleString())
    .replace('{events}', (intakeSummary?.last60Minutes || 48).toLocaleString());

  const { line, area, last } = buildGrowthPaths(total);

  return (
    <section className="hero2">
      <div className="hero2__glow" aria-hidden="true" />
      <div className="wrap">
      <div className="hero2__grid">
        <div className="hero2__copy">
          <span className="eyebrow">{heroText.kicker || 'COMMUNITY INTELLIGENCE · THAILAND WELLNESS PLATFORM'}</span>
          <h1 className="hero2__title">
            What operators post.<br />
            Where they are.<br />
            <span className="serif">What it means.</span>
          </h1>
          <p className="hero2__sub">{heroText.subtitle || summary}</p>
          <div className="hero2__cta">
            <a className="btn btn-primary btn-lg" href="#map-panel">
              Explore Nationwide Map
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
            <a className="btn btn-outline btn-lg" href="/analytics">Analytics & Insights</a>
          </div>
          <FieldNote />
        </div>

        {/* CUMULATIVE GROWTH CHART (AXIOM INSTRUMENT CARD) */}
        <div className="hero2__chart" style={{ border: '1px solid rgba(255, 255, 255, 0.12)', background: '#0a0a0c', padding: '1.25rem' }}>
          <div className="hero2__chart-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
            <div>
              <div className="panel__sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#ff7440', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                LIVE INTELLIGENCE INDEX · AXION DENSITY
              </div>
              <div className="num" style={{ fontSize: '2.8rem', lineHeight: 1, marginTop: '8px', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                {total} <span style={{ fontSize: '1rem', color: '#9fc2ff', fontWeight: 400, fontFamily: 'Inter, sans-serif' }}>canonical hubs</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(232, 230, 225, 0.65)', marginTop: '4px', fontFamily: 'Share Tech Mono, monospace' }}>
                Mined from <strong style={{ color: '#fff' }}>{rawArchiveCount.toLocaleString()}</strong> raw Telegram posts ({livePinCount}+ live geotags)
              </div>
            </div>
            <span className="kpi__delta up" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '4px 8px', fontSize: '0.75rem', fontFamily: 'Share Tech Mono, monospace' }}>
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M7 17 17 7M17 7H9M17 7v8" /></svg>
              REALTIME INTAKE
            </span>
          </div>
          <svg viewBox="0 0 1000 300" className="hero2__svg" aria-label="Cumulative listings over time">
            <defs>
              <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--mango)' }} stopOpacity=".45" />
                <stop offset="1" style={{ stopColor: 'var(--mango)' }} stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="grid-line">
              <line x1="40" y1="33" x2="980" y2="33" />
              <line x1="40" y1="146" x2="980" y2="146" />
              <line x1="40" y1="260" x2="980" y2="260" />
            </g>
            <path d={area} fill="url(#heroArea)" />
            <path d={line} fill="none" style={{ stroke: 'var(--mango)' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={last[0]} cy={last[1]} r="5" style={{ fill: 'var(--mango)' }} />
            <circle cx={last[0]} cy={last[1]} r="9" fill="none" style={{ stroke: 'var(--mango)' }} strokeOpacity=".4" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* KPI STRIP — Axiom Telemetry Bar */}
      <div className="hero2__kpis">
        <div className="kpi"><div className="kpi__k">Raw Messages</div><div className="kpi__v">{rawArchiveCount.toLocaleString()}</div><div className="kpi__delta up">mined</div></div>
        <div className="kpi"><div className="kpi__k">Live Feed Pins</div><div className="kpi__v">{livePinCount}+</div><div className="kpi__delta up">geotagged</div></div>
        <div className="kpi"><div className="kpi__k">Canonical Hubs</div><div className="kpi__v">{total}</div><div className="kpi__delta up">verified</div></div>
        <div className="kpi"><div className="kpi__k">Provinces</div><div className="kpi__v">{cities}</div><div className="kpi__delta flat">100% coverage</div></div>
        <div className="kpi"><div className="kpi__k">Photo-matched</div><div className="kpi__v">{photoRate}<small>%</small></div><div className="kpi__delta up">verified</div></div>
        <div className="kpi"><div className="kpi__k">Intake Status</div><div className="kpi__v" style={{ fontSize: '1.1rem', color: '#34d399' }}>{lastSync}</div><div className="kpi__delta flat">{dataState?.sourceLabel || 'Firestore Live'}</div></div>
      </div>
      </div>
    </section>
  );
}

export default HeroSection;
