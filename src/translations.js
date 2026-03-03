const shared = {
  header: {
    tagline: 'Bangkok after-dark discovery',
  },
  nav: {
    map: 'Map',
    workflow: 'Workflow',
    listings: 'Listings',
  },
  common: {
    refresh: 'Refresh data',
    refreshing: 'Refreshing...',
    language: 'Language',
    logout: 'Logout',
  },
  hero: {
    kicker: 'Live in Bangkok tonight',
    title: 'A live discovery layer for the city after dark.',
    subtitle:
      'Air DnD turns fragmented listings into a polished, premium surface that feels immediate, selective, and alive.',
    primaryAction: 'See what is live now',
    secondaryAction: 'Browse curated listings',
    panelLabel: 'Network pulse',
    metrics: {
      total: 'Active listings',
      bangkok: 'Bangkok now',
      coverage: 'Coverage',
    },
    notes: {
      primary: 'Fresh live signals stay in front when the feed is healthy.',
      secondary: 'Verified backup coverage keeps the surface uninterrupted.',
    },
    stageCopy: {
      primary: 'Curated density across the neighborhoods that actually matter tonight.',
    },
    ribbon: {
      primary: 'Bangkok-first curation',
      secondary: 'Live feed priority',
      tertiary: 'Premium city discovery',
      quaternary: 'Always-on verified backup',
    },
  },
  map: {
    kicker: 'Spatial context',
    title: 'Bangkok coverage map',
    subtitle:
      'Use the map to frame density and neighborhood spread, while the primary experience stays cinematic and fast.',
    checkAqi: 'Show Bangkok AQI',
    hideAqi: 'Hide Bangkok AQI',
    loadingAqi: 'Loading AQI data...',
    aqiTitle: 'Bangkok AQI',
    aqiError: 'AQI data is temporarily unavailable. The map remains online.',
  },
  howItWorks: {
    kicker: 'Operational workflow',
    title: 'How the platform stays reliable',
    subtitle: 'The workflow prioritizes continuity and evidence without sacrificing the live product experience.',
    step1Title: 'Refresh Telegram intake',
    step1Desc:
      'Pull recent source messages, normalize the records, and only write a new snapshot if at least one valid listing is extracted.',
    step2Title: 'Preserve the last good snapshot',
    step2Desc:
      'If live insertions fail, the dashboard still serves the most recent verified JSON snapshot so the page never opens empty.',
    step3Title: 'Present with one data model',
    step3Desc:
      'Cards, filters, and modal views all render from the same normalized listing shape regardless of where the data came from.',
  },
  featured: {
    kicker: 'Monitored listings',
    title: 'Latest tracked profiles',
    subtitle:
      'Filter by neighborhood, inspect real signals, and move through the city with a product that feels fast, selective, and premium.',
    countLabel: 'matching listings',
    showMore: 'Show more',
    hidden: 'remaining',
    loadingTitle: 'Loading reliable coverage',
    loadingBody: 'Checking live data first, then the saved snapshot, before falling back to the verified backup set.',
    emptyTitle: 'No listings match the current filters',
    emptyBody: 'Adjust the city, tag, or text search to restore the full monitored set.',
    clearFilters: 'Clear filters',
  },
  filters: {
    ariaLabel: 'Listing filters',
    searchLabel: 'Search',
    searchPlaceholder: 'Search by name, district, or notes',
    location: 'City',
    activity: 'Tag',
    sortBy: 'Sort',
    allLocations: 'All cities',
    allTags: 'All tags',
    refreshButton: 'Refresh feed',
  },
  card: {
    reviewsLabel: 'reviews',
    pendingTag: 'Verification pending',
    unrated: 'Unrated',
    capturedLabel: 'Captured',
    timestampPending: 'Capture pending',
    viewDetails: 'View details',
  },
  footer: {
    tagline: 'A premium discovery platform for Bangkok after dark.',
    disclaimerTitle: 'Operational note',
    disclaimerText:
      'Air DnD prioritizes live signals, but keeps a verified backup in place so the product surface stays responsive when external services slow down.',
    opsLabel: 'Current source',
    rights: '© 2026 Air DnD. Premium discovery platform.',
    mapLink: 'Map',
    workflowLink: 'Workflow',
    listingsLink: 'Listings',
  },
  modal: {
    close: 'Close details',
    reviews: 'reviews',
    capturedAt: 'Captured at',
    timestampPending: 'Capture pending',
    height: 'Height',
    weight: 'Weight',
    rate: 'Rate',
    about: 'Profile summary',
    source: 'Data source',
    closeCta: 'Return to dashboard',
  },
};

export const translations = {
  en: shared,
  th: shared,
  zh: shared,
  ko: shared,
};
