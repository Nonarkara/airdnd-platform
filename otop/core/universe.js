/**
 * OTOP universe — shared vocabulary for the knowledge graph.
 *
 * The graph joins every layer of the registry into one structure:
 *   business    province · category · basin (tambon epicenter)
 *   strategy    filing year · era (program history 2001–2026) · revenue
 *   provenance  publishing agency · standard group (มผช.)
 *
 * Pure functions only. `scripts/otop/graph.js` builds the artefact with them;
 * `otop/src/components/atlas/Universe.jsx` lays it out and filters it with
 * them; `test/otop_universe.test.js` pins them. No layer knows about files.
 */

export const KIND_LAYER = {
  root: 'business',
  region: 'business',
  province: 'business',
  category: 'business',
  basin: 'business',
  year: 'strategy',
  era: 'strategy',
  revenue: 'strategy',
  agency: 'provenance',
  standard: 'provenance',
};

export const LAYERS = ['business', 'strategy', 'provenance'];

/** Ring order for the radial layout, outermost last. */
export const RING_ORDER = ['root', 'region', 'category', 'province', 'basin', 'agency', 'standard', 'year', 'era', 'revenue'];

export function nodeId(kind, key) {
  return `${kind}:${key}`;
}

/**
 * Radial layout: root at center, every other kind on its own ring.
 * Deterministic — same nodes, same positions — so the map is shareable.
 * Returns a Map of id → {x, y} in a width×height box.
 */
export function layoutUniverse(nodes, width = 900, height = 620) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2 - 28;
  const rings = RING_ORDER.filter((k) => nodes.some((nd) => nd.kind === k && k !== 'root'));
  const pos = new Map();
  const root = nodes.find((nd) => nd.kind === 'root');
  if (root) pos.set(root.id, { x: cx, y: cy });
  rings.forEach((kind, ri) => {
    const ring = nodes.filter((nd) => nd.kind === kind);
    if (ring.length === 0) return;
    const r = maxR * ((ri + 1) / rings.length);
    ring.forEach((nd, i) => {
      const a = (2 * Math.PI * i) / ring.length - Math.PI / 2;
      pos.set(nd.id, {
        x: Math.round((cx + r * Math.cos(a)) * 10) / 10,
        y: Math.round((cy + r * Math.sin(a)) * 10) / 10,
      });
    });
  });
  return pos;
}

/**
 * Keep only nodes in the active layers (root always stays) plus edges whose
 * endpoints both survive. Returns {nodes, edges}.
 */
export function filterUniverse(graph, activeLayers) {
  const active = new Set(activeLayers);
  const nodes = graph.nodes.filter((nd) => nd.kind === 'root' || active.has(KIND_LAYER[nd.kind] ?? 'business'));
  const keep = new Set(nodes.map((nd) => nd.id));
  const edges = (graph.edges ?? []).filter((e) => keep.has(e.s) && keep.has(e.t));
  return { nodes, edges };
}

/** True when every edge endpoint names a node that exists. */
export function danglingEdges(graph) {
  const ids = new Set(graph.nodes.map((nd) => nd.id));
  return (graph.edges ?? []).filter((e) => !ids.has(e.s) || !ids.has(e.t));
}

/**
 * Largest numeric value per node kind. Sizes are normalised *within* a kind:
 * the revenue node carries baht and the root carries the national record
 * count, so a single global maximum would shrink every province, category
 * and agency dot to the same minimum disc. Returns {kind: max}.
 */
export function kindMaxima(nodes) {
  const out = {};
  for (const nd of nodes) {
    if (typeof nd.value !== 'number' || !Number.isFinite(nd.value)) continue;
    if (out[nd.kind] == null || nd.value > out[nd.kind]) out[nd.kind] = nd.value;
  }
  return out;
}

/**
 * Edge stroke width from a full-corpus weight. Weights run from single
 * filings to hundreds of thousands of rows, so the scale is logarithmic:
 * the heaviest attestation reads clearly heavier without swallowing the map.
 */
export function edgeWidth(w, maxW) {
  if (!(w > 0) || !(maxW > 0)) return 0.5;
  return 0.4 + 1.8 * (Math.log1p(w) / Math.log1p(maxW));
}

/**
 * Rank of a node within its kind by value, 1-based, nulls last.
 * @returns {{rank: number, of: number} | null}
 */
export function rankWithinKind(nodes, id) {
  const me = nodes.find((nd) => nd.id === id);
  if (!me) return null;
  const peers = nodes.filter((nd) => nd.kind === me.kind);
  const val = typeof me.value === 'number' ? me.value : -Infinity;
  const rank = peers.filter((nd) => (typeof nd.value === 'number' ? nd.value : -Infinity) > val).length + 1;
  return { rank, of: peers.length };
}
