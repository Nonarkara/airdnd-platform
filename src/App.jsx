
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
import { translations } from './translations';

function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Recommended');
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [companions, setCompanions] = useState([]);
  const [language, setLanguage] = useState('en');

  const t = translations[language];

  useEffect(() => {
    const fetchData = () => {
      fetch('/data.json?' + new Date().getTime()) // Prevent caching
        .then(res => res.json())
        .then(data => setCompanions(data))
        .catch(err => console.error("Failed to fetch live data:", err));
    };

    // Initial fetch
    fetchData();

    // Poll for new data every 5 seconds
    const interval = setInterval(fetchData, 5000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  // Filter logic
  let filteredCompanions = companions.filter(c => {
    if (activeCategory === 'All') return true;
    return c.tags.includes(activeCategory);
  });

  // Sort logic
  filteredCompanions.sort((a, b) => {
    if (sortBy === 'Price (Low to High)') {
      const pA = parseInt(a.price.replace(/[^\\d]/g, '')) || 0;
      const pB = parseInt(b.price.replace(/[^\\d]/g, '')) || 0;
      return pA - pB;
    }
    if (sortBy === 'Price (High to Low)') {
      const pA = parseInt(a.price.replace(/[^\\d]/g, '')) || 0;
      const pB = parseInt(b.price.replace(/[^\\d]/g, '')) || 0;
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

