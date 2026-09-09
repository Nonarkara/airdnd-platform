const nf = new Intl.NumberFormat('en-US');
const n = (v) => (v == null ? '—' : nf.format(v));
const CAT_TONE = { unclassified: 'is-hole' };

/** A composition bar. Segments are shares of one whole and must sum to it. */
export default function Composition({ parts, total }) {
  return (
    <>
      <div className="t-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.count}`).join(', ')}>
        {parts.filter((p) => p.count > 0).map((p) => (
          <span
            key={p.id}
            className={CAT_TONE[p.id] ?? (p.tone || 'is-ink')}
            style={{ flex: `${p.count} 0 0` }}
            title={`${p.label} · ${n(p.count)} · ${Math.round((p.count / total) * 1000) / 10}%`}
          >
            {p.count / total > 0.09 ? `${Math.round((p.count / total) * 100)}%` : ''}
          </span>
        ))}
      </div>
      <div className="t-legend">
        {parts.filter((p) => p.count > 0).map((p) => (
          <span key={p.id}>{p.label} · {n(p.count)}</span>
        ))}
      </div>
    </>
  );
}

export function categoryParts(scope) {
  return scope.categories.map((c) => ({ id: c.id, label: c.en, count: c.count }));
}
