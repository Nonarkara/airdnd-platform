import { useMemo, useState } from 'react';
import { AREAS, nearestListings, resolveLocation } from '../lib/geo';
import { useLanguage } from '../context/LanguageContext';
import { formatTelLink, formatLineUrl, formatMapsUrl } from '../lib/normalization';
import './ProximityFinder.css';

const BUDGETS = [
  { label: '฿500', value: 500 },
  { label: '฿1,000', value: 1000 },
  { label: '฿2,000', value: 2000 },
  { label: null, value: null }, // label from t.proximity.anyBudget
];

// Words, not emoji: the anti-slop rules allow 0 emoji used as icons.
const VIBES = [
  { id: 'any', label: 'All services' },
  { id: 'oil', label: 'Sensual oil & aroma' },
  { id: 'now', label: 'Available right now' },
  { id: 'thai', label: 'Thai & acupressure' },
  { id: 'vip', label: 'VIP private suite' },
  { id: 'latenight', label: 'Late night (24h)' },
];

const THAI_INQUIRY_SCRIPT = 'สวัสดีครับ สอบถามคิวว่างช่วงเวลานี้ครับ มีน้องคนไหนพร้อมให้บริการบ้างครับ? (จาก Sabai Sabai)';
const ENG_INQUIRY_SCRIPT = 'Hello, checking if you have available slots and lineup right now. Thank you!';

