/**
 * One stacked bar per row (a year), segments in a FIXED category order. The
 * segment tone is an ink step by position, not a hue per category — the tag
 * has one ink, and the legend beneath carries identity, so colour never does.
 */
const STEPS = ['is-ink', 'is-ink-80', 'is-ink-60', 'is-ink-40', 'is-ink-25'];

export default function StackedBar({ rows, segments, format = (v) => String(v), label }) {
  return (
    <div className="t-stackset" role="img" aria-label={label}>
      {rows.map((row) => {
        const total = segments.reduce((s, seg) => s + (row.values[seg.id] ?? 0), 0);
        return (
          <div key={row.label} className="t-stackrow">
            <div className="t-ranked-row">
              <span>{row.label}{row.sub && <> <span className="t-row-en">{row.sub}</span></>}</span>
              <span className="t-row-num">{format(total)}</span>
            </div>
            <div className="t-bar t-bar-thin">
              {segments.map((seg, i) => {
                const v = row.values[seg.id] ?? 0;
                if (v <= 0) return null;
                const share = v / (total || 1);
                return (
                  <span key={seg.id} className={STEPS[i] ?? 'is-hole'} style={{ flex: `${v} 0 0` }}
                    title={`${seg.label} · ${format(v)} · ${Math.round(share * 100)}%`}>
                    {share > 0.12 ? `${Math.round(share * 100)}%` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="t-legend">
        {segments.map((seg, i) => (
          <span key={seg.id}><i className={`t-swatch ${STEPS[i] ?? 'is-hole'}`} />{seg.label}</span>
        ))}
      </div>
    </div>
  );
}
