import { useEffect, useState } from 'react';
import PageBanner from './PageBanner';
import { useLanguage } from '../context/LanguageContext';
import './Analytics.css'; // Reuse analytics CSS for layout

export default function PublicWorks() {
  const { t } = useLanguage();
  const [infrastructure, setInfrastructure] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/infrastructure.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setInfrastructure(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="an-page">
      <header className="an-header">
        <div className="an-header-meta">
          <span className="an-badge">Public Works & Zoning</span>
        </div>
      </header>

      <PageBanner image="/heroes/methodology.jpg" tone="dark" compact className="an-hero-banner" ariaLabelledBy="pw-title">
        <h1 id="pw-title">Infrastructure & Urban Density</h1>
        <p>
          Analyzing the intersection of the grey economy and public goods. 
          Locations of venues naturally align with public transit corridors and commercial zoning density.
        </p>
      </PageBanner>

      {infrastructure && (
        <div className="an-grid">
          <section className="an-card an-wide">
            <h2>Transit Corridors (BTS/MRT)</h2>
            <p className="an-card-sub">
              Public transit networks effectively dictate the operational boundaries of premium venues.
            </p>
            <div className="an-table">
              <div className="an-table-head">
                <span>Line</span>
                <span>Stations Mapped</span>
              </div>
              {infrastructure.transitCorridors.map((corridor) => (
                <div key={corridor.line} className="an-table-row">
                  <span style={{ color: corridor.color, fontWeight: 'bold' }}>{corridor.line}</span>
                  <span>{corridor.stations.map(s => s.name).join(', ')}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="an-card an-wide">
            <h2>Municipal Zoning Districts</h2>
            <p className="an-card-sub">
              How businesses align with designated commercial and residential zones.
            </p>
            <div className="an-table">
              <div className="an-table-head">
                <span>District / Area</span>
                <span>Zone Type</span>
                <span>Code</span>
              </div>
              {infrastructure.zoningDistricts.map((zone) => (
                <div key={zone.name} className="an-table-row">
                  <span>{zone.name}</span>
                  <span>{zone.type}</span>
                  <strong style={{ color: 'var(--color-data)' }}>{zone.code}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
