/**
 * Load the three published artefacts.
 *
 * No fallback. If the registry cannot be loaded the page says so and shows
 * nothing, because the alternative — quietly rendering stale or substitute data
 * under the same headings — is the exact failure this project has already
 * shipped once and does not intend to ship again.
 */
export async function loadRegistry() {
  const paths = ['/otop.json', '/otop_meta.json', '/otop_insights.json'];
  const responses = await Promise.all(paths.map((p) => fetch(p, { cache: 'no-cache' })));

  const failed = responses.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`registry unavailable — ${failed.map((r) => `${new URL(r.url).pathname} ${r.status}`).join(', ')}`);
  }

  const [records, meta, insights] = await Promise.all(responses.map((r) => r.json()));

  if (!Array.isArray(records)) throw new Error('otop.json is not an array');
  return { records, meta, insights };
}
