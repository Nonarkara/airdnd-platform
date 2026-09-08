/**
 * Province shard loading.
 *
 * The index arrives first and carries the whole national picture in a small
 * file. Records themselves live in one shard per province, fetched on demand.
 *
 * The honesty problem this creates: if a search runs over 12 of 77 loaded
 * shards, the result is partial, and a result set that is silently partial is
 * worse than no result at all — the user reads "3 suppliers in Thailand" when
 * the truth is "3 in the twelve provinces we happened to load". So every load
 * returns its coverage, the interface states it, and widening to the full
 * corpus is one click.
 */

export async function loadIndex() {
  const [indexRes, metaRes] = await Promise.all([
    fetch('/otop_index.json', { cache: 'no-cache' }),
    fetch('/otop_meta.json', { cache: 'no-cache' }),
  ]);
  if (!indexRes.ok || !metaRes.ok) {
    throw new Error(`registry index unavailable — otop_index.json ${indexRes.status}, otop_meta.json ${metaRes.status}`);
  }
  return { index: await indexRes.json(), meta: await metaRes.json() };
}

export async function loadShards(codes) {
  const results = await Promise.all(
    codes.map(async (code) => {
      const response = await fetch(`/p/${code}.json`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`province shard ${code} unavailable (${response.status})`);
      return response.json();
    }),
  );
  return results.flat();
}

/**
 * Decide which provinces are worth loading for a requirement, within a record
 * budget. Provinces are ranked by how many records they hold *in the requested
 * categories* — so a search for textiles pulls the weaving provinces first
 * rather than the alphabetically luckiest ones.
 */
export function planShards(index, { categories = [], provinceCodes = [], regions = [], budget = 40_000 } = {}) {
  let candidates = index.provinces;

  if (provinceCodes.length) candidates = candidates.filter((p) => provinceCodes.includes(p.code));
  else if (regions.length) candidates = candidates.filter((p) => regions.includes(p.region));

  const relevance = (p) =>
    categories.length ? categories.reduce((n, c) => n + (p.categories[c] ?? 0), 0) : p.records;

  const ranked = [...candidates]
    .map((p) => ({ ...p, relevant: relevance(p) }))
    .filter((p) => p.relevant > 0)
    .sort((a, b) => b.relevant - a.relevant);

  const chosen = [];
  let loaded = 0;
  for (const province of ranked) {
    if (loaded > 0 && loaded + province.records > budget) break;
    chosen.push(province);
    loaded += province.records;
  }

  const totalRelevant = ranked.reduce((n, p) => n + p.relevant, 0);
  const chosenRelevant = chosen.reduce((n, p) => n + p.relevant, 0);

  return {
    codes: chosen.map((p) => p.code),
    provincesChosen: chosen.length,
    provincesAvailable: ranked.length,
    recordsChosen: loaded,
    complete: chosen.length === ranked.length,
    coverage: totalRelevant > 0 ? Math.round((chosenRelevant / totalRelevant) * 1000) / 10 : 100,
    allCodes: ranked.map((p) => p.code),
  };
}
