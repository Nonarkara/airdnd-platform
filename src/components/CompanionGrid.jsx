import { useState } from 'react';
import CompanionCard from './CompanionCard';
import './CompanionGrid.css';

function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-badge" />
      <div className="skeleton-overlay">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line-short" />
        <div className="skeleton-row">
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
        </div>
      </div>
    </div>
  );
}

function CompanionGrid({
  companions,
  onCardClick,
  t,
  onClearFilters,
  hasActiveFilters,
  isLoading,
}) {
  const [visibleCount, setVisibleCount] = useState(12);

  if (isLoading && companions.length === 0) {
    return (
      <div className="companion-grid-container">
        <div className="companion-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (companions.length === 0) {
    return (
      <div className="grid-state-card">
        <h3>{t.featured.emptyTitle}</h3>
        <p>{t.featured.emptyBody}</p>
        {hasActiveFilters && (
          <button type="button" className="btn-load-more" onClick={onClearFilters}>
            {t.featured.clearFilters}
          </button>
        )}
      </div>
    );
  }

  const visibleCompanions = companions.slice(0, visibleCount);
  const hasMore = visibleCount < companions.length;

  return (
    <div className="companion-grid-container">
      <div className="companion-grid">
        {visibleCompanions.map((companion, index) => (
          <div
            key={companion.id}
            className="card-entrance"
            style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
          >
            <CompanionCard
              companion={companion}
              onClick={onCardClick}
              t={t}
            />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button
            type="button"
            className="btn-load-more"
            onClick={() => setVisibleCount((current) => current + 12)}
          >
            {t.featured.showMore} ({companions.length - visibleCount} {t.featured.hidden})
          </button>
        </div>
      )}
    </div>
  );
}

export default CompanionGrid;
