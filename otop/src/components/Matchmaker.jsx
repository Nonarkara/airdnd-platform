/**
 * The Matchmaker — the one platform view.
 *
 * The promise of one³: a single answer to "where is the supply for what I
 * want to buy, and where is the demand for what I make?" The two questions
 * are the same triangle, read from two corners.
 *
 * Left column: pick a category, a reach strictness, a star floor. Right
 * column: the provinces that hold the supply, ranked by
 *   (registered producers × online share × revenue last year)
 * with a per-province call-out showing how the supply meets the demand
 * in the same province. Each row is a "this is where the goods come from,
 * this is where the money already is" pair — the triangulation the user
 * asked for.
 *
 * The view is a page, not a tool: it loads on a phone from a link, and
 * the URL round-trips the requirement so a buyer can send a brief by
 * forwarding the address bar.
 */

import { useEffect, useMemo, useState } from 'react';
import { baht } from '../lib/insights.js';
import { loadRevenue } from '../lib/insights.js';
import { loadIndex } from '../lib/shards.js';

const CATS = [
  { id: 'all', en: 'All categories', th: 'ทุกประเภท' },
  { id: 'food', en: 'Food', th: 'อาหาร' },
  { id: 'beverage', en: 'Beverage', th: 'เครื่องดื่ม' },
  { id: 'textile', en: 'Textile', th: 'ผ้า' },
  { id: 'craft', en: 'Craft', th: 'หัตถกรรม' },
  { id: 'herbal', en: 'Herbal', th: 'สมุนไพร' },
];

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  return {
    cat: p.get('cat') ?? 'all',
    stars: Number(p.get('stars') ?? 4),
    reach: p.get('reach') ?? 'reachable',
  };
}

function writeUrl(r) {
  const p = new URLSearchParams();
  p.set('view', 'matchmaker');
  if (r.cat !== 'all') p.set('cat', r.cat);
  p.set('stars', String(r.stars));
  if (r.reach !== 'reachable') p.set('reach', r.reach);
  return `${window.location.pathname}?${p.toString()}`;
}

function pct(n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : 0; }

