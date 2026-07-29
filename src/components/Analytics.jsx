import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { formatTelDisplay } from '../lib/normalization';
import { computeGreyScore } from '../lib/listings';
import { useMarketAnalytics, MESSAGE_TYPES, MESSAGE_TYPE_LABELS, getPhotoCount, getContactChannelCount, getLatestSourceTime, formatDateShort, formatPercent, snapshotToAnalyticsListing, buildFallbackMessageStats } from '../lib/useMarketAnalytics';
import InsightNarrative from './InsightNarrative';
import FieldIntelligence from './FieldIntelligence';
import VisualCharts from './VisualCharts';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { loadFormalization, loadStiScreeningRoiet } from '../lib/health';
import './Analytics.css';

// ==========================================
// UI-only components (rendering, not data)
// ==========================================

function Stat({ label, value, unit }) {
  return (
    <div className="an-stat">
      <span className="an-stat-val">{value}<small>{unit}</small></span>
      <span className="an-stat-label">{label}</span>
    </div>
  );
}

function FunFact({ label, value, note, tone = 'action' }) {
  return (
    <article className={`an-fact an-fact-${tone}`}>
      <span className="an-fact-label">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function PowerLawChart({ data }) {
  if (!data || !data.points || data.points.length < 2) return null;
  const W = 460;
  const H = 260;
  const padding = { left: 44, right: 16, top: 12, bottom: 32 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const xs = data.points.map((p) => Math.log10(p.rank));
  const ys = data.points.map((p) => Math.log10(p.count));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.05 || 0.5;
  const yPad = (yMax - yMin) * 0.05 || 0.5;
  const xLo = xMin - xPad, xHi = xMax + xPad;
  const yLo = yMin - yPad, yHi = yMax + yPad;
  const sx = (x) => padding.left + ((x - xLo) / (xHi - xLo)) * innerW;
  const sy = (y) => padding.top + (1 - (y - yLo) / (yHi - yLo)) * innerH;
  const alpha = data.alpha;
  const intercept = ys[0] + alpha * xs[0];
  const lineY = (lx) => intercept - alpha * lx;
  const xLabels = [];
  for (let p = Math.floor(xLo); p <= Math.ceil(xHi); p += 1) {
    if (p >= xLo && p <= xHi) xLabels.push(p);
  }
  const yLabels = [];
  for (let p = Math.floor(yLo); p <= Math.ceil(yHi); p += 1) {
    if (p >= yLo && p <= yHi) yLabels.push(p);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-power-svg" role="img" aria-label="Power-law scatter">
      {xLabels.map((p) => (<line key={`gx-${p}`} x1={sx(p)} x2={sx(p)} y1={padding.top} y2={padding.top + innerH} stroke="var(--color-line-soft, #1f1f1f)" strokeDasharray="2 4" />))}
      {yLabels.map((p) => (<line key={`gy-${p}`} x1={padding.left} x2={padding.left + innerW} y1={sy(p)} y2={sy(p)} stroke="var(--color-line-soft, #1f1f1f)" strokeDasharray="2 4" />))}
      <line x1={padding.left} y1={padding.top + innerH} x2={padding.left + innerW} y2={padding.top + innerH} stroke="var(--color-line)" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="var(--color-line)" />
      <line x1={sx(xLo)} y1={sy(lineY(xLo))} x2={sx(xHi)} y2={sy(lineY(xHi))} stroke="var(--color-action)" strokeWidth="1.5" opacity="0.8" />
      {data.points.map((p, i) => (<circle key={`pt-${i}`} cx={sx(xs[i])} cy={sy(ys[i])} r={3} fill="var(--color-data)" opacity="0.85" />))}
      {xLabels.map((p) => (<text key={`lx-${p}`} x={sx(p)} y={padding.top + innerH + 14} fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-cream-muted)" textAnchor="middle">10{p === 0 ? '⁰' : p === 1 ? '¹' : p === 2 ? '²' : p === 3 ? '³' : `^${p}`}</text>))}
      {yLabels.map((p) => (<text key={`ly-${p}`} x={padding.left - 6} y={sy(p) + 3} fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-cream-muted)" textAnchor="end">10{p === 0 ? '⁰' : p === 1 ? '¹' : p === 2 ? '²' : p === 3 ? '³' : `^${p}`}</text>))}
      <text x={padding.left + innerW / 2} y={H - 4} fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-action)" textAnchor="middle" letterSpacing="0.1em">RANK k</text>
      <text x={12} y={padding.top + innerH / 2} fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-action)" textAnchor="middle" letterSpacing="0.1em" transform={`rotate(-90 12 ${padding.top + innerH / 2})`}>MENTIONS C</text>
      <text x={padding.left + innerW - 8} y={padding.top + 14} fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-action)" textAnchor="end">α = {data.alpha}  R² = {data.r2}</text>
    </svg>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="an-bar-row">
      <span className="an-bar-label">{label}</span>
      <div className="an-bar-track">
        <div className="an-bar-fill" style={{ width: `${pct}%`, background: color || 'var(--color-action)' }} />
      </div>
      <span className="an-bar-val">{value}</span>
    </div>
  );
}

function listingHref(id) {
  return `/?listing=${encodeURIComponent(id)}`;
}

const ANALYTICS_TIMEOUT_MS = 6_000;
const ANALYTICS_REFRESH_INTERVAL_MS = 60_000;

function withTimeout(promise, ms, label) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export default function Analytics() {
  const { t } = useLanguage();
  const pc = t.pageChrome || {};
  const [listings, setListings] = useState([]);
  const [msgStats, setMsgStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState(null);
  const [analysisNow, setAnalysisNow] = useState(() => Date.now());
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [healthSnap, setHealthSnap] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull the precomputed product-patterns dataset (Methodology §08).
  useEffect(() => {
    let cancelled = false;
    fetch('/patterns.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setPatterns(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Formalization + Roi Et STI screening snapshot for Public Health panel.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadFormalization().catch(() => null),
      loadStiScreeningRoiet().catch(() => null),
    ]).then(([formalization, sti]) => {
      if (cancelled || (!formalization && !sti)) return;
      setHealthSnap({ formalization, sti });
    });
    return () => { cancelled = true; };
  }, []);

  const load = async () => {
    setIsRefreshing(true);
    try {
      console.log('Fetching live listings from Firestore for analytics...');
      const q = query(collection(db, 'companions'), orderBy('updatedAt', 'desc'), limit(1200));
      const querySnapshot = await getDocs(q);
      const liveListings = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        liveListings.push({
          ...docData,
          id: docData.id || doc.id,
        });
      });

      const [patternResponse, feedResponse] = await Promise.all([
        fetch('/patterns.json', { cache: 'no-store' }),
        fetch('/feed.json', { cache: 'no-store' }),
      ]);
      const patternData = patternResponse.ok ? await patternResponse.json() : null;
      const feedRows = feedResponse.ok ? await feedResponse.json() : [];

      if (patternData) setPatterns(patternData);
      setListings(liveListings.map(snapshotToAnalyticsListing));
      setMsgStats(buildFallbackMessageStats(patternData, Array.isArray(feedRows) ? feedRows : []));
      setAnalysisNow(Date.now());
      setLastRefreshed(new Date());
    } catch (error) {
      console.warn('Live Firestore analytics failed, falling back to snapshots:', error);
      const [snapshotResponse, patternResponse, feedResponse] = await Promise.all([
        fetch('/data.json', { cache: 'no-store' }),
        fetch('/patterns.json', { cache: 'no-store' }),
        fetch('/feed.json', { cache: 'no-store' }),
      ]);
      const snapshotRows = snapshotResponse.ok ? await snapshotResponse.json() : [];
      const patternData = patternResponse.ok ? await patternResponse.json() : null;
      const feedRows = feedResponse.ok ? await feedResponse.json() : [];
      if (patternData) setPatterns(patternData);
      setListings((Array.isArray(snapshotRows) ? snapshotRows : []).map(snapshotToAnalyticsListing));
      setMsgStats(buildFallbackMessageStats(patternData, Array.isArray(feedRows) ? feedRows : []));
      setAnalysisNow(Date.now());
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const intervalId = window.setInterval(load, ANALYTICS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const data = useMarketAnalytics(listings, msgStats, patterns, analysisNow);

  if (loading) {
    return (
      <div className="an-page">
        <div className="an-loading">Loading industry data...</div>
      </div>
    );
  }

  if (!data) return null;

  // Dynamic Euphemism Frequency Mining
  const aromaCount = listings.filter(l => {
    const s = `${l.name} ${l.description} ${l.raw_text}`.toLowerCase();
    return s.includes('aroma') || s.includes('อโรมา') || s.includes('อโรม่า');
  }).length;

  const oilCount = listings.filter(l => {
    const s = `${l.name} ${l.description} ${l.raw_text}`.toLowerCase();
    return s.includes('oil') || s.includes('น้ำมัน') || s.includes('นวดน้ำมัน');
  }).length;

  const b2bCount = listings.filter(l => {
    const s = `${l.name} ${l.description} ${l.raw_text}`.toLowerCase();
    return s.includes('b2b') || s.includes('บอดี้') || s.includes('body') || s.includes('b to b') || s.includes('บีทูบี');
  }).length;

  const showerCount = listings.filter(l => {
    const s = `${l.name} ${l.description} ${l.raw_text}`.toLowerCase();
    return s.includes('shower') || s.includes('อาบ') || s.includes('สบู่') || s.includes('soap');
  }).length;

  const freestyleCount = listings.filter(l => {
    const s = `${l.name} ${l.description} ${l.raw_text}`.toLowerCase();
    return s.includes('freestyle') || s.includes('ฟรีสไตล์');
  }).length;

  // Venue type taxonomy — Thai industry regulatory tiers (insider source, 2024)
  const venueTypes = [
    { key: 'aab', label: 'อาบอบนวด · Licensed Bath & Massage', short: 'อาบอบนวด', color: '#34d399', risk: 'TIER 1',
      price: '฿1,500–5,000+', note: 'Government-registered. Mandatory VD testing & medical certificate every 2–3 months. Workers registered with district office (ส่งปกครอง). All-inclusive pricing negotiated at the door.',
      keywords: ['อาบอบนวด', 'อ.อ.น', 'อาอบ'] },
    { key: 'spa', label: 'สปา · Day Spa', short: 'สปา', color: '#9fc2ff', risk: 'TIER 2',
      price: '฿800–3,000', note: 'Operating under TAT spa licensing framework. Voluntary health standards. Compliance varies widely — hotel-branded spas anchor one end, informal operations anchor the other.',
      keywords: ['สปา', ' spa', 'spa '] },
    { key: 'thai', label: 'นวดแผนไทย · Traditional Thai', short: 'นวดแผนไทย', color: '#f59e0b', risk: 'TIER 3',
      price: '฿200–600', note: 'Most common category in the corpus. Continuum from legitimate wellness to grey services. Sub-฿300 pricing is the primary risk signal. No certification required to operate.',
      keywords: ['นวดแผนไทย', 'นวดไทย', 'แผนไทย'] },
    { key: 'sideline', label: 'ไซด์ไลน์ · Freelance / Sideline', short: 'ไซด์ไลน์', color: '#ff3366', risk: 'TIER 4',
      price: 'Negotiated', note: 'Self-employed workers, no establishment oversight, no VD certification, no worker registration. Highest trafficking-risk tier per industry insider framework.',
      keywords: ['ไซด์ไลน์', 'sideline', 'ไซด์'] },
  ];
  const venueCounts = venueTypes.map(vt => ({
    ...vt,
    count: listings.filter(l => {
      const s = `${l.name || ''} ${l.description || ''} ${l.raw_text || ''}`.toLowerCase();
      return vt.keywords.some(kw => s.includes(kw));
    }).length,
  }));
  const classifiedVenueIds = new Set();
  listings.forEach(l => {
    const s = `${l.name || ''} ${l.description || ''} ${l.raw_text || ''}`.toLowerCase();
    if (venueTypes.some(vt => vt.keywords.some(kw => s.includes(kw)))) classifiedVenueIds.add(l.id);
  });
  const unclassifiedVenueCount = listings.length - classifiedVenueIds.size;
  const maxVenueCount = Math.max(...venueCounts.map(v => v.count), unclassifiedVenueCount, 1);

  const euphemisms = [
    { label: 'น้ำมัน · Oil Massage', count: oilCount, implied: 'Gateway / standard physical contact' },
    { label: 'อโรมา · Aroma Massage', count: aromaCount, implied: 'Body contact & exposure' },
    { label: 'บอดี้ · B2B / Body-to-Body', count: b2bCount, implied: 'Sensual full-contact rubbing' },
    { label: 'อาบน้ำ · Shower / Soap', count: showerCount, implied: 'Hygiene prep for sexual contact' },
    { label: 'ฟรีสไตล์ · Freestyle (Explicit)', count: freestyleCount, implied: 'Explicit sexual terms (Self-censored)', color: 'var(--color-status)' },
  ].sort((a, b) => b.count - a.count);

  const maxEuphemism = Math.max(...euphemisms.map(e => e.count), 1);

  const basePriceVal = data.priceMedian || 600;
  const estimatedAddonVal = 2000;
  const totalEstimatedPriceVal = basePriceVal + estimatedAddonVal;

  const lowPriceOutliers = listings
    .filter((l) => l.priceValue && l.priceValue < 500)
    .slice(0, 5);

  const highAnonymityListings = listings
    .filter((l) => {
      const nameLower = (l.name || '').toLowerCase();
      const isGeneric = !l.name || nameLower === 'น้อง' || nameLower === 'น้องใหม่' || nameLower.includes('ร้าน') || nameLower.length < 5;
      const hasNoPhotos = !l.photo_urls || l.photo_urls.length === 0;
      return isGeneric && hasNoPhotos;
    })
    .slice(0, 5);

  // ── Grey Score Distribution ───────────────────────────────────────────────
  const greyDist = listings.reduce((acc, l) => {
    const normalized = {
      isSafeImage: l.isSafeImage ?? l.is_safe_image,
      tags: l.tags || [],
      serviceTags: l.serviceTags || l.service_tags || [],
      rawText: l.rawText || l.raw_text || l.description || '',
      mentionCount: l.mentionCount || l.mention_count || 0,
      mapsUrl: l.mapsUrl || l.maps_url || '',
      priceValue: l.priceValue || l.price || 0,
      credibility: l.credibility || 0,
      name: l.name || '',
      description: l.description || '',
    };
    const { level } = computeGreyScore(normalized);
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, { legit: 0, ambiguous: 0, grey: 0, strong: 0 });
  const greyTotal = listings.length || 1;

  const maxCity = data.cities[0]?.[1] || 1;
  const maxChannel = data.channels[0]?.[1] || 1;
  const maxContact = data.contactRows[0]?.[1] || 1;
  const maxCompleteness = data.completenessRows[0]?.[1] || 1;
  const maxMessageType = data.messageTypeRows[0]?.[1] || 1;
  const maxPrice = Math.max(...Object.values(data.priceBuckets), 1);
  const maxPhoto = Math.max(...Object.values(data.photoBuckets), 1);
  const maxHour = Math.max(...Object.values(data.postingHours), 1);
  const maxDay = Math.max(...data.postingDays, 1);
  const maxNick = data.topNicks[0]?.[1] || 1;
  const maxMonth = Math.max(...data.monthRows.map(([, c]) => c), 1);

  return (
    <div className="an-page">
      <header className="an-header">
        <a href="/" className="an-back">← {pc.backToDirectory || 'Back to Directory'}</a>
        <div className="an-header-meta">
          {lastRefreshed && (
            <span className="an-refresh-time">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            className="an-refresh-btn"
            onClick={load}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <span className="an-badge">Industry Intelligence</span>
        </div>
      </header>

      <div className="an-hero">
        <h1>Thailand Massage<br />& Spa Industry</h1>
        <p>
          Real-time market intelligence from {data.total} businesses across {data.cities.length}+ cities. Mined from {data.msgCount?.toLocaleString() || '—'} community messages and {data.photoCount?.toLocaleString() || '—'} archived photos. Every figure on this page traces back to a specific listing — click any row to read the source.
        </p>
      </div>
      <InsightNarrative analytics={data} mode="global" />
      <FieldIntelligence listings={listings} />
      <VisualCharts analytics={data} />
      <section className="an-stats-grid">
        <Stat label="Active Businesses" value={data.total} />
        <Stat label="Image Reuse Rate" value={data.reuseRate} unit="%" />
        <Stat label="Market Velocity" value={data.velocity} unit="%" />
        <Stat label="Data Freshness" value={data.dataFreshnessHours} unit="h ago" />
      </section>

      <section className="an-card an-wide an-facts-panel">
        <h2>Fresh Fun Facts · Full Corpus Pass</h2>
        <p className="an-card-sub">
          Recomputed from the latest listing rows, raw channel archive, photo archive, and pre-mined product patterns. These are deliberately plain-English facts because the statistical machinery should also be fun to read.
        </p>
        <div className="an-fact-grid">
          {data.funFacts.map((fact) => (
            <FunFact
              key={fact.label}
              label={fact.label}
              value={fact.value}
              note={fact.note}
              tone={fact.tone}
            />
          ))}
        </div>
      </section>

      {/* ── Section: Socio-Linguistic and NGO Support Matrix ────────────────── */}
      <section className="an-card an-wide an-upgrade-section">
        <h2>Socio-Linguistic Decoding & NGO Outreach Matrix</h2>
        <p className="an-card-sub">
          Critical data layers translating euphemisms, exposing hidden pricing structures, and providing social outreach teams with actionable intervention targets.
        </p>

        <div className="an-upgrade-grid">
          {/* 1. Linguistic Decoder */}
          <div className="an-upgrade-panel card-linguistic">
            <h3>Linguistic Decoder (Euphemism Frequencies)</h3>
            <p className="panel-desc">
              The Thai grey massage economy operates on therapeutic alibi terms. We extract these counts dynamically from the active listings to map the threshold of deniability.
            </p>
            <div className="an-bars" style={{ marginTop: '1rem' }}>
              {euphemisms.map((e) => (
                <div key={e.label} className="euphemism-row" style={{ marginBottom: '0.5rem' }}>
                  <Bar label={e.label} value={e.count} max={maxEuphemism} color={e.color || 'var(--color-data)'} />
                  <span className="euphemism-implied" style={{ display: 'block', fontSize: '9px', color: 'var(--color-cream-muted)', marginLeft: '8.55rem', marginTop: '-2px' }}>
                    {e.implied}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Economy of Add-ons */}
          <div className="an-upgrade-panel card-addons">
            <h3>The Economy of Add-Ons</h3>
            <p className="panel-desc">
              The visible price is the alibi. The true economic transaction depends on private negotiation conducted behind closed doors.
            </p>
            <div className="an-addon-chart-container" style={{ marginTop: '1rem' }}>
              <div className="an-addon-stack-bar" style={{ display: 'flex', height: '24px', border: '1px solid var(--color-line)', background: 'var(--color-bg-inset)', overflow: 'hidden' }}>
                <div className="an-addon-stack-segment segment-base" style={{ width: `${(basePriceVal / totalEstimatedPriceVal) * 100}%`, background: 'var(--color-data)', display: 'grid', placeItems: 'center', fontSize: '10px', color: 'var(--color-bg)', fontWeight: 'bold' }}>
                  <span>Base Alibi ฿{basePriceVal}</span>
                </div>
                <div className="an-addon-stack-segment segment-addon" style={{ width: `${(estimatedAddonVal / totalEstimatedPriceVal) * 100}%`, background: 'var(--color-action)', display: 'grid', placeItems: 'center', fontSize: '10px', color: 'var(--color-bg)', fontWeight: 'bold' }}>
                  <span>Est. Add-On ~฿{estimatedAddonVal}</span>
                </div>
              </div>
              <div className="an-addon-legend" style={{ marginTop: '0.85rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-body)', fontWeight: 'bold', color: 'var(--color-cream)' }}>
                  Estimated Total Transaction: ฿{totalEstimatedPriceVal}
                </p>
                <div className="an-addon-legend-items" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div className="legend-item" style={{ display: 'flex', gap: '0.5rem', fontSize: 'var(--text-small)', color: 'var(--color-cream-soft)' }}>
                    <span className="legend-color color-base" style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--color-data)', flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>Base Fee (Room/Alibi):</strong> Split 50/50 with the landlord. Covers towels, facility maintenance, and the legal alibi of health massage.</span>
                  </div>
                  <div className="legend-item" style={{ display: 'flex', gap: '0.5rem', fontSize: 'var(--text-small)', color: 'var(--color-cream-soft)' }}>
                    <span className="legend-color color-addon" style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--color-action)', flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>Negotiated tip (Intimacy):</strong> Retained by the provider, but vulnerable to safety rent, transportation, and health supplies.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. NGO Intervention Matrix */}
          <div className="an-upgrade-panel card-ngo-matrix">
            <h3>NGO & Social Worker Support Matrix</h3>
            <p className="panel-desc">
              Outreach targeting tools. We flag high-risk listings based on pricing anomalies (potential economic coercion) and extreme anonymity (potential trafficking/high turnover).
            </p>
            
            <div className="ngo-stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBlock: '0.75rem' }}>
              <div className="ngo-metric-card" style={{ padding: '0.5rem', border: '1px solid var(--color-line-soft)', background: 'var(--color-bg-inset)', textAlign: 'center' }}>
                <span className="ngo-metric-val" style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: 'var(--color-action)' }}>{listings.filter(l => l.priceValue && l.priceValue < 500).length}</span>
                <span className="ngo-metric-label" style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--color-cream-muted)', fontFamily: 'var(--font-mono)' }}>Low Price Outliers</span>
              </div>
              <div className="ngo-metric-card" style={{ padding: '0.5rem', border: '1px solid var(--color-line-soft)', background: 'var(--color-bg-inset)', textAlign: 'center' }}>
                <span className="ngo-metric-val" style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: 'var(--color-status)' }}>
                  {listings.filter(l => {
                    const nameLower = (l.name || '').toLowerCase();
                    const isGeneric = !l.name || nameLower === 'น้อง' || nameLower === 'น้องใหม่' || nameLower.includes('ร้าน') || nameLower.length < 5;
                    const hasNoPhotos = !l.photo_urls || l.photo_urls.length === 0;
                    return isGeneric && hasNoPhotos;
                  }).length}
                </span>
                <span className="ngo-metric-label" style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--color-cream-muted)', fontFamily: 'var(--font-mono)' }}>High Anonymity Profiles</span>
              </div>
            </div>

            <div className="ngo-outreach-lists" style={{ marginTop: '0.75rem' }}>
              <span className="section-kicker" style={{ fontSize: '9px', color: 'var(--color-action)' }}>LOW PRICE INTERVENTION TARGETS</span>
              <div className="an-table an-table-mini" style={{ marginBottom: '0.75rem', marginTop: '0.2rem' }}>
                {lowPriceOutliers.length === 0 ? (
                  <div className="an-empty" style={{ fontSize: '10px', color: 'var(--color-cream-muted)' }}>No low-price outliers detected in snapshot.</div>
                ) : (
                  lowPriceOutliers.map((l) => (
                    <a key={l.id} href={listingHref(l.id)} className="an-table-row an-table-row-link an-mini-row" style={{ fontSize: '11px', paddingBlock: '0.35rem' }}>
                      <span>{l.name || 'Anonymous Provider'} ({l.city || 'Bangkok'})</span>
                      <strong>{l.priceValue} THB</strong>
                    </a>
                  ))
                )}
              </div>

              <span className="section-kicker" style={{ fontSize: '9px', color: 'var(--color-status)' }}>HIGH ANONYMITY INTERVENTION TARGETS</span>
              <div className="an-table an-table-mini" style={{ marginTop: '0.2rem' }}>
                {highAnonymityListings.length === 0 ? (
                  <div className="an-empty" style={{ fontSize: '10px', color: 'var(--color-cream-muted)' }}>No high-anonymity targets detected.</div>
                ) : (
                  highAnonymityListings.map((l) => (
                    <a key={l.id} href={listingHref(l.id)} className="an-table-row an-table-row-link an-mini-row" style={{ fontSize: '11px', paddingBlock: '0.35rem' }}>
                      <span>{l.name || 'Unnamed น้อง'} ({l.city || 'Bangkok'})</span>
                      <strong>ID: {l.id}</strong>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4. Public Health Resources */}
          <div className="an-upgrade-panel card-resources">
            <h3>Public Health &amp; Harm Reduction</h3>
            <p className="panel-desc">
              Formalization gap (HSS certified นวด สปา vs Telegram inventory) and STI screening
              uptake sit beside the market ledger. Client-side recklessness vs worker-side
              protection remains a hypothesis — open data does not prove either. Thailand&apos;s
              100% Condom Program worked through the licensed อาบอบนวด tier.
            </p>
            {healthSnap && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1px',
                background: 'var(--color-line, var(--line))',
                border: '1px solid var(--color-line, var(--line))',
                marginTop: '0.85rem',
              }}
              >
                {[
                  {
                    label: 'HSS certified',
                    value: (healthSnap.formalization?.hss?.nationalTotal || 0).toLocaleString(),
                    note: 'นวด สปา registry',
                  },
                  {
                    label: 'Excise latest',
                    value: healthSnap.formalization?.excise?.latest?.taxNetBaht != null
                      ? `฿${Math.round(healthSnap.formalization.excise.latest.taxNetBaht / 1e6)}M`
                      : '—',
                    note: `BE ${healthSnap.formalization?.excise?.latest?.yearBuddhist || '—'}`,
                  },
                  {
                    label: 'Roi Et SW screened',
                    value: (healthSnap.sti?.latest?.sexWorkerTotal || 0).toLocaleString(),
                    note: 'uptake · not incidence',
                  },
                ].map((cell) => (
                  <div key={cell.label} style={{ background: 'var(--color-surface, var(--surface))', padding: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-cream-muted, var(--ink-3))' }}>{cell.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 600, marginTop: '6px', color: 'var(--color-cream, var(--ink))' }}>{cell.value}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', marginTop: '4px', color: 'var(--color-cream-muted, var(--ink-3))' }}>{cell.note}</div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ marginTop: '0.75rem' }}>
              <Link
                to="/health"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-action, var(--mango))',
                  borderBottom: '1px solid var(--color-action, var(--mango))',
                }}
              >
                Open four-lens research →
              </Link>
            </p>
            <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { org: 'UNFPA Thailand', url: 'unfpa.org', note: 'Thai-language sexuality education & STI prevention materials' },
                { org: 'Thai Red Cross Anonymous Clinic', url: 'thai-redcross.or.th', note: 'Free, confidential HIV/STI testing — no ID required' },
                { org: 'Dept of Disease Control (DDC)', url: 'ddc.moph.go.th', note: 'National STI strategy, clinic network, PrEP access' },
                { org: 'CDC STI Treatment Guidelines', url: 'cdc.gov/std', note: 'Condom effectiveness data, treatment protocols' },
              ].map(({ org, url, note }) => (
                <div key={org} style={{ borderBottom: '1px solid var(--color-line-soft)', paddingBottom: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-cream)' }}>{org}</span>
                    <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-data)', flexShrink: 0 }}>{url}</span>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--color-cream-muted)', margin: '0.1rem 0 0', lineHeight: '1.5' }}>{note}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-action)', marginTop: '0.75rem', lineHeight: '1.5' }}>
              CORE PREVENTION · Condom + testing + consent. No method is 100% except abstinence, but consistent condom use dramatically reduces risk across all venue tiers.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section: Venue Type Intelligence ────────────────────────────────── */}
      <section className="an-card an-wide" style={{ marginBottom: '1rem' }}>
        <h2>Venue Type Intelligence · Industry Taxonomy</h2>
        <p className="an-card-sub">
          Thailand's massage industry operates across four regulatory tiers — from government-licensed อาบอบนวด to unregistered ไซด์ไลน์ freelancers. Each tier carries distinct safety standards, pricing models, and compliance obligations. Signal detection uses keyword patterns extracted from listing names, descriptions, and raw community text.
        </p>

        {/* Safety tier ladder */}
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <svg viewBox="0 0 760 108" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', minWidth: '580px' }} role="img" aria-label="Venue safety tier ladder">
            <text x="380" y="11" textAnchor="middle" fill="#e8e6e125" fontSize="9" fontWeight="500" letterSpacing="3">SAFETY TIER LADDER · INSIDER FRAMEWORK</text>
            {[
              { x: 8,   label: 'อาบอบนวด', sub: 'TIER 1 · LICENSED',      col: '#34d399', note: 'VD cert · ส่งปกครอง' },
              { x: 198, label: 'สปา',       sub: 'TIER 2 · SEMI-FORMAL',   col: '#9fc2ff', note: 'TAT license · varies' },
              { x: 388, label: 'นวดแผนไทย',sub: 'TIER 3 · INFORMAL',      col: '#f59e0b', note: 'No cert · price signals risk' },
              { x: 578, label: 'ไซด์ไลน์', sub: 'TIER 4 · UNREGISTERED',  col: '#ff3366', note: 'No oversight · highest risk' },
            ].map(({ x, label, sub, col, note }) => (
              <g key={x}>
                <rect x={x} y="18" width="172" height="72" stroke={col} strokeWidth="1" fill="none" />
                <text x={x + 86} y="41" textAnchor="middle" fill={col} fontSize="11" fontWeight="700">{label}</text>
                <text x={x + 86} y="57" textAnchor="middle" fill="#e8e6e155" fontSize="8" letterSpacing="1">{sub}</text>
                <text x={x + 86} y="73" textAnchor="middle" fill="#e8e6e170" fontSize="8">{note}</text>
              </g>
            ))}
            {[180, 370, 560].map(ax => (
              <g key={ax}>
                <line x1={ax} y1="54" x2={ax + 8} y2="54" stroke="#333" strokeWidth="1" />
                <polygon points={`${ax + 8},50 ${ax + 18},54 ${ax + 8},58`} fill="#444" />
              </g>
            ))}
            <text x="380" y="102" textAnchor="middle" fill="#34d39975" fontSize="8" letterSpacing="1">SAFEST ←——————————————————————————→ HIGHEST RISK</text>
          </svg>
        </div>

        {/* Venue count bars */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span className="section-kicker" style={{ display: 'block', marginBottom: '0.65rem' }}>CORPUS DISTRIBUTION · VENUE TYPE SIGNALS</span>
          {[...venueCounts, { label: 'Unclassified · General listing', count: unclassifiedVenueCount, color: '#e8e6e128' }].map(vt => (
            <Bar key={vt.label} label={vt.label} value={vt.count} max={maxVenueCount} color={vt.color} />
          ))}
        </div>

        {/* Insider intelligence cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1px', background: 'var(--color-line)', border: '1px solid var(--color-line)', marginBottom: '1.25rem' }}>
          {venueCounts.map(vt => (
            <div key={vt.key} style={{ background: 'var(--color-bg-inset)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: vt.color }}>{vt.short}</span>
                <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', padding: '2px 5px', border: `1px solid ${vt.color}55`, color: vt.color }}>{vt.risk}</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-cream-muted)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>PRICE · {vt.price}</div>
              <p style={{ fontSize: '12px', color: 'var(--color-cream-soft)', lineHeight: '1.65', margin: 0 }}>{vt.note}</p>
            </div>
          ))}
        </div>

        {/* Regulatory model note */}
        <div style={{ padding: '1rem', border: '1px solid var(--color-line-soft)', background: 'var(--color-bg-inset)' }}>
          <span className="section-kicker" style={{ color: 'var(--color-action)', display: 'block', marginBottom: '0.4rem' }}>INSIDER CONTEXT · REGULATORY MODEL</span>
          <p style={{ fontSize: '12px', color: 'var(--color-cream-muted)', lineHeight: '1.8', margin: 0 }}>
            Government-licensed อาบอบนวด establishments require mandatory VD testing — blood work and physical examinations every 2–3 months. Workers must hold valid medical certificates before working. Each worker is formally registered with the district government (ส่งปกครองอำเภอ). All services are priced all-inclusive at the door: ฿1,500–5,000+ covers the room, facility, and all negotiated services. This paper trail — medical certification, district registration, declared pricing — is what distinguishes Tier 1 from the rest of the market. The Telegram corpus can corroborate or contradict this compliance through posting frequency, price signals, and anonymity patterns.
          </p>
        </div>
      </section>

      {/* Daily intake timeline — 30-day bar chart */}
      {data.dailyTimeline && data.dailyTimeline.some((d) => d.count > 0) && (() => {
        const maxDay2 = Math.max(...data.dailyTimeline.map((d) => d.count), 1);
        return (
          <section className="an-card an-wide" style={{ marginBottom: '1rem' }}>
            <h2>Daily Intake · Last 30 Days</h2>
            <p className="an-card-sub">New listings created per day. Gaps show scraper downtime or days with no qualifying posts.</p>
            <div className="an-hour-chart an-day30-chart">
              {data.dailyTimeline.map((d) => (
                <div key={d.date} className="an-hour-bar">
                  <div className="an-hour-fill" style={{ height: `${(d.count / maxDay2) * 100}%`, background: d.count > 0 ? 'var(--color-action)' : 'var(--color-line)' }} />
                  <span style={{ fontSize: '8px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', opacity: d.count > 0 ? 0.8 : 0.3 }}>{d.date}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {data.activityHeatmap && data.maxHeatmapValue > 0 && (
        <section className="an-card an-wide" style={{ marginBottom: '1rem' }}>
          <h2>Activity Heatmap · 24/7 Burst Cycles</h2>
          <p className="an-card-sub">When communities trigger the pipeline. Darker cells indicate higher posting velocity.</p>
          <div className="an-heatmap-grid">
            <div className="an-heatmap-y-labels">
              {data.dayLabels.map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="an-heatmap-matrix">
              {data.activityHeatmap.map((dayData, dIdx) => (
                <div key={`day-${dIdx}`} className="an-heatmap-row">
                  {dayData.map((val, hIdx) => {
                    const intensity = val > 0 ? 0.2 + (val / data.maxHeatmapValue) * 0.8 : 0;
                    return (
                      <div
                        key={`cell-${dIdx}-${hIdx}`}
                        className="an-heatmap-cell"
                        style={{ backgroundColor: `rgba(255, 116, 64, ${intensity})` }}
                        title={`${data.dayLabels[dIdx]} ${hIdx}:00 - ${val} posts`}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="an-heatmap-x-labels">
                {[0, 6, 12, 18, 23].map(h => (
                  <span key={h} style={{ gridColumn: h + 1 }}>{h}:00</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="an-card an-wide" style={{ marginBottom: '1rem' }}>
        <h2>Raw Data Funnel · What The System Actually Mined</h2>
        <p className="an-card-sub">
          The public directory is only the top layer. Under it sits the raw archive: {data.corpusCounts.rawMessages.toLocaleString()} messages and {data.corpusCounts.archivedPhotos.toLocaleString()} photos. Listing-classified posts are the signal; discussion, feedback, and spam are the surrounding community context that makes the platform generalizable.
        </p>
        <div className="an-funnel-grid">
          <Stat label="Raw Messages" value={data.corpusCounts.rawMessages.toLocaleString()} />
          <Stat label="Listing-Classified" value={data.corpusCounts.listingMessages.toLocaleString()} />
          <Stat label="Media Messages" value={data.corpusCounts.mediaMessages.toLocaleString()} />
          <Stat label="Archived Photos" value={data.corpusCounts.archivedPhotos.toLocaleString()} />
        </div>
        <div className="an-grid an-grid-compact">
          <div className="an-bars">
            {data.messageTypeRows.map(([label, count, type]) => (
              <Bar
                key={type}
                label={label}
                value={count}
                max={maxMessageType}
                color={type === 'listing' ? 'var(--color-action)' : type === 'feedback' ? 'var(--color-status)' : 'var(--color-data)'}
              />
            ))}
          </div>
          <div className="an-corpus-notes">
            <p><strong>{data.corpusCounts.listingYield}%</strong> of all raw messages become listing candidates.</p>
            <p><strong>{data.corpusCounts.mediaRate}%</strong> of raw messages carry media.</p>
            <p><strong>{data.corpusCounts.messagesPerBusiness} raw messages</strong> sit behind each current listing row on average.</p>
          </div>
        </div>
      </section>

      <div className="an-grid">
        {/* Service Quality Sentiment */}
        <section className="an-card an-wide">
          <h2>Service Quality Sentiment</h2>
          <p className="an-card-sub">AI-extracted positive feedback keywords from community discussions ({data.topQuality.reduce((sum, [, c]) => sum + c, 0)} mentions across {data.total} parlours).</p>
          <div className="an-sentiment-cloud">
            {data.topQuality.map(([tag, count]) => (
              <div key={tag} className="an-sentiment-tag">
                <span className="an-sentiment-label">{tag}</span>
                <span className="an-sentiment-count">{count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Nickname Cloud — the surprising one */}
        <section className="an-card an-wide">
          <h2>Provider Nicknames</h2>
          <p className="an-card-sub">
            Thai community posts almost never use legal names — instead they reference providers by nickname (น้อง[name], แม่[name], พี่[name], or a single endearment). This is what shows up most often. Tap a nickname to see every listing that mentions it.
          </p>
          <div className="an-nick-cloud">
            {data.topNicks.length === 0 && <span className="an-empty">No nickname patterns detected yet.</span>}
            {data.topNicks.map(([nick, count]) => {
              const ids = [...(data.nickToListings[nick] || [])];
              const targetId = ids[0];
              const size = 11 + Math.min(11, Math.round((count / maxNick) * 10));
              return (
                <a
                  key={nick}
                  href={targetId ? listingHref(targetId) : '#'}
                  className="an-nick-tag"
                  style={{ fontSize: `${size}px` }}
                  title={`${count} mention${count > 1 ? 's' : ''} across ${ids.length} listing${ids.length > 1 ? 's' : ''}`}
                >
                  {nick}
                  <span className="an-nick-count">{count}</span>
                </a>
              );
            })}
          </div>
        </section>

        {/* Geographic Coverage */}
        <section className="an-card">
          <h2>Geographic Coverage</h2>
          <div className="an-bars">
            {data.cities.map(([city, count]) => (
              <Bar key={city} label={city} value={count} max={maxCity} />
            ))}
          </div>
        </section>

        {/* Source Channels */}
        <section className="an-card">
          <h2>Source Channel Mix</h2>
          <p className="an-card-sub">Which Telegram channels are surfacing the most distinct businesses.</p>
          <div className="an-bars">
            {data.channels.map(([ch, count]) => (
              <Bar key={ch} label={ch.replace('@', '').slice(0, 22)} value={count} max={maxChannel} color="var(--color-status)" />
            ))}
          </div>
        </section>

        {/* Contact-channel mix */}
        <section className="an-card">
          <h2>How They Want To Be Reached</h2>
          <p className="an-card-sub">Most parlours expose all three (phone, LINE, Maps); a meaningful tail is LINE-first.</p>
          <div className="an-bars">
            {data.contactRows.map(([label, count]) => (
              <Bar key={label} label={label} value={count} max={maxContact} color="var(--color-data)" />
            ))}
          </div>
        </section>

        <section className="an-card">
          <h2>Field Completeness</h2>
          <p className="an-card-sub">
            Which structured fields the extraction pipeline successfully captured. Contact-complete rows: <strong style={{ color: 'var(--color-action)' }}>{data.contactCompleteCount}</strong> of {data.total}.
          </p>
          <div className="an-bars">
            {data.completenessRows.map(([label, count]) => (
              <Bar key={label} label={`${label} · ${formatPercent(count, data.total)}`} value={count} max={maxCompleteness} color="var(--color-status)" />
            ))}
          </div>
        </section>

        {/* Operating-hours pattern */}
        <section className="an-card">
          <h2>Operating-Hours Pattern</h2>
          <p className="an-card-sub">Late-night and 24-hour service is rarer than the stereotype suggests — most close before midnight.</p>
          <div className="an-bars">
            {data.hoursRows.map(([label, count]) => (
              <Bar key={label} label={label} value={count} max={Math.max(...data.hoursRows.map((r) => r[1]))} color="var(--color-action)" />
            ))}
          </div>
        </section>

        {/* Price histogram */}
        <section className="an-card">
          <h2>Price Distribution</h2>
          <p className="an-card-sub">
            {data.priceCount > 0
              ? `${data.priceCount} parlours posted a numeric rate. Mean ${data.priceMean?.toLocaleString()} THB, range ${data.priceMin?.toLocaleString()}–${data.priceMax?.toLocaleString()}.`
              : 'No numeric prices posted in the current dataset.'}
          </p>
          <div className="an-bars">
            {Object.entries(data.priceBuckets).map(([label, count]) => (
              <Bar key={label} label={`${label} THB`} value={count} max={maxPrice} color="var(--color-action)" />
            ))}
          </div>
        </section>

        {/* Photo density */}
        <section className="an-card">
          <h2>Photo Density per Listing</h2>
          <p className="an-card-sub">{data.totalPhotos} photos are attached to current listing rows · mean {data.meanPhotos} per listing. The full raw archive contains {data.corpusCounts.archivedPhotos.toLocaleString()} photos.</p>
          <div className="an-bars">
            {Object.entries(data.photoBuckets).map(([label, count]) => (
              <Bar key={label} label={`${label} photos`} value={count} max={maxPhoto} color="var(--color-data)" />
            ))}
          </div>
        </section>

        <section className="an-card an-wide">
          <h2>Market Extremes · Outlier Board</h2>
          <p className="an-card-sub">
            Quick reads from the edges of the corpus: cheapest posted rates, premium rates, photo-rich rows, and listings with the most complete contact surface.
          </p>
          <div className="an-outlier-grid">
            <div className="an-outlier-panel">
              <span className="section-kicker">LOWEST POSTED RATES</span>
              <div className="an-table an-table-mini">
                {data.cheapestListings.map(({ listing, value }) => (
                  <a key={listing.id} href={listingHref(listing.id)} className="an-table-row an-table-row-link an-mini-row">
                    <span>{listing.name || '—'}</span>
                    <strong>{value.toLocaleString()} THB</strong>
                  </a>
                ))}
              </div>
            </div>
            <div className="an-outlier-panel">
              <span className="section-kicker">HIGHEST POSTED RATES</span>
              <div className="an-table an-table-mini">
                {data.priciestListings.map(({ listing, value }) => (
                  <a key={listing.id} href={listingHref(listing.id)} className="an-table-row an-table-row-link an-mini-row">
                    <span>{listing.name || '—'}</span>
                    <strong>{value.toLocaleString()} THB</strong>
                  </a>
                ))}
              </div>
            </div>
            <div className="an-outlier-panel">
              <span className="section-kicker">MOST PHOTOGRAPHED</span>
              <div className="an-table an-table-mini">
                {data.mostPhotographed.slice(0, 5).map((listing) => (
                  <a key={listing.id} href={listingHref(listing.id)} className="an-table-row an-table-row-link an-mini-row">
                    <span>{listing.name || '—'}</span>
                    <strong>{getPhotoCount(listing)}</strong>
                  </a>
                ))}
              </div>
            </div>
            <div className="an-outlier-panel">
              <span className="section-kicker">MOST CONTACTABLE</span>
              <div className="an-table an-table-mini">
                {data.mostContactable.slice(0, 5).map((listing) => (
                  <a key={listing.id} href={listingHref(listing.id)} className="an-table-row an-table-row-link an-mini-row">
                    <span>{listing.name || '—'}</span>
                    <strong>{getContactChannelCount(listing)} channels</strong>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Vintage */}
        <section className="an-card">
          <h2>Listing Vintage</h2>
          <p className="an-card-sub">When the AI pipeline first ingested each parlour. The directory has natural seasonality.</p>
          <div className="an-bars">
            {data.monthRows.map(([month, count]) => (
              <Bar key={month} label={month} value={count} max={maxMonth} color="var(--color-status)" />
            ))}
          </div>
        </section>

        {/* Peak Advertising Hours */}
        <section className="an-card">
          <h2>Peak Advertising Hours</h2>
          <p className="an-card-sub">
            Bangkok time. Peak posting at <strong>{data.peakHour ?? '—'}:00</strong>.
          </p>
          <div className="an-hour-chart">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="an-hour-bar">
                <div className="an-hour-fill" style={{ height: `${(data.postingHours[h] || 0) / maxHour * 100}%` }} />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Day of Week */}
        <section className="an-card">
          <h2>Weekly Posting Rhythm</h2>
          <div className="an-hour-chart an-day-chart">
            {data.postingDays.map((count, i) => (
              <div key={i} className="an-hour-bar">
                <div className="an-hour-fill an-day-fill" style={{ height: `${count / maxDay * 100}%` }} />
                <span>{data.dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Credibility distribution — composite score over the directory */}
        {data.credibility && (
          <section className="an-card an-wide">
            <h2>Credibility Distribution</h2>
            <p className="an-card-sub">
              Per-listing composite of mention volume, contact-channel breadth, photo count, description quality, and freshness. Median <strong style={{ color: 'var(--color-action)' }}>{data.credibility.median}/100</strong>, mean {data.credibility.mean} across {data.credibility.n} listings. The histogram reveals the population shape — a healthy directory is concentrated in 40–80, not piled at the floor.
            </p>
            <div className="an-bars">
              {Object.entries(data.credibility.buckets).map(([label, count]) => (
                <Bar key={label} label={label} value={count} max={Math.max(...Object.values(data.credibility.buckets), 1)} color="var(--color-action)" />
              ))}
            </div>
            <div className="an-table" style={{ marginTop: '1rem' }}>
              <div className="an-table-head">
                <span>Most credible parlour</span><span>City</span><span>Mentions</span><span>Score</span>
              </div>
              {data.credibility.top.map((l) => (
                <a key={l.id} href={listingHref(l.id)} className="an-table-row an-table-row-link">
                  <span>{l.name?.slice(0, 32)}</span>
                  <span>{l.city || '-'}</span>
                  <span>{l.mention_count}</span>
                  <strong>{Math.round(l._cred)}</strong>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Discovered lexicon — n-gram mining surface */}
        {data.discoveredLexicon && data.discoveredLexicon.length > 0 && (
          <section className="an-card">
            <h2>Discovered Lexicon</h2>
            <p className="an-card-sub">
              Tokens that appear in many listings but aren't yet in the controlled service-tag vocabulary. Strong candidates for the next iteration of the AI extraction prompt. Source: descriptions + raw_text, document-frequency ≥ 4.
            </p>
            <div className="an-sentiment-cloud">
              {data.discoveredLexicon.map(({ token, df }) => (
                <div key={token} className="an-sentiment-tag">
                  <span className="an-sentiment-label">{token}</span>
                  <span className="an-sentiment-count">{df}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Location atlas — Bangkok geographic substrate */}
        {data.locationAtlas && (
          <section className="an-card">
            <h2>Location Atlas</h2>
            <p className="an-card-sub">
              The Bangkok geographic substrate the community is naming — sois, roads, hubs, and the one BTS station that surfaces in this corpus.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {data.locationAtlas.soi.length > 0 && (
                <div>
                  <span className="section-kicker">TOP SOIs</span>
                  <div className="an-bars" style={{ marginTop: '0.5rem' }}>
                    {data.locationAtlas.soi.slice(0, 8).map((s) => (
                      <Bar key={s.term} label={`ซ. ${s.term}`} value={s.count} max={data.locationAtlas.soi[0].count} color="var(--color-data)" />
                    ))}
                  </div>
                </div>
              )}
              {data.locationAtlas.road.length > 0 && (
                <div>
                  <span className="section-kicker">TOP ROADS</span>
                  <div className="an-bars" style={{ marginTop: '0.5rem' }}>
                    {data.locationAtlas.road.slice(0, 8).map((s) => (
                      <Bar key={s.term} label={`ถ. ${s.term}`} value={s.count} max={data.locationAtlas.road[0].count} color="var(--color-status)" />
                    ))}
                  </div>
                </div>
              )}
              {data.locationAtlas.rama.length > 0 && (
                <div>
                  <span className="section-kicker">RAMA HUBS</span>
                  <div className="an-bars" style={{ marginTop: '0.5rem' }}>
                    {data.locationAtlas.rama.slice(0, 6).map((s) => (
                      <Bar key={s.term} label={s.term} value={s.count} max={data.locationAtlas.rama[0].count} color="var(--color-action)" />
                    ))}
                  </div>
                </div>
              )}
              {data.locationAtlas.bts.length > 0 && (
                <div>
                  <span className="section-kicker">BTS STATIONS</span>
                  <div className="an-bars" style={{ marginTop: '0.5rem' }}>
                    {data.locationAtlas.bts.slice(0, 6).map((s) => (
                      <Bar key={s.term} label={`BTS ${s.term}`} value={s.count} max={data.locationAtlas.bts[0].count} color="var(--color-data)" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Statistical instruments — the mathematical-genius layer.
            Four cards: channel SNR, channel entropy, mention power-law,
            lifecycle half-life. Each is a real quantity computed from
            the row set, not a vibe. */}
        <section className="an-card an-wide">
          <h2>Statistical Instruments</h2>
          <p className="an-card-sub">
            Four real quantities the pipeline computes on the live row set. Numbers you can interrogate, not aesthetic flourish.
          </p>
          <div className="an-stats-grid">
            <Stat label="Channel Entropy H · bits" value={data.channelEntropy?.h ?? '—'} unit={` / ${data.channelEntropy?.hMax ?? '—'}`} />
            <Stat label="Channel Diversity (H/Hₘₐₓ)" value={data.channelEntropy ? Math.round(data.channelEntropy.evenness * 100) : '—'} unit="%" />
            <Stat label="Power-Law Exponent α" value={data.mentionPower?.alpha ?? '—'} unit="" />
            <Stat label="Power-Law Fit R²" value={data.mentionPower?.r2 ?? '—'} unit="" />
          </div>
          <p className="an-card-sub" style={{ marginTop: '1rem' }}>
            <strong style={{ color: 'var(--color-action)' }}>How to read</strong> · Channel entropy <code>H = -Σ pᵢ log₂ pᵢ</code> at <strong>{data.channelEntropy?.h ?? '—'}</strong> bits across <strong>{data.channelEntropy?.k ?? '—'}</strong> sources tells you how spread out the directory's discovery is. Maximum possible is <strong>{data.channelEntropy?.hMax ?? '—'}</strong> bits (every channel equally productive). The current evenness ratio of <strong>{data.channelEntropy ? Math.round(data.channelEntropy.evenness * 100) : '—'}%</strong> reveals one or two dominant feeds.
          </p>
          <p className="an-card-sub">
            Mention rank vs. count is fit by ordinary least squares on log-log axes: <code>log Cₖ = log C₁ - α · log k</code>. The estimated <strong style={{ color: 'var(--color-action)' }}>α = {data.mentionPower?.alpha ?? '—'}</strong> with <strong>R² = {data.mentionPower?.r2 ?? '—'}</strong> over <strong>{data.mentionPower?.n ?? '—'}</strong> ranked listings. A clean Zipf law (α near 1.0) would mean the most-talked-about parlour gets ~10× the chatter of the 10th, ~100× the 100th. Our directory's α captures the actual concentration of attention.
          </p>
        </section>

        {/* Channel signal-to-noise table */}
        <section className="an-card an-wide">
          <h2>Channel Signal-to-Noise</h2>
          <p className="an-card-sub">
            Per channel: how many distinct listings it surfaces (signal) versus how many total mentions it generates (volume). Ratio is the discovery rate — closer to 1.0 = each post is a new place, closer to 0 = the channel echoes a small set repeatedly.
          </p>
          <div className="an-table">
            <div className="an-table-head an-table-head-snr">
              <span>Channel</span>
              <span>Listings</span>
              <span>Mentions</span>
              <span>SNR</span>
              <span>Discovery</span>
            </div>
            {data.channelSNR.map((row) => {
              const pct = Math.min(100, Math.round(row.snr * 100));
              return (
                <div key={row.ch} className="an-table-row an-table-row-snr">
                  <span>@{row.ch}</span>
                  <span>{row.listings}</span>
                  <span>{row.mentions}</span>
                  <strong>{row.snr.toFixed(3)}</strong>
                  <span>
                    <span className="an-snr-track">
                      <span className="an-snr-fill" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Power-law / Zipf scatter — log-log */}
        {data.mentionPower && (
          <section className="an-card">
            <h2>Mention Distribution · Power Law</h2>
            <p className="an-card-sub">
              Log-log scatter of rank vs. mention count for {data.mentionPower.n} listings. The fitted line is <code>log C = {(Math.log(data.mentionPower.points[0].count) - data.mentionPower.points[0].rank * 0).toFixed(2)} - {data.mentionPower.alpha}·log k</code>.
            </p>
            <PowerLawChart data={data.mentionPower} />
          </section>
        )}

        {/* Lifecycle half-life */}
        {data.lifecycle && (
          <section className="an-card">
            <h2>Listing Half-Life</h2>
            <p className="an-card-sub">
              For each listing, days elapsed between first observation and most recent activity. Median <strong style={{ color: 'var(--color-action)' }}>{data.lifecycle.median}d</strong>, mean {data.lifecycle.mean}d, max {data.lifecycle.max}d across {data.lifecycle.n} listings.
            </p>
            <div className="an-bars">
              {Object.entries(data.lifecycle.buckets).map(([label, count]) => (
                <Bar key={label} label={label} value={count} max={Math.max(...Object.values(data.lifecycle.buckets), 1)} color="var(--color-data)" />
              ))}
            </div>
          </section>
        )}

        {/* Phone clusters — surprising fact */}
        {data.phoneClusters.length > 0 && (
          <section className="an-card an-wide">
            <h2>Multi-Listing Operators</h2>
            <p className="an-card-sub">
              These phone numbers appear on more than one listing — often a single operator running multiple posts under different staff names. The strongest dedup signal in our pipeline.
            </p>
            <div className="an-table">
              <div className="an-table-head">
                <span>Phone</span><span>Listings sharing it</span><span>Sample names</span><span>Mentions</span>
              </div>
              {data.phoneClusters.map(([phone, ls]) => (
                <div key={phone} className="an-table-row">
                  <span>{formatTelDisplay(phone) || phone}</span>
                  <span>{ls.length}</span>
                  <span>
                    {ls.slice(0, 3).map((l) => (
                      <a key={l.id} href={listingHref(l.id)} className="an-table-link">{l.name?.slice(0, 18)}</a>
                    )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                    {ls.length > 3 ? ` +${ls.length - 3}` : ''}
                  </span>
                  <strong>{ls.reduce((sum, l) => sum + (l.mention_count || 0), 0)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="an-card an-wide">
          <h2>Freshest Source Posts</h2>
          <p className="an-card-sub">
            Newest-first sanity check for the live corpus. This reads <code>posted_at → updated_at → created_at</code>, so resurfaced businesses rise when the community talks about them again.
          </p>
          <div className="an-table">
            <div className="an-table-head">
              <span>Business</span><span>Source</span><span>City</span><span>Seen</span>
            </div>
            {data.freshestListings.map((listing) => (
              <a key={listing.id} href={listingHref(listing.id)} className="an-table-row an-table-row-link">
                <span>{listing.name?.slice(0, 34) || '—'}</span>
                <span>{(listing.source_channel || 'unknown').replace(/^@/, '').slice(0, 22)}</span>
                <span>{listing.city || '-'}</span>
                <strong>{formatDateShort(getLatestSourceTime(listing))}</strong>
              </a>
            ))}
          </div>
        </section>

        {/* Most mentioned — clickable */}
        <section className="an-card an-wide">
          <h2>Most Active Advertisers</h2>
          <p className="an-card-sub">Businesses ranked by mention count from Telegram channels. Click any row to open the listing.</p>
          <div className="an-table">
            <div className="an-table-head">
              <span>Business</span><span>City</span><span>Phone</span><span>Mentions</span>
            </div>
            {data.topMentioned.map((l) => (
              <a key={l.id} href={listingHref(l.id)} className="an-table-row an-table-row-link">
                <span>{l.name?.slice(0, 32)}</span>
                <span>{l.city || '-'}</span>
                <span>{formatTelDisplay(l.phone) || l.phone || '-'}</span>
                <strong>{l.mention_count}</strong>
              </a>
            ))}
          </div>
        </section>

        {/* Full directory — every parlour, dense, clickable */}
        <section className="an-card an-wide">
          <h2>Full Directory · {data.total} listings</h2>
          <p className="an-card-sub">
            Every business in the dataset, ordered by mention count then recency. Photos · contact channels · last seen. Tap a row to open the source listing.
          </p>
          <div className="an-table an-table-dense">
            <div className="an-table-head an-table-head-7">
              <span>Business</span>
              <span>City</span>
              <span>Phone</span>
              <span>Photos</span>
              <span>Contact</span>
              <span>Last seen</span>
              <span>Mentions</span>
            </div>
            {data.fullDirectory.map((l) => {
              const photoCount = Array.isArray(l.photo_urls) ? l.photo_urls.length : 0;
              const channels = [];
              if (l.phone) channels.push('Tel');
              if (l.line_url) channels.push('LINE');
              if (l.maps_url) channels.push('Map');
              const lastSeen = new Date(l.updated_at || l.created_at);
              const lastSeenLabel = isNaN(lastSeen.getTime())
                ? '—'
                : `${lastSeen.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
              return (
                <a key={l.id} href={listingHref(l.id)} className="an-table-row an-table-row-link an-table-row-7">
                  <span title={l.name}>{(l.name || '—').slice(0, 28)}</span>
                  <span>{l.city || '-'}</span>
                  <span>{formatTelDisplay(l.phone) || l.phone || '-'}</span>
                  <span>{photoCount}</span>
                  <span>{channels.join(' · ') || '—'}</span>
                  <span>{lastSeenLabel}</span>
                  <strong>{l.mention_count || 0}</strong>
                </a>
              );
            })}
          </div>
        </section>

        {/* Patterns Into Products — six corpus-derived surfaces.
            Each is a real query against patterns.json, baked at build time. */}
        {patterns && (
          <>
            <section className="an-card an-wide">
              <h2>Patterns Into Products</h2>
              <p className="an-card-sub">
                Six surfaces the corpus surfaced (Methodology §08). Each here is rendered from real precomputed data — operator clusters, provider mention indexes, channel tier splits, geographic heat, photo-reuse fingerprints, whisper-network safety idioms.
              </p>
              <div className="an-stats-grid">
                <Stat label="Operators tracked" value={patterns.operators.length} />
                <Stat label="Providers indexed" value={patterns.providers.length} />
                <Stat label="Channel tiers" value={patterns.channelTiers.aggregators.length + patterns.channelTiers.boutique.length} />
                <Stat label="Whisper flags" value={patterns.whisperSafety.flaggedListings.length} />
              </div>
            </section>

            {/* Pattern 1 — Operator Profile Builder */}
            <section className="an-card an-wide">
              <h2>① Operator Profiles</h2>
              <p className="an-card-sub">
                Phone-anchored operator entities. {patterns.operators.filter((o) => o.branchCount > 1).length === 0
                  ? `All ${patterns.operators.length} phone-anchored operators are single-branch in the current canonical set — the dedup pipeline successfully collapses each operator to one record. The framework is ready to surface multi-branch operators (LOUISSPA-style chains) as soon as new data arrives that carries them.`
                  : `${patterns.operators.filter((o) => o.branchCount > 1).length} multi-branch operators tracked across ${patterns.operators.length} phone identities.`}
              </p>
              <div className="an-table">
                <div className="an-table-head">
                  <span>Operator</span><span>Branches</span><span>Channels</span><span>Mentions</span>
                </div>
                {patterns.operators.slice(0, 12).map((op) => (
                  <a key={op.phone} href={op.listingIds[0] ? listingHref(op.listingIds[0]) : '#'} className="an-table-row an-table-row-link">
                    <span>{op.operatorName?.slice(0, 32)}</span>
                    <span>{op.branchCount}</span>
                    <span>{op.channelCount}</span>
                    <strong>{op.totalMentions}</strong>
                  </a>
                ))}
              </div>
            </section>

            {/* Pattern 2 — Provider Reputation Index */}
            <section className="an-card an-wide">
              <h2>② Provider Reputation Index</h2>
              <p className="an-card-sub">
                Thai community posts reference workers by nickname (น้อง / แม่ / พี่ / อ.). The index tracks each nickname across listings, channels, and time — productised: a worker-side reputation profile that follows providers between employers. {patterns.providers.length} nicknames currently indexed.
              </p>
              <div className="an-table">
                <div className="an-table-head">
                  <span>Nickname</span><span>Listings</span><span>Channels</span><span>Mentions</span>
                </div>
                {patterns.providers.slice(0, 16).map((p) => (
                  <a key={p.nickname} href={p.listingIds[0] ? listingHref(p.listingIds[0]) : '#'} className="an-table-row an-table-row-link">
                    <span>น้อง {p.nickname}</span>
                    <span>{p.listingCount}</span>
                    <span>{p.channelCount}</span>
                    <strong>{p.mentions}</strong>
                  </a>
                ))}
              </div>
            </section>

            {/* Pattern 3 — Channel Tiers */}
            <section className="an-card an-wide">
              <h2>③ Channel Tiers · discovery vs volume</h2>
              <p className="an-card-sub">
                Channels split cleanly into <strong style={{ color: 'var(--color-action)' }}>aggregators</strong> (high message volume, low listing-SNR — they amplify what the community is already saying) and <strong style={{ color: 'var(--color-status)' }}>boutique</strong> (low volume, ≥ 10% listing-SNR — single-business marketing feeds). Each is a product surface: aggregators power volume / discovery queries; boutiques power "follow this parlour" subscriptions.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <span className="section-kicker">AGGREGATORS</span>
                  <div className="an-table" style={{ marginTop: '0.5rem' }}>
                    <div className="an-table-head"><span>Channel</span><span>Total</span><span>Listings</span><span>SNR</span></div>
                    {patterns.channelTiers.aggregators.map((c) => (
                      <div key={c.channel} className="an-table-row">
                        <span>{c.channel}</span>
                        <span>{c.msgsTotal.toLocaleString()}</span>
                        <span>{c.listings}</span>
                        <strong style={{ color: 'var(--color-action)' }}>{(c.snr * 100).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="section-kicker">BOUTIQUE</span>
                  <div className="an-table" style={{ marginTop: '0.5rem' }}>
                    <div className="an-table-head"><span>Channel</span><span>Total</span><span>Listings</span><span>SNR</span></div>
                    {patterns.channelTiers.boutique.filter((c) => c.channel !== 'unknown').map((c) => (
                      <div key={c.channel} className="an-table-row">
                        <span>{c.channel}</span>
                        <span>{c.msgsTotal.toLocaleString()}</span>
                        <span>{c.listings}</span>
                        <strong style={{ color: 'var(--color-status)' }}>{(c.snr * 100).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Pattern 4 — Geographic Heat Forecasting */}
            <section className="an-card an-wide">
              <h2>④ Geographic Heat Forecasting</h2>
              <p className="an-card-sub">
                Soi/road density gradients labelled by quartile. <span style={{ color: 'var(--color-action)' }}>HOT</span> areas (top quartile) are saturated supply — a new opening competes for attention. <span style={{ color: 'var(--color-data)' }}>EMERGING</span> areas (bottom quartile) are underserved relative to chatter — relocation / expansion advisory.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div>
                  <span className="section-kicker">SOIs</span>
                  <div className="an-bars" style={{ marginTop: '0.5rem' }}>
                    {patterns.geoHeat.soi.slice(0, 10).map((s) => (
                      <div key={s.term} className="an-bar-row">
                        <span className="an-bar-label" style={{ color: s.advisory === 'HOT' ? 'var(--color-action)' : s.advisory === 'WARM' ? 'var(--color-cream)' : 'var(--color-data)' }}>
                          {s.advisory} · ซ. {s.term}
                        </span>
                        <div className="an-bar-track">
                          <div className="an-bar-fill" style={{ width: `${s.heat}%`, background: s.advisory === 'HOT' ? 'var(--color-action)' : s.advisory === 'EMERGING' ? 'var(--color-data)' : 'var(--color-cream-soft)' }} />
                        </div>
                        <span className="an-bar-val">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="section-kicker">ROADS</span>
                  <div className="an-bars" style={{ marginTop: '0.5rem' }}>
                    {patterns.geoHeat.road.slice(0, 10).map((r) => (
                      <div key={r.term} className="an-bar-row">
                        <span className="an-bar-label" style={{ color: r.advisory === 'HOT' ? 'var(--color-action)' : r.advisory === 'WARM' ? 'var(--color-cream)' : 'var(--color-data)' }}>
                          {r.advisory} · ถ. {r.term}
                        </span>
                        <div className="an-bar-track">
                          <div className="an-bar-fill" style={{ width: `${r.heat}%`, background: r.advisory === 'HOT' ? 'var(--color-action)' : r.advisory === 'EMERGING' ? 'var(--color-data)' : 'var(--color-cream-soft)' }} />
                        </div>
                        <span className="an-bar-val">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Pattern 5 — Photo-Reuse Fingerprinting */}
            <section className="an-card">
              <h2>⑤ Photo-Reuse Fingerprinting</h2>
              <p className="an-card-sub">
                Same image appearing under multiple listings = duplicate operator, image stockpile, or both. Cross-listing reuse detected today: <strong style={{ color: 'var(--color-action)' }}>{patterns.photoFingerprint.reusedHero.length}</strong> hero-image collisions, <strong>{patterns.photoFingerprint.reusedFilenames.length}</strong> filename collisions in <code>photo_archive</code>. {patterns.photoFingerprint.reusedHero.length === 0 ? `Today's canonical set is clean — every parlour ships a unique hero. The detector is wired and will surface authenticity penalties as new data arrives.` : `${patterns.photoFingerprint.penalisedListingCount} listings carry an authenticity penalty.`}
              </p>
              {patterns.photoFingerprint.reusedHero.slice(0, 6).map((r) => (
                <div key={r.url} className="an-table-row">
                  <span>{r.listingCount} listings share this image</span>
                  <strong>—</strong>
                </div>
              ))}
            </section>

            {/* Pattern 6 — Whisper-Network Safety */}
            <section className="an-card">
              <h2>⑥ Whisper-Network Safety</h2>
              <p className="an-card-sub">
                Discussion + feedback messages mined for negative idioms (อย่าไป, ไม่แนะนำ, scam, fake, overpriced…). Idioms tracked: <strong>{patterns.whisperSafety.idiomFrequency.length}</strong>. Listings flagged today: <strong style={{ color: 'var(--color-action)' }}>{patterns.whisperSafety.flaggedListings.length}</strong>. Coverage will expand once <code>linked_listing_id</code> is populated on <code>channel_messages</code> (findings §1.1) — currently using fuzzy name-match.
              </p>
              {patterns.whisperSafety.idiomFrequency.length > 0 && (
                <div className="an-sentiment-cloud" style={{ marginTop: '0.75rem' }}>
                  {patterns.whisperSafety.idiomFrequency.slice(0, 12).map((i) => (
                    <div key={i.label} className="an-sentiment-tag">
                      <span className="an-sentiment-label">{i.label}</span>
                      <span className="an-sentiment-count">{i.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {patterns.whisperSafety.flaggedListings.length > 0 && (
                <div className="an-table" style={{ marginTop: '0.75rem' }}>
                  <div className="an-table-head"><span>Listing</span><span>Flags</span><span>Idioms</span></div>
                  {patterns.whisperSafety.flaggedListings.slice(0, 8).map((f) => (
                    <a key={f.id} href={listingHref(f.id)} className="an-table-row an-table-row-link">
                      <span>id {f.id}</span>
                      <span>{f.flagCount}</span>
                      <strong style={{ color: 'var(--color-action)' }}>{f.idioms.join(', ')}</strong>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Grey Score Distribution ──────────────────────────────────────── */}
      <section className="an-card an-wide an-grey-section">
        <h2>Grey Score Distribution · Corpus-Wide</h2>
        <p className="an-card-sub">
          Each of {data.total} indexed listings is scored against 12 content signals derived from the alibi research.
          Baseline is 35%: the corpus is built on shared vocabulary — in the supply-side text, สายขาว and สายดำ are
          indistinguishable. These are probability distributions, not verdicts.
        </p>
        <div className="an-grey-dist">
          {[
            { level: 'legit',     label: 'LIKELY LEGIT',  color: '#34d399', note: 'Traditional keywords · Maps-confirmed · full service menu' },
            { level: 'ambiguous', label: 'AMBIGUOUS',     color: '#948499', note: 'Shared alibi vocabulary — indeterminate from text alone' },
            { level: 'grey',      label: 'GREY SIGNAL',   color: '#f59e0b', note: 'Oil-only · outcall · high repeat-post rate · alibi price range' },
            { level: 'strong',    label: 'STRONG GREY',   color: '#ff7440', note: 'NSFW-flagged · coded vocabulary · explicit service tags' },
          ].map(({ level, label, color, note }) => {
            const count = greyDist[level] || 0;
            const pct = ((count / greyTotal) * 100).toFixed(1);
            return (
              <div key={level} className="an-grey-row">
                <span className="an-grey-label" style={{ color }}>{label}</span>
                <div className="an-grey-track">
                  <div className="an-grey-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="an-grey-stat">{count}<small> / {pct}%</small></span>
                <span className="an-grey-note">{note}</span>
              </div>
            );
          })}
        </div>
        <p className="an-grey-caveat">
          The same oil-and-aroma vocabulary that marks a grey listing also appears in fully legitimate spas.
          A high score means signals are present; it does not mean the establishment is unsafe.
          The system scores the text, not the room.
        </p>
      </section>

      <footer className="an-footer">
        <p>Every figure traces back to a specific listing. Click any row to read the source post. Data updated in real time by the Sabai Sabai AI pipeline.</p>
        <a href="/">← {pc.backToDirectory || 'Back to Directory'}</a>
      </footer>
    </div>
  );
}
