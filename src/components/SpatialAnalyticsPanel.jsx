import { useMemo } from 'react';
import InsightNarrative from './InsightNarrative';
import './SpatialAnalyticsPanel.css';

// Parses hours like "10:00-24:00" or "12.00 - 02.00" and returns an array of active hours
function parseActiveHours(hoursStr) {
  if (!hoursStr) return [];
  const matches = hoursStr.match(/(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/);
  if (!matches) return [];
  
  let start = parseInt(matches[1], 10);
  let end = parseInt(matches[3], 10);
  
  if (end < start) end += 24; // Handle past midnight
  
  const active = [];
  for (let i = start; i < end; i++) {
    active.push(i % 24);
  }
  return active;
}

export default function SpatialAnalyticsPanel({ visiblePins = [], totalListings = 0 }) {
  const analytics = useMemo(() => {
    if (visiblePins.length === 0) return null;

    let totalMentions = 0;
    let totalPrice = 0;
    let pricedItems = 0;
    let sumLat = 0;
    let sumLng = 0;
    
    const hourFrequencies = new Array(24).fill(0);
    const listingsList = [];

    visiblePins.forEach((pin) => {
      const listing = pin.listing || pin;
      const mentions = Number(listing.mentionCount) || Number(listing.mention_count) || 1;
      const price = Number(listing.priceValue);
      
      totalMentions += mentions;

      if (price && !isNaN(price)) {
        totalPrice += price;
        pricedItems++;
      }

      if (pin.coords) {
        sumLat += pin.coords[0];
        sumLng += pin.coords[1];
      }
      
      // Value Score: Mentions per 1000 THB
      let valueScore = 0;
      if (price && price > 0) {
        valueScore = (mentions / price) * 1000;
      }
      
      listingsList.push({
        ...listing,
        computedMentions: mentions,
        valueScore,
      });
      
      // Temporal Parsing
      if (listing.hours) {
        const activeHours = parseActiveHours(listing.hours);
        activeHours.forEach(h => hourFrequencies[h]++);
      }
    });

    const avgPrice = pricedItems > 0 ? Math.round(totalPrice / pricedItems) : null;
    const avgMentions = Math.round(totalMentions / visiblePins.length);
    
    // Center of Mass
    const centerOfMass = {
      lat: (sumLat / visiblePins.length).toFixed(4),
      lng: (sumLng / visiblePins.length).toFixed(4)
    };
    
    // Peak Operating Hour
    let peakHour = null;
    let peakCount = 0;
    hourFrequencies.forEach((count, hour) => {
      if (count > peakCount) {
        peakCount = count;
        peakHour = hour;
      }
    });
    
    // Top Performers (Alpha Locations)
    const topPerformers = [...listingsList]
      .sort((a, b) => b.computedMentions - a.computedMentions)
      .slice(0, 3);
      
    // Highest Value Listing
    const bestValue = [...listingsList]
      .sort((a, b) => b.valueScore - a.valueScore)
      .find(l => l.valueScore > 0);

    return { totalMentions, avgPrice, avgMentions, centerOfMass, peakHour, topPerformers, bestValue, visibleCount: visiblePins.length };
  }, [visiblePins]);

  if (!analytics) return null;

  return (
    <div className="spatial-analytics-panel">
      <div className="spatial-header">
        <span className="spatial-kicker">MATHEMATICAL INSIGHTS</span>
        <h4>Viewport Analytics</h4>
      </div>
      
      <InsightNarrative analytics={analytics} mode="spatial" />
      
      <div className="spatial-grid">
        <div className="spatial-stat">
          <div className="spatial-label">Visible Density</div>
          <div className="spatial-value">{visiblePins.length} <span className="spatial-unit">locations</span></div>
          <div className="spatial-sub">Out of {totalListings} total</div>
        </div>

        <div className="spatial-stat">
          <div className="spatial-label">Avg Popularity</div>
          <div className="spatial-value">{analytics.avgMentions} <span className="spatial-unit">mentions</span></div>
          <div className="spatial-sub">{analytics.totalMentions} total mentions</div>
        </div>

        <div className="spatial-stat">
          <div className="spatial-label">Avg Price</div>
          <div className="spatial-value">
            {analytics.avgPrice ? `฿${analytics.avgPrice.toLocaleString()}` : 'N/A'}
          </div>
          <div className="spatial-sub">Based on provided rates</div>
        </div>

        <div className="spatial-stat">
          <div className="spatial-label">Peak Activity</div>
          <div className="spatial-value">
            {analytics.peakHour !== null ? `${analytics.peakHour}:00` : 'N/A'}
          </div>
          <div className="spatial-sub">Highest overlapping hours</div>
        </div>
      </div>
      
      {(analytics.topPerformers.length > 0 || analytics.bestValue) && (
        <div className="spatial-deep-insights">
          {analytics.topPerformers.length > 0 && (
            <div className="spatial-alphas">
              <span className="spatial-label">The Alphas (Top 3 Popularity)</span>
              <div className="alpha-list">
                {analytics.topPerformers.map((alpha, idx) => (
                  <div key={alpha.id || idx} className="alpha-row">
                    <span className="alpha-rank">#{idx + 1}</span>
                    <span className="alpha-name">{alpha.name || 'Unknown'}</span>
                    <span className="alpha-score">{alpha.computedMentions} mentions</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {analytics.bestValue && (
            <div className="spatial-value-index">
              <span className="spatial-label">Highest Value Index</span>
              <div className="value-card">
                <span className="value-score">
                  {analytics.bestValue.valueScore.toFixed(2)} 
                  <span className="spatial-unit"> pts</span>
                </span>
                <span className="value-name">{analytics.bestValue.name || 'Unknown'}</span>
                <span className="value-sub">฿{analytics.bestValue.priceValue} · {analytics.bestValue.computedMentions} mentions</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
