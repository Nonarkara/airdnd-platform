import { useMemo, useState } from 'react';
import { railOf, RAIL_LABEL, classifiedOf } from '../lib/insights.js';

/**
 * Atlas — the registry read as one closed information package.
 *
 * The aesthetic is Dr Non's white baggage tag, INDEX register: four type ranks,
 * an id that copies, a full-bleed rail carrying a domain that is genuinely in
 * the record, and a fallback rank that still identifies the object when every
 * rank above it is blank.
 *
 * The subject is what the data actually says. The findings block at the top
 * is the answer to "of all this data, what does it mean?" — each finding
 * pairs a plain-language claim with a value the reader can verify against the
 * meter below it.
 */

const nf = new Intl.NumberFormat('en-US');
const n = (v) => (v == null ? '—' : nf.format(v));

/** Zones of the tag, mapped onto the fields the registry either filled or did not. */
const ZONES = [
  { key: 'withSubdistrict', label: 'Located to tambon', th: 'ระบุถึงตำบล', zone: 'Destination' },
  { key: 'categoryDeclared', label: 'Category declared', th: 'ระบุประเภทเอง', zone: 'Domain' },
  { key: 'withStars', label: 'OPC graded', th: 'มีระดับดาว', zone: 'Class of service' },
  { key: 'withContact', label: 'Reachable', th: 'มีช่องทางติดต่อ', zone: 'Claim' },
  { key: 'withPrice', label: 'Priced', th: 'มีราคา', zone: 'Value' },
  { key: 'withCoordinates', label: 'Mapped', th: 'มีพิกัด', zone: 'Machine key' },
];

const CAT_TONE = { unclassified: 'is-hole' };

/** A composition bar. Segments are shares of one whole and must sum to it. */
function Composition({ parts, total }) {
  return (
    <>
      <div className="t-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.count}`).join(', ')}>
        {parts.filter((p) => p.count > 0).map((p) => (
          <span
            key={p.id}
            className={CAT_TONE[p.id] ?? (p.tone || 'is-ink')}
            style={{ flex: `${p.count} 0 0` }}
            title={`${p.label} · ${n(p.count)} · ${Math.round((p.count / total) * 1000) / 10}%`}
          >
            {p.count / total > 0.09 ? `${Math.round((p.count / total) * 100)}%` : ''}
          </span>
        ))}
      </div>
      <div className="t-legend">
        {parts.filter((p) => p.count > 0).map((p) => (
          <span key={p.id}>{p.label} · {n(p.count)}</span>
        ))}
      </div>
    </>
  );
}

function categoryParts(scope) {
  return scope.categories.map((c) => ({ id: c.id, label: c.en, count: c.count }));
}

