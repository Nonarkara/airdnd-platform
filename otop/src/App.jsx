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
import Critic from './components/Critic.jsx';
import DataBank from './components/DataBank.jsx';
import ViewHero from './components/ViewHero.jsx';
import Method from './components/Method.jsx';
import SoftPower from './components/SoftPower.jsx';
import Find from './components/Find.jsx';
import NavLink from './components/NavLink.jsx';

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
import { DEFAULTS, requirementFromUrl, requirementToUrl } from './lib/requirement.js';
import { viewFromLocation, pathFor, canonicalFor, metaFor, SITE, SITE_NAME } from './lib/routes.js';
import { completenessOf } from './lib/completeness.js';
import { Bi } from './components/Bi.jsx';
import { matchRequirement, sourcingBasins, toCsv, PROFILES } from '../core/matching.js';

const PAGE = 60;
const PAGE_NARROW = 20;

/**
 * The deep reads. They are real pages with real content, but they are not
 * destinations a stranger can be expected to want on the way in — so they
 * live in the footer, where the reader goes looking for "what else is
 * here", rather than in the header, where they would dilute the five
 * places a visitor actually comes for.
 */
const MORE_VIEWS = [
  { view: 'matchmaker', en: 'Matchmaker', th: 'จับคู่จังหวัด' },
  { view: 'tides', en: 'Demand Tides', th: 'กระแสความต้องการ' },
  { view: 'champions', en: 'Champions', th: 'แชมป์ที่ติดต่อได้' },
  { view: 'briefs', en: 'Briefs', th: 'สรุป' },
  { view: 'story', en: 'Story', th: 'เรื่องเล่า' },
  { view: 'history', en: '25 Years', th: '25 ปี' },
  { view: 'critic', en: 'Criticism', th: 'ข้อวิจารณ์' },
  { view: 'crossrefs', en: 'Cross-references', th: 'เชื่อมโยงข้อมูล' },
];

