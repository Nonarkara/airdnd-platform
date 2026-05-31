import { useMemo } from 'react';
import { classifyArea } from '../lib/geo';
import './MarketSnapshot.css';

const SERVICE_BUCKETS = [
  { id: 'thai', label: 'Traditional Thai', color: 'var(--d1)', re: /(traditional|thai massage|นวดไทย|นวดแผนไทย|thai\b)/i },
  { id: 'oil', label: 'Oil & Aroma', color: 'var(--d2)', re: /(oil|aroma|aromatherapy|น้ำมัน|อโรมา|สวีดิช|swedish)/i },
  { id: 'foot', label: 'Foot reflexology', color: 'var(--d3)', re: /(foot|reflex|เท้า|ฝ่าเท้า)/i },
  { id: 'spa', label: 'Herbal / Spa', color: 'var(--d4)', re: /(spa|herbal|sauna|สปา|สมุนไพร|ประคบ|อบ)/i },
];

const DISTRICT_COLORS = ['var(--d1)', 'var(--d1)', 'var(--d1)', 'var(--d1)', 'var(--d1)', 'var(--ink-4)'];

function computeDistricts(listings) {
  const counts = new Map();
  let other = 0;
  listings.forEach((l) => {
    const area = classifyArea(l);
    if (area) counts.set(area, (counts.get(area) || 0) + 1);
    else other += 1;
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (other > 0) sorted.push(['Other', other]);
  const max = sorted.length ? Math.max(...sorted.map(([, n]) => n)) : 1;
  return sorted.map(([label, n], i) => ({ label, n, pct: Math.round((n / max) * 100), color: DISTRICT_COLORS[i] || 'var(--ink-4)' }));
}

function computeServiceMix(listings) {
  // Only count listings that actually declare a recognisable service type —
  // never fabricate a category for the unmatched. Percentages are of the
  // classified subset, which is the honest figure for a community-sourced set.
  const tally = SERVICE_BUCKETS.map((b) => ({ ...b, n: 0 }));
  let classified = 0;
  listings.forEach((l) => {
    const hay = [
      ...(Array.isArray(l.serviceTags) ? l.serviceTags : []),
      ...(Array.isArray(l.tags) ? l.tags : []),
      l.description,
    ].filter(Boolean).join(' ');
    const hit = tally.find((b) => b.re.test(hay));
    if (hit) { hit.n += 1; classified += 1; }
  });
  const base = classified || 1;
  return { mix: tally.map((b) => ({ ...b, pct: Math.round((b.n / base) * 100) })), classified };
}

// Build stacked donut dash arrays (circumference normalized to 100).
function donutSegments(mix) {
  let offset = 0;
  return mix.map((m) => {
    const seg = { color: m.color, dash: m.pct, gap: 100 - m.pct, offset: -offset };
    offset += m.pct;
    return seg;
  });
}

function MarketSnapshot({ listings }) {
  const districts = useMemo(() => computeDistricts(listings || []), [listings]);
  const { mix, classified } = useMemo(() => computeServiceMix(listings || []), [listings]);
  const segments = useMemo(() => donutSegments(mix), [mix]);
  const total = (listings || []).length;

  if (total === 0) return null;

  return (
    <section className="snapshot">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-head__t">
            <span className="sec-num">// market snapshot</span>
            <h2 className="h2">The supply, at a glance</h2>
          </div>
        </div>

        <div className="snapshot__grid">
          {/* Supply by district */}
          <div className="panel">
            <div className="panel__head">
              <div className="panel__title">Supply by district</div>
              <div className="panel__sub">listings · matched areas</div>
            </div>
            <div className="panel-pad">
              <div className="barlist">
                {districts.map((d) => (
                  <div className="barrow" key={d.label}>
                    <div className="barrow__label"><span className="swatch" style={{ background: d.color }} />{d.label}</div>
                    <div className="barrow__track"><div className="barrow__fill" style={{ width: `${d.pct}%`, background: d.color }} /></div>
                    <div className="barrow__val">{d.n}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service mix donut */}
          <div className="panel">
            <div className="panel__head">
              <div className="panel__title">Service mix</div>
              <div className="panel__sub">of {classified} with a declared type</div>
            </div>
            <div className="panel-pad snapshot__mix">
              <svg viewBox="0 0 42 42" width="140" height="140" style={{ flex: 'none' }} aria-label="Service mix donut">
                <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
                {segments.map((s, i) => (
                  <circle
                    key={i}
                    cx="21" cy="21" r="15.915" fill="none"
                    stroke={s.color} strokeWidth="6"
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={s.offset}
                    transform="rotate(-90 21 21)"
                  />
                ))}
                <text x="21" y="20" textAnchor="middle" className="num" style={{ fontSize: '7px', fill: 'var(--ink)' }}>{classified}</text>
                <text x="21" y="26" textAnchor="middle" style={{ fontSize: '3px', fill: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>TYPED</text>
              </svg>
              <div className="legend" style={{ flexDirection: 'column', gap: 'var(--s3)' }}>
                {mix.map((m) => (
                  <div className="legend__item" key={m.id}>
                    <span className="swatch" style={{ background: m.color }} />{m.label}
                    <b style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{m.pct}%</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MarketSnapshot;
