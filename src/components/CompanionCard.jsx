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
      className="organic-card group"
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
        {companion.tags && companion.tags.length > 0 && (
          <div className="organic-tags">
            {companion.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="organic-tag-pill">
                {tag}
              </span>
            ))}
          </div>
        )}

        <header className="card-header">
          <h3 className="organic-title">{companion.name}</h3>
        </header>

        {companion.description ? (
          <p className="organic-description">
            {companion.description}
          </p>
        ) : (
          <p className="organic-description">
            Experience the Rhythm of Tranquility at {companion.city || 'Bangkok'}.
          </p>
        )}

        <footer className="organic-footer">
          <span className="organic-price">{companion.priceLabel}</span>
          <span className="organic-link">Discover</span>
        </footer>
      </div>
    </article>
  );
}

export default CompanionCard;
