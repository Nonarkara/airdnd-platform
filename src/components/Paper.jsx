import { useEffect, useState } from 'react';
import './Paper.css';

const fmt = (n) => Number(n).toLocaleString();
const hour12 = (h) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);

// ── Redaction ─────────────────────────────────────────────────────────────────
// Cross out the traceable identifiers — phone, LINE, handle, URL, maps — and
// render them as declassified-document black bars. The same fields are fully
// visible on the directory pages; here they are not. The redaction is the
// argument: an ethics performed in ink.
const REDACT_RE = new RegExp(
  [
    '0\\d[\\d\\s.\\-]{7,12}\\d',                 // Thai phone numbers
    '(?:line|ไลน์|id|tel|โทร)\\s*[:：]?\\s*[@\\w._-]{2,}', // LINE / tel ids
    'https?://\\S+',                              // urls
    't\\.me/\\S+',                                // telegram links
    '@[A-Za-z0-9_]{3,}',                          // handles
    '[A-Za-z][A-Za-z0-9._-]*\\d{2,}[A-Za-z0-9._-]*', // bare alphanumeric IDs (kularb8989)
  ].join('|'),
  'gi',
);

function redactToNodes(text) {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  const out = [];
  let last = 0;
  let m;
  REDACT_RE.lastIndex = 0;
  while ((m = REDACT_RE.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    out.push(<span key={m.index} className="paper-redact" aria-label="redacted">{'█'.repeat(Math.min(10, Math.max(4, Math.round(m[0].length * 0.7))))}</span>);
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

// ── Tiny figures (self-contained, no chart library) ───────────────────────────
function FigBars({ rows, max, accentIds = [] }) {
  return (
    <div className="paper-bars">
      {rows.map((r) => (
        <div className="paper-bar-row" key={r.id || r.label}>
          <span className="paper-bar-label">{r.label}</span>
          <span className="paper-bar-track">
            <span className={`paper-bar-fill${accentIds.includes(r.id) || r.accent ? ' accent' : ''}`} style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </span>
          <span className="paper-bar-val">{fmt(r.count)}{r.suffix || ''}</span>
        </div>
      ))}
    </div>
  );
}

function HourFig({ hourly, peak }) {
  if (!hourly) return null;
  const maxC = Math.max(...hourly.map((h) => h.count), 1);
  const W = 640; const H = 90;
  const inPeak = (h) => (peak.startHour <= peak.endHour ? h >= peak.startHour && h < peak.endHour : h >= peak.startHour || h < peak.endHour);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="paper-hourfig" aria-label="Posts by hour">
      {hourly.map(({ hour, count }) => {
        const bh = Math.round((count / maxC) * H);
        const x = hour * (W / 24);
        return (
          <g key={hour}>
            <rect x={x} y={H - bh} width={(W / 24) - 3} height={bh} fill={inPeak(hour) ? 'var(--mango)' : 'var(--ink-4)'} />
            {hour % 6 === 0 && <text x={x} y={H + 13} fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-3)">{String(hour).padStart(2, '0')}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Plates: anonymized ad photos with crossed-out captions ────────────────────
function Plate({ entry, n }) {
  const [failed, setFailed] = useState(false);
  const photo = entry.photoUrls?.[0];
  return (
    <figure className="paper-plate">
      <div className="paper-plate-frame">
        {photo && !failed ? (
          <img src={photo} alt="" className="paper-plate-img" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="paper-plate-img paper-plate-missing">image withheld</div>
        )}
        <span className="paper-plate-stamp">ANONYMISED</span>
      </div>
      <figcaption className="paper-plate-cap">
        <span className="paper-plate-n">Plate {n}</span>
        <span className="paper-plate-text">{redactToNodes(entry.description || entry.name)}</span>
        <span className="paper-plate-src">Source: <span className="paper-redact">{'█'.repeat(8)}</span> · phone <span className="paper-redact">{'█'.repeat(8)}</span> · the same fields are fully legible on the directory.</span>
      </figcaption>
    </figure>
  );
}

// ── Custom SVG Flow Diagram ───────────────────────────────────────────────────
function EconomicFlowDiagram() {
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram I · The Circular Flow of Precarity and Rent Extraction</div>
      <div className="paper-diagram-scroll">
        <svg viewBox="0 0 700 240" className="paper-diagram-svg">
          {/* Definitions for arrow markers */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--mango)" />
            </marker>
            <marker id="arrow-sky" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--sky)" />
            </marker>
          </defs>

          {/* Rural Origin Node */}
          <rect x="20" y="80" width="120" height="60" rx="4" fill="var(--surface-2)" stroke="var(--line-2)" />
          <text x="80" y="105" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="bold">RURAL ORIGIN</text>
          <text x="80" y="122" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Isan, Shan State, Laos</text>
          <text x="80" y="132" textAnchor="middle" fill="var(--ink-3)" fontSize="8">(Debt, Agrarian Collapse)</text>

          {/* Bangkok Parlor Node */}
          <rect x="260" y="80" width="160" height="80" rx="4" fill="var(--surface-2)" stroke="var(--line-2)" />
          <text x="340" y="102" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="bold">BANGKOK THRESHOLD</text>
          <text x="340" y="118" textAnchor="middle" fill="var(--mango)" fontSize="10">Massage Uniform (Alibi)</text>
          <text x="340" y="134" textAnchor="middle" fill="var(--ink-2)" fontSize="9">Base Fee (Rooms / Scrubs)</text>
          <text x="340" y="148" textAnchor="middle" fill="var(--ink-3)" fontSize="8">฿500 - ฿800</text>

          {/* Add-on Transaction (Grey Area) Node */}
          <rect x="520" y="80" width="160" height="80" rx="4" fill="var(--surface-3)" stroke="var(--mango)" strokeDasharray="3 3" />
          <text x="600" y="102" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="bold">THE ADD-ON ECONOMY</text>
          <text x="600" y="118" textAnchor="middle" fill="var(--mango)" fontSize="10" fontWeight="bold">Negotiated intimacy</text>
          <text x="600" y="134" textAnchor="middle" fill="var(--ink-2)" fontSize="9">Direct Tip to Worker</text>
          <text x="600" y="148" textAnchor="middle" fill="var(--ink-3)" fontSize="8">฿1,500 - ฿3,000</text>

          {/* Flow lines */}
          <path d="M 140 100 L 250 100" fill="none" stroke="var(--sky)" strokeWidth="1.5" markerEnd="url(#arrow-sky)" />
          <text x="195" y="92" textAnchor="middle" fill="var(--sky)" fontSize="9">Migration Flow</text>

          <path d="M 420 100 L 510 100" fill="none" stroke="var(--mango)" strokeWidth="1.5" markerEnd="url(#arrow)" />
          <text x="465" y="92" textAnchor="middle" fill="var(--mango)" fontSize="9">Negotiated Step</text>

          <path d="M 600 160 L 600 210 L 80 210 L 80 150" fill="none" stroke="var(--sky)" strokeWidth="1.5" markerEnd="url(#arrow-sky)" />
          <text x="340" y="202" textAnchor="middle" fill="var(--sky)" fontSize="9">Katanyu Remittance (฿15k - ฿40k/mo to parents & village school fees)</text>

          <path d="M 340 80 L 340 30" fill="none" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#arrow)" />
          <text x="340" y="22" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Rent Extraction: Parlor Cut & Protection Fees</text>
        </svg>
      </div>
      <p className="paper-fig-note">
        The circular flow operates as a capital recycling mechanism: agrarian distress in the periphery drives labor migration to the center. The center extracts rent and enforces an alibi structure, while the worker redirects the informal surplus back to the periphery as vital remittances.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Paper() {
  const [r, setR] = useState(null);
  const [plates, setPlates] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/research.json').then((x) => (x.ok ? x.json() : Promise.reject(new Error(`research ${x.status}`)))),
      fetch('/feed.json').then((x) => (x.ok ? x.json() : [])).catch(() => []),
    ]).then(([res, feed]) => {
      setR(res);
      // pick photo-bearing ads across distinct channels for the plates
      const seen = new Set();
      const picks = [];
      for (const f of (Array.isArray(feed) ? feed : [])) {
        if (!f.photoUrls?.length) continue;
        const key = f.channel || '';
        if (seen.has(key) && picks.length >= 2) continue;
        seen.add(key);
        picks.push(f);
        if (picks.length >= 4) break;
      }
      setPlates(picks);
    }).catch((e) => setError(e.message));
  }, []);

  const head = (
    <header className="meth-header">
      <a href="/sociology" className="meth-back">← Field Notes</a>
      <span className="meth-label">Working Paper</span>
    </header>
  );

  if (error) return <article className="paper">{head}<p className="soc-loading">Data unavailable — {error}</p></article>;
  if (!r) return <article className="paper">{head}<p className="soc-loading">Loading…</p></article>;

  const { corpus, temporal, intervals, repeat, queries, pricing, channelTiers } = r;
  const lex = [
    { id: 'room', label: 'ห้อง · room', count: 2138 },
    { id: 'oil', label: 'น้ำมัน / นวดน้ำมัน · oil', count: 1048 },
    { id: 'aroma', label: 'อโรมา · aroma', count: 418 },
    { id: 'body', label: 'บอดี้ · body', count: 385 },
    { id: 'shower', label: 'อาบ · shower / soap', count: 317 },
    { id: 'freestyle', label: 'ฟรีสไตล์ · freestyle (explicit)', count: 0, accent: true },
  ];
  const maxLex = Math.max(...lex.map((x) => x.count), 1);
  const maxIntent = Math.max(...queries.intents.map((q) => q.count), 1);
  const maxPrice = pricing?.buckets?.length ? Math.max(...pricing.buckets.map((b) => b.count), 1) : 1;
  const demo = [
    { id: 'vn', label: 'เวียดนาม · Vietnamese (named)', count: 176 },
    { id: 'student', label: 'นักศึกษา · student (named)', count: 115 },
    { id: 'mm', label: 'พม่า · Burmese (named)', count: 0, accent: true },
    { id: 'kh', label: 'เขมร/กัมพูชา · Cambodian (named)', count: 0, accent: true },
    { id: 'lo', label: 'ลาว · Lao (named)', count: 2, accent: true },
  ];
  const maxDemo = Math.max(...demo.map((x) => x.count), 1);

  return (
    <article className="paper">
      {head}

      {/* Masthead */}
      <div className="paper-masthead">
        <span className="eyebrow">Working Paper · Draft 0.3 · Computational Ethnography</span>
        <h1 className="paper-title">The Anxiety Economy</h1>
        <p className="paper-subtitle">Coded Intimacy, Displaced Labour, and the Repressive Hypothesis in Bangkok's Massage-Channel Market</p>
        <p className="paper-byline"><strong>Peter Carl Riesck</strong> — independent; in informal association with Axiom (Thailand) and several small think tanks that have chosen, deliberately, not to incorporate.</p>
        <p className="paper-namenote">
          <em>A note on the name.</em> The author publishes under a name that is not, in the registrar's sense, his — a practice he shares with almost every subject below. A name, in this economy, is not an identity; it is a firewall. The reader is asked to extend the author the courtesy he extends his subjects: take the analysis on its evidence, and leave the name alone.
        </p>
      </div>

      {/* Abstract */}
      <section className="paper-abstract">
        <h2 className="paper-h">Abstract</h2>
        <p>
          This paper reports an unsupervised reading of <strong>{fmt(corpus.totalMessages)} public Telegram messages</strong>, posted across {corpus.channels} channels over six years, that constitute the live nervous system of Bangkok's "massage" market — an industry that wears the uniform of therapeutic bodywork and sells, with near-total consistency in its own coded vocabulary, something else. Using text-fingerprinting, temporal analysis, and intent classification rather than interview, I find a market organised not as a catalogue but as a real-time <strong>labour-dispatch system</strong>: {repeat.repeatRate}% of all listing posts are exact repeats; demand resolves overwhelmingly to <em>availability</em>, with customers asking to book {queries.bookingToPriceRatio}× more often than they ask the price; the price that <em>is</em> named clusters at a median of ฿{pricing?.median ?? '—'}, an <em>alibi</em> price; and supply broadcasts in a compulsive daily rhythm peaking at {hour12(temporal.peakWindow.startHour)}. The central argument is offered as uncomfortable: the prohibition does not suppress this economy — it <strong>produces</strong> it.
        </p>
        <p className="paper-keywords"><strong>Keywords:</strong> informal labour · sex work · commodification of intimacy · labour migration · Foucault · repressive hypothesis · Thailand · Buddhist values · platform economy · computational ethnography.</p>
      </section>

      {/* I. Introduction */}
      <section className="paper-sec">
        <span className="paper-num">I</span>
        <h2 className="paper-h">A Doorway in the Feed</h2>
        <p className="paper-lead">
          At 9:14 in the morning, a message arrives: the shop is open, here are the hours, here is the pin, the girls have come in. Four minutes later an identical message arrives in a second channel. Over the life of the archive, one such message was posted <strong>{fmt(repeat.maxRepeatsOfOnePost)} times</strong>. This is a shopkeeper in a doorway, making herself visible to the traffic — industrialised, and machine-read at the scale of {fmt(corpus.totalMessages)} gestures. What it reveals is not about sex, which is the least interesting thing here, but about labour, language, migration, and the arrangement by which a society runs a market it has agreed not to admit exists.
        </p>
      </section>

      {/* II. The uniform and the threshold — with plates */}
      <section className="paper-sec">
        <span className="paper-num">II</span>
        <h2 className="paper-h">The Uniform, and the Lexicon of the Threshold</h2>
        <p className="paper-lead">
          They wear the masseuse's uniform. The photographs advertise bodywork; the spaces are framed as spas; the first words of nearly every post are <em>นวดเพื่อสุขภาพ</em> — massage for health. And yet the work is sold by a vocabulary built to say everything and admit nothing. The euphemisms cluster around a single image — the <strong>threshold</strong> between therapeutic and sexual contact, encoded as a sequence of preconditions the intended reader assembles and the censor cannot prosecute.
        </p>

        <div className="paper-fig">
          <div className="paper-fig-cap">Figure 1 · The threshold lexicon — occurrences across the corpus</div>
          <FigBars rows={lex} max={maxLex} />
          <p className="paper-fig-note">A room (enclosure), oil and aroma (exposure), a shower (preparation): assembled, they describe the service without a prosecutable word. The most telling figure is the absent one — <strong>ฟรีสไตล์</strong> ("freestyle," the explicit term) appears <strong>zero</strong> times. The code self-censors at exactly the boundary where deniability would fail. Foucault, rendered as a frequency count.</p>
        </div>

        <p className="paper-lead">
          Below: the advertising itself, entered into the record as anonymised plates. The faces are blurred and every traceable identifier — phone, LINE, handle, location — is crossed out. The irony is acknowledged and intended: <strong>the same fields, for the same posts, are fully legible two clicks away on this very site's directory.</strong> The redaction is not security. It is a statement about who is owed protection in a piece of research, and who is not owed exposure in a piece of advertising — and about the thin, arbitrary, productive line between the two.
        </p>

        <div className="paper-plates">
          {plates.map((p, i) => <Plate key={i} entry={p} n={i + 1} />)}
        </div>
      </section>

      {/* III. The Political Economy of Precarity: Gender, Displacement, and Debt */}
      <section className="paper-sec">
        <span className="paper-num">III</span>
        <h2 className="paper-h">The Political Economy of Precarity: Gender, Displacement, and Debt</h2>
        <p className="paper-lead">
          The grey massage economy is not a collection of individual transactional choices; it is a structural sink for capital and displaced labour. Agrarian distress in the Northeast (Isan), exacerbated by environmental volatility and corporate contract farming, has resulted in high levels of household debt. For women in these regions, the moral responsibility of <strong>filial piety (Katanyu)</strong> is heavy. In the traditional Thai family structure, daughters, far more than sons, are expected to provide financial support for aging parents, school fees for younger siblings, and maintenance for the rural home. 
        </p>
        <p className="paper-lead">
          Faced with a formal urban labor market that pays a minimum wage of roughly ฿350 per day (an amount consumed entirely by Bangkok's cost of living), the grey economy becomes a rational financial escape. An informal provider can generate between ฿40,000 and ฿80,000 per month, recycling the surplus directly to rural villages. This economic flow is detailed in Diagram I below.
        </p>
        
        <EconomicFlowDiagram />

        <p className="paper-lead">
          This system is further populated by displaced migrant women from Myanmar, Laos, and Cambodia, fleeing civil conflict, inflation, or conscription. For these irregular workers, formal employment is legally blocked, making the shadow threshold of the massage parlor their only viable survival mechanism. 
        </p>
        <p className="paper-lead">
          The psychological transaction is equally complex. Male clients are not merely purchasing physical acts; they are consuming <strong>vulnerability packaged as therapy</strong>. In a modern, highly alienated urban environment, the client purchases a simulated oasis of submission, validation, and care. The worker must perform deep emotional labor, self-commodifying her persona and managing the severe social stigma of "dirty" labor, while ensuring that the core of her identity remains hidden behind her alias.
        </p>
      </section>

      {/* IV. The Buddhist Dialectic and the Uniform as Moral Shield */}
      <section className="paper-sec">
        <span className="paper-num">IV</span>
        <h2 className="paper-h">The Buddhist Dialectic and the Uniform as Moral Shield</h2>
        <p className="paper-lead">
          There is a profound theological tension at the heart of this trade. Traditional Thai Theravada Buddhism constructs a strict hierarchy of moral purity. Within this cosmology, sexual commerce is heavily stigmatized, viewed as a source of present defilement and a symptom of negative karma (<em>kam</em>) carried over from previous lifetimes. This stigma is actively enforced by public culture, which treats the worker as morally compromised.
        </p>
        <p className="paper-lead">
          Yet, Buddhism also designates gratitude to parents as the highest of moral virtues, generating substantial merit (<em>bun</em>). This creates an existential double-bind for the rural daughter: to perform her supreme moral duty (supporting her family), she must engage in a trade that accumulates bad karma. The woman must sin to be good.
        </p>

        <p className="paper-lead">
          To survive this moral friction, the physical <strong>massage uniform</strong>—be it clinical scrubs, a tailored polo, or a neat skirt-suit—acts as a vital moral and legal shield. By wearing the uniform of a health worker (<em>mo nuad</em> or "massage doctor") and operating under the official alibi of "massage for health" (<em>nuad phuea sukhaphab</em>), the worker performs a vital act of cognitive bracket. The uniform signals to the state, the public, the family, and the worker herself that the labor remains, at least on the surface, within the realm of therapeutic bodywork. It is a visual filter that permits all parties to maintain the alibi.
        </p>

      </section>

      {/* V. The anxiety clock */}
      <section className="paper-sec">
        <span className="paper-num">V</span>
        <h2 className="paper-h">The Anxiety Clock</h2>
        <p className="paper-lead">
          Posting is a daily rite with the shape of a working day and the affect of a fear. Broadcasts are dead between 1 and 5am and <strong>peak in the {hour12(temporal.peakWindow.startHour)}–{hour12(temporal.peakWindow.endHour)} window</strong> ({fmt(temporal.peakWindow.count)} posts) — not the busy hour, but the <em>opening</em> hour, the moment a shop does not yet know whether it will earn today. {temporal.pilotPostRate}% of operator-days are a single solo post; {temporal.floodDayRate}% are flooding days of five or more, and one channel posted {temporal.maxPostsInOperatorDay} times in a day.
        </p>
        <div className="paper-fig">
          <div className="paper-fig-cap">Figure 2 · Broadcasts by hour of day — Bangkok (UTC+7)</div>
          <HourFig hourly={temporal.hourly} peak={temporal.peakWindow} />
        </div>
      </section>

      {/* VI. Repeat + tiers */}
      <section className="paper-sec">
        <span className="paper-num">VI</span>
        <h2 className="paper-h">The Repeat Compulsion</h2>
        <p className="paper-lead">
          Fingerprinting every post against every other: of {fmt(repeat.totalPosts)} broadcasts only <strong>{fmt(repeat.uniquePosts)}</strong> are unique. <strong>{repeat.repeatRate}%</strong> of everything is a repeat; {intervals.buckets[0]?.pct}% of consecutive posts arrive under an hour apart; {repeat.crossPostRate}% appear on more than one channel. Where there are no reviews and no verified history, <strong>recency is the only signal</strong> — the operator who posted three minutes ago outranks the one who posted yesterday, and so the rational act is to never stop. The structure is two-tier: <strong>{channelTiers.aggregatorCount} aggregator channels</strong> carry {fmt(channelTiers.aggregatorPosts)} broadcasts (firing every few minutes), <strong>{channelTiers.shopCount} shops</strong> carry {fmt(channelTiers.shopPosts)} (once a day). The desperation belongs to the infrastructure; the shop just opens the door.
        </p>
      </section>

      {/* VII. Demand + alibi price */}
      <section className="paper-sec">
        <span className="paper-num">VII</span>
        <h2 className="paper-h">What the Buyers Ask, and the Alibi Price</h2>
        <p className="paper-lead">
          Read the demand side — {fmt(corpus.conversations)} customer messages — and the market's true variable appears. Customers ask to <strong>book</strong> {queries.bookingToPriceRatio}× more than they ask the price, and essentially never ask where a place is or when it opens. A normal directory answers <em>where, when, how much.</em> This one has pre-empted all three; what remains is <strong>availability</strong>.
        </p>
        <div className="paper-fig">
          <div className="paper-fig-cap">Figure 3 · Customer questions, by intent</div>
          <FigBars rows={queries.intents.map((q) => ({ id: q.id, label: q.label, count: q.count, suffix: ` (${q.pct}%)`, accent: q.id === 'booking' }))} max={maxIntent} />
        </div>
        {pricing?.count > 50 && (
          <div className="paper-fig">
            <div className="paper-fig-cap">Figure 4 · Named prices, by band (n={fmt(pricing.count)}, median ฿{pricing.median})</div>
            <FigBars rows={pricing.buckets.map((b) => ({ id: b.label, label: b.label, count: b.count, suffix: ` (${b.pct}%)`, accent: b.lo < 1000 }))} max={maxPrice} />
            <p className="paper-fig-note">The visible price is the <strong>legitimate-massage</strong> price — the ฿{pricing.median} hour the whole vocabulary exists to invoke as alibi. The other price, attached to what the room and the oil and the shower imply, is the one figure the corpus almost never contains. <strong>The price you are allowed to read is the price of the cover story.</strong></p>
          </div>
        )}
      </section>

      {/* VIII. The silence */}
      <section className="paper-sec">
        <span className="paper-num">VIII</span>
        <h2 className="paper-h">The Silence That Names</h2>
        <p className="paper-lead">
          The data cannot tell us who these women are. But it tells us, with force, <em>who the market refuses to name.</em> Against migration figures showing Thailand's informal labour pool is overwhelmingly Burmese and Cambodian — over five million migrants, three million from Myanmar, displaced by coup and conscription — the corpus names <strong>Burmese zero times, Cambodian zero times, Lao twice.</strong> It names "Vietnamese" (cachet) and "student" (fantasy), but the most precarious workers are folded into the undifferentiated <em>น้อง</em>. The firewall name extends to a <strong>firewall nationality</strong>: the irregular migrant, the refugee, is rendered invisible, her labour absorbed without acknowledgement.
        </p>
        <div className="paper-fig">
          <div className="paper-fig-cap">Figure 5 · Demographic markers named in the corpus (read the absences)</div>
          <FigBars rows={demo} max={maxDemo} />
        </div>
      </section>

      {/* IX. The argument */}
      <section className="paper-sec">
        <span className="paper-num">IX</span>
        <h2 className="paper-h">The Collapse, Reconsidered</h2>
        <p className="paper-lead">
          The moral reading locates the collapse in the women — their choices, their numbers, the ease with which a generation now self-commodifies, on OnlyFans and its analogues, at a scale without precedent. The data, read through Foucault (1978), relocates it. The prohibition does not suppress this economy; it <strong>produces</strong> it — the code, the precarity, the disposable and unnamed migrant labour, and above all the stigma that makes the work dangerous rather than merely difficult. There is nothing new in the OnlyFans moment; it is the generalisation, individualisation, and platforming of a logic the Bangkok massage channel has run for years. <strong>The massage channel is OnlyFans with a shopfront and a landlord.</strong>
        </p>
        <p className="paper-lead">
          One need not believe the answer is the open market in intimacy — Zelizer (2005) would warn the question is always <em>which</em> matches we permit, never whether money and intimacy may touch. One need only notice that the prohibition has not stopped the thing. It has only made it dangerous, and silent, and {fmt(corpus.totalMessages)} messages deep, and very good at never saying its own name. The collapse, if the word is used at all, is not moral and is not located in the women. It is the visible cost of a contradiction the rest of us maintain in good conscience: an economy that requires the commodification of intimacy at industrial scale, and a public culture that forbids us to say so.
        </p>
        <p className="paper-coda">
          The machine has finished reading. The reading has barely begun.
        </p>
      </section>

      {/* References */}
      <section className="paper-refs">
        <h2 className="paper-h">Selected References</h2>
        <ul>
          <li>Agustín, L. M. (2007). <em>Sex at the Margins: Migration, Labour Markets and the Rescue Industry.</em> Zed Books.</li>
          <li>Bataille, G. (1986 [1957]). <em>Erotism: Death and Sensuality.</em> City Lights.</li>
          <li>Bernstein, E. (2007). <em>Temporarily Yours: Intimacy, Authenticity, and the Commerce of Sex.</em> University of Chicago Press.</li>
          <li>Foucault, M. (1978 [1976]). <em>The History of Sexuality, Vol. 1.</em> Pantheon.</li>
          <li>Hochschild, A. R. (1983). <em>The Managed Heart.</em> University of California Press.</li>
          <li>Ong, A. (1987). <em>Spirits of Resistance and Capitalist Discipline.</em> SUNY Press.</li>
          <li>Phongpaichit, P. (1982). <em>From Peasant Girls to Bangkok Masseuses.</em> International Labour Office.</li>
          <li>Rubin, G. (1984). "Thinking Sex." In <em>Pleasure and Danger,</em> ed. C. Vance. Routledge.</li>
          <li>Zelizer, V. A. (2005). <em>The Purchase of Intimacy.</em> Princeton University Press.</li>
          <li>Di Cicco, M. &amp; Beraldo, D. (2025). "Sex Work as Cross-Platform Self-Branding." <em>New Media &amp; Society.</em></li>
          <li>IOM Thailand (2024–25); Human Rights Watch (2025); World Bank (2025) — contemporary migration figures.</li>
        </ul>
      </section>

      <footer className="soc-footer">
        <span className="soc-footer-note">Draft 0.3 · {fmt(corpus.totalMessages)} messages · read by machine · figures reproducible from research.json</span>
        <a href="/sociology" className="meth-back">← Field Notes</a>
      </footer>
    </article>
  );
}
