import { useState } from 'react';
import ListingCard from './ListingCard';
import './ListingGrid.css';

function SkeletonRow() {
  return (
    <div className="skeleton-card skeleton-row-ledger" aria-hidden="true">
      <div className="skeleton skeleton-thumb" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-row" />
    </div>
  );
}

function ListingGrid({
  listings,
  onCardClick,
  t,
  dataState,
  onClearFilters,
  hasActiveFilters,
  isLoading,
}) {
  const [visibleCount, setVisibleCount] = useState(60);
  const visibleListings = listings.slice(0, visibleCount);

  return (
    <div className="listing-grid-container">
      {isLoading && listings.length === 0 ? (
        <div className="listing-ledger" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="grid-state-card">
          <span className="intel-label">{dataState?.sourceLabel || 'Directory'}</span>
          <h3>{t.featured.emptyTitle}</h3>
          <p>{t.featured.emptyBody}</p>
          {hasActiveFilters && (
            <button type="button" className="btn-load-more" onClick={onClearFilters}>
              {t.featured.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ledger-head" aria-hidden="true">
            <span />
            <span>Venue</span>
            <span>Province</span>
            <span>Activity</span>
            <span>Rate</span>
            <span>Signal</span>
            <span />
          </div>
          <div className="listing-ledger">
            {visibleListings.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onClick={onCardClick}
                priority={index < 6}
              />
            ))}
          </div>

          {visibleCount < listings.length && (
            <div className="load-more-container">
              <button
                type="button"
                className="btn-load-more"
                onClick={() => setVisibleCount((current) => current + 40)}
              >
                {t.featured.showMore} ({listings.length - visibleCount} {t.featured.hidden})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ListingGrid;
