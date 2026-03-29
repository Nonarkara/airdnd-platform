export default function VisitorChart({ events }) {
  const byDay = {};
  events.forEach(e => {
    const day = e.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = new Set();
    byDay[day].add(e.session_id);
  });

  const days = Object.keys(byDay).sort();
  const counts = days.map(d => byDay[d].size);
  const max = Math.max(...counts, 1);

  if (days.length === 0) return <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet</p>;

  const barWidth = Math.max(16, Math.min(40, 600 / days.length - 4));
  const svgWidth = days.length * (barWidth + 4) + 40;
  const svgHeight = 180;
  const chartHeight = 140;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
        {days.map((day, i) => {
          const count = counts[i];
          const h = (count / max) * chartHeight;
          const x = 30 + i * (barWidth + 4);
          const y = chartHeight - h + 10;
          return (
            <g key={day}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={4}
                fill="#2a9d6e"
                opacity={0.85}
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight + 26}
                textAnchor="middle"
                fontSize={10}
                fill="#94a3b8"
              >
                {day.slice(5)}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={10}
                fill="#475569"
              >
                {count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
