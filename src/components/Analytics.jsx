import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import './Analytics.css';

function Stat({ label, value, unit }) {
  return (
    <div className="an-stat">
      <span className="an-stat-val">{value}<small>{unit}</small></span>
      <span className="an-stat-label">{label}</span>
    </div>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="an-bar-row">
      <span className="an-bar-label">{label}</span>
      <div className="an-bar-track">
        <div className="an-bar-fill" style={{ width: `${pct}%`, background: color || 'var(--color-red)' }} />
      </div>
      <span className="an-bar-val">{value}</span>
    </div>
  );
}

export default function Analytics() {
  const [listings, setListings] = useState([]);
  const [msgStats, setMsgStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: companions }, { count: msgCount }, { count: photoCount }, { data: msgs }] = await Promise.all([
        supabase.from('companions').select('*'),
        supabase.from('channel_messages').select('*', { count: 'exact', head: true }),
        supabase.from('photo_archive').select('*', { count: 'exact', head: true }),
        supabase.from('channel_messages').select('message_date,message_type,channel_name,has_media').limit(5000),
      ]);
      setListings(companions || []);
      setMsgStats({ msgCount, photoCount, msgs: msgs || [] });
      setLoading(false);
    }
    load();
  }, []);

  const data = useMemo(() => {
    if (listings.length === 0 || !msgStats) return null;
    const total = listings.length;

    // Cities
    const cities = {};
    listings.forEach(l => { cities[l.city || 'Unknown'] = (cities[l.city || 'Unknown'] || 0) + 1; });
    const topCities = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Channels
    const channels = {};
    listings.forEach(l => { channels[l.source_channel || 'unknown'] = (channels[l.source_channel || 'unknown'] || 0) + 1; });
    const topChannels = Object.entries(channels).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Data completeness
    const withPhone = listings.filter(l => l.phone).length;
    const withHours = listings.filter(l => l.hours).length;
    const withLine = listings.filter(l => l.line_url).length;
    const withMaps = listings.filter(l => l.maps_url).length;
    const withPhoto = listings.filter(l => l.image_url && !l.image_url.startsWith('/mockups/')).length;

    // Operating hours
    const closingHours = {};
    listings.filter(l => l.hours).forEach(l => {
      const m = l.hours.match(/[-–]\s*(\d{1,2})/);
      if (m) { const h = parseInt(m[1]); closingHours[h] = (closingHours[h] || 0) + 1; }
    });
    const lateNight = listings.filter(l => {
      if (!l.hours) return false;
      const m = l.hours.match(/[-–]\s*(\d{1,2})/);
      if (!m) return false;
      const h = parseInt(m[1]);
      return h >= 23 || h <= 3;
    }).length;

    // Most mentioned
    const topMentioned = listings.filter(l => (l.mention_count || 0) > 1)
      .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0)).slice(0, 8);

    // Message-level: posting hours (Bangkok time)
    const postingHours = {};
    const postingDays = [0, 0, 0, 0, 0, 0, 0];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const msgTypes = {};
    (msgStats.msgs || []).forEach(m => {
      if (!m.message_date) return;
      const d = new Date(m.message_date);
      if (isNaN(d.getTime())) return;
      const bkkHour = (d.getUTCHours() + 7) % 24;
      postingHours[bkkHour] = (postingHours[bkkHour] || 0) + 1;
      postingDays[d.getDay()]++;
      msgTypes[m.message_type] = (msgTypes[m.message_type] || 0) + 1;
    });

    return {
      total, cities: topCities, channels: topChannels,
      withPhone, withHours, withLine, withMaps, withPhoto,
      closingHours, lateNight, topMentioned,
      postingHours, postingDays, dayLabels, msgTypes,
      msgCount: msgStats.msgCount, photoCount: msgStats.photoCount,
    };
  }, [listings, msgStats]);

  if (loading) {
    return (
      <div className="an-page">
        <div className="an-loading">Loading industry data...</div>
      </div>
    );
  }

  if (!data) return null;

  const maxCity = data.cities[0]?.[1] || 1;
  const maxChannel = data.channels[0]?.[1] || 1;
  const maxPostHour = Math.max(...Object.values(data.postingHours), 1);
  const maxPostDay = Math.max(...data.postingDays, 1);

  return (
    <div className="an-page">
      <header className="an-header">
        <a href="/" className="an-back">Back to Directory</a>
        <span className="an-badge">Industry Intelligence</span>
      </header>

      <div className="an-hero">
        <h1>Thailand Massage<br />& Spa Industry</h1>
        <p>Real-time market intelligence from {data.total} businesses across {data.cities.length}+ cities. Data collected from {Object.keys(data.channels).length} Telegram community channels.</p>
      </div>

      {/* Overview stats */}
      <section className="an-stats-grid">
        <Stat label="Active Businesses" value={data.total} />
        <Stat label="Messages Archived" value={data.msgCount?.toLocaleString()} />
        <Stat label="Photos Collected" value={data.photoCount?.toLocaleString()} />
        <Stat label="Late-Night Venues" value={data.lateNight} unit={`/${data.withHours}`} />
      </section>

      <div className="an-grid">
        {/* Geographic Coverage */}
        <section className="an-card">
          <h2>Geographic Coverage</h2>
          <div className="an-bars">
            {data.cities.map(([city, count]) => (
              <Bar key={city} label={city} value={count} max={maxCity} />
            ))}
          </div>
        </section>

        {/* Source Channels */}
        <section className="an-card">
          <h2>Source Channel Mix</h2>
          <div className="an-bars">
            {data.channels.map(([ch, count]) => (
              <Bar key={ch} label={ch.replace('@', '').slice(0, 20)} value={count} max={maxChannel} color="var(--color-gold)" />
            ))}
          </div>
        </section>

        {/* Data Completeness */}
        <section className="an-card">
          <h2>Data Completeness</h2>
          <div className="an-bars">
            <Bar label="Photos" value={Math.round(data.withPhoto / data.total * 100)} max={100} unit="%" color="var(--color-success)" />
            <Bar label="Phone" value={Math.round(data.withPhone / data.total * 100)} max={100} color="var(--color-success)" />
            <Bar label="LINE" value={Math.round(data.withLine / data.total * 100)} max={100} color="var(--color-gold)" />
            <Bar label="Maps" value={Math.round(data.withMaps / data.total * 100)} max={100} color="var(--color-gold)" />
            <Bar label="Hours" value={Math.round(data.withHours / data.total * 100)} max={100} color="var(--color-cream-muted)" />
          </div>
        </section>

        {/* Peak Advertising Hours */}
        <section className="an-card">
          <h2>Peak Advertising Hours</h2>
          <p className="an-card-sub">Bangkok time. Most businesses post between 14:00-16:00.</p>
          <div className="an-hour-chart">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="an-hour-bar">
                <div className="an-hour-fill" style={{ height: `${(data.postingHours[h] || 0) / maxPostHour * 100}%` }} />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Day of Week */}
        <section className="an-card">
          <h2>Weekly Posting Rhythm</h2>
          <div className="an-hour-chart an-day-chart">
            {data.postingDays.map((count, i) => (
              <div key={i} className="an-hour-bar">
                <div className="an-hour-fill an-day-fill" style={{ height: `${count / maxPostDay * 100}%` }} />
                <span>{data.dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Message Types */}
        <section className="an-card">
          <h2>Message Classification</h2>
          <p className="an-card-sub">AI auto-classifies every Telegram message.</p>
          <div className="an-bars">
            {Object.entries(data.msgTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <Bar key={type} label={type} value={count} max={Object.values(data.msgTypes).sort((a, b) => b - a)[0]} color={
                type === 'listing' ? 'var(--color-red)' :
                type === 'feedback' ? 'var(--color-success)' :
                type === 'discussion' ? 'var(--color-gold)' :
                'var(--color-cream-muted)'
              } />
            ))}
          </div>
        </section>

        {/* Most Active Advertisers */}
        <section className="an-card an-wide">
          <h2>Most Active Advertisers</h2>
          <p className="an-card-sub">Businesses ranked by advertising frequency (mention count from Telegram channels).</p>
          <div className="an-table">
            <div className="an-table-head">
              <span>Business</span><span>City</span><span>Phone</span><span>Mentions</span>
            </div>
            {data.topMentioned.map(l => (
              <div key={l.id} className="an-table-row">
                <span>{l.name?.slice(0, 30)}</span>
                <span>{l.city || '-'}</span>
                <span>{l.phone || '-'}</span>
                <strong>{l.mention_count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="an-footer">
        <p>Data collected by Sabai Sabai AI pipeline. Updated in real time.</p>
        <a href="/">Back to Directory</a>
      </footer>
    </div>
  );
}
