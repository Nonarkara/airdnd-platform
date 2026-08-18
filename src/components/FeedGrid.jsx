import { useEffect, useMemo, useState } from 'react';
import { coverVariant, venueInitial } from '../lib/listings';
import { useCardPhoto } from '../lib/useCardPhoto';
import './FeedGrid.css';

/*
 * FeedGrid — the abundance-first surface.
 *
 * One card per Telegram post (each row of the listing-classified message
 * stream). Reads from /feed.json which the snapshot script writes from
 * channel_messages joined to photo_archive. 800 cards available; the
 * default reveal is 90, "More" loads 60 at a time.
 *
 * Distinct from ListingGrid (which renders the deduplicated canonical
 * listings). The feed shows the firehose; the directory shows the
 * curated set. Both live on the home page.
 */

const INITIAL_REVEAL = 36;
const MORE_INCREMENT = 36;
const FEED_REFRESH_INTERVAL_MS = 60_000;
const REVIEW_NAME = '__review__';

const SENSITIVE_PATTERNS = [
  /open\s*now/i,
  /top\s*model/i,
  /idol/i,
  /super\s*model/i,
  /full\s*service/i,
  /เปิดซิง/i,
  /ชั่วโมง\s*\+\s*ฟูล/i,
  /ลงเตียง/i,
  /ไม่หวงตัว/i,
  /ช่วงล่าง/i,
  /อาบอบนวด/i,
  /น้อง.{0,20}hot/i,
];

const GENERIC_OR_PROMO_NAMES = [
  /^top\s*model$/i,
  /^open\s*(now|no)?$/i,
  /^new$/i,
  /^location$/i,
  /^facebook page$/i,
  /^โปร/i,
  /^เปิดจอง/i,
  /^อัพเดต/i,
  /^update/i,
];

function hasSensitiveCopy(card) {
  const text = [card?.name, card?.description].filter(Boolean).join(' ');
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasGenericOrPromoName(card) {
  const rawName = String(card?.name || '').trim();
  return !rawName
    || rawName.length < 3
    || GENERIC_OR_PROMO_NAMES.some((pattern) => pattern.test(rawName));
}

function getDisplayName(card, t, requiresReview) {
  const rawName = String(card?.name || '').trim();

  if (requiresReview || hasGenericOrPromoName(card)) {
    return t?.feed?.reviewName || 'Source post pending review';
  }

  return rawName;
}

function getDisplayDescription(card, t, requiresReview) {
  if (requiresReview) {
    return t?.feed?.reviewBody || 'This post was detected as promotional or sensitive. Contact fields are kept when available, but raw copy and photos are hidden until review.';
  }

  // Show actual useful snippets when available
  const snippets = [];
  if (card.hours) snippets.push(`Hours: ${card.hours}`);
  if (card.priceLabel) snippets.push(`Rate: ${card.priceLabel}`);
  if (card.phone) snippets.push(`Tel: ${card.phone}`);
  if (card.lineUrl) snippets.push('LINE available');

  if (snippets.length > 0) {
    return snippets.join(' · ');
  }

  return t?.feed?.safeBody || 'Screened source post with extracted contact details.';
}

function getDisplayCard(card, t) {
  const requiresReview = hasSensitiveCopy(card) || hasGenericOrPromoName(card);
  const photoUrls = requiresReview ? [] : (Array.isArray(card.photoUrls) ? card.photoUrls : []);
  return {
    ...card,
    requiresReview,
    displayName: getDisplayName(card, t, requiresReview),
    displayDescription: getDisplayDescription(card, t, requiresReview),
    displayPhotoUrls: photoUrls,
    displayPrimaryPhoto: photoUrls[0] || null,
  };
}

function formatAgo(iso) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
}

const FRESH_WINDOW_MIN = 60;

function isFreshlyIn(iso) {
  if (!iso) return false;
  return (Date.now() - new Date(iso).getTime()) < FRESH_WINDOW_MIN * 60 * 1000;
}

