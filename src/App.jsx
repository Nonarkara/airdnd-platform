import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import AtomicClock from './components/AtomicClock';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProximityFinder from './components/ProximityFinder';
import FeedGrid from './components/FeedGrid';
import FilterBar from './components/FilterBar';
import CompanionGrid from './components/CompanionGrid';
import CompanionModal from './components/CompanionModal';
import Footer from './components/Footer';
import AdminGuard from './components/admin/AdminGuard';
import { companions as backupCompanions } from './data/mockData';
import { supabase } from './lib/supabase';
import { initSession } from './lib/tracker';
import {
  SOURCE_LABELS,
  createIntakeSummary,
  createMetrics,
  getListingTimestampValue,
  normalizeListings,
} from './lib/listings';
import { translations } from './translations';

const REFRESH_INTERVAL_MS = 30_000;
const SUPABASE_TIMEOUT_MS = 4_000;
const LIVE_QUERY_LIMIT = 400;
const REALTIME_REFRESH_DEBOUNCE_MS = 1_200;
const ALL_LOCATIONS_VALUE = 'all-locations';
const ALL_TAGS_VALUE = 'all-tags';
const normalizedBackupListings = normalizeListings(backupCompanions, {
  source: 'backup',
  isFallback: true,
});
const ListingMap = lazy(() => import('./components/ListingMap'));
const Methodology = lazy(() => import('./components/Methodology'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const Analytics = lazy(() => import('./components/Analytics'));
const Sociology = lazy(() => import('./components/Sociology'));
const SORT_OPTIONS = [
  'Newest',
  'Most credible',
  'Lowest price',
  'Highest price',
  'Highest rating',
  'Alphabetical',
];
const DATA_SOURCE_NOTES = {
  automatic: {
    supabase: 'Directory is up to date with the latest listings.',
    snapshot: 'Showing a recent snapshot while the live connection catches up.',
    backup: 'Showing cached listings. Live updates will resume shortly.',
  },
  manual: {
    supabase: 'Directory refreshed with the latest listings.',
    snapshot: 'Refreshed with the most recent snapshot.',
    backup: 'Refreshed with cached listings.',
  },
};

function getLatestListingTimestamp(listings) {
  if (!Array.isArray(listings) || listings.length === 0) {
    return 0;
  }

  return listings.reduce((latest, listing) => {
    const timestamp = getListingTimestampValue(listing);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

function sortListings(listings, sortBy) {
  const nextListings = [...listings];

  nextListings.sort((left, right) => {
    // Default lens: composite credibility (mention volume × contact channel
    // breadth × photo count × text quality × recency, less image-reuse
    // penalty). See research/findings-2026-05-02.md §5.
    if (sortBy === 'Most credible') {
      const lc = Number.isFinite(left.credibility) ? left.credibility : 0;
      const rc = Number.isFinite(right.credibility) ? right.credibility : 0;
      if (lc !== rc) return rc - lc;
    }

    if (sortBy === 'Lowest price') {
      return (left.priceValue ?? Number.MAX_SAFE_INTEGER) - (right.priceValue ?? Number.MAX_SAFE_INTEGER);
    }

    if (sortBy === 'Highest price') {
      return (right.priceValue ?? 0) - (left.priceValue ?? 0);
    }

    if (sortBy === 'Highest rating') {
      return (right.rating ?? 0) - (left.rating ?? 0);
    }

    if (sortBy === 'Alphabetical') {
      return left.name.localeCompare(right.name);
    }

    const leftTime = getListingTimestampValue(left);
    const rightTime = getListingTimestampValue(right);

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    const leftId = typeof left.id === 'number' ? left.id : 0;
    const rightId = typeof right.id === 'number' ? right.id : 0;
    return rightId - leftId;
  });

  return nextListings;
}

async function fetchSupabaseListings() {
  const abortController = new AbortController();
  let timedOut = false;
  const supabaseRequest = supabase
    .from('companions')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(LIVE_QUERY_LIMIT)
    .abortSignal(abortController.signal);

  let timeoutId = null;

  let response;
  try {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, SUPABASE_TIMEOUT_MS);
    response = await supabaseRequest;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  if (response.error) {
    if (timedOut || response.error.name === 'AbortError') {
      throw new Error('Live data request timed out.');
    }
    throw response.error;
  }

  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error('No live data available.');
  }

  return normalizeListings(response.data, { source: 'supabase', isFallback: false });
}

async function fetchSnapshotListings() {
  const response = await fetch(`/data.json?ts=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Snapshot file is unavailable.');
  }

  const snapshot = await response.json();
  if (!Array.isArray(snapshot) || snapshot.length === 0) {
    throw new Error('Snapshot file is empty.');
  }

  return normalizeListings(snapshot, { source: 'snapshot', isFallback: true });
}

async function loadListingsWithFallback(mode = 'automatic') {
  const notes = DATA_SOURCE_NOTES[mode] || DATA_SOURCE_NOTES.automatic;
  let liveResult = null;
  let liveError = null;

  try {
    const liveListings = await fetchSupabaseListings();
    liveResult = {
      listings: liveListings,
      source: 'supabase',
      note: notes.supabase,
      warning: null,
    };
  } catch (error) {
    liveError = error;
  }

  try {
    const snapshotListings = await fetchSnapshotListings();
    const snapshotResult = {
      listings: snapshotListings,
      source: 'snapshot',
      note: notes.snapshot,
      warning: liveError?.message || null,
    };

    if (!liveResult) {
      return snapshotResult;
    }

    const liveLatest = getLatestListingTimestamp(liveResult.listings);
    const snapshotLatest = getLatestListingTimestamp(snapshotResult.listings);

    if (snapshotLatest > liveLatest) {
      return {
        ...snapshotResult,
        note: 'Showing a recent snapshot while the live directory catches up.',
      };
    }

    return liveResult;
  } catch (snapshotError) {
    if (liveResult) {
      return liveResult;
    }

    return {
      listings: normalizedBackupListings,
      source: 'backup',
      note: notes.backup,
      warning: snapshotError.message || liveError?.message,
    };
  }
}

function createDataState(result) {
  return {
    source: result.source,
    sourceLabel: SOURCE_LABELS[result.source],
    note: result.note,
    isLoading: false,
    isRefreshing: false,
    lastLoadedAt: new Date().toISOString(),
    warning: result.warning,
  };
}

function App() {
  const [session, setSession] = useState(null);
  const [allCompanions, setAllCompanions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLocation, setActiveLocation] = useState(ALL_LOCATIONS_VALUE);
  const [activeActivity, setActiveActivity] = useState(ALL_TAGS_VALUE);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeView, setActiveView] = useState('directory');
  const [dataState, setDataState] = useState({
    source: 'backup',
    sourceLabel: SOURCE_LABELS.backup,
    note: 'Loading directory listings...',
    isLoading: true,
    isRefreshing: false,
    lastLoadedAt: null,
    warning: null,
  });
  const isActiveRef = useRef(true);
  const loadInFlightRef = useRef(false);
  const pendingAutoRefreshRef = useRef(false);
  const realtimeRefreshTimerRef = useRef(null);
  const manualLoadRef = useRef(async () => {});

  const t = translations[language] || translations.en;
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const metrics = useMemo(() => createMetrics(allCompanions), [allCompanions]);
  const intakeSummary = useMemo(() => createIntakeSummary(allCompanions), [allCompanions]);
  const displayDataState = useMemo(() => ({
    ...dataState,
    sourceLabel: t.sourceLabels?.[dataState.source] || dataState.sourceLabel,
    note: dataState.isLoading
      ? t.dataNotes?.loading || dataState.note
      : t.dataNotes?.[dataState.source] || dataState.note,
  }), [dataState, t]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      if (isMounted) {
        setSession(activeSession);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      if (isMounted) {
        setSession(activeSession);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    initSession();
  }, []);

  // Deep-link: ?listing=<id> auto-opens that listing's modal once data has
  // loaded. If the id isn't in the filtered allCompanions set (some listings
  // are dropped by visualDeduplication or validation but are still legitimate
  // shares), fetch from public/data.json — the broader 75-listing snapshot.
  useEffect(() => {
    if (allCompanions.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('listing');
    if (!targetId) return;
    const match = allCompanions.find((listing) => String(listing.id) === String(targetId));
    if (match) {
      setSelectedCompanion(match);
      return;
    }
    // Fallback: snapshot lookup so deep-links to filtered listings still resolve.
    let cancelled = false;
    fetch('/data.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (cancelled) return;
        const fromSnapshot = (Array.isArray(rows) ? rows : [])
          .find((listing) => String(listing.id) === String(targetId));
        if (fromSnapshot) setSelectedCompanion(fromSnapshot);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allCompanions]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    isActiveRef.current = true;

    const loadListings = async () => {
      if (loadInFlightRef.current) {
        pendingAutoRefreshRef.current = true;
        return;
      }

      loadInFlightRef.current = true;

      try {
        setDataState((current) => ({
          ...current,
          isLoading: current.lastLoadedAt === null,
          isRefreshing: current.lastLoadedAt !== null,
          warning: null,
        }));

        const result = await loadListingsWithFallback();
        if (!isActiveRef.current) {
          return;
        }

        setAllCompanions(result.listings);
        setDataState(createDataState(result));
      } finally {
        loadInFlightRef.current = false;

        if (pendingAutoRefreshRef.current) {
          pendingAutoRefreshRef.current = false;
          void loadListings();
        }
      }
    };
    manualLoadRef.current = async (mode = 'manual') => {
      if (loadInFlightRef.current && mode !== 'manual') {
        pendingAutoRefreshRef.current = true;
        return;
      }

      if (loadInFlightRef.current && mode === 'manual') {
        return;
      }

      loadInFlightRef.current = true;

      try {
        setDataState((current) => ({
          ...current,
          isLoading: current.lastLoadedAt === null,
          isRefreshing: true,
          warning: null,
        }));

        const result = await loadListingsWithFallback(mode);
        if (!isActiveRef.current) {
          return;
        }

        setAllCompanions(result.listings);
        setDataState(createDataState(result));
      } finally {
        loadInFlightRef.current = false;
      }
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadListings();
      }
    };
    const scheduleRealtimeRefresh = () => {
      if (document.visibilityState !== 'visible' || realtimeRefreshTimerRef.current !== null) {
        return;
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        void loadListings();
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    void loadListings();
    const intervalId = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);

    const channel = supabase
      .channel('companions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companions' }, scheduleRealtimeRefresh)
      .subscribe();

    return () => {
      isActiveRef.current = false;
      manualLoadRef.current = async () => {};
      pendingAutoRefreshRef.current = false;
      window.clearInterval(intervalId);
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  const locationOptions = useMemo(
    () => [
      { value: ALL_LOCATIONS_VALUE, label: t.filters.allLocations },
      ...[...new Set(allCompanions.map((listing) => listing.city))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .map((city) => ({ value: city, label: city })),
    ],
    [allCompanions, t.filters.allLocations],
  );

  const activityOptions = useMemo(
    () => [
      { value: ALL_TAGS_VALUE, label: t.filters.allTags },
      ...[...new Set(allCompanions.flatMap((listing) => listing.tags))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .map((tag) => ({ value: tag, label: tag })),
    ],
    [allCompanions, t.filters.allTags],
  );

  const filteredCompanions = useMemo(
    () =>
      sortListings(
        allCompanions.filter((listing) => {
          const matchesLocation =
            activeLocation === ALL_LOCATIONS_VALUE || listing.city === activeLocation;
          const matchesActivity =
            activeActivity === ALL_TAGS_VALUE || listing.tags.includes(activeActivity);

          const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
          const matchesSearch =
            !normalizedSearch ||
            [
              listing.name,
              listing.location,
              listing.description,
              listing.phone,
              listing.hours,
              listing.sourceChannel,
              ...(Array.isArray(listing.tags) ? listing.tags : []),
              ...(Array.isArray(listing.serviceTags) ? listing.serviceTags : []),
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedSearch));

          return matchesLocation && matchesActivity && matchesSearch;
        }),
        sortBy,
      ),
    [activeActivity, activeLocation, allCompanions, deferredSearchTerm, sortBy],
  );

  const clearFilters = () => {
    setSearchTerm('');
    setActiveLocation(ALL_LOCATIONS_VALUE);
    setActiveActivity(ALL_TAGS_VALUE);
    setSortBy(SORT_OPTIONS[0]);
  };

  const handleRefresh = async () => manualLoadRef.current('manual');

  return (
    <Routes>
      <Route
        path="/analytics"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading analytics…</div>}>
            <Analytics />
          </Suspense>
        )}
      />
      <Route
        path="/methodology"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading methodology…</div>}>
            <Methodology />
          </Suspense>
        )}
      />
      <Route
        path="/sociology"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading field notes…</div>}>
            <Sociology />
          </Suspense>
        )}
      />
      <Route
        path="/admin"
        element={
          <AdminGuard session={session}>
            <Suspense fallback={<div className="page-shell-loading">Loading dashboard…</div>}>
              <AdminDashboard />
            </Suspense>
          </AdminGuard>
        }
      />
      <Route
        path="*"
        element={
          <div className="app-shell">
            <div className="app-backdrop" aria-hidden="true" />
            <div className="grain-overlay" aria-hidden="true" />

            <AtomicClock />

            <Header
              language={language}
              setLanguage={setLanguage}
              t={t}
              theme={theme}
              setTheme={setTheme}
              onLogout={session ? () => supabase.auth.signOut() : null}
              onRefresh={handleRefresh}
              isRefreshing={dataState.isRefreshing}
              sourceLabel={displayDataState.sourceLabel}
              activeView={activeView}
              setActiveView={setActiveView}
            />

            <main className="main-content dashboard-content">
              <div
                id="feed-panel"
                role="tabpanel"
                style={{
                  display: activeView === 'feed' ? 'block' : 'none',
                  width: '100%',
                  maxWidth: 'var(--maxw)',
                  margin: '0 auto',
                  padding: '0 var(--gutter)',
                }}
              >
                <FeedGrid
                  t={t}
                  onOpen={(card) => {
                    setSelectedCompanion({
                      id: `feed-${card.id}`,
                      name: card.displayName || card.name,
                      location: card.channel ? `${card.channel}` : '—',
                      city: 'Bangkok',
                      description: card.displayDescription || card.description,
                      sourceChannel: card.channel,
                      postedAt: card.messageDate,
                      updatedAt: card.messageDate,
                      createdAt: card.messageDate,
                      phone: card.phone,
                      lineUrl: card.lineUrl,
                      telegramUrl: card.telegramUrl,
                      mapsUrl: card.mapsUrl,
                      hours: card.hours,
                      priceLabel: card.priceLabel || 'Rate on request',
                      imageUrl: card.requiresReview ? null : card.displayPrimaryPhoto || card.primaryPhoto,
                      allPhotoUrls: card.requiresReview ? [] : card.displayPhotoUrls || card.photoUrls,
                      isSafeImage: !card.requiresReview,
                      mentionCount: 1,
                      serviceTags: [],
                      tags: [],
                      metrics: {},
                      dataSource: 'feed',
                    });
                  }}
                />
              </div>

              <div
                id="directory-panel"
                role="tabpanel"
                style={{ display: activeView === 'directory' ? 'block' : 'none' }}
              >
                <HeroSection
                  t={t}
                  metrics={metrics}
                  dataState={displayDataState}
                  intakeSummary={intakeSummary}
                />

                <ProximityFinder
                  listings={allCompanions}
                  onSelect={setSelectedCompanion}
                />

                <section id="live-listings" className="listing-section">
                  <div className="section-header">
                    <div>
                      <span className="section-kicker">{t.featured.kicker}</span>
                      <h2>{t.featured.title}</h2>
                    </div>
                    <div className="section-meta">
                      <span>{filteredCompanions.length} {t.featured.countLabel}</span>
                      <span>{displayDataState.sourceLabel}</span>
                    </div>
                  </div>

                  <FilterBar
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    locationOptions={locationOptions}
                    activeLocation={activeLocation}
                    setActiveLocation={setActiveLocation}
                    activityOptions={activityOptions}
                    activeActivity={activeActivity}
                    setActiveActivity={setActiveActivity}
                    sortOptions={SORT_OPTIONS}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    onRefresh={handleRefresh}
                    isRefreshing={dataState.isRefreshing}
                    onClearFilters={clearFilters}
                    hasActiveFilters={
                      searchTerm.trim() ||
                      activeLocation !== ALL_LOCATIONS_VALUE ||
                      activeActivity !== ALL_TAGS_VALUE ||
                      sortBy !== SORT_OPTIONS[0]
                    }
                    resultCount={filteredCompanions.length}
                    t={t}
                  />

                  <CompanionGrid
                    companions={filteredCompanions}
                    onCardClick={setSelectedCompanion}
                    t={t}
                    metrics={metrics}
                    intakeSummary={intakeSummary}
                    dataState={displayDataState}
                    onClearFilters={clearFilters}
                    hasActiveFilters={
                      searchTerm.trim() ||
                      activeLocation !== ALL_LOCATIONS_VALUE ||
                      activeActivity !== ALL_TAGS_VALUE ||
                      sortBy !== SORT_OPTIONS[0]
                    }
                    isLoading={dataState.isLoading}
                  />
                </section>
              </div>

              <div
                id="map-panel"
                role="tabpanel"
                style={{
                  display: activeView === 'map' ? 'flex' : 'none',
                  height: 'min(80vh, 820px)',
                  flexDirection: 'column',
                  width: '100%',
                  maxWidth: 'var(--maxw)',
                  margin: '0 auto',
                  padding: '0 var(--gutter)',
                }}
              >
                <Suspense fallback={<section className="section-shell-loading">Loading map…</section>}>
                  <ListingMap
                    listings={filteredCompanions}
                    onCardClick={setSelectedCompanion}
                    t={t}
                    viewKey={`${activeLocation}|${activeActivity}|${deferredSearchTerm.trim()}`}
                    theme={theme}
                  />
                </Suspense>
              </div>
            </main>

            <Footer t={t} lastLoadedAt={dataState.lastLoadedAt} sourceLabel={displayDataState.sourceLabel} />

            {selectedCompanion && (
              <CompanionModal
                companion={selectedCompanion}
                onClose={() => setSelectedCompanion(null)}
                t={t}
              />
            )}
          </div>
        }
      />
    </Routes>
  );
}

export default App;
