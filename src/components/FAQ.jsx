import { useLanguage } from '../context/LanguageContext';
import './Methodology.css';
import './FAQ.css';

const FAQ_KEYS = [
  ['q_what', 'a_what'],
  ['q_collect', 'a_collect'],
  ['q_80k', 'a_80k'],
  ['q_real', 'a_real'],
  ['q_dedup', 'a_dedup'],
  ['q_photos', 'a_photos'],
  ['q_flagged', 'a_flagged'],
  ['q_cost', 'a_cost'],
  ['q_tech', 'a_tech'],
  ['q_update', 'a_update'],
  ['q_who', 'a_who'],
  ['q_generalizable', 'a_generalizable'],
];

export default function FAQ() {
  const { t } = useLanguage();
  const tf = t.faq || {};
  const pc = t.pageChrome || {};

  return (
    <article className="faq-page">
      <header className="meth-header">
        <a href="/" className="meth-back">{pc.backToDirectory || 'Back to Directory'}</a>
        <span className="meth-label">FAQ</span>
      </header>

      <div className="faq-hero">
        <span className="faq-kicker">{tf.kicker || 'Frequently Asked Questions'}</span>
        <h1 className="faq-title">{tf.title || 'How does Sabai Sabai work?'}</h1>
        <p className="faq-subtitle">{tf.subtitle || 'Everything you wanted to know about the system, the data, and the research behind it.'}</p>
      </div>

      {/* Architecture diagram */}
      <section className="faq-diagram-section">
        <div className="meth-diagram">
          <svg viewBox="0 0 800 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="meth-svg" role="img" aria-label="System architecture">
            <text x="400" y="20" textAnchor="middle" fill="#e8e6e130" fontSize="9" fontWeight="500" letterSpacing="3">SYSTEM ARCHITECTURE · ZERO HARDWARE</text>

            <rect x="10" y="40" width="110" height="60" stroke="#ff3366" strokeWidth="1" fill="none" />
            <text x="65" y="66" textAnchor="middle" fill="#e8e6e1" fontSize="10" fontWeight="700">TELEGRAM</text>
            <text x="65" y="83" textAnchor="middle" fill="#e8e6e180" fontSize="8">12 channels · 30s poll</text>
            <text x="65" y="95" textAnchor="middle" fill="#e8e6e180" fontSize="8">109,000+ records</text>

            <line x1="120" y1="70" x2="150" y2="70" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="150,65 160,70 150,75" fill="#ff3366" />

            <rect x="160" y="40" width="120" height="60" stroke="#34d399" strokeWidth="1" fill="none" />
            <text x="220" y="66" textAnchor="middle" fill="#e8e6e1" fontSize="10" fontWeight="700">GEMINI AI</text>
            <text x="220" y="83" textAnchor="middle" fill="#e8e6e180" fontSize="8">Extract · classify</text>
            <text x="220" y="95" textAnchor="middle" fill="#e8e6e180" fontSize="8">enrich · screen</text>

            <line x1="280" y1="70" x2="310" y2="70" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="310,65 320,70 310,75" fill="#ff3366" />

            <rect x="320" y="30" width="130" height="80" stroke="#ff3366" strokeWidth="1" fill="none" />
            <text x="385" y="55" textAnchor="middle" fill="#e8e6e1" fontSize="10" fontWeight="700">SUPABASE</text>
            <text x="385" y="72" textAnchor="middle" fill="#e8e6e180" fontSize="8">listings · messages</text>
            <text x="385" y="84" textAnchor="middle" fill="#e8e6e180" fontSize="8">photo_archive</text>
            <text x="385" y="96" textAnchor="middle" fill="#34d399" fontSize="8">real-time subscription</text>

            <line x1="450" y1="70" x2="480" y2="70" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="480,65 490,70 480,75" fill="#ff3366" />

            <rect x="490" y="40" width="120" height="60" stroke="#34d399" strokeWidth="1" fill="none" />
            <text x="550" y="66" textAnchor="middle" fill="#e8e6e1" fontSize="10" fontWeight="700">CLOUDFLARE</text>
            <text x="550" y="83" textAnchor="middle" fill="#e8e6e180" fontSize="8">React + Vite frontend</text>
            <text x="550" y="95" textAnchor="middle" fill="#34d399" fontSize="8">live directory</text>

            <line x1="610" y1="70" x2="640" y2="70" stroke="#2a2a3a" strokeWidth="1" />
            <polygon points="640,65 650,70 640,75" fill="#34d399" />

            <rect x="650" y="40" width="130" height="60" stroke="#9fc2ff" strokeWidth="1" fill="none" />
            <text x="715" y="66" textAnchor="middle" fill="#e8e6e1" fontSize="10" fontWeight="700">YOU</text>
            <text x="715" y="83" textAnchor="middle" fill="#9fc2ff" fontSize="8">searchable directory</text>
            <text x="715" y="95" textAnchor="middle" fill="#9fc2ff" fontSize="8">real-time · $0 / month</text>

            <text x="385" y="155" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="600">↓ Google Sheets BI backup · Telegram Bot notifications</text>
          </svg>
        </div>
      </section>

      {/* Data stats strip */}
      <section className="faq-stats">
        <div className="faq-stat">
          <span className="faq-stat-val">109,000+</span>
          <span className="faq-stat-label">database records</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-val">12</span>
          <span className="faq-stat-label">Telegram channels</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-val">30s</span>
          <span className="faq-stat-label">poll interval</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-val">$0</span>
          <span className="faq-stat-label">monthly cost</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-val">300–500</span>
          <span className="faq-stat-label">unique listings</span>
        </div>
        <div className="faq-stat">
          <span className="faq-stat-val">1,000:1</span>
          <span className="faq-stat-label">posts per listing</span>
        </div>
      </section>

      {/* Q&A */}
      <section className="faq-qa">
        {FAQ_KEYS.map(([qk, ak]) => {
          const q = tf[qk];
          const a = tf[ak];
          if (!q || !a) return null;
          return (
            <details key={qk} className="faq-item">
              <summary className="faq-q">{q}</summary>
              <p className="faq-a">{a}</p>
            </details>
          );
        })}
      </section>

      <footer className="meth-footer">
        <div className="meth-line" aria-hidden="true" />
        <p>Sabai Sabai · Community Intelligence Platform</p>
        <p className="meth-footer-sub">
          <a href="/methodology" className="faq-footer-link">Read the full methodology paper →</a>
        </p>
        <a href="/" className="meth-footer-link">{pc.backToDirectory || 'Back to Directory'}</a>
      </footer>
    </article>
  );
}
