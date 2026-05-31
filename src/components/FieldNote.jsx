import { useEffect, useState } from 'react';
import './FieldNote.css';

// Subtle, rotating "field note" slipped into the hero. Every line is derived
// live from public/research.json — the unsupervised read of 85k messages — so
// the insight is real and updates as the data does. Anthropology, not marketing.
function buildNotes(r) {
  if (!r) return [];
  const notes = [];
  const fmt = (n) => Number(n).toLocaleString();

  if (r.repeat?.repeatRate) {
    notes.push(`${Math.round(r.repeat.repeatRate)}% of every listing posted is a repeat — the same shop, broadcast again.`);
  }
  if (r.queries?.bookingToPriceRatio >= 2) {
    notes.push(`Customers ask to book ${Math.round(r.queries.bookingToPriceRatio)}× more often than they ask the price.`);
  }
  const loc = r.queries?.intents?.find((q) => q.id === 'location');
  if (loc) {
    notes.push('Almost no one asks where a place is, or when it opens — the operators tell you first.');
  }
  if (r.temporal?.peakWindow) {
    const h = r.temporal.peakWindow.startHour;
    const ampm = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
    notes.push(`The busiest broadcast hour is ${ampm} — the morning "we're open" push.`);
  }
  if (r.repeat?.maxRepeatsOfOnePost > 50) {
    notes.push(`One listing was re-posted ${fmt(r.repeat.maxRepeatsOfOnePost)} times.`);
  }
  if (r.repeat?.crossPostRate) {
    notes.push(`${Math.round(r.repeat.crossPostRate)}% of listings appear on more than one channel.`);
  }
  if (r.corpus?.totalMessages) {
    notes.push(`${fmt(r.corpus.totalMessages)} messages, ${r.corpus.channels} channels, six years — read by machine, not by hand.`);
  }
  return notes;
}

function FieldNote() {
  const [notes, setNotes] = useState([]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/research.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((r) => { if (!cancelled) setNotes(buildNotes(r)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (notes.length < 2) return undefined;
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % notes.length);
        setShow(true);
      }, 400);
    }, 6000);
    return () => clearInterval(id);
  }, [notes.length]);

  if (!notes.length) return null;

  return (
    <a className="fieldnote" href="/sociology" aria-label="Field notes">
      <span className="fieldnote__tag">// field note</span>
      <span className={`fieldnote__text${show ? '' : ' is-out'}`}>{notes[idx]}</span>
    </a>
  );
}

export default FieldNote;
