import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from './PageBanner';
import './Insights.css';

// ─── Deep Insights — four ways to read the archive ───────────────────────────
// One dataset, four professional audiences: seekers, health researchers,
// social-work researchers, data engineers. Every number loads from
// public/insights.json (rebuilt at deploy from the full Firestore corpus);
// every block carries its source and its limitation.

const LENSES = [
  { id: 'seeker', num: '01', label: 'Finding a massage', who: 'For seekers' },
  { id: 'health', num: '02', label: 'Public health', who: 'For health professionals' },
  { id: 'social', num: '03', label: 'Social research', who: 'For sex-work & social-work researchers' },
  { id: 'systems', num: '04', label: 'Data systems', who: 'For data analysts & engineers' },
];

function Big({ v, unit, tone }) {
  return (
    <div className="ins-big">
      <span className={`ins-big__v${tone ? ` ins-big__v--${tone}` : ''}`}>{v}</span>
      {unit && <span className="ins-big__u">{unit}</span>}
    </div>
  );
}

function Block({ title, children }) {
  return (
    <article className="ins-block">
      <h3 className="ins-block__title">{title}</h3>
      {children}
    </article>
  );
}

function Src({ children }) {
  return <p className="ins-src">{children}</p>;
}

function BarRow({ label, value, max, accent }) {
  return (
    <div className="ins-bar">
      <span className="ins-bar__label">{label}</span>
      <div className="ins-bar__track">
        <div
          className={`ins-bar__fill${accent ? ' is-accent' : ''}`}
          style={{ width: `${Math.max(1, Math.round(100 * value / Math.max(1, max)))}%` }}
        />
      </div>
      <span className="ins-bar__value">{value.toLocaleString()}</span>
    </div>
  );
}

