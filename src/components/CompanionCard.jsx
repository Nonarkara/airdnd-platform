import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import './CompanionCard.css';

function CompanionCard({ companion, onClick, t }) {
  const secondaryLine = companion.reviews
    ? `${companion.reviews} ${t.card.reviewsLabel}`
    : SOURCE_LABELS[companion.dataSource];
  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || t.card.timestampPending;
  const isMatched = hasMatchedMedia(companion);

  return (
    <article className="companion-card" onClick={() => onClick(companion)}>
      <div className="card-image-wrapper">
        {isMatched ? (
          <img
            src={companion.imageUrl}
            alt={companion.name}
            className="card-image"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling.style.display = 'grid';
            }}
          />
        ) : null}
        <div className="card-placeholder" style={isMatched ? { display: 'none' } : undefined} aria-hidden="true">
          <span className="card-placeholder-letter">{(companion.city || companion.name || 'S')[0]}</span>
        </div>
        <span className="card-city">{companion.city}</span>
      </div>

      <div className="card-content">
        <div className="card-topline">
          <span className="card-source">
            {companion.sourceChannel || SOURCE_LABELS[companion.dataSource]}
          </span>
          <span className="card-timestamp">{preciseTimestamp}</span>
        </div>

        <div className="card-header">
          <div>
            <h3 className="card-name">{companion.name}</h3>
            <p className="card-location">{companion.location}</p>
          </div>
          <span className="card-price">{companion.priceLabel}</span>
        </div>

        <p className="card-description">{companion.description}</p>

        <div className="card-details">
          {companion.phone && (
            <span className="card-detail">
              <span className="card-detail-label">Tel</span>
              <span className="card-detail-value">{companion.phone}</span>
            </span>
          )}
          {companion.hours && (
            <span className="card-detail">
              <span className="card-detail-label">Hours</span>
              <span className="card-detail-value">{companion.hours}</span>
            </span>
          )}
        </div>

        <div className="card-tags">
          {companion.tags.length > 0 ? (
            companion.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="pill-tag">
                {tag}
              </span>
            ))
          ) : (
            <span className="pill-tag muted-tag">{t.card.pendingTag}</span>
          )}
        </div>

        <div className="card-footer">
          <div className="card-signal">
            <strong>{companion.rating ? `${companion.rating.toFixed(1)}★` : t.card.unrated}</strong>
            <span>{secondaryLine}</span>
          </div>
          <button
            type="button"
            className="btn-card-action"
            onClick={(event) => {
              event.stopPropagation();
              onClick(companion);
            }}
          >
            {t.card.viewDetails}
          </button>
        </div>
      </div>
    </article>
  );
}

export default CompanionCard;
