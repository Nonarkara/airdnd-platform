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
      className="bento-card"
      onClick={() => { trackListingClick(companion.id); onClick(companion); }}
    >
      <div className="bento-photo-section">
        {isMatched ? (
          <img
            src={companion.imageUrl}
            alt=""
            loading="lazy"
            className="bento-photo"
            onLoad={(e) => e.currentTarget.classList.add('loaded')}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="bento-photo-placeholder" />
        )}
        
        {companion.tags && companion.tags.length > 0 && (
          <div className="bento-badges-overlay">
            {companion.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="bento-badge">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bento-body">
        <div className="bento-header">
          <h3 className="bento-title">{companion.name}</h3>
          <span className="bento-location">{companion.city || 'Bangkok'}</span>
        </div>

        <div className="bento-data-grid">
          <div className="bento-widget price-widget">
            <span className="widget-label">RATE</span>
            <span className="widget-value">{companion.priceLabel}</span>
          </div>
          
          <div className="bento-widget hours-widget">
            <span className="widget-label">HOURS</span>
            <span className="widget-value">{companion.hours || '24/7'}</span>
          </div>
        </div>

        <div className="bento-actions">
          {companion.lineUrl ? (
            <a href={companion.lineUrl} target="_blank" rel="noopener noreferrer" className="bento-btn btn-line" onClick={(e) => e.stopPropagation()}>
              Open LINE
            </a>
          ) : companion.phone ? (
            <a href={`tel:${companion.phone.replace(/[^\d+]/g, '')}`} className="bento-btn btn-tel" onClick={(e) => e.stopPropagation()}>
              Call
            </a>
          ) : (
            <button className="bento-btn btn-view">View Details</button>
          )}

          {companion.mapsUrl && (
            <a href={companion.mapsUrl} target="_blank" rel="noopener noreferrer" className="bento-btn btn-map icon-only" onClick={(e) => e.stopPropagation()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default CompanionCard;
