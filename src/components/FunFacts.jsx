import { useMemo } from 'react';
import './FunFacts.css';

export default function FunFacts({ listings, metrics }) {
  const facts = useMemo(() => {
    if (!listings || listings.length === 0) return [];

    const computed = [];

    // Fact 1: Credibility King/Queen
    const mostCredible = [...listings].sort((a, b) => (b.credibility || 0) - (a.credibility || 0))[0];
    if (mostCredible && mostCredible.credibility > 0) {
      computed.push({
        emoji: '🌟',
        title: 'Most Verified',
        text: `${mostCredible.name} has the highest credibility score (${mostCredible.credibility.toFixed(1)}), backed by ${mostCredible.mentionCount || 1} independent mentions.`,
      });
    }

    // Fact 2: Price Range
    const prices = listings.map(l => l.priceValue).filter(p => p > 0);
    if (prices.length > 0) {
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const max = Math.max(...prices);
      computed.push({
        emoji: '💸',
        title: 'Market Value',
        text: `The average listed price is ฿${avg.toLocaleString()}, while the premium tier peaks at ฿${max.toLocaleString()}.`,
      });
    }

    // Fact 3: Popular Services
    if (metrics?.popularServices && metrics.popularServices.length > 0) {
      const topService = metrics.popularServices[0];
      computed.push({
        emoji: '🔥',
        title: 'Trending',
        text: `"${topService.tag}" is currently the most requested service, appearing in ${topService.count} active listings.`,
      });
    }

    // Fact 4: Night Owls
    const nightOwls = listings.filter(l => (l.hours || '').toLowerCase().includes('24'));
    if (nightOwls.length > 0) {
      computed.push({
        emoji: '🌙',
        title: 'Always Open',
        text: `There are ${nightOwls.length} spots operating 24/7 in the directory right now.`,
      });
    }

    return computed;
  }, [listings, metrics]);

  if (facts.length === 0) return null;

  return (
    <section className="fun-facts-section">
      <div className="section-header">
        <div>
          <span className="section-kicker">Market Insights</span>
          <h2>Fun Facts</h2>
        </div>
      </div>
      <div className="fun-facts-grid">
        {facts.map((fact, index) => (
          <div key={index} className="fun-fact-card an-card" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="fun-fact-emoji">{fact.emoji}</div>
            <div className="fun-fact-content">
              <h4>{fact.title}</h4>
              <p>{fact.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
