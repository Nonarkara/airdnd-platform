import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildHealthMatrix, loadProvinceHiv } from '../lib/health';
import './Health.css';

function Health({ listings = [] }) {
  const [hiv, setHiv] = useState(null);
  const [error, setError] = useState(null);
  const [lens, setLens] = useState('public');

  useEffect(() => {
    let cancelled = false;
    loadProvinceHiv()
      .then((payload) => { if (!cancelled) setHiv(payload); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  const matrix = useMemo(
    () => (hiv ? buildHealthMatrix(hiv, listings) : null),
    [hiv, listings],
  );

  return (
    <div className="health-page">
      <header className="health-mast">
        <p className="health-eyebrow">01 — Concurrent research</p>
        <h1>HIV &amp; STI context beside the inventory</h1>
        <p className="health-lead">
          Open government case data from data.go.th and Bangkok Open Data, read next to
          parlour broadcast density from our Telegram pipeline. Three lenses. One map.
          No stigma theatre — geography for harm reduction.
        </p>
        <div className="health-links">
          <a href="https://data.go.th/dataset/?q=%E0%B9%80%E0%B8%AD%E0%B8%94%E0%B8%AA%E0%B9%8C" target="_blank" rel="noreferrer">data.go.th · เอชไอวี/เอดส์</a>
          <a href="https://hivhub.ddc.moph.go.th/" target="_blank" rel="noreferrer">HIVhub · DDC MOPH</a>
          <Link to="/map">Open map · Epidemic layer</Link>
        </div>
      </header>

      <nav className="health-lenses" aria-label="Research lenses">
        {[
          { id: 'public', label: 'Public epidemic' },
          { id: 'parlour', label: 'Parlour corridor' },
          { id: 'worker', label: 'Worker side' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={lens === item.id ? 'is-on' : ''}
            onClick={() => setLens(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && <p className="health-error">{error}</p>}
      {!matrix && !error && <p className="health-loading">Loading provincial case matrix…</p>}

      {matrix && (
        <>
          <section className="health-stats" aria-label="Snapshot">
            <div>
              <span>National new-in-care</span>
              <strong className="mono">{matrix.nationalTotal.toLocaleString()}</strong>
              <em>Buddhist 2566 / {matrix.year}</em>
            </div>
            <div>
              <span>Provinces covered</span>
              <strong className="mono">{matrix.provinces.length}</strong>
              <em>domicile codes</em>
            </div>
            <div>
              <span>Bangkok facilities</span>
              <strong className="mono">{(matrix.bangkokFacility2024?.totalNewCases || 0).toLocaleString()}</strong>
              <em>new cases · mid-2024 cut</em>
            </div>
            <div>
              <span>Priority corridors</span>
              <strong className="mono">{matrix.rankedCorridors.length}</strong>
              <em>venue density × case load</em>
            </div>
          </section>

          <section className="health-copy">
            {lens === 'public' && (
              <>
                <h2>Public epidemic</h2>
                <p>{matrix.lenses.public}</p>
                <p className="health-caveat">{matrix.meta.caveat || matrix.meta.note}</p>
                <table className="health-table">
                  <thead>
                    <tr><th>Province</th><th>New-in-care 2566</th></tr>
                  </thead>
                  <tbody>
                    {matrix.topCases.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.newCases2566.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {lens === 'parlour' && (
              <>
                <h2>Parlour corridor</h2>
                <p>{matrix.lenses.parlour}</p>
                <p>
                  Co-location is not a guilt score for a shop. It marks provinces where
                  outreach, testing referral, and operator education are worth coordinating
                  because both venue signal and case load are present.
                </p>
                <table className="health-table">
                  <thead>
                    <tr><th>Province</th><th>Venues</th><th>Cases 2566</th><th>Co-locate</th></tr>
                  </thead>
                  <tbody>
                    {matrix.rankedCorridors.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.venueCount}</td>
                        <td className="mono">{row.newCases2566.toLocaleString()}</td>
                        <td className="mono">{row.colocation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {lens === 'worker' && (
              <>
                <h2>Worker side</h2>
                <p>{matrix.lenses.worker}</p>
                <ul className="health-bullets">
                  <li>Concentrate anonymous testing / PrEP access where venue density and case load both rise.</li>
                  <li>Never reverse-identify a person from inventory ads, photos, or phone numbers.</li>
                  <li>Eastern Seaboard and Bangkok facility totals show referral gravity — workers move; services must follow mobility, not only domicile.</li>
                  <li>HIVhub remains the operational dashboard for officers; this page is a public co-reading layer only.</li>
                </ul>
                {matrix.bangkokFacility2024 && (
                  <div className="health-bkk">
                    <h3>Bangkok facility age split (msd018)</h3>
                    <ul>
                      {Object.entries(matrix.bangkokFacility2024.byAge || {}).map(([k, v]) => (
                        <li key={k}><span>{k}</span><em className="mono">{Number(v).toLocaleString()}</em></li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          <footer className="health-foot">
            Sources: {matrix.meta.national} · {matrix.meta.bangkok}. Hub: hivhub.ddc.moph.go.th
          </footer>
        </>
      )}
    </div>
  );
}

export default Health;
