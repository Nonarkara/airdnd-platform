import { useEffect, useState } from 'react';
import './InsightsOverlay.css';

const DEFAULT_LAT = 13.7563;
const DEFAULT_LON = 100.5018;

function InsightsOverlay({ listing, onClose, t }) {
  const [envData, setEnvData] = useState({ loading: true, aqi: null, rain: null, error: false });

  const metrics = listing?.metrics || {};
  const bestTime = metrics.best_time_to_book || 'Flexible / Walk-in';
  const staffCount = metrics.staff_count || 'Varies';
  const priceAssessment = metrics.price_assessment || 'Standard Rate';

  const mentionCount = Number(listing?.mention_count) || 1;
  const ageDays = Math.max(1, (new Date() - new Date(listing?.created_at || new Date())) / (1000 * 60 * 60 * 24));
  const mentionsPerDay = (mentionCount / ageDays).toFixed(2);

  const pulseBars = Array.from({ length: 24 }, (_, i) => {
    const seed = (String(listing?.id).charCodeAt(0) || 1) + i;
    const base = Math.abs(Math.sin(seed)) * 40;
    const recencyBoost = i > 16 ? Math.min(60, mentionCount * 2) : 0;
    return Math.min(100, Math.floor(base + recencyBoost + 10));
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchEnvironmentData() {
      try {
        const lat = listing?.latitude || DEFAULT_LAT;
        const lon = listing?.longitude || DEFAULT_LON;

        const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`);
        const aqiData = await aqiRes.json();
        const aqi = aqiData?.current?.us_aqi ?? null;

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability&timezone=auto&forecast_days=1`);
        const weatherData = await weatherRes.json();

        let rainProb = 0;
        if (weatherData?.hourly?.precipitation_probability) {
          const currentHour = new Date().getHours();
          rainProb = weatherData.hourly.precipitation_probability[currentHour] ?? 0;
        }

        if (isMounted) {
          setEnvData({ loading: false, aqi, rain: rainProb, error: false });
        }
      } catch (err) {
        if (isMounted) {
          setEnvData({ loading: false, aqi: null, rain: null, error: true });
        }
      }
    }

    fetchEnvironmentData();

    return () => {
      isMounted = false;
    };
  }, [listing]);

  const getAqiStatus = (aqi) => {
    if (aqi === null) return { label: 'Unavailable', color: 'var(--color-cream-muted)' };
    if (aqi <= 50) return { label: 'Good', color: 'var(--color-status)' };
    if (aqi <= 100) return { label: 'Moderate', color: 'var(--color-data)' };
    if (aqi <= 150) return { label: 'Unhealthy', color: 'var(--color-action)' };
    return { label: 'Hazardous', color: 'var(--color-action)' };
  };

  const aqiStatus = getAqiStatus(envData.aqi);
  const isHighRain = envData.rain > 50;

  return (
    <div className="insights-overlay-backdrop" onClick={onClose}>
      <div
        className="insights-overlay-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Listing Insights"
      >
        <div className="insights-header">
          <h2>Location Insights</h2>
          <button type="button" className="insights-btn-close" onClick={onClose} aria-label="Close insights">
            ×
          </button>
        </div>

        <div className="insights-content">
          <p className="insights-description">
            Community signals and local conditions for <strong>{listing?.name}</strong>. Use this to plan your visit.
          </p>

          <div className="insights-pulse-panel">
            <div className="pulse-header">
              <span className="pulse-label">Community Interest</span>
              <span className="pulse-velocity">{mentionsPerDay} mentions/day</span>
            </div>
            <div className="pulse-bars" aria-label="Activity volume visualization">
              {pulseBars.map((h, i) => (
                <div key={i} className="pulse-bar" style={{ height: `${h}%`, opacity: h > 20 ? 1 : 0.4 }} />
              ))}
            </div>
            <p className="pulse-sub">Based on {mentionCount} total mentions over {Math.ceil(ageDays)} days</p>
          </div>

          <div className="insights-grid-layout">
            <article className="insight-card">
              <span className="insight-label">Best Time to Visit</span>
              <strong>{bestTime}</strong>
              <p>From community signals</p>
            </article>

            <article className="insight-card">
              <span className="insight-label">Team Size</span>
              <strong>{staffCount}</strong>
              <p>Active staff count</p>
            </article>

            <article className="insight-card">
              <span className="insight-label">Price Level</span>
              <strong>{priceAssessment}</strong>
              <p>Market positioning</p>
            </article>
          </div>

          <div className="insights-env-panel">
            <h3 className="env-panel-title">Local Conditions</h3>
            {envData.loading ? (
              <div className="env-loading-stream">Loading weather data…</div>
            ) : envData.error ? (
              <div className="env-error">Weather data temporarily unavailable.</div>
            ) : (
              <div className="env-metrics">
                <div className="env-metric">
                  <span className="env-label">Air Quality</span>
                  <strong style={{ color: aqiStatus.color }}>
                    {envData.aqi !== null ? envData.aqi : '—'}
                  </strong>
                  <span className="env-status" style={{ color: aqiStatus.color }}>{aqiStatus.label}</span>
                </div>
                <div className="env-divider" />
                <div className="env-metric">
                  <span className="env-label">Rain Chance</span>
                  <strong className={isHighRain ? 'rain-high' : 'rain-low'}>
                    {envData.rain !== null ? `${envData.rain}%` : '—'}
                  </strong>
                  <span className="env-status" style={{ color: isHighRain ? 'var(--color-action)' : 'var(--color-status)' }}>
                    {isHighRain ? 'High' : 'Low'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="insights-footer">
          <button type="button" className="btn-insights-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default InsightsOverlay;
