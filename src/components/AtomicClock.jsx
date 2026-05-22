import { useEffect, useState } from 'react';
import './AtomicClock.css';

const BKK_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const BKK_FMT_MS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
});

export default function AtomicClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 33); // ~30 fps
    return () => clearInterval(id);
  }, []);

  const date = new Date(now);
  const full = BKK_FMT_MS.format(date);      // HH:MM:SS.mmm
  const short = BKK_FMT.format(date);        // HH:MM:SS (mobile)

  return (
    <div className="atomic-clock" aria-label="Bangkok time" aria-live="off">
      <span className="atomic-clock-label">ATOMIC · ICT</span>
      <span className="atomic-clock-time">
        <span className="atomic-clock-full">{full}</span>
        <span className="atomic-clock-short">{short}</span>
      </span>
    </div>
  );
}
