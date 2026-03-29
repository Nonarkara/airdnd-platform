export default function LocationList({ events }) {
  const locations = {};
  events.forEach(e => {
    if (!e.country) return;
    const key = `${e.country}${e.city ? ', ' + e.city : ''}`;
    if (!locations[key]) locations[key] = new Set();
    locations[key].add(e.session_id);
  });

  const sorted = Object.entries(locations)
    .map(([loc, sessions]) => [loc, sessions.size])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (sorted.length === 0) return <p style={{ color: '#94a3b8', fontSize: 13 }}>No location data yet</p>;

  return (
    <table className="admin-table">
      <thead>
        <tr><th>Location</th><th>Sessions</th></tr>
      </thead>
      <tbody>
        {sorted.map(([loc, count]) => (
          <tr key={loc}>
            <td>{loc}</td>
            <td>{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
