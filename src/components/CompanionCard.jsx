import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import { trackListingClick } from '../lib/tracker';
import './CompanionCard.css';

function CompanionCard({ companion, onClick, t }) {
  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || t.card.timestampPending;
  const isMatched = hasMatchedMedia(companion);
  const sourceLabel = companion.sourceChannel || SOURCE_LABELS[companion.dataSource];

  const hasContact = companion.phone || companion.lineUrl || companion.telegramUrl || companion.mapsUrl;

  return (
    <article
      className={`poster-card ${isMatched ? 'has-photo' : 'no-photo'}`}
      onClick={() => { trackListingClick(companion.id); onClick(companion); }}
    >
      {/* Background: real photo or gradient poster */}
      {isMatched ? (
        <img
          src={companion.imageUrl}
          alt={companion.name}
          className="poster-bg"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
            event.currentTarget.closest('.poster-card').classList.add('no-photo');
            event.currentTarget.closest('.poster-card').classList.remove('has-photo');
          }}
        />
      ) : null}

      {/* City badge */}
      <span className="poster-city">{companion.city}</span>

      {/* Content overlay */}
      <div className="poster-overlay">
        <h3 className="poster-name">{companion.name}</h3>
        <p className="poster-location">{companion.location}</p>

        {/* Price + Hours row */}
        <div className="poster-meta">
          <span className="poster-price">{companion.priceLabel}</span>
          {companion.hours && (
            <>
              <span className="poster-dot" aria-hidden="true" />
              <span className="poster-hours">{companion.hours}</span>
            </>
          )}
        </div>

        {/* Contact row */}
        {hasContact && (
          <div className="poster-contacts">
            {companion.phone && (
              <a href={`tel:${companion.phone.replace(/[^\d+]/g, '')}`} className="poster-contact" onClick={(e) => e.stopPropagation()}>
                Tel
              </a>
            )}
            {companion.lineUrl && (
              <a href={companion.lineUrl} target="_blank" rel="noopener noreferrer" className="poster-contact" onClick={(e) => e.stopPropagation()}>
                LINE
              </a>
            )}
            {companion.telegramUrl && (
              <a href={companion.telegramUrl} target="_blank" rel="noopener noreferrer" className="poster-contact" onClick={(e) => e.stopPropagation()}>
                Telegram
              </a>
            )}
            {companion.mapsUrl && (
              <a href={companion.mapsUrl} target="_blank" rel="noopener noreferrer" className="poster-contact" onClick={(e) => e.stopPropagation()}>
                Map
              </a>
            )}
          </div>
        )}

        {/* Tags */}
        {companion.tags.length > 0 && (
          <div className="poster-tags">
            {companion.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="poster-tag">{tag}</span>
            ))}
          </div>
        )}

        {/* Source + timestamp footer */}
        <div className="poster-footer">
          <span className="poster-source">{sourceLabel}</span>
          <span className="poster-time">{preciseTimestamp}</span>
        </div>
      </div>
    </article>
  );
}

export default CompanionCard;
