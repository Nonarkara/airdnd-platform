import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProvenanceBanner from './components/ProvenanceBanner.jsx';
import Meters from './components/Meters.jsx';
import RequirementPanel from './components/RequirementPanel.jsx';
import MatchRows from './components/MatchRows.jsx';
import Basins from './components/Basins.jsx';

// Leaflet is ~150KB and only the B2B lens draws a map. Split it so the B2C
// path never pays for it.
const ProvinceMap = lazy(() => import('./components/ProvinceMap.jsx'));
// Atlas is the whole national rollup and only the Atlas view draws it.
const Atlas = lazy(() => import('./components/Atlas.jsx'));
import { loadIndex, loadShards, planShards } from './lib/shards.js';
import { loadInsights } from './lib/insights.js';
import { matchRequirement, sourcingBasins, toCsv, PROFILES } from '../core/matching.js';

const PAGE = 60;

const EMPTY = {
  categories: [], provinceCodes: [], regions: [],
  minStars: null, maxFilingAge: null,
  requireContact: false, requireCorroborated: false,
  query: '',
};

/** The requirement round-trips through the URL so a brief can be sent as a link. */
function requirementFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const list = (k) => (p.get(k) ? p.get(k).split(',').filter(Boolean) : []);
  const num = (k) => (p.get(k) ? Number(p.get(k)) : null);
  return {
    lens: p.get('lens') === 'b2c' ? 'b2c' : 'b2b',
    requirement: {
      categories: list('cat'),
      provinceCodes: list('prov').map(Number),
      regions: list('region'),
      minStars: num('stars'),
      maxFilingAge: num('age'),
      requireContact: p.get('contact') === '1',
      requireCorroborated: p.get('corr') === '1',
      query: p.get('q') ?? '',
    },
  };
}

