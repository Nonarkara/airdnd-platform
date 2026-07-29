import { useState } from 'react';
import {
  formatSourceChannelName,
  getSafeListingGalleryUrls,
  isListingNew,
  formatTimeAgo,
} from '../lib/listings';
import { trackListingClick, trackSignal, isListingSaved } from '../lib/tracker';
import { useLanguage } from '../context/LanguageContext';
import './ListingCard.css';

function coverVariant(listing) {
  const key = String(listing?.id || listing?.name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `cv${(hash % 6) + 1}`;
}

function venueInitial(name) {
  const clean = String(name || '').replace(/^[^A-Za-z\u0E00-\u0E7F]+/, '').trim();
  return (clean[0] || '·').toUpperCase();
}

function priceDisplay(listing) {
  if (Number.isFinite(listing?.priceValue) && listing.priceValue > 0) {
    return `฿${listing.priceValue.toLocaleString()}`;
  }
  if (listing?.priceLabel && !/rate on request/i.test(listing.priceLabel)) {
    return listing.priceLabel;
  }
  return '—';
}

function ListingCard({ listing, onClick, priority = false }) {
  const { t } = useLanguage();
  const galleryUrls = getSafeListingGalleryUrls(listing);
  const primaryImage = galleryUrls[0] || null;
  const [imageFailed, setImageFailed] = useState(false);
  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const imgSrc = useLocalFallback
    ? `/images/${primaryImage?.split('/').pop()}`
    : primaryImage;
  const showPhoto = primaryImage && !imageFailed;

  const handleImgError = () => {
    if (!useLocalFallback && primaryImage) setUseLocalFallback(true);
    else setImageFailed(true);
  };

  const sourceName = formatSourceChannelName(listing.sourceChannel) || listing.sourceChannel || '';
  const isNew = isListingNew(listing);
  const province = listing.city || listing.location || '—';
  const tag = (Array.isArray(listing.tags) && listing.tags[0])
    || (Array.isArray(listing.serviceTags) && listing.serviceTags[0])
    || null;
  const price = priceDisplay(listing);
  const variant = coverVariant(listing);
  const [cardSaved, setCardSaved] = useState(() => isListingSaved(listing.id));
  const mentions = Number(listing.mentionCount || 0);
  const freshness = formatTimeAgo(listing.postedAt || listing.updatedAt);

  return (
    <article
      className="lcard"
      onClick={() => {
        trackListingClick(listing.id);
        onClick(listing);
      }}
    >
      <div className="lcard__media">
        {showPhoto ? (
          <div className="photo">
            <img
              src={imgSrc}
              alt=""
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="lcard__img"
              onError={handleImgError}
            />
          </div>
        ) : (
          <div className={`photo ${variant}`}>
            <span className="photo__glyph">{venueInitial(listing.name)}</span>
          </div>
        )}
      </div>

      <div className="lcard__venue">
        <div className="lcard__name-row">
          <span className="lcard__name">{listing.name}</span>
          {isNew && <span className="tag-mango tag">{t.card?.newBadge || 'New'}</span>}
        </div>
        <div className="lcard__meta">
          {tag && <span>{tag}</span>}
          {sourceName && <span className="lcard__src">{sourceName}</span>}
        </div>
      </div>

      <div className="lcard__province" title="Province">
        {province}
      </div>

      <div
        className={`lcard__ads${mentions > 1 ? ' is-hot' : ''}`}
        title={`${mentions} ads logged across tracked channels`}
      >
        <span className="mono">{mentions > 0 ? mentions : 1}</span>
        <span className="lcard__ads-unit">× ads</span>
      </div>

      <div className="lcard__price mono">{price}</div>

      <div className="lcard__fresh mono">{freshness || '—'}</div>

      <div className="lcard__actions" onClick={(e) => e.stopPropagation()}>
        {listing.phone && (
          <a
            href={`tel:${listing.phone}`}
            className="lcard__action"
            title={listing.phone}
            aria-label="Phone"
          >
            Tel
          </a>
        )}
        {listing.lineUrl && (
          <a
            href={listing.lineUrl}
            className="lcard__action"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LINE"
          >
            LINE
          </a>
        )}
        <button
          type="button"
          className={`lcard__save${cardSaved ? ' is-saved' : ''}`}
          onClick={async (event) => {
            event.stopPropagation();
            if (cardSaved) return;
            const ok = await trackSignal(listing.id, 'save');
            if (ok) setCardSaved(true);
          }}
          aria-label={cardSaved ? 'Saved' : 'Save'}
        >
          {cardSaved ? '★' : '☆'}
        </button>
      </div>
    </article>
  );
}

export default ListingCard;
