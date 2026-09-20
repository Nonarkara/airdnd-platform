/**
 * Condition-of-the-record rollup over the loaded rows.
 *
 * Pure arithmetic, no JSX. Moved out of App.jsx so the shell holds state and
 * routing only. No logic changed — cut verbatim.
 */

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function completenessOf(records) {
  const n = records.length;
  if (n === 0) return null;
  return {
    records: n,
    withContact: pct(records.filter((r) => r.phone || r.email || r.website).length, n),
    withStars: pct(records.filter((r) => r.stars != null).length, n),
    withPrice: pct(records.filter((r) => r.price != null).length, n),
    withSubdistrict: pct(records.filter((r) => r.subdistrict).length, n),
    withCoordinates: pct(records.filter((r) => r.latitude != null && r.longitude != null).length, n),
    withTambon: pct(records.filter((r) => r.tambonCode).length, n),
    categoryDeclared: pct(records.filter((r) => r.categoryConfidence === 'declared').length, n),
  };
}
