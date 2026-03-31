import './HeroSection.css';

function HeroSection({
  t,
  metrics,
}) {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-cinema">
        {/* The line — like Saul Bass's knife in Psycho */}
        <div className="hero-line" aria-hidden="true" />

        {/* Above the line: the title */}
        <div className="hero-above">
          <h1 id="hero-title" className="hero-title">SABAI<br />SABAI</h1>
        </div>

        {/* Below the line: everything else */}
        <div className="hero-below">
          <p className="hero-tagline">{t.hero.kicker}</p>
          <p className="hero-subtitle">{t.hero.subtitle}</p>

          <div className="hero-metrics">
            <div className="hero-metric">
              <strong>{metrics.total}</strong>
              <span>{t.hero.metrics.total}</span>
            </div>
            <div className="hero-metric-divider" aria-hidden="true" />
            <div className="hero-metric">
              <strong>{metrics.cityCount}</strong>
              <span>{t.hero.metrics.cities}</span>
            </div>
            <div className="hero-metric-divider" aria-hidden="true" />
            <div className="hero-metric">
              <strong>{metrics.matchedMediaCount}</strong>
              <span>{t.hero.metrics.media}</span>
            </div>
          </div>

          <a className="hero-cta" href="#live-listings">
            Browse Directory
          </a>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
