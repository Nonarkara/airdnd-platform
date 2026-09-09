import { CATEGORY_LABEL } from '../lib/labels.js';

/**
 * The rail carries a domain that is in the record: can this producer be reached
 * at all? A shortlist row nobody can telephone is not a lead, and that fact
 * resolves at a distance where the fit score has not yet resolved.
 */
function railOf(record) {
  if (record.phone) return 'standard';
  if (record.email || record.website) return 'transfer';
  return 'default';
}

/**
 * Horizontal data rows, now carrying a score.
 *
 * The score bar is the only new mark, and the component breakdown is exposed on
 * hover rather than hidden in a tooltip nobody reads — a buyer being handed a
 * ranking is owed the reason for it, or the number is just authority without
 * argument.
 */
function Stars({ value }) {
  if (value == null) return <span className="none">—</span>;
  if (value === 0) return <span className="none">ไม่ผ่าน</span>;
  return <span>{'★'.repeat(value)}</span>;
}

function why(components) {
  return Object.entries(components)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join('\n');
}

export default function MatchRows({ matches, limit }) {
  if (matches.length === 0) {
    return <p className="empty">No producer in the loaded provinces matches this requirement.</p>;
  }

  return (
    <div className="rows">
      <div className="row match-row row-hd" aria-hidden="true">
        <span className="t-rail" />
        <span>Fit</span>
        <span>Product · ผลิตภัณฑ์</span>
        <span>Producer · ผู้ผลิต</span>
        <span>Category</span>
        <span>OPC</span>
        <span>Where</span>
        <span>Contact</span>
        <span>Src</span>
      </div>

      {matches.slice(0, limit).map(({ record, score, components }) => (
        <article className="row match-row" key={record.identityKey} data-rail={railOf(record)}>
          <span className="t-rail" />
          <span className="c-score" title={why(components)}>
            <span className="score-n">{score.toFixed(0)}</span>
            <span className="score-track"><span className="score-fill" style={{ width: `${score}%` }} /></span>
          </span>

          <span className="c-name">{record.productName ?? record.producerName ?? '—'}</span>
          <span className="c-producer">{record.producerName ?? '—'}</span>

          <span className="c-cat">
            {record.category ? (
              <>
                {CATEGORY_LABEL[record.category]}
                {record.categoryConfidence === 'inferred' && (
                  <span className="inferred" title="Inferred from the product name; the source declared no category"> · inferred</span>
                )}
              </>
            ) : <span className="inferred">—</span>}
          </span>

          <span className="c-stars"><Stars value={record.stars} /></span>

          <span className="c-place">
            {record.province ?? '—'}
            {(record.district || record.subdistrict) && (
              <span className="sub">{[record.subdistrict, record.district].filter(Boolean).join(' · ')}</span>
            )}
          </span>

          <span className="c-contact">
            {record.phone
              ? <a href={`tel:${record.phone}`}>{record.phone}</a>
              : record.email
                ? <a href={`mailto:${record.email}`}>{record.email}</a>
                : record.website
                  ? <a href={record.website} target="_blank" rel="noreferrer noopener">web</a>
                  : <span className="none">none recorded</span>}
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
