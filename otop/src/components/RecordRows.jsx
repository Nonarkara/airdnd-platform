import { CATEGORY_LABEL } from '../lib/labels.js';

/**
 * The singular design move, carried over from the wellness project: a listing
 * is a horizontal data row, not a photo card. A departure board, not a
 * catalogue. It reads as instrumentation, which is what this is.
 *
 * The rightmost column is the number of independent government sources that
 * attested the record. One is the norm; two or more is corroboration, and is
 * the only place the amber accent appears in the table.
 */
function Stars({ value }) {
  if (value == null) return <span className="none">—</span>;
  if (value === 0) return <span className="none">ไม่ผ่าน</span>;
  return <span>{'★'.repeat(value)}</span>;
}

export default function RecordRows({ records }) {
  if (records.length === 0) {
    return <p className="empty">No records match these filters.</p>;
  }

  return (
    <div className="rows">
      <div className="row row-hd" aria-hidden="true">
        <span>Prov</span>
        <span>Product · ผลิตภัณฑ์</span>
        <span>Producer · ผู้ผลิต</span>
        <span>Category</span>
        <span>OPC</span>
        <span>Where</span>
        <span>Sources</span>
      </div>

      {records.map((record) => (
        <article className="row" key={record.identityKey}>
          <span className="c-code">{record.provinceCode ?? '··'}</span>

          <span className="c-name">{record.productName ?? record.producerName ?? '—'}</span>

          <span className="c-producer">{record.producerName ?? '—'}</span>

          <span className="c-cat">
            {record.category ? (
              <>
                {CATEGORY_LABEL[record.category]}
                {record.categoryConfidence === 'inferred' && (
                  <span className="inferred" title="Inferred from the product name; the source did not state a category">
                    {' '}· inferred
                  </span>
                )}
              </>
            ) : (
              <span className="inferred">—</span>
            )}
          </span>

          <span className="c-stars"><Stars value={record.stars} /></span>

          <span className="c-place">
            {record.province ?? '—'}
            {(record.district || record.subdistrict) && (
              <span className="sub">
                {[record.subdistrict, record.district].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>

          <span className="c-src">
            <span
              className={record.sourceCount > 1 ? 'multi' : undefined}
              title={record.provenance.map((p) => p.datasetTitle ?? p.datasetId).join('\n')}
            >
              {record.sourceCount}
            </span>
          </span>
        </article>
      ))}
    </div>
  );
}
