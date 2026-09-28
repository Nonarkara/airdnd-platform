/**
 * Data Bank — the whole universe data.go.th returned, shelved by kind.
 *
 * The tabs show highlights: the few numbers worth a headline. Everything
 * else lives here, split-screen: one third shelves (money, tourism,
 * standards, products, registry, groups, other), two thirds the datasets
 * on the open shelf — title, publishing office, and what the build
 * actually pulled from it (rows in, usable or why skipped).
 *
 * Reads otop_datasets.json, published by scripts/otop/datasets.js from the
 * fetch manifest joined with the build's resource reports. A dataset the
 * portal lists but the build never pulled still appears — discovered, not
 * pulled — because an absent shelf is indistinguishable from a shelf that
 * was never stocked.
 */

import { useEffect, useMemo, useState } from 'react';

async function loadBank() {
  const r = await fetch('/otop_datasets.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`otop_datasets.json ${r.status}`);
  return r.json();
}

export default function DataBank() {
  const [bank, setBank] = useState(null);
  const [error, setError] = useState(null);
  const [shelf, setShelf] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadBank().then((d) => { if (!cancelled) setBank(d); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => bank?.groups ?? [], [bank]);

  const active = useMemo(() => {
    if (!groups.length) return null;
    return groups.find((g) => g.id === shelf) ?? groups[0];
  }, [groups, shelf]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits = [];
    for (const g of groups) {
      for (const d of g.datasets) {
        if (`${d.title ?? ''} ${d.org ?? ''}`.toLowerCase().includes(q)) hits.push({ ...d, shelf: g.en });
      }
    }
    return hits.slice(0, 200);
  }, [groups, query]);

  if (error) return <p className="empty">The data bank could not be loaded — {error}.</p>;
  if (!bank) return <p className="empty">Loading the data bank…</p>;

  return (
    <div className="bank-wrap">
      <div className="bank-shelves">
        <input
          type="search" className="bank-search" placeholder="Search 726 datasets…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label="Search datasets"
        />
        {groups.map((g) => (
          <button
            key={g.id} type="button" className="reset bank-shelf"
            data-active={searched ? '0' : ((active?.id === g.id) ? '1' : '0')}
            onClick={() => { setShelf(g.id); setQuery(''); }}
          >
            <span className="bank-shelf-n">{g.count}</span>
            <span className="bank-shelf-t">{g.en}</span>
            <span className="bank-shelf-th" lang="th">{g.th}</span>
          </button>
        ))}
        <p className="t-note">
          {bank.totals.discovered} discovered · {bank.totals.pulled} pulled ·{' '}
          {bank.totals.rowsIn.toLocaleString()} rows read.
        </p>
      </div>

      <div className="bank-detail">
        {searched ? (
          <>
            <p className="t-note">{searched.length} matching datasets.</p>
            {searched.map((d, i) => <DatasetRow key={i} d={d} showShelf />)}
          </>
        ) : active && (
          <>
            <p className="t-note">{active.blurb}</p>
            {active.datasets.map((d, i) => <DatasetRow key={i} d={d} />)}
          </>
        )}
      </div>
    </div>
  );
}

function DatasetRow({ d, showShelf }) {
  const p = d.pulled;
  return (
    <div className="bank-row">
      <div className="bank-row-t" lang="th">{d.title}</div>
      <div className="bank-row-meta">
        {showShelf && <span>{d.shelf} · </span>}
        <span>{d.org ?? 'unknown office'}</span>
        {p ? (
          <span> · {p.rowsIn.toLocaleString()} rows · {p.usable ? 'read by the build' : `skipped — ${p.skipReason ?? p.kind}`}</span>
        ) : (
          <span> · discovered, not pulled</span>
        )}
      </div>
    </div>
  );
}
