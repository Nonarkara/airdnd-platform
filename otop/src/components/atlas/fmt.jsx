const nf = new Intl.NumberFormat('en-US');
export const n = (v) => (v == null ? '—' : nf.format(v));
export const pct = (a, d) => (d > 0 ? Math.round((a / d) * 1000) / 10 : null);
export const bnBaht = (v) => (v == null ? '—' : `${(v / 1e9).toFixed(2)}B baht`);
/** Chapter heading: the question, then the title. */
export function Chapter({ id, q, title, th, children }) {
  return (
    <section className="chapter" id={id} aria-labelledby={`${id}-h`}>
      <div className="chapter-h">
        <span className="t-key">{q}</span>
        <h2 id={`${id}-h`}>{title} <span className="t-row-en">{th}</span></h2>
      </div>
      {children}
    </section>
  );
}