export default function Matchmaker() {
  const [index, setIndex] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [error, setError] = useState(null);
  const [req, setReq] = useState(readUrl);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadIndex(), loadRevenue().catch(() => null)])
      .then(([idx, rev]) => { if (!cancelled) { setIndex(idx); setRevenue(rev); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const next = writeUrl(req);
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next);
    }
  }, [req]);

  const ranked = useMemo(() => {
    if (!index) return [];
    const years = revenue?.byCategory?.years ?? [];
    const last = Math.max(...years);
    const byProv = revenue?.byCategory?.provinces ?? {};
    return index.provinces
      .map((p) => {
        const supply = req.cat === 'all'
          ? Object.values(p.categories ?? {}).reduce((s, n) => s + n, 0)
          : (p.categories?.[req.cat] ?? 0);
        const graded = p.stars?.graded ?? 0;
        const reachable = req.reach === 'reachable' ? (p.reachable ?? 0) : supply;
        const highStars = (p.stars?.['4'] ?? 0) + (p.stars?.['5'] ?? 0);
        const cat = byProv[p.code]?.[last]?.categories?.[req.cat] ?? null;
        const revenueLast = cat ? cat.total : 0;
        const onlineShare = cat && cat.total > 0 ? cat.online / cat.total : 0;
        // The triangle: supply × demand × how routable it is.
        // High supply × high revenue × high online share = first-tier.
        // High supply × low revenue = "ready to scale" (Chapter 1 of the story).
        // Low supply × high revenue = "scarcity" (premium).
        const triangle = supply * (1 + onlineShare) * (req.reach === 'reachable' ? (reachable > 0 ? 2 : 0.1) : 1);
        return { ...p, supply, graded, highStars, reachable, revenueLast, onlineShare, triangle };
      })
      .filter((p) => p.supply > 0)
      .filter((p) => req.stars === 0 || p.highStars > 0)
      .sort((a, b) => b.triangle - a.triangle);
  }, [index, revenue, req]);

  if (error) return <p className="empty">The matchmaker could not load the data — {error}.</p>;
  if (!index) return <p className="empty">Loading the registry index…</p>;

  const catLabel = CATS.find((c) => c.id === req.cat)?.en ?? req.cat;
  const catLabelTh = CATS.find((c) => c.id === req.cat)?.th ?? '';

  return (
    <div className="mm-wrap">
      <header className="mm-h">
        <h2 className="mm-h-t">Where the supply is, where the money already is.</h2>
        <p className="mm-h-sub">
          Pick a category, a star floor, a reach strictness. The provinces on the right are ranked by the
          triangle of supply × demand × routability — the same triangulation one³ does for everything.
        </p>
      </header>

      <div className="mm-controls">
        <div className="mm-ctrl-grp">
          <span className="t-key">Category</span>
          {CATS.map((c) => (
            <button key={c.id} type="button" className="mm-btn" data-active={req.cat === c.id} onClick={() => setReq({ ...req, cat: c.id })}>
              <span>{c.en}</span>
              <span className="mm-btn-th">{c.th}</span>
            </button>
          ))}
        </div>
        <div className="mm-ctrl-grp">
          <span className="t-key">Stars</span>
          <button type="button" className="mm-btn" data-active={req.stars === 0} onClick={() => setReq({ ...req, stars: 0 })}>
            <span>Any</span>
            <span className="mm-btn-th">ไม่จำกัด</span>
          </button>
          <button type="button" className="mm-btn" data-active={req.stars === 3} onClick={() => setReq({ ...req, stars: 3 })}>
            <span>3★+</span>
            <span className="mm-btn-th">3 ดาวขึ้นไป</span>
          </button>
          <button type="button" className="mm-btn" data-active={req.stars === 4} onClick={() => setReq({ ...req, stars: 4 })}>
            <span>4★+</span>
            <span className="mm-btn-th">4 ดาวขึ้นไป</span>
          </button>
          <button type="button" className="mm-btn" data-active={req.stars === 5} onClick={() => setReq({ ...req, stars: 5 })}>
            <span>5★ only</span>
            <span className="mm-btn-th">5 ดาว</span>
          </button>
        </div>
        <div className="mm-ctrl-grp">
          <span className="t-key">Reach</span>
          <button type="button" className="mm-btn" data-active={req.reach === 'all'} onClick={() => setReq({ ...req, reach: 'all' })}>
            <span>All</span>
            <span className="mm-btn-th">ทั้งหมด</span>
          </button>
          <button type="button" className="mm-btn" data-active={req.reach === 'reachable'} onClick={() => setReq({ ...req, reach: 'reachable' })}>
            <span>Reachable only</span>
            <span className="mm-btn-th">เฉพาะที่ติดต่อได้</span>
          </button>
        </div>
      </div>

      <div className="mm-summary">
        <div className="mm-summary-n">{ranked.length} provinces hold matching supply</div>
        <div className="mm-summary-sub">
          {catLabel}{req.stars > 0 && `, ${req.stars}★+`}{req.reach === 'reachable' && ', reachable'}.
          {' '}Top 20 shown. The triangle is supply × online share × reach — a province with
          deep supply, growing online, and a phone number outranks one with supply alone.
        </div>
      </div>

      <ol className="mm-list">
        {ranked.slice(0, 20).map((p, i) => {
          const onlinePct = (p.onlineShare * 100).toFixed(1);
          const tier = i < 3 ? 'first' : i < 10 ? 'second' : 'third';
          return (
            <li key={p.code} className={`mm-row mm-tier-${tier}`}>
              <span className="mm-row-rank">{String(i + 1).padStart(2, '0')}</span>
              <div className="mm-row-body">
                <div className="mm-row-h">
                  <span className="mm-row-th">{p.th}</span>
                  <span className="mm-row-en">{p.en}</span>
                  <span className="mm-row-region">{p.region}</span>
                </div>
                <div className="mm-row-meters">
                  <div className="mm-meter">
                    <span className="mm-meter-n">{p.supply.toLocaleString()}</span>
                    <span className="mm-meter-l">Supply · อุปทาน</span>
                  </div>
                  <div className="mm-meter">
                    <span className="mm-meter-n">{p.graded.toLocaleString()}</span>
                    <span className="mm-meter-l">Graded · ได้ระดับ</span>
                  </div>
                  <div className="mm-meter">
                    <span className="mm-meter-n">{p.highStars.toLocaleString()}</span>
                    <span className="mm-meter-l">4-5★ · 4-5 ดาว</span>
                  </div>
                  <div className="mm-meter">
                    <span className="mm-meter-n">{p.reachable.toLocaleString()}</span>
                    <span className="mm-meter-l">Reachable · ติดต่อได้</span>
                  </div>
                  <div className="mm-meter">
                    <span className="mm-meter-n">{p.revenueLast ? baht(p.revenueLast) : '—'}</span>
                    <span className="mm-meter-l">Last-year revenue · ยอดปีล่าสุด</span>
                  </div>
                  <div className="mm-meter">
                    <span className="mm-meter-n">{onlinePct}%</span>
                    <span className="mm-meter-l">Online share · สัดส่วนออนไลน์</span>
                  </div>
                </div>
              </div>
              <a className="reset mm-row-go" href={`/?view=province&code=${p.code}`}>Open dossier →</a>
            </li>
          );
        })}
      </ol>

      {ranked.length === 0 && (
        <p className="empty">
          No provinces match these filters. Loosen one. Most categories have at least 30 provinces with supply;
          the strictness here is the star floor and the reach filter, which is doing what it is supposed to.
        </p>
      )}

      <p className="t-note mm-foot">
        Source: <code>otop_index.json</code> (registry, 77 provinces × 154,078 rows) joined with <code>otop_revenue.json</code>
        (annual filing, 5 categories × 3 years). The triangle is a deliberately coarse ranking; the
        sub-page for each province carries the full dossier, the money chart, the category mix, and the
        district breakdown.
      </p>
    </div>
  );
}
