import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
} from '../lib/listings';
import './CompanionModal.css';

function CompanionModal({ companion, onClose, t }) {
  if (!companion) {
    return null;
  }

  const ratingLine = companion.rating
    ? `${companion.rating.toFixed(1)}★`
    : t.card.unrated;
  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || t.modal.timestampPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={companion.name}
      >
        <button type="button" className="btn-close" onClick={onClose} aria-label={t.modal.close}>
          ×
        </button>

        <div className="modal-body">
          <div className="modal-image-section">
            <img
              src={companion.imageUrl}
              alt={companion.name}
              className="modal-main-image"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = '/mockups/109748.jpg';
              }}
            />
            <div className="modal-image-stamp">
              <span className="modal-image-stamp-label">{t.modal.capturedAt}</span>
              <strong>{preciseTimestamp}</strong>
            </div>
          </div>

          <div className="modal-info-section">
            <div className="modal-topline">
              <span className="status-pill">
                {companion.sourceChannel || SOURCE_LABELS[companion.dataSource]}
              </span>
              <span>
                {companion.postedAt
                  ? `Posted ${formatRelativeTimestamp(companion.postedAt)}`
                  : formatRelativeTimestamp(companion.updatedAt)}
              </span>
            </div>

            <h2 className="modal-name">
              {companion.name}
              {companion.age ? <span className="modal-age">({companion.age})</span> : null}
            </h2>

            <div className="modal-location">
              <span>{companion.location}</span>
              <span>{ratingLine}</span>
              {companion.reviews ? <span>{companion.reviews} {t.modal.reviews}</span> : null}
            </div>

            <div className="metrics-grid">
              <div className="metric-box">
                <span className="metric-value">{companion.metrics.height || '-'}</span>
                <span className="metric-label">{t.modal.height}</span>
              </div>
              <div className="metric-box">
                <span className="metric-value">{companion.metrics.weight || '-'}</span>
                <span className="metric-label">{t.modal.weight}</span>
              </div>
              <div className="metric-box">
                <span className="metric-value">{companion.priceLabel}</span>
                <span className="metric-label">{t.modal.rate}</span>
              </div>
            </div>

            <div className="modal-description">
              <h3>{t.modal.about}</h3>
              <p>{companion.description}</p>
            </div>

            <div className="modal-tags">
              {(companion.tags.length > 0 ? companion.tags : [t.card.pendingTag]).map((tag) => (
                <span key={tag} className="pill-tag">
                  {tag}
                </span>
              ))}
            </div>

            <div className="modal-footer">
              <div className="modal-price-range">
                <span className="price-label">{t.modal.source}</span>
                <span className="price-value">
                  {companion.sourceChannel || SOURCE_LABELS[companion.dataSource]}
                </span>
              </div>
              <button type="button" className="btn-book" onClick={onClose}>
                {t.modal.closeCta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanionModal;
