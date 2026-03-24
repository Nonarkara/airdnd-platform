import { useEffect, useState } from 'react';
import {
  createIntakeSummary,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
  getIngestTimestamp,
  getListingTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import './LiveIntakeStrip.css';

function formatClockTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatElapsed(now, value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function LiveIntakeStrip({ t, listings, lastLoadedAt }) {
  const [now, setNow] = useState(() => Date.now());
  const intake = createIntakeSummary(listings);
  const syncTimestamp = intake.latestIngestTimestamp || lastLoadedAt;
  const tickerItems = intake.newestListings.length > 0
    ? [...intake.newestListings, ...intake.newestListings]
    : [];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="live-intake-strip" aria-labelledby="live-intake-title">
      <div className="live-intake-header">
        <div className="live-intake-heading">
          <p className="live-intake-kicker">{t.intake.kicker}</p>
          <h2 id="live-intake-title">{t.intake.title}</h2>
        </div>
        <p className="live-intake-subtitle">{t.intake.subtitle}</p>
      </div>

      <div className="live-intake-stats-row">
        <div className="live-intake-sync">
          <span>{t.intake.syncLabel}</span>
          <strong>{formatClockTime(syncTimestamp) || t.intake.pending}</strong>
          <small>
            {formatElapsed(now, syncTimestamp) || t.intake.pending}
            {syncTimestamp ? ` · ${formatPreciseTimestamp(syncTimestamp)}` : ''}
          </small>
        </div>

        <div className="live-intake-stat">
          <span>{t.intake.stats.last15}</span>
          <strong>{intake.last15Minutes}</strong>
          <small>{t.intake.stats.last15Note}</small>
        </div>

        <div className="live-intake-stat">
          <span>{t.intake.stats.last60}</span>
          <strong>{intake.last60Minutes}</strong>
          <small>{t.intake.stats.last60Note}</small>
        </div>

        <div className="live-intake-stat">
          <span>{t.intake.stats.matched}</span>
          <strong>{intake.matchedRate}%</strong>
          <small>{t.intake.stats.matchedNote}</small>
        </div>

        <div className="live-intake-stat">
          <span>{t.intake.stats.channels}</span>
          <strong>{intake.channelCount}</strong>
          <small>{t.intake.stats.channelsNote}</small>
        </div>
      </div>

      <div className="live-intake-marquee" aria-label={t.intake.tickerLabel}>
        {tickerItems.length > 0 ? (
          <div className="live-intake-track">
            {tickerItems.map((listing, index) => {
              const listingTimestamp = getListingTimestamp(listing) || getIngestTimestamp(listing);

              return (
                <article
                  key={`${listing.id}-${index}`}
                  className="live-intake-item"
                  aria-label={`${listing.name} ${formatPreciseTimestamp(listingTimestamp) || ''}`}
                >
                  <span className={`live-intake-item-dot${hasMatchedMedia(listing) ? ' is-matched' : ''}`} />
                  <strong>{listing.name}</strong>
                  <span>{listing.location}</span>
                  <span>{listing.sourceChannel || t.intake.unknownChannel}</span>
                  <span>{formatRelativeTimestamp(listingTimestamp) || t.intake.pending}</span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="live-intake-empty">{t.intake.empty}</p>
        )}
      </div>

      <div className="live-intake-flow">
        <span className="live-intake-flow-label">{t.intake.channelFlow}</span>
        {intake.channelLeaders.length > 0 ? (
          <ul className="live-intake-flow-list">
            {intake.channelLeaders.map((channel) => (
              <li key={channel.channel} className="live-intake-flow-item">
                <strong>{channel.channel}</strong>
                <span>{channel.count} {t.intake.listingsUnit}</span>
                <em>{channel.share}%</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="live-intake-empty">{t.intake.empty}</p>
        )}
      </div>
    </section>
  );
}

export default LiveIntakeStrip;
