/**
 * Reachable Champions — 4-5★ OTOP producers the registry says CAN be reached.
 * Sorted by stars, then province, then name. The list is small (90 today)
 * and meant to be readable on a phone.
 *
 * Distinct from the existing "Hidden Champions" view in the Atlas, which is
 * the opposite: certified producers nobody can telephone. The two together
 * are the contact-drive's two halves — start with this list (they will
 * answer), chase the hidden list (they exist, the system just has no route).
 *
 * The producer card carries: name, product, province, district, stars,
 * the contact channel that proved reach, and an export-as-CSV button
 * per row (and a button for the full list).
 */

import { useEffect, useMemo, useState } from 'react';
import { photoForRecord, loadPhotosForProvince, attributionLine } from '../../core/photos.js';
import { matchStandardForProduct } from '../../core/standards.js';
import { dedupeCerts } from '../../core/certs.js';

async function loadChampions() {
  const r = await fetch('/otop_champions.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`otop_champions.json ${r.status}`);
  return r.json();
}

async function loadStandards() {
  const r = await fetch('/otop_standards.json', { cache: 'no-cache' });
  if (!r.ok) return null;
  const d = await r.json();
  return d.standards ?? [];
}

const REACH_LABEL = {
  phone:   { en: 'Phone',    th: 'โทรศัพท์',  icon: '☎' },
  email:   { en: 'Email',    th: 'อีเมล',     icon: '✉' },
  web:     { en: 'Website',  th: 'เว็บไซต์',  icon: '⌘' },
};

const CAT_EN = {
  food: 'Food', beverage: 'Beverage', textile: 'Textile',
  craft: 'Craft', herbal: 'Herbal',
};
const CAT_TH = {
  food: 'อาหาร', beverage: 'เครื่องดื่ม', textile: 'ผ้า',
  craft: 'หัตถกรรม', herbal: 'สมุนไพร',
};

function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const header = ['stars', 'producer', 'product', 'category', 'province', 'district', 'subdistrict', 'tambon_code', 'reach', 'phone', 'email', 'website', 'address', 'sourceRowId'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((k) => escapeCsv(k === 'tambon_code' ? (r.tambonCode ?? r.tambon_code) : r[k])).join(','));
  return lines.join('\n');
}