function FeedCard({ card, onOpen, isFreshest, t }) {
  const displayCard = getDisplayCard(card, t);
  const fresh = isFreshlyIn(card.messageDate);
  const channel = (card.channel || '').replace(/^@/, '');
  const photos = displayCard.displayPhotoUrls;
  const primary = displayCard.displayPrimaryPhoto;
  const localFallback = primary ? `/images/${primary.split('/').pop()}` : null;
  const photoCandidates = useMemo(
    () => [primary, localFallback].filter((u, i, arr) => u && arr.indexOf(u) === i),
    [primary, localFallback],
  );
  const photo = useCardPhoto(photoCandidates);
  const extraCount = Math.max(0, photos.length - 1);
  const postCount = card.postCount || 1;
  const variant = coverVariant(card.id || displayCard.displayName);

  return (
    <article
      className={`feed-card${fresh ? ' is-fresh' : ''}${isFreshest ? ' is-freshest' : ''}`}
      onClick={() => onOpen(displayCard)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(displayCard); } }}
      role="button"
      tabIndex={0}
    >
      {photo.src && !photo.isFailed ? (
        <div className={`feed-card-photo-wrap${photo.isLoading ? ' photo--pending' : ''}`}>
          <img
            src={photo.src}
            alt=""
            loading="lazy"
            className="feed-card-photo"
            onLoad={photo.onLoad}
            onError={photo.onError}
          />
          {extraCount > 0 && <span className="feed-card-photo-count">+{extraCount}</span>}
          {postCount > 1 && <span className="feed-card-post-count">{postCount}×</span>}
          {(fresh || isFreshest) && (
            <span className={`feed-card-fresh-stamp${isFreshest ? ' is-just-in' : ''}`}>
              {isFreshest ? 'JUST IN' : 'NEW'}
            </span>
          )}
        </div>
      ) : photo.isFailed && !displayCard.requiresReview ? (
        // A photo was expected but failed to load — a full letter-avatar
        // reads as "this venue, no photo right now," never as a broken image.
        <div className={`feed-card-photo-wrap is-avatar ${variant}`}>
          <span className="feed-card-glyph">{venueInitial(displayCard.displayName)}</span>
          {postCount > 1 && <span className="feed-card-post-count">{postCount}×</span>}
          {(fresh || isFreshest) && (
            <span className={`feed-card-fresh-stamp${isFreshest ? ' is-just-in' : ''}`}>
              {isFreshest ? 'JUST IN' : 'NEW'}
            </span>
          )}
        </div>
      ) : (
        <div className={`feed-card-photo-wrap is-textonly${displayCard.requiresReview ? ' is-review-held' : ''}`}>
          {postCount > 1 && <span className="feed-card-post-count">{postCount}×</span>}
          {(fresh || isFreshest) && (
            <span className={`feed-card-fresh-stamp${isFreshest ? ' is-just-in' : ''}`}>
              {isFreshest ? 'JUST IN' : 'NEW'}
            </span>
          )}
        </div>
      )}

      <div className="feed-card-body">
        <div className="feed-card-review-row">
          <span className={`feed-card-review-badge${displayCard.requiresReview ? ' is-held' : ''}`}>
            {displayCard.requiresReview ? t?.feed?.heldBadge || 'Held for review' : t?.feed?.safeBadge || 'Screened'}
          </span>
        </div>
        <h3 className="feed-card-name">{displayCard.displayName}</h3>
        <div className="feed-card-meta">
          <span className="feed-card-channel">@{channel}</span>
          <span className="feed-card-sep">·</span>
          <span className="feed-card-ago">{formatAgo(card.messageDate)}</span>
        </div>
        {displayCard.displayDescription && (
          <p className="feed-card-desc">{displayCard.displayDescription}</p>
        )}
        <div className="feed-card-actions">
          {card.telLink && (
            <a href={card.telLink} className="feed-card-chip feed-card-chip-tel" onClick={(e) => e.stopPropagation()}>{t?.feed?.call || 'Call'}</a>
          )}
          {card.lineUrl && (
            <a href={card.lineUrl} target="_blank" rel="noopener noreferrer" className="feed-card-chip feed-card-chip-line" onClick={(e) => e.stopPropagation()}>{t?.feed?.line || 'LINE'}</a>
          )}
          {card.mapsUrl && (
            <a href={card.mapsUrl} target="_blank" rel="noopener noreferrer" className="feed-card-chip feed-card-chip-map" onClick={(e) => e.stopPropagation()}>{t?.feed?.map || 'Map'}</a>
          )}
          {card.priceLabel && <span className="feed-card-chip feed-card-chip-price">{card.priceLabel}</span>}
          {card.hours && <span className="feed-card-chip feed-card-chip-hours">{card.hours}</span>}
        </div>
      </div>
    </article>
  );
}

