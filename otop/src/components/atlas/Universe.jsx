import { useMemo, useState } from 'react';
import { Chapter, n } from './fmt.jsx';
import { LAYERS, filterUniverse, layoutUniverse } from '../../../core/universe.js';

/**
 * Universe — the whole registry as one knowledge graph.
 *
 * Rings, inside out: region · category · province · basin · agency ·
 * standard · year · era, with the revenue node on the outer ring. Node area
 * scales with the count behind it; every edge weight is a full-corpus count
 * from `otop_graph.json`. Layer toggles isolate business / strategy /
 * provenance. Clicking a province opens its dossier.
 */
const KIND_TH = {
  root: 'จักรวาล', region: 'ภูมิภาค', province: 'จังหวัด', category: 'ประเภท',
  basin: 'แหล่งผลิต', agency: 'หน่วยงาน', standard: 'มผช.', year: 'ปีที่ยื่น',
  era: 'ยุคสมัย', revenue: 'ยอดขาย',
};

const W = 900;
const H = 620;

export default function Universe({ graph, go }) {
  const [layers, setLayers] = useState(['business', 'strategy', 'provenance']);
  const [selected, setSelected] = useState(null);

  const { nodes, edges } = useMemo(
    () => (graph ? filterUniverse(graph, layers) : { nodes: [], edges: [] }),
    [graph, layers],
  );
  const pos = useMemo(() => layoutUniverse(nodes, W, H), [nodes]);
  const maxValue = Math.max(1, ...nodes.map((d) => d.value ?? 0));
  const radius = (d) => {
    if (d.kind === 'root') return 16;
    if (d.value == null) return 4;
    return 3 + 9 * Math.sqrt(d.value / maxValue);
  };
  const selectedEdges = useMemo(() => {
    if (!selected) return [];
    return edges
      .filter((e) => e.s === selected || e.t === selected)
      .sort((a, b) => b.w - a.w)
      .slice(0, 6);
  }, [edges, selected]);
  const byId = useMemo(() => new Map(nodes.map((d) => [d.id, d])), [nodes]);
  const sel = selected ? byId.get(selected) : null;

  if (!graph) return null;

  const toggle = (layer) => {
    setLayers((ls) => (ls.includes(layer) ? ls.filter((l) => l !== layer) : [...ls, layer]));
    setSelected(null);
  };

  const onNode = (d) => {
    if (d.kind === 'province' && d.code != null) { go(d.code); return; }
    setSelected((s) => (s === d.id ? null : d.id));
  };

  return (
    <Chapter id="universe" q="How does everything connect?" title="Universe" th="จักรวาลความเชื่อมโยง">
      <p className="t-note">
        {n(graph.counts.nodes)} nodes · {n(graph.counts.edges)} edges · built {String(graph.builtAt).slice(0, 10)}.
        Business is what is made where, strategy is when the program moved, provenance is
        who filed it and which specification governs it. Click any province to open it;
        click anything else to read its strongest links.
      </p>
      <div className="t-legend" role="group" aria-label="Graph layers">
        {LAYERS.map((l) => (
          <button key={l} type="button" className="reset" aria-pressed={layers.includes(l)} onClick={() => toggle(l)}>
            [{layers.includes(l) ? '●' : '○'}] {l}
          </button>
        ))}
        <span className="t-row-en">{nodes.length} nodes · {edges.length} edges in view</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="OTOP universe knowledge graph" style={{ width: '100%', border: '1px solid var(--line-2)', background: 'var(--bg-2)' }}>
        {edges.map((e, i) => {
          const a = pos.get(e.s);
          const b = pos.get(e.t);
          if (!a || !b) return null;
          const hot = selected && (e.s === selected || e.t === selected);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? '#f59e0b' : 'currentColor'} strokeOpacity={hot ? 0.9 : 0.14} strokeWidth={hot ? 1.6 : 1} />;
        })}
        {nodes.map((d) => {
          const p = pos.get(d.id);
          if (!p) return null;
          const hot = selected === d.id;
          return (
            <g key={d.id} transform={`translate(${p.x},${p.y})`} onClick={() => onNode(d)} style={{ cursor: 'pointer' }}>
              <title>{`${d.th ?? ''} ${d.en ?? ''} · ${d.value != null ? n(d.value) : KIND_TH[d.kind] ?? d.kind}`}</title>
              <circle r={radius(d)} fill={hot ? '#f59e0b' : d.kind === 'root' ? 'currentColor' : 'var(--bg)' } stroke={hot ? '#f59e0b' : 'currentColor'} strokeWidth={d.kind === 'root' ? 2 : 1.2} />
              {(d.kind === 'root' || d.kind === 'region' || d.kind === 'category' || hot) && (
                <text y={radius(d) + 11} textAnchor="middle" fontSize="9" fill="currentColor">{d.th ?? d.en}</text>
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
          <div className="t-row t-row-hd"><span className="t-rail" /><span>{sel.th ?? sel.en} · {KIND_TH[sel.kind] ?? sel.kind}</span><span className="t-row-num">{sel.value != null ? n(sel.value) : '—'}</span></div>
          {selectedEdges.map((e, i) => {
            const other = byId.get(e.s === selected ? e.t : e.s);
            return (
              <div className="t-row" key={i}>
                <span className="t-rail" />
                <span><span className="t-row-th">{other?.th ?? other?.en ?? e.s}</span> <span className="t-row-en">{e.kind}</span></span>
                <span className="t-row-num">{n(e.w)}</span>
              </div>
            );
          })}
        </div>
      )}
      {!sel && <p className="t-note">Provinces leave this map for their dossier; everything else reports its six strongest links here.</p>}
    </Chapter>
  );
}