function exportList(rows, filename) {
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Champions({ onSelectProvince, national, records }) {
  const [data, setData] = useState(null);
  const [standards, setStandards] = useState([]);
  const [error, setError] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [filterReach, setFilterReach] = useState('all');
  const [filterStar, setFilterStar] = useState(5);
  const [filterProv, setFilterProv] = useState('all');
  const [query, setQuery] = useState('');

  const [showPhotos, setShowPhotos] = useState(true);
  const [mediaTick, setMediaTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadChampions().then((d) => { if (!cancelled) setData(d); }).catch((e) => { if (!cancelled) setError(e.message); });
    loadStandards().then((s) => { if (!cancelled && s) setStandards(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.champions.filter((c) => {
      if (c.stars < filterStar) return false;
      if (filterCat !== 'all' && c.category !== filterCat) return false;
      if (filterReach !== 'all' && c.reach !== filterReach) return false;
      if (filterProv !== 'all' && String(c.provinceCode) !== String(filterProv)) return false;
      if (q) {
        const blob = `${c.producerName ?? ''} ${c.productName ?? ''} ${c.provinceEn ?? ''} ${c.province ?? ''} ${c.district ?? ''} ${c.subdistrict ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [data, filterStar, filterCat, filterReach, filterProv, query]);

  if (error) return <p className="empty">Could not load champions — {error}.</p>;
  if (!data) return <p className="empty">Loading reachable champions…</p>;

  // Warm Commons manifests for provinces on the current shortlist so photoForRecord can resolve sync.
  useEffect(() => {
    if (!showPhotos || filtered.length === 0) return;
    const codes = [...new Set(filtered.map((c) => c.provinceCode).filter((c) => c != null))];
    let cancelled = false;
    Promise.all(codes.map((code) => loadPhotosForProvince(code))).then(() => {
      if (!cancelled) setMediaTick((n) => n + 1);
    });
    return () => { cancelled = true; };
  }, [showPhotos, filtered]);

  const cats = ['all', ...new Set(data.champions.map((c) => c.category).filter(Boolean))];
  const reaches = ['all', 'phone', 'email', 'web'];
  const totalChampions = data.champions.length;

  return (
    <div className="champions">
      <p className="ch-lede">
        Across {(records ?? data.counts.rowsScanned ?? 0).toLocaleString()} records,{' '}
        {(national?.stars?.graded ?? 0).toLocaleString()} carry star ratings and{' '}
        {national?.completeness?.withContact ?? '—'}% carry contact information.
        Only <strong>{totalChampions}</strong> carry both 4-5 stars and contact details — making this
        the direct starting point for verified procurement.
      </p>

      <div className="ch-controls">
        <div className="ch-ctrl-grp">
          <span className="t-key">Stars</span>
          <button type="button" className="ch-btn" data-active={filterStar === 5} onClick={() => setFilterStar(5)}>
            <span>5★ only</span>
            <span className="ch-btn-th">5 ดาว</span>
          </button>
          <button type="button" className="ch-btn" data-active={filterStar === 4} onClick={() => setFilterStar(4)}>
            <span>4-5★</span>
            <span className="ch-btn-th">4-5 ดาว</span>
          </button>
        </div>
        <div className="ch-ctrl-grp">
          <span className="t-key">Category</span>
          {cats.map((c) => (
            <button type="button" key={c} className="ch-btn" data-active={filterCat === c} onClick={() => setFilterCat(c)}>
              <span>{c === 'all' ? 'All' : (CAT_EN[c] ?? c)}</span>
              <span className="ch-btn-th">{c === 'all' ? 'ทั้งหมด' : (CAT_TH[c] ?? '')}</span>
            </button>
          ))}
        </div>
        <div className="ch-ctrl-grp">
          <span className="t-key">Reach</span>
          {reaches.map((r) => (
            <button type="button" key={r} className="ch-btn" data-active={filterReach === r} onClick={() => setFilterReach(r)}>
              <span>{r === 'all' ? 'Any' : (REACH_LABEL[r]?.en ?? r)}</span>
              <span className="ch-btn-th">{r === 'all' ? 'ทุกช่องทาง' : (REACH_LABEL[r]?.th ?? '')}</span>
            </button>
          ))}
        </div>
        <div className="ch-ctrl-grp">
          <span className="t-key">Province</span>
          <button type="button" className="ch-btn" data-active={filterProv === 'all'} onClick={() => setFilterProv('all')}>
            <span>All ({totalChampions})</span>
            <span className="ch-btn-th">ทั้งหมด</span>
          </button>
          {data.provinces.map((p) => (
            <button
              type="button"
              key={p.code}
              className="ch-btn"
              data-active={filterProv === String(p.code)}
              onClick={() => setFilterProv(String(p.code))}
            >
              <span>{p.name_en}</span>
              <span className="ch-btn-th">{p.name_th} ({p.count})</span>
            </button>
          ))}
        </div>
        <div className="ch-ctrl-grp ch-ctrl-grow">
          <input
            type="search"
            className="ch-search"
            placeholder="Search name, product, district…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="ch-actions">
        <span className="t-key">{filtered.length} of {totalChampions} shown</span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="reset"
            onClick={() => setShowPhotos((v) => !v)}
            style={{ textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showPhotos ? 'Hide craft photos' : 'Show craft photos'}
          </button>
          {filtered.length > 0 && (
            <button type="button" className="reset" onClick={() => exportList(filtered, `otop-champions-${new Date().toISOString().slice(0, 10)}.csv`)}>
              Export this list (CSV)
            </button>
          )}
        </div>
      </div>

      <div className="ch-cards">
        {filtered.map((c) => {
          const photo = showPhotos ? photoForRecord(c) : null; void mediaTick;
          const std = matchStandardForProduct(c.productName || c.producerName, standards, c.category);
          return (
            <article key={c.sourceRowId ?? `${c.producerName}-${c.provinceCode}-${c.productName}`} className="ch-card" data-stars={c.stars}>
              <div className="ch-card-rail" />
              <div className="ch-card-body">
                {photo && (
                  <div className="ch-card-media">
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      loading="lazy"
                      className="ch-card-img"
                    />
                    <div className="ch-card-img-cap">
                      <span>{photo.caption || photo.description || photo.title}</span>
                      <span className="ch-card-img-attr">{attributionLine(photo)}{photo.isExactProducer ? '' : ' · illustrative'}</span>
                    </div>
                  </div>
                )}
                <header className="ch-card-h">
                  <div className="ch-card-stars">{'★'.repeat(c.stars)}<span className="ch-card-stars-e">{'★'.repeat(5 - c.stars)}</span></div>
                  <div className="ch-card-reach" data-reach={c.reach}>
                    <span className="ch-card-reach-icon">{REACH_LABEL[c.reach]?.icon}</span>
                    <span>{REACH_LABEL[c.reach]?.en}</span>
                  </div>
                </header>
                <h3 className="ch-card-name">{c.producerName ?? '—'}</h3>
                {c.productName && c.productName !== c.producerName && (
                  <p className="ch-card-product">{c.productName}</p>
                )}
                <div className="ch-card-meta">
                  <span className="ch-card-cat" data-cat={c.category}>
                    {CAT_EN[c.category] ?? c.category} <span className="ch-card-cat-th">{CAT_TH[c.category] ?? ''}</span>
                  </span>
                  <span className="ch-card-loc">
                    {onSelectProvince ? (
                      <button
                        type="button"
                        className="reset"
                        onClick={() => onSelectProvince(c.provinceCode)}
                        style={{ textDecoration: 'underline', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                        title={`Open ${c.provinceEn} dossier`}
                      >
                        <span className="ch-card-loc-th">{c.province}</span>
                        <span> · {c.provinceEn} →</span>
                      </button>
                    ) : (
                      <>
                        <span className="ch-card-loc-th">{c.province}</span>
                        <span> · {c.provinceEn}</span>
                      </>
                    )}
                    {c.district && <span> · {c.district}</span>}
                    {c.subdistrict && <span> · {c.subdistrict}</span>}
                  </span>
                </div>
                {(c.certs ?? []).length > 0 ? (
                  <div className="ch-card-std" style={{ margin: '0.4rem 0', fontSize: '0.75rem' }}>
                    <span className="t-key" style={{ marginRight: '0.5rem' }}>
                      ✓ Certified มผช.{c.certStatus === 'valid' ? '' : c.certStatus === 'expired' ? ' · lapsed' : ' · undated'}
                    </span>
                    {dedupeCerts(c.certs).map((cert, i) => (
                      <span key={i}>
                        {i > 0 && '; '}
                        {[cert.standardCode, cert.standardTitle].filter(Boolean).join(': ') || 'มผช.'}
                        {cert.number ? ` · cert ${cert.number}` : ''}
                        {cert.expires ? ` · ${c.certStatus === 'valid' ? 'valid to' : 'expired'} ${cert.expires}` : ''}
                      </span>
                    ))}
                  </div>
                ) : std && (
                  <div className="ch-card-std" style={{ margin: '0.4rem 0', fontSize: '0.75rem' }}>
                    <span className="t-key" style={{ marginRight: '0.5rem' }}>มผช. / TCPS</span>
                    <a
                      href={std.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--tag-ink)', borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none' }}
                      title={`TISI Standard: ${std.titleEn}`}
                    >
                      {std.code}: {std.titleTh} (PDF ↗)
                    </a>
                  </div>
                )}
                <dl className="ch-card-contact">
                  {c.phone && <><dt>Phone</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd></>}
                  {c.email && <><dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd></>}
                  {c.website && <><dt>Web</dt><dd><a href={c.website} target="_blank" rel="noreferrer">{c.website}</a></dd></>}
                  {c.address && <><dt>Address</dt><dd>{c.address}</dd></>}
                </dl>
                <div className="ch-quick-actions">
                  {c.phone && <a href={`tel:${c.phone}`} className="ch-act-btn">☎ {c.phone}</a>}
                  {onSelectProvince && <button type="button" className="ch-act-btn reset" onClick={() => onSelectProvince(c.provinceCode)}>Dossier →</button>}
                </div>
              </div>
              <div className="ch-card-actions">
                <button
                  type="button"
                  className="reset"
                  onClick={() => exportList([c], `otop-champion-${(c.producerName ?? 'row').replace(/[^a-z0-9]+/gi, '-')}.csv`)}
                >
                  Save card (CSV)
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="empty">No champions match these filters. Loosen one — most are 5★ and most have a phone.</p>
      )}

      <p className="t-note ch-foot">
        Source: <code>otop_champions.json</code> · built {data.builtAt?.slice(0, 10)} ·
        joined from all 77 province shards, filtering on <code>stars ≥ {data.filters.minStars}</code>
        and a non-empty <code>phone | email | website</code>.
        {data.degraded && <> <strong className="t-warn">{data.reason}</strong></>}
      </p>
    </div>
  );
}
