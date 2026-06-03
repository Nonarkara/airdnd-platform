import { useEffect, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import VisitorChart from './VisitorChart';
import DeviceBreakdown from './DeviceBreakdown';
import TopPages from './TopPages';
import LocationList from './LocationList';
import PopularListings from './PopularListings';
import SessionStats from './SessionStats';
import './AdminDashboard.css';

const RANGE_OPTIONS = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export default function AdminDashboard() {
  const [range, setRange] = useState(7);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    supabase
      .from('page_views')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(10000)
      .then(({ data, error }) => {
        if (!cancelled) {
          setEvents(error ? [] : data || []);
        }
      });

    return () => { cancelled = true; };
  }, [range]);

  const safeEvents = events || [];
  const loading = events === null;
  const pageviews = safeEvents.filter(e => e.event_type === 'pageview');
  const clicks = safeEvents.filter(e => e.event_type === 'listing_click');
  const sessions = [...new Set(safeEvents.map(e => e.session_id))];

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1>Sabai Admin</h1>
          <p className="admin-subtitle">
            {sessions.length} sessions &middot; {pageviews.length} page views &middot; {clicks.length} listing clicks
          </p>
        </div>
        <div className="admin-controls">
          <div className="range-picker">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                className={`range-btn ${range === opt.days ? 'active' : ''}`}
                onClick={() => {
                  setEvents(null);
                  setRange(opt.days);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button className="admin-back" onClick={() => window.location.href = '/'}>
            Back to site
          </button>
        </div>
      </header>

      {loading ? (
        <div className="admin-loading">Loading analytics...</div>
      ) : events.length === 0 ? (
        <div className="admin-empty">No tracking data yet. Visit the site to start collecting.</div>
      ) : (
        <div className="admin-grid">
          <div className="admin-card wide">
            <h3>Visitors Over Time</h3>
            <VisitorChart events={events} />
          </div>
          <div className="admin-card">
            <h3>Devices</h3>
            <DeviceBreakdown events={events} />
          </div>
          <div className="admin-card">
            <h3>Session Stats</h3>
            <SessionStats events={events} />
          </div>
          <div className="admin-card">
            <h3>Top Pages</h3>
            <TopPages events={pageviews} />
          </div>
          <div className="admin-card">
            <h3>Locations</h3>
            <LocationList events={events} />
          </div>
          <div className="admin-card wide">
            <h3>Popular Listings</h3>
            <PopularListings events={clicks} />
          </div>
        </div>
      )}
    </div>
  );
}
