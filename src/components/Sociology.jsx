import { useEffect, useState } from 'react';
import './Sociology.css';

// ── SVG Hour Chart ────────────────────────────────────────────────────────────
function HourChart({ hourly, peakWindow }) {
  if (!hourly || hourly.length === 0) return null;
  const maxCount = Math.max(...hourly.map((h) => h.count), 1);
  const W = 600;
  const H = 80;
  const barW = Math.floor(W / 24) - 2;
  const GAP = Math.floor(W / 24);

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', minWidth: 320 }} aria-label="Posting hour distribution">
      {hourly.map(({ hour, count }) => {
        const barH = maxCount > 0 ? Math.round((count / maxCount) * H) : 0;
        const x = hour * GAP;
        const isPeak = hour >= peakWindow.startHour && hour <= peakWindow.endHour;
        return (
          <g key={hour}>
            <rect
              x={x}
              y={H - barH}
              width={barW}
              height={barH}
              fill={isPeak ? 'var(--color-action)' : 'var(--color-data)'}
            />
            {hour % 3 === 0 && (
              <text
                x={x + barW / 2}
                y={H + 14}
                textAnchor="middle"
                fill="var(--color-cream-muted)"
                fontSize="8"
                fontFamily="var(--font-mono)"
              >
                {String(hour).padStart(2, '0')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal bar row ────────────────────────────────────────────────────────
function BarRow({ label, count, maxCount, variant = 'data', suffix = '' }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="soc-bar-row">
      <span className="soc-bar-label">{label}</span>
      <div className="soc-bar-track">
        <div className={`soc-bar-fill ${variant}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="soc-bar-count">{count}{suffix}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Sociology() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/sociology.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <article className="sociology">
        <header className="meth-header">
          <a href="/" className="meth-back">← Directory</a>
          <span className="meth-label">Field Notes</span>
        </header>
        <p className="soc-loading">Data unavailable — {error}</p>
      </article>
    );
  }

  if (!data) {
    return (
      <article className="sociology">
        <header className="meth-header">
          <a href="/" className="meth-back">← Directory</a>
          <span className="meth-label">Field Notes</span>
        </header>
        <p className="soc-loading">Loading field notes…</p>
      </article>
    );
  }

  const { temporal, mentions, names, lexicon, crossPosting } = data;
  const peakHour = temporal.peakAnxietyWindow;
  const maxHourCount = Math.max(...temporal.hourly.map((h) => h.count), 1);
  const maxDayCount = Math.max(...temporal.dayOfWeek.map((d) => d.count), 1);
  const maxBucket = Math.max(...mentions.buckets.map((b) => b.count), 1);
  const maxLex = Math.max(...lexicon.top40.map((t) => t.count), 1);

  const topVelocity = mentions.top10ByVelocity[0];

  return (
    <article className="sociology">

      {/* ── Header ── */}
      <header className="meth-header">
        <a href="/" className="meth-back">← Directory</a>
        <span className="meth-label">Field Notes</span>
      </header>

      {/* ── Hero ── */}
      <div className="meth-hero">
        <div>
          <h1 className="meth-title">
            The Anxiety<br />
            <span className="meth-title-accent">Economy</span>
          </h1>
          <p className="meth-author">Non Arkaraprasertkul</p>
          <p className="meth-date">Working Notes, 2026</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
          <div className="soc-stat" style={{ background: 'transparent', padding: 0 }}>
            <span className="soc-stat-value">{temporal.totalMessages}</span>
            <span className="soc-stat-label">Messages analyzed</span>
          </div>
          <div className="soc-stat" style={{ background: 'transparent', padding: 0 }}>
            <span className="soc-stat-value">{crossPosting.crossPostRate}%</span>
            <span className="soc-stat-label">Cross-posted to multiple channels</span>
          </div>
          <div className="soc-stat" style={{ background: 'transparent', padding: 0 }}>
            <span className="soc-stat-value">{topVelocity?.velocity}/day</span>
            <span className="soc-stat-label">Peak posting velocity</span>
          </div>
        </div>
      </div>

      {/* ── Section 01: The Anxiety Clock ── */}
      <section className="soc-section">
        <span className="meth-num">01</span>
        <h2>The Anxiety Clock</h2>

        <p className="soc-lead">
          Posting on a Telegram channel is the digital equivalent of a shopkeeper standing in a doorway.
          You need to be visible when traffic passes. The hour-of-day distribution of {temporal.totalMessages} messages
          reveals when operators feel most compelled to announce themselves — and, by inference, when they
          fear being overlooked.
        </p>

        <p className="soc-lead">
          The peak window is <strong>{String(peakHour.startHour).padStart(2, '0')}:00–{String(peakHour.endHour).padStart(2, '0')}:59</strong> Bangkok time,
          accounting for {peakHour.count} messages — the opening anxiety of informal labor. This is not
          the busiest time for customers. It is the time when an operator, having just opened for the
          day, does not yet know whether they will eat tonight.
        </p>

        <div className="soc-chart-wrap">
          <div className="soc-chart-label">Messages by hour of day — Bangkok (UTC+7)</div>
          <HourChart hourly={temporal.hourly} peakWindow={peakHour} />
          <div className="soc-legend" style={{ marginTop: '0.75rem' }}>
            <div className="soc-legend-item">
              <div className="soc-legend-dot accent" />
              <span>Peak anxiety window ({String(peakHour.startHour).padStart(2,'0')}:00–{String(peakHour.endHour).padStart(2,'0')}:59)</span>
            </div>
            <div className="soc-legend-item">
              <div className="soc-legend-dot data" />
              <span>Other hours</span>
            </div>
          </div>
        </div>

        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Messages by day of week</div>
        <div className="soc-day-bars">
          {temporal.dayOfWeek.map(({ day, label, count }) => {
            const pct = Math.round((count / maxDayCount) * 100);
            const isPeak = count === maxDayCount;
            return (
              <div key={day} className="soc-day-bar">
                <div className="soc-day-track">
                  <div
                    className={`soc-day-fill${isPeak ? ' peak' : ''}`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="soc-day-name">{label}</span>
                <span className="soc-day-count">{count}</span>
              </div>
            );
          })}
        </div>

        <p className="soc-note">
          <strong>{crossPosting.crossPostedCount} of {crossPosting.totalMessages} messages ({crossPosting.crossPostRate}%)</strong> are
          cross-posted to multiple channels simultaneously. This is not organic reach — it is coordinated flooding.
          {crossPosting.multiChannelOperators > 0 && ` ${crossPosting.multiChannelOperators} of ${crossPosting.totalOperators} operators maintain presence across more than one channel.`} The
          Telegram channel is not a community; it is a broadcasting infrastructure.
        </p>
      </section>

      {/* ── Section 02: The Posting Interval ── */}
      <section className="soc-section">
        <span className="meth-num">02</span>
        <h2>The Posting Interval</h2>

        <p className="soc-lead">
          Every message in the archive carries the fingerprint of an economic decision: when to
          post again. The data resolves into a distribution from casual presence
          to compulsive broadcasting. At the extreme, one operator posts at a
          velocity of <strong>{topVelocity?.velocity} times per day</strong> — roughly once
          every {topVelocity ? Math.round(24 / topVelocity.velocity) : '?'} hours. That is not
          marketing. That is distress made visible.
        </p>

        <p className="soc-lead">
          Across {mentions.totalOperators} tracked operators, the average posting count
          is <strong>{mentions.avgMentions} mentions</strong>, with a maximum of <strong>{mentions.maxMentions}</strong>.
          The distribution is deeply right-skewed — a small number of operators account for
          a disproportionate share of all channel noise.
        </p>

        {/* Bucket distribution */}
        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Operator mention-count distribution</div>
        <div className="soc-bar-rows">
          {mentions.buckets.map(({ label, count, pct }) => (
            <BarRow
              key={label}
              label={label + (label === '51+' ? ' mentions' : ' mention' + (label === '1' ? '' : 's'))}
              count={count}
              maxCount={maxBucket}
              variant={label === '51+' ? 'accent' : 'data'}
              suffix={` (${pct}%)`}
            />
          ))}
        </div>

        {/* Velocity table */}
        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Top 10 operators by daily posting velocity</div>
        <div className="soc-chart-wrap">
          <table className="soc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Operator</th>
                <th className="soc-td-mono">Total</th>
                <th className="soc-td-mono">Active since</th>
                <th>Posts/day</th>
              </tr>
            </thead>
            <tbody>
              {mentions.top10ByVelocity.map(({ name, totalMentions, daysActive, velocity, earliestSeen }, i) => (
                <tr key={i}>
                  <td className="soc-td-rank">{i + 1}</td>
                  <td className="soc-td-name">{name}</td>
                  <td className="soc-td-mono">{totalMentions}</td>
                  <td className="soc-td-mono">
                    {earliestSeen ? new Date(earliestSeen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                  </td>
                  <td className="soc-td-velocity">{velocity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="soc-note">
          The right-hand tail of this distribution raises a structural question: is
          high-velocity posting a sign of economic precarity, or of deliberate algorithmic
          awareness — gaming the channel's recency ranking? In an informal economy with no
          customer reviews and no verified reputation, <strong>recency is the only signal</strong>.
          The operator who posted three hours ago is more visible than the one who posted yesterday.
          The clock does not stop.
        </p>
      </section>

      {/* ── Section 03: The Name Economy ── */}
      <section className="soc-section">
        <span className="meth-num">03</span>
        <h2>The Name Economy</h2>

        <p className="soc-lead">
          Across {names.total} unique names in the corpus, a taxonomy emerges that maps directly
          onto market positioning, labor sociology, and protective strategy. None of these names
          are likely legal names. They are performance — constructed identities for a service
          context that carries social stigma, legal ambiguity, and physical risk.
        </p>

        {/* Taxonomy bars */}
        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Name taxonomy — {names.total} unique names</div>
        <div className="soc-bar-rows">
          <BarRow label="น้อง prefix" count={names.nongPrefix.count} maxCount={names.total} variant="accent" suffix={` (${names.nongPrefix.pct}%)`} />
          <BarRow label="Nature / place" count={names.natureNames.count} maxCount={names.total} variant="data" suffix={` (${names.natureNames.pct}%)`} />
          <BarRow label="English" count={names.englishNames.count} maxCount={names.total} variant="data" suffix={` (${names.englishNames.pct}%)`} />
          <BarRow label="Shop / brand" count={names.shopNames.count} maxCount={names.total} variant="data" suffix={` (${names.shopNames.pct}%)`} />
          <BarRow label="Other Thai" count={names.other.count} maxCount={names.total} variant="data" suffix={` (${names.other.pct}%)`} />
        </div>

        <p className="soc-lead">
          <strong>น้อง</strong> (younger sibling, diminutive) is not a name. It is a social contract.
          The speaker positions herself as younger, softer, deferential — less threatening to a customer
          who may feel uncertain about what he is doing. The prefix appears across the corpus as a
          collective noun too: "อัพเดตน้องๆ" — updating the girls — where น้อง signals the entire
          labor roster, not an individual identity.
        </p>

        <p className="soc-lead">
          Nature names — <strong>กุหลาบ</strong> (rose), <strong>คำหอม</strong> (fragrant gold),
          <strong> ฟ้า</strong> (sky), <strong>ฝน</strong> (rain), <strong>จันทร์</strong> (moon) —
          carry village naming conventions into the urban informal economy. These are the names
          girls are given at birth in rural provinces. Their appearance in Bangkok spa listings is,
          in part, a legible signal of migration origin — northeastern Thailand, the north —
          and the economic pressure that brought someone here.
        </p>

        <p className="soc-lead">
          English names (Bella, Kirista, Yesika, Paula) are a different performance entirely.
          They signal cosmopolitan positioning — an imagined international clientele, or simply
          distance from the Thai social networks where real names carry real consequences.
          An English name cannot be Googled by a relative.
        </p>

        {/* Gallery */}
        <div className="soc-legend" style={{ marginBottom: '0.5rem' }}>
          <div className="soc-legend-item"><div className="soc-legend-dot accent" /><span>น้อง prefix</span></div>
          <div className="soc-legend-item"><div className="soc-legend-dot status" /><span>Nature / place</span></div>
          <div className="soc-legend-item"><div className="soc-legend-dot data" /><span>English</span></div>
          <div className="soc-legend-item"><div className="soc-legend-dot" style={{ background: 'var(--color-cream-muted)' }} /><span>Shop / other</span></div>
        </div>
        <div className="soc-gallery">
          {names.nongPrefix.examples.map((n) => (
            <span key={n} className="soc-tag nong">{n}</span>
          ))}
          {names.natureNames.examples.map((n) => (
            <span key={n} className="soc-tag nature">{n}</span>
          ))}
          {names.englishNames.examples.slice(0, 8).map((n) => (
            <span key={n} className="soc-tag english">{n}</span>
          ))}
          {names.shopNames.examples.slice(0, 6).map((n) => (
            <span key={n} className="soc-tag">{n}</span>
          ))}
        </div>

        <p className="soc-note">
          The fake name is not deception — or not only deception. It is a rational response to a
          context where real identity carries risk: from family disapproval, from online permanence,
          from police records, from customers who might find you outside of work.
          <strong> The name is a firewall.</strong> The corpus does not preserve real names.
          Neither does it need to.
        </p>
      </section>

      {/* ── Section 04: The Service Lexicon ── */}
      <section className="soc-section">
        <span className="meth-num">04</span>
        <h2>The Service Lexicon</h2>

        <p className="soc-lead">
          Every description in the corpus navigates the same regulatory and social tightrope: present
          enough legitimacy to avoid police attention; present enough ambiguity to attract the full
          range of customers. The vocabulary that emerges is not random — it is a carefully evolved
          set of signals, each carrying meaning that only the intended reader fully decodes.
        </p>

        <p className="soc-lead">
          <strong>นวดไทย</strong> (Thai massage) and <strong>เพื่อสุขภาพ</strong> (for health) are
          the legitimacy anchors — the language of licensed premises and tourist expectations.
          They appear first, and most often. What follows in any given description traces a
          semantic spectrum that no licensing regime has yet had the vocabulary to name.
        </p>

        {/* Split stat */}
        <div className="soc-stats" style={{ marginBottom: '1rem' }}>
          <div className="soc-stat">
            <span className="soc-stat-value">{lexicon.thaiCount}</span>
            <span className="soc-stat-label">Thai terms in top {lexicon.top40.length}</span>
          </div>
          <div className="soc-stat">
            <span className="soc-stat-value">{lexicon.englishCount}</span>
            <span className="soc-stat-label">English terms in top {lexicon.top40.length}</span>
          </div>
          <div className="soc-stat">
            <span className="soc-stat-value">{lexicon.top40[0]?.count || 0}</span>
            <span className="soc-stat-label">Peak frequency: "{lexicon.top40[0]?.term}"</span>
          </div>
        </div>

        <div className="soc-legend" style={{ marginBottom: '0.5rem' }}>
          <div className="soc-legend-item"><div className="soc-legend-dot accent" /><span>Thai term</span></div>
          <div className="soc-legend-item"><div className="soc-legend-dot data" /><span>English term</span></div>
        </div>

        <div className="soc-lex-rows">
          {lexicon.top40.slice(0, 20).map(({ term, count, lang }, i) => {
            const pct = Math.round((count / maxLex) * 100);
            return (
              <div key={term} className="soc-lex-row">
                <span className="soc-lex-rank">{i + 1}</span>
                <span className={`soc-lex-lang ${lang.toLowerCase()}`}>{lang}</span>
                <span className="soc-lex-term">{term}</span>
                <div className="soc-bar-track">
                  <div
                    className={`soc-bar-fill ${lang === 'TH' ? 'th' : 'en'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="soc-bar-count">{count}</span>
              </div>
            );
          })}
        </div>

        <p className="soc-note">
          The presence of both Thai and English terms in the same corpus is not bilingualism —
          it is audience segmentation. Thai terms target local customers who navigate by familiar
          vocabulary. English terms target international visitors and urban Thais who prefer
          distance from the explicitly Thai register. The operators who use both are not translating.
          <strong> They are broadcasting on two frequencies simultaneously.</strong>
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="soc-footer">
        <span className="soc-footer-note">
          Based on {temporal.totalMessages} messages · {mentions.totalOperators} operators · Generated {new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <a href="/methodology" className="meth-back">System methodology →</a>
      </footer>

    </article>
  );
}
