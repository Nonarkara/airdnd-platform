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

  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || t.modal.timestampPending;
  const sourceLabel = companion.sourceChannel || SOURCE_LABELS[companion.dataSource];
  const hasContact = companion.phone || companion.lineUrl || companion.telegramUrl || companion.mapsUrl;

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
              <span className="status-pill">{sourceLabel}</span>
              <span>
                {companion.postedAt
                  ? `Posted ${formatRelativeTimestamp(companion.postedAt)}`
                  : formatRelativeTimestamp(companion.updatedAt)}
              </span>
            </div>

            <h2 className="modal-name">{companion.name}</h2>

            <div className="modal-location">
              <span>{companion.location}</span>
            </div>

            {/* Metrics grid: Contact / Hours / Price */}
            <div className="metrics-grid">
              {companion.phone ? (
                <a href={`tel:${companion.phone.replace(/[^\d+]/g, '')}`} className="metric-box metric-link">
                  <span className="metric-value">{companion.phone}</span>
                  <span className="metric-label">Tel</span>
                </a>
              ) : companion.lineUrl ? (
                <a href={companion.lineUrl} target="_blank" rel="noopener noreferrer" className="metric-box metric-link">
                  <span className="metric-value">LINE</span>
                  <span className="metric-label">Contact</span>
                </a>
              ) : (
                <div className="metric-box">
                  <span className="metric-value">-</span>
                  <span className="metric-label">Contact</span>
                </div>
              )}
              {companion.hours ? (
                <div className="metric-box">
                  <span className="metric-value">{companion.hours}</span>
                  <span className="metric-label">Hours</span>
                </div>
              ) : companion.mapsUrl ? (
                <a href={companion.mapsUrl} target="_blank" rel="noopener noreferrer" className="metric-box metric-link">
                  <span className="metric-value">Map</span>
                  <span className="metric-label">Location</span>
                </a>
              ) : (
                <div className="metric-box">
                  <span className="metric-value">-</span>
                  <span className="metric-label">Hours</span>
                </div>
              )}
              <div className="metric-box">
                <span className="metric-value">{companion.priceLabel}</span>
                <span className="metric-label">{t.modal.rate}</span>
              </div>
            </div>

            {/* Contact buttons row */}
            {hasContact && (
              <div className="modal-contact-row">
                {companion.phone && (
                  <a href={`tel:${companion.phone.replace(/[^\d+]/g, '')}`} className="modal-contact-btn">
                    Call {companion.phone}
                  </a>
                )}
                {companion.lineUrl && (
                  <a href={companion.lineUrl} target="_blank" rel="noopener noreferrer" className="modal-contact-btn modal-contact-line">
                    LINE
                  </a>
                )}
                {companion.telegramUrl && (
                  <a href={companion.telegramUrl} target="_blank" rel="noopener noreferrer" className="modal-contact-btn">
                    Telegram
                  </a>
                )}
                {companion.mapsUrl && (
                  <a href={companion.mapsUrl} target="_blank" rel="noopener noreferrer" className="modal-contact-btn">
                    Google Maps
                  </a>
                )}
              </div>
            )}

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
                <span className="price-value">{sourceLabel}</span>
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
