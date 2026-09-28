/**
 * Sourcing basins — the question a directory cannot answer.
 *
 * "Where can I meet six credible suppliers of this in one trip?" Depth and
 * redundancy inside one province are worth more to a business buyer than the
 * same number of producers scattered nationally, because one sourcing visit and
 * one logistics run cover them, and a second supplier in the same district is
 * insurance against the first falling through.
 */
export default function Basins({ basins, total = 0 }) {
  if (basins.length === 0) {
    // Say what IS true, not just what is absent. "No basins" alongside a table
    // of matches reads as "no supply", which would be wrong.
    return (
      <p className="empty">
        {total > 0
          ? `Matching supply is spread thinly: ${total} province${total === 1 ? '' : 's'} hold matching producers, but none holds two or more. Expect to source from several provinces or widen the requirement.`
          : 'No matching producers in the loaded provinces.'}
      </p>
    );
  }

  return (
    <div className="basins">
      {basins.map((basin) => (
        <div className="basin" key={basin.code}>
          <div className="basin-top">
            <span className="basin-name">{basin.province}</span>
            <span className="basin-en">{basin.provinceEn}</span>
          </div>
          <div className="basin-n">{basin.depth}</div>
          <div className="basin-l">matching producers</div>
          <dl className="basin-facts">
            <div><dt>Contactable</dt><dd>{basin.reachable}</dd></div>
            <div><dt>OPC 4★+</dt><dd>{basin.graded4Plus}</dd></div>
            <div><dt>Districts</dt><dd>{basin.districts}</dd></div>
            <div><dt>Mean fit</dt><dd>{basin.meanScore}</dd></div>
          </dl>
        </div>
      ))}
    </div>
  );
}
