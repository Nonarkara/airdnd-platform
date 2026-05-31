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
  const inPeak = (hour) => {
    const { startHour, endHour } = peakWindow;
    return startHour <= endHour
      ? hour >= startHour && hour < endHour
      : hour >= startHour || hour < endHour;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', minWidth: 320 }} aria-label="Posting hour distribution">
      {hourly.map(({ hour, count }) => {
        const barH = maxCount > 0 ? Math.round((count / maxCount) * H) : 0;
        const x = hour * GAP;
        const isPeak = inPeak(hour);
        return (
          <g key={hour}>
            <rect x={x} y={H - barH} width={barW} height={barH} fill={isPeak ? 'var(--color-action)' : 'var(--color-data)'} />
            {hour % 3 === 0 && (
              <text x={x + barW / 2} y={H + 14} textAnchor="middle" fill="var(--color-cream-muted)" fontSize="8" fontFamily="var(--font-mono)">
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

const hour12 = (h) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
const fmt = (n) => Number(n).toLocaleString();

// ── Main component ────────────────────────────────────────────────────────────
export default function Sociology() {
  const [research, setResearch] = useState(null);
  const [socio, setSocio] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/research.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`research ${r.status}`)))),
      fetch('/sociology.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([r, s]) => { setResearch(r); setSocio(s); })
      .catch((e) => setError(e.message));
  }, []);

  const shell = (children) => (
    <article className="sociology">
      <header className="meth-header">
        <a href="/" className="meth-back">← Directory</a>
        <span className="meth-label">Field Notes</span>
      </header>
      {children}
    </article>
  );

  if (error) return shell(<p className="soc-loading">Data unavailable — {error}</p>);
  if (!research) return shell(<p className="soc-loading">Loading field notes…</p>);

  const { corpus, temporal, intervals, repeat, queries, pricing, channelTiers } = research;
  const maxDayCount = Math.max(...temporal.dayOfWeek.map((d) => d.count), 1);
  const maxBucket = Math.max(...intervals.buckets.map((b) => b.count), 1);
  const maxIntent = Math.max(...queries.intents.map((q) => q.count), 1);
  const maxPrice = pricing?.buckets?.length ? Math.max(...pricing.buckets.map((b) => b.count), 1) : 1;
  const years = corpus.firstSeen && corpus.lastSeen
    ? Math.max(1, Math.round((new Date(corpus.lastSeen) - new Date(corpus.firstSeen)) / (365.25 * 864e5)))
    : null;
  const names = socio?.names;
  const lexicon = socio?.lexicon;
  const maxLex = lexicon ? Math.max(...lexicon.top40.map((t) => t.count), 1) : 1;

  return (
    <article className="sociology">
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
          <p className="meth-date">Working Notes, 2026 · {fmt(corpus.totalMessages)} messages, read by machine</p>
          <p className="meth-date"><a href="/paper" style={{ color: 'var(--mango)', borderBottom: '1px solid currentColor' }}>Read the formal working paper →</a></p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
          <div className="soc-stat" style={{ background: 'transparent', padding: 0 }}>
            <span className="soc-stat-value">{fmt(corpus.totalMessages)}</span>
            <span className="soc-stat-label">Messages analyzed{years ? ` · ${years} years` : ''}</span>
          </div>
          <div className="soc-stat" style={{ background: 'transparent', padding: 0 }}>
            <span className="soc-stat-value">{Math.round(repeat.repeatRate)}%</span>
            <span className="soc-stat-label">Of every post is a repeat</span>
          </div>
          <div className="soc-stat" style={{ background: 'transparent', padding: 0 }}>
            <span className="soc-stat-value">{queries.bookingToPriceRatio}×</span>
            <span className="soc-stat-label">More booking-questions than price-questions</span>
          </div>
        </div>
      </div>

      {/* ── 01 The Anxiety Clock ── */}
      <section className="soc-section">
        <span className="meth-num">01</span>
        <h2>The Anxiety Clock</h2>

        <p className="soc-lead">
          Posting on a Telegram channel is the digital equivalent of a shopkeeper standing in a doorway.
          You need to be visible when traffic passes. The hour-of-day distribution of {fmt(corpus.listingPosts)} broadcast
          posts reveals when operators feel most compelled to announce themselves — and, by inference, when
          they fear being overlooked.
        </p>

        <p className="soc-lead">
          The peak window opens at <strong>{hour12(temporal.peakWindow.startHour)}</strong>, carrying {fmt(temporal.peakWindow.count)} posts.
          This is not the busiest hour for customers — it is the morning "we're open" push, the opening
          anxiety of informal labor. Overnight, 1–5am, the channels fall almost silent. The working day
          has a shape, and the shape is fear of an empty room.
        </p>

        <div className="soc-chart-wrap">
          <div className="soc-chart-label">Posts by hour of day — Bangkok (UTC+7)</div>
          <HourChart hourly={temporal.hourly} peakWindow={temporal.peakWindow} />
          <div className="soc-legend" style={{ marginTop: '0.75rem' }}>
            <div className="soc-legend-item"><div className="soc-legend-dot accent" /><span>Peak window ({hour12(temporal.peakWindow.startHour)}–{hour12(temporal.peakWindow.endHour)})</span></div>
            <div className="soc-legend-item"><div className="soc-legend-dot data" /><span>Other hours</span></div>
          </div>
        </div>

        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Posts by day of week</div>
        <div className="soc-day-bars">
          {temporal.dayOfWeek.map(({ day, label, count }) => {
            const pct = Math.round((count / maxDayCount) * 100);
            return (
              <div key={day} className="soc-day-bar">
                <div className="soc-day-track">
                  <div className={`soc-day-fill${count === maxDayCount ? ' peak' : ''}`} style={{ height: `${pct}%` }} />
                </div>
                <span className="soc-day-name">{label}</span>
                <span className="soc-day-count">{count}</span>
              </div>
            );
          })}
        </div>

        <p className="soc-note">
          <strong>{temporal.pilotPostRate}%</strong> of operator-days are a single solo post — a quiet flag raised once
          and left. But <strong>{temporal.floodDayRate}%</strong> are flooding days of five posts or more; one channel
          posted <strong>{temporal.maxPostsInOperatorDay}</strong> times in a single day. The same doorway, opened and
          re-opened, because the channel forgets you the moment you stop.
        </p>
      </section>

      {/* ── 02 The Repeat Compulsion ── */}
      <section className="soc-section">
        <span className="meth-num">02</span>
        <h2>The Repeat Compulsion</h2>

        <p className="soc-lead">
          Fingerprinting every post against every other reveals the engine underneath: of {fmt(repeat.totalPosts)} broadcasts,
          only <strong>{fmt(repeat.uniquePosts)}</strong> are unique. <strong>{repeat.repeatRate}%</strong> of everything posted is a
          repeat — the same listing, sent again. One single post was re-broadcast <strong>{fmt(repeat.maxRepeatsOfOnePost)} times</strong>.
          This is not marketing. It is the behaviour of someone who believes that to stop posting is to disappear.
        </p>

        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Gap between a channel's consecutive posts</div>
        <div className="soc-bar-rows">
          {intervals.buckets.map((b) => (
            <BarRow key={b.label} label={b.label} count={b.count} maxCount={maxBucket} variant={b.label === '< 1h' ? 'accent' : 'data'} suffix={` (${b.pct}%)`} />
          ))}
        </div>

        <p className="soc-lead">
          The distribution is brutal: <strong>{intervals.buckets[0]?.pct}%</strong> of consecutive posts come less than an hour apart.
          The market resolves into two tiers — rapid-fire aggregator channels that re-broadcast every few minutes, and
          shop-specific channels that surface roughly once a day. Recency is the only reputation signal this economy has:
          no reviews, no ratings, no verified history. The operator who posted three minutes ago outranks the one who
          posted yesterday. <strong>The clock does not stop.</strong>
        </p>

        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Most prolific channels</div>
        <div className="soc-chart-wrap">
          <table className="soc-table">
            <thead>
              <tr>
                <th>#</th><th>Channel</th><th className="soc-td-mono">Posts</th>
                <th className="soc-td-mono">Median gap</th><th>Burstiness</th>
              </tr>
            </thead>
            <tbody>
              {intervals.topRepeaters.slice(0, 8).map((o, i) => (
                <tr key={i}>
                  <td className="soc-td-rank">{i + 1}</td>
                  <td className="soc-td-name">{o.operator}</td>
                  <td className="soc-td-mono">{fmt(o.posts)}</td>
                  <td className="soc-td-mono">{o.medianGapHours < 1 ? `${Math.round(o.medianGapHours * 60)} min` : `${o.medianGapHours} h`}</td>
                  <td className="soc-td-velocity">{o.burstiness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="soc-note">
          And it does not stay in one room. <strong>{repeat.crossPostRate}%</strong> of unique posts appear on more than one
          channel — the same broadcast sprayed across {repeat.maxChannelsForOnePost} groups at once. This is not organic reach.
          It is coordinated flooding: a single supply, multiplied until it fills the field of view.
          {channelTiers && (
            <> The structure is two-tier: <strong>{channelTiers.aggregatorCount} aggregator channels</strong> carry {channelTiers.aggregatorPosts.toLocaleString()} of
            the broadcasts and fire every few minutes, while <strong>{channelTiers.shopCount} shop channels</strong> carry {channelTiers.shopPosts.toLocaleString()} and
            surface roughly once a day. The desperation belongs to the aggregators; the shops just open the door.</>
          )}
        </p>
      </section>

      {/* ── 03 Demand vs Supply ── */}
      <section className="soc-section">
        <span className="meth-num">03</span>
        <h2>What the Buyers Actually Ask</h2>

        <p className="soc-lead">
          Turn the archive over and read the demand side — {fmt(corpus.conversations)} customer messages. What people ask
          for tells you what a market treats as scarce. Here, almost no one asks the two questions a normal directory exists
          to answer.
        </p>

        <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Customer questions by intent</div>
        <div className="soc-bar-rows">
          {queries.intents.map((q) => (
            <BarRow key={q.id} label={q.label} count={q.count} maxCount={maxIntent} variant={q.id === 'booking' ? 'accent' : 'data'} suffix={` (${q.pct}%)`} />
          ))}
        </div>

        <p className="soc-lead">
          Customers ask to <strong>book</strong> — to reserve a person, a slot, a queue — <strong>{queries.bookingToPriceRatio}× more often</strong> than
          they ask the price. And they almost never ask where a place is, or when it opens: <strong>{queries.intents.find((q) => q.id === 'location')?.pct ?? 0}%</strong> location,
          <strong> {queries.intents.find((q) => q.id === 'hours')?.pct ?? 0}%</strong> hours. The operators have pre-empted all of it — every broadcast
          carries the พิกัด (pin), the hours, the rate. The friction is gone.
        </p>

        <p className="soc-note">
          So the only thing left to negotiate is <strong>availability</strong> — is a person free, right now, and can I have her.
          A market that has eliminated price and place as questions, and reorganized itself entirely around real-time
          booking, is no longer behaving like a catalogue. <strong>It is behaving like a labour-dispatch system</strong> — and the
          thing being dispatched is people.
        </p>
      </section>

      {/* ── The Alibi Price ── */}
      {pricing?.count > 50 && (
        <section className="soc-section">
          <span className="meth-num">04</span>
          <h2>The Alibi Price</h2>

          <p className="soc-lead">
            Where a number is named at all — and it rarely is — it clusters tightly. Across {pricing.count.toLocaleString()} baht
            figures extracted from the text, the median is <strong>฿{pricing.median.toLocaleString()}</strong>, and roughly
            nine in ten fall under ฿1,000.
          </p>

          <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Named prices, by band (฿/hour)</div>
          <div className="soc-bar-rows">
            {pricing.buckets.map((b) => (
              <BarRow key={b.label} label={b.label} count={b.count} maxCount={maxPrice} variant={b.lo < 1000 ? 'accent' : 'data'} suffix={` (${b.pct}%)`} />
            ))}
          </div>

          <p className="soc-note">
            But read this against §03 and the trick reveals itself. The visible price is the <strong>legitimate-massage</strong> price —
            the ฿450 hour of therapeutic bodywork, the alibi the whole vocabulary is built to protect. The other price, the one
            attached to what the room and the oil and the shower actually imply, is the one figure the corpus almost never
            contains. <strong>The price you are allowed to read is the price of the cover story.</strong> The real number is settled in
            private, off the record, in the same silence that hides the women's names and their countries of origin.
          </p>
        </section>
      )}

      {/* ── 04 The Name Economy (from sociology.json) ── */}
      {names && (
        <section className="soc-section">
          <span className="meth-num">05</span>
          <h2>The Name Economy</h2>

          <p className="soc-lead">
            Across {names.total} unique names in the corpus, a taxonomy emerges that maps onto market positioning, labor
            sociology, and protective strategy. None of these are likely legal names. They are performance — constructed
            identities for a service context that carries social stigma, legal ambiguity, and physical risk.
          </p>

          <div className="soc-chart-label" style={{ marginBottom: '0.5rem' }}>Name taxonomy — {names.total} unique names</div>
          <div className="soc-bar-rows">
            <BarRow label="น้อง prefix" count={names.nongPrefix.count} maxCount={names.total} variant="accent" suffix={` (${names.nongPrefix.pct}%)`} />
            <BarRow label="Nature / place" count={names.natureNames.count} maxCount={names.total} variant="data" suffix={` (${names.natureNames.pct}%)`} />
            <BarRow label="English" count={names.englishNames.count} maxCount={names.total} variant="data" suffix={` (${names.englishNames.pct}%)`} />
            <BarRow label="Shop / brand" count={names.shopNames.count} maxCount={names.total} variant="data" suffix={` (${names.shopNames.pct}%)`} />
            {names.other && <BarRow label="Other Thai" count={names.other.count} maxCount={names.total} variant="data" suffix={` (${names.other.pct}%)`} />}
          </div>

          <p className="soc-lead">
            <strong>น้อง</strong> (younger sibling, diminutive) is not a name. It is a social contract — the speaker positions
            herself as younger, softer, deferential, less threatening to a customer uncertain about what he is doing.
            Nature names — <strong>กุหลาบ</strong> (rose), <strong>ฟ้า</strong> (sky), <strong>ฝน</strong> (rain) — carry village naming
            into the urban economy, a legible signal of rural migration origin. English names (Bella, Yesika, Paula) are a
            different performance: cosmopolitan distance, and a name that cannot be Googled by a relative.
          </p>

          <div className="soc-gallery">
            {names.nongPrefix.examples.map((n) => <span key={n} className="soc-tag nong">{n}</span>)}
            {names.natureNames.examples.map((n) => <span key={n} className="soc-tag nature">{n}</span>)}
            {names.englishNames.examples.slice(0, 8).map((n) => <span key={n} className="soc-tag english">{n}</span>)}
            {names.shopNames.examples.slice(0, 6).map((n) => <span key={n} className="soc-tag">{n}</span>)}
          </div>

          <p className="soc-note">
            The fake name is not only deception. It is a rational response to a context where real identity carries risk:
            from family, from online permanence, from records, from customers who might find you outside of work.
            <strong> The name is a firewall.</strong>
          </p>
        </section>
      )}

      {/* ── 05 The Service Lexicon (from sociology.json) ── */}
      {lexicon && (
        <section className="soc-section">
          <span className="meth-num">06</span>
          <h2>The Service Lexicon</h2>

          <p className="soc-lead">
            Every description navigates the same tightrope: present enough legitimacy to avoid police attention; present
            enough ambiguity to attract the full range of customers. <strong>นวดไทย</strong> (Thai massage) and <strong>เพื่อสุขภาพ</strong> (for
            health) are the legitimacy anchors — the language of licensed premises. What follows traces a semantic spectrum
            no licensing regime has yet had the vocabulary to name.
          </p>

          <div className="soc-legend" style={{ marginBottom: '0.5rem' }}>
            <div className="soc-legend-item"><div className="soc-legend-dot accent" /><span>Thai term</span></div>
            <div className="soc-legend-item"><div className="soc-legend-dot data" /><span>English term</span></div>
          </div>
          <div className="soc-lex-rows">
            {lexicon.top40.slice(0, 18).map(({ term, count, lang }, i) => (
              <div key={term} className="soc-lex-row">
                <span className="soc-lex-rank">{i + 1}</span>
                <span className={`soc-lex-lang ${lang.toLowerCase()}`}>{lang}</span>
                <span className="soc-lex-term">{term}</span>
                <div className="soc-bar-track">
                  <div className={`soc-bar-fill ${lang === 'TH' ? 'th' : 'en'}`} style={{ width: `${Math.round((count / maxLex) * 100)}%` }} />
                </div>
                <span className="soc-bar-count">{count}</span>
              </div>
            ))}
          </div>

          <p className="soc-note">
            Thai and English in one corpus is not bilingualism — it is audience segmentation. Thai targets local customers;
            English targets visitors and urban Thais who prefer distance from the explicit register.
            <strong> The operators who use both are broadcasting on two frequencies at once.</strong>
          </p>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="soc-footer">
        <span className="soc-footer-note">
          Based on {fmt(corpus.totalMessages)} messages · {corpus.channels} channels · {fmt(corpus.listingPosts)} broadcasts · {fmt(corpus.conversations)} conversations · Generated {new Date(research.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <a href="/methodology" className="meth-back">System methodology →</a>
      </footer>
    </article>
  );
}
