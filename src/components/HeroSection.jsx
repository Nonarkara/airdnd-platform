import {
  formatPreciseTimestamp,
  formatRelativeTimestamp,
  getListingTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import './HeroSection.css';

function HeroSection({
  t,
  metrics,
  intakeSummary,
  sourceLabel,
  statusNote,
  lastLoadedAt,
  onRefresh,
  isRefreshing,
  recentListings,
}) {
  const heroListings = Array.isArray(recentListings) ? recentListings.slice(0, 5) : [];
  const spotlightListing = heroListings[0] || null;
  const secondaryListings = heroListings.slice(1, 5);
  const topChannel = intakeSummary?.topChannel || null;

  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="hero-kicker">{t.hero.kicker}</p>

          <h1 id="hero-title">
            <span>Sabai Sabai</span>
            <em>{t.hero.title}</em>
          </h1>

          <p className="hero-subtitle">{t.hero.subtitle}</p>

          <div className="hero-status-row">
            <span className="hero-live-pill">
              <span className="hero-live-dot" aria-hidden="true" />
              {sourceLabel}
            </span>
            <span className="hero-status-note">{statusNote}</span>
          </div>

          <div className="hero-signal-grid">
            <div className="hero-signal-card">
              <span>{t.hero.signals.throughput}</span>
              <strong>
                {intakeSummary?.throughputPerHour || 0}
                <small>{t.hero.signals.perHour}</small>
              </strong>
              <p>{intakeSummary?.last240Minutes || 0} {t.hero.signals.last4Hours}</p>
            </div>
            <div className="hero-signal-card">
              <span>{t.hero.signals.liveSources}</span>
              <strong>{intakeSummary?.channelCount || metrics.sourceChannelCount || 0}</strong>
              <p>{topChannel ? `${topChannel.channel} · ${topChannel.count}` : t.hero.signals.pending}</p>
            </div>
            <div className="hero-signal-card">
              <span>{t.hero.signals.media}</span>
              <strong>{intakeSummary?.matchedRate || 0}%</strong>
              <p>{intakeSummary?.matchedCount || 0} {t.hero.signals.matchedListings}</p>
            </div>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="hero-primary-action"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? t.common.refreshing : t.hero.primaryAction}
            </button>
            <a className="hero-secondary-action" href="#live-listings">
              {t.hero.secondaryAction}
            </a>
          </div>

          <div className="hero-metrics">
            <div className="hero-metric">
              <strong>{metrics.total}</strong>
              <span>{t.hero.metrics.total}</span>
            </div>
            <div className="hero-metric">
              <strong>{metrics.liveWindowCount}</strong>
              <span>{t.hero.metrics.liveWindow}</span>
            </div>
            <div className="hero-metric">
              <strong>{metrics.matchedMediaCount}</strong>
              <span>{t.hero.metrics.media}</span>
            </div>
            <div className="hero-metric">
              <strong>{metrics.cityCount}</strong>
              <span>{t.hero.metrics.cities}</span>
            </div>
          </div>

          <div className="hero-ribbon">
            <span>{t.hero.ribbon.primary}</span>
            <span>{t.hero.ribbon.secondary}</span>
            <span>{t.hero.ribbon.tertiary}</span>
            <span>{t.hero.ribbon.quaternary}</span>
          </div>
        </div>

        <div className="hero-stage">
          {spotlightListing ? (
            <>
              <article className="hero-spotlight">
                <img
                  src={spotlightListing.imageUrl}
                  alt={spotlightListing.name}
                  className="hero-spotlight-image"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = '/mockups/109748.jpg';
                  }}
                />

                <div className="hero-spotlight-overlay">
                  <span className="hero-spotlight-label">{t.hero.spotlightLabel}</span>
                  <div className="hero-spotlight-head">
                    <span className={`hero-proof-pill${hasMatchedMedia(spotlightListing) ? ' is-matched' : ''}`}>
                      {hasMatchedMedia(spotlightListing) ? t.hero.photoMatched : t.hero.photoFallback}
                    </span>
                    <span className="hero-spotlight-time">
                      {formatPreciseTimestamp(getListingTimestamp(spotlightListing)) || t.hero.timestampPending}
                    </span>
                  </div>
                  <div className="hero-spotlight-copy">
                    <strong>{spotlightListing.name}</strong>
                    <p>{spotlightListing.location}</p>
                  </div>
                </div>
              </article>

              <div className="hero-stage-panel">
                <div className="hero-panel-copy">
                  <span>{t.hero.panelLabel}</span>
                  <strong>{t.hero.railTitle}</strong>
                  <p>{topChannel ? `${t.hero.topSourceLabel} ${topChannel.channel}` : t.hero.notes.secondary}</p>
                </div>

                <div className="hero-panel-stats">
                  <div>
                    <span>{t.hero.metrics.latest}</span>
                    <strong>{formatRelativeTimestamp(lastLoadedAt)}</strong>
                  </div>
                  <div>
                    <span>{t.hero.metrics.channels}</span>
                    <strong>{intakeSummary?.channelCount || metrics.sourceChannelCount || 1}</strong>
                  </div>
                  <div>
                    <span>{t.hero.metrics.coverage}</span>
                    <strong>{metrics.coverage}%</strong>
                  </div>
                  <div>
                    <span>{t.hero.signals.throughput}</span>
                    <strong>{intakeSummary?.last60Minutes || 0}</strong>
                  </div>
                </div>

                {secondaryListings.length > 0 ? (
                  <ol className="hero-live-list">
                    {secondaryListings.map((listing) => (
                      <li key={listing.id} className="hero-live-item">
                        <img
                          src={listing.imageUrl}
                          alt={listing.name}
                          className="hero-live-thumb"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = '/mockups/109748.jpg';
                          }}
                        />
                        <div className="hero-live-main">
                          <div className="hero-live-mainline">
                            <strong>{listing.name}</strong>
                            <span>{listing.priceLabel}</span>
                          </div>
                          <p>{listing.location}</p>
                          <div className="hero-live-meta">
                            <span className={`hero-proof-pill${hasMatchedMedia(listing) ? ' is-matched' : ''}`}>
                              {hasMatchedMedia(listing) ? t.hero.photoMatched : t.hero.photoFallback}
                            </span>
                            <span>{listing.sourceChannel || sourceLabel}</span>
                            <span>
                              {formatPreciseTimestamp(getListingTimestamp(listing)) || t.hero.timestampPending}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="hero-live-empty">{t.hero.emptyRail}</p>
                )}
              </div>
            </>
          ) : (
            <div className="hero-empty-stage">
              <strong>{t.hero.railTitle}</strong>
              <p>{t.hero.emptyRail}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
