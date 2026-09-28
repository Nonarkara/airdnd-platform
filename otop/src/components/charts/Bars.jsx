/**
 * Ranked horizontal bars. Label left, value right, an ink track under each.
 * The same `.t-ranked` surface the Atlas already draws contributors with —
 * this just gives it one API so every ranked list in the site looks alike.
 */
export default function Bars({ rows, format = (v) => String(v), max, onSelect, label }) {
  const top = max ?? Math.max(...rows.map((r) => r.value ?? 0), 1);
  return (
    <div className="t-ranked" role="img" aria-label={label ?? `${rows.length} ranked bars`}>
      {rows.map((r) => {
        const body = (
          <>
            <div className="t-ranked-row">
              <span>{r.label}{r.sub && <> <span className="t-row-en">{r.sub}</span></>}</span>
              <span className="t-row-num">{format(r.value)}</span>
            </div>
            <span className="t-ranked-track"><i style={{ width: `${((r.value ?? 0) / top) * 100}%` }} /></span>
          </>
        );
        return onSelect && r.code != null
          ? <button type="button" className="t-ranked-btn" key={r.code ?? r.label} onClick={() => onSelect(r.code)}>{body}</button>
          : <div key={r.code ?? r.label}>{body}</div>;
      })}
    </div>
  );
}
