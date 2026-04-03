import { useMemo } from 'react';
import { getListingTimestamp, hasMatchedMedia, formatRelativeTimestamp } from '../lib/listings';
import './ControlPanel.css';

const AREA_PATTERNS = [
  { key: 'ladprao', label: 'Ladprao', patterns: ['ลาดพร้าว', 'ladprao', 'lat phrao'] },
  { key: 'ramintra', label: 'Ramintra', patterns: ['รามอินทรา', 'ramintra', 'ram intra'] },
  { key: 'nonthaburi', label: 'Nonthaburi', patterns: ['นนทบุรี', 'nonthaburi', 'ปากเกร็ด', 'บางกรวย'] },
  { key: 'rama2', label: 'Rama 2', patterns: ['พระราม 2', 'พระราม2', 'rama 2'] },
  { key: 'rama9', label: 'Rama 9', patterns: ['พระราม 9', 'พระราม9', 'rama 9', 'รามคำแหง'] },
  { key: 'bangna', label: 'Bangna', patterns: ['บางนา', 'bangna', 'ศรีนครินทร์'] },
  { key: 'serithai', label: 'Seri Thai', patterns: ['เสรีไทย', 'serithai'] },
  { key: 'sukhumvit', label: 'Sukhumvit', patterns: ['สุขุมวิท', 'sukhumvit', 'อโศก'] },
];

