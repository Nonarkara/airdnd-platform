import { useLanguage } from '../context/LanguageContext';
import PageBanner from './PageBanner';
import './Methodology.css';

function Methodology() {
  const { t, language } = useLanguage();
  const pc = t.pageChrome || {};
  const page = t.pages?.methodology || {};
  return (
    <article className="methodology">
      <header className="meth-header">
        <a href="/" className="meth-back">{pc.backToDirectory || 'Back to Directory'}</a>
        <span className="meth-label">{pc.researchPaper || 'Research Paper'}</span>
      </header>
      {language !== 'en' && (
        <p className="meth-lang-note">{pc.languageNote || 'This paper is available in English only.'}</p>
      )}

      <PageBanner image="/heroes/methodology.jpg" tone="light" compact className="meth-hero-banner" ariaLabelledBy="meth-title">
        <h1 id="meth-title" className="meth-title">
          {page.title || 'Community Intelligence'}
          <br />
          <span className="meth-title-accent">{page.accent || 'at Zero Marginal Cost'}</span>
        </h1>
        <p className="meth-author">{page.author || 'Peter Karl Risk'}</p>
        <p className="meth-date">{page.date || 'Working Paper, March 2026'}</p>
      </PageBanner>

      <section className="meth-section">
        <span className="meth-num">01</span>
        <h2>Abstract</h2>
        <p className="meth-lead">
          This project demonstrates that a single person, owning zero hardware, can build and operate
          a real-time community intelligence platform using only AI services and free-tier cloud infrastructure.
          The massage and spa directory is the case study, but the system is designed as a generalizable template
          for any domain where community-sourced information creates value.
        </p>
        <p>
          By combining Telegram channel scraping, AI-powered data extraction (Google Gemini), real-time
          database synchronization (Supabase), and automated photo archival, the platform continuously
          mines community knowledge and transforms it into structured, searchable, and analyzable data
          without any human curation effort.
        </p>
      </section>

      <section className="meth-section">
        <span className="meth-num">02</span>
        <h2>System Architecture</h2>

        <div className="meth-diagram">
          <svg viewBox="0 0 800 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="meth-svg">
            {/* Telegram Sources */}
            <rect x="20" y="120" width="140" height="80" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="90" y="155" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">TELEGRAM</text>
            <text x="90" y="175" textAnchor="middle" fill="var(--ink-3)" fontSize="9">12 channels</text>
            <text x="90" y="190" textAnchor="middle" fill="var(--ink-3)" fontSize="9">80,000+ records</text>

            {/* Arrow */}
            <line x1="160" y1="160" x2="220" y2="160" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="220,155 230,160 220,165" fill="var(--mango)" />

            {/* Gemini AI */}
            <rect x="230" y="120" width="140" height="80" stroke="var(--navy)" strokeWidth="1" fill="none" />
            <text x="300" y="155" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">GEMINI AI</text>
            <text x="300" y="175" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Extract, classify,</text>
            <text x="300" y="190" textAnchor="middle" fill="var(--ink-3)" fontSize="9">enrich listings</text>

            {/* Arrow */}
            <line x1="370" y1="160" x2="430" y2="160" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="430,155 440,160 430,165" fill="var(--mango)" />

            {/* Supabase */}
            <rect x="440" y="100" width="140" height="120" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="510" y="135" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">SUPABASE</text>
            <text x="510" y="155" textAnchor="middle" fill="var(--ink-3)" fontSize="9">listings</text>
            <text x="510" y="170" textAnchor="middle" fill="var(--ink-3)" fontSize="9">channel_messages</text>
            <text x="510" y="185" textAnchor="middle" fill="var(--ink-3)" fontSize="9">photo_archive</text>
            <text x="510" y="200" textAnchor="middle" fill="var(--ink-3)" fontSize="9">page_views</text>

            {/* Arrow */}
            <line x1="580" y1="160" x2="640" y2="160" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="640,155 650,160 640,165" fill="var(--mango)" />

            {/* Frontend */}
            <rect x="650" y="120" width="130" height="80" stroke="var(--navy)" strokeWidth="1" fill="none" />
            <text x="715" y="155" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">FRONTEND</text>
            <text x="715" y="175" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Real-time directory</text>
            <text x="715" y="190" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Interactive map</text>

            {/* Side outputs */}
            <line x1="510" y1="220" x2="510" y2="270" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="505,270 510,280 515,270" fill="var(--navy)" />
            <text x="510" y="300" textAnchor="middle" fill="var(--navy)" fontSize="10" fontWeight="600">Google Sheets BI</text>

            <line x1="300" y1="200" x2="300" y2="260" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="295,260 300,270 305,260" fill="var(--navy)" />
            <text x="300" y="290" textAnchor="middle" fill="var(--navy)" fontSize="10" fontWeight="600">Telegram Bot</text>

            {/* Title */}
            <text x="400" y="30" textAnchor="middle" fill="var(--ink-4)" fontSize="10" fontWeight="500" letterSpacing="3">DATA PIPELINE ARCHITECTURE</text>
          </svg>
        </div>
      </section>

      <section className="meth-section">
        <span className="meth-num">03</span>
        <h2>Data Quality Engineering</h2>
        <p>
          Raw community data is inherently noisy. The pipeline employs a multi-layer quality system:
        </p>
        <div className="meth-grid">
          <div className="meth-card">
            <h3>Human-Centric Consolidation</h3>
            <p>Multiple photos from a single post are consolidated into a single rich listing with an interactive gallery, preventing visual feed jitter.</p>
          </div>
          <div className="meth-card">
            <h3>Three-Layer Deduplication</h3>
            <p>Phone number matching, exact name+location, then fuzzy normalized-name matching with 10-character minimum for substring comparison.</p>
          </div>
          <div className="meth-card">
            <h3>Quality Gate</h3>
            <p>Every listing passes validation: name length, description quality, numeric-only rejection, generic name blocking.</p>
          </div>
          <div className="meth-card">
            <h3>Sentiment Analysis</h3>
            <p>AI extracts market sentiment and service quality keywords from community feedback, providing qualitative intelligence at scale.</p>
          </div>
        </div>
      </section>

      <section className="meth-section">
        <span className="meth-num">04</span>
        <h2>AI-Powered Extraction</h2>
        <p>
          Google Gemini 2.5 Flash processes clustered Telegram messages and extracts structured data:
          business name, location, price, operating hours, phone number, LINE contact, Google Maps link,
          service type tags, and user feedback summaries. The model is prompted to extract only what is
          explicitly present in the text and to never invent ratings or reviews.
        </p>
        <blockquote className="meth-quote">
          The AI doesn't create intelligence. It extracts it from the community's own words.
        </blockquote>
      </section>

      <section className="meth-section">
        <span className="meth-num">04·A</span>
        <h2>Algorithm · Three-Layer Deduplication</h2>
        <p>
          The same parlour appears in dozens of channels under different staff names, varying transliterations,
          and fragments of addresses. A naïve string match collapses to chaos. The pipeline applies three
          orthogonal identity signals in strict precedence order — each layer falls back only when the prior
          one has no opinion, never when it disagrees:
        </p>

        <div className="meth-diagram">
          <svg viewBox="0 0 820 360" className="meth-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three-layer deduplication decision tree">
            <defs>
              <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--mango)" />
              </marker>
            </defs>
            {/* Input */}
            <rect x="20" y="20" width="200" height="56" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="120" y="46" textAnchor="middle" fill="var(--ink)" fontFamily="Josefin Sans, sans-serif" fontWeight="700" fontSize="14">Telegram cluster</text>
            <text x="120" y="64" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="11">name · phone · LINE · maps</text>

            {/* Layer 1: phone */}
            <line x1="120" y1="76" x2="120" y2="105" stroke="var(--line-2)" markerEnd="url(#arrow-orange)" />
            <rect x="20" y="110" width="200" height="80" stroke="var(--navy)" strokeWidth="1" fill="none" />
            <text x="120" y="132" textAnchor="middle" fill="var(--navy)" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">LAYER 1 — PHONE</text>
            <text x="120" y="152" textAnchor="middle" fill="var(--ink)" fontFamily="Josefin Sans, sans-serif" fontSize="13">normalize → E.164</text>
            <text x="120" y="170" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">match if cleaned digits equal</text>
            <text x="120" y="183" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">strongest signal · low entropy</text>

            {/* Yes branch from Layer 1 */}
            <line x1="220" y1="150" x2="320" y2="150" stroke="var(--line-2)" markerEnd="url(#arrow-orange)" />
            <text x="270" y="143" textAnchor="middle" fill="var(--navy)" fontFamily="JetBrains Mono, monospace" fontSize="10">match → MERGE</text>

            {/* Layer 2: name+location */}
            <line x1="120" y1="190" x2="120" y2="215" stroke="var(--line-2)" markerEnd="url(#arrow-orange)" />
            <text x="138" y="207" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">no phone</text>
            <rect x="20" y="220" width="200" height="80" stroke="var(--ink-3)" strokeWidth="1" fill="none" />
            <text x="120" y="242" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">LAYER 2 — NAME + LOCATION</text>
            <text x="120" y="262" textAnchor="middle" fill="var(--ink)" fontFamily="Josefin Sans, sans-serif" fontSize="13">canonicalise both fields</text>
            <text x="120" y="280" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">match if exact equality after</text>
            <text x="120" y="293" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">strip ‘ร้าน’ · diacritics · case</text>

            {/* Yes branch from Layer 2 */}
            <line x1="220" y1="260" x2="320" y2="260" stroke="var(--line-2)" markerEnd="url(#arrow-orange)" />
            <text x="270" y="253" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">match → MERGE</text>

            {/* Layer 3: fuzzy */}
            <line x1="120" y1="300" x2="120" y2="325" stroke="var(--line-2)" markerEnd="url(#arrow-orange)" />
            <text x="138" y="318" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">distinct</text>
            <rect x="20" y="330" width="200" height="20" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="120" y="345" textAnchor="middle" fill="var(--mango)" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="0.1em">LAYER 3 — FUZZY (≥ 10 char substring)</text>

            {/* Right column: outcomes */}
            <rect x="320" y="120" width="220" height="60" stroke="var(--navy)" strokeWidth="1" fill="none" />
            <text x="430" y="142" textAnchor="middle" fill="var(--navy)" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">PHONE-CLUSTER MERGE</text>
            <text x="430" y="160" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">e.g. one operator → many</text>
            <text x="430" y="172" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">staff aliases · single record</text>

            <rect x="320" y="230" width="220" height="60" stroke="var(--ink-3)" strokeWidth="1" fill="none" />
            <text x="430" y="252" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">CANONICAL MERGE</text>
            <text x="430" y="270" textAnchor="middle" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="10">same shop, different scribes</text>

            {/* Far right: scoring formula */}
            <rect x="580" y="80" width="220" height="240" stroke="var(--line-2)" strokeWidth="1" fill="none" />
            <text x="690" y="105" textAnchor="middle" fill="var(--mango)" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.12em">CANONICAL SCORE</text>
            <text x="600" y="135" fill="var(--ink)" fontFamily="JetBrains Mono, monospace" fontSize="11">score(L) =</text>
            <text x="610" y="155" fill="var(--navy)" fontFamily="JetBrains Mono, monospace" fontSize="11">  35 · I[maps]</text>
            <text x="610" y="172" fill="var(--navy)" fontFamily="JetBrains Mono, monospace" fontSize="11">+ 25 · I[phone]</text>
            <text x="610" y="189" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="11">+ 15 · I[line]</text>
            <text x="610" y="206" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="11">+ 10 · I[hours]</text>
            <text x="610" y="223" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="11">+ 10 · I[price]</text>
            <text x="610" y="240" fill="var(--ink-3)" fontFamily="JetBrains Mono, monospace" fontSize="11">+ min(10, mention)</text>
            <line x1="600" y1="252" x2="780" y2="252" stroke="var(--line-2)" />
            <text x="600" y="272" fill="var(--ink-3)" fontFamily="Josefin Sans, sans-serif" fontSize="11">When two candidates merge,</text>
            <text x="600" y="288" fill="var(--ink-3)" fontFamily="Josefin Sans, sans-serif" fontSize="11">the higher-score record wins;</text>
            <text x="600" y="304" fill="var(--ink-3)" fontFamily="Josefin Sans, sans-serif" fontSize="11">missing fields are filled from</text>
            <text x="600" y="320" fill="var(--ink-3)" fontFamily="Josefin Sans, sans-serif" fontSize="11">the loser. Indicators I[·] ∈ {`{0,1}`}.</text>
          </svg>
        </div>

        <p>
          Phone is privileged because the entropy of phone-number space is enormous compared to any text field;
          a coincidence collision is statistically negligible. Layer 2 catches a single shop transliterated
          differently across channels (Latin vs. Thai script, with or without honourifics like
          <code>ร้าน</code>). Layer 3 is the conservative final pass — it requires a 10-character minimum
          substring overlap so it never collapses unrelated short names. The full algorithm lives in
          <code>src/lib/listing_contract.js</code> as <code>buildCanonicalKey</code> and
          <code>scoreCanonicalCandidate</code>.
        </p>
      </section>

      <section className="meth-section">
        <span className="meth-num">04·B</span>
        <h2>Information-Theoretic Foundations</h2>
        <p>
          Several decisions in the pipeline rest on real information theory rather than heuristics. Two are
          worth surfacing because Red Dot judges asked specifically about the mathematical foundation.
        </p>

        <div className="meth-grid">
          <div className="meth-card">
            <h3>Channel Diversity · Shannon Entropy</h3>
            <p>
              For the source-channel distribution we compute
              <code>H(C) = −Σ p(cᵢ) log₂ p(cᵢ)</code>, where <code>p(cᵢ)</code> is the share of
              listings discovered through channel <code>cᵢ</code>. Higher <code>H</code> means the directory
              is informationally diverse; <code>H/log₂ k</code> (the evenness ratio against the maximum
              possible entropy across <code>k</code> channels) tells you whether one channel dominates
              the supply. We surface both numbers on the Analytics page so any imbalance is auditable
              instead of vibe-judged.
            </p>
          </div>
          <div className="meth-card">
            <h3>Mention Concentration · Power Law</h3>
            <p>
              Listing mention counts <code>{`{Cₖ}`}</code> are fit by ordinary least squares on log-log axes
              against rank <code>k</code>. The fitted line <code>log Cₖ = log C₁ − α · log k</code> recovers
              the empirical exponent <code>α</code>, with a goodness-of-fit <code>R²</code>. A clean Zipf
              law (<code>α ≈ 1</code>) implies the most-discussed parlour gets <code>10×</code> the chatter of
              the 10th and <code>100×</code> the 100th — an informational topology that argues for
              spending the recommendation budget on the long tail, not the head.
            </p>
          </div>
          <div className="meth-card">
            <h3>Channel Signal-to-Noise</h3>
            <p>
              For each channel we report <code>SNR = unique_listings / total_mentions</code>. A ratio near
              <code>1.0</code> means almost every post is a new place (genuine discovery); a ratio near
              <code>0</code> means the channel echoes a small set repeatedly (volume without breadth).
              This separates feeds whose intent is to surface new shops from feeds whose intent is to
              maintain visibility of an existing roster — both legitimate, both worth knowing about.
            </p>
          </div>
          <div className="meth-card">
            <h3>Listing Half-Life</h3>
            <p>
              For each listing we compute <code>Δt = updated_at − created_at</code> in days, then the
              empirical median across the population. This is the directory's measured "attention
              half-life" — how long after a parlour first surfaces it continues to receive any
              mention or update. Reported with <code>n</code>, median, mean, and max so the variance
              isn't hidden by the headline number.
            </p>
          </div>
        </div>
      </section>

      <section className="meth-section">
        <span className="meth-num">05</span>
        <h2>Zero Hardware Architecture</h2>
        <p>
          The entire system runs on free-tier or minimal-cost cloud services. No servers are owned or maintained.
        </p>
        <div className="meth-table">
          <div className="meth-row"><span>Frontend</span><span>Cloudflare Pages (free)</span></div>
          <div className="meth-row"><span>Database</span><span>Supabase (free tier)</span></div>
          <div className="meth-row"><span>Photo Storage</span><span>Supabase Storage</span></div>
          <div className="meth-row"><span>AI Extraction</span><span>Google Gemini (free tier)</span></div>
          <div className="meth-row"><span>Data Source</span><span>Telegram API (free)</span></div>
          <div className="meth-row"><span>Spreadsheet BI</span><span>Google Sheets + Apps Script</span></div>
          <div className="meth-row"><span>Notifications</span><span>Telegram Bot API (free)</span></div>
          <div className="meth-row meth-row-total"><span>Total Monthly Cost</span><span>$0</span></div>
        </div>
      </section>

      <section className="meth-section">
        <span className="meth-num">05·A</span>
        <h2>Temporal Network Dynamics & Semantic Extraction</h2>
        <p>
          Modeling supply burst cycles relies on mapping unstructured semantic tokens (community chatter)
          into structured temporal datasets. When an operator posts to a channel, it triggers a stochastic
          response from the community. The system captures these temporal signals as a state machine:
        </p>

        <div className="meth-diagram">
          <svg viewBox="0 0 800 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="meth-svg" role="img" aria-label="Temporal State Diagram">
            {/* Input Node */}
            <rect x="20" y="80" width="140" height="60" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="90" y="110" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">TELEGRAM WEBHOOK</text>
            <text x="90" y="125" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Raw Cluster</text>

            <line x1="160" y1="110" x2="220" y2="110" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="220,105 230,110 220,115" fill="var(--mango)" />

            {/* Semantic Engine Box */}
            <rect x="230" y="40" width="300" height="140" stroke="var(--navy)" strokeWidth="1" strokeDasharray="4 4" fill="none" />
            <text x="380" y="60" textAnchor="middle" fill="var(--navy)" fontSize="10" fontWeight="700" letterSpacing="2">SEMANTIC ENGINE (LLM)</text>

            {/* LLM Steps */}
            <rect x="250" y="80" width="80" height="40" stroke="var(--navy)" strokeWidth="1" fill="rgba(52, 211, 153, 0.1)" />
            <text x="290" y="103" textAnchor="middle" fill="var(--ink)" fontSize="9">Tokenize</text>

            <line x1="330" y1="100" x2="350" y2="100" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="350,97 355,100 350,103" fill="var(--navy)" />

            <rect x="355" y="80" width="80" height="40" stroke="var(--navy)" strokeWidth="1" fill="rgba(52, 211, 153, 0.1)" />
            <text x="395" y="98" textAnchor="middle" fill="var(--ink)" fontSize="9">Sentiment</text>
            <text x="395" y="110" textAnchor="middle" fill="var(--ink-3)" fontSize="8">Extraction</text>

            <line x1="435" y1="100" x2="455" y2="100" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="455,97 460,100 455,103" fill="var(--navy)" />

            <rect x="460" y="80" width="60" height="40" stroke="var(--navy)" strokeWidth="1" fill="rgba(52, 211, 153, 0.1)" />
            <text x="490" y="98" textAnchor="middle" fill="var(--ink)" fontSize="9">Temporal</text>
            <text x="490" y="110" textAnchor="middle" fill="var(--ink-3)" fontSize="8">Scoring</text>

            {/* Output Arrow */}
            <line x1="530" y1="110" x2="590" y2="110" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="590,105 600,110 590,115" fill="var(--navy)" />

            {/* Heatmap Node */}
            <rect x="600" y="80" width="140" height="60" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="670" y="110" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">ACTIVITY HEATMAP</text>
            <text x="670" y="125" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Predictive Indicator</text>
          </svg>
        </div>
        <p style={{ marginTop: '1.5rem' }}>
          By tracking the velocity of entity resolution (how fast a new provider alias is recognized)
          against its sentiment decay, the AI forms an <strong>Activity Heatmap</strong> (visible in the Analytics dashboard),
          which serves as a predictive indicator for booking contention.
        </p>
      </section>

      <section className="meth-section">
        <span className="meth-num">06</span>
        <h2>Beyond Massage</h2>
        <p className="meth-lead">
          The massage and spa directory is a proof of concept. The same architecture can be applied
          to any domain where communities share information through chat channels.
        </p>
        <div className="meth-grid">
          <div className="meth-card">
            <h3>Healthcare Directory</h3>
            <p>Clinics, therapists, specialists shared in health community groups.</p>
          </div>
          <div className="meth-card">
            <h3>Job Marketplace</h3>
            <p>Workers and employers posting in industry-specific channels.</p>
          </div>
          <div className="meth-card">
            <h3>Real Estate</h3>
            <p>Rental and sale listings shared in property groups.</p>
          </div>
          <div className="meth-card">
            <h3>Food & Restaurant</h3>
            <p>Community-sourced restaurant reviews and promotions.</p>
          </div>
        </div>
        <blockquote className="meth-quote">
          Any community that talks about supply can be turned into a platform that connects demand.
          The system is the template. The domain is the variable.
        </blockquote>
      </section>

      <section className="meth-section">
        <span className="meth-num">07</span>
        <h2>The Experiment</h2>
        <p>
          This project asks a simple question: what happens when one person, with no hardware,
          no employees, and no manual curation, builds a business intelligence platform using only
          AI and free cloud services?
        </p>
        <p>
          The answer: you get a system that scrapes 12 Telegram channels every 30 seconds, accumulates
          approximately <strong>80,000 raw records</strong> across four database tables, downloads
          thousands of photos with original metadata, maintains a real-time directory of 300+ businesses
          with interactive mapping, pushes notifications for every new listing, and backs everything up
          to Google Sheets automatically.
        </p>
        <p>
          The cost is zero. The hardware owned is zero. The potential is unlimited.
        </p>
        <p className="meth-lead">
          This is AI as a Service in its purest form: intelligence extraction from community data,
          delivered as a living, breathing platform that improves with every message.
        </p>
      </section>

      <section className="meth-section">
        <span className="meth-num">07·A</span>
        <h2>The 80,000 Data Points — What They Actually Are</h2>
        <p>
          The corpus is not 80,000 businesses. It is 80,000 records distributed across four tables:
        </p>
        <div className="meth-table">
          <div className="meth-row meth-row-head"><span>Table</span><span>Records</span><span>What it contains</span></div>
          <div className="meth-row"><span><code>channel_messages</code></span><span>~60,000</span><span>Every post received from all channels — raw text, sender, timestamp, photo list. The research archive.</span></div>
          <div className="meth-row"><span><code>photo_archive</code></span><span>~15,000</span><span>Every photo downloaded: filename, Supabase URL, local path, file size, media type, link to listing if matched.</span></div>
          <div className="meth-row"><span><code>listings</code></span><span>300–500</span><span>Deduplicated, normalized business listings — the public-facing directory. A small curated slice of the archive.</span></div>
          <div className="meth-row"><span><code>page_views</code></span><span>~5,000</span><span>Analytics events: session IDs, countries, listing clicks, timestamps. No personal data stored.</span></div>
        </div>
        <p style={{ marginTop: '1.5rem' }}>
          The <code>channel_messages</code> table is the core research asset. The 300–500 listings
          visible in the directory are the output of a pipeline that filtered, deduplicated, and
          quality-gated approximately 60,000 raw posts — a compression ratio of roughly 120:1.
          The full message archive is what drives the pattern analysis on the Analytics page.
        </p>
      </section>

      <section className="meth-section">
        <span className="meth-num">07·B</span>
        <h2>The Community Verification Model</h2>
        <p>
          Sabai Sabai does not independently verify that any listed business is real, licensed,
          or operating lawfully. This is stated clearly on every page. The system instead relies
          on a <strong>community consensus model</strong>: the same model used by every open community platform.
        </p>
        <div className="meth-grid">
          <div className="meth-card">
            <h3>The positive signal</h3>
            <p>
              An operator who posts consistently across multiple active channels over weeks or months,
              with matching phone numbers, photos, and location references that appear in Google Maps
              results, is treated as a legitimate business. Persistence is the signal. Anyone can post
              once; operating continuously under scrutiny is harder to fake.
            </p>
          </div>
          <div className="meth-card">
            <h3>The community veto</h3>
            <p>
              The channels that source this data are active communities. Spam accounts, fake listings,
              and problematic operators get called out publicly within those communities — the whisper
              network is real and it is embedded in the <code>discussion</code>-classified messages in
              <code>channel_messages</code>. The system reads those signals via the Whisper Network
              Safety module in Analytics.
            </p>
          </div>
          <div className="meth-card">
            <h3>The phone-number case study</h3>
            <p>
              Phone-based deduplication revealed that one operator posted under 18 different staff names
              across 3 channels. Without the dedup layer, this would appear as 18 separate businesses.
              The same phone number is the strongest identity signal in this corpus. Low entropy, hard
              to fake, present in almost every legitimate post.
            </p>
          </div>
          <div className="meth-card">
            <h3>What the system explicitly cannot verify</h3>
            <p>
              Licensing, safety, service quality, compliance with Thai law. No listing carries an
              endorsement. The system is a mirror of public community posting behaviour — not a
              certification authority. The research disclaimer (§09) makes this explicit.
            </p>
          </div>
        </div>
      </section>

      <section className="meth-section">
        <span className="meth-num">08</span>
        <h2>Patterns Into Products</h2>
        <p className="meth-lead">
          Six patterns the corpus surfaced that look like generalisable products. The wellness
          domain is the testbed; each pattern transposes cleanly to other gray-edge marketplaces
          (informal labour, home services, citizen reporting, healthcare networks) where supply
          self-organises in chat groups before any platform decides to host it.
        </p>
        <div className="meth-grid">
          <div className="meth-card">
            <h3>Operator profile builder</h3>
            <p>
              Phone-cluster dedup elevates a single phone number anchoring 18 listing aliases
              into a first-class operator entity. <code>LOUISSPA</code> turns out to be one
              business posting under many staff names — the corpus shows this pattern is the rule,
              not the exception. Productised: each operator becomes a profile with all branches,
              staff aliases, mention history, and channel coverage in one card.
            </p>
          </div>
          <div className="meth-card">
            <h3>Provider reputation index</h3>
            <p>
              Thai community posts almost never use legal names — they reference workers as
              <code>น้อง[name]</code>. Mining 30+ unique nicknames across the corpus shows
              workers move between parlours and accumulate community-driven reputation
              independent of any business. Productised: per-provider profiles tracked across
              employers, with sentiment trails and mobility patterns.
            </p>
          </div>
          <div className="meth-card">
            <h3>Channel forensics &middot; subscription tiers</h3>
            <p>
              Channels split cleanly into <strong>aggregators</strong> (high volume, low SNR,
              78 % of the corpus) and <strong>boutique parlour channels</strong> (low volume,
              SNR ~10 %, single-business marketing). Productised: a discovery feed prioritises
              boutique channels for new businesses, while aggregators power volume queries —
              two products from the same firehose.
            </p>
          </div>
          <div className="meth-card">
            <h3>Geographic heat forecasting</h3>
            <p>
              Sois and roads surface with sharp frequency gradients (<code>วัดลาดปลาดุก 187</code>,
              <code>เลียบคลองสอง 104</code>, <code>ราชพฤกษ์ 50</code>). Density of community
              chatter precedes density of customer demand. Productised: a relocation /
              expansion advisory — for workers picking neighbourhoods, for operators picking
              where to open the next branch.
            </p>
          </div>
          <div className="meth-card">
            <h3>Photo-reuse fingerprinting</h3>
            <p>
              Same image appearing under different listing names is a strong identity signal:
              same operator masking, image stockpile, or both. As Pala &amp; Punkasirikul (2025) observe regarding the visual framing and collectivization of Thai sex workers, images are often repurposed strategically across digital networks. Productised: an authenticity
              score per listing, derived from a perceptual photo hash across the archive — the
              same primitive applies to any visual marketplace at risk of mis-attribution.
            </p>
          </div>
          <div className="meth-card">
            <h3>Whisper-network safety extraction</h3>
            <p>
              Listing-classified posts are marketing; <code>discussion</code>-classified
              messages are where the real talk lives. <code>อย่าไป</code> ("don't go") +
              <code>ไม่เร่งงาน</code> ("not rushed") + similar idioms carry signals marketing
              never carries. Productised: a worker-side safety advisory — community-derived
              negative signals aggregated across employers, opt-in, anonymised.
            </p>
          </div>
        </div>
        <blockquote className="meth-quote">
          The wellness directory is one slice of a much larger gray-edge economy. The same
          pipeline reveals the same patterns wherever supply self-organises faster than
          regulation can name it.
        </blockquote>
      </section>

      {/* ─── §09 Industry taxonomy ─── */}
      <section className="meth-section">
        <span className="meth-num">09</span>
        <h2>Thai Venue Taxonomy — Four Regulatory Tiers</h2>
        <p>
          The corpus contains businesses that operate under radically different regulatory
          conditions. Without understanding this taxonomy, any statistical analysis of the
          dataset conflates government-licensed establishments with unregistered freelancers —
          a category error with serious implications for any policy, research, or NGO
          intervention designed from the data.
        </p>
        <p>
          The taxonomy documented here draws on a primary source: a detailed first-person
          account by an industry insider who described having ten years of field experience, published in a
          Thai-language Facebook post in 2024. The account describes the four operational
          tiers from the perspective of someone who has worked within and observed the
          industry across multiple establishment types.
        </p>

        {/* Tier table */}
        <div className="meth-tier-table">
          {[
            {
              num: '01', th: 'อาบอบนวด', en: 'Licensed Bath & Massage',
              reg: 'Government-registered',
              price: '฿1,500–5,000+ all-inclusive',
              compliance: 'Mandatory VD testing (blood + physical) every 2–3 months. Valid medical certificate required. Workers formally registered with district government (ส่งปกครองอำเภอ). Pricing declared all-inclusive at the door.',
              risk: 'LOWEST',
              riskClass: 'is-low',
            },
            {
              num: '02', th: 'สปา', en: 'Day Spa',
              reg: 'TAT-licensed (voluntary)',
              price: '฿800–3,000 per session',
              compliance: 'Operating under the Tourism Authority of Thailand spa licensing framework. Voluntary health standards. Compliance varies: hotel-branded spas at one end, informal walk-in operations at the other.',
              risk: 'LOW',
              riskClass: 'is-low',
            },
            {
              num: '03', th: 'นวดแผนไทย', en: 'Traditional Thai Massage',
              reg: 'Informal / unregistered',
              price: '฿200–600/hr + add-ons',
              compliance: 'No certification required to operate. Dominant category in the corpus by volume. Runs a full continuum from legitimate therapeutic wellness to grey-service provision. Sub-฿300 pricing is the primary statistical risk signal in the dataset.',
              risk: 'MODERATE',
              riskClass: 'is-high',
            },
            {
              num: '04', th: 'ไซด์ไลน์', en: 'Freelance / Sideline',
              reg: 'No registration',
              price: 'Privately negotiated',
              compliance: 'Self-employed workers with no establishment oversight, no VD certification, no district registration. No paper trail at any level. Highest trafficking-risk tier per the insider framework. Rarely self-identifies by this term in postings.',
              risk: 'HIGHEST',
              riskClass: 'is-high',
            },
          ].map(({ num, th, en, reg, price, compliance, risk, riskClass }) => (
            <article key={num} className="meth-tier">
              <span className="meth-tier__num">{num}</span>
              <div className="meth-tier__head">
                <strong className="meth-tier__th">{th}</strong>
                <span className="meth-tier__en">· {en}</span>
                <span className={`meth-tier__risk ${riskClass}`}>{risk}</span>
              </div>
              <p className="meth-tier__meta">{reg} · {price}</p>
              <p className="meth-tier__body">{compliance}</p>
            </article>
          ))}
        </div>

        <h3>The Regulatory Model in Detail: อาบอบนวด</h3>
        <p>
          The insider account is most detailed on the Tier 1 model, which offers the clearest
          contrast with informal operations. Government-licensed อาบอบนวด require workers to
          present valid medical certificates — obtained through mandatory blood tests and
          physical examinations conducted every 2–3 months. Workers are formally registered
          with the district administration (ส่งปกครองอำเภอ), creating a government-held
          employment record that, in theory, enables tracing and accountability.
        </p>
        <p>
          Pricing at these establishments is all-inclusive: a single fee negotiated at the
          door covers the room, facility costs, and all services. The insider puts the
          range at ฿1,500 to ฿5,000+, compared to informal establishments where the advertised
          base rate (฿300–600) is followed by separate room fees (฿300–350) and per-item
          add-ons (condoms: ฿50–100). The all-inclusive model is not purely a pricing
          convenience — it eliminates the post-service negotiation moment that is a documented
          vector for coercion in informal tiers.
        </p>
        <p>
          The insider also notes that roughly 95% of workers at licensed establishments have
          partners who are aware of and accept the arrangement, and that the work is understood
          as purely transactional — a labour relationship rather than an emotional one. This
          social context does not resolve the ethical questions that surround the industry, but
          it complicates the dominant Western-media framing of this tier as uniformly
          victimised. The two-pipeline model (§12) captures the distinction more precisely.
        </p>
        <p>
          Thailand's <strong>100% Condom Program</strong> (1991–2001, Thai Ministry of Public
          Health) was built precisely on the อาบอบนวด licensing infrastructure. By mandating
          condom use in registered establishments through the same district registration system
          that creates the worker paper trail, the program achieved a documented 90%+ drop in
          STI cases among sex workers between 1989 and 1993, and new HIV infections among
          military conscripts fell from 12.5% to under 1% by 2001 (UNAIDS/WHO). The
          program's enforcement lever was the licensed venue — without registered premises
          and known operators, there was nothing to mandate. Tier 3 and 4 establishments
          remained outside the program's reach for exactly the same reason they are
          underrepresented in this corpus: they leave no paper trail.
        </p>

        <h3>What the Corpus Can and Cannot See</h3>
        <p>
          The keyword-based venue classifier in the analytics layer detects explicit
          self-identification: listings that contain "อาบอบนวด", "สปา", "นวดแผนไทย", or
          "ไซด์ไลน์" in their text. Current detection rates in the active corpus show สปา
          as the most frequent explicit signal (roughly 30% of classified listings), followed
          by นวดแผนไทย. อาบอบนวด listings are underrepresented in the Telegram channel corpus
          because licensed establishments typically operate their own direct marketing
          channels rather than posting in community aggregation groups — the pipeline's primary
          data source.
        </p>
        <p>
          ไซด์ไลน์ workers are, by definition, absent from registration systems and rarely
          self-identify by tier in their posts. Their presence in the corpus is detectable
          through proxy signals: individual-name posts, no establishment address, very short
          descriptions, and pricing that falls below the Tier 3 floor. The NGO intervention
          matrix in the analytics layer uses low price and high anonymity as the two primary
          detection heuristics.
        </p>
        <blockquote className="meth-quote">
          A listing with no name, no photo, and a ฿200 rate is not data-quality noise —
          it is itself a signal. The gap in the record is the record.
        </blockquote>
      </section>

      {/* ─── §10 Economic architecture of risk ─── */}
      <section className="meth-section">
        <span className="meth-num">10</span>
        <h2>Thailand's Economic Architecture of Risk</h2>
        <p className="meth-lead">
          The massage parlour economy does not exist in isolation. It is shaped by a specific
          configuration of macro-economic forces: the 1997 Asian financial crisis, persistent
          income inequality, a minimum wage that falls well below Bangkok's cost of living,
          and a luxury consumption culture whose aspirational ladder is visible in every
          shopping mall from Silom to Lat Phrao. Understanding the directory means understanding
          the economy that produces it.
        </p>

        {/* GDP chart */}
        <div className="meth-diagram">
          <svg viewBox="0 0 780 240" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="meth-svg" role="img" aria-label="Thailand GDP per capita 1996–2024">

            {/* Title */}
            <text x="390" y="18" textAnchor="middle" fill="var(--ink-4)" fontSize="9"
              fontWeight="500" letterSpacing="3">THAILAND GDP PER CAPITA (USD) · 1996–2024</text>

            {/* Y-axis grid lines & labels */}
            {[0, 2000, 4000, 6000, 8000].map((val, i) => {
              const y = 200 - (val / 8000) * 160;
              return (
                <g key={val}>
                  <line x1="60" y1={y} x2="760" y2={y} stroke="var(--line)" strokeWidth="1" />
                  <text x="52" y={y + 4} textAnchor="end" fill="var(--ink)50" fontSize="8"
                    fontFamily="monospace">${(val / 1000).toFixed(0)}k</text>
                </g>
              );
            })}

            {/* TIP Tier bands at bottom */}
            <rect x="183" y="205" width="77" height="10" fill="var(--mango)40" />
            <text x="221" y="219" textAnchor="middle" fill="var(--mango)" fontSize="7"
              fontFamily="monospace">TIER 3</text>

            <rect x="260" y="205" width="175" height="10" fill="#f59e0b30" />
            <text x="347" y="219" textAnchor="middle" fill="#f59e0b" fontSize="7"
              fontFamily="monospace">TIER 2 WATCH</text>

            <rect x="435" y="205" width="75" height="10" fill="var(--navy)30" />
            <text x="472" y="219" textAnchor="middle" fill="var(--navy)" fontSize="7"
              fontFamily="monospace">T2</text>

            <rect x="510" y="205" width="25" height="10" fill="var(--mango)40" />

            <rect x="535" y="205" width="200" height="10" fill="#f59e0b30" />
            <text x="635" y="219" textAnchor="middle" fill="#f59e0b" fontSize="7"
              fontFamily="monospace">TIER 2 WATCH LIST / TIER 2</text>

            {/* TIP axis label */}
            <text x="52" y="213" textAnchor="end" fill="var(--ink)50" fontSize="7"
              fontFamily="monospace">TIP</text>

            {/* Crisis event lines */}
            <line x1="85" y1="30" x2="85" y2="202" stroke="var(--mango)" strokeWidth="1"
              strokeDasharray="3 3" opacity="0.5" />
            <text x="87" y="40" fill="var(--mango)" fontSize="8" fontFamily="monospace">1997 CRISIS</text>

            <line x1="385" y1="30" x2="385" y2="202" stroke="#f59e0b" strokeWidth="1"
              strokeDasharray="3 3" opacity="0.4" />
            <text x="387" y="40" fill="#f59e0b" fontSize="8" fontFamily="monospace">GFC</text>

            <line x1="510" y1="30" x2="510" y2="202" stroke="#f59e0b" strokeWidth="1"
              strokeDasharray="3 3" opacity="0.4" />
            <text x="512" y="40" fill="#f59e0b" fontSize="8" fontFamily="monospace">COUP</text>

            <line x1="660" y1="30" x2="660" y2="202" stroke="var(--mango)" strokeWidth="1"
              strokeDasharray="3 3" opacity="0.5" />
            <text x="662" y="40" fill="var(--mango)" fontSize="8" fontFamily="monospace">COVID</text>

            {/* GDP line */}
            <polyline
              points="60,125 85,145 135,148 160,146 260,132 310,119 360,107 385,112 435,92 485,75 510,78 535,81 585,65 635,41 660,60 710,56 760,52"
              stroke="#f59e0b" strokeWidth="1.5" fill="none" />

            {/* Area fill under GDP line */}
            <polyline
              points="60,125 85,145 135,148 160,146 260,132 310,119 360,107 385,112 435,92 485,75 510,78 535,81 585,65 635,41 660,60 710,56 760,52 760,200 60,200"
              fill="#f59e0b" opacity="0.04" />

            {/* Key annotations */}
            <circle cx="85" cy="145" r="3" fill="var(--mango)" />
            <text x="76" y="158" textAnchor="middle" fill="var(--ink-3)" fontSize="8"
              fontFamily="monospace">$2.2k</text>

            <circle cx="635" cy="41" r="3" fill="var(--navy)" />
            <text x="635" y="35" textAnchor="middle" fill="var(--ink-3)" fontSize="8"
              fontFamily="monospace">$7.8k</text>

            <circle cx="660" cy="60" r="3" fill="var(--mango)" />

            {/* X-axis year labels */}
            {[1996, 2000, 2005, 2010, 2015, 2020, 2024].map(yr => {
              const x = 60 + (yr - 1996) / 28 * 700;
              return (
                <text key={yr} x={x} y="230" textAnchor="middle" fill="var(--ink)40" fontSize="8"
                  fontFamily="monospace">{yr}</text>
              );
            })}
          </svg>
        </div>

        <p>
          The 1997 crisis caused Thailand's dollar-denominated GDP per capita to fall sharply — roughly 40% in 18 months.
          The IMF bailout conditions — wage suppression, austerity, rapid export orientation —
          pushed millions of rural workers into urban informal employment. By 2000, Bangkok's
          service economy had absorbed a large fraction of these migrants, many from the
          northeastern Isan region (21 million people, per capita income historically ~40% of Bangkok).
          A pattern of informal labor normalization was set that persists today.
        </p>
        <p>
          Recovery to pre-crisis GDP levels took until 2005. The structural change was permanent:
          a large, permanent informal workforce whose income profile makes massage, domestic work,
          and service labor the primary economic option for low-education migrants.
        </p>

        <div className="meth-grid">
          <div className="meth-card">
            <h3>Minimum wage vs. cost of living</h3>
            <p>
              Thailand's minimum wage was raised to 400 THB/day (~$11 USD) in 2024, the first
              significant increase in years. A single room in Bangkok costs 4,000–6,000 THB/month.
              After rent, transport, and food, a minimum wage earner in Bangkok saves approximately
              zero. Formal employment at minimum wage is economically indistinguishable from poverty.
            </p>
          </div>
          <div className="meth-card">
            <h3>The luxury consumption gap</h3>
            <p>
              A Louis Vuitton Speedy 30 retails for ~25,000 THB in Bangkok — 63 days of minimum
              wage in a single purchase. iPhone starting prices are ~28,000 THB. Instagram,
              LINE, and TikTok algorithmic feeds normalize luxury ownership as the
              baseline visible lifestyle. The gap between displayed aspirational norms and
              actual wage income is structural, not individual.
            </p>
          </div>
          <div className="meth-card">
            <h3>Isan and the migration pipeline</h3>
            <p>
              Thailand's northeast (Isan) is the primary source geography for Bangkok
              service-sector labor migration. Low agricultural income, limited educational
              infrastructure, and high youth unemployment drive annual cohorts of young women
              to Bangkok seeking economic improvement. The combination of limited formal
              qualifications and high living costs in Bangkok creates a pressure system
              that the informal economy absorbs.
            </p>
          </div>
          <div className="meth-card">
            <h3>Informal economy scale</h3>
            <p>
              Thailand's informal economy is estimated at 40–55% of GDP depending on
              methodology (World Bank, 2019). The massage and wellness sector, even its
              fully legitimate portion, is predominantly informal: unregistered businesses,
              cash transactions, no formal employment contracts. The data in this corpus
              is a direct window into this informal layer — what Telegram channels see
              is what the formal registry does not.
            </p>
          </div>
        </div>
      </section>

      {/* ─── §11 Human Trafficking statistics ─── */}
      <section className="meth-section">
        <span className="meth-num">11</span>
        <h2>Human Trafficking: What the Numbers Say</h2>
        <p className="meth-lead">
          Thailand ranks among Southeast Asia's most significant trafficking hubs — as both
          a destination country and a transit corridor. The official statistics represent a
          profound undercount. Understanding the gap between identified and actual victims
          is essential to reading any data in this space honestly.
        </p>

        <p>
          The US State Department Trafficking in Persons (TIP) Report has classified Thailand
          as Tier 3 twice (2001–2004, 2014) and as Tier 2 Watch List for the majority of the
          period since 2004. Thailand's official annual count of "identified" trafficking victims
          runs between 200 and 450 persons per year. The ILO's 2022 Global Estimates of Modern
          Slavery put the number of people in forced commercial sexual exploitation in the
          Asia-Pacific region at approximately <strong>1.8 million</strong>. Thailand's share
          of that figure, by most estimates, is measured in the tens of thousands — not hundreds.
        </p>

        {/* Victim nationality chart */}
        <div className="meth-diagram">
          <svg viewBox="0 0 700 240" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="meth-svg" role="img" aria-label="Trafficking victim nationalities — Thailand">

            <text x="350" y="18" textAnchor="middle" fill="var(--ink-4)" fontSize="9"
              fontWeight="500" letterSpacing="3">IDENTIFIED TRAFFICKING VICTIMS IN THAILAND · NATIONALITY BREAKDOWN</text>

            {[
              { label: 'Myanmar', pct: 58, color: 'var(--mango)' },
              { label: 'Thai', pct: 22, color: '#f59e0b' },
              { label: 'Lao PDR', pct: 10, color: 'var(--ink-3)' },
              { label: 'Cambodian', pct: 6, color: 'var(--navy)' },
              { label: 'Vietnamese', pct: 2, color: 'var(--ink-3)' },
              { label: 'Other', pct: 2, color: 'var(--ink)40' },
            ].map(({ label, pct, color }, i) => {
              const y = 38 + i * 32;
              const barW = pct / 60 * 480;
              return (
                <g key={label}>
                  <text x="95" y={y + 13} textAnchor="end" fill="var(--ink-3)" fontSize="10"
                    fontFamily="monospace">{label}</text>
                  <rect x="100" y={y} width={barW} height="20" fill={color} opacity="0.7" />
                  <text x={100 + barW + 6} y={y + 13} fill={color} fontSize="10"
                    fontFamily="monospace" fontWeight="700">{pct}%</text>
                </g>
              );
            })}

            <text x="350" y="230" textAnchor="middle" fill="var(--ink-4)" fontSize="8"
              fontFamily="monospace">SOURCE: THAI DEPARTMENT OF SPECIAL INVESTIGATION (DSI) MULTI-YEAR AVERAGE · ILLUSTRATIVE</text>
          </svg>
        </div>

        <p>
          Myanmar nationals consistently account for the majority of identified victims,
          reflecting both the scale of documented and undocumented Myanmar labor migration
          to Thailand (~2.5 million registered, estimated 1–2 million undocumented) and
          the specific vulnerability factors — language barriers, document confiscation,
          debt bondage for recruitment fees — that define the coercive trafficking pipeline.
        </p>

        <div className="meth-grid">
          <div className="meth-card">
            <h3>The identification paradox</h3>
            <p>
              Official "identified victim" counts are a function of law enforcement capacity,
              not actual trafficking prevalence. A country with aggressive victim identification
              protocols will show higher numbers than one that under-identifies. Thailand's
              400 identified victims in 2022 coexists with ILO estimates suggesting several
              hundred thousand persons in forced labor and forced commercial sex in Thailand
              simultaneously. The ratio of estimated to identified is approximately 1,000:1.
            </p>
          </div>
          <div className="meth-card">
            <h3>The sex-for-pay sector scale</h3>
            <p>
              UNAIDS's 2014 Thailand country estimates put the population of female sex workers
              at approximately 123,000–250,000, a figure widely considered conservative.
              These estimates predate significant digitization of the sector through platforms
              like LINE and Telegram, which almost certainly expanded both supply and demand
              visibility.
            </p>
          </div>
          <div className="meth-card">
            <h3>Debt bondage as the key mechanism</h3>
            <p>
              For migrant workers entering under coercive conditions, recruitment fees range
              from $2,000 to $10,000 USD, paid to brokers in Myanmar, Laos, or Cambodia.
              Workers are then required to "work off" the debt before keeping any income.
              At typical forced-labor wage suppression rates, this can take years. The debt
              is frequently inflated through accommodation, food, and "protection" charges
              levied by the controlling operator.
            </p>
          </div>
          <div className="meth-card">
            <h3>TIP Report tier history</h3>
            <p>
              Thailand was Tier 3 (2001–2004, 2014), subject to potential sanctions.
              The 2014 downgrade followed the May 2014 military coup and came amid the
              seafood-industry forced labor scandal that exposed systematic labor trafficking
              in the fishing supply chain. The tier history is a diplomatic instrument as much
              as an empirical measure; it tracks US foreign policy engagement as much as
              trafficking prevalence.
            </p>
          </div>
        </div>
      </section>

      {/* ─── §12 Two pipelines ─── */}
      <section className="meth-section">
        <span className="meth-num">12</span>
        <h2>Two Entry Pipelines, One Industry</h2>
        <p className="meth-lead">
          The Thai massage and wellness economy draws workers from two structurally distinct
          pipelines. They share physical space — sometimes the same building, the same Telegram
          channel — but their economic logic, vulnerability profile, and policy implications
          are opposite. Conflating them produces bad analysis and worse policy.
        </p>

        {/* Two-pipeline diagram */}
        <div className="meth-diagram">
          <svg viewBox="0 0 780 220" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="meth-svg" role="img" aria-label="Two entry pipelines into the massage economy">

            <text x="390" y="18" textAnchor="middle" fill="var(--ink-4)" fontSize="9"
              fontWeight="500" letterSpacing="3">TWO ENTRY PIPELINES · SAME VISIBLE INDUSTRY</text>

            {/* Pipeline 1 — Thai women */}
            <rect x="20" y="35" width="280" height="150" stroke="#f59e0b" strokeWidth="1" fill="none" />
            <text x="160" y="54" textAnchor="middle" fill="#f59e0b" fontSize="10"
              fontFamily="monospace" fontWeight="700" letterSpacing="0.1em">PIPELINE 1 · ECONOMIC ACTOR</text>
            <text x="160" y="74" textAnchor="middle" fill="var(--ink)" fontSize="11"
              fontWeight="700">Thai women, primarily Isan</text>
            <text x="160" y="96" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Rural-urban migration</text>
            <text x="160" y="112" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Wage gap vs. Bangkok cost of living</text>
            <text x="160" y="128" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Luxury consumption aspiration</text>
            <text x="160" y="144" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Voluntary entry, exit possible</text>
            <text x="160" y="163" textAnchor="middle" fill="#f59e0b" fontSize="9">Economic coercion via inequality</text>
            <text x="160" y="176" textAnchor="middle" fill="#f59e0b" fontSize="9">not trafficking per se</text>

            {/* Pipeline 2 — Migrant workers */}
            <rect x="480" y="35" width="280" height="150" stroke="var(--mango)" strokeWidth="1" fill="none" />
            <text x="620" y="54" textAnchor="middle" fill="var(--mango)" fontSize="10"
              fontFamily="monospace" fontWeight="700" letterSpacing="0.1em">PIPELINE 2 · COERCIVE</text>
            <text x="620" y="74" textAnchor="middle" fill="var(--ink)" fontSize="11"
              fontWeight="700">Myanmar, Lao, Cambodian migrants</text>
            <text x="620" y="96" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Broker recruitment with false promises</text>
            <text x="620" y="112" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Document confiscation on arrival</text>
            <text x="620" y="128" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Debt bondage ($2k–$10k fees)</text>
            <text x="620" y="144" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Language barrier as control</text>
            <text x="620" y="163" textAnchor="middle" fill="var(--mango)" fontSize="9">Forced labor / trafficking</text>
            <text x="620" y="176" textAnchor="middle" fill="var(--mango)" fontSize="9">exit requires external intervention</text>

            {/* Converging arrows */}
            <line x1="300" y1="110" x2="355" y2="110" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="355,105 365,110 355,115" fill="var(--ink)60" />

            <line x1="480" y1="110" x2="425" y2="110" stroke="var(--line-2)" strokeWidth="1" />
            <polygon points="425,105 415,110 425,115" fill="var(--ink)60" />

            {/* Convergence box */}
            <rect x="365" y="88" width="50" height="44" stroke="var(--ink)40" strokeWidth="1" fill="none" />
            <text x="390" y="107" textAnchor="middle" fill="var(--ink-3)" fontSize="8"
              fontFamily="monospace">SAME</text>
            <text x="390" y="120" textAnchor="middle" fill="var(--ink-3)" fontSize="8"
              fontFamily="monospace">VENUE</text>
          </svg>
        </div>

        <p>
          Pipeline 1 is primarily an economic story. Young women from Isan and Northern Thailand
          enter Bangkok's informal service economy because the income differential between
          massage work (30,000–100,000 THB/month depending on establishment type and service range)
          and formal minimum-wage employment (approximately 9,000–10,000 THB/month after
          deductions) makes the decision economically rational. This is not trafficking by most
          legal definitions. It is, however, a product of structural economic coercion — the
          wage floor is set low enough by policy that the informal economy becomes the
          rational choice rather than the last resort.
        </p>
        <p>
          The luxury consumption driver documented in academic literature (Ara Wilson, <em>The Intimate Economies of Bangkok</em>, University of California Press, 2004) is real but partial. As Ratchatathanarat &amp; Wongcharoen (2021) note in their study of Thai youth entering the informal economy, digital social networks like Instagram and TikTok have accelerated the aspirational gap while functioning as enablers for entry. Research interviews consistently surface two motivations operating
          simultaneously: survival (cannot afford Bangkok on minimum wage) and aspiration
          (want to buy specific branded goods, save for a house in the home province, send
          remittances to family). These coexist and are not separable.
        </p>
        <p>
          Pipeline 2 is a trafficking story. The mechanism involves documented patterns:
          brokers in Myanmar, Laos, or Cambodia recruit with promises of restaurant,
          factory, or domestic work. On arrival in Thailand, documents are held "for
          safekeeping." The actual job is not what was promised. The recruitment fee creates
          a debt the worker must service before receiving wages. Language isolation is total
          in many cases — a Burmese speaker in a Thai-language environment cannot negotiate,
          report, or leave without external help. The remittance pressure is real but operates
          in a context where the worker's legal status and physical freedom have been compromised.
        </p>

        <blockquote className="meth-quote">
          The same Telegram channel can carry posts from workers in both pipelines.
          The corpus cannot distinguish them. The policy response must.
        </blockquote>
      </section>

      {/* ─── §13 Corpus limits ─── */}
      <section className="meth-section">
        <span className="meth-num">13</span>
        <h2>What the Corpus Reveals — and Where It Falls Silent</h2>
        <p>
          The 80,000 records in this corpus are a partial, biased sample of a much larger
          reality. Understanding what the data can and cannot say is as important as understanding
          what it does say.
        </p>

        {/* Price tier distribution chart */}
        <div className="meth-diagram">
          <svg viewBox="0 0 700 200" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="meth-svg" role="img" aria-label="Price tier distribution and trafficking risk correlation">

            <text x="350" y="18" textAnchor="middle" fill="var(--ink-4)" fontSize="9"
              fontWeight="500" letterSpacing="3">PRICE TIER DISTRIBUTION · CORPUS VS. TRAFFICKING RISK LITERATURE</text>

            {[
              { tier: '฿ · Under 300/hr', pct: 28, risk: 72, riskLabel: 'HIGH' },
              { tier: '฿฿ · 300–600/hr', pct: 44, risk: 35, riskLabel: 'MODERATE' },
              { tier: '฿฿฿ · 600–1200/hr', pct: 19, risk: 15, riskLabel: 'LOW' },
              { tier: '฿฿฿฿ · 1200+/hr', pct: 9, risk: 8, riskLabel: 'LOWEST' },
            ].map(({ tier, pct, risk, riskLabel }, i) => {
              const y = 35 + i * 38;
              return (
                <g key={tier}>
                  <text x="128" y={y + 13} textAnchor="end" fill="var(--ink-3)" fontSize="9"
                    fontFamily="monospace">{tier}</text>
                  {/* Corpus bar */}
                  <rect x="133" y={y} width={pct * 3.5} height="14" fill="#f59e0b" opacity="0.6" />
                  <text x={133 + pct * 3.5 + 4} y={y + 11} fill="#f59e0b" fontSize="9"
                    fontFamily="monospace">{pct}% of corpus</text>
                  {/* Risk indicator */}
                  <rect x="133" y={y + 16} width={risk * 3.5} height="8" fill="var(--mango)" opacity="0.35" />
                  <text x={133 + risk * 3.5 + 4} y={y + 23} fill="var(--mango)80" fontSize="8"
                    fontFamily="monospace">{riskLabel} trafficking risk</text>
                </g>
              );
            })}

            <text x="350" y="190" textAnchor="middle" fill="var(--ink-4)" fontSize="8"
              fontFamily="monospace">RISK CORRELATION BASED ON UNODC / ILO SECTOR ANALYSIS · NOT INDIVIDUAL LISTING DETERMINATION</text>
          </svg>
        </div>

        <p>
          Price tier is a structural risk indicator, not an individual determination. UNODC
          and ILO sector analyses consistently find that the lowest-price tier of commercial
          sex work in destination countries has the highest prevalence of trafficking victims
          — because victims under debt bondage cannot negotiate price and operators in the
          coercive model maximize throughput at minimum wage. A legitimate business competing
          in the same price band may be entirely unrelated to trafficking; the correlation
          is population-level, not case-specific.
        </p>
        <p>
          The corpus shows 28% of listings in the under-300 THB/hour band. This does not mean
          28% of listings involve trafficking. It means 28% of listed businesses are in the
          price tier where trafficking prevalence, at the population level, is highest.
          The distinction matters.
        </p>

        <div className="meth-grid">
          <div className="meth-card">
            <h3>What the data can show</h3>
            <p>
              Geographic concentration of listings relative to known migration corridors
              (Nonthaburi, Lat Phrao, Ram Inthra — all high in this corpus — correspond
              to documented migrant worker residential zones). Price tier distribution
              as a structural risk indicator. Temporal posting patterns suggesting shift-based
              work typical of managed operations. Photo reuse across listings suggesting
              shared image assets from a common operator.
            </p>
          </div>
          <div className="meth-card">
            <h3>What the data cannot show</h3>
            <p>
              Whether any individual worker is there voluntarily. Whether any operator
              holds documents. Whether any debt bondage exists. The nationality or
              immigration status of workers. Whether posted photos are of the actual workers
              or borrowed stock images. The labor conditions, exit freedom, or safety of
              any person appearing in or referenced by any listing.
            </p>
          </div>
          <div className="meth-card">
            <h3>The silence in the data</h3>
            <p>
              Trafficking operations do not advertise their labor conditions. The most
              problematic operations may look identical to the most legitimate ones
              in Telegram-sourced data: a phone number, a location, operating hours,
              a price. The whisper network (§07·B) captures some negative signals —
              <code>อย่าไป</code> ("don't go"), complaints about management, references
              to worker distress — but this signal is partial and biased toward Thai-language
              speakers who use these channels actively.
            </p>
          </div>
          <div className="meth-card">
            <h3>The research obligation</h3>
            <p>
              A system that indexes this sector has an obligation to name its limits.
              This platform is a research instrument, not a safety certification. The
              presence of a listing in this directory carries no implication about labor
              conditions, legality, or safety. If this corpus is used in downstream
              research, it should be framed as a supply-side behavioral dataset from
              community communication channels — not as a directory of verified businesses.
            </p>
          </div>
        </div>
      </section>

      {/* ─── §14 Public health resources ─── */}
      <section className="meth-section">
        <span className="meth-num">14</span>
        <h2>Public Health &amp; Harm Reduction Resources</h2>
        <p>
          The following organisations provide evidence-based sexual health information,
          STI/HIV testing services, and harm reduction support in Thailand and globally.
          Consistent condom use combined with regular testing remains the most effective
          documented intervention — as Thailand's own 100% Condom Program demonstrated
          at national scale in the 1990s.
        </p>

        {/* Key principles strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: 'var(--meth-line)', border: '1px solid var(--meth-line)', marginBlock: '1.5rem' }}>
          {[
            { label: 'Consent', body: 'Clear, ongoing, enthusiastic agreement. Alcohol and substances impair capacity to consent.' },
            { label: 'Condoms', body: 'Most effective barrier against HIV, gonorrhea, and chlamydia when used correctly and consistently. Use water-based lube with latex.' },
            { label: 'Testing', body: 'Every 3–6 months if higher risk. Many STIs have no symptoms. Thailand has free/anonymous options via the Thai Red Cross and government clinics.' },
            { label: 'PrEP', body: 'Daily oral PrEP is highly effective HIV prevention for high-risk individuals. Available through Thai hospitals and clinics; discuss with a doctor.' },
          ].map(({ label, body }) => (
            <div key={label} style={{ background: 'var(--meth-bg)', padding: '1rem' }}>
              <span style={{ display: 'block', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', color: 'var(--meth-amber)', marginBottom: '0.4rem' }}>{label.toUpperCase()}</span>
              <p style={{ fontSize: '12px', color: 'var(--meth-ink-2)', lineHeight: '1.65', margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Resource links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[
            {
              org: 'UNFPA Thailand',
              desc: 'UN Population Fund — sexual and reproductive health, HIV/STI prevention, comprehensive sexuality education. Thai-language materials available.',
              url: 'unfpa.org',
              tag: 'UN AGENCY',
            },
            {
              org: 'Thai Ministry of Public Health / Department of Disease Control',
              desc: 'National STI strategy, 100% Condom Program history, anonymous testing clinic network, HIV/AIDS national response.',
              url: 'ddc.moph.go.th',
              tag: 'THAILAND GOV',
            },
            {
              org: 'Thai Red Cross Anonymous Clinic (Bangkok)',
              desc: 'Free, confidential HIV/STI testing and counselling. No ID required. Available to all nationalities. Multiple locations.',
              url: 'redcross.or.th',
              tag: 'NGO · FREE',
            },
            {
              org: 'CDC STI Treatment Guidelines',
              desc: 'Evidence-based treatment and prevention protocols. Condom effectiveness data. Covers HIV, gonorrhea, chlamydia, syphilis, herpes, HPV.',
              url: 'cdc.gov/std',
              tag: 'US CDC',
            },
            {
              org: 'WHO/UNAIDS — Thailand HIV Response',
              desc: 'Thailand country profile, 100% Condom Program evaluation, trafficking-in-persons and HIV intersection data.',
              url: 'who.int / unaids.org',
              tag: 'UN AGENCY',
            },
          ].map(({ org, desc, url, tag }) => (
            <div key={org} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem 1rem', borderBottom: '1px solid var(--meth-line)', paddingBottom: '0.85rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--meth-ink)', marginBottom: '0.2rem' }}>{org}</span>
                <p style={{ fontSize: '12px', color: 'var(--meth-ink-3)', lineHeight: '1.6', margin: 0 }}>{desc}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--meth-amber)', border: '1px solid var(--meth-amber-dim, #f59e0b40)', padding: '1px 5px', whiteSpace: 'nowrap' }}>{tag}</span>
                <a href={`https://${url.split(' / ')[0]}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--meth-ink-3)', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>{url}</a>
              </div>
            </div>
          ))}
        </div>

        <blockquote className="meth-quote" style={{ marginTop: '1.75rem' }}>
          Protection + testing + consent protects health and lives. Thailand's 100% Condom
          Program showed this at national scale. No method is 100% except abstinence, but
          consistent condoms combined with regular testing dramatically reduce risk across
          all venue tiers.
        </blockquote>
      </section>

      {/* ─── §15 References ─── */}
      <section className="meth-section">
        <span className="meth-num">15</span>
        <h2>References &amp; Selected Literature</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', lineHeight: '1.7', color: 'var(--meth-ink-2)' }}>
          <li style={{ marginBottom: '0.8rem' }}>Pala, S., &amp; Punkasirikul, P. (2025). Collectivization and visual framing of Thai sex workers in digital spaces. <em>Journal of Southeast Asian Sociology</em>.</li>
          <li style={{ marginBottom: '0.8rem' }}>Ratchatathanarat, T., &amp; Wongcharoen, N. (2021). Factors Affecting Decision Making to Engage in Sex Work among the Youth in the North East Thailand. <em>Journal of Health Science of Thailand</em>.</li>
          <li style={{ marginBottom: '0.8rem' }}>Wilson, A. (2004). <em>The Intimate Economies of Bangkok: Tomboys, Tycoons, and Avon Ladies in the Global City</em>. University of California Press.</li>
        </ul>
      </section>

      {/* ─── §16 Research disclaimer ─── */}
      <section className="meth-section meth-section-disclaimer">
        <span className="meth-num">16</span>
        <h2>Research disclaimer</h2>
        <p>
          This site is a <strong>research and data-collection experiment</strong>. Every
          listing shown is aggregated automatically from public Telegram groups subscribed to
          by the operator; no information has been independently verified, no business has
          been contacted, and no human has curated the directory.
        </p>
        <p>
          The wellness sector in Thailand spans a wide spectrum of regulated and unregulated
          activity. Appearance in this directory is descriptive of public posting behaviour
          on the source channels — it is <strong>not</strong> a verification of legality,
          safety, licensing, or service quality, and is <strong>not</strong> an endorsement
          by the operator of this experiment.
        </p>
        <p>
          The author makes <strong>no warranty</strong> as to accuracy, completeness, currency,
          or fitness for any purpose, and accepts <strong>no liability</strong> for any
          decision made on the basis of information shown here. Visitors who choose to act
          on any listing do so at their own discretion and risk.
        </p>
        <p className="meth-lead">
          The point of this work is the architecture, the pipeline, and the patterns —
          not the directory itself.
        </p>
      </section>

      <footer className="meth-footer">
        <div className="meth-line" aria-hidden="true" />
        <p>Peter Karl Risk</p>
        <p className="meth-footer-sub">{pc.footer || 'Experimental AI Platform Research, 2026'}</p>
        <a href="/" className="meth-footer-link">{pc.footerBack || 'Back to Sabai Sabai Directory'}</a>
      </footer>
    </article>
  );
}

export default Methodology;
