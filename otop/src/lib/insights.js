/**
 * The national rollup. Published by `npm run otop:build`, and until now fetched
 * by nothing — 176KB of regional, provincial and provenance aggregate that the
 * app never rendered.
 *
 * No fallback, same rule as the shards: if it cannot be loaded the section says
 * so and shows nothing, rather than quietly rendering a substitute.
 */
export async function loadInsights() {
  const response = await fetch('/otop_insights.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`otop_insights.json ${response.status}`);
  const insights = await response.json();
  if (!Array.isArray(insights.byProvince)) throw new Error('otop_insights.json has no byProvince');
  return insights;
}

/**
 * The strongest field a province's records actually carry. This is the routing
 * state the rail encodes — a domain in the record, not a restatement of size.
 * Ordinal: a province that grades its producers also classifies them.
 */
export function railOf(province) {
  if (province.stars.graded > 0) return 'business';
  if (classifiedOf(province) > 0) return 'standard';
  if (province.corroborated > 0) return 'transfer';
  return 'hazard';
}

export const RAIL_LABEL = {
  business: 'carries an OPC star result',
  standard: 'carries a product category',
  transfer: 'corroborated across agencies only',
  hazard: 'name and area only',
};

/** Records carrying any category. The complement of the `unclassified` bucket. */
export function classifiedOf(scope) {
  const unclassified = scope.categories.find((c) => c.id === 'unclassified');
  return scope.records - (unclassified ? unclassified.count : 0);
}

/** Zones of the tag, mapped onto the fields the registry either filled or did not. */
export const ZONES = [
  { key: 'withSubdistrict', label: 'Located to tambon', th: 'ระบุถึงตำบล', zone: 'Destination' },
  { key: 'categoryDeclared', label: 'Category declared', th: 'ระบุประเภทเอง', zone: 'Domain' },
  { key: 'withStars', label: 'OPC graded', th: 'มีระดับดาว', zone: 'Class of service' },
  { key: 'withContact', label: 'Reachable', th: 'มีช่องทางติดต่อ', zone: 'Claim' },
  { key: 'withPrice', label: 'Priced', th: 'มีราคา', zone: 'Value' },
  { key: 'withCert', label: 'State-certified', th: 'มีใบรับรอง มผช.', zone: 'Seal' },
  { key: 'withCoordinates', label: 'Mapped', th: 'มีพิกัด', zone: 'Machine key' },
];

/** 1-based rank of `code` in `list` by `key`, descending. null when absent. */
export function rankOf(list, code, key) {
  const sorted = [...list].filter((p) => p[key] != null).sort((a, b) => b[key] - a[key]);
  const i = sorted.findIndex((p) => p.code === code);
  return i === -1 ? null : i + 1;
}

/** The universe graph — nodes and edges for the whole-registry map. */
export async function loadGraph() {
  const response = await fetch('/otop_graph.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`otop_graph.json ${response.status}`);
  const graph = await response.json();
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('otop_graph.json has no nodes/edges');
  return graph;
}

/** The revenue artefact itself — only the dossier needs the per-province series. */
export async function loadRevenue() {
  const response = await fetch('/otop_revenue.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`otop_revenue.json ${response.status}`);
  const rev = await response.json();
  if (rev.degraded) throw new Error(rev.reason ?? 'revenue artefact degraded');
  return rev;
}

/** Baht, rounded to the unit a reader can hold. */
export function baht(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B ฿`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M ฿`;
  return `${new Intl.NumberFormat('en-US').format(Math.round(v))} ฿`;
}

export const MONTH_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** A revenue `years` block → sparkline points in calendar order. */
export function monthlyPoints(years) {
  const out = [];
  for (const y of Object.keys(years ?? {}).map(Number).sort()) {
    for (const m of Object.keys(years[y].months).map(Number).sort((a, b) => a - b)) {
      out.push({ label: `${MONTH_TH[m]} ${y + 543}`, value: years[y].months[m] });
    }
  }
  return out;
}

/** Signature pack — top categories, named products, champions per province. */
export async function loadProvinceFaces() {
  const response = await fetch('/otop_province_faces.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`otop_province_faces.json ${response.status}`);
  const faces = await response.json();
  if (!Array.isArray(faces.provinces)) throw new Error('otop_province_faces.json has no provinces');
  return faces;
}
