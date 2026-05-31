import './Methodology.css';

function Methodology() {
  return (
    <article className="methodology">
      <header className="meth-header">
        <a href="/" className="meth-back">Back to Directory</a>
        <span className="meth-label">Research Paper</span>
      </header>

      <div className="meth-hero">
        <div className="meth-title-glow" aria-hidden="true" />
        <h1 className="meth-title">
          Community Intelligence<br />
          <span className="meth-title-accent">at Zero Marginal Cost</span>
        </h1>
        <div className="meth-line" aria-hidden="true" />
        <p className="meth-author">Peter Karl Risk</p>
        <p className="meth-date">Working Paper, March 2026</p>
      </div>

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
            <rect x="20" y="120" width="140" height="80" stroke="#ff3366" strokeWidth="1" fill="none" />
            <text x="90" y="155" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700">TELEGRAM</text>
            <text x="90" y="175" textAnchor="middle" fill="#e8e6e180" fontSize="9">12 channels</text>
            <text x="90" y="190" textAnchor="middle" fill="#e8e6e180" fontSize="9">2,500+ messages</text>

            {/* Arrow */}
            <line x1="160" y1="160" x2="220" y2="160" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="220,155 230,160 220,165" fill="#ff3366" />

            {/* Gemini AI */}
            <rect x="230" y="120" width="140" height="80" stroke="#34d399" strokeWidth="1" fill="none" />
            <text x="300" y="155" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700">GEMINI AI</text>
            <text x="300" y="175" textAnchor="middle" fill="#e8e6e180" fontSize="9">Extract, classify,</text>
            <text x="300" y="190" textAnchor="middle" fill="#e8e6e180" fontSize="9">enrich listings</text>

            {/* Arrow */}
            <line x1="370" y1="160" x2="430" y2="160" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="430,155 440,160 430,165" fill="#ff3366" />

            {/* Supabase */}
            <rect x="440" y="100" width="140" height="120" stroke="#ff3366" strokeWidth="1" fill="none" />
            <text x="510" y="135" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700">SUPABASE</text>
            <text x="510" y="155" textAnchor="middle" fill="#e8e6e180" fontSize="9">companions</text>
            <text x="510" y="170" textAnchor="middle" fill="#e8e6e180" fontSize="9">channel_messages</text>
            <text x="510" y="185" textAnchor="middle" fill="#e8e6e180" fontSize="9">photo_archive</text>
            <text x="510" y="200" textAnchor="middle" fill="#e8e6e180" fontSize="9">page_views</text>

            {/* Arrow */}
            <line x1="580" y1="160" x2="640" y2="160" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="640,155 650,160 640,165" fill="#ff3366" />

            {/* Frontend */}
            <rect x="650" y="120" width="130" height="80" stroke="#34d399" strokeWidth="1" fill="none" />
            <text x="715" y="155" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700">FRONTEND</text>
            <text x="715" y="175" textAnchor="middle" fill="#e8e6e180" fontSize="9">Real-time directory</text>
            <text x="715" y="190" textAnchor="middle" fill="#e8e6e180" fontSize="9">Interactive map</text>

            {/* Side outputs */}
            <line x1="510" y1="220" x2="510" y2="270" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="505,270 510,280 515,270" fill="#34d399" />
            <text x="510" y="300" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="600">Google Sheets BI</text>

            <line x1="300" y1="200" x2="300" y2="260" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="295,260 300,270 305,260" fill="#34d399" />
            <text x="300" y="290" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="600">Telegram Bot</text>

            {/* Title */}
            <text x="400" y="30" textAnchor="middle" fill="#e8e6e130" fontSize="10" fontWeight="500" letterSpacing="3">DATA PIPELINE ARCHITECTURE</text>
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
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#FF3D8B" />
              </marker>
            </defs>
            {/* Input */}
            <rect x="20" y="20" width="200" height="56" stroke="#FF3D8B" strokeWidth="1" fill="none" />
            <text x="120" y="46" textAnchor="middle" fill="#f0f0f0" fontFamily="ChakraPetch, sans-serif" fontWeight="700" fontSize="14">Telegram cluster</text>
            <text x="120" y="64" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="11">name · phone · LINE · maps</text>

            {/* Layer 1: phone */}
            <line x1="120" y1="76" x2="120" y2="105" stroke="#2a2a2a" markerEnd="url(#arrow-orange)" />
            <rect x="20" y="110" width="200" height="80" stroke="#34d399" strokeWidth="1" fill="none" />
            <text x="120" y="132" textAnchor="middle" fill="#34d399" fontFamily="Share Tech Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">LAYER 1 — PHONE</text>
            <text x="120" y="152" textAnchor="middle" fill="#f0f0f0" fontFamily="ChakraPetch, sans-serif" fontSize="13">normalize → E.164</text>
            <text x="120" y="170" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">match if cleaned digits equal</text>
            <text x="120" y="183" textAnchor="middle" fill="#9fc2ff" fontFamily="Share Tech Mono, monospace" fontSize="10">strongest signal · low entropy</text>

            {/* Yes branch from Layer 1 */}
            <line x1="220" y1="150" x2="320" y2="150" stroke="#2a2a2a" markerEnd="url(#arrow-orange)" />
            <text x="270" y="143" textAnchor="middle" fill="#34d399" fontFamily="Share Tech Mono, monospace" fontSize="10">match → MERGE</text>

            {/* Layer 2: name+location */}
            <line x1="120" y1="190" x2="120" y2="215" stroke="#2a2a2a" markerEnd="url(#arrow-orange)" />
            <text x="138" y="207" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">no phone</text>
            <rect x="20" y="220" width="200" height="80" stroke="#9fc2ff" strokeWidth="1" fill="none" />
            <text x="120" y="242" textAnchor="middle" fill="#9fc2ff" fontFamily="Share Tech Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">LAYER 2 — NAME + LOCATION</text>
            <text x="120" y="262" textAnchor="middle" fill="#f0f0f0" fontFamily="ChakraPetch, sans-serif" fontSize="13">canonicalise both fields</text>
            <text x="120" y="280" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">match if exact equality after</text>
            <text x="120" y="293" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">strip ‘ร้าน’ · diacritics · case</text>

            {/* Yes branch from Layer 2 */}
            <line x1="220" y1="260" x2="320" y2="260" stroke="#2a2a2a" markerEnd="url(#arrow-orange)" />
            <text x="270" y="253" textAnchor="middle" fill="#9fc2ff" fontFamily="Share Tech Mono, monospace" fontSize="10">match → MERGE</text>

            {/* Layer 3: fuzzy */}
            <line x1="120" y1="300" x2="120" y2="325" stroke="#2a2a2a" markerEnd="url(#arrow-orange)" />
            <text x="138" y="318" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">distinct</text>
            <rect x="20" y="330" width="200" height="20" stroke="#FF3D8B" strokeWidth="1" fill="none" />
            <text x="120" y="345" textAnchor="middle" fill="#FF3D8B" fontFamily="Share Tech Mono, monospace" fontSize="11" letterSpacing="0.1em">LAYER 3 — FUZZY (≥ 10 char substring)</text>

            {/* Right column: outcomes */}
            <rect x="320" y="120" width="220" height="60" stroke="#34d399" strokeWidth="1" fill="none" />
            <text x="430" y="142" textAnchor="middle" fill="#34d399" fontFamily="Share Tech Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">PHONE-CLUSTER MERGE</text>
            <text x="430" y="160" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">e.g. one operator → many</text>
            <text x="430" y="172" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">staff aliases · single record</text>

            <rect x="320" y="230" width="220" height="60" stroke="#9fc2ff" strokeWidth="1" fill="none" />
            <text x="430" y="252" textAnchor="middle" fill="#9fc2ff" fontFamily="Share Tech Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.1em">CANONICAL MERGE</text>
            <text x="430" y="270" textAnchor="middle" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="10">same shop, different scribes</text>

            {/* Far right: scoring formula */}
            <rect x="580" y="80" width="220" height="240" stroke="#2a2a2a" strokeWidth="1" fill="none" />
            <text x="690" y="105" textAnchor="middle" fill="#FF3D8B" fontFamily="Share Tech Mono, monospace" fontWeight="700" fontSize="11" letterSpacing="0.12em">CANONICAL SCORE</text>
            <text x="600" y="135" fill="#f0f0f0" fontFamily="Share Tech Mono, monospace" fontSize="11">score(L) =</text>
            <text x="610" y="155" fill="#34d399" fontFamily="Share Tech Mono, monospace" fontSize="11">  35 · I[maps]</text>
            <text x="610" y="172" fill="#34d399" fontFamily="Share Tech Mono, monospace" fontSize="11">+ 25 · I[phone]</text>
            <text x="610" y="189" fill="#9fc2ff" fontFamily="Share Tech Mono, monospace" fontSize="11">+ 15 · I[line]</text>
            <text x="610" y="206" fill="#9fc2ff" fontFamily="Share Tech Mono, monospace" fontSize="11">+ 10 · I[hours]</text>
            <text x="610" y="223" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="11">+ 10 · I[price]</text>
            <text x="610" y="240" fill="#a0a0a0" fontFamily="Share Tech Mono, monospace" fontSize="11">+ min(10, mention)</text>
            <line x1="600" y1="252" x2="780" y2="252" stroke="#2a2a2a" />
            <text x="600" y="272" fill="#a0a0a0" fontFamily="ChakraPetch, sans-serif" fontSize="11">When two candidates merge,</text>
            <text x="600" y="288" fill="#a0a0a0" fontFamily="ChakraPetch, sans-serif" fontSize="11">the higher-score record wins;</text>
            <text x="600" y="304" fill="#a0a0a0" fontFamily="ChakraPetch, sans-serif" fontSize="11">missing fields are filled from</text>
            <text x="600" y="320" fill="#a0a0a0" fontFamily="ChakraPetch, sans-serif" fontSize="11">the loser. Indicators I[·] ∈ {`{0,1}`}.</text>
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
          <div className="meth-row"><span>Frontend</span><span>Vercel (free)</span></div>
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
            <rect x="20" y="80" width="140" height="60" stroke="#ff3366" strokeWidth="1" fill="none" />
            <text x="90" y="110" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700">TELEGRAM WEBHOOK</text>
            <text x="90" y="125" textAnchor="middle" fill="#e8e6e180" fontSize="9">Raw Cluster</text>

            <line x1="160" y1="110" x2="220" y2="110" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="220,105 230,110 220,115" fill="#ff3366" />

            {/* Semantic Engine Box */}
            <rect x="230" y="40" width="300" height="140" stroke="#34d399" strokeWidth="1" strokeDasharray="4 4" fill="none" />
            <text x="380" y="60" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="700" letterSpacing="2">SEMANTIC ENGINE (LLM)</text>

            {/* LLM Steps */}
            <rect x="250" y="80" width="80" height="40" stroke="#34d399" strokeWidth="1" fill="rgba(52, 211, 153, 0.1)" />
            <text x="290" y="103" textAnchor="middle" fill="#e8e6e1" fontSize="9">Tokenize</text>

            <line x1="330" y1="100" x2="350" y2="100" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="350,97 355,100 350,103" fill="#34d399" />

            <rect x="355" y="80" width="80" height="40" stroke="#34d399" strokeWidth="1" fill="rgba(52, 211, 153, 0.1)" />
            <text x="395" y="98" textAnchor="middle" fill="#e8e6e1" fontSize="9">Sentiment</text>
            <text x="395" y="110" textAnchor="middle" fill="#e8e6e180" fontSize="8">Extraction</text>

            <line x1="435" y1="100" x2="455" y2="100" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="455,97 460,100 455,103" fill="#34d399" />

            <rect x="460" y="80" width="60" height="40" stroke="#34d399" strokeWidth="1" fill="rgba(52, 211, 153, 0.1)" />
            <text x="490" y="98" textAnchor="middle" fill="#e8e6e1" fontSize="9">Temporal</text>
            <text x="490" y="110" textAnchor="middle" fill="#e8e6e180" fontSize="8">Scoring</text>

            {/* Output Arrow */}
            <line x1="530" y1="110" x2="590" y2="110" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="590,105 600,110 590,115" fill="#34d399" />

            {/* Heatmap Node */}
            <rect x="600" y="80" width="140" height="60" stroke="#FF3D8B" strokeWidth="1" fill="none" />
            <text x="670" y="110" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700">ACTIVITY HEATMAP</text>
            <text x="670" y="125" textAnchor="middle" fill="#e8e6e180" fontSize="9">Predictive Indicator</text>
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
          The answer: you get a system that scrapes 12 Telegram channels every 30 seconds, archives
          2,100+ raw messages, downloads 570+ photos with original metadata, maintains a real-time
          directory of 300+ businesses with interactive mapping, pushes notifications to your phone
          for every new listing, and backs everything up to Google Sheets automatically.
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
              same operator masking, image stockpile, or both. Productised: an authenticity
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

      <section className="meth-section meth-section-disclaimer">
        <span className="meth-num">09</span>
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
        <p className="meth-footer-sub">Experimental AI Platform Research, 2026</p>
        <a href="/" className="meth-footer-link">Back to Sabai Sabai Directory</a>
      </footer>
    </article>
  );
}

export default Methodology;
