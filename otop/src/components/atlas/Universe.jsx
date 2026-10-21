import { useMemo, useState } from 'react';
import { Chapter, n } from './fmt.jsx';
import { LAYERS, KIND_LAYER, filterUniverse, layoutUniverse, kindMaxima, edgeWidth, rankWithinKind } from '../../../core/universe.js';

/**
 * Universe — the whole registry as one knowledge graph you can walk.
 *
 * Rings, inside out: region · category · province · basin · agency ·
 * standard · year · era, with the revenue node on the outer ring. Node area
 * scales within its own kind (baht and record counts never share a scale);
 * edge width is logarithmic in the full-corpus weight behind it. Layer
 * toggles isolate business / strategy / provenance. Search names any dot.
 * Selecting a node reports its rank within its kind and its strongest links,
 * and every link walks: provinces open their dossier, anything else selects
 * the node on the far end.
 */
const KIND_TH = {
  root: 'จักรวาล', region: 'ภูมิภาค', province: 'จังหวัด', category: 'ประเภท',
  basin: 'แหล่งผลิต', agency: 'หน่วยงาน', standard: 'มผช.', year: 'ปีที่ยื่น',
  era: 'ยุคสมัย', revenue: 'ยอดขาย',
};

const EDGE_VERB = {
  contains: 'holds', supplies: 'makes', clusters: 'clusters in', files: 'files',
  attests: 'filed in', governs: 'governs', filed: 'filed', marks: 'marks', moves: 'bought',
};

const ALWAYS_LABELED = new Set(['root', 'region', 'category', 'revenue', 'era']);

const W = 900;
const H = 620;

function fmtValue(d) {
  if (typeof d.value !== 'number') return null;
  if (d.kind === 'revenue') return `฿${(d.value / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`;
  return n(Math.round(d.value));
}

