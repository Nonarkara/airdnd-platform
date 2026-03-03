import { useState } from 'react';
import './MapSection.css';

function MapSection({ t }) {
  const [showAqi, setShowAqi] = useState(false);
  const [aqiData, setAqiData] = useState(null);
  const [aqiError, setAqiError] = useState('');
  const [loadingAqi, setLoadingAqi] = useState(false);

  const toggleAqi = async () => {
    const nextState = !showAqi;
    setShowAqi(nextState);

    if (!nextState || aqiData || loadingAqi) {
      return;
    }

    setLoadingAqi(true);
    setAqiError('');

    try {
      const response = await fetch(
        'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.75&longitude=100.5167&current=us_aqi,pm2_5,pm10',
      );

      if (!response.ok) {
        throw new Error('AQI service is unavailable.');
      }

      const data = await response.json();
      setAqiData(data.current || null);
    } catch (error) {
      console.error('Failed to fetch AQI', error);
      setAqiError(t.map.aqiError);
    } finally {
      setLoadingAqi(false);
    }
  };

  const getAqiStatus = (aqi) => {
    if (aqi <= 50) {
      return { label: 'Good', color: '#2f855a' };
    }
    if (aqi <= 100) {
      return { label: 'Moderate', color: '#b7791f' };
    }
    if (aqi <= 150) {
      return { label: 'Sensitive', color: '#c05621' };
    }
    if (aqi <= 200) {
      return { label: 'Unhealthy', color: '#c53030' };
    }
    return { label: 'Hazardous', color: '#822727' };
  };

  const aqiStatus = aqiData ? getAqiStatus(aqiData.us_aqi) : null;

  return (
    <section className="map-section" id="map">
      <div className="map-header">
        <div>
          <span className="section-kicker">{t.map.kicker}</span>
          <h2>{t.map.title}</h2>
          <p>{t.map.subtitle}</p>
        </div>

        <button type="button" className="aqi-toggle-btn" onClick={toggleAqi}>
          {showAqi ? t.map.hideAqi : t.map.checkAqi}
        </button>
      </div>

      <div className="map-shell">
        <iframe
          className="map-frame"
          src="https://www.google.com/maps/d/embed?mid=1EvIekONUwOWeJUnOzXDsV7Wp3k5LaiA&ll=13.7500,100.5167&z=11"
          title="Bangkok intelligence coverage map"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {showAqi && (
          <div className="aqi-card">
            {loadingAqi && <p>{t.map.loadingAqi}</p>}

            {!loadingAqi && aqiError && <p>{aqiError}</p>}

            {!loadingAqi && !aqiError && aqiData && (
              <>
                <div className="aqi-card-header">
                  <span>{t.map.aqiTitle}</span>
                  <strong style={{ color: aqiStatus.color }}>{aqiData.us_aqi}</strong>
                </div>
                <span
                  className="aqi-label"
                  style={{
                    backgroundColor: `${aqiStatus.color}1a`,
                    color: aqiStatus.color,
                  }}
                >
                  {aqiStatus.label}
                </span>
                <div className="aqi-metrics">
                  <div className="metric">
                    <span>PM2.5</span>
                    <strong>{aqiData.pm2_5}</strong>
                  </div>
                  <div className="metric">
                    <span>PM10</span>
                    <strong>{aqiData.pm10}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default MapSection;
