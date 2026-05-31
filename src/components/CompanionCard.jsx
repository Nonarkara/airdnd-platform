import { useState } from 'react';
import {
  formatSourceChannelName,
  getSafeListingGalleryUrls,
  isListingNew,
} from '../lib/listings';
import { trackListingClick, trackSignal, isListingSaved } from '../lib/tracker';
import './CompanionCard.css';

// Stable duotone cover variant (cv1–cv6) from the listing identity — the
// signature "venue-initial" cover when no real photo is matched.
function coverVariant(listing) {
  const key = String(listing?.id || listing?.name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `cv${(hash % 6) + 1}`;
}

function venueInitial(name) {
  const clean = String(name || '').replace(/^[^A-Za-z฀-๿]+/, '').trim();
  return (clean[0] || '·').toUpperCase();
}

function priceDisplay(listing) {
  if (Number.isFinite(listing?.priceValue) && listing.priceValue > 0) {
    return { prefix: 'from', value: `฿${listing.priceValue}` };
  }
  if (listing?.priceLabel && !/rate on request/i.test(listing.priceLabel)) {
    return { prefix: 'from', value: listing.priceLabel };
  }
  return { prefix: '', value: 'On request' };
}

function CompanionCard({ companion, onClick, priority = false }) {
  const galleryUrls = getSafeListingGalleryUrls(companion);
  const primaryImage = galleryUrls[0] || null;
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = primaryImage && !imageFailed;

  const sourceName = formatSourceChannelName(companion.sourceChannel) || companion.sourceChannel || '';
  const isNew = isListingNew(companion);
  const area = companion.location || companion.city || 'Bangkok';
  const rating = Number.isFinite(companion.rating) && companion.rating > 0 ? companion.rating.toFixed(1) : null;
  const verified = Number.isFinite(companion.credibility) && companion.credibility >= 60;
  const tag = (Array.isArray(companion.tags) && companion.tags[0]) || (Array.isArray(companion.serviceTags) && companion.serviceTags[0]) || null;
  const price = priceDisplay(companion);
  const variant = coverVariant(companion);

  const [cardSaved, setCardSaved] = useState(() => isListingSaved(companion.id));

  return (
    <article
      className="lcard"
      onClick={() => {
        trackListingClick(companion.id);
        onClick(companion);
      }}
    >
      <div className="lcard__media">
        {showPhoto ? (
          <div className="photo">
            <img
              src={primaryImage}
              alt=""
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="lcard__img"
              onError={() => setImageFailed(true)}
            />
            <span className="photo__tag">PHOTO · matched</span>
          </div>
        ) : (
          <div className={`photo ${variant}`}>
            <span className="photo__glyph">{venueInitial(companion.name)}</span>
            <span className="photo__tag">awaiting match</span>
          </div>
        )}

        <button
          type="button"
          className={`lcard__save${cardSaved ? ' is-saved' : ''}`}
          onClick={async (event) => {
            event.stopPropagation();
            if (cardSaved) return;
            const ok = await trackSignal(companion.id, 'save');
            if (ok) setCardSaved(true);
          }}
          aria-label={cardSaved ? 'Saved' : 'Save'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={cardSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20s-7-4.5-9.2-9C1.3 7.7 3 4.8 6 4.8c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.7 2.9 3.2 6.2C19 15.5 12 20 12 20Z" />
          </svg>
        </button>
      </div>

      <div className="lcard__body">
        <div className="lcard__top">
          <div className="lcard__id">
            <div className="lcard__name">{companion.name}</div>
            <div className="index-row__area">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {area}
            </div>
          </div>
          <span className="rating" style={!rating ? { color: 'var(--ink-4)' } : undefined}>
            {rating ? (
              <>
                <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" fill="currentColor" stroke="none" /></svg>
                {rating}
              </>
            ) : '—'}
          </span>
        </div>

        <div className="cluster lcard__badges">
          {verified && (
            <span className="badge-verified">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M12 3.5 19 6v5c0 4.6-3 8-7 9.5C8 19 5 15.6 5 11V6Z" /><path d="m9 11.5 2 2 4-4.5" /></svg>
              Verified
            </span>
          )}
          {isNew && <span className="tag-mango tag">New</span>}
          {tag && <span className="tag">{tag}</span>}
        </div>

        <div className="lcard__foot">
          <span className="lcard__price">
            {price.prefix && `${price.prefix} `}<b>{price.value}</b>
          </span>
          {sourceName && (
            <span className="lcard__src">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M21 4 3 11l6 2.5L12 20l3-7.5L21 4Z" /></svg>
              {sourceName}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default CompanionCard;
