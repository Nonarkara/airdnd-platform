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
  const tickerItems = intake.newestListings.length > 0
    ? [...intake.newestListings, ...intake.newestListings]
    : [];

  return (
    <section className="live-intake-strip" aria-label={t.intake.tickerLabel} aria-live="polite">
      <div className="live-intake-label">
        <span>{t.intake.kicker}</span>
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
