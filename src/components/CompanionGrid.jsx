import React, { useState, useEffect } from 'react';
import CompanionCard from './CompanionCard';
import './CompanionGrid.css';

function CompanionGrid({ companions, onCardClick, t }) {
    const [visibleCount, setVisibleCount] = useState(20);

    const visibleCompanions = companions.slice(0, visibleCount);
    const hasMore = visibleCount < companions.length;

    return (
        <div className="companion-grid-container">
            <div className="companion-grid">
                {visibleCompanions.map(companion => (
                    <CompanionCard
                        key={companion.id}
                        companion={companion}
                        onClick={onCardClick}
                    />
                ))}
            </div>
            {hasMore && (
                <div className="load-more-container">
                    <button className="btn-load-more" onClick={() => setVisibleCount(prev => prev + 20)}>
                        {t.featured.showMore} ({companions.length - visibleCount} {t.featured.hidden})
                    </button>
                </div>
            )}
        </div>
    );
}

export default CompanionGrid;
