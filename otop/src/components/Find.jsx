/**
 * Find — the search-first landing.
 *
 * The most useful single thing on this site is: type a thing, pick a place,
 * get a list of names and phone numbers you can call today. Every other view
 * (Atlas, Match, Matchmaker, Briefs) is a deeper read of the same data; Find
 * is the one that ends with a phone call.
 *
 * The contactability problem is the entire reason this site exists. 5.7% of
 * registry records carry a phone number. We surface those 8,839 first, in
 * the order a buyer would actually call them: 5★ + phone, then 4★ + phone,
 * then phone-only, then the rest. Records with no contact channel are shown
 * last and flagged in-row.
 *
 * Performance note: the index (totals + province list) arrives in a single
 * 29KB fetch. The 77 province shards (263MB raw, ~50MB gzipped) load on
 * first interaction and are kept in memory. Search across 154,050 records
 * is a 5-field substring scan; sub-100ms on commodity phones.
 */

import { useEffect, useMemo, useState } from 'react';
import { loadIndex, loadShards } from '../lib/shards.js';
import { Bi } from './Bi.jsx';

const PAGE = 30;
const PREF_KEY = 'otop_find_v1';
const ALL_PROVINCES_OPTION = 'all';

function norm(s) {
  return (s == null ? '' : String(s)).trim().toLowerCase();
}

/**
 * A simple, transparent ranking. We do not infer what the registry does not
 * attest (no capacity, no MOQ, no lead time, no safety permit). We rank on
 * the things it does attest: stars (state quality grade), phone (you can
 * reach them), and field completeness (a sub-district address is more useful
 * than a province-only one).
 */
function scoreRecord(r) {
  let s = 0;
  if (r.stars === 5) s += 100;
  else if (r.stars === 4) s += 50;
  else if (r.stars && r.stars >= 1) s += 20;
  if (r.phone) s += 30;
  if (r.productName) s += 10;
  if (r.description) s += 5;
  if (r.subdistrict) s += 3;
  if (r.district) s += 1;
  return s;
}

function phoneHref(phone) {
  if (!phone) return null;
  // Thai numbers: 0xx-xxx-xxxx, +66xx-xxx-xxxx. Strip everything but digits and leading +.
  const digits = String(phone).replace(/[^0-9+]/g, '');
  return `tel:${digits}`;
}

