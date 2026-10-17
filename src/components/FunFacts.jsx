import { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './FunFacts.css';

function tmpl(str, vars) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

export default function FunFacts({ listings, metrics }) {
  const { t } = useLanguage();
  const tf = useMemo(() => t?.funFacts || {}, [t?.funFacts]);

  const facts = useMemo(() => {
    if (!listings || listings.length === 0) return [];

    const computed = [];

    const mostCredible = [...listings].sort((a, b) => (b.credibility || 0) - (a.credibility || 0))[0];
    if (mostCredible && mostCredible.credibility > 0) {
      const tpl = tf.mostVerified || {};
      computed.push({
        emoji: '🌟',
        title: tpl.title || 'Most Verified',
        text: tmpl(tpl.text || '{name} has the highest credibility score ({score}), backed by {count} independent mentions.', {
          name: mostCredible.name,
          score: mostCredible.credibility.toFixed(1),
          count: mostCredible.mentionCount || 1,
        }),
      });
    }

    const prices = listings.map((l) => l.priceValue).filter((p) => p > 0);
    if (prices.length > 0) {
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const max = Math.max(...prices);
      const pct = Math.round((prices.length / listings.length) * 100);
      const tpl = tf.marketValue || {};
      computed.push({
        emoji: '💸',
        title: tpl.title || 'Disclosed Rates',
        text: tmpl(tpl.text || 'Of the {percent}% of listings disclosing prices, the average is ฿{avg}, with the premium tier peaking at ฿{max}.', {
          percent: pct,
          avg: avg.toLocaleString(),
          max: max.toLocaleString(),
        }),
      });
    }

    if (metrics?.popularServices && metrics.popularServices.length > 0) {
      const topService = metrics.popularServices[0];
      const tpl = tf.trending || {};
      computed.push({
        emoji: '🔥',
        title: tpl.title || 'Trending',
        text: tmpl(tpl.text || '"{tag}" is the most requested service, appearing in {count} active listings.', {
          tag: topService.tag,
          count: topService.count,
        }),
      });
    }

    const nightOwls = listings.filter((l) => (l.hours || '').toLowerCase().includes('24'));
    if (nightOwls.length > 0) {
      const tpl = tf.alwaysOpen || {};
      computed.push({
        emoji: '🌙',
        title: tpl.title || 'Always Open',
        text: tmpl(tpl.text || 'There are {count} spots operating 24/7 in the directory right now.', {
          count: nightOwls.length,
        }),
      });
    }

    return computed;
  }, [listings, metrics, tf]);

  if (facts.length === 0) return null;

  return (
    <section className="fun-facts-section">
      <div className="section-header">
        <div>
          <span className="section-kicker">{tf.kicker || 'Market Insights'}</span>
          <h2>{tf.title || 'Fun Facts'}</h2>
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
