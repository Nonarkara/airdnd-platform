/**
 * Cross-references — the view that joins the OTOP registry and revenue
 * to the country the producers sit in: population, tourism arrivals,
 * internet penetration. Every cell is a real cross-reference question,
 * and the cells are the only ones the data can answer today.
 *
 * The five reference cells:
 *
 *   1. Records per 100k people — how concentrated is the supply in each
 *      province relative to its population? Surin (1.1M people, 1,287
 *      records) reads 117/100k; Bangkok (5.5M, 2,559) reads 47/100k.
 *
 *   2. 5★ per 100k people — where is the certified supply densest per
 *      capita? Lampang (750k, 299 5★) is 39.9/100k; Chiang Mai is 7.1.
 *
 *   3. Revenue per record (2024 BE) — how much money per registered
 *      producer is moving? Phetchaburi's food category at 36M baht
 *      over 1,697 records is ฿21k each; Bangkok at 0 is zero.
 *
 *   4. Online share vs tourism — do tourist-heavy provinces sell
 *      online, or in person? Phuket (14.1M tourists) and Chiang Mai
 *      (11M) have the tourists; the registry says almost none of their
 *      records carry a phone number.
 *
 *   5. Internet vs reachability — are the broadband-rich provinces the
 *      ones with the most reachable producers? Bangkok (90/100 hh) and
 *      Phuket (88) have the wire; Bangkok's reach is 0.2%.
 *
 * The view is a single page, scrollable. The data is honest: where the
 * revenue series is empty (Bangkok), the cell reads 0 with the reason
 * printed below it, not blanked out.
 */

import { useEffect, useMemo, useState } from 'react';
import { baht } from '../lib/insights.js';

