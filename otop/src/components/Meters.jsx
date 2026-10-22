/**
 * Registry condition, not "OTOP activity".
 *
 * A count of rows per province measures how energetically a provincial office
 * files paperwork. It does not measure how much is made or sold there, and a
 * dashboard that implies otherwise is lying with true numbers. These meters
 * describe the record itself — how complete it is and how old — which is the
 * strongest claim this data actually supports.
 */
const METERS = [
  { key: 'withContact', label: 'Reachable', th: 'มีช่องทางติดต่อ', note: 'phone, email or web' },
  { key: 'withStars', label: 'Graded', th: 'มีระดับดาว', note: 'carries an OPC star result' },
  { key: 'withPrice', label: 'Priced', th: 'มีราคา', note: 'carries a price' },
  { key: 'withSubdistrict', label: 'Located to tambon', th: 'ระบุถึงตำบล', note: 'sub-district resolved' },
  { key: 'withCoordinates', label: 'Mapped', th: 'มีพิกัด', note: 'has coordinates' },
  { key: 'withTambon', label: 'Placeable', th: 'วางบนแผนที่ได้', note: 'tambon centroid resolved from the name it carries' },
  { key: 'categoryDeclared', label: 'Category declared', th: 'ระบุประเภทเอง', note: 'source stated it; the rest is inferred' },
];

export default function Meters({ completeness }) {
  if (!completeness) return null;

  // Reachable leads the row: it is the measure the registry is judged by —
  // a record you cannot call is a record you cannot use — so its numeral is
  // the largest in the block. The seven cells are one grid, so every bar is
  // the same length and the signals can be compared with each other.
  return (
    <div className="meters">
      {METERS.map((m, i) => {
        const value = completeness[m.key];
        const shown = value == null ? 0 : value;
        return (
          <div key={m.key} className={i === 0 ? 'meter meter-lead' : 'meter'}>
            <div className="meter-top">
              <span className="meter-l">
                {m.label} <span className="gauge-th">· {m.th}</span>
              </span>
              <span className="meter-v">{value == null ? '—' : `${value}%`}</span>
            </div>
            <div className="meter-track">
              {/* Amber marks the thin fields — it is the accent carrying meaning,
                  as a bar rather than as text, which keeps contrast legal. */}
              <div className={`meter-fill${shown < 50 ? ' low' : ''}`} style={{ width: `${shown}%` }} />
            </div>
            <p className="meter-note">{m.note}</p>
          </div>
        );
      })}
    </div>
  );
}