function fmtDistance(km, precision) {
  const prefix = precision === 'approximate' ? '~' : '';
  if (km < 1) return `${prefix}${Math.round(km * 1000)} m`;
  return `${prefix}${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function ProximityFinder({ listings, onSelect }) {
  const { t } = useLanguage();
  const tp = t.proximity || {};
  const [origin, setOrigin] = useState(() => ({ coords: AREAS[0].coords, label: AREAS[0].label })); // Default to Sukhumvit
  const [vibe, setVibe] = useState('any');
  const [maxBudget, setMaxBudget] = useState(2000);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const results = useMemo(
    () => (origin ? nearestListings(listings, origin.coords, { maxBudget, vibe, limit: 6 }) : []),
    [listings, origin, maxBudget, vibe],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(tp.errorGeo || 'Geolocation is not available on this device.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setOrigin({
          coords: [pos.coords.latitude, pos.coords.longitude],
          label: tp.useMyLocation || 'Your Current Location',
        });
      },
      () => {
        setLocating(false);
        setError(tp.errorLocation || 'Could not get your location. Please select an area below.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submitQuery = (event) => {
    event.preventDefault();
    const match = resolveLocation(query);
    if (match) {
      setOrigin(match);
      setError(null);
    } else {
      setError(
        (tp.errorQuery || 'No area matched "{query}". Try Sukhumvit, Ratchada, Silom, or Thonglor.').replace(
          '{query}',
          query,
        ),
      );
    }
  };

  const copyScript = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    }
  };

  return (
    <section className="finder" id="concierge">
      <div className="wrap">
        <div className="panel finder__panel">
          <div className="finder__head">
            <div>
              <span className="sec-num">{tp.kicker || 'Decide for me'}</span>
              <h2 className="h3 finder__title">
                {tp.title || 'Find Verified Relaxation & Pleasure Right Now'}
              </h2>
              <p className="finder__sub">
                {tp.subtitle ||
                  'Select your location, mood, and budget. We instantly rank open venues by proximity, transit access, and verified contact channels.'}
              </p>
            </div>
          </div>

          {/* Vibe / Mood Selector */}
          <div className="finder__vibe-row">
            <span className="eyebrow">{tp.vibeLabel || 'Desired vibe & service'}</span>
            <div className="finder__vibe-chips">
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`chip chip--vibe${vibe === v.id ? ' is-active' : ''}`}
                  onClick={() => setVibe(v.id)}
                >
                  {tp.vibes?.[v.id] || v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="finder__controls">
            <button
              type="button"
              className="btn btn-primary finder__locate"
              onClick={useMyLocation}
              disabled={locating}
            >
              <svg className="icon icon-sm" viewBox="0 0 24 24">
                <path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {locating ? (tp.locating || 'Locating…') : (tp.useMyLocation || 'Use My GPS Location')}
            </button>

            <form className="finder__search" onSubmit={submitQuery}>
              <input
                type="text"
                placeholder={tp.searchPlaceholder || '…or type district: Thonglor, Huai Khwang, Silom'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by area"
              />
              <button type="submit" className="btn btn-outline btn-sm">
                {tp.find || 'Find'}
              </button>
            </form>
          </div>

          {/* Quick Area Chips */}
          <div className="finder__chips" role="group" aria-label="Quick area select">
            {AREAS.slice(0, 8).map((area) => (
              <button
                key={area.id}
                type="button"
                className={`chip${origin?.label === area.label ? ' is-active' : ''}`}
                onClick={() => {
                  setOrigin({ coords: area.coords, label: area.label });
                  setError(null);
                }}
              >
                {area.label}
              </button>
            ))}
          </div>

          {/* Budget Filter */}
          <div className="finder__budget">
            <span className="eyebrow">{tp.maxBudget || 'Max Rate / Session'}</span>
            {BUDGETS.map((b) => (
              <button
                key={b.value ?? 'any'}
                type="button"
                className={`chip${maxBudget === b.value ? ' is-active' : ''}`}
                onClick={() => setMaxBudget(b.value)}
              >
                {b.label || tp.anyBudget || 'Any budget'}
              </button>
            ))}
          </div>

          {error && <p className="finder__error">{error}</p>}

          {/* Results Grid */}
          {origin && (
            <div className="finder__results">
              <div className="finder__results-head">
                <span className="panel__sub">
                  {tp.matchesNear || 'Matches near'} <b style={{ color: 'var(--ink)' }}>{origin.label}</b>
                  {maxBudget ? ` · ${tp.under || 'under'} ฿${maxBudget.toLocaleString()}` : ''}
                  {vibe !== 'any' ? ` · ${tp.vibes?.[vibe] || VIBES.find((v) => v.id === vibe)?.label}` : ''}
                </span>
                <span className="panel__sub mono" style={{ color: 'var(--mango)' }}>
                  {results.length} {results.length === 1 ? (tp.placeMatched || 'place matched') : (tp.placesMatched || 'places matched')}
                </span>
              </div>

              {results.length === 0 ? (
                <div className="finder__empty">
                  <p>{(tp.noMatchIn || 'No listings matched this exact filter combination in {area}.').replace('{area}', origin.label)}</p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      setVibe('any');
                      setMaxBudget(null);
                    }}
                  >
                    {tp.widenFilters || 'Widen filters (any budget and service)'}
                  </button>
                </div>
              ) : (
                <div className="finder__card-grid">
                  {results.map(({ listing, distanceKm, price, askRate, precision, transit }, i) => {
                    const telHref = formatTelLink(listing.phone);
                    const lineHref = formatLineUrl(listing.lineUrl);
                    const mapsHref = formatMapsUrl(listing.mapsUrl, listing.latitude, listing.longitude, {
                      precision: listing.geoPrecision, name: listing.name, location: listing.location,
                    });

                    return (
                      <div key={listing.id} className="finder__card">
                        <div className="finder__card-top" onClick={() => onSelect?.(listing)}>
                          <div className="finder__card-badge">
                            <span className="mono">#{String(i + 1).padStart(2, '0')}</span>
                            <span className="finder__card-dist mono">{fmtDistance(distanceKm, precision)}</span>
                          </div>

                          <h3 className="finder__card-title">{listing.name}</h3>

                          <div className="finder__card-meta">
                            <span>{listing.location || listing.city || 'Bangkok'}</span>
                            {transit && (
                              <span className="finder__transit-pill" title={tp.transitTitle || 'Nearest transit access'}>
                                {transit.tag}
                              </span>
                            )}
                          </div>

                          <div className="finder__card-rate">
                            {askRate ? (
                              <span className="finder__ask">{tp.rateOnRequest || 'Rate on request'}</span>
                            ) : (
                              <span className="mono finder__card-price">฿{price?.toLocaleString()}</span>
                            )}
                            {listing.hours && (
                              <span className="finder__card-hours">{listing.hours}</span>
                            )}
                          </div>
                        </div>

                        {/* Direct 1-Tap Booking Actions */}
                        <div className="finder__card-actions">
                          {lineHref && (
                            <a
                              href={lineHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="finder__action-btn finder__action-line"
                              title="Chat directly on LINE"
                            >
                              {tp.lineChat || 'LINE chat'}
                            </a>
                          )}
                          {telHref && (
                            <a
                              href={telHref}
                              className="finder__action-btn finder__action-tel"
                              title={`Call ${listing.phone}`}
                            >
                              {tp.call || 'Call'}
                            </a>
                          )}
                          {mapsHref && (
                            <a
                              href={mapsHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="finder__action-btn finder__action-map"
                              title="Directions on Google Maps"
                            >
                              {tp.map || 'Map'}
                            </a>
                          )}
                          <button
                            type="button"
                            className="finder__action-btn finder__action-view"
                            onClick={() => onSelect?.(listing)}
                          >
                            {tp.details || 'Details'} →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quick Pre-filled Booking Assistant */}
          <div className="finder__assistant">
            <div className="finder__assistant-head">
              <span className="eyebrow">{tp.assistantTitle || '1-tap inquiry assistant (copy & paste to LINE)'}</span>
              {copiedScript && <span className="finder__copied-badge">{tp.copied || 'Copied to clipboard'}</span>}
            </div>
            <div className="finder__assistant-boxes">
              <button
                type="button"
                className="finder__script-btn"
                onClick={() => copyScript(THAI_INQUIRY_SCRIPT)}
              >
                <span className="finder__script-lang">{tp.thaiInquiry || 'Thai inquiry'}</span>
                <span className="finder__script-text">"{THAI_INQUIRY_SCRIPT}"</span>
                <span className="finder__script-action">{tp.copyScript || 'Copy script'}</span>
              </button>
              <button
                type="button"
                className="finder__script-btn"
                onClick={() => copyScript(ENG_INQUIRY_SCRIPT)}
              >
                <span className="finder__script-lang">{tp.englishInquiry || 'English inquiry'}</span>
                <span className="finder__script-text">"{ENG_INQUIRY_SCRIPT}"</span>
                <span className="finder__script-action">{tp.copyScript || 'Copy script'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProximityFinder;
