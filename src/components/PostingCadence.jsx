import { useEffect, useState } from 'react';
import { formatSourceChannelName } from '../lib/listings';
import './PostingCadence.css';

const DAYS_SHOWN = 14;

function lastDays(today, n) {
  const out = [];
  const base = new Date(`${today}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i -= 1) {
    out.push(new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function PostingCadence({ t }) {
  const [stats, setStats] = useState(null);
  const c = t.cadence;

  useEffect(() => {
    let alive = true;
    fetch('/data/posting-stats.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setStats(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!stats || !c) return null;

  const days = lastDays(stats.today, DAYS_SHOWN);
  const perDay = new Map(days.map((d) => [d, 0]));
  for (const row of stats.dailyNewListings || []) {
    if (perDay.has(row.date)) perDay.set(row.date, perDay.get(row.date) + row.count);
  }
  const max = Math.max(1, ...perDay.values());
  const top = (stats.parlours || []).slice(0, 8);
  const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '—');

  return (
    <section className="posting-cadence" aria-label={c.title}>
      <header className="posting-cadence-head">
        <span className="section-kicker">{c.kicker}</span>
        <h2>{c.title}</h2>
        <p className="section-subtitle">{c.subtitle}</p>
      </header>

      <div className="posting-cadence-grid">
        <div className="posting-cadence-today">
          <strong>{stats.todayNew}</strong>
          <span>{c.today}</span>
        </div>

        <figure className="posting-cadence-bars" aria-label={c.dailyLabel}>
          <div className="posting-cadence-bar-row">
            {days.map((d) => (
              <div key={d} className="posting-cadence-bar" title={`${d}: ${perDay.get(d)}`}>
                <span style={{ height: `${(perDay.get(d) / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <figcaption>{c.dailyLabel}</figcaption>
        </figure>
      </div>

      <table className="posting-cadence-table">
        <caption>{c.topLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{c.colName}</th>
            <th scope="col">{c.colChannel}</th>
            <th scope="col">{c.colPosts}</th>
            <th scope="col">{c.colPerWeek}</th>
            <th scope="col">{c.colFirst}</th>
            <th scope="col">{c.colLast}</th>
          </tr>
        </thead>
        <tbody>
          {top.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{formatSourceChannelName(p.channel) || p.channel}</td>
              <td>{p.posts}</td>
              <td>{p.postsPerWeek}</td>
              <td>{fmtDate(p.firstSeen)}</td>
              <td>{fmtDate(p.lastSeen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="posting-cadence-note">{c.note}</p>
    </section>
  );
}

export default PostingCadence;
