export default function SessionStats({ events }) {
  const sessions = {};
  events.forEach(e => {
    const t = new Date(e.created_at).getTime();
    if (!sessions[e.session_id]) {
      sessions[e.session_id] = { min: t, max: t };
    } else {
      sessions[e.session_id].min = Math.min(sessions[e.session_id].min, t);
      sessions[e.session_id].max = Math.max(sessions[e.session_id].max, t);
    }
  });

  const durations = Object.values(sessions).map(s => (s.max - s.min) / 1000);
  const totalSessions = durations.length;
  const avgDuration = totalSessions > 0
    ? durations.reduce((a, b) => a + b, 0) / totalSessions
    : 0;
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const medianDuration = totalSessions > 0
    ? sortedDurations[Math.floor(totalSessions / 2)]
    : 0;

  const pageviews = events.filter(e => e.event_type === 'pageview').length;
  const pagesPerSession = totalSessions > 0 ? (pageviews / totalSessions).toFixed(1) : '0';

  function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  return (
    <div className="stat-grid">
      <div className="stat-item">
        <div className="stat-value">{totalSessions}</div>
        <div className="stat-label">Sessions</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{pagesPerSession}</div>
        <div className="stat-label">Pages / Session</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{formatDuration(avgDuration)}</div>
        <div className="stat-label">Avg Duration</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{formatDuration(medianDuration)}</div>
        <div className="stat-label">Median Duration</div>
      </div>
    </div>
  );
}
