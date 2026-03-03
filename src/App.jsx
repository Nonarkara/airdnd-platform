import { useEffect, useState } from 'react';
import './App.css';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FilterBar from './components/FilterBar';
import CompanionGrid from './components/CompanionGrid';
import CompanionModal from './components/CompanionModal';
import MapSection from './components/MapSection';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';
import { companions as backupCompanions } from './data/mockData';
import { supabase } from './lib/supabase';
import {
  SOURCE_LABELS,
  createMetrics,
  normalizeListings,
} from './lib/listings';
import { translations } from './translations';

const REFRESH_INTERVAL_MS = 60_000;
const SUPABASE_TIMEOUT_MS = 4_000;
const ALL_LOCATIONS_VALUE = 'all-locations';
const ALL_TAGS_VALUE = 'all-tags';
const SORT_OPTIONS = [
  'Newest',
  'Lowest price',
  'Highest price',
  'Highest rating',
  'Alphabetical',
];

function sortListings(listings, sortBy) {
  const nextListings = [...listings];

  nextListings.sort((left, right) => {
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

    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;

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
    .order('created_at', { ascending: false });

  const timeoutPromise = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('Live data request timed out.')), SUPABASE_TIMEOUT_MS);
  });

  const response = await Promise.race([supabaseRequest, timeoutPromise]);

  if (response.error) {
    throw response.error;
  }

  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error('No live data available.');
  }

  return normalizeListings(response.data, { source: 'supabase', isFallback: false });
}

async function fetchSnapshotListings() {
  const response = await fetch('/data.json', {
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
    note: 'Connecting to the latest verified listings...',
    isLoading: true,
    isRefreshing: false,
    lastLoadedAt: null,
  });

  const t = translations[language] || translations.en;
  const metrics = createMetrics(allCompanions);

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
    let isActive = true;

    const loadListings = async () => {
      setDataState((current) => ({
        ...current,
        isLoading: current.lastLoadedAt === null,
        isRefreshing: current.lastLoadedAt !== null,
      }));

      try {
        const liveListings = await fetchSupabaseListings();
        if (!isActive) {
          return;
        }

        setAllCompanions(liveListings);
        setDataState({
          source: 'supabase',
          sourceLabel: SOURCE_LABELS.supabase,
          note: 'Connected to live Supabase listings.',
          isLoading: false,
          isRefreshing: false,
          lastLoadedAt: new Date().toISOString(),
        });
        return;
      } catch (liveError) {
        try {
          const snapshotListings = await fetchSnapshotListings();
          if (!isActive) {
            return;
          }

          setAllCompanions(snapshotListings);
          setDataState({
            source: 'snapshot',
            sourceLabel: SOURCE_LABELS.snapshot,
            note: `Live sync unavailable. Showing the last verified snapshot.`,
            isLoading: false,
            isRefreshing: false,
            lastLoadedAt: new Date().toISOString(),
            warning: liveError.message,
          });
          return;
        } catch (snapshotError) {
          if (!isActive) {
            return;
          }

          setAllCompanions(normalizeListings(backupCompanions, { source: 'backup', isFallback: true }));
          setDataState({
            source: 'backup',
            sourceLabel: SOURCE_LABELS.backup,
            note: 'Resilient mode active. Using the verified backup set.',
            isLoading: false,
            isRefreshing: false,
            lastLoadedAt: new Date().toISOString(),
            warning: snapshotError.message || liveError.message,
          });
        }
      }
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadListings();
      }
    };

    void loadListings();
    const intervalId = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, []);

  const locationOptions = [
    { value: ALL_LOCATIONS_VALUE, label: t.filters.allLocations },
    ...[...new Set(allCompanions.map((listing) => listing.city))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map((city) => ({ value: city, label: city })),
  ];

  const activityOptions = [
    { value: ALL_TAGS_VALUE, label: t.filters.allTags },
    ...[...new Set(allCompanions.flatMap((listing) => listing.tags))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map((tag) => ({ value: tag, label: tag })),
  ];

  const filteredCompanions = sortListings(
    allCompanions.filter((listing) => {
      const matchesLocation =
        activeLocation === ALL_LOCATIONS_VALUE || listing.city === activeLocation;
      const matchesActivity =
        activeActivity === ALL_TAGS_VALUE || listing.tags.includes(activeActivity);

      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [listing.name, listing.location, listing.description]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesLocation && matchesActivity && matchesSearch;
    }),
    sortBy,
  );

  const clearFilters = () => {
    setSearchTerm('');
    setActiveLocation(ALL_LOCATIONS_VALUE);
    setActiveActivity(ALL_TAGS_VALUE);
    setSortBy(SORT_OPTIONS[0]);
  };

  const handleRefresh = async () => {
    setDataState((current) => ({
      ...current,
      isRefreshing: true,
    }));

    try {
      const liveListings = await fetchSupabaseListings();
      setAllCompanions(liveListings);
      setDataState({
        source: 'supabase',
        sourceLabel: SOURCE_LABELS.supabase,
        note: 'Live data refreshed successfully.',
        isLoading: false,
        isRefreshing: false,
        lastLoadedAt: new Date().toISOString(),
      });
    } catch (liveError) {
      try {
        const snapshotListings = await fetchSnapshotListings();
        setAllCompanions(snapshotListings);
        setDataState({
          source: 'snapshot',
          sourceLabel: SOURCE_LABELS.snapshot,
          note: 'Manual refresh completed with the latest verified snapshot.',
          isLoading: false,
          isRefreshing: false,
          lastLoadedAt: new Date().toISOString(),
          warning: liveError.message,
        });
      } catch {
        setAllCompanions(normalizeListings(backupCompanions, { source: 'backup', isFallback: true }));
        setDataState({
          source: 'backup',
          sourceLabel: SOURCE_LABELS.backup,
          note: 'Manual refresh completed with the verified backup set.',
          isLoading: false,
          isRefreshing: false,
          lastLoadedAt: new Date().toISOString(),
          warning: liveError.message,
        });
      }
    }
  };

  return (
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
          sourceLabel={dataState.sourceLabel}
          statusNote={dataState.note}
          lastLoadedAt={dataState.lastLoadedAt}
          onRefresh={handleRefresh}
          isRefreshing={dataState.isRefreshing}
        />

        <MapSection t={t} />

        <HowItWorks t={t} />

        <section id="live-listings" className="listing-section">
          <div className="section-header">
            <div>
              <span className="section-kicker">{t.featured.kicker}</span>
              <h2>{t.featured.title}</h2>
            </div>
            <div className="section-meta">
              <span>{filteredCompanions.length} {t.featured.countLabel}</span>
              <span>{dataState.sourceLabel}</span>
            </div>
          </div>
          <p className="section-subtitle">{t.featured.subtitle}</p>

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
  );
}

export default App;
