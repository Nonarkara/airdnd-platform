import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProvenanceBanner from './components/ProvenanceBanner.jsx';
import Meters from './components/Meters.jsx';
import RequirementPanel from './components/RequirementPanel.jsx';
import MatchRows from './components/MatchRows.jsx';
import Basins from './components/Basins.jsx';
import NationalStory from './components/NationalStory.jsx';
import Champions from './components/Champions.jsx';
import DemandTides from './components/DemandTides.jsx';
import Matchmaker from './components/Matchmaker.jsx';
import History from './components/History.jsx';
import CrossReferences from './components/CrossReferences.jsx';

// Leaflet is ~150KB and only the B2B lens draws a map. Split it so the B2C
// path never pays for it.
const ProvinceMap = lazy(() => import('./components/ProvinceMap.jsx'));
// Atlas is the whole national rollup and only the Atlas view draws it.
const Atlas = lazy(() => import('./components/Atlas.jsx'));
// One province, whole — the shareable unit of reading. Only drawn on demand.
const ProvinceDossier = lazy(() => import('./components/ProvinceDossier.jsx'));
// Briefs are the shareable infographic cards. Only drawn on demand.
const Briefs = lazy(() => import('./components/Briefs.jsx'));
import { loadIndex, loadShards, planShards } from './lib/shards.js';
import { loadInsights, loadGraph } from './lib/insights.js';
import { matchRequirement, sourcingBasins, toCsv, PROFILES } from '../core/matching.js';

const PAGE = 60;

const EMPTY = {
  categories: [], provinceCodes: [], regions: [],
  minStars: null, maxFilingAge: null,
  requireContact: false, requireCorroborated: false,
  requireSignal: true,
  query: '',
};

/**
 * The lens picks the default strictness. Without one of these defaults, a
 * 4,288-row province returns 4,288 equally-scored stubs that say nothing
 * the interface can communicate. The user can opt out (showAll) to see the
 * full registry, but should not have to opt in to see the meaningful half.
 */
const DEFAULTS = {
  b2b: { requireCorroborated: true, requireSignal: true },
  b2c: { requireContact: true, requireSignal: true },
};

/** The requirement round-trips through the URL so a brief can be sent as a link. */
function requirementFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const list = (k) => (p.get(k) ? p.get(k).split(',').filter(Boolean) : []);
  const num = (k) => (p.get(k) ? Number(p.get(k)) : null);
  const lens = p.get('lens') === 'b2c' ? 'b2c' : 'b2b';
  const defaults = DEFAULTS[lens];
  // `all=1` is the explicit opt-out: "show the full registry, not just the
  // attested half". A reader who is doing a completeness audit, or who
  // needs to find a registered name that nobody has filled the dossier in
  // for, asks for it by name.
  const all = p.get('all') === '1';
  return {
    lens,
    requirement: {
      categories: list('cat'),
      provinceCodes: list('prov').map(Number),
      regions: list('region'),
      minStars: num('stars'),
      maxFilingAge: num('age'),
      requireContact: all ? false : (p.get('contact') === '1' || defaults.requireContact),
      requireCorroborated: all ? false : (p.get('corr') === '1' || defaults.requireCorroborated),
      requireSignal: all ? false : (p.get('signal') === '1' || (defaults.requireSignal && p.get('signal') !== '0')),
      query: p.get('q') ?? '',
    },
  };
}

