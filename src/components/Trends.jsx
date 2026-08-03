import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageBanner from './PageBanner';
import './Trends.css';

const CATEGORIES = ['ALL', 'MARKET', 'CULTURAL', 'POLITICAL', 'ECONOMIC', 'INTERNATIONAL'];
const SENTIMENTS = ['All', 'Positive', 'Negative', 'Speculative', 'Mixed'];

const SENT_COLOR = {
  positive:    '#2fe0a6',
  negative:    '#ff5c7a',
  speculative: '#ffd23d',
  mixed:       '#9fc2ff',
  neutral:     '#948499',
};

const CAT_COLOR = {
  market:        '#36c7ff',
  cultural:      '#2fe0a6',
  political:     '#ff5c7a',
  economic:      '#ffd23d',
  international: '#FF3D8B',
};

const CAT_ABBR = {
  market:        'MKT',
  cultural:      'CULT',
  political:     'POL',
  economic:      'ECON',
  international: 'INTL',
};

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function buildNodes(trends, W, H) {
  const n = trends.length;
  const cx = W / 2;
  const cy = H / 2;
  // Compute safe spread: keep largest node (radius ~66px) within canvas with margin
  const maxR = 28 + Math.max(...trends.map(t => t.confidence || 50)) * 0.38;
  const spread = Math.min(W / 2 - maxR - 20, H / 2 - maxR - 20);
  return trends.map((t, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 28 + (t.confidence || 50) * 0.38;
    // Clamp target to canvas bounds
    const tx = Math.max(r + 10, Math.min(W - r - 10, cx + Math.cos(angle) * spread));
    const ty = Math.max(r + 10, Math.min(H - r - 10, cy + Math.sin(angle) * spread));
    return {
      id: t.id,
      i,
      x: tx + (Math.random() - 0.5) * 20,
      y: ty + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      tx,
      ty,
      r,
      confidence: t.confidence || 50,
      sentiment: (t.sentiment || 'neutral').toLowerCase(),
      category: (t.category || 'market').toLowerCase(),
      dimmed: false,
      phase: i * 1.13,
    };
  });
}

function simTick(nodes, alpha) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (a.dimmed) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (b.dimmed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const md = a.r + b.r + 28;
      if (d2 < md * md) {
        const d = Math.sqrt(d2) || 0.01;
        const f = ((md - d) / d) * 0.55 * alpha;
        a.vx -= dx * f; a.vy -= dy * f;
        b.vx += dx * f; b.vy += dy * f;
      }
    }
    a.vx += (a.tx - a.x) * 0.045 * alpha;
    a.vy += (a.ty - a.y) * 0.045 * alpha;
    a.vx *= 0.80;
    a.vy *= 0.80;
    a.x += a.vx;
    a.y += a.vy;
  }
}

function drawFrame(ctx, W, H, dpr, nodes, selectedId, hoveredId, t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Instrument panel grid
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  const g = 48;
  for (let x = g; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = g; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  // Cross-hairs at center
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  ctx.restore();

  // Edges (same-category connections)
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (a.category !== b.category || a.dimmed || b.dimmed) continue;
      const color = CAT_COLOR[a.category] || '#948499';
      ctx.save();
      ctx.strokeStyle = color + '22';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Nodes
  for (const node of nodes) {
    const isSel = node.id === selectedId;
    const isHov = node.id === hoveredId;
    const col = SENT_COLOR[node.sentiment] || '#948499';

    ctx.save();
    ctx.globalAlpha = node.dimmed ? 0.1 : 1;

    // Pulse ring for selected
    if (isSel && !node.dimmed) {
      const pulse = node.r + 12 + Math.sin(t * 2.1) * 4;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = col + '44';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();
      // Canvas shadow as glow (allowed — not CSS box-shadow)
      ctx.shadowColor = col;
      ctx.shadowBlur = 20;
    } else if (isHov && !node.dimmed) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
    }

    // Fill
    const fillHex = isSel ? '1e' : isHov ? '18' : '0c';
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = col + fillHex;
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([]);
    ctx.strokeStyle = col + (isSel ? 'ff' : isHov ? 'cc' : '88');
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.stroke();

    // Labels
    if (!node.dimmed) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const abbr = CAT_ABBR[node.category] || node.category.slice(0, 4).toUpperCase();
      const abbrSz = Math.max(9, Math.floor(node.r * 0.28));
      const confSz = Math.max(8, Math.floor(node.r * 0.23));

      ctx.fillStyle = col + 'ee';
      ctx.font = `700 ${abbrSz}px "JetBrains Mono", monospace`;
      ctx.fillText(abbr, node.x, node.y - 5);

      ctx.fillStyle = col + '99';
      ctx.font = `500 ${confSz}px "JetBrains Mono", monospace`;
      ctx.fillText(`${node.confidence}%`, node.x, node.y + 8);

      // Center dot
      ctx.beginPath();
      ctx.arc(node.x, node.y - 5, 2, 0, Math.PI * 2);
    }

    ctx.restore();
  }
}

