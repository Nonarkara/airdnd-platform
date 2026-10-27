import { isPlaceholderName } from '../lib/listing_contract';
import { useEffect, useState } from 'react';

/**
 * MapActivityRail — the right-side "Now" panel.
 *
 * Inspired by the JK World flood map's right-side activity strip. Shows the
 * last six messages captured by the Telegram scraper, with freshness,
 * channel, and a deep-link into the listing modal. Updates when the file
 * reloads (every heartbeat cycle) so the rail tracks live intake.
 *
 * Reads /feed.json (already served by the build pipeline). Fails silent —
 * if the file is missing or stale, the rail just renders nothing.
 */

const RAIL_LIMIT = 6;

function freshClass(messageDate) {
  if (!messageDate) return 'unknown';
  const ageMs = Date.now() - new Date(messageDate).getTime();
  if (!Number.isFinite(ageMs)) return 'unknown';
  if (ageMs < 30 * 60 * 1000) return 'fresh';
  if (ageMs < 4 * 60 * 60 * 1000) return 'active';
  if (ageMs < 24 * 60 * 60 * 1000) return 'recent';
  return 'stale';
}

function freshnessLabel(messageDate) {
  if (!messageDate) return '—';
  const ageMs = Date.now() - new Date(messageDate).getTime();
  if (!Number.isFinite(ageMs)) return '—';
  if (ageMs < 60 * 1000) return 'just now';
  if (ageMs < 60 * 60 * 1000) return `${Math.round(ageMs / 60_000)} min`;
  if (ageMs < 24 * 60 * 60 * 1000) return `${Math.round(ageMs / 3_600_000)} h`;
  return `${Math.round(ageMs / 86_400_000)} d`;
}

function compactName(name) {
  // A post headed "โปรโมชั่น" or "ร้านเปิดใหม่" names no business.
  if (!name || isPlaceholderName(name)) return 'Unnamed post';
  const trimmed = String(name).trim();
  if (trimmed.length <= 36) return trimmed;
  return `${trimmed.slice(0, 33).trim()}…`;
}

function parseFeed(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.entries)) return payload.entries;
  return [];
}

export default function MapActivityRail() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/feed.json', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const entries = parseFeed(data).slice(0, RAIL_LIMIT);
          setItems(entries);
          setMeta({ generatedAt: data.generatedAt ?? null, count: entries.length });
        })
        .catch(() => {
          /* silent — rail just stays empty */
        });
    };
    load();
    // Re-fetch every 2 minutes; matches the heartbeat cadence so the rail
    // tracks live intake without piling up requests.
    const intervalId = window.setInterval(load, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <aside className="map-activity-rail" aria-label="Recent live intake">
      <header className="map-activity-rail__head">
        <span className="map-activity-rail__kicker">Now · live intake</span>
        <span className="map-activity-rail__count">{items.length} fresh</span>
      </header>
      <ol className="map-activity-rail__list">
        {items.map((entry) => {
          const freshness = freshClass(entry.messageDate);
          return (
            <li
              key={entry.id ?? `${entry.channel}-${entry.telegramMessageId}`}
              className={`map-activity-rail__item is-${freshness}`}
            >
              <div className="map-activity-rail__row">
                <span className="map-activity-rail__name" title={entry.name}>
                  {compactName(entry.name)}
                </span>
                <span className={`map-activity-rail__pill is-${freshness}`}>
                  {freshnessLabel(entry.messageDate)}
                </span>
              </div>
              <div className="map-activity-rail__meta">
                <span className="map-activity-rail__channel">
                  {entry.channel?.replace(/^@/, '') || 'unknown'}
                </span>
                {entry.city && (
                  <span className="map-activity-rail__city">{entry.city}</span>
                )}
                {entry.crossPostedOn?.length > 0 && (
                  <span className="map-activity-rail__cross">
                    cross-posted × {entry.crossPostedOn.length}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