function requirementToUrl(view, lens, r, code) {
  const p = new URLSearchParams();
  if (view === 'atlas') p.set('view', 'atlas');
  if (view === 'story') p.set('view', 'story');
  if (view === 'history') p.set('view', 'history');
  if (view === 'crossrefs') p.set('view', 'crossrefs');
  if (view === 'champions') p.set('view', 'champions');
  if (view === 'tides') p.set('view', 'tides');
  if (view === 'matchmaker') p.set('view', 'matchmaker');
  if (view === 'briefs') p.set('view', 'briefs');
  if (view === 'province' && code != null) { p.set('view', 'province'); p.set('code', String(code)); }
  // Preserve the active Atlas tab across requirement/lens changes so a user
  // who lands on `?view=atlas&tab=reach` and then changes a filter does
  // not get bounced back to the findings tab.
  const currentTab = new URLSearchParams(window.location.search).get('tab');
  if (view === 'atlas' && currentTab) p.set('tab', currentTab);
  // Preserve the active brief card + province across filter changes so a
  // shared one-pager link does not lose its card when the requirement moves.
  const currentParams = new URLSearchParams(window.location.search);
  if (view === 'briefs') {
    const card = currentParams.get('card');
    const prov = currentParams.get('prov');
    if (card) p.set('card', card);
    if (prov) p.set('prov', prov);
  }
  p.set('lens', lens);
  if (r.categories.length) p.set('cat', r.categories.join(','));
  if (r.provinceCodes.length) p.set('prov', r.provinceCodes.join(','));
  if (r.regions.length) p.set('region', r.regions.join(','));
  if (r.minStars != null) p.set('stars', String(r.minStars));
  if (r.maxFilingAge != null) p.set('age', String(r.maxFilingAge));
  if (r.requireContact) p.set('contact', '1');
  if (r.requireCorroborated) p.set('corr', '1');
  // Only emit the signal flag when the user has toggled it off the default,
  // so the URL stays clean for the common case.
  const defaults = DEFAULTS[lens];
  if (r.requireSignal && !defaults.requireSignal) p.set('signal', '1');
  if (!r.requireSignal && defaults.requireSignal) p.set('signal', '0');
  if (r.query) p.set('q', r.query);
  return `${window.location.pathname}?${p.toString()}`;
}

function Gauge({ n, label, th }) {
  return (
    <div className="gauge">
      <div className="gauge-n">{n}</div>
      <div className="gauge-l">{label}</div>
      <div className="gauge-th" lang="th">{th}</div>
    </div>
  );
}

/**
 * Bilingual chip. English is the primary, Thai sits underneath in the
 * Sao Chingcha cut. `lang="th"` on the Thai span so a screen reader
 * pronounces it correctly (without it, TTS reads Thai letters as if
 * they were Latin, producing nonsense).
 */
function Bi({ en, th, as: As = 'span' }) {
  return (
    <As className="bi">
      <span className="bi-en">{en}</span>
      {th != null && <span className="bi-th" lang="th">{th}</span>}
    </As>
  );
}