export default function Trends() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeSentiment, setActiveSentiment] = useState('All');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let active = true;
    fetch('/trends.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(json => { if (active) { setData(json); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const allTrends = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data.trends) ? data.trends : Array.isArray(data) ? data : [];
  }, [data]);

  const selectedTrend = useMemo(() =>
    selectedId ? allTrends.find(t => t.id === selectedId) : null,
  [selectedId, allTrends]);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const nodesRef = useRef([]);
  const alphaRef = useRef(1);
  const hoveredIdRef = useRef(null);
  const selectedIdRef = useRef(null);
  const rafRef = useRef(null);

  // Keep selected ref in sync without restarting draw loop
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Update dimmed when filters change
  useEffect(() => {
    nodesRef.current.forEach((node, i) => {
      const t = allTrends[i];
      if (!t) return;
      const catOk = activeCategory === 'ALL' || t.category?.toUpperCase() === activeCategory;
      const sentOk = activeSentiment === 'All' || t.sentiment?.toLowerCase() === activeSentiment.toLowerCase();
      node.dimmed = !(catOk && sentOk);
    });
    alphaRef.current = Math.max(alphaRef.current, 0.5);
  }, [activeCategory, activeSentiment, allTrends]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return { W: 0, H: 0 };
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    return { W, H };
  }, []);

  // Main: init nodes + draw loop when data loads
  useEffect(() => {
    if (!allTrends.length) return;

    const { W, H } = initCanvas();
    if (!W || !H) return;

    nodesRef.current = buildNodes(allTrends, W, H);
    alphaRef.current = 1;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const dpr = window.devicePixelRatio || 1;
    let startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      const t = (ts - startTime) * 0.001;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W2 = canvas.width / dpr;
      const H2 = canvas.height / dpr;
      const nodes = nodesRef.current;

      if (alphaRef.current > 0.008) {
        simTick(nodes, alphaRef.current);
        // Wall clamping — keep nodes inside canvas bounds
        nodes.forEach(node => {
          if (node.dimmed) return;
          node.x = Math.max(node.r + 8, Math.min(W2 - node.r - 8, node.x));
          node.y = Math.max(node.r + 8, Math.min(H2 - node.r - 8, node.y));
        });
        alphaRef.current *= 0.975;
      } else {
        // Settled: gentle sinusoidal idle drift
        nodes.forEach(node => {
          if (node.dimmed) return;
          node.x = node.tx + Math.sin(t * 0.35 + node.phase) * 1.4;
          node.y = node.ty + Math.cos(t * 0.27 + node.phase * 1.3) * 1.4;
        });
      }

      drawFrame(ctx, W2, H2, dpr, nodes, selectedIdRef.current, hoveredIdRef.current, t);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [allTrends, initCanvas]);

  // Resize observer
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (!allTrends.length) return;
      const { W, H } = initCanvas();
      if (W && H) {
        nodesRef.current = buildNodes(allTrends, W, H);
        alphaRef.current = 1;
      }
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [allTrends, initCanvas]);

  // Hit test
  const findNode = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = null;
    let bestDist = Infinity;
    for (const node of nodesRef.current) {
      if (node.dimmed) continue;
      const dx = node.x - x;
      const dy = node.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= node.r + 12 && d < bestDist) { bestDist = d; best = node; }
    }
    return best;
  }, []);

  const handleMouseMove = useCallback(e => {
    const node = findNode(e.clientX, e.clientY);
    hoveredIdRef.current = node ? node.id : null;
    if (canvasRef.current) canvasRef.current.style.cursor = node ? 'pointer' : 'default';
  }, [findNode]);

  const handleMouseLeave = useCallback(() => { hoveredIdRef.current = null; }, []);

  const handleClick = useCallback(e => {
    const node = findNode(e.clientX, e.clientY);
    setSelectedId(prev => node ? (node.id === prev ? null : node.id) : null);
  }, [findNode]);

  const handleTouch = useCallback(e => {
    const touch = e.touches[0];
    if (!touch) return;
    const node = findNode(touch.clientX, touch.clientY);
    if (node) {
      e.preventDefault();
      setSelectedId(prev => node.id === prev ? null : node.id);
    }
  }, [findNode]);

  const lastUpdated = data?.last_updated || data?.updated_at || null;

  return (
    <div className="trends-page">
      <header className="trends-header">
        <span className="trends-header-label">Signal Intelligence</span>
      </header>

      <PageBanner image="/heroes/trends.jpg" tone="dark" compact ariaLabelledBy="trends-title">
        <p className="trends-masthead-kicker eyebrow">Sabai Sabai · Intelligence Engine</p>
        <h1 id="trends-title" className="trends-title">Market Intelligence</h1>
        <p className="trends-subtitle">Swarm signals from the community — click a node to read the signal</p>
      </PageBanner>

      <div className="trends-filters" role="group">
        <div className="trends-chips" aria-label="Filter by category">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`trends-chip${activeCategory === cat ? ' is-active' : ''}`}
              data-cat={cat.toLowerCase()}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          className="trends-sentiment-select"
          value={activeSentiment}
          onChange={e => setActiveSentiment(e.target.value)}
          aria-label="Filter by sentiment"
        >
          {SENTIMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && (
        <div className="trends-loading">
          <span className="trends-state-dot" />
          Loading signal…
        </div>
      )}

      {!loading && (
        <>
          <div className="trends-arena">
            <div className="trends-canvas-wrap" ref={wrapRef}>
              <canvas
                ref={canvasRef}
                className="trends-canvas"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                onTouchStart={handleTouch}
                aria-label="Market intelligence signal nodes — click to expand"
              />
              {!selectedId && allTrends.length > 0 && (
                <p className="trends-canvas-hint">Click a node to expand signal</p>
              )}
            </div>

            {selectedTrend ? (
              <DetailPanel trend={selectedTrend} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="trends-detail-placeholder">
                <span className="trends-detail-placeholder-label">Select a signal node</span>
              </div>
            )}
          </div>

          <div className="trends-legend">
            {[
              ['positive', '#2fe0a6', 'Positive'],
              ['negative', '#ff5c7a', 'Negative'],
              ['speculative', '#ffd23d', 'Speculative'],
              ['mixed', '#9fc2ff', 'Mixed'],
            ].map(([key, color, label]) => (
              <span key={key} className="trends-legend-item">
                <span className="trends-legend-dot" style={{ background: color }} />
                {label}
              </span>
            ))}
            {lastUpdated && (
              <span className="trends-legend-updated">Updated {fmtDate(lastUpdated)}</span>
            )}
          </div>
        </>
      )}

      <footer className="trends-footer">
        <span className="trends-footer-note">Sabai Sabai · Community Intelligence Platform</span>
      </footer>
    </div>
  );
}

