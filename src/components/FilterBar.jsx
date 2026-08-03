import './FilterBar.css';

function FilterBar({
  searchTerm,
  setSearchTerm,
  locationOptions,
  activeLocation,
  setActiveLocation,
  activityOptions,
  activeActivity,
  setActiveActivity,
  sortOptions,
  sortBy,
  setSortBy,
  activePriceTier = 'all',
  setActivePriceTier,
  activeOpenStatus = 'all',
  setActiveOpenStatus,
  onOpenDistrictDrawer,
  onRefresh,
  isRefreshing,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  t,
}) {
  return (
    <section className="filter-bar" aria-label={t.filters.ariaLabel}>
      <div className="filter-field filter-search">
        <label htmlFor="search-listings">{t.filters.searchLabel}</label>
        <input
          id="search-listings"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t.filters.searchPlaceholder}
        />
        {searchTerm && (
          <button
            type="button"
            className="filter-search-clear"
            onClick={() => setSearchTerm('')}
            aria-label={t.filters.searchLabel}
          >
            ×
          </button>
        )}
      </div>

      <div className="filter-field">
        <label htmlFor="filter-location">{t.filters.location}</label>
        <select
          id="filter-location"
          value={activeLocation}
          onChange={(event) => setActiveLocation(event.target.value)}
        >
          {locationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-activity">{t.filters.activity}</label>
        <select
          id="filter-activity"
          value={activeActivity}
          onChange={(event) => setActiveActivity(event.target.value)}
        >
          {activityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-price">{t.filters.priceTier}</label>
        <select
          id="filter-price"
          value={activePriceTier}
          onChange={(event) => setActivePriceTier && setActivePriceTier(event.target.value)}
        >
          <option value="all">{t.filters.allPrices}</option>
          <option value="economy">{t.filters.economy}</option>
          <option value="mid">{t.filters.mid}</option>
          <option value="premium">{t.filters.premium}</option>
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-status">{t.filters.openStatus}</label>
        <select
          id="filter-status"
          value={activeOpenStatus}
          onChange={(event) => setActiveOpenStatus && setActiveOpenStatus(event.target.value)}
        >
          <option value="all">{t.filters.allStatuses}</option>
          <option value="open">{t.filters.openNow}</option>
          <option value="247">{t.filters.open247}</option>
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-sort">{t.filters.sortBy}</label>
        <select
          id="filter-sort"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              {t.sortOptions?.[option] || option}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-actions">
        {onOpenDistrictDrawer && (
          <button
            type="button"
            className="filter-district-matrix-btn"
            onClick={onOpenDistrictDrawer}
            title={t.districtDrawer?.title || t.filters.districtMatrix}
          >
            {t.filters.districtMatrix}
          </button>
        )}
        <button
          type="button"
          className="filter-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? t.common.refreshing : t.filters.refreshButton}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-clear"
            onClick={onClearFilters}
          >
            {t.filters.clearButton || 'Clear'}
          </button>
        )}
      </div>

      {resultCount != null && (
        <div className="filter-results-count" aria-live="polite">
          {resultCount.toLocaleString()} {t.featured.countLabel}
        </div>
      )}
    </section>
  );
}

export default FilterBar;
