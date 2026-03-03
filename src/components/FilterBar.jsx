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
  onRefresh,
  isRefreshing,
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
        <label htmlFor="filter-sort">{t.filters.sortBy}</label>
        <select
          id="filter-sort"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="filter-refresh"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? t.common.refreshing : t.filters.refreshButton}
      </button>
    </section>
  );
}

export default FilterBar;
