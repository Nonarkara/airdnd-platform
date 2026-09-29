import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FeedGrid from './components/FeedGrid';
import FilterBar from './components/FilterBar';
import ListingGrid from './components/ListingGrid';
import ListingModal from './components/ListingModal';
import DistrictComparisonDrawer from './components/DistrictComparisonDrawer';
import LiveIntakeStrip from './components/LiveIntakeStrip';
import Footer from './components/Footer';
import AdminGuard from './components/admin/AdminGuard';
import { listings as backupListings } from './data/mockData';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { initSession } from './lib/tracker';
import { ensurePlacement } from './lib/placement_client';
import {
  SOURCE_LABELS,
  createIntakeSummary,
  createMetrics,
  getListingTimestampValue,
  normalizeListings,
} from './lib/listings';
import { useLanguage } from './context/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { validateListingsPayload } from './lib/schema';

const REFRESH_INTERVAL_MS = 30_000;
// Full inventory — never truncate. Phone-canonical set is ~100 cards, but the
// raw Firestore archive is thousands of persona-posts that must all be merged
// before we know we have every operator. A 1200-doc cap silently dropped venues.
const LIVE_QUERY_LIMIT = 10000;
const LIVE_FETCH_TIMEOUT_MS = 6_500;
const ALL_LOCATIONS_VALUE = 'all-locations';
const ALL_TAGS_VALUE = 'all-tags';
const normalizedBackupListings = normalizeListings(backupListings, {
  source: 'backup',
  isFallback: true,
});
const ListingMap = lazy(() => import('./components/ListingMap'));
const Methodology = lazy(() => import('./components/Methodology'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const Analytics = lazy(() => import('./components/Analytics'));
const Sociology = lazy(() => import('./components/Sociology'));
const Paper = lazy(() => import('./components/Paper'));
const FAQ = lazy(() => import('./components/FAQ'));
const MatchingPaper = lazy(() => import('./components/MatchingPaper'));
const Trends = lazy(() => import('./components/Trends'));
const Health = lazy(() => import('./components/Health'));
const Insights = lazy(() => import('./components/Insights'));
const SORT_OPTIONS = [
  'Most Active Broadcasters',
  'Most Promotions',
  'Latest Intake Post',
  'Newest',
  'Most credible',
  'Lowest price',
  'Highest price',
  'Highest rating',
  'Alphabetical',
];
const DEFAULT_SORT = SORT_OPTIONS[0];

function promotionScore(listing) {
  const blob = [
    listing?.description,
    listing?.rawText,
    listing?.raw_text,
    ...(Array.isArray(listing?.tags) ? listing.tags : []),
    ...(Array.isArray(listing?.serviceTags) ? listing.serviceTags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hits = (blob.match(/promo|promotion|ส่วนลด|ลดราคา|พิเศษ|new face|ใหม่|available|ว่าง|เปิดรับ|discount|offer/g) || []).length;
  const mentions = Number(listing?.mentionCount || listing?.mention_count || 0);
  return hits * 10 + mentions;
}
const DATA_SOURCE_NOTES = {
  automatic: {
    firestore: 'Directory is up to date with the latest listings (via Firestore).',
    snapshot: 'Showing a recent snapshot while the live connection catches up.',
    backup: 'Showing cached listings. Live updates will resume shortly.',
  },
  manual: {
    firestore: 'Directory refreshed with the latest listings (via Firestore).',
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

function sanitizeLoadError(error, fallbackMessage = 'Live data unavailable.') {
  const message = error?.message || String(error || '');
  if (!message || /<!doctype|<html|cloudflare|522|timed out/i.test(message)) {
    return fallbackMessage;
  }

  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function sortListings(listings, sortBy) {
  const nextListings = [...listings];

  nextListings.sort((left, right) => {
    if (sortBy === 'Most Active Broadcasters') {
      const lm = Number(left.mentionCount || left.mention_count || 1);
      const rm = Number(right.mentionCount || right.mention_count || 1);
      if (lm !== rm) return rm - lm;
    }

    if (sortBy === 'Most Promotions') {
      const lp = promotionScore(left);
      const rp = promotionScore(right);
      if (lp !== rp) return rp - lp;
    }

    if (sortBy === 'Latest Intake Post' || sortBy === 'Newest') {
      const leftTime = getListingTimestampValue(left);
      const rightTime = getListingTimestampValue(right);
      if (leftTime !== rightTime) return rightTime - leftTime;
    }

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


async function fetchLiveListingsFromFirestore() {
  // Full collection — persona-posts must be merged before the phone inventory
  // is complete. Truncation silently drops operators.
  const querySnapshot = await getDocs(collection(db, 'companions'));
  const data = [];
  querySnapshot.forEach((doc) => {
    const docData = doc.data();
    data.push({
      ...docData,
      id: docData.id || doc.id,
    });
  });

  if (data.length === 0) {
    throw new Error('No live Firestore data available.');
  }

  const validatedData = validateListingsPayload(data);
  if (validatedData.length === 0) {
    throw new Error('Live Firestore data failed validation.');
  }

  return normalizeListings(
    validatedData,
    { source: 'firestore', isFallback: false, allowUnverified: true },
  );
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

  const validatedSnapshot = validateListingsPayload(snapshot);
  if (validatedSnapshot.length === 0) {
    throw new Error('Snapshot failed validation.');
  }

  return normalizeListings(validatedSnapshot, { source: 'snapshot', isFallback: true });
}

async function loadListingsWithFallback(mode = 'automatic') {
  const notes = DATA_SOURCE_NOTES[mode] || DATA_SOURCE_NOTES.automatic;
  let liveResult = null;
  let liveError = null;

  // Firestore is the scraper's direct sync target; the static snapshot is the
  // fallback. Supabase is no longer read from the browser (tasks/supabase-exit.md).
  try {
    const firestoreListings = await withTimeout(
      fetchLiveListingsFromFirestore(),
      LIVE_FETCH_TIMEOUT_MS,
      'Live Firestore request timed out.',
    );
    liveResult = {
      listings: firestoreListings,
      source: 'firestore',
      note: notes.firestore,
      warning: null,
    };
  } catch (error) {
    liveError = new Error(sanitizeLoadError(error, 'Live Firestore request timed out.'));
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
      warning: sanitizeLoadError(snapshotError, liveError?.message),
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
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [allListings, setAllListings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLocation, setActiveLocation] = useState(ALL_LOCATIONS_VALUE);
  const [activeActivity, setActiveActivity] = useState(ALL_TAGS_VALUE);
  const [activePriceTier, setActivePriceTier] = useState('all');
  const [activeOpenStatus, setActiveOpenStatus] = useState('all');
  const [isDistrictDrawerOpen, setIsDistrictDrawerOpen] = useState(false);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [selectedListing, setSelectedListing] = useState(null);
  const { language, setLanguage, t: tCtx } = useLanguage();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [activeView, setActiveView] = useState(() => {
    if (typeof window === 'undefined') return 'directory';
    if (window.location.pathname === '/map') return 'map';
    const view = new URLSearchParams(window.location.search).get('view');
    return view === 'feed' ? 'feed' : 'directory';
  });
  const [mapSource, setMapSource] = useState('directory');
  const [feedListings, setFeedListings] = useState([]);
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
  const manualLoadRef = useRef(async () => {});

  const t = tCtx;
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const metrics = useMemo(() => createMetrics(allListings), [allListings]);
  const intakeSummary = useMemo(() => createIntakeSummary(allListings), [allListings]);
  const displayDataState = useMemo(() => ({
    ...dataState,
    sourceLabel: t.sourceLabels?.[dataState.source] || dataState.sourceLabel,
    note: dataState.isLoading
      ? t.dataNotes?.loading || dataState.note
      : t.dataNotes?.[dataState.source] || dataState.note,
  }), [dataState, t]);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (activeSession) => {
      if (isMounted) {
        setSession(activeSession);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    initSession();
  }, []);

  // Keep home tabs aligned with the URL so browser Back/Forward restore the view.
  useEffect(() => {
    if (location.pathname === '/map') {
      setActiveView('map');
      return;
    }
    if (location.pathname === '/' || location.pathname === '') {
      const view = new URLSearchParams(location.search).get('view');
      setActiveView(view === 'feed' ? 'feed' : 'directory');
    }
  }, [location.pathname, location.search]);

  // Deep-link: ?listing=<id> auto-opens that listing's modal once data has
  // loaded. If the id isn't in the filtered allListings set (some listings
  // are dropped by visualDeduplication or validation but are still legitimate
  // shares), fetch from public/data.json — the broader 75-listing snapshot.
  useEffect(() => {
    if (allListings.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('listing');
    if (!targetId) return;
    const match = allListings.find((listing) => String(listing.id) === String(targetId));
    if (match) {
      setSelectedListing(match);
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
        if (fromSnapshot) setSelectedListing(fromSnapshot);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allListings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Pre-load feed.json so live activity pins are ready immediately
  useEffect(() => {
    if (feedListings.length === 0) {
      fetch(`/feed.json?ts=${Date.now()}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const normalized = (data || []).map((card) => ({
            id: `feed-${card.id}`,
            name: card.displayName || card.name,
            location: card.channel ? `${card.channel}` : '—',
            city: card.city || 'Bangkok',
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
            latitude: card.latitude,
            longitude: card.longitude,
            mentionCount: 1,
            serviceTags: [],
            tags: [],
            metrics: {},
            dataSource: 'feed',
          }));
          setFeedListings(normalized);
        })
        .catch((err) => console.error('Failed to load feed for map:', err));
    }
  }, [activeView, mapSource, feedListings.length]);

  const filteredFeedListings = useMemo(() => {
    return feedListings.filter((listing) => {
      // Location filter
      if (activeLocation !== ALL_LOCATIONS_VALUE) {
        if (listing.city !== activeLocation) return false;
      }
      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const text = `${listing.name} ${listing.location} ${listing.description}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [feedListings, activeLocation, searchTerm]);

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
        result.listings = await ensurePlacement(result.listings);
        if (!isActiveRef.current) {
          return;
        }

        setAllListings(result.listings);
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
        result.listings = await ensurePlacement(result.listings);
        if (!isActiveRef.current) {
          return;
        }

        setAllListings(result.listings);
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
    void loadListings();
    const intervalId = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);

    return () => {
      isActiveRef.current = false;
      manualLoadRef.current = async () => {};
      pendingAutoRefreshRef.current = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, []);

  const locationOptions = useMemo(
    () => [
      { value: ALL_LOCATIONS_VALUE, label: t.filters.allLocations },
      ...[...new Set(allListings.map((listing) => listing.city))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .map((city) => ({ value: city, label: city })),
    ],
    [allListings, t.filters.allLocations],
  );

  const activityOptions = useMemo(
    () => [
      { value: ALL_TAGS_VALUE, label: t.filters.allTags },
      ...[...new Set(allListings.flatMap((listing) => listing.tags))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .map((tag) => ({ value: tag, label: tag })),
    ],
    [allListings, t.filters.allTags],
  );

  const filteredListings = useMemo(
    () =>
      sortListings(
        allListings.filter((listing) => {
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

          const matchesPriceTier =
            activePriceTier === 'all' ||
            (activePriceTier === 'economy' && listing.priceValue > 0 && listing.priceValue < 1000) ||
            (activePriceTier === 'mid' && listing.priceValue >= 1000 && listing.priceValue <= 2000) ||
            (activePriceTier === 'premium' && listing.priceValue > 2000);

          const matchesOpenStatus =
            activeOpenStatus === 'all' ||
            (activeOpenStatus === '247' && /24\s*ชั่วโมง|24\s*hrs|24\s*hours/i.test(listing.hours || '')) ||
            (activeOpenStatus === 'open' && (listing.isOpenNow || /24|เปิด|open/i.test(listing.hours || '')));

          return matchesLocation && matchesActivity && matchesSearch && matchesPriceTier && matchesOpenStatus;
        }),
        sortBy,
      ),
    [activeActivity, activeLocation, activePriceTier, activeOpenStatus, allListings, deferredSearchTerm, sortBy],
  );

  const clearFilters = () => {
    setSearchTerm('');
    setActiveLocation(ALL_LOCATIONS_VALUE);
    setActiveActivity(ALL_TAGS_VALUE);
    setActivePriceTier('all');
    setActiveOpenStatus('all');
    setSortBy(DEFAULT_SORT);
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
        path="/paper"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading paper…</div>}>
            <Paper />
          </Suspense>
        )}
      />
      <Route
        path="/faq"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading FAQ…</div>}>
            <FAQ />
          </Suspense>
        )}
      />
      <Route
        path="/matching"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading paper…</div>}>
            <MatchingPaper />
          </Suspense>
        )}
      />
      <Route
        path="/trends"
        element={(
          <Suspense fallback={<div className="page-shell-loading">Loading trends…</div>}>
            <Trends />
          </Suspense>
        )}
      />
      <Route
        path="/health"
        element={(
          <div className="app-shell">
            <Header
              language={language}
              setLanguage={setLanguage}
              t={t}
              theme={theme}
              setTheme={setTheme}
              onRefresh={handleRefresh}
              isRefreshing={dataState.isRefreshing}
              sourceLabel={displayDataState.sourceLabel}
              activeView="directory"
              setActiveView={setActiveView}
              metrics={metrics}
            />
            <main className="app-main">
              <Suspense fallback={<div className="page-shell-loading">Loading health research…</div>}>
                <Health listings={allListings} />
              </Suspense>
            </main>
            <Footer t={t} lastLoadedAt={dataState.lastLoadedAt} sourceLabel={displayDataState.sourceLabel} />
          </div>
        )}
      />
      <Route
        path="/insights"
        element={(
          <div className="app-shell">
            <Header
              language={language}
              setLanguage={setLanguage}
              t={t}
              theme={theme}
              setTheme={setTheme}
              onRefresh={handleRefresh}
              isRefreshing={dataState.isRefreshing}
              sourceLabel={displayDataState.sourceLabel}
              activeView="directory"
              setActiveView={setActiveView}
              metrics={metrics}
            />
            <main className="app-main">
              <Suspense fallback={<div className="page-shell-loading">Loading the reading room…</div>}>
                <Insights />
              </Suspense>
            </main>
            <Footer t={t} lastLoadedAt={dataState.lastLoadedAt} sourceLabel={displayDataState.sourceLabel} />
          </div>
        )}
      />
      <Route
        path="/map"
        element={(
          <div className="app-shell">
            <Header
              activeView="map"
              setActiveView={setActiveView}
              language={language}
              setLanguage={setLanguage}
              t={t}
              theme={theme}
              setTheme={setTheme}
              onRefresh={handleRefresh}
              isRefreshing={dataState.isRefreshing}
              sourceLabel={displayDataState.sourceLabel}
              metrics={metrics}
            />
            <main className="app-main" style={{ padding: 'var(--gutter)' }}>
              <Suspense fallback={<div className="page-shell-loading">Loading nationwide map…</div>}>
                <div style={{ maxWidth: 'var(--maxw)', margin: '0 auto' }}>
                  <div className="map-view-selector" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    borderBottom: '1px solid var(--line)',
                    marginBottom: '12px',
                    width: '100%',
                    background: 'var(--bg-2)',
                    padding: '4px',
                  }}>
                    {[
                      { id: 'directory', label: `Directory (${filteredListings.length})` },
                      { id: 'feed', label: `Live activity (${filteredFeedListings.length || 0})` },
                      { id: 'epidemic', label: 'HIV / STI context' },
                      { id: 'heatmap', label: 'Spatial heatmap' },
                      { id: 'provinces', label: 'Province breakdown' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setMapSource(mode.id)}
                        style={{
                          padding: '10px 16px',
                          background: mapSource === mode.id ? 'var(--mango-dim)' : 'transparent',
                          color: mapSource === mode.id ? 'var(--mango)' : 'var(--ink-3)',
                          border: '1px solid',
                          borderColor: mapSource === mode.id ? 'var(--mango)' : 'transparent',
                          borderRadius: 0,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 600,
                          transition: 'all 0.15s ease',
                          minHeight: '44px',
                        }}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <ListingMap
                    listings={mapSource === 'directory' ? filteredListings : filteredFeedListings}
                    onCardClick={setSelectedListing}
                    t={t}
                    viewKey={`dedicated-map|${mapSource}|${activeLocation}|${activeActivity}|${deferredSearchTerm.trim()}`}
                    theme={theme}
                    lastUpdatedAt={dataState.lastLoadedAt}
                    isRefreshing={dataState.isRefreshing}
                    dataSource={mapSource === 'directory' ? displayDataState.sourceLabel : mapSource === 'heatmap' ? 'Spatial Density' : 'Feed Activity'}
                    mapMode={mapSource}
                  />
                </div>
              </Suspense>
            </main>
            <Footer t={t} lastLoadedAt={dataState.lastLoadedAt} sourceLabel={displayDataState.sourceLabel} />
            <DistrictComparisonDrawer
              listings={allListings}
              isOpen={isDistrictDrawerOpen}
              onClose={() => setIsDistrictDrawerOpen(false)}
              onSelectDistrict={(dist) => setActiveLocation(dist)}
              t={t}
            />
            {selectedListing && (
              <ListingModal
                listing={selectedListing}
                onClose={() => setSelectedListing(null)}
                t={t}
              />
            )}
          </div>
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
              theme={theme}
              setTheme={setTheme}
              onLogout={session ? () => auth.signOut() : null}
              onRefresh={handleRefresh}
              isRefreshing={dataState.isRefreshing}
              sourceLabel={displayDataState.sourceLabel}
              activeView={activeView}
              setActiveView={setActiveView}
              metrics={metrics}
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
                <LiveIntakeStrip
                  t={t}
                  listings={allListings}
                  intakeSummary={intakeSummary}
                  lastLoadedAt={dataState.lastLoadedAt}
                />
                <ErrorBoundary>
                  <FeedGrid
                  t={t}
                  onOpen={(card) => {
                    setSelectedListing({
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
                </ErrorBoundary>
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
                <LiveIntakeStrip
                  t={t}
                  listings={allListings}
                  intakeSummary={intakeSummary}
                  lastLoadedAt={dataState.lastLoadedAt}
                />

                <section id="live-listings" className="listing-section">
                  <div className="section-header">
                    <div>
                      <span className="section-kicker">{t.featured.kicker}</span>
                      <h2>{t.featured.title}</h2>
                      <p className="section-subtitle">{t.featured.subtitle}</p>
                    </div>
                    <div className="section-meta">
                      <span>{filteredListings.length} {t.featured.countLabel}</span>
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
                    activePriceTier={activePriceTier}
                    setActivePriceTier={setActivePriceTier}
                    activeOpenStatus={activeOpenStatus}
                    setActiveOpenStatus={setActiveOpenStatus}
                    onOpenDistrictDrawer={() => setIsDistrictDrawerOpen(true)}
                    sortOptions={SORT_OPTIONS}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    onRefresh={handleRefresh}
                    isRefreshing={dataState.isRefreshing}
                    onClearFilters={clearFilters}
                    hasActiveFilters={
                      Boolean(searchTerm.trim()) ||
                      activeLocation !== ALL_LOCATIONS_VALUE ||
                      activeActivity !== ALL_TAGS_VALUE ||
                      activePriceTier !== 'all' ||
                      activeOpenStatus !== 'all' ||
                      sortBy !== DEFAULT_SORT
                    }
                    resultCount={filteredListings.length}
                    t={t}
                  />

                  <ErrorBoundary>
                  <ListingGrid
                    listings={filteredListings}
                    onCardClick={setSelectedListing}
                    t={t}
                    dataState={displayDataState}
                    onClearFilters={clearFilters}
                    hasActiveFilters={
                      Boolean(searchTerm.trim()) ||
                      activeLocation !== ALL_LOCATIONS_VALUE ||
                      activeActivity !== ALL_TAGS_VALUE ||
                      sortBy !== DEFAULT_SORT
                    }
                    isLoading={dataState.isLoading}
                  />
                </ErrorBoundary>
                </section>
              </div>

              <div
                id="map-panel"
                role="tabpanel"
                style={{
                  display: activeView === 'map' ? 'flex' : 'none',
                  minHeight: '750px',
                  flexDirection: 'column',
                  width: '100%',
                  maxWidth: 'var(--maxw)',
                  margin: '0 auto',
                  padding: '0 var(--gutter)',
                }}
              >
                <div className="map-view-selector" style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  borderBottom: '1px solid var(--line)',
                  marginBottom: '12px',
                  width: '100%',
                  background: 'var(--bg-2)',
                  padding: '4px',
                }}>
                  {[
                    { id: 'directory', label: `Directory (${filteredListings.length})` },
                    { id: 'feed', label: `Live activity (${filteredFeedListings.length || 0})` },
                    { id: 'epidemic', label: 'HIV / STI context' },
                    { id: 'heatmap', label: 'Spatial heatmap' },
                    { id: 'provinces', label: 'Province breakdown' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setMapSource(mode.id)}
                      style={{
                        padding: '10px 16px',
                        background: mapSource === mode.id ? 'var(--mango-dim)' : 'transparent',
                        color: mapSource === mode.id ? 'var(--mango)' : 'var(--ink-3)',
                        border: '1px solid',
                        borderColor: mapSource === mode.id ? 'var(--mango)' : 'transparent',
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                        minHeight: '44px',
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <Suspense fallback={<section className="section-shell-loading">Loading map…</section>}>
                  <ListingMap
                    listings={mapSource === 'directory' ? filteredListings : filteredFeedListings}
                    onCardClick={setSelectedListing}
                    t={t}
                    viewKey={`${mapSource}|${activeLocation}|${activeActivity}|${deferredSearchTerm.trim()}`}
                    theme={theme}
                    lastUpdatedAt={dataState.lastLoadedAt}
                    isRefreshing={dataState.isRefreshing}
                    dataSource={mapSource === 'directory' ? displayDataState.sourceLabel : mapSource === 'heatmap' ? 'Spatial Density' : 'Feed Activity'}
                    mapMode={mapSource}
                  />
                </Suspense>
              </div>
            </main>

            <DistrictComparisonDrawer
              listings={allListings}
              isOpen={isDistrictDrawerOpen}
              onClose={() => setIsDistrictDrawerOpen(false)}
              onSelectDistrict={(dist) => setActiveLocation(dist)}
              t={t}
            />

            {selectedListing && (
              <ListingModal
                listing={selectedListing}
                onClose={() => setSelectedListing(null)}
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
