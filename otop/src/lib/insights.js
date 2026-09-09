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
