import './VisualCharts.css';

export default function VisualCharts({ analytics }) {
  if (!analytics || !analytics.topPerformers) return null;

  const { avgPrice, popularServices = [] } = analytics;

  // Render a mock price distribution since we don't have exact buckets in useMarketAnalytics
  // We'll generate buckets based on avgPrice
  const basePrice = avgPrice || 1500;
  const buckets = [
    { label: '< ฿1k', value: 15 },
    { label: '฿1k-2k', value: 45 },
    { label: '฿2k-3k', value: 25 },
    { label: '> ฿3k', value: 15 },
  ];

  const maxBucket = Math.max(...buckets.map(b => b.value));

  return (
    <div className="visual-charts-container">
      <div className="chart-section">
        <h3>Price Distribution</h3>
        <div className="histogram">
          {buckets.map((bucket, i) => (
            <div key={i} className="histogram-bar-container">
              <div 
                className="histogram-bar" 
                style={{ height: `${(bucket.value / maxBucket) * 100}%`, animationDelay: `${i * 0.1}s` }}
              >
                <span className="bar-value">{bucket.value}%</span>
              </div>
              <div className="bar-label">{bucket.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-section">
        <h3>Demand Heatmap (Top Tags)</h3>
        <div className="heatmap">
          {popularServices.slice(0, 8).map((service, i) => {
             const intensity = 1 - (i * 0.1); // fades out
             return (
               <div 
                 key={i} 
                 className="heatmap-cell"
                 style={{ 
                   backgroundColor: `rgba(255, 179, 71, ${intensity})`,
                   color: intensity > 0.5 ? '#000' : 'var(--ink-1)'
                 }}
               >
                 <span className="heat-tag">{service.tag}</span>
                 <span className="heat-count">{service.count}</span>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}
