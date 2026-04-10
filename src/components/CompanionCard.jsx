import {
  SOURCE_LABELS,
  formatSourceChannelName,
  formatPreciseTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import { trackListingClick } from '../lib/tracker';
import './CompanionCard.css';

function CompanionCard({ companion, onClick, t }) {
  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || '';
  const isMatched = hasMatchedMedia(companion) && companion.isSafeImage !== false;
  const hasContact = companion.phone || companion.lineUrl || companion.telegramUrl || companion.mapsUrl;

  return (
    <article
      className="row-card"
      onClick={() => { trackListingClick(companion.id); onClick(companion); }}
    >
      {/* Thin photo strip */}
      <div className="row-photo">
        {isMatched ? (
          <img
            src={companion.imageUrl}
            alt=""
            loading="lazy"
            onLoad={(e) => e.currentTarget.classList.add('loaded')}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}
      </div>

      {/* Data */}
      <div className="row-body">
        <span className="row-name">{companion.name}</span>
        <span className="row-area">{companion.city || 'Bangkok'}</span>
        <span className="row-hours">{companion.hours || '—'}</span>
        <span className="row-price">{companion.priceLabel}</span>
      </div>

      {/* Contact links */}
      <div className="row-links">
        {companion.phone && (
          <a href={`tel:${companion.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>Tel</a>
        )}
        {companion.lineUrl && (
          <a href={companion.lineUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>LINE</a>
        )}
        {companion.mapsUrl && (
          <a href={companion.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Map</a>
        )}
      </div>

      {/* Timestamp */}
      <span className="row-time">{preciseTimestamp}</span>
    </article>
  );
}

export default CompanionCard;