function DetailPanel({ trend, onClose }) {
  const cat = (trend.category || 'market').toLowerCase();
  const sent = (trend.sentiment || '').toLowerCase();
  const color = SENT_COLOR[sent] || '#948499';
  const catColor = CAT_COLOR[cat] || '#948499';

  return (
    <div className="trends-detail" data-cat={cat}>
      <button className="trends-detail-close" onClick={onClose} aria-label="Close detail">×</button>

      <div className="trends-detail-eyebrow">
        <span className="trends-detail-cat" style={{ color: catColor }}>
          {trend.category?.toUpperCase()}
        </span>
        {trend.sentiment && (
          <span className="trends-detail-sent" data-sent={sent}>{trend.sentiment}</span>
        )}
        {trend.date && (
          <time className="trends-detail-date">{fmtDate(trend.date)}</time>
        )}
      </div>

      <h2 className="trends-detail-title">{trend.title}</h2>

      {trend.summary && <p className="trends-detail-summary">{trend.summary}</p>}

      {trend.confidence != null && (
        <div className="trends-detail-conf">
          <span className="trends-detail-conf-label">Confidence</span>
          <div className="trends-detail-meter">
            <div
              className="trends-detail-meter-fill"
              style={{ width: `${trend.confidence}%`, background: color }}
            />
          </div>
          <span className="trends-detail-conf-val">{trend.confidence}%</span>
        </div>
      )}

      {Array.isArray(trend.patterns) && trend.patterns.length > 0 && (
        <div className="trends-detail-patterns">
          <span className="trends-detail-patterns-label">Key Patterns</span>
          {trend.patterns.map((p, i) => (
            <div key={i} className="trends-detail-pattern">
              <span className="trends-detail-pattern-bullet" style={{ color }} aria-hidden>·</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}

      <div className="trends-detail-meta">
        {Array.isArray(trend.platforms) && trend.platforms.map(pl => (
          <span key={pl} className="trends-detail-platform">{pl}</span>
        ))}
        {trend.post_count != null && (
          <span className="trends-detail-posts">{trend.post_count.toLocaleString()} posts</span>
        )}
      </div>
    </div>
  );
}
