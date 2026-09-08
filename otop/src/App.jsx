import { useEffect, useMemo, useState } from 'react';
import ProvenanceBanner from './components/ProvenanceBanner.jsx';
import Meters from './components/Meters.jsx';
import RecordRows from './components/RecordRows.jsx';
import { loadRegistry } from './lib/load.js';
import { CATEGORY_LABEL, REGION_LABEL } from './lib/labels.js';

const PAGE = 60;

function Gauge({ n, label, th }) {
  return (
    <div className="gauge">
      <div className="gauge-n">{n}</div>
      <div className="gauge-l">{label}</div>
      <div className="gauge-th">{th}</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [category, setCategory] = useState('');
  const [minStars, setMinStars] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    loadRegistry()
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }); })
      .catch((error) => { if (!cancelled) setState({ status: 'error', error: error.message }); });
    return () => { cancelled = true; };
  }, []);

  const records = state.status === 'ready' ? state.records : [];
  const insights = state.status === 'ready' ? state.insights : null;

  const provinceOptions = useMemo(() => {
    const seen = new Map();
    for (const record of records) {
      if (record.provinceCode == null) continue;
      if (region && record.region !== region) continue;
      if (!seen.has(record.provinceCode)) seen.set(record.provinceCode, record.province);
    }
    return [...seen.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'th'));
  }, [records, region]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const floor = minStars === '' ? null : Number(minStars);

    return records.filter((record) => {
      if (region && record.region !== region) return false;
      if (province && String(record.provinceCode) !== province) return false;
      if (category && record.category !== category) return false;
      if (floor != null && (record.stars == null || record.stars < floor)) return false;
      if (!needle) return true;
      return [record.productName, record.producerName, record.province, record.district, record.subdistrict]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [records, query, region, province, category, minStars]);

  // Reset paging whenever the filter set changes, so "show more" never carries
  // an offset from a previous, larger result set.
  useEffect(() => { setLimit(PAGE); }, [query, region, province, category, minStars]);

  if (state.status === 'loading') {
    return <div className="state"><h1>Loading the registry…</h1></div>;
  }

  if (state.status === 'error') {
    return (
      <div className="state err">
        <h1>The registry could not be loaded</h1>
        <p>{state.error}</p>
        <p>
          Nothing is shown rather than something substituted. Build the artefacts with{' '}
          <code>npm run otop:build</code>.
        </p>
      </div>
    );
  }

  const { meta } = state;
  const national = insights?.national;

  return (
    <div className="shell">
      <header className="hdr">
        {/* Nav and status only. The wordmark lives in the hero and appears once
            per viewport — two stacked wordmarks read as an unfinished template. */}
        <div className="wrap hdr-in">
          <nav className="hdr-nav">
            <button type="button" aria-current="true">Registry</button>
            <a href="#provinces"><button type="button">Provinces</button></a>
            <a href="#method"><button type="button">Method</button></a>
          </nav>
          <div className="hdr-status">
            <span className={`dot${meta.degraded ? ' warn' : ''}`} />
            <span>{meta.degraded ? 'FIXTURE' : 'data.go.th'}</span>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap">
            <h1 className="hero-mark">one<span className="mid">·</span>tambon</h1>
            <p className="hero-th">หนึ่งตำบล หนึ่งผลิตภัณฑ์</p>
            <p className="hero-sub">
              Thailand's OTOP registry, read as data rather than as a brochure. Every record
              carries the dataset it came from, how complete it is, and how many independent
              government sources attest it.
            </p>

            <div className="gauges">
              <Gauge n={national?.records?.toLocaleString() ?? '—'} label="Records" th="รายการ" />
              <Gauge n={national?.producers?.toLocaleString() ?? '—'} label="Producers" th="ผู้ผลิต" />
              <Gauge n={`${national?.provincesCovered ?? '—'}/77`} label="Provinces" th="จังหวัด" />
              <Gauge n={national?.corroboratedShare != null ? `${national.corroboratedShare}%` : '—'} label="Corroborated" th="ยืนยันหลายแหล่ง" />
              <Gauge n={national?.vintage?.latest ?? '—'} label="Latest filing" th="ปีล่าสุด" />
            </div>
          </div>
        </section>

        <div className="wrap">
          <ProvenanceBanner meta={meta} />
        </div>

        <section className="sec">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">Condition of the record</h2>
              <span className="sec-n">
                what the registry knows about itself · {national?.records?.toLocaleString() ?? 0} records
              </span>
            </div>
            <Meters completeness={national?.completeness} />
          </div>
        </section>

        <section className="sec" id="registry">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">Registry</h2>
              <span className="sec-n">
                {filtered.length.toLocaleString()} of {records.length.toLocaleString()} records
              </span>
            </div>

            <div className="filters">
              <div className="field">
                <label htmlFor="q">Search · ค้นหา</label>
                <input
                  id="q" type="search" value={query} placeholder="product, producer, district"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="region">Region · ภาค</label>
                <select id="region" value={region} onChange={(event) => { setRegion(event.target.value); setProvince(''); }}>
                  <option value="">All</option>
                  {Object.entries(REGION_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="province">Province · จังหวัด</label>
                <select id="province" value={province} onChange={(event) => setProvince(event.target.value)}>
                  <option value="">All</option>
                  {provinceOptions.map(([code, name]) => <option key={code} value={String(code)}>{name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="category">Category · ประเภท</label>
                <select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All</option>
                  {Object.entries(CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="stars">Min OPC · ดาว</label>
                <select id="stars" value={minStars} onChange={(event) => setMinStars(event.target.value)}>
                  <option value="">Any</option>
                  {[5, 4, 3, 2, 1].map((s) => <option key={s} value={String(s)}>{'★'.repeat(s)}</option>)}
                </select>
              </div>
              <button
                type="button" className="reset"
                onClick={() => { setQuery(''); setRegion(''); setProvince(''); setCategory(''); setMinStars(''); }}
              >
                Reset
              </button>
            </div>

            <RecordRows records={filtered.slice(0, limit)} />

            {filtered.length > limit && (
              <div className="more">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="sec" id="provinces">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">Provinces</h2>
              <span className="sec-n">
                top-10 concentration {insights?.concentration?.top10Share ?? '—'}% ·{' '}
                {insights?.concentration?.emptyProvinces ?? '—'} provinces with no record
              </span>
            </div>

            <div className="pscroll">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Province</th>
                  <th>Region</th>
                  <th className="num">Records</th>
                  <th className="num">Producers</th>
                  <th className="num">Reachable</th>
                  <th className="num">Graded</th>
                  <th className="num">Latest</th>
                </tr>
              </thead>
              <tbody>
                {(insights?.byProvince ?? []).filter((p) => p.records > 0).map((p) => {
                  const top = insights.byProvince[0]?.records || 1;
                  return (
                    <tr key={p.code}>
                      <td>
                        <span className="th-name">{p.th}</span> <span className="en">{p.en}</span>
                        <span className="bar" style={{ width: `${Math.max(2, (p.records / top) * 100)}%` }} />
                      </td>
                      <td>{REGION_LABEL[p.region]}</td>
                      <td className="num">{p.records.toLocaleString()}</td>
                      <td className="num">{p.producers.toLocaleString()}</td>
                      <td className="num">{p.completeness.withContact ?? '—'}%</td>
                      <td className="num">{p.completeness.withStars ?? '—'}%</td>
                      <td className="num">{p.vintage.latest ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        <section className="sec" id="method">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">Method</h2>
              <span className="sec-n">what these numbers are, and are not</span>
            </div>
            <div className="ftr">
              <p>
                Records are pulled from CKAN datasets published on data.go.th, mapped onto a single
                schema by discovering each resource's columns rather than assuming them, and resolved
                into entities by unioning shared identity signals — tax ID, telephone, source-scoped
                registration number, and name-within-an-administrative-area.
              </p>
              <p>
                A telephone number appearing in more than one province is treated as a switchboard
                rather than an identity and withdrawn, because a shared district office line would
                otherwise collapse every producer around it into one record.
              </p>
              <p>
                <strong>These counts measure the registry, not the economy.</strong> A province with an
                active provincial office files more rows than a province with more producers and less
                paperwork. Concentration figures should be read as a map of administrative effort
                first and of production second.
              </p>
              <p>
                Contributing sources:{' '}
                {(insights?.contributors ?? []).map((c) => `${c.organization ?? 'unattributed'} (${c.records})`).join(' · ') || '—'}
              </p>
              <p>
                Built {meta.builtAt?.slice(0, 10)} · source <code>{meta.source}</code>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
