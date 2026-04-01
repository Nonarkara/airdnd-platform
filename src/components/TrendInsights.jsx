import { useMemo } from 'react';
import { getListingTimestamp } from '../lib/listings';
import './TrendInsights.css';

function TrendInsights({ listings, t }) {
  const trends = useMemo(() => {
    if (!Array.isArray(listings) || listings.length === 0) return null;

    // Activity by day of week
    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Source channel distribution
    const byChannel = {};

    // Price distribution
    const prices = [];
    let withPrice = 0;
    let withPhone = 0;
    let withLine = 0;
    let withMaps = 0;
    let withPhoto = 0;

    // City distribution
    const byCity = {};

    // Time-based: newest and oldest
    let newestDate = null;
    let oldestDate = null;

    listings.forEach((listing) => {
      const ts = getListingTimestamp(listing);
      if (ts) {
        const day = ts.getDay();
        byDayOfWeek[day]++;
        if (!newestDate || ts > newestDate) newestDate = ts;
        if (!oldestDate || ts < oldestDate) oldestDate = ts;
      }

      const ch = listing.sourceChannel || 'Unknown';
      byChannel[ch] = (byChannel[ch] || 0) + 1;

      if (listing.priceValue && listing.priceValue >= 100 && listing.priceValue <= 20000) {
        prices.push(listing.priceValue);
        withPrice++;
      }

      if (listing.phone) withPhone++;
      if (listing.lineUrl) withLine++;
      if (listing.mapsUrl) withMaps++;
      if (listing.imageUrl && !listing.imageUrl.startsWith('/mockups/')) withPhoto++;

      const city = listing.city || 'Bangkok';
      byCity[city] = (byCity[city] || 0) + 1;
    });

    const avgPrice = prices.length > 0
      ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
      : null;
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

    const topChannels = Object.entries(byChannel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topCities = Object.entries(byCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const maxDayCount = Math.max(...byDayOfWeek);

    const dataCompleteness = Math.round(
      ((withPhone + withLine + withMaps + withPhoto + withPrice) / (listings.length * 5)) * 100
    );

    return {
      total: listings.length,
      byDayOfWeek,
      dayLabels,
      maxDayCount,
      topChannels,
      topCities,
      avgPrice,
      minPrice,
      maxPrice,
      withPrice,
      withPhone,
      withLine,
      withMaps,
      withPhoto,
      dataCompleteness,
      newestDate,
      oldestDate,
    };
  }, [listings]);

  if (!trends) return null;

  return (
    <section className="trends-section">
      <div className="trends-header">
        <span className="section-kicker">BUSINESS INTELLIGENCE</span>
        <h2>Market Trends</h2>
        <p className="trends-subtitle">
          Real-time insights from {trends.total} massage and spa listings across Thailand.
        </p>
      </div>

      <div className="trends-grid">
        {/* Price insights */}
        <div className="trend-card">
          <h3>Price Range</h3>
          {trends.avgPrice ? (
            <div className="trend-price-range">
              <div className="trend-price-main">
                <span className="trend-big-number">{trends.avgPrice}</span>
                <span className="trend-unit">THB avg</span>
              </div>
              <div className="trend-price-bounds">
                <span>{trends.minPrice} THB min</span>
                <span>{trends.maxPrice} THB max</span>
              </div>
            </div>
          ) : (
            <p className="trend-note">Price data still being collected</p>
          )}
        </div>

        {/* Data completeness */}
        <div className="trend-card">
          <h3>Data Quality</h3>
          <div className="trend-big-number">{trends.dataCompleteness}%</div>
          <div className="trend-bar-track">
            <div className="trend-bar-fill" style={{ width: `${trends.dataCompleteness}%` }} />
          </div>
          <div className="trend-quality-grid">
            <span>{trends.withPhoto} photos</span>
            <span>{trends.withPhone} phones</span>
            <span>{trends.withLine} LINE</span>
            <span>{trends.withMaps} maps</span>
          </div>
        </div>

        {/* Posting activity by day */}
        <div className="trend-card">
          <h3>Posting Activity</h3>
          <div className="trend-day-chart">
            {trends.byDayOfWeek.map((count, i) => (
              <div key={i} className="trend-day-bar">
                <div
                  className="trend-day-fill"
                  style={{ height: `${trends.maxDayCount > 0 ? (count / trends.maxDayCount) * 100 : 0}%` }}
                />
                <span className="trend-day-label">{trends.dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top source channels */}
        <div className="trend-card">
          <h3>Top Sources</h3>
          <div className="trend-list">
            {trends.topChannels.map(([ch, count]) => (
              <div key={ch} className="trend-list-row">
                <span className="trend-list-name">{ch}</span>
                <span className="trend-list-count">{count}</span>
                <div className="trend-list-bar">
                  <div
                    className="trend-list-fill"
                    style={{ width: `${(count / trends.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* City distribution */}
        <div className="trend-card">
          <h3>Geographic Spread</h3>
          <div className="trend-list">
            {trends.topCities.map(([city, count]) => (
              <div key={city} className="trend-list-row">
                <span className="trend-list-name">{city}</span>
                <span className="trend-list-count">{count}</span>
                <div className="trend-list-bar">
                  <div
                    className="trend-list-fill trend-fill-gold"
                    style={{ width: `${(count / trends.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coverage timeline */}
        <div className="trend-card">
          <h3>Coverage</h3>
          <div className="trend-coverage">
            <div className="trend-coverage-row">
              <span>Total Listings</span>
              <strong>{trends.total}</strong>
            </div>
            <div className="trend-coverage-row">
              <span>Source Channels</span>
              <strong>{Object.keys(trends.topChannels.reduce((m, [k]) => ({ ...m, [k]: 1 }), {})).length}</strong>
            </div>
            <div className="trend-coverage-row">
              <span>Cities Covered</span>
              <strong>{trends.topCities.length}</strong>
            </div>
            <div className="trend-coverage-row">
              <span>With Real Photos</span>
              <strong>{trends.withPhoto}</strong>
            </div>
            <div className="trend-coverage-row">
              <span>With Contact Info</span>
              <strong>{trends.withPhone + trends.withLine}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TrendInsights;
