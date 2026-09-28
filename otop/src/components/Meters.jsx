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

  return (
    <div className="meters">
      {METERS.map((meter) => {
        const value = completeness[meter.key];
        const shown = value == null ? 0 : value;
        return (
          <div key={meter.key}>
            <div className="meter-top">
              <span className="meter-l">
                {meter.label} <span className="gauge-th">· {meter.th}</span>
              </span>
              <span className="meter-v">{value == null ? '—' : `${value}%`}</span>
            </div>
            <div className="meter-track">
              {/* Amber marks the thin fields — it is the accent carrying meaning,
                  as a bar rather than as text, which keeps contrast legal. */}
              <div className={`meter-fill${shown < 50 ? ' low' : ''}`} style={{ width: `${shown}%` }} />
            </div>
            <p className="meter-note">{meter.note}</p>
          </div>
        );
      })}
    </div>
  );
}