export default function App() {
  const initial = useRef(requirementFromUrl());
  const [state, setState] = useState({ status: 'loading' });
  const [lens, setLens] = useState(initial.current.lens);
  // Atlas is the home view: the headline findings + specialization +
  // quality leaders + 77-province rollup. The match view is a tool a buyer
  // reaches for when they have a specific sourcing brief; landing there
  // first would show 3,665 of a province's records before telling the
  // reader what any of them mean.
  const [view, setView] = useState(() => {
    const urlView = new URLSearchParams(window.location.search).get('view');
    if (['match', 'atlas', 'province', 'story', 'history', 'crossrefs', 'champions', 'tides', 'matchmaker', 'briefs'].includes(urlView)) return urlView;
    return 'atlas';
  });
  const [provinceCode, setProvinceCode] = useState(() => {
    const c = Number(new URLSearchParams(window.location.search).get('code'));
    return Number.isInteger(c) && c > 0 ? c : null;
  });
  // Every province row anywhere lands here: the dossier, not the B2B engine.
  const openProvince = useCallback((code) => {
    if (code == null) { setView('atlas'); setProvinceCode(null); }
    else { setView('province'); setProvinceCode(code); }
    window.scrollTo({ top: 0 });
  }, []);
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [requirement, setRequirement] = useState(initial.current.requirement);
  const openMatchWithProvince = useCallback((selectedLens, code) => {
    if (selectedLens) setLens(selectedLens);
    setRequirement((r) => ({ ...r, provinceCodes: code ? [code] : [] }));
    setView('match');
    window.scrollTo({ top: 0 });
  }, []);
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
    if ((view !== 'atlas' && view !== 'province') || insights || insightsError) return;
    let cancelled = false;
    Promise.all([loadInsights(), loadGraph().catch(() => null)])
      .then(([data, graph]) => { if (!cancelled) setInsights(graph ? { ...data, graph } : data); })
      .catch((error) => { if (!cancelled) setInsightsError(error.message); });
    return () => { cancelled = true; };
  }, [view, insights, insightsError]);

  useEffect(() => {
    window.history.replaceState(null, '', requirementToUrl(view, lens, requirement, provinceCode));
  }, [view, lens, requirement, provinceCode]);

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
            <button type="button" aria-current={view === 'match' && lens === 'b2b'} onClick={() => { setView('match'); setLens('b2b'); }}>
              <Bi en="Source" th="แหล่ง" /> · <Bi en="B2B" th="ธุรกิจสู่ธุรกิจ" />
            </button>
            <button type="button" aria-current={view === 'match' && lens === 'b2c'} onClick={() => { setView('match'); setLens('b2c'); }}>
              <Bi en="Discover" th="ค้นพบ" /> · <Bi en="B2C" th="ธุรกิจสู่ผู้บริโภค" />
            </button>
            <button type="button" aria-current={view === 'atlas'} onClick={() => openProvince(null)}>
              <Bi en="Atlas" th="แผนที่ข้อมูล" />
            </button>
            <button type="button" aria-current={view === 'matchmaker'} onClick={() => setView('matchmaker')}>
              <Bi en="Matchmaker" th="จับคู่" />
            </button>
            <button type="button" aria-current={view === 'briefs'} onClick={() => setView('briefs')}>
              <Bi en="Briefs" th="สรุป" />
            </button>
            <button type="button" aria-current={view === 'tides'} onClick={() => setView('tides')}>
              <Bi en="Tides" th="กระแส" />
            </button>
            <button type="button" aria-current={view === 'champions'} onClick={() => setView('champions')}>
              <Bi en="Champions" th="แชมป์" />
            </button>
            <button type="button" aria-current={view === 'story'} onClick={() => setView('story')}>
              <Bi en="Story" th="เรื่องเล่า" />
            </button>
            <button type="button" aria-current={view === 'history'} onClick={() => setView('history')}>
              <Bi en="History" th="25 ปี" />
            </button>
            <button type="button" aria-current={view === 'crossrefs'} onClick={() => setView('crossrefs')}>
              <Bi en="Cross-refs" th="เชื่อมโยง" />
            </button>
            {view === 'province' && <button type="button" aria-current>
              <Bi en="Province" th="จังหวัด" />
            </button>}
            <a href="#method"><button type="button"><Bi en="Method" th="วิธีการ" /></button></a>
          </nav>
          <div className="hdr-status">
            <span className={`dot${meta.degraded ? ' warn' : ''}`} />
            <Bi en={meta.degraded ? 'Fixture' : 'data.go.th'} th={meta.degraded ? 'ข้อมูลทดสอบ' : 'แหล่งข้อมูล'} />
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap">
            <h1 className="hero-mark">one<span className="mid">³</span></h1>
            <p className="hero-mark-sub">One Tambon · One Product · One Platform</p>
            <p className="hero-th">หนึ่งตำบล หนึ่งผลิตภัณฑ์ หนึ่งแพลตฟอร์ม</p>
            <p className="hero-sub">
              Thailand's OTOP registry as a working directory for matching demand to supply.
              State a requirement; get a ranked shortlist, the reason for the ranking, and an
              explicit account of what the registry cannot tell you.
            </p>

            {/* A shared province link opens on a phone: the province, not the
                national gauges, must be the first thing under the wordmark. */}
            {view !== 'province' && <div className="gauges">
              <Gauge n={totals.records.toLocaleString()} label="Records" th="รายการ" />
              <Gauge n={totals.producers.toLocaleString()} label="Producers" th="ผู้ผลิต" />
              <Gauge n={`${totals.provincesWithRecords}/77`} label="Provinces" th="จังหวัด" />
              <Gauge n={meta.counts.duplicatesCollapsed.toLocaleString()} label="Duplicates collapsed" th="รวมซ้ำ" />
              <Gauge n={meta.shardCount} label="Shards" th="ชุดข้อมูล" />
            </div>}
          </div>
        </section>

        {view !== 'province' && <div className="wrap"><ProvenanceBanner meta={meta} /></div>}

        {view === 'match' && (<>
        <section className="sec" id="match">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">{PROFILES[lens].label}</h2>
              <span className="sec-n">
                {lens === 'b2b' ? (
                  <Bi
                    en="ranked for due diligence: grading, corroboration and filing age carry more weight"
                    th="จัดอันดับตามการตรวจสอบ: คะแนน OPC, การรับรองข้ามหน่วยงาน และอายุการยื่นทะเบียน"
                  />
                ) : (
                  <Bi
                    en="ranked for reach: a producer you can contact and locate carries more weight"
                    th="จัดอันดับตามการเข้าถึง: ผู้ผลิตที่ติดต่อได้และระบุตำแหน่งได้"
                  />
                )}
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
                      <Bi en="Search all Thailand" th="ค้นหาทั้งประเทศ" />
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
                    records={result.matches}
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
                <Bi
                  en={`${result.matches.length.toLocaleString()} matching producers`}
                  th={`${result.matches.length.toLocaleString()} ผู้ผลิตที่ตรงกับเงื่อนไข`}
                />
                {requirement.requireSignal && result.matches.length < result.total && (
                  <span className="filter-note">
                    <Bi
                      en={` · of ${result.total.toLocaleString()} in the loaded provinces`}
                      th={` · จาก ${result.total.toLocaleString()} ในจังหวัดที่โหลด`}
                    />
                  </span>
                )}
              </h3>
              {result.matches.length > 0 && (
                <button type="button" className="reset" onClick={exportCsv}>
                  <Bi en="Export shortlist" th="ส่งออกรายชื่อ" /> <span className="muted">(CSV)</span>
                </button>
              )}
            </div>

            {requirement.requireSignal && result.matches.length < result.total && (
              <p className="filter-explain">
                <Bi
                  en="Showing records with at least one real attestation — a category, a contact channel, a star grade, or a product name distinct from the producer. The"
                  th="แสดงเฉพาะรายการที่มีการรับรองจริง — ประเภท, ช่องทางติดต่อ, คะแนน OPC, หรือชื่อผลิตภัณฑ์ต่างจากชื่อผู้ผลิต อีก"
                />{' '}{result.total.toLocaleString() - result.matches.length}{' '}
                <Bi
                  en="unattested registrations in the loaded provinces are name-only OTOP numbers and are hidden by default."
                  th="รายการที่ไม่มีการรับรองในจังหวัดที่โหลดถูกซ่อนไว้เป็นค่าเริ่มต้น (มีเพียงเลขทะเบียน OTOP เท่านั้น)"
                />{' '}
                <button type="button" className="reset" onClick={() => setRequirement((r) => ({ ...r, requireSignal: false, requireContact: false, requireCorroborated: false }))}>
                  <Bi en={`Show all ${result.total.toLocaleString()} registrations`} th={`แสดงทั้งหมด ${result.total.toLocaleString()} รายการ`} />
                </button>
              </p>
            )}

            <MatchRows matches={result.matches} limit={limit} onSelectProvince={openProvince} />

            {result.matches.length > limit && (
              <div className="more">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)}>
                  <Bi en={`Show ${Math.min(PAGE, result.matches.length - limit)} more`} th={`แสดงอีก ${Math.min(PAGE, result.matches.length - limit)} รายการ`} />
                </button>
              </div>
            )}

            <div className="caveats">
              <p className="prov-h">
                <Bi en="What this ranking does not know" th="สิ่งที่การจัดอันดับนี้ไม่รู้" />
              </p>
              <ul>{result.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">
                <Bi en="Condition of the record" th="สภาพของทะเบียน" />
              </h2>
              <span className="sec-n">
                <Bi
                  en={`across the ${(plan?.recordsChosen.toLocaleString() ?? 0)} loaded records`}
                  th={`จากข้อมูล ${(plan?.recordsChosen.toLocaleString() ?? 0)} รายการที่โหลด`}
                />
              </span>
            </div>
            <Meters completeness={completenessOf(records)} />
          </div>
        </section>
        </>)}

        {view === 'atlas' && (
          <section className="sec" id="atlas">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="Atlas" th="แผนที่ข้อมูล" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="the whole registry as one information package — and the zones it left blank"
                    th="ทะเบียนทั้งหมดในรูปแบบชุดข้อมูลเดียว — และช่องว่างที่เหลืออยู่"
                  />
                </span>
              </div>
              {insightsError && (
                <p className="empty">The national rollup could not be loaded — {insightsError}. Nothing is shown rather than something substituted.</p>
              )}
              {!insights && !insightsError && <p className="empty">Loading the national rollup…</p>}
              {insights && (
                <Suspense fallback={<p className="empty">Loading the national rollup…</p>}>
                  <Atlas insights={insights} onSelectProvince={openProvince} />
                </Suspense>
              )}
            </div>
          </section>
        )}

        {view === 'province' && (
          <section className="sec" id="province">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="Province" th="จังหวัด" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="one province, every layer — a link you can hand across a table"
                    th="หนึ่งจังหวัด ทุกชั้นข้อมูล — ลิงก์ที่ส่งต่อกันข้ามโต๊ะได้"
                  />
                </span>
              </div>
              {insightsError && <p className="empty">The national rollup could not be loaded — {insightsError}.</p>}
              {!insights && !insightsError && <p className="empty">Loading the national rollup…</p>}
              {insights && provinceCode != null && (
                <Suspense fallback={<p className="empty">Loading the province…</p>}>
                  <ProvinceDossier insights={insights} code={provinceCode} onSelectProvince={openProvince} onOpenMatch={openMatchWithProvince} />
                </Suspense>
              )}
              {insights && provinceCode == null && <p className="empty">No province code in the link.</p>}
            </div>
          </section>
        )}

        {view === 'matchmaker' && (
          <section className="sec" id="matchmaker">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="The Matchmaker" th="จับคู่" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="where the supply is, where the money already is — the triangulation one³ does for everything"
                    th="ที่ไหนมีอุปทาน ที่ไหนมีเงิน — สามเหลี่ยมเดียวที่ one³ ใช้ทุกอย่าง"
                  />
                </span>
              </div>
              <Matchmaker onSelectProvince={openProvince} />
            </div>
          </section>
        )}

        {view === 'briefs' && (
          <section className="sec" id="briefs">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="Briefs" th="สรุป" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="six forwardable cards — one number, one chart, what it means, what to do"
                    th="การ์ดหกใบพร้อมส่งต่อ — ตัวเลขหนึ่ง ค่าแผนภูมิหนึ่ง ความหมายและทางออก"
                  />
                </span>
              </div>
              <Suspense fallback={<p className="empty">Loading the briefs…</p>}>
                <Briefs insights={insights} onSelectProvince={openProvince} />
              </Suspense>
            </div>
          </section>
        )}

        {view === 'tides' && (
          <section className="sec" id="tides">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="Demand Tides" th="กระแสความต้องการ" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="77 provinces × 5 categories = 385 cells, each a 3-year revenue trajectory"
                    th="77 จังหวัด × 5 ประเภท = 385 เซลล์ แต่ละเซลล์คือแนวโน้ม 3 ปี"
                  />
                </span>
              </div>
              {insightsError && <p className="empty">The revenue artefact could not be loaded — {insightsError}.</p>}
              {!insights && !insightsError && <p className="empty">Loading the revenue artefact…</p>}
              {insights && <Suspense fallback={<p className="empty">Loading the demand grid…</p>}>
                <DemandTides revenue={insights.revenue} onSelectProvince={openProvince} />
              </Suspense>}
            </div>
          </section>
        )}

        {view === 'champions' && (
          <section className="sec" id="champions">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="Reachable Champions" th="แชมป์ที่ติดต่อได้" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="4-5★ OTOP producers the registry says CAN be reached — the buyer's starting list"
                    th="ผู้ผลิต 4-5 ดาวที่ติดต่อได้ — รายชื่อตั้งต้นสำหรับผู้ซื้อ"
                  />
                </span>
              </div>
              <Champions onSelectProvince={openProvince} />
            </div>
          </section>
        )}

        {view === 'story' && (
          <section className="sec" id="story">
            <div className="wrap">
              <NationalStory />
            </div>
          </section>
        )}

        {view === 'history' && (
          <section className="sec" id="history">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="OTOP: 25 Years" th="25 ปี" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="the seed, the boom, the silence, the platform — every event in the public record"
                    th="เมล็ดพันธุ์ ความเฟื่องฟู ความเงียบ และแพลตฟอร์ม"
                  />
                </span>
              </div>
              <History />
            </div>
          </section>
        )}

        {view === 'crossrefs' && (
          <section className="sec" id="crossrefs">
            <div className="wrap">
              <div className="sec-h">
                <h2 className="sec-t">
                  <Bi en="Cross-references" th="เชื่อมโยงข้อมูล" />
                </h2>
                <span className="sec-n">
                  <Bi
                    en="OTOP joined with the country the producers sit in — population, tourism, internet"
                    th="OTOP เชื่อมกับประเทศที่ผู้ผลิตอยู่อาศัย — ประชากร ท่องเที่ยว อินเทอร์เน็ต"
                  />
                </span>
              </div>
              <CrossReferences />
            </div>
          </section>
        )}

        <section className="sec" id="method">
          <div className="wrap">
            <div className="sec-h">
              <h2 className="sec-t">
                <Bi en="Method" th="วิธีการ" />
              </h2>
              <span className="sec-n">
                <Bi
                  en="what these numbers are, and are not"
                  th="ตัวเลขเหล่านี้คืออะไร และไม่ใช่อะไร"
                />
              </span>
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

        <footer className="cr">
          <div className="wrap cr-in">
            <div className="cr-block">
              <span className="cr-key">Architect</span>
              <span className="cr-name">Dr Non Arkaraprasertkul</span>
              <span className="cr-th">ดร. นนท์ อัครประสิทธิ์กุล</span>
              <span className="cr-line">PhD Anthropologist · Harvard · Architect · MIT</span>
              <span className="cr-line">Senior Expert, Thailand's depa</span>
            </div>
            <div className="cr-block">
              <span className="cr-key">Engineering</span>
              <span className="cr-name">Mavis</span>
              <span className="cr-th">เมวิส</span>
              <span className="cr-line">the AI assistant that built the data pipeline,</span>
              <span className="cr-line">the Atlas, the dossier, the Matchmaker, the Tides,</span>
              <span className="cr-line">the Champions, and the National Story on this site</span>
            </div>
            <div className="cr-block">
              <span className="cr-key">Data</span>
              <span className="cr-name">data.go.th</span>
              <span className="cr-line">กรมพัฒนาชุมชน · Department of Community Development</span>
              <span className="cr-line">{meta.shardCount} province shards · 154,078 producer rows</span>
              <span className="cr-line">33 months of revenue · 3 years by category</span>
            </div>
            <div className="cr-block cr-mantra">
              <p className="cr-mantra-th">หนึ่งตำบล หนึ่งผลิตภัณฑ์ หนึ่งแพลตฟอร์ม</p>
              <p className="cr-mantra-en">One Tambon · One Product · One Platform</p>
              <p className="cr-mantra-1"><span>1</span><sup>3</sup> <span>= 1</span></p>
            </div>
          </div>
          <div className="cr-legal">
            <a href="/legal/terms/">Terms of use</a>
            <span className="cr-legal-sep">·</span>
            <a href="/legal/privacy/">Privacy policy</a>
            <span className="cr-legal-sep">·</span>
            <a href="/legal/provenance/">Data provenance</a>
            <span className="cr-legal-sep">·</span>
            <a href="/legal/disclaimer/">Disclaimer</a>
            <span className="cr-legal-sep">·</span>
            <a href="/legal/takedown/">Correction &amp; takedown</a>
            <span className="cr-legal-th" lang="th">ข้อกำหนด · นโยบาย · แหล่งข้อมูล · คำปฏิเสธ · การแก้ไข</span>
          </div>
        </footer>
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
    withTambon: pct(records.filter((r) => r.tambonCode).length, n),
    categoryDeclared: pct(records.filter((r) => r.categoryConfidence === 'declared').length, n),
  };
}
