import {
  SOURCE_LABELS,
  formatPreciseTimestamp,
  formatRelativeTimestamp,
} from '../lib/listings';
import './HeroSection.css';

function HeroSection({
  t,
  metrics,
  sourceLabel,
  statusNote,
  lastLoadedAt,
  onRefresh,
  isRefreshing,
  recentListings,
}) {
  const heroListings = Array.isArray(recentListings) ? recentListings.slice(0, 4) : [];

  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-banner">
        <div className="hero-banner-content">
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
        </div>

        <div className="hero-illustration" aria-hidden="true">
          <img src="/hero-illustration.svg" alt="" />
        </div>
      </div>

      <div className="hero-stats-bar">
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
            <strong>{metrics.cityCount}</strong>
            <span>{t.hero.metrics.cities}</span>
          </div>
          <div className="hero-metric">
            <strong>{metrics.bangkokCount}</strong>
            <span>{t.hero.metrics.bangkok}</span>
          </div>
        </div>

        <div className="hero-recent">
          <div className="hero-recent-header">
            <span>{t.hero.railLabel}</span>
            <strong>{t.hero.railTitle}</strong>
          </div>

          {heroListings.length > 0 ? (
            <ol className="hero-live-list">
              {heroListings.map((listing, index) => (
                <li key={listing.id} className="hero-live-item">
                  <span className="hero-live-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div className="hero-live-main">
                    <div className="hero-live-mainline">
                      <strong>{listing.name}</strong>
                      <span>{listing.priceLabel}</span>
                    </div>
                    <p>{listing.location}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hero-live-empty">{t.hero.emptyRail}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