export default function Atlas({ insights }) {
  const [sort, setSort] = useState('records');
  const { national, byRegion, byProvince, contributors, concentration, findings = [], specialization = [], qualityLeaders = [], reachGap = [], corroborationQuadrant = {}, hiddenChampions = [], regionIdentity = [], revenue = null } = insights;
const bnBaht = (v) => (v == null ? '—' : `${(v / 1e9).toFixed(2)}B baht`);

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

  return (
    <>
      {/* ── HEADLINE FINDINGS — the lede ──────────────────────────────── */}
      {findings.length > 0 && (
        <section className="atlas-findings" aria-label="Headline findings">
          <p className="atlas-lede-eyebrow">Findings · สิ่งที่ข้อมูลบอก</p>
          <ol className="atlas-findings-list">
            {findings.map((f) => (
              <li key={f.id} className="atlas-finding">
                <span className="atlas-finding-th">{f.th}</span>
                <span className="atlas-finding-text">{f.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── THE REACH GAP — the poverty-fighting table ─────────────────── */}
      {reachGap.length > 0 && (
        <>
          <h3 className="sub-h">The Reach Gap · ช่องว่างการเข้าถึง</h3>
          <p className="t-note">
            Thailand has <strong>{n(national.records)}</strong> registered OTOP producers and{' '}
            <strong>{n(reachGap.reduce((s, p) => s + p.reachable, 0))}</strong> can be reached.
            Fix the second number and you lift the first. Sort by the gap.
          </p>
          <div className="t-rows" id="reach-gap">
            <div className="t-row t-row-hd">
              <span className="t-rail" />
              <span>Province · จังหวัด</span>
              <span className="t-row-num">Producing</span>
              <span className="t-row-num">Reachable</span>
              <span className="t-hide-sm t-row-num">Corroborated</span>
              <span className="t-row-num">Gap</span>
            </div>
            {reachGap.filter((p) => p.records > 0).slice(0, 20).map((p) => (
              <button type="button" className="t-row" key={p.code}
                onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                <span className="t-rail" />
                <span>
                  <span className="t-row-th">{p.th}</span><br />
                  <span className="t-row-en">{p.en}</span>
                </span>
                <span className="t-row-num">{n(p.records)}</span>
                <span className="t-row-num">{p.reachable > 0 ? n(p.reachable) : '—'}</span>
                <span className="t-hide-sm t-row-num">{p.corroboratedPct}%</span>
                <span className="t-row-num" data-high={p.unreachable > 1000}>
                  {n(p.unreachable)}
                </span>
              </button>
            ))}
          </div>
          <p className="t-note">
            Top 20 by number of unreachable producers. A high gap means a province with deep production
            but almost no way to reach those producers. Each row is a contact-drive waiting to happen.
          </p>
        </>
      )}

      {/* ── CORROBORATION QUADRANT — the 2×2 ─────────────────────────── */}
      {corroborationQuadrant.ready && (
        <>
          <h3 className="sub-h">The Quadrant · ตาราง 2×2</h3>
          <p className="t-note">
            Provinces classified by two independent axes: corroboration (is the data verified by
            more than one agency?) and contactability (can someone actually reach the producer?).
            The cut sits at ≥{corroborationQuadrant.thresholds.corroboration}% corroborated and ≥{corroborationQuadrant.thresholds.contact}% reachable —
            administrative lines, not natural kinds. {(() => {
              const t = corroborationQuadrant.thresholds;
              const edge = [...(corroborationQuadrant.blind ?? [])]
                .map((p) => ({ p, d: Math.abs(p.corroboratedPct - t.corroboration) + Math.abs(p.reachablePct - t.contact) }))
                .sort((a, b) => a.d - b.d)[0];
              return edge ? `${edge.p.th} (${edge.p.corroboratedPct}% / ${edge.p.reachablePct}%) sits just below both lines — move them slightly and it moves quadrants.` : 'Provinces near the lines move quadrants when the lines move.';
            })()}
          </p>
          <div className="t-quadrant">
            <div className="t-quad-cell" data-quad="ready">
              <div className="t-quad-h">
                <span className="t-quad-icon">●</span>
                Ready to trade · พร้อมค้า
              </div>
              <span className="t-quad-count">{corroborationQuadrant.ready.length}</span>
              <span className="t-quad-desc">High corroboration, high contact</span>
              {corroborationQuadrant.ready.slice(0, 5).map((p) => (
                <button type="button" className="t-quad-row" key={p.code}
                  onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                  <span className="t-row-th">{p.th}</span>
                  <span className="t-row-num">{p.reachable} reachable</span>
                </button>
              ))}
            </div>
            <div className="t-quad-cell" data-quad="documented">
              <div className="t-quad-h">
                <span className="t-quad-icon">■</span>
                Best docs, no reach · มีเอกสาร ไม่มีช่องทาง
              </div>
              <span className="t-quad-count">{corroborationQuadrant.documented.length}</span>
              <span className="t-quad-desc">High corroboration, low contact</span>
              {corroborationQuadrant.documented.slice(0, 5).map((p) => (
                <button type="button" className="t-quad-row" key={p.code}
                  onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                  <span className="t-row-th">{p.th}</span>
                  <span className="t-row-num">{n(p.records)} records, {p.reachable} reachable</span>
                </button>
              ))}
            </div>
            <div className="t-quad-cell" data-quad="reachable">
              <div className="t-quad-h">
                <span className="t-quad-icon">▲</span>
                Reachable, unverified · มีช่องทาง ไม่ได้ตรวจสอบ
              </div>
              <span className="t-quad-count">{corroborationQuadrant.reachable.length}</span>
              <span className="t-quad-desc">Low corroboration, high contact</span>
              {corroborationQuadrant.reachable.slice(0, 5).map((p) => (
                <button type="button" className="t-quad-row" key={p.code}
                  onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                  <span className="t-row-th">{p.th}</span>
                  <span className="t-row-num">{p.reachable} reachable</span>
                </button>
              ))}
            </div>
            <div className="t-quad-cell" data-quad="blind">
              <div className="t-quad-h">
                <span className="t-quad-icon">▪</span>
                The poverty zones · พื้นที่ยากจน
              </div>
              <span className="t-quad-count">{corroborationQuadrant.blind.length}</span>
              <span className="t-quad-desc">Low corroboration, low contact</span>
              {corroborationQuadrant.blind.slice(0, 5).map((p) => (
                <button type="button" className="t-quad-row" key={p.code}
                  onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                  <span className="t-row-th">{p.th}</span>
                  <span className="t-row-num">{n(p.records)} records</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

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
            {/* Rank 4 — the fallback. When every field above is blank, this is
                still true of every one of the 118,335 rows. */}
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

      {/* ── the blank zones ────────────────────────────────────────────── */}
      <h3 className="sub-h">Which zones of the tag the registry filled</h3>
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

      {/* ── composition ───────────────────────────────────────────────── */}
      <h3 className="sub-h">Product domain · what the registry says these {n(national.records)} records are</h3>
      <Composition parts={categoryParts(national)} total={national.records} />
      <p className="t-note">
        Ground is unclassified. Note that the category buckets and the completeness meter above
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

      {/* ── REGION IDENTITY — what each region actually makes ──────────── */}
      {regionIdentity.length > 0 && (
        <>
          <h3 className="sub-h">Region identity · อัตลักษณ์ภูมิภาค</h3>
          <p className="t-note">
            Shares are of <em>classified records only</em> — and only {n(national.records - national.categories.find((c) => c.id === 'unclassified').count)} of {n(national.records)} records
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

      {/* ── SPECIALIZATION — where each category concentrates ──────────── */}
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
                    <a className="t-spec-name" href={`/?lens=b2b&prov=${l.code}`}>
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

      {/* ── QUALITY LEADERS — where the 4-5★ supply actually is ────────── */}
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
              <button type="button" className="t-row" key={p.code}
                onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
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

      {/* ── HIDDEN CHAMPIONS — certified but unreachable ─────────────── */}
      {hiddenChampions.length > 0 && (
        <>
          <h3 className="sub-h">Hidden champions · แชมป์ที่ซ่อนอยู่</h3>
          <p className="t-note">
            The state's own certified producers — 4-5★, corroborated by multiple
            agencies — with <em>no phone number</em>. A star certifies process compliance,
            not market demand, so these are not proven sales waiting to happen; they are
            the shortest list a contact-drive could start from: certified names, not cold ones.
          </p>
          <div className="t-rows" id="hidden-champions">
            <div className="t-row t-row-hd">
              <span className="t-rail" />
              <span>Province · จังหวัด</span>
              <span className="t-row-num">Champions</span>
              <span className="t-hide-sm t-row-num">4-5★ total</span>
              <span className="t-hide-sm t-row-num">Reachable</span>
            </div>
            {hiddenChampions.map((p) => (
              <button type="button" className="t-row" key={p.code}
                onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                <span className="t-rail" />
                <span>
                  <span className="t-row-th">{p.th}</span><br />
                  <span className="t-row-en">{p.en}</span>
                </span>
                <span className="t-row-num" data-high>{p.hiddenChampions}</span>
                <span className="t-hide-sm t-row-num">{p.highStars}</span>
                <span className="t-hide-sm t-row-num">{p.reachable}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── REVENUE — what money moved, not who earned it ─────────────── */}
      {revenue && (
        <>
          <h3 className="sub-h">Revenue · รายได้จากการจำหน่าย</h3>
          <p className="t-note">
            Provincial sales aggregates from the Department of Community Development's monthly
            series (BE {Math.min(...Object.keys(revenue.nationalAnnual).map(Number)) + 543}–{Math.max(...Object.keys(revenue.nationalAnnual).map(Number)) + 543}).
            This is a <em>different dataset</em> from the producer registry above: it says how much
            money moved, not who earned it. The two cannot be joined, and dividing these totals by
            registry row counts would turn filing energy into fake productivity — so this page refuses to.
          </p>
          <div className="t-ranked">
            {Object.entries(revenue.nationalAnnual).sort(([a], [b]) => b - a).map(([year, a]) => (
              <div key={year}>
                <div className="t-ranked-row">
                  <span>{Number(year) + 543} BE · {year} CE{a.months < 12 ? ` (${a.months} months)` : ''}</span>
                  <span className="t-row-num">{bnBaht(a.total)}</span>
                </div>
                <span className="t-ranked-track"><i style={{ width: `${(a.total / Math.max(...Object.values(revenue.nationalAnnual).map((x) => x.total))) * 100}%` }} /></span>
              </div>
            ))}
          </div>
          <p className="t-note">
            Top ten provinces by {revenue.latestFullYear} (latest full year).{' '}
            {revenue.coverage.provincesMissing.length > 0 && (
              <>{revenue.coverage.provincesMissing.join(', ')} report{revenue.coverage.provincesMissing.length === 1 ? 's' : ''} no values in any month — {revenue.coverage.provincesWithData}/{revenue.coverage.provinces} provinces carry data.</>
            )}
          </p>
          <div className="t-rows" id="revenue-leaders">
            <div className="t-row t-row-hd">
              <span className="t-rail" />
              <span>Province · จังหวัด</span>
              <span className="t-row-num">{revenue.latestFullYear} total</span>
            </div>
            {revenue.top10.map((p) => (
              <button type="button" className="t-row" key={p.code}
                onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
                <span className="t-rail" />
                <span>
                  <span className="t-row-th">{p.th}</span><br />
                  <span className="t-row-en">{p.en}</span>
                </span>
                <span className="t-row-num">{bnBaht(p.total)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── the 77 tags ───────────────────────────────────────────────── */}
      <h3 className="sub-h">
        77 provinces · rail = the strongest field that province's records carry
      </h3>
      <div className="t-legend">
        {['business', 'standard', 'transfer', 'hazard'].map((rail) => (
          <span key={rail}>
            <i style={{ display: 'inline-block', width: 14, height: 8, background: `var(--tag-rail-${rail}, var(--tag-ink))`, marginRight: 6 }} />
            {RAIL_LABEL[rail]} · {railCounts[rail] ?? 0}
          </span>
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
          <button type="button" className="t-row" key={p.code} data-rail={p.rail} title={RAIL_LABEL[p.rail]}
            onClick={() => { window.location.href = `/?lens=b2b&prov=${p.code}`; }}>
            <span className="t-rail" />
            {/* rank 2 — the machine key the shards and the registry are keyed on */}
            <span className="t-dest">{p.iso}</span>
            {/* rank 1 — what a buyer planning a sourcing trip sorts on */}
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
      <div className="t-legend">
        <span>Sort:</span>
        {[['records', 'Records'], ['classified', 'Classified %'], ['graded', 'Graded'], ['corroborated', 'Corroborated %']].map(([k, label]) => (
          <button key={k} type="button" className="reset" aria-current={sort === k} onClick={() => setSort(k)}>{label}</button>
        ))}
      </div>
      <p className="t-note">
        <strong>Filed</strong> is the median filing year in that province, and 57 of the 77 record
        no year at all. Row counts measure how energetically a provincial office files paperwork,
        not how much is made there. Click a row to open that province in the matching engine.
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

      <h3 className="sub-h" id="provenance">Who filed it · {contributors.length} publishing offices</h3>
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
    </>
  );
}
