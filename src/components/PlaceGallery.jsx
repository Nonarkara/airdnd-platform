import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import './PlaceGallery.css';

const PHOTO_PAGE_SIZE = 60;

function fmtCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatDateRange(earliest, latest) {
  if (!earliest || !latest) return null;
  const same = earliest === latest;
  if (same) return earliest;
  return `${earliest} → ${latest}`;
}

function PhotoTile({ url, alt, isMissing }) {
  const [errored, setErrored] = useState(false);
  const visible = !isMissing && !errored;
  return (
    <div className={`place-photo-tile${visible ? '' : ' is-missing'}`}>
      {visible ? (
        <img
          src={url}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="place-photo-missing" title="Photo not in current build — full archive on the source Telegram channel">
          <span>archived</span>
        </div>
      )}
    </div>
  );
}

function VenueWall({ index, t }) {
  return (
    <section className="place-venue-wall" aria-label="Photo archive venues">
      <header className="place-section-header">
        <span className="section-kicker">Photo archive · {fmtCount(index.meta.totalPhotos)} photos · {index.meta.totalVenues} venues</span>
        <h2>Every place we have a photo of</h2>
        <p>
          The Telegram broadcast channels we monitor post a lot of photos. This page makes the full archive visible —
          what's in the build today, and the volume and date span of what's been collected over time.
        </p>
      </header>

      <div className="place-venue-grid">
        {index.venues.map((venue) => {
          const total = venue.photoCount;
          return (
            <Link
              key={venue.slug}
              to={`/places/${venue.slug}`}
              className="place-venue-card"
            >
              <div className="place-venue-collage">
                {venue.sample.slice(0, 4).map((url, i) => (
                  <PhotoTile key={url + i} url={url} alt={venue.name} />
                ))}
              </div>
              <div className="place-venue-meta">
                <div className="place-venue-name-row">
                  <h3 className="place-venue-name">{venue.name}</h3>
                  <span className="place-venue-channel">{venue.channel}</span>
                </div>
                <div className="place-venue-stats">
                  <span className="place-venue-stat place-venue-stat--count">
                    <strong>{fmtCount(total)}</strong>
                    <small>photos</small>
                  </span>
                  <span className="place-venue-stat">
                    <strong>{formatDateRange(venue.earliest, venue.latest) || '—'}</strong>
                    <small>archive span</small>
                  </span>
                </div>
                {venue.matchedListingCount > 0 && (
                  <div className="place-venue-stat-row">
                    <span className="place-venue-pill">{venue.matchedListingCount} listing match</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function VenueDetail({ index, t }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [venueData, setVenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    setDateFilter('');
    fetch(`/data/place_photos/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!cancelled) {
          setVenueData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const summary = useMemo(() => {
    if (!venueData) return null;
    const dates = venueData.photos
      .map((p) => p.date)
      .filter(Boolean)
      .sort();
    const byDate = {};
    venueData.photos.forEach((p) => {
      if (p.date) byDate[p.date] = (byDate[p.date] || 0) + 1;
    });
    const dateCounts = Object.entries(byDate).map(([date, n]) => ({ date, n }));
    dateCounts.sort((a, b) => b.n - a.n);
    const peak = dateCounts[0];
    return {
      earliest: dates[0] || venueData.earliest,
      latest: dates[dates.length - 1] || venueData.latest,
      peak,
      dateCount: Object.keys(byDate).length,
      dateCounts,
    };
  }, [venueData]);

  const filteredPhotos = useMemo(() => {
    if (!venueData) return [];
    if (!dateFilter) return venueData.photos;
    return venueData.photos.filter((p) => p.date === dateFilter);
  }, [venueData, dateFilter]);

  const pagedPhotos = useMemo(() => {
    return filteredPhotos.slice(0, page * PHOTO_PAGE_SIZE);
  }, [filteredPhotos, page]);

  if (loading) {
    return (
      <div className="place-venue-loading">
        <span className="section-kicker">Loading photo archive…</span>
      </div>
    );
  }
  if (error || !venueData) {
    return (
      <div className="place-venue-error" role="alert">
        <h2>Photo archive not found</h2>
        <p>{error || `No archive entry for "${slug}".`}</p>
        <button type="button" onClick={() => navigate('/places')}>
          ← All venues
        </button>
      </div>
    );
  }

  return (
    <section className="place-venue-detail" aria-label={`${venueData.displayName} photo archive`}>
      <button type="button" className="place-back-btn" onClick={() => navigate('/places')}>
        ← All venues
      </button>
      <header className="place-venue-hero">
        <h1>{venueData.displayName}</h1>
        <div className="place-venue-hero-meta">
          <span><strong>{fmtCount(venueData.total)}</strong> photos</span>
          <span><strong>{summary?.dateCount || 0}</strong> days with photos</span>
          <span><strong>{formatDateRange(summary?.earliest, summary?.latest) || '—'}</strong> archive span</span>
          {summary?.peak && (
            <span>
              <strong>{summary.peak.n}</strong> photos on {summary.peak.date}
            </span>
          )}
          <a className="place-venue-source" href={`https://t.me/${venueData.channel.replace(/^@/, '')}`} target="_blank" rel="noreferrer">
            {venueData.channel} on Telegram ↗
          </a>
        </div>
        {venueData.matchedListingIds?.length > 0 && (
          <p className="place-venue-listings">
            Matched with {venueData.matchedListingIds.length} directory listing{venueData.matchedListingIds.length === 1 ? '' : 's'} — these are the same place, surfaced in the main directory.
          </p>
        )}
      </header>

      {summary && summary.dateCounts.length > 0 && (
        <div className="place-venue-dates">
          <span className="place-venue-dates-label">Jump to date</span>
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All dates ({fmtCount(venueData.total)})</option>
            {summary.dateCounts.map((d) => (
              <option key={d.date} value={d.date}>
                {d.date} — {d.n} photo{d.n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="place-venue-archive-note">
        Showing {fmtCount(pagedPhotos.length)} of {fmtCount(filteredPhotos.length)} photos in this build.{' '}
        {venueData.total > pagedPhotos.length && (
          <>Photos not in the current deployment come back as a placeholder — the full archive is preserved on the source Telegram channel and in the project's photo backup.</>
        )}
      </p>

      <div className="place-photo-grid">
        {pagedPhotos.map((p, i) => (
          <PhotoTile key={p.url + i} url={p.url} alt={venueData.displayName} />
        ))}
      </div>

      {pagedPhotos.length < filteredPhotos.length && (
        <div className="place-venue-loadmore">
          <button type="button" onClick={() => setPage((p) => p + 1)}>
            Load {Math.min(PHOTO_PAGE_SIZE, filteredPhotos.length - pagedPhotos.length)} more
          </button>
          <span className="place-venue-loadmore-meta">
            {fmtCount(pagedPhotos.length)} of {fmtCount(filteredPhotos.length)}
          </span>
        </div>
      )}
    </section>
  );
}

export default function PlaceGallery({ t }) {
  const { slug } = useParams();
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/place_photos_index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!cancelled) setIndex(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="place-venue-error" role="alert">
        <h2>Photo archive not available</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!index) {
    return (
      <div className="place-venue-loading">
        <span className="section-kicker">Loading archive…</span>
      </div>
    );
  }

  return slug ? <VenueDetail index={index} t={t} /> : <VenueWall index={index} t={t} />;
}
