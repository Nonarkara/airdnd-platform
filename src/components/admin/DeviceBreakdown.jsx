function parseDevice(ua) {
  if (!ua) return { type: 'Unknown', browser: 'Unknown' };
  const type = /Mobile|Android|iPhone/i.test(ua) ? 'Mobile'
    : /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Desktop';
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /Chrome/i.test(ua) ? 'Chrome'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Safari/i.test(ua) ? 'Safari' : 'Other';
  return { type, browser };
}

export default function DeviceBreakdown({ events }) {
  const sessions = {};
  events.forEach(e => {
    if (!sessions[e.session_id]) sessions[e.session_id] = e.user_agent;
  });

  const types = {};
  const browsers = {};
  Object.values(sessions).forEach(ua => {
    const { type, browser } = parseDevice(ua);
    types[type] = (types[type] || 0) + 1;
    browsers[browser] = (browsers[browser] || 0) + 1;
  });

  const total = Object.values(types).reduce((a, b) => a + b, 0) || 1;
  const colors = { Mobile: '#2a9d6e', Desktop: '#1e7a54', Tablet: '#64748b', Unknown: '#cbd5e1' };

  const segments = Object.entries(types).sort((a, b) => b[1] - a[1]);
  let offset = 0;
  const circumference = 2 * Math.PI * 40;

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        {segments.map(([type, count]) => {
          const pct = count / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const rot = offset * 360 - 90;
          offset += pct;
          return (
            <circle
              key={type}
              cx={50} cy={50} r={40}
              fill="none"
              stroke={colors[type] || '#94a3b8'}
              strokeWidth={16}
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rot} 50 50)`}
            />
          );
        })}
      </svg>
      <div>
        {segments.map(([type, count]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[type] || '#94a3b8', display: 'inline-block' }} />
            <span style={{ color: '#334155' }}>{type}</span>
            <span style={{ color: '#94a3b8' }}>{count} ({Math.round(count / total * 100)}%)</span>
          </div>
        ))}
        <div style={{ marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
          {Object.entries(browsers).sort((a, b) => b[1] - a[1]).map(([b, c]) => (
            <div key={b} style={{ fontSize: 12, color: '#64748b' }}>{b}: {c}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
