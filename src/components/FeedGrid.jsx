import { isPlaceholderName } from '../lib/listing_contract';
import { useEffect, useMemo, useState } from 'react';
import { venueInitial } from '../lib/listings';
import { useCardPhoto } from '../lib/useCardPhoto';
import { dedupeFeed } from '../lib/dedupeFeed';
import { channelLabel } from '../lib/channel';
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

const INITIAL_REVEAL = 48;
const MORE_INCREMENT = 48;
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
  // Headed with a promotion, a date or "new shop" — no business name given.
  if (isPlaceholderName(rawName)) return t?.feed?.unnamed || 'Unnamed post';

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

function FeedCard({ card, onOpen, t }) {
  const displayCard = getDisplayCard(card, t);
  const fresh = isFreshlyIn(card.messageDate);
  const channel = channelLabel(card.channel || '');
  const photos = displayCard.displayPhotoUrls;
  const primary = displayCard.displayPrimaryPhoto;
  const localFallback = primary ? `/images/${primary.split('/').pop()}` : null;
  const photoCandidates = [primary, localFallback].filter((u, i, arr) => u && arr.indexOf(u) === i);
  const photo = useCardPhoto(photoCandidates);
  const postCount = card.postCount || 1;
  const hasPhoto = photo.src && !photo.isFailed;

  // One line of provenance: who posted, how long ago, and only the counts that
  // are real. No badge repeats on every row — only the exception (held) speaks.
  // Ordered by what must survive truncation: age, then the exception (held),
  // then counts; the channel name is the part that can be cut.
  const meta = [
    formatAgo(card.messageDate),
    displayCard.requiresReview ? (t?.feed?.heldShort || 'Held') : null,
    photos.length > 1 ? `${photos.length} photos` : null,
    postCount > 1 ? `${postCount}×` : null,
    `@${channel}`,
  ].filter(Boolean);

  return (
    <article
      className={`feed-row${fresh ? ' is-fresh' : ''}${displayCard.requiresReview ? ' is-held' : ''}`}
      onClick={() => onOpen(displayCard)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(displayCard); } }}
      role="button"
      tabIndex={0}
    >
      <div className={`feed-row-thumb${hasPhoto ? '' : ' is-glyph'}`}>
        {hasPhoto ? (
          <img
            src={photo.src}
            alt=""
            loading="lazy"
            className="feed-row-photo"
            onLoad={photo.onLoad}
            onError={photo.onError}
          />
        ) : (
          <span className="feed-row-glyph">{venueInitial(displayCard.displayName)}</span>
        )}
      </div>

      <div className="feed-row-main">
        <h3 className="feed-row-name">{displayCard.displayName}</h3>
        <p className="feed-row-meta">
          {fresh && <span className="feed-row-new">{t?.feed?.newStamp || 'NEW'}</span>}
          {meta.join(' · ')}
        </p>
        {(card.hours || card.priceLabel) && (
          <p className="feed-row-facts">{[card.hours, card.priceLabel].filter(Boolean).join(' · ')}</p>
        )}
        {(card.telLink || card.lineUrl || card.mapsUrl) && (
          <div className="feed-row-actions">
            {card.telLink && (
              <a href={card.telLink} className="feed-row-chip" onClick={(e) => e.stopPropagation()}>{t?.feed?.call || 'Call'}</a>
            )}
            {card.lineUrl && (
              <a href={card.lineUrl} target="_blank" rel="noopener noreferrer" className="feed-row-chip" onClick={(e) => e.stopPropagation()}>{t?.feed?.line || 'LINE'}</a>
            )}
            {card.mapsUrl && (
              <a href={card.mapsUrl} target="_blank" rel="noopener noreferrer" className="feed-row-chip" onClick={(e) => e.stopPropagation()}>{t?.feed?.map || 'Map'}</a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// What the snapshot actually holds, counted from the rows themselves — the
// databank's size is the evidence, so it is never typed in by hand.
function ledgerOf(rows) {
  const times = rows.map((r) => new Date(r.messageDate).getTime()).filter(Number.isFinite);
  const photoCount = rows.reduce((sum, r) => sum + (Array.isArray(r.photoUrls) ? r.photoUrls.length : 0), 0);
  return {
    posts: rows.length,
    photos: photoCount,
    channels: new Set(rows.map((r) => r.channel).filter(Boolean)).size,
    newest: times.length ? Math.max(...times) : null,
    oldest: times.length ? Math.min(...times) : null,
  };
}

const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const dayOf = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function FeedGrid({ onOpen, t }) {
  const [feed, setFeed] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_REVEAL);
  const [loading, setLoading] = useState(true);
  const [feedMeta, setFeedMeta] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadFeed = () => {
      fetch(`/feed.json?ts=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => {
          if (!cancelled) {
            setFeed(Array.isArray(rows) ? rows : []);
            setLoadedAt(Date.now());
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    };

    fetch(`/feed_meta.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (!cancelled) setFeedMeta(m); })
      .catch(() => { /* sidecar is optional — absence just means "no claim" */ });

    loadFeed();
    const intervalId = window.setInterval(loadFeed, FEED_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const deduped = useMemo(() => dedupeFeed(feed), [feed]);

  const visible = useMemo(() => deduped.slice(0, visibleCount), [deduped, visibleCount]);
  const ledger = useMemo(() => ledgerOf(feed), [feed]);
  const behindMs = ledger.newest && loadedAt ? loadedAt - ledger.newest : null;
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
        {ledger.posts > 0 && (
          <dl className="feed-ledger">
            <div><dt>Posts</dt><dd>{ledger.posts.toLocaleString()}</dd></div>
            <div><dt>Photos</dt><dd>{ledger.photos.toLocaleString()}</dd></div>
            <div><dt>Channels</dt><dd>{ledger.channels}</dd></div>
            <div><dt>Newest</dt><dd>{formatAgo(new Date(ledger.newest).toISOString())}</dd></div>
            <div><dt>Since</dt><dd>{dayOf(ledger.oldest)}</dd></div>
          </dl>
        )}
        {behindMs !== null && behindMs > STALE_AFTER_MS && (
          // Said plainly: the page shows what the snapshot holds, and the
          // snapshot has stopped growing. Silence here reads as a live claim.
          <p className="feed-grid-degraded" role="status">
            Intake is behind: the newest post is {formatAgo(new Date(ledger.newest).toISOString()).replace(' ago', '')} old
            ({new Date(ledger.newest).toISOString().slice(0, 16).replace('T', ' ')} UTC). What follows is the archive.
          </p>
        )}
        {feedMeta?.degraded && (
          // The per-post stream is unavailable, so this list is the deduplicated
          // directory — one card per business. Saying so beats letting the tab
          // pass itself off as a live firehose.
          <p className="feed-grid-degraded" role="status">
            Per-post stream unavailable — showing one card per business from the
            directory snapshot, not every individual post. Rebuilt{' '}
            {new Date(feedMeta.builtAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.
          </p>
        )}
      </header>

      {loading ? (
        <div className="feed-grid-loading">{t?.feed?.loading || 'Loading screened intake...'}</div>
      ) : (
        <>
          <div className="feed-list">
            {visible.map((card) => (
              <FeedCard
                key={card.id}
                card={card}
                onOpen={onOpen}
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