function requirementToUrl(view, lens, r) {
  const p = new URLSearchParams();
  if (view === 'atlas') p.set('view', 'atlas');
  p.set('lens', lens);
  if (r.categories.length) p.set('cat', r.categories.join(','));
  if (r.provinceCodes.length) p.set('prov', r.provinceCodes.join(','));
  if (r.regions.length) p.set('region', r.regions.join(','));
  if (r.minStars != null) p.set('stars', String(r.minStars));
  if (r.maxFilingAge != null) p.set('age', String(r.maxFilingAge));
  if (r.requireContact) p.set('contact', '1');
  if (r.requireCorroborated) p.set('corr', '1');
  if (r.query) p.set('q', r.query);
  return `${window.location.pathname}?${p.toString()}`;
}

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
  const initial = useRef(requirementFromUrl());
  const [state, setState] = useState({ status: 'loading' });
  const [lens, setLens] = useState(initial.current.lens);
  const [view, setView] = useState(() => (new URLSearchParams(window.location.search).get('view') === 'atlas' ? 'atlas' : 'match'));
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [requirement, setRequirement] = useState(initial.current.requirement);
  const [records, setRecords] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loadingShards, setLoadingShards] = useState(false);
  const [shardError, setShardError] = useState(null);
  const [forceAll, setForceAll] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    loadIndex()
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }); })
      .catch((error) => { if (!cancelled) setState({ status: 'error', error: error.message }); });
    return () => { cancelled = true; };
  }, []);

  const index = state.status === 'ready' ? state.index : null;

  // Which shards this requirement needs. Recomputed from the index, which is
  // cheap; fetching them is what costs, and that is guarded below.
  const wanted = useMemo(() => {
    if (!index) return null;
    return planShards(index, {
      categories: requirement.categories,
      provinceCodes: requirement.provinceCodes,
      regions: requirement.regions,
      budget: forceAll ? Number.POSITIVE_INFINITY : 40_000,
    });
  }, [index, requirement.categories, requirement.provinceCodes, requirement.regions, forceAll]);

  const wantedKey = wanted ? wanted.codes.join(',') : '';
  const loadedKey = useRef('');

  useEffect(() => {
    if (!wanted || wantedKey === loadedKey.current) return;
    let cancelled = false;
    setLoadingShards(true);
    setShardError(null);
    loadShards(wanted.codes)
      .then((rows) => {
        if (cancelled) return;
        loadedKey.current = wantedKey;
        setRecords(rows);
        setPlan(wanted);
      })
      // A shard that fails to load must not leave the previous province's
      // records on screen under the new heading — that is the silent-substitute
      // failure this project has shipped once already.
      .catch((error) => { if (!cancelled) { setRecords([]); setPlan(null); setShardError(error.message); } })
      .finally(() => { if (!cancelled) setLoadingShards(false); });
    return () => { cancelled = true; };
  }, [wanted, wantedKey]);

  useEffect(() => {
    if (view !== 'atlas' || insights || insightsError) return;
    let cancelled = false;
    loadInsights()
      .then((data) => { if (!cancelled) setInsights(data); })
      .catch((error) => { if (!cancelled) setInsightsError(error.message); });
    return () => { cancelled = true; };
  }, [view, insights, insightsError]);

  useEffect(() => {
    window.history.replaceState(null, '', requirementToUrl(view, lens, requirement));
  }, [view, lens, requirement]);

  useEffect(() => { setLimit(PAGE); }, [lens, requirement]);

  const result = useMemo(
    () => matchRequirement(records, { ...requirement, profile: lens }),
    [records, requirement, lens],
  );

  // Two different questions, two different cuts of the same rollup.
  //
  // The MAP must show every province holding matching supply. Feeding it only
  // basins (depth >= 2) drew an empty map while six matching producers sat in
  // the table below it — a reader would reasonably conclude there was no supply
  // anywhere, which is the opposite of the truth.
  //
  // The BASIN CARDS answer the narrower question: where is supply deep enough
  // that one sourcing trip is worth taking?
  const mapProvinces = useMemo(() => sourcingBasins(result.matches, { minDepth: 1, top: 77 }), [result.matches]);
  const basins = useMemo(() => sourcingBasins(result.matches), [result.matches]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([toCsv(result.matches)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otop-shortlist-${lens}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result.matches, lens]);

  if (state.status === 'loading') return <div className="state"><h1>Loading the registry index…</h1></div>;

  if (state.status === 'error') {
    return (
      <div className="state err">
        <h1>The registry could not be loaded</h1>
        <p>{state.error}</p>
        <p>Nothing is shown rather than something substituted. Build the artefacts with <code>npm run otop:build</code>.</p>
      </div>
    );
  }

  const { meta } = state;
  const totals = index.totals;

  return (
    <div className="shell">
      <header className="hdr">
        {/* Nav and status only. The wordmark lives in the hero and appears once
            per viewport — two stacked wordmarks read as an unfinished template. */}
        <div className="wrap hdr-in">
          <nav className="hdr-nav">
            <button type="button" aria-current={view === 'match' && lens === 'b2b'} onClick={() => { setView('match'); setLens('b2b'); }}>Source · B2B</button>
            <button type="button" aria-current={view === 'match' && lens === 'b2c'} onClick={() => { setView('match'); setLens('b2c'); }}>Discover · B2C</button>
            <button type="button" aria-current={view === 'atlas'} onClick={() => setView('atlas')}>Atlas</button>
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
              Thailand's OTOP registry as a working directory for matching demand to supply.
              State a requirement; get a ranked shortlist, the reason for the ranking, and an
              explicit account of what the registry cannot tell you.
            </p>

            <div className="gauges">
              <Gauge n={totals.records.toLocaleString()} label="Records" th="รายการ" />
              <Gauge n={totals.producers.toLocaleString()} label="Producers" th="ผู้ผลิต" />
              <Gauge n={`${totals.provincesWithRecords}/77`} label="Provinces" th="จังหวัด" />
              <Gauge n={meta.counts.duplicatesCollapsed.toLocaleString()} label="Duplicates collapsed" th="รวมซ้ำ" />
              <Gauge n={meta.shardCount} label="Shards" th="ชุดข้อมูล" />
            </div>
          </div>
        </section>

        <div className="wrap"><ProvenanceBanner meta={meta} /></div>

        {view === 'match' && (<>
        <section className="sec" id="match">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">{PROFILES[lens].label}</h2>
              <span className="sec-n">
                {lens === 'b2b'
                  ? 'ranked for due diligence: grading, corroboration and filing age carry more weight'
                  : 'ranked for reach: a producer you can contact and locate carries more weight'}
              </span>
            </div>

            <RequirementPanel
              requirement={requirement}
              onChange={setRequirement}
              lens={lens}
              provinces={index.provinces}
            />

            {/* Coverage. A partial result presented as a national one is the
                single most misleading thing this page could do. */}
            <div className="coverage">
              {loadingShards && <span>Loading provinces…</span>}
              {shardError && <span className="cov-err">Province data failed to load — {shardError}</span>}
              {!loadingShards && !shardError && plan && (
                <>
                  <span>
                    Searched <strong>{plan.provincesChosen}</strong> of {plan.provincesAvailable} provinces
                    holding matching stock · {plan.recordsChosen.toLocaleString()} records loaded
                    {plan.complete ? '' : ` · ${plan.coverage}% of relevant records`}
                  </span>
                  {!plan.complete && (
                    <button type="button" className="reset" onClick={() => setForceAll(true)}>
                      Search all Thailand
                    </button>
                  )}
                </>
              )}
            </div>

            {lens === 'b2b' && (
              <>
                <h3 className="sub-h">
                  Supply geography · {mapProvinces.length} province{mapProvinces.length === 1 ? '' : 's'} hold matching supply
                </h3>
                <Suspense fallback={<div className="map-skeleton">Loading map…</div>}>
                  <ProvinceMap
                    basins={mapProvinces}
                    degraded={meta.degraded}
                    onSelectProvince={(code) => setRequirement((r) => ({ ...r, provinceCodes: [code] }))}
                  />
                </Suspense>
                <h3 className="sub-h">Sourcing basins · two or more producers in one province</h3>
                <Basins basins={basins} total={mapProvinces.length} />
              </>
            )}

            <div className="results-h">
              <h3 className="sub-h">
                {result.matches.length.toLocaleString()} matching producers
              </h3>
              {result.matches.length > 0 && (
                <button type="button" className="reset" onClick={exportCsv}>Export shortlist (CSV)</button>
              )}
            </div>

            <MatchRows matches={result.matches} limit={limit} />

            {result.matches.length > limit && (
              <div className="more">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, result.matches.length - limit)} more
                </button>
              </div>
            )}

            <div className="caveats">
              <p className="prov-h">What this ranking does not know</p>
              <ul>{result.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">Condition of the record</h2>
              <span className="sec-n">across the {plan?.recordsChosen.toLocaleString() ?? 0} loaded records</span>
            </div>
            <Meters completeness={completenessOf(records)} />
          </div>
        </section>
        </>)}

        {view === 'atlas' && (
          <section className="sec" id="atlas">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">Atlas</h2>
                <span className="sec-n">the whole registry as one information package — and the zones it left blank</span>
              </div>
              {insightsError && (
                <p className="empty">The national rollup could not be loaded — {insightsError}. Nothing is shown rather than something substituted.</p>
              )}
              {!insights && !insightsError && <p className="empty">Loading the national rollup…</p>}
              {insights && (
                <Suspense fallback={<p className="empty">Loading the national rollup…</p>}>
                  <Atlas insights={insights} />
                </Suspense>
              )}
            </div>
          </section>
        )}

        <section className="sec" id="method">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">Method</h2>
              <span className="sec-n">what these numbers are, and are not</span>
            </div>
            <div className="ftr">
              <p>
                Records come from CKAN datasets published on data.go.th, mapped onto one schema by
                discovering each resource's columns rather than assuming them, and resolved into
                entities by unioning shared identity signals — tax ID, telephone, source-scoped
                registration number, and name-within-an-administrative-area. A telephone appearing
                in more than one province is treated as a switchboard and withdrawn as identity.
              </p>
              <p>
                <strong>The fit score ranks only what the registry attests</strong> — contactability,
                OPC grading, filing recency, cross-agency corroboration and how precisely the
                producer is located. It does not model capacity, price or reliability, because the
                registry holds none of those. Hover any score to see its components.
              </p>
              <p>
                <strong>These counts measure the registry, not the economy.</strong> A province with an
                active provincial office files more rows than a province with more producers and
                less paperwork.
              </p>
              <p>Built {meta.builtAt?.slice(0, 10)} · source <code>{meta.source}</code> · {meta.shardCount} province shards</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

function completenessOf(records) {
  const n = records.length;
  if (n === 0) return null;
  return {
    records: n,
    withContact: pct(records.filter((r) => r.phone || r.email || r.website).length, n),
    withStars: pct(records.filter((r) => r.stars != null).length, n),
    withPrice: pct(records.filter((r) => r.price != null).length, n),
    withSubdistrict: pct(records.filter((r) => r.subdistrict).length, n),
    withCoordinates: pct(records.filter((r) => r.latitude != null && r.longitude != null).length, n),
    categoryDeclared: pct(records.filter((r) => r.categoryConfidence === 'declared').length, n),
  };
}
