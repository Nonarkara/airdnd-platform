import './Methodology.css';

function Methodology() {
  return (
    <article className="methodology">
      <header className="meth-header">
        <a href="/" className="meth-back">Back to Directory</a>
        <span className="meth-label">Research Paper</span>
      </header>

      <div className="meth-hero">
        <h1 className="meth-title">
          Community Intelligence<br />
          <span className="meth-title-accent">at Zero Marginal Cost</span>
        </h1>
        <div className="meth-line" aria-hidden="true" />
        <p className="meth-author">Dr. Non Arkaraprasertkul</p>
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
            <rect x="20" y="120" width="140" height="80" rx="2" stroke="#b91c1c" strokeWidth="1" fill="none" />
            <text x="90" y="155" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700" fontFamily="Jost">TELEGRAM</text>
            <text x="90" y="175" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">12 channels</text>
            <text x="90" y="190" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">2,100+ messages</text>

            {/* Arrow */}
            <line x1="160" y1="160" x2="220" y2="160" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="220,155 230,160 220,165" fill="#b91c1c" />

            {/* Gemini AI */}
            <rect x="230" y="120" width="140" height="80" rx="2" stroke="#d4a853" strokeWidth="1" fill="none" />
            <text x="300" y="155" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700" fontFamily="Jost">GEMINI AI</text>
            <text x="300" y="175" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">Extract, classify,</text>
            <text x="300" y="190" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">enrich listings</text>

            {/* Arrow */}
            <line x1="370" y1="160" x2="430" y2="160" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="430,155 440,160 430,165" fill="#b91c1c" />

            {/* Supabase */}
            <rect x="440" y="100" width="140" height="120" rx="2" stroke="#b91c1c" strokeWidth="1" fill="none" />
            <text x="510" y="135" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700" fontFamily="Jost">SUPABASE</text>
            <text x="510" y="155" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">companions (300+)</text>
            <text x="510" y="170" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">channel_messages</text>
            <text x="510" y="185" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">photo_archive (570+)</text>
            <text x="510" y="200" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">page_views</text>

            {/* Arrow */}
            <line x1="580" y1="160" x2="640" y2="160" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="640,155 650,160 640,165" fill="#b91c1c" />

            {/* Frontend */}
            <rect x="650" y="120" width="130" height="80" rx="2" stroke="#d4a853" strokeWidth="1" fill="none" />
            <text x="715" y="155" textAnchor="middle" fill="#e8e6e1" fontSize="11" fontWeight="700" fontFamily="Jost">FRONTEND</text>
            <text x="715" y="175" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">Real-time directory</text>
            <text x="715" y="190" textAnchor="middle" fill="#e8e6e180" fontSize="9" fontFamily="Inter">Interactive map</text>

            {/* Side outputs */}
            <line x1="510" y1="220" x2="510" y2="270" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="505,270 510,280 515,270" fill="#d4a853" />
            <text x="510" y="300" textAnchor="middle" fill="#d4a853" fontSize="10" fontWeight="600" fontFamily="Jost">Google Sheets BI</text>
            <text x="510" y="315" textAnchor="middle" fill="#e8e6e150" fontSize="8" fontFamily="Inter">Auto-refreshes hourly</text>

            <line x1="300" y1="200" x2="300" y2="260" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="295,260 300,270 305,260" fill="#d4a853" />
            <text x="300" y="290" textAnchor="middle" fill="#d4a853" fontSize="10" fontWeight="600" fontFamily="Jost">Telegram Notifications</text>
            <text x="300" y="305" textAnchor="middle" fill="#e8e6e150" fontSize="8" fontFamily="Inter">Push new listings to owner</text>

            {/* Title */}
            <text x="400" y="30" textAnchor="middle" fill="#e8e6e130" fontSize="10" fontWeight="500" letterSpacing="3" fontFamily="Jost">DATA PIPELINE ARCHITECTURE</text>
            <line x1="150" y1="50" x2="650" y2="50" stroke="#1e1e2a" strokeWidth="1" />
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
            <h3>Spam Filter</h3>
            <p>Pattern-matched rejection of porn, clickbait, group joining noise, and individual escort content. Thai and English patterns.</p>
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
            <h3>Message Classification</h3>
            <p>Every raw message is auto-classified: listing, discussion, feedback, admin, spam, or unknown. Enabling BI analysis on community behavior.</p>
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

      <footer className="meth-footer">
        <div className="meth-line" aria-hidden="true" />
        <p>Dr. Non Arkaraprasertkul</p>
        <p className="meth-footer-sub">Experimental AI Platform Research, 2026</p>
        <a href="/" className="meth-footer-link">Back to Sabai Sabai Directory</a>
      </footer>
    </article>
  );
}

export default Methodology;
