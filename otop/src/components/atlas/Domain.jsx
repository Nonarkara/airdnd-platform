import { useMemo, useState } from 'react';
import { Chapter } from './fmt.jsx';
import { n, pct } from './format.js';
import Composition from './Composition.jsx';
import { categoryParts } from './categoryParts.js';

/** What is made where? Leads with the heatmap; everything else sits below it. */
export default function Domain({ national, byRegion, byProvince = [], regionIdentity, matrix, byYear, specialization, qualityLeaders, topBasins, go }) {
  const unclassified = national.categories?.find((c) => c.id === 'unclassified');
  const classifiedCount = national.records - (unclassified?.count ?? 0);
  const href = (code) => `/province/${code}/`;
  const catOptions = (matrix?.categories?.length ? matrix.categories : (national.categories || []).filter((c) => c.id !== 'unclassified'));
  const [exploreCat, setExploreCat] = useState(catOptions[0]?.id ?? 'textile');

  const categoryLeague = useMemo(() => {
    if (!exploreCat || !byProvince.length) return [];
    return byProvince
      .map((p) => {
        const cell = (p.categories || []).find((c) => c.id === exploreCat);
        return {
          code: p.code,
          th: p.th,
          en: p.en,
          count: cell?.count ?? 0,
          share: cell?.share ?? 0,
          records: p.records,
        };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || b.share - a.share);
  }, [byProvince, exploreCat]);

  const exploreLabel = catOptions.find((c) => c.id === exploreCat);

  return (
    <Chapter id="domain" title="Domain" th="ผลิตภัณฑ์">
      {/* ── Category × geography explorer (all 77) ──────────────────────── */}
      {byProvince.length > 0 && catOptions.length > 0 && (
        <>
          <h3 className="sub-h">Category explorer · เปรียบเทียบข้ามจังหวัด</h3>
          <p className="t-note">
            Pick a product category and rank all provinces that carry it. Counts are registry
            tallies (declared + inferred), not production volume. The heatmap below still shows
            the densest {matrix?.rows?.length ?? 25} provinces × five categories.
          </p>
          <div className="cat-explore-tabs" role="tablist" aria-label="Category explorer">
            {catOptions.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                className="cat-explore-tab"
                aria-selected={exploreCat === c.id}
                data-active={exploreCat === c.id ? '1' : '0'}
                onClick={() => setExploreCat(c.id)}
              >
                <span>{c.en}</span>
                <span className="cat-explore-th">{c.th}</span>
              </button>
            ))}
          </div>
          {exploreLabel && (
            <p className="t-note">
              <strong>{exploreLabel.en}</strong> · {exploreLabel.th}
              {exploreLabel.total != null ? ` · national ${n(exploreLabel.total)} classified records` : ''}
              {' · '}{categoryLeague.length} provinces with at least one record
            </p>
          )}
          <div className="t-grid" role="table" aria-label={`Provinces ranked by ${exploreCat}`}>
            <div className="t-grid-row t-grid-hd" role="row">
              <span>#</span>
              <span>Province</span>
              <span className="t-row-num">Records</span>
              <span className="t-row-num">Share of province</span>
            </div>
            {categoryLeague.slice(0, 15).map((r, i) => (
              <div className="t-grid-row" role="row" key={r.code}>
                <span>{i + 1}</span>
                <a href={href(r.code)} onClick={(e) => { e.preventDefault(); go(r.code); }}>
                  <span className="t-row-th">{r.th}</span>
                  <span className="t-row-en"> · {r.en}</span>
                </a>
                <span className="t-row-num">{n(r.count)}</span>
                <span className="t-row-num">{r.share}%</span>
              </div>
            ))}
          </div>
          {categoryLeague.length > 15 && (
            <details className="t-more">
              <summary>All {categoryLeague.length} provinces in {exploreLabel?.en ?? exploreCat}</summary>
              <div className="t-grid" role="table">
                {categoryLeague.slice(15).map((r, i) => (
                  <div className="t-grid-row" role="row" key={r.code}>
                    <span>{i + 16}</span>
                    <a href={href(r.code)} onClick={(e) => { e.preventDefault(); go(r.code); }}>
                      <span className="t-row-th">{r.th}</span>
                      <span className="t-row-en"> · {r.en}</span>
                    </a>
                    <span className="t-row-num">{n(r.count)}</span>
                    <span className="t-row-num">{r.share}%</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* ── HEATMAP — provinces × categories ────────────────────────────── */}
      {matrix && matrix.rows.length > 0 && matrix.categories.length > 0 && (
        <>
          <p className="t-note">
            The {matrix.rows.length} most-classified provinces × the five categories. Cell shading is the cell's share of the column (category) total — the eye lands on the
            cells that are darker than their row, i.e. the categories a province is actually
            <em> disproportionate </em> in. Counts are absolute; click a province name to open it.
          </p>
          <div className="t-matrix-wrap">
            <div className="t-matrix" role="table" aria-label="Province by category matrix">
              <div className="t-matrix-row t-matrix-hd" role="row">
                <span className="t-matrix-th-province" role="columnheader">Province · จังหวัด</span>
                <span className="t-matrix-th-total" role="columnheader">Total</span>
                {matrix.categories.map((c) => (
                  <span className="t-matrix-th-cat" role="columnheader" key={c.id} title={c.en}>
                    {c.en.split(' ')[0]}
                  </span>
                ))}
              </div>
              {matrix.rows.map((r) => {
                const maxShare = Math.max(0.1, ...Object.values(r.cells).map((c) => c.share));
                return (
                  <div className="t-matrix-row" role="row" key={r.code}>
                    <a className="t-matrix-province" role="cell" href={href(r.code)}>
                      <span className="t-row-th">{r.th}</span>
                      <span className="t-row-en">{r.en}</span>
                    </a>
                    <span className="t-matrix-total" role="cell">{n(r.rowTotal)}</span>
                    {matrix.categories.map((c) => {
                      const cell = r.cells[c.id] ?? { count: 0, share: 0 };
                      const opacity = cell.count > 0 ? 0.08 + 0.92 * (cell.share / maxShare) : 0;
                      return (
                        <span
                          className="t-matrix-cell"
                          role="cell"
                          key={c.id}
                          style={cell.count > 0 ? {
                            background: `rgba(245, 158, 11, ${opacity.toFixed(3)})`,
                            color: opacity > 0.5 ? '#0a0a0a' : 'inherit',
                          } : undefined}
                          title={`${r.th} · ${c.en} · ${cell.count} records (${cell.share}% of category)`}
                        >
                          {cell.count > 0 ? cell.count : ''}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="t-note">
            <strong>Lamphun</strong> is 79% textile (silk weaving tradition).{' '}
            <strong>Nonthaburi</strong> is 14% herbal — both genuine specializations. The dominance
            of the first column on the top row is the central registry's noise: Kalasin's 1,609
            textile records are largely the keyword classifier catching baskets and bags.
          </p>
        </>
      )}

      {/* ── composition ───────────────────────────────────────────────── */}
      <h3 className="sub-h">Product domain · what the registry says these {n(national.records)} records are</h3>
      <Composition parts={categoryParts(national)} total={national.records} />
      <p className="t-note">
        Ground is unclassified. Note that the category buckets and the completeness meter in the Record chapter
        disagree by roughly 3,400 records — the buckets count anything with a category value,
        the meter counts only records whose category was <em>declared</em> by the source.
      </p>

      <h3 className="sub-h">By region · ภูมิภาค</h3>
      <div className="t-ranked">
        {byRegion.map((r) => (
          <div key={r.id}>
            <div className="t-ranked-row">
              <span><strong>{r.th}</strong> <span className="t-row-en">{r.en}</span></span>
              <span className="t-row-num">{n(r.records)} · {r.share}%</span>
            </div>
            <Composition parts={categoryParts(r)} total={r.records} />
          </div>
        ))}
      </div>

      {/* ── REGION IDENTITY ────────────────────────────────────────────── */}
      {regionIdentity.length > 0 && (
        <>
          <h3 className="sub-h">Region identity · อัตลักษณ์ภูมิภาค</h3>
          <p className="t-note">
            Shares are of <em>classified records only</em> — and only {n(classifiedCount)} of {n(national.records)} records
            carry any category at all. Read each card as "of what this region bothered to
            describe, this is what it describes": a buyer who needs woven fabric starts in
            the North/Isaan; processed food concentrates in the West and South.
          </p>
          <div className="t-region-id">
            {regionIdentity.map((r) => (
              <div key={r.id} className="t-region-card">
                <div className="t-region-card-h">
                  <span className="t-row-th">{r.th}</span>
                  <span className="t-row-en">{r.en}</span>
                </div>
                <div className="t-region-card-body">
                  <span className="t-key">{r.dominantLabel} · of classified</span>
                  <span className="t-region-card-share">{r.dominantShare}%</span>
                  <span className="t-ctx">{n(r.classified)} classified of {n(r.records)} ({r.classifiedPct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── SPECIALIZATION ─────────────────────────────────────────────── */}
      {specialization.length > 0 && (
        <>
          <h3 className="sub-h">Specialization · top province in each category</h3>
          <p className="t-note">A category becomes a real sourcing signal only when a province concentrates it. These are the places to call first if you need that product.</p>
          <div className="t-spec-grid">
            {specialization.map((s) => (
              <div key={s.id} className="t-spec">
                <div className="t-spec-h">
                  <span className="t-key">{s.en}</span>
                  <span className="t-spec-th">{s.th}</span>
                </div>
                {s.leaders.map((l, i) => (
                  <div key={l.code} className="t-spec-row">
                    <span className="t-spec-rank">{i + 1}</span>
                    <a className="t-spec-name" href={href(l.code)}>
                      <span className="t-row-th">{l.th}</span>
                      <span className="t-row-en">{l.en}</span>
                    </a>
                    <span className="t-row-num">{n(l.count)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── QUALITY LEADERS ────────────────────────────────────────────── */}
      {qualityLeaders.length > 0 && (
        <>
          <h3 className="sub-h">Where the graded supply is · top 10 by OPC star count</h3>
          <p className="t-note">Both the producer and the state have signed off on these. This is the most defensible shortlist the registry offers.</p>
          <div className="t-rows" id="quality-leaders">
            <div className="t-row t-row-hd">
              <span className="t-rail" />
              <span>Province · จังหวัด</span>
              <span className="t-row-num">Graded</span>
              <span className="t-hide-sm t-row-num">At 4-5★</span>
              <span className="t-hide-sm t-row-num">Density</span>
            </div>
            {qualityLeaders.map((p) => (
              <button type="button" className="t-row" key={p.code} onClick={() => go(p.code)}>
                <span className="t-rail" />
                <span>
                  <span className="t-row-th">{p.th}</span><br />
                  <span className="t-row-en">{p.en}</span>
                </span>
                <span className="t-row-num">{n(p.graded)}</span>
                <span className="t-hide-sm t-row-num">{n(p.graded45)}</span>
                <span className="t-hide-sm t-row-num">{p.density}%</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── DEEP PRODUCTION BASINS (TAMBON LEVEL) ────────────────────────── */}
      {topBasins && (topBasins.byRecords?.length > 0 || topBasins.byChampions?.length > 0) && (
        <>
          <h3 className="sub-h" id="basins">
            Production basins · แหล่งผลิตระดับตำบล (Subdistrict Epicenters)
          </h3>
          <p className="t-note">
            135,100 records (87.7%) are geocoded to exact subdistrict centroids across 7,383 tambons.
            Real craft production does not spread uniformly across provinces: it clusters into historic village basins.
            Below are Thailand's top artisanal basins ranked by producer density and certified champions.
          </p>
          <div className="t-rows" id="subdistrict-basins">
            <div className="t-row t-row-hd">
              <span className="t-rail" />
              <span>Subdistrict · ตำบล / อำเภอ</span>
              <span className="t-row-num">Records</span>
              <span className="t-hide-sm t-row-num">Reachable</span>
              <span className="t-hide-sm t-row-num">4-5★ Champions</span>
            </div>
            {(topBasins.byChampions?.slice(0, 8) ?? []).concat(topBasins.byReachable?.slice(0, 4) ?? []).map((t) => (
              <button type="button" className="t-row" key={t.code} onClick={() => go(t.provinceCode)}>
                <span className="t-rail" />
                <span>
                  <strong className="t-row-th">ต.{t.th}</strong> <span className="t-row-en">({t.en})</span><br />
                  <span className="t-ctx">อ.{t.districtTh} · จ.รหัส {t.provinceCode}</span>
                </span>
                <span className="t-row-num">{n(t.records)}</span>
                <span className="t-hide-sm t-row-num">{t.reachable > 0 ? n(t.reachable) : '—'}</span>
                <span className="t-hide-sm t-row-num">{t.graded4Plus > 0 ? `${t.graded4Plus}★` : '—'}</span>
              </button>
            ))}
          </div>
          <p className="t-note">
            Notice how Wiang Yong and Pa Sang (Lamphun) concentrate high-grade weaving champions with zero direct phone lines,
            while Phon (Kalasin) and Sateng (Yala) maintain highly reachable artisan networks. Click a row to explore that province.
          </p>
        </>
      )}

      {/* ── TIME SERIES — filings per year ─────────────────────────────── */}
      {byYear && byYear.total && byYear.total.length > 0 && (() => {
        const total = byYear.total;
        const maxCount = Math.max(...total.map((y) => y.count));
        const catIds = Object.keys(byYear.byCategory ?? {});
        const dated = total.reduce((s, y) => s + y.count, 0);
        // Ink steps by fixed category order — one hue, identity in the legend.
        const steps = ['#111111', '#2a2a2a', '#5c5a54', '#9a968c', '#d2cfc5'];
        const tone = (cid) => steps[catIds.indexOf(cid)] ?? '#e7e5dd';
        return (
          <>
            <h3 className="sub-h">Filings per year · {total[0].year} – {total[total.length - 1].year}</h3>
            <p className="t-note">
              Only records that carry a filing year ({n(dated)} of {n(national.records)}) are counted. The other {n(pct(national.records - dated, national.records))}%
              cannot be dated. A spike in 2024 corresponds to the year the national registry
              re-issued most OTOP certificates.
            </p>
            <div className="t-timeseries" role="img" aria-label="OTOP filings per year, stacked by category">
              {total.map((y) => (
                <div key={y.year} className="t-ts-col" title={`${y.year}: ${y.count} filings`}>
                  <div className="t-ts-stack" style={{ height: `${(y.count / maxCount) * 100}%` }}>
                    {catIds.map((cid) => {
                      const v = (byYear.byCategory[cid] ?? []).find((s) => s.year === y.year);
                      if (!v || v.count === 0) return null;
                      return <div key={cid} className="t-ts-seg" style={{ flex: v.count, background: tone(cid) }} title={`${cid} · ${v.count}`} />;
                    })}
                  </div>
                  <span className="t-ts-year">{String(y.year).slice(2)}</span>
                  <span className="t-ts-num">{y.count}</span>
                </div>
              ))}
            </div>
            <div className="t-legend t-ts-legend">
              <span className="t-key">Categories:</span>
              {catIds.map((cid) => (
                <span key={cid} className="t-ts-legend-item"><i className="t-swatch" style={{ background: tone(cid) }} />{cid}</span>
              ))}
            </div>
          </>
        );
      })()}
    </Chapter>
  );
}