function HourClock({ hours }) {
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  return (
    <div className="ins-clock" role="img" aria-label={`Posting activity by hour, peak ${peak}:00`}>
      {hours.map((n, h) => (
        <div key={h} className="ins-clock__col" title={`${String(h).padStart(2, '0')}:00 — ${n}`}>
          <div
            className={`ins-clock__bar${h === peak ? ' is-peak' : ''}`}
            style={{ height: `${Math.max(2, Math.round(52 * n / max))}px` }}
          />
          {h % 6 === 0 && <span className="ins-clock__tick">{String(h).padStart(2, '0')}</span>}
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const { t } = useLanguage();
  const page = t.pages?.insights || {};
  const [data, setData] = useState(null);
  const [lens, setLens] = useState('seeker');

  useEffect(() => {
    let cancelled = false;
    fetch('/insights.json')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const d = data;
  const funnel = useMemo(() => {
    if (!d) return null;
    const msgs = d.corpus.messagesTotal || 0;
    return {
      msgs,
      posts: d.corpus.personaPosts,
      businesses: d.corpus.uniqueBusinesses,
      yield: msgs ? (100 * d.corpus.personaPosts / msgs).toFixed(1) : null,
      compression: msgs ? Math.round(msgs / d.corpus.uniqueBusinesses) : null,
    };
  }, [d]);

  if (!d) {
    return <div className="ins-page"><p className="ins-loading">Loading the archive…</p></div>;
  }

  const active = LENSES.find(l => l.id === lens);
  const priceEntries = Object.entries(d.prices.hist).map(([b, n]) => [Number(b), n]).sort((a, b) => a[0] - b[0]);
  const maxPrice = Math.max(...priceEntries.map(([, n]) => n), 1);
  const aliasEntries = Object.entries(d.corpus.aliasDist);
  const maxAlias = Math.max(...aliasEntries.map(([, n]) => n), 1);
  const euph = Object.entries(d.euphemisms).sort((a, b) => b[1] - a[1]);
  const maxEuph = Math.max(...euph.map(([, n]) => n), 1);
  const topChannelShare = d.channels.shares.length
    ? Math.round(100 * d.channels.shares[0][1] / d.corpus.personaPosts)
    : 0;

  return (
    <div className="ins-page">
      <PageBanner image="/heroes/insights.jpg" tone="light" compact ariaLabelledBy="insights-title">
        <p className="ins-eyebrow">{page.kicker || '02 — Reading room'}</p>
        <h1 id="insights-title">{page.title || 'One archive, four professions'}</h1>
        <p className="ins-lead">
          {(page.lead || '{messages} Telegram messages, distilled to {posts} listings from {businesses} real businesses. The same data answers different questions depending on who is asking. Choose your profession — every figure below states its source and what it cannot claim.')
            .replace('{messages}', d.corpus.messagesTotal?.toLocaleString() || '—')
            .replace('{posts}', d.corpus.personaPosts?.toLocaleString() || '—')
            .replace('{businesses}', String(d.corpus.uniqueBusinesses ?? '—'))}
        </p>
        <div className="ins-links">
          <Link to="/">{page.inventory || 'Inventory'}</Link>
          <Link to="/methodology">{page.method || 'Method'}</Link>
          <Link to="/health">{page.health || 'HIV / STI layer'}</Link>
          <a href="/dataset_aggregate.json" download>{page.download || 'Download dataset · 91 rows'}</a>
        </div>
      </PageBanner>

      <nav className="ins-lenses" aria-label="Audience lenses">
        {LENSES.map(l => (
          <button
            key={l.id}
            type="button"
            className={lens === l.id ? 'is-on' : ''}
            onClick={() => setLens(l.id)}
            aria-pressed={lens === l.id}
          >
            <span className="ins-lenses__num">{l.num}</span>
            {l.label}
          </button>
        ))}
      </nav>

      <p className="ins-who">{active.who}</p>

      {/* ══ 01 · SEEKER ══════════════════════════════════════════════════════ */}
      {lens === 'seeker' && (
        <div className="ins-grid">
          <Block title="The price is not a negotiation">
            <Big v={`฿${d.prices.median}`} unit="/hr — and the 25th and 75th percentile are the same number" tone="accent" />
            <p>
              Across {d.prices.mentions} mined price mentions, the lower quartile, median, and upper
              quartile are all ฿{d.prices.median}. This is an institutional norm, not a market price —
              quoting it signals you know the market. A ฿500–700 quote marks the premium tier
              (private rooms, hotel outcall), not an opening bid.
            </p>
            <div className="ins-bars">
              {priceEntries.map(([b, n]) => (
                <BarRow key={b} label={`฿${b}${b >= 1000 ? '+' : ''}`} value={n} max={maxPrice} accent={b === 200} />
              ))}
            </div>
            <Src>Text-mined from listing posts. Cannot say: final prices paid, tips, or add-on charges.</Src>
          </Block>

          <Block title="Call in the morning, visit before eleven">
            <HourClock hours={d.postingHours} />
            <p>
              Operators build the day's roster at 09:00 — that is when photo sets and availability go out.
              Of the businesses observed, {d.closing.evening.toLocaleString()} listing-posts state closing
              at 21:00–23:00; {d.closing.afterMidnight.toLocaleString()} advertise past 01:00. If you need
              late-night service it exists, but it is the minority register — and check the freshness
              stamp ("2h ago") on any card before calling: only {d.activity.active7d} of
              {' '}{d.corpus.uniqueBusinesses} businesses posted in the last 7 days.
            </p>
            <Src>Posting timestamps (UTC+7) and stated hours. Cannot say: actual door hours — only what operators claim.</Src>
          </Block>

          <Block title='What the "5 IDs" badge means'>
            <p>
              A shop posting under many names is not a scam signal here — it is feed marketing.
              One business in this archive posts under {d.corpus.maxAliases} names. The directory
              collapses every persona to its phone number, so the card you see is the business,
              with its identity count shown honestly. Use the grey-score label the same way:
              it reads the post's own vocabulary, nothing else.
            </p>
            <Src>Phone-number dedup; see /methodology. Cannot say: service quality — no review system exists in these channels.</Src>
          </Block>
        </div>
      )}

      {/* ══ 02 · HEALTH ══════════════════════════════════════════════════════ */}
      {lens === 'health' && (
        <div className="ins-grid">
          <Block title="A complete venue census is actually feasible">
            <Big v={d.corpus.uniqueBusinesses} unit="venues cover the entire observed market" tone="accent" />
            <p>
              The apparent thousands of listings reduce to {d.corpus.uniqueBusinesses} phone-verified
              venues — {contactLine(d)}. A venue-level outreach program (testing, PrEP information,
              occupational safety) could reach this entire market segment with a two-person team.
              The archive is effectively a live sampling frame that no health agency currently has.
            </p>
            <Src>Live corpus rollup. Cannot say: worker headcount per venue — only venue-level contact.</Src>
          </Block>

          <Block title="The outreach window is one month wide">
            <Big v={`${d.activity.avgLifespanDays}d`} unit="mean observed venue lifespan in-channel" />
            <p>
              Only {d.activity.active7d} of {d.corpus.uniqueBusinesses} venues posted in the last week;
              {' '}{d.activity.active30d} in the last month. Mean observed posting lifespan is
              {' '}{d.activity.avgLifespanDays} days (max {d.activity.maxLifespanDays}). Any quarterly-cycle
              outreach design misses roughly half this market between waves — engagement has to ride the
              channel's own rhythm, which peaks at 09:00 daily.
            </p>
            <Src>First/last-seen per phone. Lifespan is censored — venues may operate offline after leaving the channel.</Src>
          </Block>

          <Block title="The wage structure is the risk structure">
            <Big v="฿100" unit="/hr therapist take at the ฿200 norm, 50/50 split" tone="accent" />
            <p>
              At the fixed ฿{d.prices.median} price with the industry's standard split, a therapist's
              hour nets ฿100 — Bangkok's minimum wage equivalent only at full utilisation. That
              arithmetic is the occupational-health lever: no-work-no-pay plus fixed prices means
              declining a client has a direct wage cost. Interventions that ignore the piece-rate
              economics will not change behaviour. See the concurrent
              {' '}<Link to="/health">HIV / STI layer</Link> for geography.
            </p>
            <Src>Mined prices + industry-reported split convention (no official statistics on splits exist).</Src>
          </Block>
        </div>
      )}

      {/* ══ 03 · SOCIAL RESEARCH ═════════════════════════════════════════════ */}
      {lens === 'social' && (
        <div className="ins-grid">
          <Block title="Personas are inventory">
            <div className="ins-bars">
              {aliasEntries.map(([k, n]) => (
                <BarRow key={k} label={`${k} name${k === '1' ? '' : 's'}`} value={n} max={maxAlias} accent={k === '20+'} />
              ))}
            </div>
            <p>
              Half the businesses post under one name; two post under twenty or more (max
              {' '}{d.corpus.maxAliases}). Identity rotation is labour: each persona gets photos, a
              personality, a posting schedule. It serves the feed algorithm (fresh names surface),
              and it serves deniability (no persistent identity accumulates a record). The persona—
              not the shop, not the worker—is the unit of marketing in this economy.
            </p>
            <Src>Alias distribution over phone-deduped businesses. Cannot say: whether personas map to real individual workers.</Src>
          </Block>

          <Block title="The euphemism gradient is the register system">
            <div className="ins-bars">
              {euph.map(([k, n]) => (
                <BarRow key={k} label={k} value={n} max={maxEuph} accent={k === 'aroma'} />
              ))}
            </div>
            <p>
              "Aroma" appears in {d.euphemisms.aroma} posts — the load-bearing word of the alibi
              structure. The vocabulary is shared across the สายขาว/สายดำ continuum; what
              distinguishes registers is combination and hour, not any single term. The field notes
              in <Link to="/sociology">Sociology</Link> and the matching model in
              {' '}<Link to="/matching">The Match</Link> unpack this vocabulary in detail.
            </p>
            <Src>Regex counts over post text. Cannot say: intent of any individual post — registers are corpus-level patterns.</Src>
          </Block>

          <Block title="One broker controls the visibility market">
            <Big v={d.channels.hhi.toLocaleString()} unit={`HHI — ${topChannelShare}% of posts flow through one channel`} tone="accent" />
            <p>
              A Herfindahl–Hirschman Index above 2,500 marks a highly concentrated market; this one
              scores {d.channels.hhi.toLocaleString()}. The channel operator is a de-facto broker:
              visibility, and therefore income, depends on one intermediary's feed. For researchers
              of platform labour, this is gig-economy dependency without the platform company —
              reconstructed socially inside a messaging app.
            </p>
            <Src>Post counts per source channel. Cannot say: financial arrangements between shops and channel operators.</Src>
          </Block>

          <Block title="Ethics of this archive">
            <p>
              Everything here comes from public broadcast channels. The platform surfaces business
              contact information only; the downloadable dataset masks phone numbers and excludes
              person-style persona names, publishing business-style names alone. Photos flagged by
              the NSFW screen are withheld from display while records are retained for audit.
              This is observation of a public marketplace, not surveillance of individuals — and
              the line between those two is exactly what we ask researchers using this data to hold.
            </p>
            <Src><a href="/dataset_aggregate.json" download>dataset_aggregate.json</a> · 91 rows, aggregate-only. Full method: <Link to="/methodology">/methodology</Link>.</Src>
          </Block>
        </div>
      )}

      {/* ══ 04 · DATA SYSTEMS ════════════════════════════════════════════════ */}
      {lens === 'systems' && (
        <div className="ins-grid">
          <Block title={`The funnel: ${funnel.compression?.toLocaleString() || '—'} messages per business`}>
            <div className="ins-funnel">
              <div className="ins-funnel__step">
                <span className="ins-funnel__v">{funnel.msgs.toLocaleString()}</span>
                <span className="ins-funnel__l">raw messages</span>
              </div>
              <span className="ins-funnel__arrow">→</span>
              <div className="ins-funnel__step">
                <span className="ins-funnel__v">{funnel.posts.toLocaleString()}</span>
                <span className="ins-funnel__l">extracted listings ({funnel.yield}%)</span>
              </div>
              <span className="ins-funnel__arrow">→</span>
              <div className="ins-funnel__step">
                <span className="ins-funnel__v ins-funnel__v--accent">{funnel.businesses}</span>
                <span className="ins-funnel__l">unique businesses</span>
              </div>
            </div>
            <p>
              A 30-second polling loop over 12 channels yields {funnel.yield}% extractable listings;
              phone-key deduplication then compresses {d.corpus.duplicationFactor}× to ground truth.
              The lesson for any community-scraping system: the entity-resolution key (here, the phone
              number) is worth more than the extraction model. Without it this directory would be
              {' '}{d.corpus.personaPosts.toLocaleString()} entries of noise.
            </p>
            <Src>Pipeline counters, deploy-time. Yield varies by channel type — broadcast channels run far higher than chat groups.</Src>
          </Block>

          <Block title="Dedup cascade: the key beats the model">
            <p>
              Three layers, checked in order: <strong>phone number</strong> (catches the 40× — one
              operator, 45 names), <strong>exact name + location</strong>, then <strong>fuzzy
              name</strong> (Thai prefix stripping, 10-char minimum). Gemini extracts fields, but
              every consequential merge decision is deterministic — the AI is confined to parsing,
              never identity. That split is what makes the numbers auditable.
            </p>
            <Src>scripts/listing_pipeline.js. Residual risk: businesses that rotate phone numbers are counted twice — observed rarely.</Src>
          </Block>

          <Block title="Failure log — kept honestly">
            <ul className="ins-log">
              <li>
                <span className="ins-log__tag">522 · 12 days</span>
                Free-tier Supabase went unreachable mid-July and stayed down. The frontend survived
                because reads had been flipped to Firestore-first; the archive writes did not.
              </li>
              <li>
                <span className="ins-log__tag">hang · 3 days</span>
                The scraper blocked on Supabase calls that had no timeout — a process ran for three
                days syncing nothing. Fix: an <code>AbortSignal.timeout(8s)</code> fetch on every
                client. A distributed system without deadlines is a distributed deadlock.
              </li>
              <li>
                <span className="ins-log__tag">20k files</span>
                The photo archive outgrew Cloudflare Pages' file cap. Fix: deploy only the
                displayable set (hero + 8 per business); the archive stays local.
              </li>
            </ul>
            <Src>Real incidents from this system's operation, June–July 2026. Post-mortems in the repo history.</Src>
          </Block>

          <Block title="Total infrastructure cost: zero">
            <p>
              Telegram API, Gemini extraction, Firestore reads, Cloudflare Pages hosting, Google
              Sheets backup — every component rides a free tier. One person, no hardware, operating
              a {d.corpus.messagesTotal?.toLocaleString()}-message archive with
              {' '}{d.corpus.photosArchived.toLocaleString()} photos. The replicable claim: any
              community that broadcasts its supply can be turned into structured intelligence at
              zero marginal cost. The stack is documented in <Link to="/methodology">Method</Link>;
              the aggregate data is <a href="/dataset_aggregate.json" download>downloadable</a>.
            </p>
            <Src>Cost audit, Jul 2026. Caveat: free tiers fail without SLAs — see the failure log above; $0 buys zero recourse.</Src>
          </Block>
        </div>
      )}

      <footer className="ins-foot">
        <span>Computed {new Date(d.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} from the full archive · rebuilt at every deploy</span>
        <Link to="/">← Inventory</Link>
      </footer>
    </div>
  );
}

function contactLine(d) {
  return `${d.contact.phone}% publish a phone, ${d.contact.line}% a LINE, ${d.contact.maps}% a Maps pin`;
}
