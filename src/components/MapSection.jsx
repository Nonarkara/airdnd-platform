import React, { useState } from 'react';
import './MapSection.css';

function MapSection() {
    const [showAqi, setShowAqi] = useState(false);
    const [aqiData, setAqiData] = useState(null);
    const [loadingAqi, setLoadingAqi] = useState(false);

    const toggleAqi = async () => {
        if (!showAqi && !aqiData) {
            setLoadingAqi(true);
            try {
                // Fetch Bangkok AQI
                const res = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.75&longitude=100.5167&current=us_aqi,pm2_5,pm10");
                const data = await res.json();
                setAqiData(data.current);
            } catch (err) {
                console.error("Failed to fetch AQI", err);
            }
            setLoadingAqi(false);
        }
        setShowAqi(!showAqi);
    };

    const getAqiStatus = (aqi) => {
        if (aqi <= 50) return { label: 'Good', color: '#4ade80' };
        if (aqi <= 100) return { label: 'Moderate', color: '#facc15' };
        if (aqi <= 150) return { label: 'Unhealthy for Sensitive', color: '#fb923c' };
        if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
        return { label: 'Very Unhealthy/Hazardous', color: '#b91c1c' };
    };

    return (
        <section className="map-section">
            <div className="map-header">
                <h2>Bangkok Massage Directories</h2>
                <p>Explore all the recommended parlors across the city. Book directly or let us arrange the perfect companion for your visit.</p>
            </div>
            <div className="map-container relative-container">
                <button className={`aqi-toggle-btn ${showAqi ? 'active' : ''}`} onClick={toggleAqi}>
                    {showAqi ? 'Hide Air Quality' : 'Check Air Quality'}
                </button>

                {showAqi && (
                    <div className="aqi-card">
                        {loadingAqi ? (
                            <p>Loading AQI data...</p>
                        ) : aqiData ? (
                            <>
                                <h3>Bangkok Live AQI</h3>
                                <div className="aqi-value" style={{ color: getAqiStatus(aqiData.us_aqi).color }}>
                                    {aqiData.us_aqi} <span>US AQI</span>
                                </div>
                                <div className="aqi-label" style={{ backgroundColor: getAqiStatus(aqiData.us_aqi).color + '20', color: getAqiStatus(aqiData.us_aqi).color }}>
                                    {getAqiStatus(aqiData.us_aqi).label}
                                </div>
                                <div className="aqi-metrics">
                                    <div className="metric"><span>PM2.5:</span> {aqiData.pm2_5} μg/m³</div>
                                    <div className="metric"><span>PM10:</span> {aqiData.pm10} μg/m³</div>
                                </div>
                            </>
                        ) : (
                            <p>Failed to load data.</p>
                        )}
                    </div>
                )}

                <iframe
                    src="https://www.google.com/maps/d/embed?mid=1EvIekONUwOWeJUnOzXDsV7Wp3k5LaiA"
                    width="100%"
                    height="600"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Bangkok Massage Map"
                ></iframe>
            </div>
        </section>
    );
}

export default MapSection;
