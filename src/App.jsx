
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
import { supabase } from './lib/supabase';

function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Recommended');
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [companions, setCompanions] = useState([]);
  const [language, setLanguage] = useState('en');

  const t = translations[language];

  useEffect(() => {
    let isMounted = true;

    const fetchCompanions = async () => {
      try {
        const { data, error } = await supabase
          .from('companions')
          .select('*')
          .order('id', { ascending: false }); // Native DB sorting newest first

        if (error) throw error;

        if (isMounted && data) {
          setCompanions(data);
        }
      } catch (error) {
        console.error('Error fetching from Supabase:', error.message);
      }
    };

    fetchCompanions();

    // Listen for real-time inserts if we set up websockets later
    // For now, poll exactly like before just pointing to DB
    const interval = setInterval(fetchCompanions, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Filter logic
  let filteredCompanions = companions.filter(c => {
    if (activeCategory === 'All') return true;
    return c.tags && c.tags.includes(activeCategory);
  });

  // Sort logic
  filteredCompanions.sort((a, b) => {
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

  return (
    <div className="app-container">
      <Header language={language} setLanguage={setLanguage} t={t} />

      <main className="main-content">
        <HeroSection t={t} />

        <MapSection t={t} />

        <HowItWorks t={t} />

        <div className="section-header">
          <h2>{t.featured.title}</h2>
          <p>{t.featured.subtitle}</p>
        </div>

        <FilterBar
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          t={t}
        />

        <CompanionGrid
          companions={filteredCompanions}
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