export default function Find({ onOpenProvince, onOpenRecord }) {
  const [index, setIndex] = useState(null);
  const [records, setRecords] = useState(null); // null = still loading
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: 0 });
  const [query, setQuery] = useState(() => {
    try { return sessionStorage.getItem(`${PREF_KEY}_q`) || ''; } catch { return ''; }
  });
  const [provinceCode, setProvinceCode] = useState(() => {
    try { return sessionStorage.getItem(`${PREF_KEY}_p`) || ALL_PROVINCES_OPTION; } catch { return ALL_PROVINCES_OPTION; }
  });
  const [stars, setStars] = useState(() => {
    try { return sessionStorage.getItem(`${PREF_KEY}_s`) || 'any'; } catch { return 'any'; }
  });
  const [onlyContactable, setOnlyContactable] = useState(() => {
    try { return sessionStorage.getItem(`${PREF_KEY}_c`) === '1'; } catch { return false; }
  });
  const [limit, setLimit] = useState(PAGE);

  // Load index.
  useEffect(() => {
    let cancelled = false;
    loadIndex()
      .then(({ index }) => { if (!cancelled) setIndex(index); })
      .catch((error) => { if (!cancelled) console.error('[find] index load failed', error); });
    return () => { cancelled = true; };
  }, []);

  // Load all 77 shards. Stream progress so the loading state is honest.
  useEffect(() => {
    if (!index) return;
    if (records) return;
    let cancelled = false;
    const codes = index.provinces.map((p) => p.code);
    setLoadProgress({ done: 0, total: codes.length });

    (async () => {
      const all = [];
      // Bounded concurrency so we don't hammer the CDN.
      const CONCURRENCY = 8;
      let i = 0;
      let done = 0;
      async function worker() {
        while (i < codes.length && !cancelled) {
          const code = codes[i++];
          try {
            const res = await fetch(`/p/${code}.json`, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`shard ${code} ${res.status}`);
            const arr = await res.json();
            for (const r of arr) all.push(r);
          } catch (e) {
            console.warn(`[find] shard ${code} failed`, e.message);
          }
          done += 1;
          if (!cancelled) setLoadProgress({ done, total: codes.length });
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (cancelled) return;
      setRecords(all);
    })();

    return () => { cancelled = true; };
  }, [index, records]);

  // Persist preferences across page reloads (session, not local, so the URL
  // is still the only state for deep links).
  useEffect(() => { try { sessionStorage.setItem(`${PREF_KEY}_q`, query); } catch {} }, [query]);
  useEffect(() => { try { sessionStorage.setItem(`${PREF_KEY}_p`, provinceCode); } catch {} }, [provinceCode]);
  useEffect(() => { try { sessionStorage.setItem(`${PREF_KEY}_s`, stars); } catch {} }, [stars]);
  useEffect(() => { try { sessionStorage.setItem(`${PREF_KEY}_c`, onlyContactable ? '1' : '0'); } catch {} }, [onlyContactable]);

  const results = useMemo(() => {
    if (!records) return [];
    const q = norm(query);
    let out = records;
    if (q) {
      out = out.filter((r) =>
        norm(r.producerName).includes(q) ||
        norm(r.productName).includes(q) ||
        norm(r.description).includes(q) ||
        norm(r.district).includes(q) ||
        norm(r.subdistrict).includes(q) ||
        norm(r.category).includes(q)
      );
    }
    if (provinceCode !== ALL_PROVINCES_OPTION) {
      const pc = Number(provinceCode);
      out = out.filter((r) => r.provinceCode === pc);
    }
    if (stars === '5') out = out.filter((r) => r.stars === 5);
    else if (stars === '4-5') out = out.filter((r) => r.stars === 4 || r.stars === 5);
    if (onlyContactable) out = out.filter((r) => r.phone);
    // Sort: best-of-the-best first. Stable for ties.
    out = out.slice().sort((a, b) => scoreRecord(b) - scoreRecord(a));
    return out;
  }, [records, query, provinceCode, stars, onlyContactable]);

  const shown = results.slice(0, limit);
  const hasMore = results.length > limit;
  const loading = records === null;

  // Headline numbers for the loading state.
  const totalLoaded = records ? records.length : 0;
  const totalWithPhone = records ? records.filter((r) => r.phone).length : 0;
  const totalFiveStar = records ? records.filter((r) => r.stars === 5).length : 0;

  return (
    <section className="find" aria-label="Find a producer">
      <header className="find-head">
        <span className="eyebrow">
          <Bi en="Find" th="ค้นหา" />
        </span>
        <h2 className="find-h">
          <Bi en="Who can you call today?" th="วันนี้คุณโทรหาใครได้บ้าง" />
        </h2>
        <p className="find-summary">
          <Bi
            en="Type a thing. Pick a place. Get a list of names and phone numbers you can call right now."
            th="พิมพ์สิ่งที่ต้องการ เลือกจังหวัด รับรายชื่อและเบอร์โทรที่โทรหาได้วันนี้"
          />
        </p>
        <p className="find-stats">
          {loading ? (
            <>
              <Bi
                en={`Loading ${loadProgress.done} of ${loadProgress.total} provinces…`}
                th={`กำลังโหลด ${loadProgress.done} จาก ${loadProgress.total} จังหวัด…`}
              />
              <progress className="find-bar" value={loadProgress.done} max={loadProgress.total || 1} />
            </>
          ) : (
            <>
              <strong>{totalLoaded.toLocaleString()}</strong> <Bi en="records loaded" th="รายการ" />
              <span className="find-stats-sep">·</span>
              <strong>{totalWithPhone.toLocaleString()}</strong> <Bi en="with a phone" th="ที่มีเบอร์โทร" />
              <span className="find-stats-sep">·</span>
              <strong>{totalFiveStar.toLocaleString()}</strong> <Bi en="rated 5★" th="ระดับ 5 ดาว" />
            </>
          )}
        </p>
      </header>

      <div className="find-controls">
        <label className="find-q">
          <span className="find-lbl">
            <Bi en="Search" th="ค้นหา" />
          </span>
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck="false"
            placeholder={loading ? 'Loading records…' : 'silk · น้ำผึ้ง · 5★ · Chiang Mai · ผ้าไหม'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
            disabled={loading}
            aria-label="Search producers"
          />
        </label>

        <label className="find-prov">
          <span className="find-lbl">
            <Bi en="Province" th="จังหวัด" />
          </span>
          <select
            value={provinceCode}
            onChange={(e) => { setProvinceCode(e.target.value); setLimit(PAGE); }}
            disabled={!index}
          >
            <option value={ALL_PROVINCES_OPTION}>
              <Bi en="All Thailand" th="ทั้งประเทศ" />
            </option>
            {(index?.provinces ?? []).map((p) => (
              <option key={p.code} value={p.code}>
                {p.nameEn} · {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="find-stars">
          <span className="find-lbl">
            <Bi en="Stars" th="ดาว" />
          </span>
          <select
            value={stars}
            onChange={(e) => { setStars(e.target.value); setLimit(PAGE); }}
            disabled={loading}
          >
            <option value="any"><Bi en="Any" th="ใด ๆ" /></option>
            <option value="4-5">4–5★</option>
            <option value="5">5★ only · เฉพาะ 5 ดาว</option>
          </select>
        </label>

        <label className="find-phone-toggle">
          <input
            type="checkbox"
            checked={onlyContactable}
            onChange={(e) => { setOnlyContactable(e.target.checked); setLimit(PAGE); }}
            disabled={loading}
          />
          <span>
            <Bi en="Phone only" th="เฉพาะที่มีเบอร์" />
          </span>
        </label>
      </div>

      <div className="find-meta" aria-live="polite">
        {!loading && (
          <>
            <strong>{results.length.toLocaleString()}</strong>{' '}
            <Bi en={results.length === 1 ? 'match' : 'matches'} th={results.length === 1 ? 'รายการ' : 'รายการ'} />
            {query ? <span> <span className="muted">·</span> <span className="find-qecho">“{query}”</span></span> : null}
            {provinceCode !== ALL_PROVINCES_OPTION && index ? (
              <span> <span className="muted">·</span> {index.provinces.find((p) => p.code === Number(provinceCode))?.nameEn}</span>
            ) : null}
            {stars !== 'any' ? <span> <span className="muted">·</span> {stars === '5' ? '5★' : '4–5★'}</span> : null}
            {onlyContactable ? <span> <span className="muted">·</span> <Bi en="phone" th="มีเบอร์" /></span> : null}
          </>
        )}
      </div>

      <ul className="find-list">
        {shown.map((r, i) => {
          const provName = r.provinceEn || r.province;
          const district = r.district || '—';
          const starLabel = r.stars ? `${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}` : null;
          return (
            <li
              key={r.sourceRowId || `${r.provinceCode}-${i}`}
              className={`find-row${r.stars ? ` s${r.stars}` : ' s0'}${r.phone ? ' has-phone' : ' no-phone'}`}
            >
              <div className="find-row-top">
                <a
                  className="find-row-name"
                  href={`/?view=province&code=${r.provinceCode}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenProvince?.(r.provinceCode);
                  }}
                >
                  {r.producerName || <em className="muted"><Bi en="(unnamed)" th="(ไม่มีชื่อ)" /></em>}
                </a>
                {starLabel && <span className="find-row-stars" aria-label={`${r.stars} star`}>{starLabel}</span>}
              </div>

              <div className="find-row-phone">
                {r.phone ? (
                  <a className="phone-link" href={phoneHref(r.phone)}>
                    <span className="phone-icon" aria-hidden="true">☎</span>
                    <span className="phone-num">{r.phone}</span>
                    <span className="phone-action">
                      <Bi en="tap to call" th="แตะเพื่อโทร" />
                    </span>
                  </a>
                ) : (
                  <span className="phone-muted">
                    <Bi en="no contact channel in the registry" th="ไม่มีช่องทางติดต่อในทะเบียน" />
                  </span>
                )}
              </div>

              <div className="find-row-meta">
                <button
                  type="button"
                  className="find-row-prov"
                  onClick={() => onOpenProvince?.(r.provinceCode)}
                >
                  {provName} · {district}
                </button>
                {r.productName && <span className="find-row-product">{r.productName}</span>}
                {r.category && r.category !== 'none' && (
                  <span className="find-row-cat">{r.category}</span>
                )}
                {r.registrationId && (
                  <span className="find-row-regid">#{r.registrationId}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!loading && results.length === 0 && (
        <p className="find-empty">
          <Bi en="No matches. Try a broader search, remove the province filter, or uncheck phone-only." th="ไม่พบ ลองค้นหาแบบกว้างขึ้น เอาตัวกรองจังหวัดออก หรือยกเลิกตัวกรองเฉพาะเบอร์" />
        </p>
      )}

      {hasMore && (
        <div className="find-more">
          <button type="button" className="btn-line" onClick={() => setLimit(limit + PAGE)}>
            <Bi en={`Show ${Math.min(PAGE, results.length - limit)} more`} th={`แสดงอีก ${Math.min(PAGE, results.length - limit)} รายการ`} />
          </button>
          <span className="muted">
            <Bi en={`of ${results.length.toLocaleString()}`} th={`จาก ${results.length.toLocaleString()}`} />
          </span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <p className="find-caveat">
          <Bi
            en="Phone numbers and addresses come from data.go.th and may be years old. Verify before relying on them."
            th="เบอร์โทรและที่อยู่มาจาก data.go.th อาจล้าสมัยหลายปี กรุณาตรวจสอบก่อนใช้"
          />
        </p>
      )}
    </section>
  );
}
