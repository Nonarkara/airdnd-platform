import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FilterBar from './components/FilterBar';
import CompanionGrid from './components/CompanionGrid';
import CompanionModal from './components/CompanionModal';
import MapSection from './components/MapSection';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';
import Login from './components/Login';
import { supabase } from './lib/supabase';
import { translations } from './translations';

function App() {
  const [session, setSession] = useState(null);
  const [locations, setLocations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [allCompanions, setAllCompanions] = useState([]);
  const [filteredCompanions, setFilteredCompanions] = useState([]); // This state is declared but not used in the provided snippet's logic
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLocation, setActiveLocation] = useState('All');
  const [activeActivity, setActiveActivity] = useState('All');
  const [sortBy, setSortBy] = useState('recommended');
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [language, setLanguage] = useState('en');

  const t = translations[language];

  // Auth & Data fetching
  useEffect(() => {
    let isMounted = true;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setSession(session);
    });

    // Fetch data regardless of auth state for easy demoing
    const fetchCompanions = async () => {
      // if (!session) return; // Temporarily bypassed early return
      try {
        const { data, error } = await supabase
          .from('companions')
          .select('*')
          .order('id', { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
          setAllCompanions(data);
          setFilteredCompanions(data); // Initialize filteredCompanions with all data

          const uniqueLocs = [...new Set(data.map(c => c.location))];
          setLocations(uniqueLocs);

          const allTags = data.reduce((acc, c) => {
            if (c.tags) return [...acc, ...c.tags];
            return acc;
          }, []);
          const uniqueTags = [...new Set(allTags)];
          setActivities(uniqueTags.slice(0, 10));
        }
      } catch (error) {
        console.error('Error fetching from Supabase:', error.message);
      }
    };

    fetchCompanions();

    // Data polling for the private hub
    const interval = setInterval(fetchCompanions, 5000);

    return () => {
      isMounted = false;
      if (subscription) { // Ensure subscription exists before unsubscribing
        subscription.unsubscribe();
      }
      clearInterval(interval);
    };
  }, [session]); // Re-run fetch if session changes

  // Filter logic
  let activeFilteredCompanions = allCompanions.filter(c => {
    if (activeActivity === 'All') return true;
    return c.tags && c.tags.includes(activeActivity);
  });

  // Sort logic
  activeFilteredCompanions.sort((a, b) => {
    if (sortBy === 'Price (Low to High)') {
      const pA = parseInt((a.price || '').replace(/[^\\d]/g, '')) || 0;
      const pB = parseInt((b.price || '').replace(/[^\\d]/g, '')) || 0;
      return pA - pB;
    }
    if (sortBy === 'Price (High to Low)') {
      const pA = parseInt((a.price || '').replace(/[^\\d]/g, '')) || 0;
      const pB = parseInt((b.price || '').replace(/[^\\d]/g, '')) || 0;
      return pB - pA;
    }
    if (sortBy === 'Rating') {
      return (b.rating || 0) - (a.rating || 0);
    }
    if (sortBy === 'Age (Youngest)') {
      return (a.age || 99) - (b.age || 99);
    }
    // Recommended / default -> use ID descending (newest first)
    return b.id - a.id;
  });

  // Main Render Guardian
  // TEMPORARILY DISABLED: Allow guests to view the site without logging in.
  // if (!session) {
  //   return <Login setSession={setSession} language={language} setLanguage={setLanguage} />;
  // }

  return (
    <div className="app-container">
      <Header
        language={language}
        setLanguage={setLanguage}
        t={t}
        onLogout={session ? () => supabase.auth.signOut() : null}
      />

      <main className="main-content">
        <HeroSection t={t} />

        <MapSection t={t} />

        <HowItWorks t={t} />

        <div className="section-header">
          <h2>{t.featured.title}</h2>
          <p>{t.featured.subtitle}</p>
        </div>

        <FilterBar
          activeCategory={activeActivity}
          setActiveCategory={setActiveActivity}
          sortBy={sortBy}
          setSortBy={setSortBy}
          t={t}
        />

        <CompanionGrid
          companions={activeFilteredCompanions}
          onCardClick={setSelectedCompanion}
          t={t}
        />
      </main>

      <Footer t={t} />

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

