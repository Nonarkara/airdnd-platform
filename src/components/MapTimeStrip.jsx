import { useEffect, useState } from 'react';

/**
 * MapTimeStrip — 24-hour broadcast rhythm overlay.
 *
 * Reads /research.json (compute_research.js output) and renders a single
 * horizontal strip across the bottom of the map. Each cell is one Bangkok
 * hour. Cells fill with amber proportional to the hourly post volume; the
 * current hour is bright; the peak broadcast window gets a hairline border.
 *
 * Fails silent. If research.json is missing, the strip renders nothing.
 *
 * Inspired by the JK World flood map's "data timeline" feel — but ours is
 * operator-behavior, not water levels.
 */

const STRIP_HEIGHT = 28;
const HOURS = 24;

function maxCount(hourly) {
  return hourly.reduce((m, h) => (h?.count > m ? h.count : m), 0) || 1;
}

function normalize(count, peak) {
  return Math.min(1, count / peak);
}

function fillStyle(intensity) {
  // Three-tier ramp ── quiet, normal, hot. Single accent only.
  if (intensity < 0.08) return 'is-quiet';
  if (intensity < 0.45) return 'is-normal';
  return 'is-hot';
}

function nowHourBkk() {
  // Bangkok is UTC+7 — match compute_research.js's TZ_OFFSET_HOURS so the
  // "now" tick aligns with the bucket boundaries.
  const now = new Date();
  return (now.getUTCHours() + 7) % 24;
}

export default function MapTimeStrip() {
  const [hourly, setHourly] = useState([]);
  const [peak, setPeak] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/research.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.temporal) return;
        setHourly(Array.isArray(data.temporal.hourly) ? data.temporal.hourly : []);
        setPeak(data.temporal.peakWindow ?? null);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hourly || hourly.length === 0) return null;

  const peakCount = maxCount(hourly);
  const peakStart = peak?.startHour ?? -1;
  const peakEnd = peak?.endHour ?? -1;
  const now = nowHourBkk();
  const peakIsThreeHour = peakStart >= 0;

  return (
    <div className="map-time-strip" role="img" aria-label="24-hour broadcast rhythm">
      <div className="map-time-strip__head">
        <span className="map-time-strip__kicker">Broadcast rhythm · 24 h</span>
        {peakIsThreeHour && (
          <span className="map-time-strip__peak">
            Peak {String(peakStart).padStart(2, '0')}:00–{String(peakEnd + 1).padStart(2, '0')}:00
          </span>
        )}
      </div>
      <ol className="map-time-strip__cells" style={{ height: STRIP_HEIGHT }}>
        {hourly.map((cell) => {
          const hour = Number(cell?.hour);
          const intensity = normalize(Number(cell?.count) || 0, peakCount);
          const isNow = hour === now;
          const isPeak = peakIsThreeHour && (
            (peakStart <= peakEnd && hour >= peakStart && hour <= peakEnd) ||
            (peakStart > peakEnd && (hour >= peakStart || hour <= peakEnd))
          );
          const intensityClass = fillStyle(intensity);
          return (
            <li
              key={hour}
              className={`map-time-strip__cell ${intensityClass}${isNow ? ' is-now' : ''}${isPeak ? ' is-peak' : ''}`}
              style={{ flexBasis: `${100 / HOURS}%` }}
              title={`${String(hour).padStart(2, '0')}:00 — ${Number(cell?.count) || 0} posts`}
              aria-label={`${String(hour).padStart(2, '0')}:00 ${Number(cell?.count) || 0} posts`}
            >
              <span className="map-time-strip__hour">{String(hour).padStart(2, '0')}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
