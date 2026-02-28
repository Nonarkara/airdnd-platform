
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

function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Recommended');
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [companions, setCompanions] = useState([]);

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
      <Header />

      <main className="main-content">
        <HeroSection />

        <MapSection />

        <HowItWorks />

        <div className="section-header">
          <h2>Featured Companions</h2>
          <p>Discover our highly-rated professionals ready to elevate your experience.</p>
        </div>

        <FilterBar
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />

        <CompanionGrid
          companions={filteredCompanions}
          onCardClick={setSelectedCompanion}
        />
      </main>

      <Footer />

      {selectedCompanion && (
        <CompanionModal
          companion={selectedCompanion}
          onClose={() => setSelectedCompanion(null)}
        />
      )}
    </div>
  );
}
export default App;

