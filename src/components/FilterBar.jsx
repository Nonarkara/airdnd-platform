import React from 'react';
import './FilterBar.css';

function FilterBar({ activeCategory, setActiveCategory, sortBy, setSortBy, t }) {
    const categories = ['All', 'Dinner', 'Massage', 'Travel'];

    return (
        <div className="filter-bar">
            <div className="filter-group">
                <span className="filter-label">{t.filters.location}</span>
                <select className="filter-select">
                    <option>{t.filters.anywhere}</option>
                    <option>Bangkok</option>
                    <option>Chiang Mai</option>
                    <option>Phuket</option>
                    <option>Pattaya</option>
                    <option>Koh Samui</option>
                </select>
            </div>

            <div className="filter-divider" />

            <div className="filter-group activity-group">
                <span className="filter-label">{t.filters.activity}</span>
                <div className="activity-pills">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`pill-btn ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="filter-divider" />

            <div className="filter-group">
                <span className="filter-label">{t.filters.sortBy}</span>
                <select
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    {/* Sort options must match App.jsx logic for now */}
                    <option>Recommended</option>
                    <option>Age (Youngest)</option>
                    <option>Price (Low to High)</option>
                    <option>Price (High to Low)</option>
                    <option>Rating</option>
                </select>
            </div>

            <button className="btn-search">{t.filters.searchButton}</button>
        </div>
    );
}

export default FilterBar;
