import './HeroSection.css';

function HeroSection({
  t,
  metrics,
  onRefresh,
  isRefreshing,
}) {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-geometric" aria-hidden="true" />

      <div className="hero-copy">
        <p className="hero-kicker">{t.hero.kicker}</p>

        <h1 id="hero-title">{t.hero.title}</h1>

        <p className="hero-subtitle">{t.hero.subtitle}</p>

        <div className="hero-actions">
          <a className="hero-primary-action" href="#live-listings">
            Browse listings
          </a>
        </div>

        <div className="hero-metrics">
          <div className="hero-metric">
            <strong>{metrics.total}</strong>
            <span>{t.hero.metrics.total}</span>
          </div>
          <div className="hero-metric">
            <strong>{metrics.cityCount}</strong>
            <span>{t.hero.metrics.cities}</span>
          </div>
          <div className="hero-metric">
            <strong>{metrics.matchedMediaCount}</strong>
            <span>{t.hero.metrics.media}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
