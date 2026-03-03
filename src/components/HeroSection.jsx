import { formatRelativeTimestamp } from '../lib/listings';
import './HeroSection.css';

function HeroSection({
  t,
  metrics,
  sourceLabel,
  statusNote,
  lastLoadedAt,
  onRefresh,
  isRefreshing,
}) {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="hero-kicker">{t.hero.kicker}</p>

          <h1 id="hero-title">
            <span>Air DnD</span>
            <em>{t.hero.title}</em>
          </h1>

          <p className="hero-subtitle">{t.hero.subtitle}</p>

          <div className="hero-status">
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

          <div className="hero-inline-metrics">
            <div className="hero-inline-metric">
              <strong>{metrics.total}</strong>
              <span>{t.hero.metrics.total}</span>
            </div>
            <div className="hero-inline-metric">
              <strong>{metrics.bangkokCount}</strong>
              <span>{t.hero.metrics.bangkok}</span>
            </div>
            <div className="hero-inline-metric">
              <strong>{metrics.coverage}%</strong>
              <span>{t.hero.metrics.coverage}</span>
            </div>
          </div>
        </div>

        <div className="hero-stage" aria-hidden="true">
          <div className="hero-gallery">
            <div className="hero-shot hero-shot-main">
              <span className="hero-shot-caption">Bangkok pulse</span>
            </div>
            <div className="hero-shot hero-shot-secondary" />
            <div className="hero-shot hero-shot-tertiary" />
          </div>

          <article className="signal-card signal-primary">
            <span className="signal-label">{t.hero.panelLabel}</span>
            <strong>{formatRelativeTimestamp(lastLoadedAt)}</strong>
            <p>{t.hero.notes.primary}</p>
          </article>

          <article className="signal-card signal-secondary">
            <span className="signal-chip">{t.hero.metrics.bangkok}</span>
            <strong>{metrics.bangkokCount}</strong>
            <p>{t.hero.stageCopy.primary}</p>
          </article>

          <article className="signal-card signal-tertiary">
            <span className="signal-chip">{t.hero.metrics.coverage}</span>
            <strong>{metrics.coverage}%</strong>
            <p>{t.hero.notes.secondary}</p>
          </article>
        </div>
      </div>

      <div className="hero-marquee" aria-hidden="true">
        <span>{t.hero.ribbon.primary}</span>
        <span>{t.hero.ribbon.secondary}</span>
        <span>{t.hero.ribbon.tertiary}</span>
        <span>{t.hero.ribbon.quaternary}</span>
      </div>
    </section>
  );
}

export default HeroSection;
