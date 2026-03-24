import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
} from '../lib/listings';
import './CompanionCard.css';

function CompanionCard({ companion, onClick, t }) {
  const secondaryLine = companion.reviews
    ? `${companion.reviews} ${t.card.reviewsLabel}`
    : SOURCE_LABELS[companion.dataSource];
  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || t.card.timestampPending;

  return (
    <article className="companion-card" onClick={() => onClick(companion)}>
      <div className="card-image-wrapper">
        <img
          src={companion.imageUrl}
          alt={companion.name}
          className="card-image"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/mockups/109748.jpg';
          }}
        />
        <span className="card-city">{companion.city}</span>
        <span className="card-captured">
          <span className="card-captured-label">{t.card.capturedLabel}</span>
          <span className="card-captured-value">{preciseTimestamp}</span>
        </span>
      </div>

      <div className="card-content">
        <div className="card-topline">
          <span className="card-source">
            {companion.sourceChannel || SOURCE_LABELS[companion.dataSource]}
          </span>
          <span className="card-updated">
            {companion.postedAt
              ? `Posted ${formatRelativeTimestamp(companion.postedAt)}`
              : formatRelativeTimestamp(companion.updatedAt)}
          </span>
        </div>

        <div className="card-header">
          <div>
            <h3 className="card-name">{companion.name}</h3>
            <p className="card-location">{companion.location}</p>
          </div>
          <span className="card-price">{companion.priceLabel}</span>
        </div>

        <p className="card-description">{companion.description}</p>

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
