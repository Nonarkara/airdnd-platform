import { formatRelativeTimestamp } from '../lib/listings';
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
  const total = metrics?.total || 0;
  const cities = metrics?.cityCount || 0;
  const channels = intakeSummary?.channelCount || 0;
  const photoRate = metrics?.mediaRate || 0;
  const intakeRate = intakeSummary?.throughputPerHour || intakeSummary?.last60Minutes || 0;
  const lastSync = formatRelativeTimestamp(metrics?.latestTimestamp || dataState?.lastLoadedAt) || 'Pending';

  const summary = (heroText.summary || '{count} listings across {cities} cities. {events} intake events in the last 60 minutes.')
    .replace('{count}', total.toLocaleString())
    .replace('{cities}', cities.toLocaleString())
    .replace('{events}', (intakeSummary?.last60Minutes || 0).toLocaleString());

  const { line, area, last } = buildGrowthPaths(total);

  return (
    <section className="hero2">
      <div className="hero2__glow" aria-hidden="true" />
      <div className="wrap">
      <div className="hero2__grid">
        <div className="hero2__copy">
          <span className="eyebrow">{heroText.kicker || 'Community intelligence · Thailand wellness'}</span>
          <h1 className="hero2__title">
            What operators post.<br />
            Where they are.<br />
            <span className="serif">What it means.</span>
          </h1>
          <p className="hero2__sub">{heroText.subtitle || summary}</p>
          <div className="hero2__cta">
            <a className="btn btn-primary btn-lg" href="/analytics">
              Explore the data
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
            <a className="btn btn-outline btn-lg" href="/methodology">See the method</a>
          </div>
        </div>

        {/* CUMULATIVE GROWTH CHART */}
        <div className="hero2__chart">
          <div className="hero2__chart-head">
            <div>
              <div className="panel__sub">Listings indexed · cumulative</div>
              <div className="num" style={{ fontSize: '2.4rem', lineHeight: 1, marginTop: '8px' }}>{total}</div>
            </div>
            <span className="kpi__delta up">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M7 17 17 7M17 7H9M17 7v8" /></svg>
              live index
            </span>
          </div>
          <svg viewBox="0 0 1000 300" className="hero2__svg" aria-label="Cumulative listings over time">
            <defs>
              <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FF6B3D" stopOpacity=".45" />
                <stop offset="1" stopColor="#FF6B3D" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="grid-line">
              <line x1="40" y1="33" x2="980" y2="33" />
              <line x1="40" y1="146" x2="980" y2="146" />
              <line x1="40" y1="260" x2="980" y2="260" />
            </g>
            <path d={area} fill="url(#heroArea)" />
            <path d={line} fill="none" stroke="#FF6B3D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={last[0]} cy={last[1]} r="5" fill="#FF6B3D" />
            <circle cx={last[0]} cy={last[1]} r="9" fill="none" stroke="#FF6B3D" strokeOpacity=".4" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* KPI STRIP — the data heartbeat */}
      <div className="hero2__kpis">
        <div className="kpi"><div className="kpi__k">Listings</div><div className="kpi__v">{total}</div><div className="kpi__delta up">live</div></div>
        <div className="kpi"><div className="kpi__k">Cities</div><div className="kpi__v">{cities}</div><div className="kpi__delta flat">covered</div></div>
        <div className="kpi"><div className="kpi__k">Channels</div><div className="kpi__v">{channels}</div><div className="kpi__delta up">sources</div></div>
        <div className="kpi"><div className="kpi__k">Photo-matched</div><div className="kpi__v">{photoRate}<small>%</small></div><div className="kpi__delta up">of index</div></div>
        <div className="kpi"><div className="kpi__k">Intake /hr</div><div className="kpi__v">{intakeRate}</div><div className="kpi__delta up">streaming</div></div>
        <div className="kpi"><div className="kpi__k">Last sync</div><div className="kpi__v" style={{ fontSize: '1.3rem' }}>{lastSync}</div><div className="kpi__delta flat">{dataState?.sourceLabel || 'live'}</div></div>
      </div>
      </div>
    </section>
  );
}

export default HeroSection;
