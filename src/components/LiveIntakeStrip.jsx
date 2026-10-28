import { useState } from 'react';
import {
  createIntakeSummary,
  formatSourceChannelName,
  formatRelativeTimestamp,
  getIngestTimestamp,
  getListingTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import './LiveIntakeStrip.css';

const BAD_TICKER_NAMES = [
  /^location$/i,
  /^facebook page$/i,
  /โลเคชั้น/i,
  /cracker/i,
];

// A strip that says "live" over a six-day-old post is a false claim. Past this
// age it says "latest" and stops scrolling.
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

function formatTickerName(listing, t) {
  const name = String(listing?.name || '').trim();
  if (!name || BAD_TICKER_NAMES.some((pattern) => pattern.test(name))) {
    return t.intake.pendingName || 'Listing pending review';
  }
  return name;
}

function LiveIntakeStrip({ t, listings, intakeSummary, lastLoadedAt }) {
  const intake = intakeSummary || createIntakeSummary(listings);
  const sourceTimestamp = intake.latestSourceTimestamp || intake.latestIngestTimestamp || lastLoadedAt;
  const [now] = useState(() => Date.now());
  const sourceMs = sourceTimestamp ? new Date(sourceTimestamp).getTime() : NaN;
  const isStale = Number.isFinite(sourceMs) && now - sourceMs > STALE_AFTER_MS;
  const tickerItems = intake.newestListings.length > 0
    ? [...intake.newestListings, ...intake.newestListings]
    : [];

  return (
    <section className={`live-intake-strip${isStale ? ' is-stale' : ''}`} aria-label={t.intake.tickerLabel} aria-live="polite">
      <div className="live-intake-label">
        <span>{isStale ? (t.intake.latestKicker || 'Latest intake') : t.intake.kicker}</span>
        <strong>{sourceTimestamp ? formatRelativeTimestamp(sourceTimestamp) : t.intake.pending}</strong>
      </div>

      <div className="live-intake-marquee">
        {tickerItems.length > 0 ? (
          <div className="live-intake-track">
            {tickerItems.map((listing, index) => {
              const listingTimestamp = getListingTimestamp(listing) || getIngestTimestamp(listing);

              return (
                <article
                  key={`${listing.id}-${index}`}
                  className="live-intake-item"
                >
                  <span className={`live-intake-item-dot${hasMatchedMedia(listing) ? ' is-matched' : ''}`} />
                  <strong>{formatTickerName(listing, t)}</strong>
                  <span>{formatSourceChannelName(listing.sourceChannel) || t.intake.unknownChannel}</span>
                  <span>{formatRelativeTimestamp(listingTimestamp) || t.intake.pending}</span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="live-intake-empty">{t.intake.empty}</p>
        )}
      </div>
    </section>
  );
}

export default LiveIntakeStrip;
