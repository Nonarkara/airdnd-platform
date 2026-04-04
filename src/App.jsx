import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import LiveIntakeStrip from './components/LiveIntakeStrip';
import FilterBar from './components/FilterBar';
import CompanionGrid from './components/CompanionGrid';
import CompanionModal from './components/CompanionModal';
import HowItWorks from './components/HowItWorks';
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

const REFRESH_INTERVAL_MS = 60_000;
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
const SORT_OPTIONS = [
  'Newest',
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
    if (sortBy === 'Newest') {
      const leftBangkokPriority = left.city === 'Bangkok' ? 0 : 1;
      const rightBangkokPriority = right.city === 'Bangkok' ? 0 : 1;

      if (leftBangkokPriority !== rightBangkokPriority) {
        return leftBangkokPriority - rightBangkokPriority;
      }
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
  const supabaseRequest = supabase
    .from('companions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIVE_QUERY_LIMIT);

  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('Live data request timed out.'));
    }, SUPABASE_TIMEOUT_MS);
  });

  let response;
  try {
    response = await Promise.race([supabaseRequest, timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  if (response.error) {
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
  const recentListings = useMemo(
    () => sortListings(allCompanions, SORT_OPTIONS[0]).slice(0, 5),
    [allCompanions],
  );

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
            [listing.name, listing.location, listing.description]
              .filter(Boolean)
              .some((value) => value.toLowerCase().includes(normalizedSearch));

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
        path="/methodology"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading methodology…</div>}>
            <Methodology />
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

            <Header
              language={language}
              setLanguage={setLanguage}
              t={t}
              onLogout={session ? () => supabase.auth.signOut() : null}
              onRefresh={handleRefresh}
              isRefreshing={dataState.isRefreshing}
              sourceLabel={dataState.sourceLabel}
            />

            <main className="main-content">
              <HeroSection
                t={t}
                metrics={metrics}
                intakeSummary={intakeSummary}
                recentListings={recentListings}
                dataState={dataState}
                onRefresh={handleRefresh}
              />

              <LiveIntakeStrip
                t={t}
                listings={allCompanions}
                intakeSummary={intakeSummary}
                lastLoadedAt={dataState.lastLoadedAt}
              />

              <section id="live-listings" className="listing-section">
                <div className="section-header">
                  <div>
                    <span className="section-kicker">{t.featured.kicker}</span>
                    <h2>{t.featured.title}</h2>
                  </div>
                  <p className="section-subtitle">{t.featured.subtitle}</p>
                  <div className="section-meta">
                    <span>{filteredCompanions.length} {t.featured.countLabel}</span>
                    <span>{dataState.sourceLabel}</span>
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
                  t={t}
                />

                <CompanionGrid
                  companions={filteredCompanions}
                  onCardClick={setSelectedCompanion}
                  t={t}
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

              <Suspense fallback={<section className="section-shell-loading">Loading live map…</section>}>
                <ListingMap listings={allCompanions} t={t} />
              </Suspense>

              <HowItWorks t={t} />
            </main>

            <Footer t={t} lastLoadedAt={dataState.lastLoadedAt} sourceLabel={dataState.sourceLabel} />

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