export default function Universe({ graph, go }) {
  const [layers, setLayers] = useState(['business', 'strategy', 'provenance']);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [query, setQuery] = useState('');

  const { nodes, edges } = useMemo(
    () => (graph ? filterUniverse(graph, layers) : { nodes: [], edges: [] }),
    [graph, layers],
  );
  const pos = useMemo(() => layoutUniverse(nodes, W, H), [nodes]);
  const maxima = useMemo(() => kindMaxima(nodes), [nodes]);
  const maxW = useMemo(() => Math.max(1, ...edges.map((e) => e.w ?? 0)), [edges]);
  const root = useMemo(() => nodes.find((d) => d.kind === 'root'), [nodes]);

  const radius = (d) => {
    if (d.kind === 'root') return 16;
    if (typeof d.value !== 'number' || !(maxima[d.kind] > 0)) return 4;
    return 3 + 9 * Math.sqrt(d.value / maxima[d.kind]);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return nodes.filter((d) => `${d.th ?? ''} ${d.en ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [nodes, query]);

  const matchIds = useMemo(() => new Set(matches.map((d) => d.id)), [matches]);

  const selectedEdges = useMemo(() => {
    if (!selected) return [];
    return edges
      .filter((e) => e.s === selected || e.t === selected)
      .sort((a, b) => b.w - a.w)
      .slice(0, 8);
  }, [edges, selected]);
    const byId = useMemo(() => new Map(nodes.map((d) => [d.id, d])), [nodes]);
  const connected = useMemo(() => {
    if (!selected) return null;
    const set = new Set([selected]);
    for (const e of edges) {
      if (e.s === selected) set.add(e.t);
      if (e.t === selected) set.add(e.s);
    }
    return set;
  }, [edges, selected]);
  const sel = selected ? byId.get(selected) : null;  const selRank = selected ? rankWithinKind(nodes, selected) : null;
  const selShare = sel && root && typeof sel.value === 'number' && ['province', 'category', 'region', 'basin'].includes(sel.kind)
    ? `${(sel.value / root.value * 100).toFixed(1)}% of the registry`
    : null;

  if (!graph) return null;

  const toggle = (layer) => {
    setLayers((ls) => (ls.includes(layer) ? ls.filter((l) => l !== layer) : [...ls, layer]));
    setSelected(null);
    setQuery('');
  };

  const select = (id) => {
    const d = byId.get(id);
    if (d && !(layers.includes(KIND_LAYER[d.kind] ?? 'business') || d.kind === 'root')) {
      setLayers((ls) => [...ls, KIND_LAYER[d.kind]]);
    }
    setSelected((s) => (s === id ? null : id));
  };

  const onNode = (d) => {
    if (d.kind === 'province' && d.code != null) { go(d.code); return; }
    select(d.id);
  };

  const walk = (id) => {
    const d = byId.get(id);
    if (!d) return;
    if (d.kind === 'province' && d.code != null) { go(d.code); return; }
    select(id);
  };

  const labelOf = (d) => d.th ?? d.en;

  return (
    <Chapter id="universe" title="Universe" th="จักรวาลความเชื่อมโยง">
      <p className="t-note">
        {n(graph.counts.nodes)} nodes · {n(graph.counts.edges)} edges · built {String(graph.builtAt).slice(0, 10)}.
        Business is what is made where, strategy is when the program moved, provenance is
        who filed it and which specification governs it. Click any province to open it;
        click anything else to walk its strongest links.
      </p>
      <div className="t-legend" role="group" aria-label="Graph layers">
        {LAYERS.map((l) => (
          <button key={l} type="button" className="reset" aria-pressed={layers.includes(l)} onClick={() => toggle(l)}>
            [{layers.includes(l) ? '●' : '○'}] {l}
          </button>
        ))}
        <span className="t-row-en">{nodes.length} nodes · {edges.length} edges in view</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', margin: '0.5rem 0' }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a province, agency, standard…"
          aria-label="Find a node in the graph"
          style={{ flex: 1, font: 'inherit', padding: '0.3rem 0.5rem', background: 'var(--bg)', color: 'inherit', border: '1px solid var(--line-2)' }}
        />
        {query && (
          <button type="button" className="reset" onClick={() => setQuery('')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>
      {matches.length > 0 && (
        <div className="t-legend" role="group" aria-label="Search matches">
          {matches.map((d) => (
            <button key={d.id} type="button" className="reset" onClick={() => select(d.id)} style={{ textDecoration: selected === d.id ? 'none' : 'underline', cursor: 'pointer' }}>
              {selected === d.id ? `[${labelOf(d)}]` : labelOf(d)} <span className="t-row-en">{KIND_TH[d.kind] ?? d.kind}</span>
            </button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="OTOP universe knowledge graph" style={{ width: '100%', border: '1px solid var(--line-2)', background: 'var(--bg-2)' }}>
        {edges.map((e, i) => {
          const a = pos.get(e.s);
          const b = pos.get(e.t);
          if (!a || !b) return null;
          const hot = selected && (e.s === selected || e.t === selected);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? '#f59e0b' : 'currentColor'} strokeOpacity={hot ? 0.9 : 0.14} strokeWidth={hot ? 1.8 : edgeWidth(e.w, maxW)} />;
        })}
        {nodes.map((d) => {
          const p = pos.get(d.id);
          if (!p) return null;
          const hot = selected === d.id || hover === d.id || matchIds.has(d.id);
          const labeled = ALWAYS_LABELED.has(d.kind) || hot;
          const dimmed = connected && !connected.has(d.id);
          return (
            <g
              key={d.id}
              transform={`translate(${p.x},${p.y})`}
              onClick={() => onNode(d)}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover((h) => (h === d.id ? null : h))}
              style={{ cursor: 'pointer' }}
              opacity={dimmed ? 0.3 : 1}
            >
              <title>{`${labelOf(d)} · ${fmtValue(d) ?? KIND_TH[d.kind] ?? d.kind}`}</title>
              <circle r={radius(d) + (hot && selected !== d.id ? 1.5 : 0)} fill={hot ? '#f59e0b' : d.kind === 'root' ? 'currentColor' : 'var(--bg)'} stroke={hot ? '#f59e0b' : 'currentColor'} strokeWidth={d.kind === 'root' ? 2 : 1.2} />
              {labeled && (
                <text y={radius(d) + 11} textAnchor="middle" fontSize="9" fill="currentColor">{labelOf(d)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="t-legend">
        {Object.keys(KIND_TH).map((k) => <span key={k}>{k}</span>)}
      </div>
      {sel && (
        <div className="t-rows">
          <div className="t-row t-row-hd">
            <span className="t-rail" />
            <span>{labelOf(sel)} · {KIND_TH[sel.kind] ?? sel.kind}{selRank ? ` · #${selRank.rank} of ${selRank.of}` : ''}{selShare ? ` · ${selShare}` : ''}</span>
            <span className="t-row-num">{fmtValue(sel) ?? '—'}</span>
          </div>
          {selectedEdges.map((e, i) => {
            const other = byId.get(e.s === selected ? e.t : e.s);
            const label = other ? labelOf(other) : e.s;
            return (
              <button type="button" className="t-row reset" key={i} onClick={() => walk(e.s === selected ? e.t : e.s)} style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <span className="t-rail" />
                <span><span className="t-row-th">{label}</span> <span className="t-row-en">{EDGE_VERB[e.kind] ?? e.kind}{other?.kind === 'province' ? ' →' : ''}</span></span>
                <span className="t-row-num">{n(e.w)}</span>
              </button>
            );
          })}
        </div>
      )}
      {!sel && <p className="t-note">Provinces leave this map for their dossier; every other link walks to the node on its far end. Search names any dot.</p>}
    </Chapter>
  );
}
