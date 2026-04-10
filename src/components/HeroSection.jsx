import './HeroSection.css';

function HeroSection({ t, metrics, dataState }) {
  return (
    <section className="hero">
      <h1 className="hero-title">SABAI SABAI</h1>
      <p className="hero-data">
        {metrics.total} businesses · {metrics.cityCount} cities · {metrics.matchedMediaCount} photos
      </p>
      <p className="hero-sub">
        Thailand wellness intelligence, updated every 30 seconds
      </p>
    </section>
  );
}

export default HeroSection;
