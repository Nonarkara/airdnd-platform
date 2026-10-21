import { useMemo, useState } from 'react';
import { Chapter, n } from './fmt.jsx';
import Composition from './Composition.jsx';
import { railOf, RAIL_LABEL, classifiedOf, ZONES } from '../../lib/insights.js';

/** What is the registry's condition? Leads with the seven zone meters. */
export default function Record({ insights, go }) {
  const [sort, setSort] = useState('records');
  const { national, byProvince, contributors, concentration } = insights;

  const provinces = useMemo(() => {
    const rows = byProvince.map((p) => ({ ...p, rail: railOf(p), classified: classifiedOf(p) }));
    const by = {
      records: (a, b) => b.records - a.records,
      classified: (a, b) => b.classified / b.records - a.classified / a.records,
      graded: (a, b) => b.stars.graded - a.stars.graded,
      corroborated: (a, b) => b.corroborated / b.records - a.corroborated / a.records,
    };
    return rows.sort(by[sort] ?? by.records);
  }, [byProvince, sort]);

  const maxRecords = provinces[0] ? Math.max(...provinces.map((p) => p.records)) : 1;
  const railCounts = provinces.reduce((acc, p) => ({ ...acc, [p.rail]: (acc[p.rail] ?? 0) + 1 }), {});
  const vintage = national.vintage;
  const years = vintage.earliest != null
    ? Array.from({ length: vintage.latest - vintage.earliest + 1 }, (_, i) => vintage.earliest + i)
    : [];
  const undated = byProvince.filter((p) => p.vintage?.median == null).length;

  return (
    <Chapter id="record" title="Record" th="สภาพทะเบียน">
      {/* ── the blank zones ────────────────────────────────────────────── */}
      <div className="t-zones">
        {ZONES.map((z) => {
          const value = national.completeness[z.key] ?? 0;
          return (
            <div className="t-zone" key={z.key} data-fill={value < 5 ? 'blank' : 'printed'}>
              <span className="t-key">{z.zone}</span>
              <span className="t-zone-n">{value}%</span>
              <span className="t-ctx">{z.label} · {z.th}</span>
              <span className="t-zone-bar"><i style={{ width: `${Math.max(value, 0.6)}%` }} /></span>
            </div>
          );
        })}
      </div>
      <p className="t-note">
        Reversed zones are under 5% filled. They are printed in ink because the absence is the
        finding: this registry can tell you a producer's name and sub-district, and almost nothing
        that would let you buy from them. Percentages are of all {n(national.completeness.records)}{' '}
        records, from <code>otop_insights.json</code>.
      </p>

      {/* ── rank 1: the country as one tag ─────────────────────────────── */}
      <div className="t-national" data-rail="default">
        <div className="t-face">
          <p className="t-dest t-band">THA</p>
          <div className="t-face-body">
            <div>
              <span className="t-key">Registry · ทะเบียน</span>
              <span className="t-id">{n(national.records)}</span>
            </div>
            <div>
              <span className="t-key">Source · แหล่งข้อมูล</span>
              <span className="t-ctx">{insights.source} · built {insights.builtAt.slice(0, 10)}</span>
            </div>
            <p className="t-ctx" style={{ margin: 0 }}>
              A name, and an administrative area. That is what all of these rows carry.
            </p>
          </div>
        </div>
        <div>
          <div className="t-stubs">
            <div className="t-stub"><span className="t-key">Producers</span><span className="t-stub-n">{n(national.producers)}</span></div>
            <div className="t-stub"><span className="t-key">Provinces</span><span className="t-stub-n">{national.provincesCovered}/77</span></div>
            <div className="t-stub"><span className="t-key">Corroborated</span><span className="t-stub-n">{national.corroboratedShare}%</span></div>
            <div className="t-stub"><span className="t-key">Duplicates collapsed</span><span className="t-stub-n">{n(national.duplicatesCollapsed)}</span></div>
            <div className="t-stub"><span className="t-key">Contributing offices</span><span className="t-stub-n">{contributors.length}</span></div>
            <div className="t-stub"><span className="t-key">Graded</span><span className="t-stub-n">{n(national.stars.graded)}</span></div>
          </div>
        </div>
      </div>

      {/* ── the 77 tags ───────────────────────────────────────────────── */}
      <h3 className="sub-h">77 provinces · rail = the strongest field that province's records carry</h3>
      <div className="t-legend">
        {['business', 'standard', 'transfer', 'hazard'].map((rail) => (
          <span key={rail}>
            <i className="t-swatch" style={{ background: `var(--tag-rail-${rail}, var(--tag-ink))` }} />
            {RAIL_LABEL[rail]} · {railCounts[rail] ?? 0}
          </span>
        ))}
      </div>
      <div className="t-legend">
        <span>Sort:</span>
        {[['records', 'Records'], ['classified', 'Classified %'], ['graded', 'Graded'], ['corroborated', 'Corroborated %']].map(([k, label]) => (
          <button key={k} type="button" className="reset" aria-current={sort === k} onClick={() => setSort(k)}>{label}</button>
        ))}
      </div>
      <div className="t-rows" id="provinces">
        <div className="t-row t-row-hd">
          <span className="t-rail" />
          <span>Code</span>
          <span>Province · จังหวัด</span>
          <span className="t-hide-sm">Records</span>
          <span className="t-hide-sm t-row-num">Classified</span>
          <span className="t-hide-sm t-row-num">Graded</span>
          <span className="t-row-num">Filed</span>
        </div>
        {provinces.map((p) => (
          <button type="button" className="t-row" key={p.code} data-rail={p.rail} title={RAIL_LABEL[p.rail]} onClick={() => go(p.code)}>
            <span className="t-rail" />
            <span className="t-dest">{p.iso}</span>
            <span>
              <span className="t-row-th">{p.th}</span><br />
              <span className="t-row-en">{p.en}</span>
            </span>
            <span className="t-hide-sm">
              <span className="t-row-num" style={{ textAlign: 'left', display: 'block' }}>{n(p.records)}</span>
              <span className="t-row-meter"><i style={{ width: `${(p.records / maxRecords) * 100}%` }} /></span>
            </span>
            <span className="t-hide-sm t-row-num">{Math.round((p.classified / p.records) * 100)}%</span>
            <span className="t-hide-sm t-row-num">{p.stars.graded || '—'}</span>
            <span className="t-row-num">{p.vintage.median ?? '—'}</span>
          </button>
        ))}
      </div>
      <p className="t-note">
        <strong>Filed</strong> is the median filing year in that province, and {undated} of the 77 record
        no year at all. Row counts measure how energetically a provincial office files paperwork,
        not how much is made there. Click a row to open that province.
      </p>

      {/* ── concentration + provenance ────────────────────────────────── */}
      <h3 className="sub-h">Concentration · the ten largest provinces hold {concentration.top10Share}%</h3>
      <Composition
        parts={[
          { id: 'top10', label: 'Top ten provinces', count: concentration.top10.reduce((s, p) => s + p.records, 0), tone: 'is-ink' },
          { id: 'rest', label: 'The other 67', count: national.records - concentration.top10.reduce((s, p) => s + p.records, 0), tone: 'is-hole' },
        ]}
        total={national.records}
      />

      {/* ── community standards (มผช.) ──────────────────────────────────── */}
      {insights.standards && insights.standards.total > 0 && (
        <>
          <h3 className="sub-h" id="standards">
            Technical standards (มผช.) · {n(insights.standards.total)} specifications from TISI / สมอ.
          </h3>
          <p className="t-note">
            Beyond provincial paperwork, the Ministry of Industry (สำนักงานมาตรฐานผลิตภัณฑ์อุตสาหกรรม - สมอ.)
            maintains <strong>{n(insights.standards.total)} official Community Product Standards (มผช. / TCPS)</strong> across
            the five canonical categories. Each standard establishes explicit quality criteria (moisture content,
            microbial limits, heavy-metal safety thresholds, packaging norms) and is published in the Royal Gazette.
          </p>
          <div className="t-stubs" style={{ marginBottom: '1rem' }}>
            <div className="t-stub"><span className="t-key">Food · อาหาร</span><span className="t-stub-n">{n(insights.standards.byCategory.food)}</span></div>
            <div className="t-stub"><span className="t-key">Decor · ของใช้</span><span className="t-stub-n">{n(insights.standards.byCategory.decor)}</span></div>
            <div className="t-stub"><span className="t-key">Beverage · เครื่องดื่ม</span><span className="t-stub-n">{n(insights.standards.byCategory.beverage)}</span></div>
            <div className="t-stub"><span className="t-key">Textile · ผ้า</span><span className="t-stub-n">{n(insights.standards.byCategory.textile)}</span></div>
            <div className="t-stub"><span className="t-key">Herbal · สมุนไพร</span><span className="t-stub-n">{n(insights.standards.byCategory.herbal)}</span></div>
          </div>
          <Composition
            parts={[
              { id: 'food', label: 'Food (553)', count: insights.standards.byCategory.food, tone: 'is-ink' },
              { id: 'decor', label: 'Decor/Craft (461)', count: insights.standards.byCategory.decor, tone: 'is-hole' },
              { id: 'beverage', label: 'Beverage (262)', count: insights.standards.byCategory.beverage, tone: 'is-ink' },
              { id: 'textile', label: 'Textiles (110)', count: insights.standards.byCategory.textile, tone: 'is-hole' },
              { id: 'herbal', label: 'Herbal (103)', count: insights.standards.byCategory.herbal, tone: 'is-ink' },
            ]}
            total={insights.standards.total}
          />
        </>
      )}

      {/* ── certified holders: the state's own mark, joined ─────────────── */}
      {insights.certification && insights.certification.certified > 0 && (
        <>
          <h3 className="sub-h" id="certified">
            Certified holders · {n(insights.certification.certified)} records carry a มผช. certificate
          </h3>
          <p className="t-note">
            The holder lists name certified producers with certificate numbers and expiry dates.
            Those fields used to be dropped by the pipeline, so 11,000+ clean holder rows entered
            the corpus as ordinary producers. Now the join is kept: <strong>{n(insights.certification.valid)} still
            valid as of {insights.certification.asOf}</strong>, {n(insights.certification.expired)} lapsed,{' '}
            {n(insights.certification.unknown)} undated. {n(insights.certification.buyerReady)} are buyer-ready —
            valid certificate, 4–5★ grade, and a contact channel.
          </p>
          <div className="t-grid t-grid-2" role="table">
            <div className="t-grid-row t-grid-hd" role="row">
              <span>Standard held · มาตรฐานที่ถือ</span><span className="t-row-num">Holders · valid</span>
            </div>
            {insights.certification.byStandard.map((s) => (
              <div className="t-grid-row" role="row" key={s.standard}>
                <span>{s.standard}</span>
                <span className="t-row-num">{n(s.holders)} · {n(s.valid)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="sub-h" id="provenance">Who filed it · {contributors.length} publishing offices across 522 datasets</h3>
      <p className="t-note">
        The pipeline harmonized <strong>1,015,991 rows from 522 open datasets</strong> published by 26 government bodies
        (CDD, Provincial Governors, DOAE, TISI/สมอ., MOC, and municipal offices). Deterministic entity resolution collapsed{' '}
        <strong>{n(national.duplicatesCollapsed)} duplicate filings</strong> (a 64.0% reduction in administrative inflation),
        yielding <strong>{n(national.records)} true producer records</strong>. Overlap across agencies constitutes the corroboration signal.
      </p>
      <div className="t-ranked">
        {contributors.slice(0, 12).map((c) => (
          <div key={c.organization}>
            <div className="t-ranked-row">
              <span>{c.organization}</span>
              <span className="t-row-num">{n(c.records)}</span>
            </div>
            <span className="t-ranked-track"><i style={{ width: `${(c.records / contributors[0].records) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <p className="t-note">
        These are <strong>source rows before de-duplication</strong>, so they sum past the{' '}
        {n(national.records)} resolved records — one producer filed by both the national office and
        a provincial one is counted by each. That overlap is the corroboration the fit score rewards.
      </p>

      <h3 className="sub-h">Vintage · {vintage.earliest}–{vintage.latest}, median {vintage.median}</h3>
      <div className="t-vintage">
        {years.map((y) => <span key={y} data-median={y === vintage.median}>{String(y).slice(2)}</span>)}
      </div>
      <p className="t-note">
        Only {n(vintage.years)} of {n(national.records)} records carry a filing year at all — {Math.round((vintage.years / national.records) * 100)}%.
        The median is of those, not of the registry.
      </p>
    </Chapter>
  );
}
