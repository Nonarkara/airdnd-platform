const nf = new Intl.NumberFormat('en-US');
export const n = (v) => (v == null ? '—' : nf.format(v));
export const pct = (a, d) => (d > 0 ? Math.round((a / d) * 1000) / 10 : null);
export const bnBaht = (v) => (v == null ? '—' : `${(v / 1e9).toFixed(2)}B baht`);
/**
 * Chapter heading. The question is NOT here — the tab banner above already
 * asks it, and a page that says the same thing in two places reads like
 * two headlines fighting. The banner owns the question; the chapter owns
 * the name.
 */
export function Chapter({ id, q, title, th, children }) {
  return (
    <section className="chapter" id={id} aria-labelledby={`${id}-h`}>
      <div className="chapter-h">
        {q ? <span className="t-key">{q}</span> : null}
        <h2 id={`${id}-h`}>{title} <span className="t-row-en">{th}</span></h2>
      </div>
      {children}
    </section>
  );
}