export default function App() {
  const initial = useRef(requirementFromUrl());
  const [state, setState] = useState({ status: 'loading' });
  const [lens, setLens] = useState(initial.current.lens);
  // Find is the home view: a search-first, phone-first landing. The most
  // useful single thing this site can do is end a session with a phone call
  // to a producer you can actually reach. The other views are deeper reads
  // of the same data; the difference is that a fresh visitor lands on the
  // thing they can use, not the thing they can read about.
  const [view, setView] = useState(() => viewFromLocation().view);
  const [provinceCode, setProvinceCode] = useState(() => viewFromLocation().code);
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
  // A phone screen pays for every pixel of scroll. A narrow viewport gets a
  // shorter first page; the reader asks for more, once, at the bottom.
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches
  );
  const pageSize = narrow ? PAGE_NARROW : PAGE;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
    if (!['atlas', 'province', 'champions', 'critic'].includes(view) || insights || insightsError) return;
    let cancelled = false;
    Promise.all([loadInsights(), loadGraph().catch(() => null)])
      .then(([data, graph]) => { if (!cancelled) setInsights(graph ? { ...data, graph } : data); })
      .catch((error) => { if (!cancelled) setInsightsError(error.message); });
    return () => { cancelled = true; };
  }, [view, insights, insightsError]);

  useEffect(() => {
    window.history.replaceState(null, '', requirementToUrl(view, lens, requirement, provinceCode));
  }, [view, lens, requirement, provinceCode]);

  useEffect(() => { setLimit(pageSize); }, [lens, requirement, pageSize]);

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

  // Switching the lens re-applies that lens's default strictness. A buyer
  // who lands on Discover and then asks for the due-diligence ranking gets
  // the due-diligence filters, not the old ones wearing a new label.
  const changeLens = useCallback((next) => {
    setLens(next);
    const d = DEFAULTS[next];
    setRequirement((r) => ({
      ...r,
      requireContact: d.requireContact,
      requireCorroborated: d.requireCorroborated,
      requireSignal: d.requireSignal,
    }));
    setLimit(pageSize);
  }, [pageSize]);

  // WHAT THIS PAGE CALLS ITSELF.
  //
  // The title, the description, the canonical address and the social card
  // all change with the view. A site that keeps one title for fourteen
  // different documents tells a search engine fourteen times that they are
  // the same page, and tells a reader in a message the same thing.
  //
  // This hook sits ABOVE the loading and error returns on purpose. A hook
  // that is called conditionally is a hook that is called a different number
  // of times on the loading render and the ready render, and React refuses
  // to render a component that changes its own hook count: the whole site
  // came up blank with "rendered more hooks than during the previous
  // render" and no page at all.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const p = index.provinces.find((x) => x.code === provinceCode);
    const m = metaFor(view, provinceCode, p ? p.en : null);
    document.title = m.title;
    const set = (selector, attr, value) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    set('meta[name="description"]', 'content', m.description);
    set('meta[property="og:title"]', 'content', m.title);
    set('meta[property="og:description"]', 'content', m.description);
    set('meta[property="og:url"]', 'content', canonicalFor(view, provinceCode));
    set('meta[name="twitter:title"]', 'content', m.title);
    set('meta[name="twitter:description"]', 'content', m.description);
    set('link[rel="canonical"]', 'href', canonicalFor(view, provinceCode));
  }, [view, provinceCode, state.status, index]);

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
  const recordCount = meta.counts.recordsAfterMerge ?? totals.records;
  // The province the dossier is about. The title carries its name in BOTH
  // scripts, so the tag face below it does not have to say it again.
  const province = index.provinces.find((p) => p.code === provinceCode) || null;

  return (
    <div className="shell">
      {/* Nav and status only. The wordmark lives here — once per viewport —
          because the hero no longer carries a second one. */}
      <header className="hdr">
        <div className="wrap hdr-in">
          <a className="brand" href="/" aria-label="one³ — home">
            <span className="brand-mark">one<span className="mid">³</span></span>
          </a>
          <nav className="hdr-nav" aria-label="Sections">
            <NavLink view="find" current={view === 'find'} onNavigate={() => setView('find')}>
              <span className="nav-en">Find</span>
              <span className="nav-th" lang="th">ค้นหา</span>
            </NavLink>
            <NavLink view="match" current={view === 'match'} onNavigate={() => setView('match')}>
              <span className="nav-en">Match</span>
              <span className="nav-th" lang="th">จับคู่</span>
            </NavLink>
            <NavLink view="atlas" current={view === 'atlas'} onNavigate={() => openProvince(null)}>
              <span className="nav-en">Atlas</span>
              <span className="nav-th" lang="th">แผนที่ข้อมูล</span>
            </NavLink>
            <NavLink view="bank" current={view === 'bank'} onNavigate={() => setView('bank')}>
              <span className="nav-en">Data Bank</span>
              <span className="nav-th" lang="th">คลังข้อมูล</span>
            </NavLink>
            <NavLink view="softpower" current={view === 'softpower'} onNavigate={() => setView('softpower')}>
              <span className="nav-en">Soft Power</span>
              <span className="nav-th" lang="th">พลังอ่อน</span>
            </NavLink>
            <NavLink view="method" current={view === 'method'} onNavigate={() => setView('method')}>
              <span className="nav-en">Method</span>
              <span className="nav-th" lang="th">วิธีการ</span>
            </NavLink>
          </nav>
          <div className="hdr-status">
            <span className={`dot${meta.degraded ? ' warn' : ''}`} />
            <Bi en={meta.degraded ? 'Fixture' : 'data.go.th'} th={meta.degraded ? 'ข้อมูลทดสอบ' : 'แหล่งข้อมูล'} />
          </div>
        </div>
      </header>

      <main id="main">
        {/* Provenance travels with the data, not with the page: it is a box
            on the Method view, and a warning banner on every view when the
            build is a fixture rather than the national registry. */}
        {meta.degraded && <div className="wrap"><ProvenanceBanner meta={meta} /></div>}

        {view === 'find' && (
          <section className="sec sec-find" id="find">
            <div className="wrap">
              <Find onOpenProvince={openProvince} />
            </div>
          </section>
        )}

        {view === 'match' && (<>
        <section className="sec" id="match">
          <div className="wrap">
            <ViewHero
              eyebrow={<Bi en="Match" th="จับคู่" />}
              headline={PROFILES[lens].label}
              stake={lens === 'b2b' ? (
                <Bi
                  en="Ranked for due diligence: grading, corroboration and filing age carry more weight. State a requirement and get a ranked shortlist with the reason for the ranking."
                  th="จัดอันดับตามการตรวจสอบ: คะแนน OPC การรับรองข้ามหน่วยงาน และอายุการยื่นทะเบียน ระบุความต้องการและรับรายชื่อจัดอันดับพร้อมเหตุผล"
                />
              ) : (
                <Bi
                  en="Ranked for reach: a producer you can contact and locate carries more weight. State a requirement and get a ranked shortlist with the reason for the ranking."
                  th="จัดอันดับตามการเข้าถึง: ผู้ผลิตที่ติดต่อได้และระบุตำแหน่งได้ ระบุความต้องการและรับรายชื่อจัดอันดับพร้อมเหตุผล"
                />
              )}
            />

            {/* The lens is a mode of the same view, so it lives inside the
                view — not as two entries in the header. */}
            <div className="lens-switch" role="group" aria-label="Sourcing lens">
              <button type="button" aria-current={lens === 'b2b'} onClick={() => changeLens('b2b')}>
                <span className="nav-en">Source · B2B</span>
                <span className="nav-th" lang="th">แหล่ง · ธุรกิจสู่ธุรกิจ</span>
              </button>
              <button type="button" aria-current={lens === 'b2c'} onClick={() => changeLens('b2c')}>
                <span className="nav-en">Discover · B2C</span>
                <span className="nav-th" lang="th">ค้นพบ · ธุรกิจสู่ผู้บริโภค</span>
              </button>
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
              {/* Both actions on this view live in one place: the escape
                  hatch from the filter, and the export of what is left. */}
              <div className="results-actions">
                {requirement.requireSignal && result.matches.length < result.total && (
                  <button type="button" className="reset" onClick={() => setRequirement((r) => ({ ...r, requireSignal: false, requireContact: false, requireCorroborated: false }))}>
                    <Bi en={`Show all ${result.total.toLocaleString()} registrations`} th={`แสดงทั้งหมด ${result.total.toLocaleString()} รายการ`} />
                  </button>
                )}
                {result.matches.length > 0 && (
                  <button type="button" className="reset" onClick={exportCsv}>
                    <Bi en="Export shortlist" th="ส่งออกรายชื่อ" /> <span className="muted">(CSV)</span>
                  </button>
                )}
              </div>
            </div>

            {requirement.requireSignal && result.matches.length < result.total && (
              <div className="filter-explain">
                <p>
                  Showing records with at least one real attestation — a category, a contact
                  channel, a star grade, or a product name distinct from the producer. The{' '}
                  {(result.total - result.matches.length).toLocaleString()} unattested
                  registrations in the loaded provinces are name-only OTOP numbers and are
                  hidden by default.
                </p>
                <p lang="th">
                  แสดงเฉพาะรายการที่มีการรับรองจริง — ประเภท, ช่องทางติดต่อ, คะแนน OPC, หรือชื่อผลิตภัณฑ์ต่างจากชื่อผู้ผลิต อีก{' '}
                  {(result.total - result.matches.length).toLocaleString()} รายการที่ไม่มีการรับรองในจังหวัดที่โหลดถูกซ่อนไว้เป็นค่าเริ่มต้น
                  (มีเพียงเลขทะเบียน OTOP เท่านั้น)
                </p>
              </div>
            )}

            {/*
              When the user has explicitly shown all records (every attest-
              ation filter is off), the procurement-engine sort by
              match-requirement is the wrong ranking for a casual buyer —
              it ranks by assurance and corroboration. Find is the right
              tool: contactability-first, phone-callable. The banner is
              a one-click bridge, not a nag.
             */}
            {!requirement.requireSignal && !requirement.requireContact && !requirement.requireCorroborated && result.matches.length > 0 && (
              <p className="find-banner">
                <Bi
                  en="All filters off — you are seeing the full province list, ranked by match score. For a contactability-first sort (callable producers at the top), Find is the right surface."
                  th="ตัวกรองทั้งหมดปิดอยู่ — กำลังดูรายการทั้งหมดในจังหวัด เรียงตามคะแนนการจับคู้ หากต้องการเรียงตามการติดต่อได้ก่อน (ผู้ที่โทรหาได้ขึ้นก่อน) Find คือเครื่องมือที่ใช่"
                />{' '}
                {/* The parameters are the ones the app actually reads: `prov`
                    is the province and `cat` is the category. This link used
                    to carry `p=` and `q=`, which no reader of the URL has
                    ever understood — so it opened Find with neither the
                    province nor the category applied, and the reader landed
                    on 154,050 records instead of the handful the banner
                    promised. */}
                <a className="find-banner-cta" href={`/${requirement.provinceCodes.length === 1 ? `?prov=${requirement.provinceCodes[0]}` : ''}${requirement.categories.length ? `${requirement.provinceCodes.length === 1 ? '&' : '?'}cat=${encodeURIComponent(requirement.categories[0])}` : ''}`}>
                  <Bi en="Open in Find →" th="เปิดใน Find →" />
                </a>
              </p>
            )}

            <MatchRows matches={result.matches} limit={limit} onSelectProvince={openProvince} />

            {result.matches.length > limit && (
              <div className="more">
                <button type="button" onClick={() => setLimit((n) => n + pageSize)}>
                  <Bi en={`Show ${Math.min(pageSize, result.matches.length - limit)} more`} th={`แสดงอีก ${Math.min(pageSize, result.matches.length - limit)} รายการ`} />
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
              <ViewHero
                eyebrow={<Bi en="Atlas" th="แผนที่ข้อมูล" />}
                headline="The whole registry as one package."
                stake={<Bi
                  en="Seven chapters, one question each — start with Findings: what the data says. Then the zones it left blank."
                  th="เจ็ดบท บทละหนึ่งคำถาม — เริ่มที่ Findings แล้วดูช่องว่างที่ข้อมูลไม่ครอบคลุม"
                />}
              />
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
              <ViewHero
                eyebrow={<Bi en="Province" th="จังหวัด" />}
                headline={province ? <Bi en={province.en} th={province.th} /> : 'Province'}
                stake={<Bi
                  en="One province, every layer — a link you can hand across a table."
                  th="หนึ่งจังหวัด ทุกชั้นข้อมูล — ลิงก์ที่ส่งต่อกันข้ามโต๊ะได้"
                />}
              />
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
              <ViewHero
                eyebrow={<Bi en="The Matchmaker" th="จับคู่" />}
                headline="Where the supply is, where the money already is."
                stake={<Bi
                  en="Provinces ranked by supply × demand × routability — pick a category and read the triangle."
                  th="จัดอันดับจังหวัดจากอุปทาน × อุปสงค์ × การเข้าถึง — เลือกประเภทแล้วอ่านสามเหลี่ยม"
                />}
              />
              <Matchmaker onSelectProvince={openProvince} />
            </div>
          </section>
        )}

        {view === 'briefs' && (
          <section className="sec" id="briefs">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Briefs" th="สรุป" />}
                headline="Six forwardable cards."
                stake={<Bi
                  en="One number, one chart, what it means, what to do — copy the link or export the image."
                  th="หนึ่งตัวเลข หนึ่งแผนภูมิ ความหมายและทางออก — ส่งลิงก์หรือบันทึกภาพได้"
                />}
              />
              <Suspense fallback={<p className="empty">Loading the briefs…</p>}>
                <Briefs insights={insights} onSelectProvince={openProvince} />
              </Suspense>
            </div>
          </section>
        )}

        {view === 'tides' && (
          <section className="sec" id="tides">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Demand Tides" th="กระแสความต้องการ" />}
                headline="Where is your category moving — and where is it stalling?"
                stake={<Bi
                  en="385 cells, each a 3-year revenue trajectory. Green up, red down, grey flat — a province beating the national row is doing real work."
                  th="385 เซลล์ แต่ละเซลล์คือแนวโน้มรายได้ 3 ปี — จังหวัดที่ชนะค่าเฉลี่ยประเทศกำลังทำงานจริง"
                />}
              />
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
              <ViewHero
                eyebrow={<Bi en="Reachable Champions" th="แชมป์ที่ติดต่อได้" />}
                headline="The buyer's starting list."
                stake={<Bi
                  en={`4–5★ producers the registry says CAN be reached — out of ${recordCount.toLocaleString()} records, only the few carrying both a grade and a contact.`}
                  th={`ผู้ผลิต 4–5 ดาวที่ติดต่อได้ — จาก ${recordCount.toLocaleString()} รายการ เหลือเพียงไม่กี่รายที่มีทั้งคะแนนและช่องทางติดต่อ`}
                />}
              />
              <Champions onSelectProvince={openProvince} national={insights?.national ?? null} records={recordCount} />
            </div>
          </section>
        )}

        {view === 'story' && (
          <section className="sec" id="story">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Story" th="เรื่องเล่า" />}
                headline="The map, the money, and the names no one can route to."
                stake={<Bi
                  en="Five chapters plus what the public says — every number a row in the source."
                  th="ห้าบทพร้อมเสียงของประชาชน — ทุกตัวเลขมาจากข้อมูลจริง"
                />}
              />
              <NationalStory />
            </div>
          </section>
        )}

        {view === 'history' && (
          <section className="sec" id="history">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="OTOP: 25 Years" th="25 ปี" />}
                headline="The seed, the boom, the silence, the platform."
                stake={<Bi
                  en="Where OTOP came from — and what the 5★ grade actually scores."
                  th="ที่มาของ OTOP — และความหมายจริงของคะแนน 5 ดาว"
                />}
              />
              <History meta={meta} />
            </div>
          </section>
        )}

        {view === 'crossrefs' && (
          <section className="sec" id="crossrefs">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Cross-references" th="เชื่อมโยงข้อมูล" />}
                headline="OTOP against the country it sits in."
                stake={<Bi
                  en="Per-capita supply, tourist money vs reachable records, broadband vs reachability — Phuket's 14.1M tourists against near-zero reachable records."
                  th="อุปทานต่อหัว เงินท่องเที่ยวกับผู้ผลิตที่ติดต่อได้ — ภูเก็ตนักท่องเที่ยว 14.1 ล้าน แต่แทบไม่มีรายการที่ติดต่อได้"
                />}
              />
              <CrossReferences />
            </div>
          </section>
        )}

        {view === 'critic' && (
          <section className="sec" id="critic">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Criticism" th="ข้อวิจารณ์" />}
                headline="What the record says about OTOP."
                stake={<Bi
                  en="Seven criticisms of the programme, each attributed, each answered by the register — or left unanswered, where the register cannot answer it."
                  th="ข้อวิจารณ์โอทอปเจ็ดข้อ ระบุแหล่งที่มา และตอบด้วยข้อมูลทะเบียน — หรือบอกตรง ๆ ว่าตอบไม่ได้"
                />}
              />
              {!insights && !insightsError && <p className="empty">Loading the national rollup…</p>}
              {insightsError && (
                <p className="empty">The national rollup could not be loaded — {insightsError}. The criticisms are still published; the registry's answers are not substituted with something else.</p>
              )}
              {insights && <Critic insights={insights} meta={meta} />}
            </div>
          </section>
        )}

        {view === 'bank' && (
          <section className="sec" id="bank">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Data Bank" th="คลังข้อมูล" />}
                headline="Every dataset the portal returned."
                stake={<Bi
                  en="Every list the portal returned, shelved by kind. Pick a shelf: the pulled rows show what the build actually read."
                  th="ทุกรายการที่พอร์ทัลส่งมา จัดเป็นหมวดหมู่ — แถวที่ดึงมาแสดงสิ่งที่ระบบอ่านจริง"
                />}
              />
              <DataBank />
            </div>
          </section>
        )}

        {view === 'softpower' && (
          <section className="sec" id="softpower">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Soft Power" th="พลังอ่อน" />}
                headline="Thailand's soft power, measured on the supply side."
                stake={<Bi
                  en="Seven instruments, six registers, one portal. OTOP is the deepest of them; the rest measure the craft, the food, the film, the trade and the people who carry it."
                  th="เครื่องมือเจ็ด ทะเบียนหก พอร์ทัลเดียว OTOP คือเครื่องมือที่ละเอียดที่สุด ที่เหลือวัดหัตถกรรม อาหาร ภาพยนตร์ การค้า และคนที่พามันไป"
                />}
              />
              <SoftPower />
            </div>
          </section>
        )}

        {view === 'method' && (
          <section className="sec" id="method">
            <div className="wrap">
              <ViewHero
                eyebrow={<Bi en="Method" th="วิธีการ" />}
                headline="What these numbers are, and are not."
                stake={<Bi
                  en="How 154,050 filing records became one registry — and the limits that travel with the count."
                  th="154,050 รายการจากการยื่นทะเบียน กลายเป็นทะเบียนเดียวอย่างไร และข้อจำกัดที่ติดมากับตัวเลข"
                />}
              />
              <Method meta={meta} totals={totals} />
            </div>
          </section>
        )}

        {/* One line of provenance under every view, and a way into the long
            version. The four paragraphs of methodology that used to ride
            along on every page now live on their own page. */}
        <p className="build-note">
          <Bi
            en={`Built ${meta.builtAt?.slice(0, 10)} from data.go.th · ${recordCount.toLocaleString()} producer records · ${meta.shardCount} province shards`}
            th={`สร้างเมื่อ ${meta.builtAt?.slice(0, 10)} จาก data.go.th · ${recordCount.toLocaleString()} รายการ · ${meta.shardCount} ไฟล์แยกรายจังหวัด`}
          />{' '}
          <a href="/method/"><Bi en="What these numbers are →" th="ตัวเลขเหล่านี้คืออะไร →" /></a>
        </p>
      </main>

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
            <span className="cr-key">Data</span>
            <span className="cr-name">data.go.th</span>
            <span className="cr-line">กรมพัฒนาชุมชน · Department of Community Development</span>
            <span className="cr-line">Thailand's Open Government Data portal</span>
            <span className="cr-line">Seven registers read for the soft-power monitor</span>
          </div>
          <div className="cr-block cr-mantra">
            <p className="cr-mantra-th">หนึ่งตำบล หนึ่งผลิตภัณฑ์ หนึ่งแพลตฟอร์ม</p>
            <p className="cr-mantra-en">One Tambon · One Product · One Platform</p>
            <p className="cr-mantra-sub">หนึ่งตำบล คือเครื่องมือหนึ่งในการวัดพลังอ่อนของไทย</p>
            <p className="cr-mantra-sub-en">One instrument in Thailand's soft-power monitor</p>
            <p className="cr-mantra-1"><span>1</span><sup>3</sup> <span>= 1</span></p>
          </div>
        </div>

        <div className="wrap cr-views">
          <span className="cr-key">More views</span>
          <ul className="cr-views-list">
            {MORE_VIEWS.map((v) => (
              <li key={v.view}>
                <a href={pathFor(v.view)}>
                  <span>{v.en}</span>
                  <span className="cr-views-th" lang="th">{v.th}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="wrap cr-built">
          <Bi en="Built with Mavis, an AI assistant." th="สร้างด้วยเมวิส ผู้ช่วย AI" />
        </div>

        <div className="wrap cr-legal">
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
    </div>
  );
}
