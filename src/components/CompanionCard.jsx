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
      className="elegant-card"
      onClick={() => { trackListingClick(companion.id); onClick(companion); }}
    >
      <div className="card-photo-container">
        {isMatched ? (
          <img
            src={companion.imageUrl}
            alt=""
            loading="lazy"
            className="card-photo"
            onLoad={(e) => e.currentTarget.classList.add('loaded')}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="card-photo-placeholder" />
        )}
        <div className="card-price-badge">{companion.priceLabel}</div>
      </div>

      <div className="card-body">
        <div className="card-header">
          <h3 className="card-title">{companion.name}</h3>
        </div>
        
        <div className="card-meta">
          <span>{companion.city || 'Bangkok'}</span>
          <span className="card-dot">•</span>
          <span>{companion.hours || '—'}</span>
        </div>

        <div className="card-footer">
          <div className="card-links">
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
          <span className="card-time">{preciseTimestamp}</span>
        </div>
      </div>
    </article>
  );
}

export default CompanionCard;
