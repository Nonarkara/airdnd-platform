import { useState } from 'react';
import {
  formatSourceChannelName,
  getSafeListingGalleryUrls,
  isListingNew,
  computeGreyScore,
  getMapsStatus,
  formatTimeAgo,
} from '../lib/listings';
import { trackListingClick, trackSignal, isListingSaved } from '../lib/tracker';
import { useLanguage } from '../context/LanguageContext';
import './ListingCard.css';

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

// Grey level → label + colour token
const GREY_LEVEL = {
  legit:     { label: 'LIKELY LEGIT',   cls: 'intel__grey--legit'     },
  ambiguous: { label: 'AMBIGUOUS',      cls: 'intel__grey--ambiguous' },
  grey:      { label: 'GREY SIGNAL',    cls: 'intel__grey--grey'      },
  strong:    { label: 'STRONG GREY',    cls: 'intel__grey--strong'    },
};

const MAPS_ICON = {
  confirmed: { mark: '✓', cls: 'intel__maps--confirmed', title: 'Maps location confirmed by operator' },
  coords:    { mark: '⊙', cls: 'intel__maps--coords',    title: 'Coordinates available — approximate location' },
  search:    { mark: '?', cls: 'intel__maps--search',    title: 'No location data — search fallback' },
};

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
  const area = listing.location || listing.city || 'Bangkok';
  const rating = Number.isFinite(listing.rating) && listing.rating > 0 ? listing.rating.toFixed(1) : null;
  const verified = Number.isFinite(listing.credibility) && listing.credibility >= 60;
  const tag = (Array.isArray(listing.tags) && listing.tags[0]) || (Array.isArray(listing.serviceTags) && listing.serviceTags[0]) || null;
  const price = priceDisplay(listing);
  const variant = coverVariant(listing);

  const [cardSaved, setCardSaved] = useState(() => isListingSaved(listing.id));

  // ── Intel ──────────────────────────────────────────────────────────────────
  const grey = computeGreyScore(listing);
  const greyMeta = GREY_LEVEL[grey.level] || GREY_LEVEL.ambiguous;
  const maps = getMapsStatus(listing);
  const mapsMeta = MAPS_ICON[maps.status] || MAPS_ICON.search;
  const mentions = Number(listing.mentionCount || 0);
  const aliasCount = Number(listing.aliasCount || 1);
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
            <span className="photo__tag">{t.card?.photoMatched || 'PHOTO · matched'}</span>
          </div>
        ) : (
          <div className={`photo ${variant}`}>
            <span className="photo__glyph">{venueInitial(listing.name)}</span>
            <span className="photo__tag">{t.card?.photoFallback || 'awaiting match'}</span>
          </div>
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill={cardSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20s-7-4.5-9.2-9C1.3 7.7 3 4.8 6 4.8c1.9 0 3.2 1.1 4 2.3.8-1.2 2.1-2.3 4-2.3 3 0 4.7 2.9 3.2 6.2C19 15.5 12 20 12 20Z" />
          </svg>
        </button>
      </div>

      <div className="lcard__body">
        <div className="lcard__top">
          <div className="lcard__id">
            <div className="lcard__name">{listing.name}</div>
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
              {t.card?.verifiedTag || 'Verified'}
            </span>
          )}
          {isNew && <span className="tag-mango tag">{t.card?.newBadge || 'New'}</span>}
          {tag && <span className="tag">{tag}</span>}
        </div>

        <div className="lcard__foot">
          <span className="lcard__price">
            {price.prefix && `${price.prefix} `}<b>{price.value}</b>
          </span>
          {freshness && (
            <span className="lcard__fresh" title={`Last activity: ${freshness}`}>
              {freshness}
            </span>
          )}
          {sourceName && (
            <span className="lcard__src">
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M21 4 3 11l6 2.5L12 20l3-7.5L21 4Z" /></svg>
              {sourceName}
            </span>
          )}
        </div>

        {/* ── Intelligence strip ─────────────────────────────────────── */}
        <div className="intel" onClick={(e) => e.stopPropagation()}>
          {/* Grey score */}
          <span className={`intel__grey ${greyMeta.cls}`} title={`Grey score: ${grey.score}% — ${grey.signals.map(s => s.t).join('; ')}`}>
            <span className="intel__pct">{grey.score}%</span>
            <span className="intel__lbl">{greyMeta.label}</span>
          </span>

          <span className="intel__sep" />

          {/* Maps status */}
          <a
            className={`intel__maps ${mapsMeta.cls}`}
            href={maps.link}
            target="_blank"
            rel="noopener noreferrer"
            title={mapsMeta.title}
            aria-label={mapsMeta.title}
          >
            <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <span className="intel__maps-mark">{mapsMeta.mark}</span>
          </a>

          {/* Contact links */}
          <div className="intel__contacts">
            {listing.phone && (
              <a
                href={`tel:${listing.phone}`}
                className="intel__contact"
                title={`Call: ${listing.phone}`}
                aria-label="Phone"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9c0 1-.2 2-.7 3s-1.2 1.8-2.1 2.2c-.9.4-1.8.7-2.7.7-1.3 0-2.9-.5-4.7-1.4C10 20.5 8.3 19.3 6.7 17.7 5.1 16.1 3.9 14.4 3 12.5 2.1 10.7 1.7 9 1.7 7.4c0-.9.2-1.8.6-2.7.4-.9 1.1-1.6 2.2-2.1 1-.5 1.9-.7 2.8-.7.3 0 .7.1 1 .2.3.1.6.3.8.7l2.9 4.1c.3.4.4.7.4 1s-.1.6-.3.9c-.2.3-.4.6-.7.8-.3.3-.6.6-.6.9s.1.6.3.9l2.1 2.1c.3.3.6.5 1 .5.3 0 .6-.2.9-.5.2-.3.5-.5.8-.7.3-.2.6-.3.9-.3.3 0 .6.1 1 .4l4.1 2.9c.4.3.6.6.7.9.1.3.2.7.2 1.1Z"/></svg>
              </a>
            )}
            {listing.lineUrl && (
              <a
                href={listing.lineUrl}
                className="intel__contact intel__contact--line"
                target="_blank"
                rel="noopener noreferrer"
                title="LINE"
                aria-label="LINE"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="icon icon-sm" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61V9.863h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              </a>
            )}
            {listing.telegramUrl && (
              <a
                href={listing.telegramUrl}
                className="intel__contact intel__contact--tg"
                target="_blank"
                rel="noopener noreferrer"
                title="Telegram"
                aria-label="Telegram"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="icon icon-sm" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </a>
            )}
          </div>

          {/* Identity network: this business posts under multiple persona names */}
          {aliasCount > 1 && (
            <span
              className="intel__aliases"
              title={`Posts under ${aliasCount} identities: ${[listing.name, ...(listing.aliasNames || [])].filter(Boolean).slice(0, 8).join(' · ')}`}
            >
              {aliasCount}<span className="intel__x">&nbsp;IDs</span>
            </span>
          )}

          {/* Mention count */}
          {mentions > 1 && (
            <span className="intel__mentions" title={`Posted ${mentions} times across channels`}>
              {mentions}<span className="intel__x">×</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default ListingCard;
