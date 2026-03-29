export default function TopPages({ events }) {
  const counts = {};
  events.forEach(e => {
    const page = e.page || '/';
    counts[page] = (counts[page] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (sorted.length === 0) return <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet</p>;

  return (
    <table className="admin-table">
      <thead>
        <tr><th>Page</th><th>Views</th></tr>
      </thead>
      <tbody>
        {sorted.map(([page, count]) => (
          <tr key={page}>
            <td>{page || '/'}</td>
            <td>{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
