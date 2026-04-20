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
      </div>

      <div className="card-body">
        <header className="card-header">
          <span className="card-overline">{companion.city || 'BANGKOK'}</span>
          <h3 className="card-title">{companion.name}</h3>
        </header>
        
        <div className="card-divider" />

        {companion.description && (
          <p className="card-description">
            {companion.description}
          </p>
        )}

        {companion.tags && companion.tags.length > 0 && (
          <div className="card-tags-mini">
            {companion.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="card-tag-item">
                {tag}
                {i < Math.min(companion.tags.length - 1, 2) && <span className="card-tag-bullet">•</span>}
              </span>
            ))}
          </div>
        )}

        <footer className="card-footer-data">
          <div className="data-col">
            <span className="data-label">RATE</span>
            <span className="data-value highlight">{companion.priceLabel}</span>
          </div>
          <div className="data-col">
            <span className="data-label">HOURS</span>
            <span className="data-value">{companion.hours || '—'}</span>
          </div>
          <div className="data-col flex-end">
            <div className="card-links">
              {companion.phone && (
                <a href={`tel:${companion.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>Call</a>
              )}
              {companion.lineUrl && (
                <a href={companion.lineUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>LINE</a>
              )}
              {companion.mapsUrl && (
                <a href={companion.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Map</a>
              )}
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

export default CompanionCard;
