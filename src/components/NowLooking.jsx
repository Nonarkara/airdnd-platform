import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import './NowLooking.css';

/*
 * NowLooking — anonymised real-time presence ticker.
 *
 * Subscribes to INSERTs on page_views with `event_type = 'listing_click'` and
 * surfaces them as a small mono ticker so the directory feels alive — the
 * Bloomberg-terminal "another desk just looked at this" cue, not the Airbnb
 * urgency-manipulation cue. Privacy guardrails:
 *   - country only; no city, no IP, no UA
 *   - never mirrors the active session back to itself
 *   - never shows session id / visitor id
 *   - max 3 events visible, each fades out after ~14 s
 *
 * Receives a `listings` map from App so it can resolve listing_id → name
 * without hitting the DB again.
 */

const MAX_VISIBLE = 3;
const FADE_OUT_MS = 14_000;
const MAX_AGE_MS = 90_000;     // drop events older than 90s — keeps the ticker fresh

function timeAgo(iso) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function getOwnSessionId() {
  try { return sessionStorage.getItem('sabai_session_id') || null; } catch { return null; }
}

export default function NowLooking({ listings }) {
  const [events, setEvents] = useState([]);
  const ownSessionId = useMemo(() => getOwnSessionId(), []);

  // Quick id → listing-name lookup so the ticker doesn't refetch.
  const nameById = useMemo(() => {
    const map = new Map();
    (Array.isArray(listings) ? listings : []).forEach((l) => {
      if (l && l.id != null) map.set(String(l.id), l.name || '—');
    });
    return map;
  }, [listings]);

  useEffect(() => {
    let cancelled = false;
    const channel = supabase
      .channel('now-looking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_views', filter: 'event_type=eq.listing_click' },
        (payload) => {
          if (cancelled) return;
          const row = payload?.new;
          if (!row || row.session_id === ownSessionId) return;
          if (row.listing_id == null) return;
          setEvents((current) => {
            const next = [
              {
                key: `${row.id}-${row.created_at}`,
                listingId: String(row.listing_id),
                country: (row.country || 'Somewhere').trim(),
                ts: row.created_at || new Date().toISOString(),
              },
              ...current.filter((e) => Date.now() - new Date(e.ts).getTime() < MAX_AGE_MS),
            ].slice(0, MAX_VISIBLE);
            return next;
          });
        },
      )
      .subscribe();

    // Tick every 4s so timeAgo updates and old events drop off.
    const tickId = window.setInterval(() => {
      if (cancelled) return;
      setEvents((current) => {
        const filtered = current.filter((e) => Date.now() - new Date(e.ts).getTime() < FADE_OUT_MS);
        return filtered.length === current.length ? current : filtered;
      });
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(tickId);
      supabase.removeChannel(channel);
    };
  }, [ownSessionId]);

  if (events.length === 0) return null;

  return (
    <div className="now-looking" aria-live="polite">
      {events.map((e) => {
        const name = nameById.get(e.listingId) || `LISTING ${e.listingId}`;
        return (
          <a key={e.key} href={`/?listing=${encodeURIComponent(e.listingId)}`} className="now-looking-row">
            <span className="now-looking-prefix">▸ NOW VIEWING</span>
            <span className="now-looking-sep">·</span>
            <span className="now-looking-where">{e.country}</span>
            <span className="now-looking-sep">·</span>
            <span className="now-looking-when">{timeAgo(e.ts)}</span>
            <span className="now-looking-sep">·</span>
            <span className="now-looking-name">{name.length > 28 ? `${name.slice(0, 27)}…` : name}</span>
          </a>
        );
      })}
    </div>
  );
}
