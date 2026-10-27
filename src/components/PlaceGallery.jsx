import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import './PlaceGallery.css';

const PHOTO_PAGE_SIZE = 60;

function fmtCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// Fill {name} placeholders in a translated template.
function fill(template, values) {
  return Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), template);
}

function formatDateRange(earliest, latest) {
  if (!earliest || !latest) return null;
  const same = earliest === latest;
  if (same) return earliest;
  return `${earliest} → ${latest}`;
}

function PhotoTile({ url, alt, isMissing, tp = {} }) {
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
        <div className="place-photo-missing" title={tp.missingTitle || 'Photo not in current build — full archive on the source Telegram channel'}>
          <span>{tp.archived || 'archived'}</span>
        </div>
      )}
    </div>
  );
}

function VenueWall({ index, t }) {
  const tp = t?.places || {};
  return (
    <section className="place-venue-wall" aria-label={tp.wallLabel || 'Photo archive venues'}>
      <header className="place-section-header">
        <span className="section-kicker">
          {fill(tp.kicker || 'Photo archive · {photos} photos · {venues} venues', {
            photos: fmtCount(index.meta.totalPhotos),
            venues: index.meta.totalVenues,
          })}
        </span>
        <h2>{tp.title || 'Every place we have a photo of'}</h2>
        <p>
          {tp.intro
            || "The Telegram broadcast channels we monitor post a lot of photos. This page makes the full archive visible — what's in the build today, and the volume and date span of what's been collected over time."}
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
                  <PhotoTile key={url + i} url={url} alt={venue.name} tp={tp} />
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
                    <small>{tp.photos || 'photos'}</small>
                  </span>
                  <span className="place-venue-stat">
                    <strong>{formatDateRange(venue.earliest, venue.latest) || '—'}</strong>
                    <small>{tp.archiveSpan || 'archive span'}</small>
                  </span>
                </div>
                {venue.matchedListingCount > 0 && (
                  <div className="place-venue-stat-row">
                    <span className="place-venue-pill">{venue.matchedListingCount} {tp.listingMatch || 'listing match'}</span>
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

function VenueDetail({ t }) {
  const tp = t?.places || {};
  const { slug } = useParams();
  const navigate = useNavigate();
  const [venueData, setVenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [prevSlug, setPrevSlug] = useState(slug);

  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setLoading(true);
    setError(null);
    setPage(1);
    setDateFilter('');
  }

  useEffect(() => {
    let cancelled = false;
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
        <span className="section-kicker">{tp.loading || 'Loading photo archive…'}</span>
      </div>
    );
  }
  if (error || !venueData) {
    return (
      <div className="place-venue-error" role="alert">
        <h2>{tp.notFound || 'Photo archive not found'}</h2>
        <p>{error || fill(tp.noEntry || 'No archive entry for "{slug}".', { slug })}</p>
        <button type="button" onClick={() => navigate('/places')}>
          ← {tp.allVenues || 'All venues'}
        </button>
      </div>
    );
  }

  return (
    <section className="place-venue-detail" aria-label={`${venueData.displayName} — ${tp.photoArchive || 'photo archive'}`}>
      <header className="place-venue-hero">
        <button type="button" className="place-back-btn" onClick={() => navigate('/places')}>
          ← {tp.allVenues || 'All venues'}
        </button>
        <h1>{venueData.displayName}</h1>
        <div className="place-venue-hero-meta">
          <span><strong>{fmtCount(venueData.total)}</strong> {tp.photos || 'photos'}</span>
          <span><strong>{summary?.dateCount || 0}</strong> {tp.daysWithPhotos || 'days with photos'}</span>
          <span><strong>{formatDateRange(summary?.earliest, summary?.latest) || '—'}</strong> {tp.archiveSpan || 'archive span'}</span>
          {summary?.peak && (
            <span>
              <strong>{summary.peak.n}</strong> {fill(tp.photosOn || 'photos on {date}', { date: summary.peak.date })}
            </span>
          )}
          <a className="place-venue-source" href={`https://t.me/${String(venueData.channel || venueData.slug || '').replace(/^@/, '')}`} target="_blank" rel="noreferrer">
            {fill(tp.onTelegram || '{channel} on Telegram', { channel: venueData.channel || venueData.slug })} ↗
          </a>
        </div>
        {venueData.matchedListingIds?.length > 0 && (
          <p className="place-venue-listings">
            {fill(
              venueData.matchedListingIds.length === 1
                ? (tp.matchedOne || 'Matched with {n} directory listing — these are the same place, surfaced in the main directory.')
                : (tp.matchedMany || 'Matched with {n} directory listings — these are the same place, surfaced in the main directory.'),
              { n: venueData.matchedListingIds.length },
            )}
          </p>
        )}
      </header>

      <div className="place-venue-toolbar">
      {summary && summary.dateCounts.length > 0 && (
        <div className="place-venue-dates">
          <span className="place-venue-dates-label">{tp.jumpToDate || 'Jump to date'}</span>
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{tp.allDates || 'All dates'} ({fmtCount(venueData.total)})</option>
            {summary.dateCounts.map((d) => (
              <option key={d.date} value={d.date}>
                {d.date} — {d.n} {d.n === 1 ? (tp.photo || 'photo') : (tp.photos || 'photos')}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="place-venue-archive-note">
        {fill(tp.showing || 'Showing {shown} of {total} photos in this build.', {
          shown: fmtCount(pagedPhotos.length),
          total: fmtCount(filteredPhotos.length),
        })}{' '}
        {venueData.total > pagedPhotos.length && (
          <>{tp.placeholderNote || "Photos not in the current deployment come back as a placeholder — the full archive is preserved on the source Telegram channel and in the project's photo backup."}</>
        )}
      </p>
      </div>

      <div className="place-photo-grid">
        {pagedPhotos.map((p, i) => (
          <PhotoTile key={p.url + i} url={p.url} alt={venueData.displayName} tp={tp} />
        ))}
      </div>

      {pagedPhotos.length < filteredPhotos.length && (
        <div className="place-venue-loadmore">
          <button type="button" onClick={() => setPage((p) => p + 1)}>
            {fill(tp.loadMore || 'Load {n} more', { n: Math.min(PHOTO_PAGE_SIZE, filteredPhotos.length - pagedPhotos.length) })}
          </button>
          <span className="place-venue-loadmore-meta">
            {fill(tp.ofCount || '{shown} of {total}', { shown: fmtCount(pagedPhotos.length), total: fmtCount(filteredPhotos.length) })}
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
        <h2>{t?.places?.unavailable || 'Photo archive not available'}</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!index) {
    return (
      <div className="place-venue-loading">
        <span className="section-kicker">{t?.places?.loadingArchive || 'Loading archive…'}</span>
      </div>
    );
  }

  return slug ? <VenueDetail t={t} /> : <VenueWall index={index} t={t} />;
}
