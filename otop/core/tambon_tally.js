/**
 * Group matching producers by the tambon they name. Browser-safe (no node
 * imports) so the map component can stay thin and this can be unit-tested.
 *
 * Accepts matcher output ({ record, score }) or bare records.
 * Returns rows sorted by count, capped, so a national query draws the
 * densest tambons first rather than 7,000 dots.
 */
export function tallyByTambon(matches, { max = 1500 } = {}) {
  const tally = new Map();
  let placeable = 0;
  for (const m of matches) {
    const r = m?.record ?? m;
    if (!r?.tambonCode) continue;
    placeable += 1;
    const t = tally.get(r.tambonCode) ?? { code: r.tambonCode, n: 0, reachable: 0 };
    t.n += 1;
    if (r.phone || r.email || r.website) t.reachable += 1;
    tally.set(r.tambonCode, t);
  }
  const rows = [...tally.values()].sort((a, b) => b.n - a.n).slice(0, max);
  return { rows, placeable, maxN: rows.length ? rows[0].n : 1 };
}
