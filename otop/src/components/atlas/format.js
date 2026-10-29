const nf = new Intl.NumberFormat('en-US');
export const n = (v) => (v == null ? '—' : nf.format(v));
export const pct = (a, d) => (d > 0 ? Math.round((a / d) * 1000) / 10 : null);
export const bnBaht = (v) => (v == null ? '—' : `${(v / 1e9).toFixed(2)}B baht`);
