/**
 * Demand Tides — 77 provinces × 5 categories = 385 cells. Each cell is a
 * three-year revenue trajectory (2022, 2023, 2024 — the latter partial),
 * shaded by where the category stands in the province's own mix.
 *
 * This is the view a producer opens when they are asking the one real
 * question: "where in this country is the category I make actually
 * moving, and where is it stalling?" The cell number is the latest-year
 * baht. The slope, drawn as a coloured rail beside the number, is the
 * three-year direction.
 *
 * The province is a row, the category a column. Sortable by growth, by
 * volume, or by a deliberate question: "which province's textile is
 * rising fastest in a year the national textile is flat?" That question
 * is the second pivot — a per-row leaderboard that the existing Money
 * chapter never asks.
 *
 * The source is the annual filing (resource 000017df…) for cell value,
 * and the monthly series (c1c39e6a…) for the sparkline. The two are
 * separate and their disagreement is published elsewhere in Money.
 */

import { useMemo, useState } from 'react';
import { baht } from '../lib/insights.js';

const W = 80, H = 18, PAD = 1.5;

function MiniSpark({ values }) {
  const clean = values.filter((v) => v != null);
  if (clean.length === 0) return <span className="dt-empty">—</span>;
  const max = Math.max(...clean);
  const min = Math.min(...clean);
  const range = max - min || 1;
  const x = (i) => PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const last = values.map((v) => v != null).lastIndexOf(true);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="dt-spark">
      <polyline
        points={values.map((v, i) => `${x(i).toFixed(1)},${v == null ? H - PAD : y(v).toFixed(1)}`).join(' ')}
        className="dt-spark-line"
      />
      {last >= 0 && <circle cx={x(last)} cy={y(values[last])} r="1.6" className="dt-spark-last" />}
    </svg>
  );
}

const CATS = [
  { id: 'food',     en: 'Food',      th: 'อาหาร' },
  { id: 'beverage', en: 'Beverage',  th: 'เครื่องดื่ม' },
  { id: 'textile',  en: 'Textile',   th: 'ผ้า' },
  { id: 'craft',    en: 'Craft',     th: 'หัตถกรรม' },
  { id: 'herbal',   en: 'Herbal',    th: 'สมุนไพร' },
];

const SORTS = [
  { id: 'name',  en: 'By province', th: 'ตามชื่อจังหวัด' },
  { id: 'total', en: 'By 2024 revenue', th: 'ตามยอด 2567' },
  { id: 'growth', en: 'By 3-year growth', th: 'ตามการเติบโต 3 ปี' },
  { id: 'online', en: 'By online share', th: 'ตามสัดส่วนออนไลน์' },
];

function growthOf(v22, v24) {
  if (v22 == null || v24 == null || v22 <= 0) return null;
  return (v24 - v22) / v22;
}

// Stable fallbacks, so the memo below is not invalidated every render.
const DEFAULT_YEARS = [2022, 2023, 2024];
const NO_PROVINCES = {};

