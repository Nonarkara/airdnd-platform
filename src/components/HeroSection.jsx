import {
  formatSourceChannelName,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
  hasMatchedMedia,
} from '../lib/listings';
import './HeroSection.css';

function HeroSection({
  t,
  metrics,
  intakeSummary,
  recentListings,
  dataState,
  onRefresh,
}) {
  const spotlight = recentListings[0] || null;
  const railItems = recentListings.slice(1, 5);
  const sourceLeaders = intakeSummary?.channelLeaders || [];
  const spotlightTimestamp = spotlight
    ? formatPreciseTimestamp(spotlight.postedAt || spotlight.updatedAt)
    : null;

  return (
    <section className="hero-shell" id="overview" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-status-row">
          <span className="status-pill">{dataState.sourceLabel}</span>
          <p className="hero-status-note">{dataState.note}</p>
        </div>

        <p className="section-kicker">{t.hero.kicker}</p>
        <h1 id="hero-title">{t.hero.title}</h1>
        <p className="hero-subtitle">{t.hero.subtitle}</p>

        <div className="hero-actions">
          <button type="button" className="btn-refresh" onClick={onRefresh} disabled={dataState.isRefreshing}>
            {dataState.isRefreshing ? t.common.refreshing : t.hero.primaryAction}
          </button>
          <a href="#live-listings" className="hero-link">
            {t.hero.secondaryAction}
          </a>
        </div>

        <div className="hero-ribbon" aria-label="Product signals">
          <span>{t.hero.ribbon.primary}</span>
          <span>{t.hero.ribbon.secondary}</span>
          <span>{t.hero.ribbon.tertiary}</span>
          <span>{t.hero.ribbon.quaternary}</span>
        </div>

        <dl className="hero-metrics">
          <div className="hero-metric">
            <dt>{t.hero.metrics.total}</dt>
            <dd>{metrics.total}</dd>
          </div>
          <div className="hero-metric">
            <dt>{t.hero.signals.throughput}</dt>
            <dd>
              {intakeSummary?.throughputPerHour || 0}
              <span>{t.hero.signals.perHour}</span>
            </dd>
          </div>
          <div className="hero-metric">
            <dt>{t.hero.metrics.channels}</dt>
            <dd>{metrics.sourceChannelCount}</dd>
          </div>
          <div className="hero-metric">
            <dt>{t.hero.metrics.media}</dt>
            <dd>{metrics.matchedMediaCount}</dd>
          </div>
        </dl>

        <div className="hero-notes">
          <p>{t.hero.notes.primary}</p>
          <p>{t.hero.notes.secondary}</p>
          {dataState.warning ? <p className="hero-warning">{dataState.warning}</p> : null}
        </div>
      </div>

      <div className="hero-stage">
        {spotlight ? (
          <article className="hero-spotlight">
            <div className="hero-spotlight-media">
              <img src={spotlight.isSafeImage !== false ? spotlight.imageUrl : '/mockups/109748.jpg'} alt={spotlight.name} />
            </div>

            <div className="hero-spotlight-copy">
              <div className="hero-spotlight-meta">
                <span>{t.hero.spotlightLabel}</span>
                <strong>{formatSourceChannelName(spotlight.sourceChannel) || t.intake.unknownChannel}</strong>
              </div>

              <div className="hero-spotlight-headline">
                <h2>{spotlight.name}</h2>
                <p>{spotlight.location}</p>
              </div>

              <div className="hero-spotlight-details">
                <span>{spotlight.priceLabel}</span>
                {spotlight.hours ? <span>{spotlight.hours}</span> : null}
                <span>{spotlightTimestamp || t.hero.timestampPending}</span>
              </div>

              <div className="hero-spotlight-footer">
                <span className={`hero-photo-status${hasMatchedMedia(spotlight) ? ' is-matched' : ''}`}>
                  {hasMatchedMedia(spotlight) ? t.hero.photoMatched : t.hero.photoFallback}
                </span>
                <span>{formatRelativeTimestamp(spotlight.postedAt || spotlight.updatedAt)}</span>
              </div>
            </div>
          </article>
        ) : (
          <div className="hero-spotlight hero-spotlight-empty">
            <strong>{t.hero.emptyRail}</strong>
          </div>
        )}

        <aside className="hero-rail" aria-label={t.hero.railLabel}>
          <div className="hero-rail-header">
            <span>{t.hero.railLabel}</span>
            <strong>{t.hero.railTitle}</strong>
          </div>

          <div className="hero-rail-list">
            {railItems.length > 0 ? (
              railItems.map((listing) => (
                <article key={listing.id} className="hero-rail-item">
                  <div>
                    <strong>{listing.name}</strong>
                    <p>{listing.location}</p>
                  </div>
                  <div className="hero-rail-item-meta">
                    <span>{formatSourceChannelName(listing.sourceChannel) || t.intake.unknownChannel}</span>
                    <small>{formatRelativeTimestamp(listing.postedAt || listing.updatedAt)}</small>
                  </div>
                </article>
              ))
            ) : (
              <p className="hero-rail-empty">{t.hero.emptyRail}</p>
            )}
          </div>

          <div className="hero-source-mix">
            {sourceLeaders.length > 0 ? (
              sourceLeaders.map((channel) => (
                <div key={channel.channel} className="hero-source-pill">
                  <span>{formatSourceChannelName(channel.channel) || channel.channel}</span>
                  <strong>{channel.count}</strong>
                </div>
              ))
            ) : (
              <div className="hero-source-pill">
                <span>{t.hero.topSourceLabel}</span>
                <strong>{t.hero.signals.pending}</strong>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default HeroSection;
