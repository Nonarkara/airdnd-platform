import { useState } from 'react';
import CompanionCard from './CompanionCard';
import './CompanionGrid.css';

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
      <div className="grid-state-card">
        <h3>{t.featured.loadingTitle}</h3>
        <p>{t.featured.loadingBody}</p>
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
        {visibleCompanions.map((companion) => (
          <CompanionCard
            key={companion.id}
            companion={companion}
            onClick={onCardClick}
            t={t}
          />
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