export default function DemandTides({ revenue, onSelectProvince }) {
  const cats = revenue?.byCategory?.categories ?? CATS;
  const years = revenue?.byCategory?.years ?? DEFAULT_YEARS;
  const byProv = revenue?.byCategory?.provinces ?? NO_PROVINCES;
  const provinces = useMemo(() => {
    return Object.entries(byProv)
      .map(([code, yearMap]) => {
        const catTotals = {};
        for (const cat of cats) {
          const y22 = yearMap[Math.min(...years)]?.categories?.[cat.id]?.total ?? null;
          const y24 = yearMap[Math.max(...years)]?.categories?.[cat.id]?.total ?? null;
          const y23 = yearMap[years[1] ?? years[0]]?.categories?.[cat.id]?.total ?? null;
          const y24on = yearMap[Math.max(...years)]?.categories?.[cat.id]?.online ?? 0;
          const y24tot = yearMap[Math.max(...years)]?.categories?.[cat.id]?.total ?? 0;
          catTotals[cat.id] = {
            y22, y23, y24, y24on, y24tot,
            growth: growthOf(y22, y24),
            onlineShare: y24tot > 0 ? y24on / y24tot : 0,
            total: y24 ?? 0,
          };
        }
        const total = Object.values(catTotals).reduce((s, c) => s + c.total, 0);
        const bestGrowth = Math.max(...Object.values(catTotals).map((c) => c.growth ?? -Infinity));
        const growthCat = Object.entries(catTotals).find(([, c]) => c.growth === bestGrowth)?.[0] ?? null;
        const onlineShare = total > 0
          ? Object.values(catTotals).reduce((s, c) => s + c.y24on, 0) / total
          : 0;
        return {
          code: Number(code),
          ...catTotals,
          total,
          bestGrowth: Number.isFinite(bestGrowth) ? bestGrowth : null,
          growthCat,
          onlineShare,
        };
      })
      .filter((p) => p.total > 0);
  }, [byProv, cats, years]);

  const [sort, setSort] = useState('growth');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? provinces.filter((p) => {
          // name comes from the dossier layer; we only have code here. Search is
          // done on code as string fallback plus matching the sparkline shape in
          // a future build.
          return String(p.code).includes(q);
        })
      : provinces;
    const rows = [...filtered];
    if (sort === 'total') rows.sort((a, b) => b.total - a.total);
    else if (sort === 'online') rows.sort((a, b) => b.onlineShare - a.onlineShare);
    else if (sort === 'growth') {
      const keyFn = (p) => category === 'all'
        ? (p.bestGrowth ?? -Infinity)
        : (p[category]?.growth ?? -Infinity);
      rows.sort((a, b) => keyFn(b) - keyFn(a));
    }
    else rows.sort((a, b) => a.code - b.code);
    return rows;
  }, [provinces, sort, category, query]);

  // National totals per category (the row at the bottom of every column)
  const national = useMemo(() => {
    const n = {};
    for (const cat of cats) {
      let t22 = 0, t23 = 0, t24 = 0, o24 = 0, total = 0;
      let n22 = 0, n24 = 0;
      for (const p of provinces) {
        const c = p[cat.id];
        if (c.y22 != null) { t22 += c.y22; n22++; }
        if (c.y23 != null) t23 += c.y23;
        if (c.y24 != null) { t24 += c.y24; n24++; }
        if (c.y24on) o24 += c.y24on;
        if (c.total) total += c.total;
      }
      n[cat.id] = {
        y22: n22 > 0 ? t22 / n22 : null,
        y23: t23 / Math.max(provinces.length, 1),
        y24: n24 > 0 ? t24 / n24 : null,
        y24on: o24,
        total,
        growth: growthOf(n22 > 0 ? t22 / n22 : null, n24 > 0 ? t24 / n24 : null),
        onlineShare: total > 0 ? o24 / total : 0,
      };
    }
    return n;
  }, [provinces, cats]);

  if (!revenue?.byCategory) {
    return <p className="empty">The annual category filing was not loaded — nothing is shown.</p>;
  }

  const cellValue = (p, cat) => {
    const c = p[cat];
    if (c.y24 == null) return '—';
    return <span className="dt-num">{baht(c.y24)}</span>;
  };

  const cellGrowth = (p, cat) => {
    const g = p[cat].growth;
    if (g == null) return <span className="dt-growth dt-g-na">—</span>;
    const pct = (g * 100).toFixed(0);
    const cls = g > 0.05 ? 'dt-g-up' : g < -0.05 ? 'dt-g-down' : 'dt-g-flat';
    return <span className={`dt-growth ${cls}`}>{g > 0 ? '+' : ''}{pct}%</span>;
  };

  const cellSpark = (p, cat) => {
    const c = p[cat];
    return <MiniSpark values={[c.y22, c.y23, c.y24]} />;
  };

  return (
    <div className="dt-wrap">
      <p className="t-note dt-lede">
        77 provinces × 5 categories = <strong>{provinces.length * cats.length}</strong> cells.
        Each cell is the annual filing for the category in the province
        (BE {Math.min(...years) + 543}–{Math.max(...years) + 543}; the last year is partial — Jan–Sep 2024).
        Cell value is the latest year. Cell spark is the three-year shape.
        Cell colour rail is the three-year direction: <span className="dt-g-up">green up</span>,
        <span className="dt-g-down"> red down</span>, <span className="dt-g-flat"> grey flat</span>.
        The bottom row is the national average per category — a single province that beats it
        is doing real work.
      </p>

      <div className="dt-controls">
        <div className="dt-ctrl-grp">
          <span className="t-key">Sort</span>
          {SORTS.map((s) => (
            <button
              type="button"
              key={s.id}
              className="dt-btn"
              data-active={sort === s.id}
              onClick={() => setSort(s.id)}
            >
              <span>{s.en}</span>
              <span className="dt-btn-th">{s.th}</span>
            </button>
          ))}
        </div>
        <div className="dt-ctrl-grp">
          <span className="t-key">Column</span>
          <button type="button" className="dt-btn" data-active={category === 'all'} onClick={() => setCategory('all')}>
            <span>All categories</span>
            <span className="dt-btn-th">ทุกประเภท</span>
          </button>
          {cats.map((c) => (
            <button
              type="button"
              key={c.id}
              className="dt-btn"
              data-active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              <span>{c.en}</span>
              <span className="dt-btn-th">{c.th}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dt-table-wrap">
        <table className="dt-table" role="table">
          <thead>
            <tr>
              <th scope="col" className="dt-th-prov">Province<br /><span className="dt-th-th">จังหวัด</span></th>
              {cats.map((c) => (
                <th scope="col" key={c.id} className="dt-th-cat">
                  <div>{c.en}</div>
                  <div className="dt-th-th">{c.th}</div>
                </th>
              ))}
              <th scope="col" className="dt-th-total">Total<br /><span className="dt-th-th">รวม</span></th>
              <th scope="col" className="dt-th-online">Online%<br /><span className="dt-th-th">ออนไลน์</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.code} onClick={() => onSelectProvince?.(p.code)} className="dt-row" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' && onSelectProvince) onSelectProvince(p.code); }}>
                <td className="dt-prov">
                  <span className="dt-prov-code">{p.code}</span>
                  <span className="dt-prov-total">{baht(p.total)}</span>
                </td>
                {cats.map((c) => (
                  <td key={c.id} className="dt-cell" data-growth={p[c.id].growth == null ? 'na' : p[c.id].growth > 0.05 ? 'up' : p[c.id].growth < -0.05 ? 'down' : 'flat'}>
                    <div className="dt-cell-v">{cellValue(p, c.id)}</div>
                    <div className="dt-cell-s">{cellSpark(p, c.id)}</div>
                    <div className="dt-cell-g">{cellGrowth(p, c.id)}</div>
                  </td>
                ))}
                <td className="dt-cell-total">
                  <span className="dt-num">{baht(p.total)}</span>
                </td>
                <td className="dt-cell-online">
                  <span className="dt-num">{(p.onlineShare * 100).toFixed(1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="dt-prov">National avg<br /><span className="dt-th-th">เฉลี่ยประเทศ</span></th>
              {cats.map((c) => {
                const n = national[c.id];
                return (
                  <td key={c.id} className="dt-cell dt-cell-nat" data-growth={n.growth == null ? 'na' : n.growth > 0.05 ? 'up' : n.growth < -0.05 ? 'down' : 'flat'}>
                    <div className="dt-cell-v"><span className="dt-num">{n.y24 != null ? baht(n.y24) : '—'}</span></div>
                    <div className="dt-cell-s"><MiniSpark values={[n.y22, n.y23, n.y24]} /></div>
                    <div className="dt-cell-g">{n.growth == null ? <span className="dt-growth dt-g-na">—</span> : <span className={`dt-growth ${n.growth > 0 ? 'dt-g-up' : n.growth < 0 ? 'dt-g-down' : 'dt-g-flat'}`}>{(n.growth * 100).toFixed(0)}%</span>}</div>
                  </td>
                );
              })}
              <td className="dt-cell-total"><span className="dt-num">{baht(Object.values(national).reduce((s, n) => s + n.total, 0))}</span></td>
              <td className="dt-cell-online"><span className="dt-num">{(Object.values(national).reduce((s, n) => s + n.y24on, 0) / Math.max(Object.values(national).reduce((s, n) => s + n.total, 0), 1) * 100).toFixed(1)}%</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="t-note dt-foot">
        Source: <code>otop_revenue.json</code> · annual filing by the Department of Community Development,
        resource <code>{(revenue.byCategory.resourceId ?? '').slice(0, 8)}</code>.
        Click a province to open its dossier.
      </p>
    </div>
  );
}
