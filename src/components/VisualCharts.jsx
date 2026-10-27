import './VisualCharts.css';

export default function VisualCharts({ analytics, eumems }) {
  if (!analytics) return null;

  const {
    priceBuckets,
    photoBuckets,
    postingHours,
    postingDays,
    dayLabels,
    activityHeatmap,
    maxHeatmapValue,
    topNicks,
    topQuality,
    hoursRows,
    messageTypeRows,
    corpusCounts,
    total,
    meanPhotos,
    totalPhotos,
    topCities,
    topChannels,
    contactRows,
    completenessRows,
    velocity,
    trends,
    channelSNR,
    mentionPower,
    lifecycle,
    credibility,
    locationAtlas,
  } = analytics;

  const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : '—');

  // Price Distribution
  const priceEntries = Object.entries(priceBuckets || {}).sort(
    ([a], [b]) => {
      const av = parseInt(a, 10) || 0;
      const bv = parseInt(b, 10) || 0;
      return av - bv;
    },
  );
  const maxPriceBucket = Math.max(...priceEntries.map(([, c]) => c), 1);

  // Photo Density
  const photoEntries = Object.entries(photoBuckets || {});  
  const maxPhotoBucket = Math.max(...photoEntries.map(([, c]) => c), 1);

  // Posting Hour Heatmap
  const maxHourVal = Math.max(...Object.values(postingHours || {}), 1);
  const hourEntries = Object.entries(postingHours || {}).sort(([a], [b]) => +a - +b);

  // Day-of-week activity
  const maxDayVal = Math.max(...postingDays, 1);

  // Nickname cloud data
  const maxNickCount = Math.max(...(topNicks || []).map(([, c]) => c), 1);

  // Service quality tag cloud
  const maxTagCount = Math.max(...(topQuality || []).map(([, c]) => c), 1);

  // Message type funnel
  const maxMsgType = Math.max(...(messageTypeRows || []).map(([, c]) => c), 1);

  // Linguistic decoder accepts either an array of {label, count, implied}
  // or a plain {label: count} map. Object.entries on the array form would
  // render the row object itself as a React child (React error #31).
  const eumemRows = Array.isArray(eumems)
    ? eumems.map((e) => [e.label, e.count])
    : Object.entries(eumems || {});
  const maxEumem = Math.max(...eumemRows.map(([, c]) => c), 1);

  return (
    <div className="visual-charts-container">
      {/* Price Distribution */}
      <section className="chart-section">
        <h3>Posted Rate Distribution</h3>
        <p className="chart-sub">Where parlours actually price themselves. Empty buckets = no numeric rate posted.</p>
        <div className="histogram">
          {priceEntries.map(([label, count]) => (
            <div key={label} className="histogram-bar-container">
              <div
                className="histogram-bar"
                style={{ height: `${(count / maxPriceBucket) * 100}%` }}
              >
                <span className="bar-value">{count}</span>
              </div>
              <div className="bar-label">{label}</div>
            </div>
          ))}
        </div>
        <p className="chart-note">{total} parlours · mean {meanPhotos} photos · {totalPhotos} total archived</p>
      </section>

      {/* Photo Density */}
      <section className="chart-section">
        <h3>Photo Density per Listing</h3>
        <p className="chart-sub">How visual the corpus is. A high 31+ bucket means parlours post lots of staff pics.</p>
        <div className="histogram">
          {photoEntries.map(([label, count]) => (
            <div key={label} className="histogram-bar-container">
              <div
                className="histogram-bar"
                style={{ height: `${(count / maxPhotoBucket) * 100}%`, background: 'var(--color-data)' }}
              >
                <span className="bar-value">{count}</span>
              </div>
              <div className="bar-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Engagement Hotspots - When they actually engage */}
      <section className="chart-section">
        <h3>Engagement Hotspots</h3>
        <p className="chart-sub">When parlours actually engage with clients. Darker = more posts.</p>
        <div className="heatmap-hour-grid">
          {hourEntries.map(([h, count]) => {
            const intensity = count > 0 ? 0.15 + (count / maxHourVal) * 0.85 : 0;
            const level = getEngagementLevel(count);
            return (
              <div key={h} className="heatmap-hour-cell" title={`${h}:00 — ${count} posts`}>
                <div
                  className="heatmap-hour-bar"
                  style={{ backgroundColor: `rgba(255, 116, 64, ${intensity})` }}
                >
                  {count > 0 && <span className="heatmap-hour-val">{count}</span>}
                  <span className="heatmap-hour-level">{level}</span>
                </div>
                <span className="heatmap-hour-label">{h}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Day-of-week Activity */}
      <section className="chart-section">
        <h3>Day-of-Week Activity</h3>
        <p className="chart-sub">Which days see the most posts. Sunday=0 … Saturday=6.</p>
        <div className="day-bar-chart">
          {postingDays.map((count, i) => (
            <div key={i} className="day-bar-col">
              <div
                className="day-bar"
                style={{ height: `${(count / maxDayVal) * 100}%` }}
                title={`${dayLabels[i]}: ${count}`}
              >
                {count > 0 && <span className="day-bar-val">{count}</span>}
              </div>
              <span className="day-bar-label">{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Top Nicknames */}
      <section className="chart-section">
        <h3>Top Nicknames</h3>
        <p className="chart-sub">What the community actually calls providers. Larger = more mentions.</p>
        <div className="nick-cloud">
          {(topNicks || []).map(([nick, count]) => {
            const size = 11 + Math.min(11, Math.round((count / maxNickCount) * 10));
            return (
              <span key={nick} className="nick-tag" style={{ fontSize: `${size}px` }} title={`${count} mentions`}>
                {nick}<sub>{count}</sub>
              </span>
            );
          })}
        </div>
      </section>

      {/* Service Quality Tags */}
      <section className="chart-section">
        <h3>Service Quality Tags</h3>
        <p className="chart-sub">AI-extracted positive feedback from community discussions.</p>
        <div className="tag-cloud">
          {(topQuality || []).map(([tag, count]) => (
            <span key={tag} className="tag-chip" title={`${count} mentions`}>
              {tag} <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* Linguistic Decoder - if euphemisms provided */}
      {eumems && eumemRows.length > 0 && (
        <section className="chart-section">
          <h3>Linguistic Decoder</h3>
          <p className="chart-sub">How parlours describe themselves in community posts.</p>
          <div className="linguistic-decoder">
            {eumemRows.map(([label, count]) => {
              const pct = maxEumem > 0 ? (count / maxEumem) * 100 : 0;
              return (
                <div key={label} className="linguistic-row">
                  <span className="linguistic-label">{label}</span>
                  <div className="linguistic-bar">
                    <div
                      className="linguistic-fill"
                      style={{ width: `${pct}%`, background: 'var(--color-data)' }}
                    >
                      <span className="linguistic-count">{count}</span>
                    </div>
                  </div>
                  <span className="linguistic-level">{getEngagementLevel(count)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Message Type Funnel */}
      <section className="chart-section">
        <h3>Raw Corpus Funnel</h3>
        <p className="chart-sub">What the pipeline actually mined from Telegram messages.</p>
        <div className="funnel-bars">
          {(messageTypeRows || []).map(([label, count, type]) => (
            <div key={type} className="funnel-row">
              <span className="funnel-label">{label}</span>
              <div className="funnel-track">
                <div
                  className="funnel-fill"
                  style={{
                    width: `${(count / maxMsgType) * 100}%`,
                    background: type === 'listing' ? 'var(--color-action)' : 'var(--color-data)',
                  }}
                >
                  {count}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="chart-note">
          {corpusCounts?.rawMessages.toLocaleString()} raw messages · {corpusCounts?.listingYield}% listing yield · {corpusCounts?.archivedPhotos.toLocaleString()} photos archived
        </p>
      </section>

      {/* Activity Heatmap - 7×24 */}
      {activityHeatmap && maxHeatmapValue > 0 && (
        <section className="chart-section">
          <h3>Activity Heatmap · 7×24</h3>
          <p className="chart-sub">Every post, by day and hour. Darker cells = more posts.</p>
          <div className="heatmap-week-grid">
            {activityHeatmap.map((dayData, dIdx) => (
              <div key={dIdx} className="heatmap-week-row">
                <span className="heatmap-day-label">{dayLabels[dIdx]}</span>
                <div className="heatmap-week-cells">
                  {dayData.map((val, hIdx) => {
                    const intensity = val > 0 ? 0.15 + (val / maxHeatmapValue) * 0.85 : 0;
                    return (
                      <div
                        key={hIdx}
                        className="heatmap-week-cell"
                        style={{ backgroundColor: `rgba(255, 116, 64, ${intensity})` }}
                        title={`${dayLabels[dIdx]} ${hIdx}:00 — ${val} posts`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Helper functions (kept private to component)
function getEngagementLevel(count) {
  if (count >= 500) return 'Extreme';
  if (count >= 300) return 'Hot';
  if (count >= 150) return 'Active';
  if (count >= 50) return 'Steady';
  if (count >= 10) return 'Light';
  return 'Quiet';
}
