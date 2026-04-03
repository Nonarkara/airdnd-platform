import './HeroSection.css';

function HeroSection({ t, metrics }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <section className="command-bar">
      <div className="cmd-left">
        <h1 className="cmd-title">SABAI SABAI</h1>
        <div className="cmd-live">
          <span className="cmd-dot" />
          <span>LIVE</span>
        </div>
      </div>

      <div className="cmd-center">
        <div className="cmd-stat">
          <span className="cmd-val">{metrics.total}</span>
          <span className="cmd-key">LISTINGS</span>
        </div>
        <div className="cmd-sep" />
        <div className="cmd-stat">
          <span className="cmd-val">{metrics.cityCount}</span>
          <span className="cmd-key">CITIES</span>
        </div>
        <div className="cmd-sep" />
        <div className="cmd-stat">
          <span className="cmd-val">{metrics.matchedMediaCount}</span>
          <span className="cmd-key">PHOTOS</span>
        </div>
        <div className="cmd-sep" />
        <div className="cmd-stat">
          <span className="cmd-val">{metrics.sourceChannelCount}</span>
          <span className="cmd-key">SOURCES</span>
        </div>
      </div>

      <div className="cmd-right">
        <span className="cmd-time">{timeStr}</span>
        <span className="cmd-date">{dateStr}</span>
      </div>
    </section>
  );
}

export default HeroSection;