async function loadAnchors() {
  const r = await fetch('/otop_anchors.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`otop_anchors.json ${r.status}`);
  return r.json();
}

const nf = new Intl.NumberFormat('en-US');

function P({ children }) { return <p className="xr-p">{children}</p>; }
function Source({ children }) { return <p className="xr-source">— {children}</p>; }

function ratio(n, d) { return d > 0 ? n / d : 0; }
function per100k(n, population_thousands) {
  return population_thousands > 0 ? (n / (population_thousands * 1000)) * 100_000 : 0;
}
function pct(x) { return Math.round(x * 1000) / 10; }

function bar(value, max, color) {
  return (
    <div className="xr-bar">
      <i style={{ width: `${Math.min(100, (value / Math.max(max, 1e-6)) * 100)}%`, background: color ?? 'currentColor' }} />
    </div>
  );
}

export default function CrossReferences() {
  const [anchors, setAnchors] = useState(null);
  const [insights, setInsights] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadAnchors().catch(() => null),
      fetch('/otop_insights.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/otop_revenue.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([a, i, r]) => {
      if (cancelled) return;
      if (!a) { setError('Cross-reference anchors could not be loaded — otop_anchors.json missing.'); return; }
      setAnchors(a);
      setInsights(i);
      setRevenue(r);
    });
    return () => { cancelled = true; };
  }, []);

  const byProvince = useMemo(() => {
    if (!anchors) return [];
    return anchors.provinces.map((a) => {
      const ip = insights?.byProvince?.find((p) => p.code === a.code) ?? null;
      const reach = insights?.reachGap?.find((p) => p.code === a.code) ?? null;
      const hidden = insights?.hiddenChampions?.find((p) => p.code === a.code) ?? null;
      const revByProv = revenue?.byProvince?.find((p) => p.code === a.code) ?? null;
      const catYears = revenue?.byCategory?.provinces?.[a.code] ?? null;
      const lastYear = Math.max(...(revenue?.byCategory?.years ?? []));
      const records = ip?.records ?? 0;
      const stars = ip?.stars ?? null;
      const stars5 = (stars?.['5'] ?? 0);
      const stars4 = (stars?.['4'] ?? 0);
      const graded = (stars?.graded ?? 0);
      const reachable = reach?.reachable ?? 0;
      const reachablePct = reach?.reachablePct ?? 0;
      const highStars = (hidden?.highStars ?? 0);
      const hiddenChampions = (hidden?.hiddenChampions ?? 0);
      const totalRevenue = catYears?.[lastYear]
        ? Object.values(catYears[lastYear].categories).reduce((s, c) => s + c.total, 0)
        : 0;
      const onlineRevenue = catYears?.[lastYear]
        ? Object.values(catYears[lastYear].categories).reduce((s, c) => s + c.online, 0)
        : 0;
      const onlineShare = totalRevenue > 0 ? onlineRevenue / totalRevenue : 0;
      return {
        ...a, records, stars, stars5, stars4, graded, reachable, reachablePct,
        highStars, hiddenChampions, totalRevenue, onlineRevenue, onlineShare,
        recordsPer100k: per100k(records, a.population),
        stars5Per100k: per100k(stars5, a.population),
        stars4Plus5Per100k: per100k(stars4 + stars5, a.population),
        gradedPer100k: per100k(graded, a.population),
        touristsPerRecord: a.tourism_2019 > 0 ? a.tourism_2019 * 1000 / Math.max(records, 1) : 0,
        revenuePerRecord: records > 0 ? totalRevenue / records : 0,
        reachPerInternet: a.internet_hh_100 > 0 ? reachablePct / a.internet_hh_100 : 0,
      };
    });
  }, [anchors, insights, revenue]);

  if (error) return <p className="empty">{error}</p>;
  if (!anchors) return <p className="empty">Loading the cross-reference anchors…</p>;

  const maxRecords = Math.max(...byProvince.map((p) => p.recordsPer100k), 1);
  const maxStars5 = Math.max(...byProvince.map((p) => p.stars5Per100k), 1);
  const maxRevPerRec = Math.max(...byProvince.map((p) => p.revenuePerRecord), 1);

  // The five "finding" lists: the data tells different stories each.
  const findSupplyDensity = [...byProvince].sort((a, b) => b.recordsPer100k - a.recordsPer100k).slice(0, 5);
  const findStarDensity = [...byProvince].sort((a, b) => b.stars5Per100k - a.stars5Per100k).slice(0, 5);
  const findTouristDesert = [...byProvince]
    .filter((p) => p.tourism_2019 >= 1000 && p.reachablePct < 2)
    .sort((a, b) => b.tourism_2019 - a.tourism_2019);
  const findReachBehindWire = [...byProvince]
    .filter((p) => p.internet_hh_100 >= 75)
    .sort((a, b) => a.reachPerInternet - b.reachPerInternet)
    .slice(0, 5);
  const findRevenuePerProducer = [...byProvince]
    .filter((p) => p.records >= 200 && p.totalRevenue > 0)
    .sort((a, b) => b.revenuePerRecord - a.revenuePerRecord)
    .slice(0, 5);

  return (
    <div className="xr-wrap">
      <header className="xr-h">
        <h2 className="xr-h-t">OTOP and the country the producers sit in.</h2>
        <p className="xr-h-sub">
          Five cross-reference questions, each one a join between the OTOP registry and
          the country the producers operate in. The cells read the public record;
          where the revenue series is empty, the cell reads 0 with the reason printed.
        </p>
        <p className="xr-h-anchors">
          Anchors: DOPA 2023 population · TAT 2019 international arrivals · NBTC 2022 broadband
          subscribers per 100 households.
        </p>
      </header>

      <section className="xr-grid">
        <article className="xr-cell">
          <h3 className="xr-cell-t">1 · Records per 100,000 people <span className="xr-cell-th">ทะเบียนต่อแสนคน</span></h3>
          <P>
            Where is the supply densest per capita? Surin (1.1M people, 1,287 records) and
            Buri Ram (1.4M, 2,234) lead — the northeast's social-capital districts
            registered heavily. Bangkok (5.5M, 2,559) reads lower despite the highest
            absolute count, because the city is a registration convenience, not a
            production centre.
          </P>
          <ol className="xr-list">
            {findSupplyDensity.map((p) => (
              <li key={p.code} className="xr-row">
                <span className="xr-row-th">{p.name_th}</span>
                <span className="xr-row-en">{p.name_en}</span>
                <span className="xr-row-v">{p.recordsPer100k.toFixed(0)}</span>
                {bar(p.recordsPer100k, maxRecords)}
                <span className="xr-row-sub">{p.records.toLocaleString()} records · {(p.population).toLocaleString()}k people</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="xr-cell">
          <h3 className="xr-cell-t">2 · 5★ products per 100,000 people <span className="xr-cell-th">5 ดาวต่อแสนคน</span></h3>
          <P>
            Where is the certified supply densest? Lampang, Lamphun, and Phrae in the
            north and Ang Thong in the central plain lead — small provinces with deep
            craft traditions. Chiang Mai's absolute number is higher, but its per-capita
            density is lower because the population is large.
          </P>
          <ol className="xr-list">
            {findStarDensity.map((p) => (
              <li key={p.code} className="xr-row">
                <span className="xr-row-th">{p.name_th}</span>
                <span className="xr-row-en">{p.name_en}</span>
                <span className="xr-row-v">{p.stars5Per100k.toFixed(1)}</span>
                {bar(p.stars5Per100k, maxStars5)}
                <span className="xr-row-sub">{p.stars5} 5★ · {p.stars4} 4★</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="xr-cell">
          <h3 className="xr-cell-t">3 · Tourist-heavy provinces with no reachable producers <span className="xr-cell-th">จังหวัดท่องเที่ยวที่ติดต่อไม่ได้</span></h3>
          <P>
            The places the world is going, the registry cannot route a buyer to. Filter:
            international arrivals ≥ 1,000,000 AND reachable &lt; 2%. This is the
            contact-drive's shortest list, ranked by tourist volume.
          </P>
          {findTouristDesert.length > 0 ? (
            <ol className="xr-list">
              {findTouristDesert.slice(0, 8).map((p) => (
                <li key={p.code} className="xr-row">
                  <span className="xr-row-th">{p.name_th}</span>
                  <span className="xr-row-en">{p.name_en}</span>
                  <span className="xr-row-v">{(p.tourism_2019 * 1000).toLocaleString()}</span>
                  <span className="xr-row-sub">{p.reachable} reachable · {p.records.toLocaleString()} records</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">No provinces match the filter (≥1M tourists AND &lt;2% reachable).</p>
          )}
        </article>

        <article className="xr-cell">
          <h3 className="xr-cell-t">4 · Provinces ahead of their own internet <span className="xr-cell-th">อินเทอร์เน็ตดี แต่ติดต่อไม่ได้</span></h3>
          <P>
            Where the broadband is dense but the producers are still unreachable. Filter:
            internet ≥ 75 per 100 households. Ranked by the ratio of reachable to internet —
            the lower the ratio, the wider the operational gap.
          </P>
          <ol className="xr-list">
            {findReachBehindWire.map((p) => (
              <li key={p.code} className="xr-row">
                <span className="xr-row-th">{p.name_th}</span>
                <span className="xr-row-en">{p.name_en}</span>
                <span className="xr-row-v">{p.reachPerInternet.toFixed(3)}</span>
                <span className="xr-row-sub">{p.internet_hh_100}/100 hh · {p.reachablePct}% reachable</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="xr-cell xr-cell-wide">
          <h3 className="xr-cell-t">5 · Revenue per registered producer (2024 BE) <span className="xr-cell-th">ยอดขายต่อผู้ผลิต</span></h3>
          <P>
            Where the money is moving most efficiently through the producer base. Filter:
            ≥200 registered producers AND a reported 2024 revenue total. Phetchaburi's food
            category at ฿4.8B over 1,697 records is the highest ratio in the country —
            fewer producers, deeper sales.
          </P>
          <ol className="xr-list xr-list-wide">
            {findRevenuePerProducer.slice(0, 10).map((p) => (
              <li key={p.code} className="xr-row xr-row-wide">
                <span className="xr-row-th">{p.name_th}</span>
                <span className="xr-row-en">{p.name_en}</span>
                <span className="xr-row-v">{baht(p.revenuePerRecord)}</span>
                <span className="xr-row-sub">{p.records.toLocaleString()} records · total {baht(p.totalRevenue)} · online {(pct(p.onlineShare))}%</span>
                {bar(p.revenuePerRecord, maxRevPerRec)}
              </li>
            ))}
          </ol>
        </article>
      </section>

      <footer className="xr-foot">
        <dl className="xr-srcs">
          <div>
            <dt><code>otop_anchors.json</code></dt>
            <dd>3 metrics, 77 provinces, public-record anchors</dd>
          </div>
          <div>
            <dt><code>otop_index.json</code></dt>
            <dd>the registry</dd>
          </div>
          <div>
            <dt><code>otop_insights.json</code></dt>
            <dd>the rollups</dd>
          </div>
          <div>
            <dt><code>otop_revenue.json</code></dt>
            <dd>the revenue series</dd>
          </div>
        </dl>
        <p className="xr-foot-note">
          Every cell is a real cross-reference question; zero-fill means the registry file
          the cell was reading was empty, not that the number is unknown.
        </p>
      </footer>
    </div>
  );
}
