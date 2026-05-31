import { useMemo, useState } from 'react';
import { AREAS, nearestListings, resolveLocation } from '../lib/geo';
import './ProximityFinder.css';

const BUDGETS = [
  { label: '฿300', value: 300 },
  { label: '฿500', value: 500 },
  { label: '฿1,000', value: 1000 },
  { label: 'Any', value: null },
];

function fmtDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function ProximityFinder({ listings, onSelect }) {
  const [origin, setOrigin] = useState(null); // { coords, label }
  const [maxBudget, setMaxBudget] = useState(1000);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const results = useMemo(
    () => (origin ? nearestListings(listings, origin.coords, { maxBudget, limit: 8 }) : []),
    [listings, origin, maxBudget],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation is not available on this device.'); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setOrigin({ coords: [pos.coords.latitude, pos.coords.longitude], label: 'Your location' });
      },
      () => { setLocating(false); setError('Could not get your location. Pick an area below.'); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submitQuery = (event) => {
    event.preventDefault();
    const match = resolveLocation(query);
    if (match) { setOrigin(match); setError(null); }
    else setError(`No area matched "${query}". Try a district or BTS station.`);
  };

  return (
    <section className="finder">
      <div className="wrap">
        <div className="panel finder__panel">
          <div className="finder__head">
            <div>
              <span className="sec-num">// decide for me</span>
              <h2 className="h3 finder__title">
                Where can I get a massage <span className="serif">right now</span>?
              </h2>
              <p className="finder__sub">
                Tell us where you are and your budget. We rank the nearest places by distance — so demand and supply meet at speed.
              </p>
            </div>
          </div>

          <div className="finder__controls">
            <button
              type="button"
              className="btn btn-primary finder__locate"
              onClick={useMyLocation}
              disabled={locating}
            >
              <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {locating ? 'Locating…' : 'Use my location'}
            </button>

            <form className="finder__search" onSubmit={submitQuery}>
              <input
                type="text"
                placeholder="…or type an area: Ladprao, Sukhumvit, Silom"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by area"
              />
              <button type="submit" className="btn btn-outline btn-sm">Find</button>
            </form>
          </div>

          <div className="finder__chips" role="group" aria-label="Quick area select">
            {AREAS.slice(0, 9).map((area) => (
              <button
                key={area.id}
                type="button"
                className={`chip${origin?.label === area.label ? ' is-active' : ''}`}
                onClick={() => { setOrigin({ coords: area.coords, label: area.label }); setError(null); }}
              >
                {area.label}
              </button>
            ))}
          </div>

          <div className="finder__budget">
            <span className="eyebrow">Max ฿ / hour</span>
            {BUDGETS.map((b) => (
              <button
                key={b.label}
                type="button"
                className={`chip${maxBudget === b.value ? ' is-active' : ''}`}
                onClick={() => setMaxBudget(b.value)}
              >
                {b.label}
              </button>
            ))}
          </div>

          {error && <p className="finder__error">{error}</p>}

          {origin && (
            <div className="finder__results">
              <div className="finder__results-head">
                <span className="panel__sub">
                  Nearest to <b style={{ color: 'var(--ink)' }}>{origin.label}</b>
                  {maxBudget ? ` · under ฿${maxBudget.toLocaleString()}` : ''}
                </span>
                <span className="panel__sub">{results.length} match{results.length === 1 ? '' : 'es'}</span>
              </div>

              {results.length === 0 ? (
                <p className="finder__empty">No places match yet — try widening the budget or a different area.</p>
              ) : (
                <div className="index-list finder__list">
                  {results.map(({ listing, distanceKm, price, askRate }, i) => (
                    <button
                      key={listing.id}
                      type="button"
                      className="index-row finder__row"
                      onClick={() => onSelect?.(listing)}
                    >
                      <span className="index-row__n">{String(i + 1).padStart(2, '0')}</span>
                      <div className="index-row__name finder__name">
                        {listing.name}
                        <span className="index-row__area">
                          <svg className="icon icon-sm" viewBox="0 0 24 24"><path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                          {listing.location || listing.city || 'Bangkok'}
                        </span>
                      </div>
                      <span className="finder__dist">{fmtDistance(distanceKm)}</span>
                      <span className="index-row__price">
                        {askRate ? <span className="finder__ask">ask rate</span> : <><b>฿{price}</b>/hr</>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProximityFinder;
