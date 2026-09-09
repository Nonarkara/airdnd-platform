/**
 * A monthly series as one thin line. `null` months are gaps, never zeros — a
 * province that did not report is not a province that sold nothing. Median
 * rule under the line, last value labelled. Ink only, no second hue.
 */
const W = 320, H = 72, PAD = 4;

export default function Sparkline({ points, format = (v) => String(v), label }) {
  const values = points.map((p) => p.value).filter((v) => v != null);
  if (values.length === 0) return <p className="t-note">No months reported.</p>;
  const max = Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const x = (i) => PAD + (i / Math.max(points.length - 1, 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - (v / (max || 1)) * (H - PAD * 2);

  // One path per contiguous run so a null breaks the line.
  const runs = [];
  let run = [];
  points.forEach((p, i) => {
    if (p.value == null) { if (run.length) runs.push(run); run = []; return; }
    run.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  });
  if (run.length) runs.push(run);
  const lastIdx = points.map((p) => p.value != null).lastIndexOf(true);
  const last = points[lastIdx];

  return (
    <figure className="t-spark">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${label ?? 'Series'}: ${values.length} of ${points.length} months reported, peak ${format(max)}, median ${format(median)}, latest ${format(last.value)}`}>
        <line x1={PAD} x2={W - PAD} y1={y(median)} y2={y(median)} className="t-spark-median" />
        {runs.map((r, i) => <polyline key={i} points={r.join(' ')} className="t-spark-line" />)}
        {points.map((p, i) => (p.value == null ? <rect key={i} x={x(i) - 1} y={PAD} width="2" height={H - PAD * 2} className="t-spark-gap" /> : null))}
        <circle cx={x(lastIdx)} cy={y(last.value)} r="3" className="t-spark-last" />
      </svg>
      <figcaption className="t-spark-cap">
        <span>{points[0].label} → {points[points.length - 1].label}</span>
        <span className="t-row-num">latest {format(last.value)} · median {format(median)}</span>
      </figcaption>
    </figure>
  );
}
