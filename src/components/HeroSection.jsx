import './HeroSection.css';

function HeroSection({ t, metrics }) {
  return (
    <section className="command-bar" aria-labelledby="hero-title">
      <div className="cmd-brand">
        <h1 id="hero-title" className="cmd-title">SABAI SABAI</h1>
        <span className="cmd-subtitle">Relaxation Intelligence Center</span>
      </div>

      <div className="cmd-stats">
        <div className="cmd-stat">
          <strong>{metrics.total}</strong>
          <span>Places</span>
        </div>
        <div className="cmd-divider" aria-hidden="true" />
        <div className="cmd-stat">
          <strong>{metrics.cityCount}</strong>
          <span>Cities</span>
        </div>
        <div className="cmd-divider" aria-hidden="true" />
        <div className="cmd-stat">
          <strong>{metrics.matchedMediaCount}</strong>
          <span>Photos</span>
        </div>
        <div className="cmd-divider" aria-hidden="true" />
        <div className="cmd-stat">
          <strong>{metrics.sourceChannelCount}</strong>
          <span>Sources</span>
        </div>
      </div>

      <div className="cmd-status">
        <span className="cmd-status-dot" />
        <span className="cmd-status-text">LIVE</span>
      </div>
    </section>
  );
}

export default HeroSection;
