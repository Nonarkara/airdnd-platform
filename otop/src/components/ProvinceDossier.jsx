import { useEffect, useMemo, useState } from 'react';
import Composition, { categoryParts } from './atlas/Composition.jsx';
import Sparkline from './charts/Sparkline.jsx';
import { ZONES, rankOf, loadRevenue, baht, monthlyPoints } from '../lib/insights.js';
import { loadShards } from '../lib/shards.js';
import { toCsv } from '../../core/matching.js';
import { REGION_LABEL } from '../lib/labels.js';

/**
 * One province, whole. The unit of reading the Atlas lacks: a governor, a CDD
 * officer or a buyer planning a trip wants THIS province, every layer, on a
 * phone, from a link. Every number carries its rank among 77 so a reader
 * knows whether it is large without scrolling a national table.
 *
 * Reads what is already published: the insights rollup, the revenue artefact,
 * and the province's own shard. Nothing is computed here that the build did
 * not already attest.
 */
const nf = new Intl.NumberFormat('en-US');
const n = (v) => (v == null ? '—' : nf.format(v));

function Stub({ label, value, rank, note }) {
  return (
    <div className="t-stub">
      <span className="t-key">{label}</span>
      <span className="t-stub-n">{value}</span>
      <span className="t-ctx">{rank != null ? `rank ${rank} of 77` : note ?? ''}</span>
    </div>
  );
}