function classifyArea(listing) {
  const text = `${listing.location || ''} ${listing.city || ''}`.toLowerCase();
  for (const area of AREA_PATTERNS) {
    for (const p of area.patterns) {
      if (text.includes(p.toLowerCase())) return area;
    }
  }
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ControlPanel({ listings, onCardClick }) {
  const data = useMemo(() => {
    if (!Array.isArray(listings) || listings.length === 0) return null;

    const total = listings.length;

    // Newest 5 listings
    const sorted = [...listings].sort((a, b) => {
      const ta = getListingTimestamp(a)?.getTime() || 0;
      const tb = getListingTimestamp(b)?.getTime() || 0;
      return tb - ta;
    });
    const newest = sorted.slice(0, 5);

    // Source channels
    const channels = {};
    listings.forEach(l => {
      const ch = l.sourceChannel || 'Unknown';
      channels[ch] = (channels[ch] || 0) + 1;
    });
    const topChannels = Object.entries(channels).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Contact coverage
    let withPhone = 0, withLine = 0, withMaps = 0, withHours = 0, withPhoto = 0;
    listings.forEach(l => {
      if (l.phone) withPhone++;
      if (l.lineUrl) withLine++;
      if (l.mapsUrl) withMaps++;
      if (l.hours) withHours++;
      if (hasMatchedMedia(l)) withPhoto++;
    });

    const contactMetrics = [
      { label: 'Photos', count: withPhoto, pct: Math.round(withPhoto / total * 100) },
      { label: 'Phone', count: withPhone, pct: Math.round(withPhone / total * 100) },
      { label: 'Maps', count: withMaps, pct: Math.round(withMaps / total * 100) },
      { label: 'Hours', count: withHours, pct: Math.round(withHours / total * 100) },
      { label: 'LINE', count: withLine, pct: Math.round(withLine / total * 100) },
    ];

    const qualityScore = Math.round(
      (withPhone + withLine + withMaps + withPhoto + withHours) / (total * 5) * 100
    );

    // Area distribution
    const areas = {};
    listings.forEach(l => {
      const area = classifyArea(l);
      const key = area?.label || 'Other';
      areas[key] = (areas[key] || 0) + 1;
    });
    const topAreas = Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const maxArea = topAreas[0]?.[1] || 1;

    // Day of week distribution
    const byDay = [0, 0, 0, 0, 0, 0, 0];
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    listings.forEach(l => {
      const ts = getListingTimestamp(l);
      if (ts) byDay[ts.getDay()]++;
    });
    const maxDay = Math.max(...byDay) || 1;

    return {
      total, newest, topChannels, contactMetrics, qualityScore,
      topAreas, maxArea, byDay, dayLabels, maxDay, channels,
    };
  }, [listings]);

  if (!data) return null;

  return (
    <section className="ctrl-panel">
      <div className="ctrl-grid">

        {/* Widget 1: Live Intake */}
        <div className="ctrl-widget">
          <div className="ctrl-widget-header">
            <span className="ctrl-label">LIVE INTAKE</span>
            <span className="ctrl-pulse" />
          </div>
          <div className="ctrl-feed">
            {data.newest.map((listing, i) => (
              <div
                key={listing.id}
                className={`ctrl-feed-item ${i === 0 ? 'ctrl-feed-newest' : ''}`}
                onClick={() => onCardClick(listing)}
              >
                <span className="ctrl-feed-name">{listing.name}</span>
                <span className="ctrl-feed-meta">
                  <span className="ctrl-feed-channel">{(listing.sourceChannel || '').replace('@', '').slice(0, 12)}</span>
                  <span className="ctrl-feed-time">{timeAgo(listing.postedAt || listing.updatedAt)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: Source Intelligence */}
        <div className="ctrl-widget">
          <div className="ctrl-widget-header">
            <span className="ctrl-label">SOURCE CHANNELS</span>
          </div>
          <div className="ctrl-donut-wrap">
            <svg viewBox="0 0 120 120" className="ctrl-donut">
              {(() => {
                let offset = 0;
                const circumference = 2 * Math.PI * 45;
                const colors = ['#e31937', '#3e8ed0', '#1a6fb5', '#222222', '#111111'];
                return data.topChannels.map(([, count], i) => {
                  const pct = count / data.total;
                  const dash = circumference * pct;
                  const gap = circumference - dash;
                  const el = (
                    <circle
                      key={i}
                      cx="60" cy="60" r="45"
                      fill="none"
                      stroke={colors[i % colors.length]}
                      strokeWidth="14"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 60 60)"
                    />
                  );
                  offset += dash;
                  return el;
                });
              })()}
              <text x="60" y="56" textAnchor="middle" fill="#e6dfd4" fontSize="22" fontWeight="900" fontFamily="Jost">{data.total}</text>
              <text x="60" y="72" textAnchor="middle" fill="#e6dfd459" fontSize="8" fontWeight="500" fontFamily="Jost" letterSpacing="1">PLACES</text>
            </svg>
          </div>
          <div className="ctrl-legend">
            {data.topChannels.slice(0, 4).map(([ch, count]) => (
              <div key={ch} className="ctrl-legend-row">
                <span className="ctrl-legend-name">{ch.replace('@', '').slice(0, 18)}</span>
                <span className="ctrl-legend-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 3: Contact Coverage */}
        <div className="ctrl-widget">
          <div className="ctrl-widget-header">
            <span className="ctrl-label">DATA QUALITY</span>
            <span className="ctrl-score">{data.qualityScore}%</span>
          </div>
          <div className="ctrl-bars">
            {data.contactMetrics.map(m => (
              <div key={m.label} className="ctrl-bar-row">
                <span className="ctrl-bar-label">{m.label}</span>
                <div className="ctrl-bar-track">
                  <div className="ctrl-bar-fill" style={{ width: `${m.pct}%` }} />
                </div>
                <span className="ctrl-bar-pct">{m.pct}%</span>
              </div>
            ))}
          </div>
          <div className="ctrl-day-chart">
            <span className="ctrl-day-title">POSTING ACTIVITY</span>
            <div className="ctrl-days">
              {data.byDay.map((count, i) => (
                <div key={i} className="ctrl-day">
                  <div className="ctrl-day-bar" style={{ height: `${(count / data.maxDay) * 100}%` }} />
                  <span>{data.dayLabels[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Widget 4: Area Distribution */}
        <div className="ctrl-widget">
          <div className="ctrl-widget-header">
            <span className="ctrl-label">AREA COVERAGE</span>
          </div>
          <div className="ctrl-areas">
            {data.topAreas.map(([area, count]) => (
              <div key={area} className="ctrl-area-row">
                <span className="ctrl-area-name">{area}</span>
                <div className="ctrl-area-track">
                  <div className="ctrl-area-fill" style={{ width: `${(count / data.maxArea) * 100}%` }} />
                </div>
                <span className="ctrl-area-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
