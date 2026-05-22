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
  const mediaCount = getListingMediaCount(companion);
  const sourceName = formatSourceChannelName(companion.sourceChannel) || companion.sourceChannel || 'Source pending';
  const isNew = isListingNew(companion);
  const [cardSaved, setCardSaved] = useState(() => isListingSaved(companion.id));

  return (
    <article
      className="bento-card"
      onClick={() => {
        trackListingClick(companion.id);
        onClick(companion);
      }}
    >
      <div className="bento-photo-section">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            className="bento-photo"
            onLoad={(event) => event.currentTarget.classList.add('loaded')}
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="bento-photo-placeholder">
            <span>No image</span>
          </div>
        )}

        <div className="bento-badges-overlay">
          {isNew && <span className="bento-badge live-indicator-badge">New</span>}
          {(companion.tags || []).slice(0, 2).map((tag) => (
            <span key={tag} className="bento-badge">{tag}</span>
          ))}
        </div>

        <button
          type="button"
          className={`bento-save-btn${cardSaved ? ' saved' : ''}`}
          onClick={async (event) => {
            event.stopPropagation();
            if (cardSaved) return;
            const ok = await trackSignal(companion.id, 'save');
            if (ok) setCardSaved(true);
          }}
          aria-label={cardSaved ? 'Saved' : 'Save'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={cardSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {mediaCount > 1 && (
          <div className="media-count-badge">
            <span>{mediaCount}</span>
          </div>
        )}
      </div>

      <div className="bento-body">
        <div className="bento-header">
          <span className="bento-source">{sourceName}</span>
          <h3 className="bento-title">{companion.name}</h3>
          <span className="bento-location">{companion.location || companion.city || 'Bangkok'}</span>
          {Number.isFinite(companion.credibility) && companion.credibility > 0 && (
            <span
              className="bento-credibility"
              title={`Credibility ${Math.round(companion.credibility)}/100`}
            >
              <span className="bento-credibility-track" aria-hidden="true">
                <span className="bento-credibility-fill" style={{ width: `${Math.min(100, companion.credibility)}%` }} />
              </span>
              <span className="bento-credibility-num">{Math.round(companion.credibility)}</span>
            </span>
          )}
        </div>

        <div className="bento-signal-row">
          <div>
            <span>Mentions</span>
            <strong>{companion.mentionCount || 1}</strong>
          </div>
          <div>
            <span>Rate</span>
            <strong>{formatRateLabel(companion.priceLabel)}</strong>
          </div>
          <div>
            <span>Hours</span>
            <strong>{companion.hours || '—'}</strong>
          </div>
        </div>

        <p className="bento-description">{companion.description}</p>

        <div className="bento-meta-line">
          <span>{companion.city || 'Bangkok'}</span>
          {preciseTimestamp && <span>{preciseTimestamp}</span>}
        </div>

        <div className="bento-actions">
          {(() => {
            const lineHref = formatLineUrl(companion.lineUrl);
            const telHref = formatTelLink(companion.phone);
            const mapsHref = formatMapsUrl(companion.mapsUrl, companion.latitude, companion.longitude);
            return (
              <>
                {lineHref && (
                  <a href={lineHref} target="_blank" rel="noopener noreferrer" className="bento-btn btn-line" onClick={stopCardClick}>
                    LINE
                  </a>
                )}
                {telHref && (
                  <a href={telHref} className="bento-btn btn-tel" onClick={stopCardClick}>
                    Call
                  </a>
                )}
                {!lineHref && !telHref && (
                  <button type="button" className="bento-btn btn-view">
                    Details
                  </button>
                )}
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="bento-btn btn-map icon-only" onClick={stopCardClick} aria-label="Open map">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </a>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </article>
  );
}

export default CompanionCard;
