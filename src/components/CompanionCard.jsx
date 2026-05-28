import { useState } from 'react';
import {
  formatSourceChannelName,
  formatPreciseTimestamp,
  getListingMediaCount,
  getSafeListingGalleryUrls,
  isListingNew,
} from '../lib/listings';
import { formatTelLink, formatLineUrl, formatMapsUrl } from '../lib/normalization';
import { trackListingClick, trackSignal, isListingSaved } from '../lib/tracker';
import './CompanionCard.css';

function stopCardClick(event) {
  event.stopPropagation();
}

function formatRateLabel(value) {
  if (!value || /rate on request/i.test(value)) return 'On request';
  return value;
}

function CompanionCard({ companion, onClick, priority = false }) {
  const preciseTimestamp = formatPreciseTimestamp(companion.postedAt)
    || formatPreciseTimestamp(companion.updatedAt)
    || '';
  const galleryUrls = getSafeListingGalleryUrls(companion);
  const primaryImage = galleryUrls[0] || null;
  const sourceName = formatSourceChannelName(companion.sourceChannel) || companion.sourceChannel || 'Source pending';
  const isNew = isListingNew(companion);
  const [cardSaved, setCardSaved] = useState(() => isListingSaved(companion.id));
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article
      className="data-row"
      onClick={() => {
        trackListingClick(companion.id);
        onClick(companion);
      }}
    >
      <div className="row-cell photo-cell">
        {primaryImage && !imageFailed ? (
          <img
            src={primaryImage}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="row-photo"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="row-placeholder">
            <span>IMG</span>
          </div>
        )}
        {isNew && <span className="row-badge">NEW</span>}
      </div>

      <div className="row-cell name-cell">
        <span className="row-title">{companion.name}</span>
        <span className="row-subtitle">
          {sourceName} • {companion.location || companion.city || 'Bangkok'}
        </span>
      </div>

      <div className="row-cell details-cell">
        <span className="row-value">{formatRateLabel(companion.priceLabel)}</span>
        <span className="row-label">Rate</span>
      </div>

      <div className="row-cell metrics-cell">
        <span className="row-value">{preciseTimestamp || '—'}</span>
        <span className="row-label">Updated</span>
      </div>

      <div className="row-actions">
        {(() => {
          const lineHref = formatLineUrl(companion.lineUrl);
          const telHref = formatTelLink(companion.phone);
          const mapsHref = formatMapsUrl(companion.mapsUrl, companion.latitude, companion.longitude);
          return (
            <>
              {lineHref && (
                <a href={lineHref} target="_blank" rel="noopener noreferrer" className="row-btn" onClick={stopCardClick}>
                  LINE
                </a>
              )}
              {telHref && (
                <a href={telHref} className="row-btn" onClick={stopCardClick}>
                  CALL
                </a>
              )}
              {!lineHref && !telHref && (
                <button type="button" className="row-btn" onClick={stopCardClick}>
                  VIEW
                </button>
              )}
              {mapsHref && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="row-btn icon-only" onClick={stopCardClick} aria-label="Open map">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </a>
              )}
            </>
          );
        })()}
      </div>
    </article>
  );
}

export default CompanionCard;