export default function FeedGrid({ onOpen, t }) {
  const [feed, setFeed] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_REVEAL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadFeed = () => {
      fetch(`/feed.json?ts=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => {
          if (!cancelled) {
            setFeed(Array.isArray(rows) ? rows : []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    };

    loadFeed();
    const intervalId = window.setInterval(loadFeed, FEED_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Collapse only literal reposts of the same name within a short window —
  // NOT the entire history. A whole-history collapse (the previous behavior)
  // turned "every post that arrives" into a second directory — one card per
  // business, ever — which is exactly what made this tab feel redundant with
  // the curated grid. A 2h window still absorbs channel-crosspost spam while
  // keeping the feed genuinely chronological: a shop posting again today
  // shows again today.
  const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;
  const deduped = useMemo(() => {
    const sorted = [...feed].sort((a, b) => new Date(b.messageDate) - new Date(a.messageDate));
    const lastSeenAt = new Map();
    const out = [];
    for (const item of sorted) {
      const key = (item.name || '').toLowerCase().trim().replace(/[\s\u200B]+/g, ' ');
      if (!key || key.length < 2) { out.push({ ...item, postCount: 1 }); continue; }
      const prevTime = lastSeenAt.get(key);
      const thisTime = new Date(item.messageDate).getTime();
      if (prevTime != null && prevTime - thisTime < DEDUPE_WINDOW_MS) {
        continue; // repost within the window — the newer card already represents it
      }
      lastSeenAt.set(key, thisTime);
      out.push({ ...item, postCount: 1 });
    }
    return out;
  }, [feed]);

  const visible = useMemo(() => deduped.slice(0, visibleCount), [deduped, visibleCount]);
  const freshestId = useMemo(() => deduped[0]?.id || null, [deduped]);
  const subtitle = (t?.feed?.subtitle || '{unique} businesses visible after screening · {total} source posts reviewed. Sensitive raw copy and photos are held back.')
    .replace('{unique}', deduped.length.toLocaleString())
    .replace('{total}', feed.length.toLocaleString());

  return (
    <section className="feed-grid-section" id="live-feed">
      <header className="feed-grid-header">
        <span className="section-kicker">{t?.feed?.kicker || 'LIVE FEED'}</span>
        <h2>{t?.feed?.title || 'Every post that arrives'}</h2>
        <p className="feed-grid-subtitle">
          {deduped.length > 0
            ? subtitle
            : t?.feed?.empty || 'No screened source posts are available yet.'}
        </p>
      </header>

      {loading ? (
        <div className="feed-grid-loading">{t?.feed?.loading || 'Loading screened intake...'}</div>
      ) : (
        <>
          <div className="feed-grid">
            {visible.map((card) => (
              <FeedCard
                key={card.id}
                card={card}
                onOpen={onOpen}
                isFreshest={card.id === freshestId}
                t={t}
              />
            ))}
          </div>
          {visibleCount < deduped.length && (
            <div className="feed-more-container">
              <button
                type="button"
                className="feed-more-btn"
                onClick={() => setVisibleCount((c) => c + MORE_INCREMENT)}
              >
                {t?.feed?.more || 'More screened posts'}
                <span className="feed-more-count">
                  {(t?.feed?.remaining || '{count} remaining').replace('{count}', (deduped.length - visibleCount).toLocaleString())}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