export default function ProvinceDossier({ insights, code, onSelectProvince, onOpenMatch }) {
  const [records, setRecords] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [error, setError] = useState(null);

  const { byProvince, reachGap = [], national } = insights;
  const ordered = useMemo(() => [...byProvince].sort((a, b) => a.code - b.code), [byProvince]);
  const idx = ordered.findIndex((p) => p.code === code);
  const p = ordered[idx];
  const gap = reachGap.find((r) => r.code === code);

  useEffect(() => {
    let cancelled = false;
    setRecords(null); setError(null);
    loadShards([code]).then((rows) => { if (!cancelled) setRecords(rows); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    if (revenue) return;
    let cancelled = false;
    loadRevenue().then((r) => { if (!cancelled) setRevenue(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [revenue]);

  const districts = useMemo(() => {
    if (!records) return [];
    const m = new Map();
    for (const r of records) {
      const k = r.district ?? '— no district recorded';
      const d = m.get(k) ?? { district: k, records: 0, reachable: 0, graded: 0 };
      d.records += 1;
      if (r.phone || r.email || r.website) d.reachable += 1;
      if (r.stars != null) d.graded += 1;
      m.set(k, d);
    }
    return [...m.values()].sort((a, b) => b.records - a.records);
  }, [records]);

  const products = useMemo(() => {
    if (!records) return [];
    const m = new Map();
    // A bare number is a price or a code that landed in the name column, not a product.
    for (const r of records) if (r.productName && !/^[\d,.\s]+$/.test(r.productName)) m.set(r.productName, (m.get(r.productName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [records]);

  const tambonStats = useMemo(() => {
    if (!records) return { placed: 0, totalWithSubdistrict: 0, tambons: [] };
    const m = new Map();
    let placed = 0;
    let totalWithSubdistrict = 0;
    for (const r of records) {
      if (r.subdistrict) {
        totalWithSubdistrict++;
        const k = `${r.district ?? ''} · ${r.subdistrict}`;
        const t = m.get(k) ?? { name: r.subdistrict, district: r.district, records: 0, reachable: 0, graded: 0, placed: Boolean(r.tambonCode) };
        t.records += 1;
        if (r.phone || r.email || r.website) t.reachable += 1;
        if (r.stars != null) t.graded += 1;
        m.set(k, t);
      }
      if (r.tambonCode) placed++;
    }
    const tambons = [...m.values()].sort((a, b) => b.records - a.records);
    return { placed, totalWithSubdistrict, tambons };
  }, [records]);

  const incomeRecords = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => r.income != null);
  }, [records]);

  if (!p) return <p className="empty">No province with code {code}.</p>;

  const rev = revenue?.byProvince?.find((r) => r.code === code);
  const revLatest = insights.revenue?.latestFullYear;
  const revTotal = rev?.years?.[revLatest]?.total ?? null;
  const revRanked = (revenue?.byProvince ?? []).map((r) => ({ code: r.code, total: r.years?.[revLatest]?.monthsReported === 12 ? r.years[revLatest].total : null }));
  const catYears = revenue?.byCategory?.provinces?.[code] ?? null;
  const gradedRank = rankOf(byProvince.map((x) => ({ code: x.code, graded: x.stars.graded })), code, 'graded');
  const corrRank = rankOf(byProvince.map((x) => ({ code: x.code, pct: x.corroborated / Math.max(x.records, 1) })), code, 'pct');
  const productCount = records ? records.filter((r) => r.productName).length : 0;

  const exportCsv = () => {
    const blob = new Blob([toCsv(records.map((record) => ({ record, score: '' })))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `otop-${p.iso}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dossier">
      {/* ── tag face ─────────────────────────────────────────────────── */}
      <div className="t-national" data-rail="default">
        <div className="t-face">
          <p className="t-dest t-band">{p.iso}</p>
          <div className="t-face-body">
            <div>
              <span className="t-key">Province · จังหวัด</span>
              <span className="t-row-th dossier-name">{p.th}</span>
              <span className="t-row-en">{p.en} · {REGION_LABEL[p.region]}</span>
            </div>
            <div>
              <span className="t-key">Registry · ทะเบียน</span>
              <span className="t-id">{n(p.records)}</span>
            </div>
            <p className="t-ctx" style={{ margin: 0 }}>
              {insights.source} · built {insights.builtAt.slice(0, 10)} · shard <code>p/{code}.json</code>
            </p>
          </div>
        </div>
        <div className="t-stubs">
          <Stub label="Records" value={n(p.records)} rank={rankOf(byProvince, code, 'records')} />
          <Stub label="Reachable" value={gap ? `${gap.reachablePct}%` : '—'} rank={gap ? rankOf(reachGap, code, 'reachablePct') : null} />
          <Stub label="Graded" value={n(p.stars.graded)} rank={gradedRank} />
          <Stub label="Corroborated" value={`${Math.round((p.corroborated / Math.max(p.records, 1)) * 100)}%`} rank={corrRank} />
          <Stub label={`Sales ${revLatest ? revLatest + 543 : ''} BE`} value={revTotal != null && rev?.years?.[revLatest]?.monthsReported === 12 ? baht(revTotal) : '—'}
            rank={revTotal != null ? rankOf(revRanked, code, 'total') : null} note="not reported" />
          <Stub label="Hidden champions" value={gap ? n(gap.hiddenChampions) : '—'} rank={gap ? rankOf(reachGap, code, 'hiddenChampions') : null} />
        </div>
      </div>

      <div className="dossier-actions">
        {onOpenMatch ? (
          <button type="button" className="reset" onClick={() => onOpenMatch('b2b', code)}>Open in Source · B2B</button>
        ) : (
          <a className="reset" href={`/?lens=b2b&prov=${code}`}>Open in Source · B2B</a>
        )}
        {records && <button type="button" className="reset" onClick={exportCsv}>Export this province (CSV)</button>}
      </div>

      {/* ── money ────────────────────────────────────────────────────── */}
      <h3 className="sub-h">Money · รายได้จากการจำหน่าย</h3>
      {rev ? (
        <>
          <Sparkline points={monthlyPoints(rev.years)} format={baht} label={`${p.en} monthly OTOP sales`} />
          <div className="t-ranked">
            {Object.entries(rev.years).sort(([a], [b]) => b - a).map(([y, yr]) => (
              <div key={y} className="t-ranked-row">
                <span>{Number(y) + 543} BE{yr.monthsReported < 12 ? ` · ${yr.monthsReported} of ${yr.monthsHeld} months` : ''}</span>
                <span className="t-row-num">{yr.monthsReported > 0 ? baht(yr.total) : '—'}</span>
              </div>
            ))}
          </div>
          {catYears && (
            <p className="t-note">
              By category, {Math.max(...Object.keys(catYears).map(Number)) + 543} BE (annual filing):{' '}
              {Object.entries(catYears[Math.max(...Object.keys(catYears).map(Number))].categories)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([id, c]) => `${id} ${baht(c.total)}`).join(' · ')}
              . Online share {Math.round((catYears[Math.max(...Object.keys(catYears).map(Number))].online / Math.max(catYears[Math.max(...Object.keys(catYears).map(Number))].total, 1)) * 1000) / 10}%.
            </p>
          )}
          <p className="t-note">
            CDD's provincial aggregate, resource <code>{revenue.source.resourceId.slice(0, 8)}</code>. It says how much money moved in the province, not who earned it,
            and it is not divided by the {n(p.records)} registry rows — that ratio would print filing energy as productivity.
          </p>
        </>
      ) : <p className="t-note">{revenue ? 'No sales series for this province.' : 'Loading the sales series…'}</p>}

      {/* ── domain ───────────────────────────────────────────────────── */}
      <h3 className="sub-h">Domain · what the registry says is made here</h3>
      <Composition parts={categoryParts(p)} total={p.records} />

      {/* ── districts ────────────────────────────────────────────────── */}
      <h3 className="sub-h">Districts · อำเภอ{records ? ` · ${districts.length}` : ''}</h3>
      {error && <p className="empty">The province shard could not be loaded — {error}.</p>}
      {!records && !error && <p className="empty">Loading {n(p.records)} records…</p>}
      {records && (
        <>
          <div className="t-grid" role="table">
            <div className="t-grid-row t-grid-hd" role="row">
              <span>District</span><span className="t-row-num">Records</span><span className="t-row-num">Reachable</span><span className="t-row-num">Graded</span>
            </div>
            {districts.slice(0, 12).map((d) => (
              <div className="t-grid-row" role="row" key={d.district}>
                <span>{d.district}</span>
                <span className="t-row-num">{n(d.records)}</span>
                <span className="t-row-num">{d.reachable || '—'}</span>
                <span className="t-row-num">{d.graded || '—'}</span>
              </div>
            ))}
          </div>
          {districts.length > 12 && (
            <details className="t-more">
              <summary>All {districts.length} districts</summary>
              <div className="t-grid" role="table">
                {districts.slice(12).map((d) => (
                  <div className="t-grid-row" role="row" key={d.district}>
                    <span>{d.district}</span>
                    <span className="t-row-num">{n(d.records)}</span>
                    <span className="t-row-num">{d.reachable || '—'}</span>
                    <span className="t-row-num">{d.graded || '—'}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {/* ── subdistricts ─────────────────────────────────────────── */}
          {tambonStats.tambons.length > 0 && (
            <>
              <h3 className="sub-h">
                Subdistricts · ตำบล{tambonStats.tambons.length ? ` · ${tambonStats.tambons.length}` : ''}
              </h3>
              <div className="t-grid" role="table">
                <div className="t-grid-row t-grid-hd" role="row">
                  <span>Subdistrict</span><span className="t-row-num">Records</span><span className="t-row-num">Reachable</span><span className="t-row-num">Graded</span>
                </div>
                {tambonStats.tambons.slice(0, 12).map((t) => (
                  <div className="t-grid-row" role="row" key={`${t.district}/${t.subdistrict}`}>
                    <span>{t.subdistrict} {t.district ? `(${t.district})` : ''}</span>
                    <span className="t-row-num">{n(t.records)}</span>
                    <span className="t-row-num">{t.reachable || '—'}</span>
                    <span className="t-row-num">{t.graded || '—'}</span>
                  </div>
                ))}
              </div>
              {tambonStats.tambons.length > 12 && (
                <details className="t-more">
                  <summary>All {tambonStats.tambons.length} subdistricts</summary>
                  <div className="t-grid" role="table">
                    {tambonStats.tambons.slice(12).map((t) => (
                      <div className="t-grid-row" role="row" key={`${t.district}/${t.subdistrict}`}>
                        <span>{t.subdistrict} {t.district ? `(${t.district})` : ''}</span>
                        <span className="t-row-num">{n(t.records)}</span>
                        <span className="t-row-num">{t.reachable || '—'}</span>
                        <span className="t-row-num">{t.graded || '—'}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
          <p className="t-note">
            Tambon centroid is the finest honest resolution available ({n(tambonStats.placed)} of {n(p.records)} records, {Math.round((tambonStats.placed / Math.max(p.records, 1)) * 100)}% placed). No street addresses or individual coordinates are guessed.
          </p>

          {/* ── filed income ─────────────────────────────────────────── */}
          {incomeRecords.length > 0 && (
            <>
              <h3 className="sub-h">Filed Income · รายได้ที่แจ้ง · {incomeRecords.length} records</h3>
              <div className="t-grid t-grid-2" role="table">
                <div className="t-grid-row t-grid-hd" role="row">
                  <span>Producer / Product</span><span className="t-row-num">Reported Annual Income</span>
                </div>
                {incomeRecords.slice(0, 10).map((r, i) => (
                  <div className="t-grid-row" role="row" key={r.sourceRowId || i}>
                    <span>{r.productName || r.producerName}</span>
                    <span className="t-row-num">{baht(r.income)}</span>
                  </div>
                ))}
              </div>
              {incomeRecords.length > 10 && (
                <details className="t-more">
                  <summary>All {incomeRecords.length} records with filed income</summary>
                  <div className="t-grid t-grid-2" role="table">
                    {incomeRecords.slice(10).map((r, i) => (
                      <div className="t-grid-row" role="row" key={r.sourceRowId || i}>
                        <span>{r.productName || r.producerName}</span>
                        <span className="t-row-num">{baht(r.income)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {/* ── products ─────────────────────────────────────────────── */}
          <h3 className="sub-h">Products · ผลิตภัณฑ์ · {n(productCount)} of {n(p.records)} records name one</h3>
          {products.length === 0 ? <p className="t-note">No product names filed in this province.</p> : (
            <div className="t-grid t-grid-2" role="table">
              {products.map(([name, count]) => (
                <div className="t-grid-row" role="row" key={name}><span>{name}</span><span className="t-row-num">{count}</span></div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── condition ────────────────────────────────────────────────── */}
      <h3 className="sub-h">Condition of the record · vs national</h3>
      <div className="t-zones">
        {ZONES.map((z) => {
          const value = p.completeness[z.key] ?? 0;
          const nat = national.completeness[z.key] ?? 0;
          return (
            <div className="t-zone" key={z.key} data-fill={value < 5 ? 'blank' : 'printed'}>
              <span className="t-key">{z.zone}</span>
              <span className="t-zone-n">{value}%</span>
              <span className="t-ctx">{z.label} · national {nat}%</span>
              <span className="t-zone-bar"><i style={{ width: `${Math.max(value, 0.6)}%` }} /></span>
            </div>
          );
        })}
      </div>

      <nav className="dossier-walk" aria-label="Neighbouring provinces">
        {idx > 0 ? <button type="button" className="reset" onClick={() => onSelectProvince(ordered[idx - 1].code)}>← {ordered[idx - 1].iso} {ordered[idx - 1].th}</button> : <span />}
        <button type="button" className="reset" onClick={() => onSelectProvince(null)}>Atlas</button>
        {idx < ordered.length - 1 ? <button type="button" className="reset" onClick={() => onSelectProvince(ordered[idx + 1].code)}>{ordered[idx + 1].iso} {ordered[idx + 1].th} →</button> : <span />}
      </nav>
    </div>
  );
}
