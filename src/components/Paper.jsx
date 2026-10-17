import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './Paper.css';

const fmt = (n) => Number(n).toLocaleString();
const hour12 = (h) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);

// ── Redaction ─────────────────────────────────────────────────────────────────
const REDACT_RE = new RegExp(
  [
    '0\\d[\\d\\s.\\-]{7,12}\\d',
    '(?:line|ไลน์|id|tel|โทร)\\s*[:：]?\\s*[@\\w._-]{2,}',
    'https?://\\S+',
    't\\.me/\\S+',
    '@[A-Za-z0-9_]{3,}',
    '[A-Za-z][A-Za-z0-9._-]*\\d{2,}[A-Za-z0-9._-]*',
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

// ── Tiny figures ─────────────────────────────────────────────────────────────
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

function EconomicFlowDiagram() {
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram I · The Circular Flow of Precarity and Rent Extraction</div>
      <div className="paper-diagram-scroll">
        <svg viewBox="0 0 700 240" className="paper-diagram-svg">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--mango)" />
            </marker>
            <marker id="arrow-sky" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--sky)" />
            </marker>
          </defs>
          <rect x="20" y="80" width="120" height="60" rx="4" fill="var(--surface-2)" stroke="var(--line-2)" />
          <text x="80" y="105" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="bold">RURAL ORIGIN</text>
          <text x="80" y="122" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Isan, Shan State, Laos</text>
          <text x="80" y="132" textAnchor="middle" fill="var(--ink-3)" fontSize="8">(Debt, Agrarian Collapse)</text>
          <rect x="260" y="80" width="160" height="80" rx="4" fill="var(--surface-2)" stroke="var(--line-2)" />
          <text x="340" y="102" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="bold">BANGKOK THRESHOLD</text>
          <text x="340" y="118" textAnchor="middle" fill="var(--mango)" fontSize="10">Massage Uniform (Alibi)</text>
          <text x="340" y="134" textAnchor="middle" fill="var(--ink-2)" fontSize="9">Base Fee (Rooms / Scrubs)</text>
          <text x="340" y="148" textAnchor="middle" fill="var(--ink-3)" fontSize="8">฿500 - ฿800</text>
          <rect x="520" y="80" width="160" height="80" rx="4" fill="var(--surface-3)" stroke="var(--mango)" strokeDasharray="3 3" />
          <text x="600" y="102" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="bold">THE ADD-ON ECONOMY</text>
          <text x="600" y="118" textAnchor="middle" fill="var(--mango)" fontSize="10" fontWeight="bold">Negotiated intimacy</text>
          <text x="600" y="134" textAnchor="middle" fill="var(--ink-2)" fontSize="9">Direct Tip to Worker</text>
          <text x="600" y="148" textAnchor="middle" fill="var(--ink-3)" fontSize="8">฿1,500 - ฿3,000</text>
          <path d="M 140 100 L 250 100" fill="none" stroke="var(--sky)" strokeWidth="1.5" markerEnd="url(#arrow-sky)" />
          <text x="195" y="92" textAnchor="middle" fill="var(--sky)" fontSize="9">Migration Flow</text>
          <path d="M 420 100 L 510 100" fill="none" stroke="var(--mango)" strokeWidth="1.5" markerEnd="url(#arrow)" />
          <text x="465" y="92" textAnchor="middle" fill="var(--mango)" fontSize="9">Negotiated Step</text>
          <path d="M 600 160 L 600 210 L 80 210 L 80 150" fill="none" stroke="var(--sky)" strokeWidth="1.5" markerEnd="url(#arrow-sky)" />
          <text x="340" y="202" textAnchor="middle" fill="var(--sky)" fontSize="9">Katanyu Remittance (฿15k - ฿40k/mo to parents &amp; village school fees)</text>
          <path d="M 340 80 L 340 30" fill="none" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#arrow)" />
          <text x="340" y="22" textAnchor="middle" fill="var(--ink-3)" fontSize="9">Rent Extraction: Parlor Cut &amp; Protection Fees</text>
        </svg>
      </div>
      <p className="paper-fig-note">
        The circular flow operates as a capital recycling mechanism: agrarian distress in the periphery drives labor migration to the center. The center extracts rent and enforces an alibi structure, while the worker redirects the informal surplus back to the periphery as vital remittances.
      </p>
    </div>
  );
}

// ── Wage comparison diagram ───────────────────────────────────────────────────
function WageComparisonChart() {
  const bars = [
    { label: 'Min. wage — Bangkok (2024)', monthly: 7770, color: 'var(--ink-4)', note: '฿370/day × 21 days' },
    { label: 'Service sector — entry', monthly: 12000, color: 'var(--sky)', note: 'Cashier, hotel staff' },
    { label: 'Office junior', monthly: 18000, color: 'var(--sky)', note: 'Admin, data entry' },
    { label: 'Informal × 4 sessions/wk', monthly: 30000, color: 'var(--mango)', note: '฿1,875 avg × 16/mo' },
    { label: 'Informal × 8 sessions/wk', monthly: 60000, color: 'var(--mango)', note: '฿1,875 avg × 32/mo' },
  ];
  const max = 65000;
  const W = 620; const BAR_H = 22; const ROW = 40; const LEFT = 220; const RIGHT = W - LEFT - 80;
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram II · Monthly income comparison — Bangkok formal vs. informal (฿)</div>
      <div className="paper-diagram-scroll">
        <svg viewBox={`0 0 ${W} ${bars.length * ROW + 30}`} className="paper-diagram-svg">
          {bars.map((b, i) => {
            const y = i * ROW + 8;
            const bw = Math.round((b.monthly / max) * RIGHT);
            return (
              <g key={b.label}>
                <text x={LEFT - 8} y={y + BAR_H / 2 + 4} textAnchor="end" fill="var(--ink-2)" fontSize="10">{b.label}</text>
                <rect x={LEFT} y={y} width={bw} height={BAR_H} fill={b.color} />
                <text x={LEFT + bw + 6} y={y + BAR_H / 2 + 4} fill="var(--ink)" fontSize="10" fontWeight="700">฿{(b.monthly).toLocaleString()}</text>
                <text x={LEFT + bw + 6} y={y + BAR_H / 2 + 16} fill="var(--ink-4)" fontSize="8">{b.note}</text>
              </g>
            );
          })}
          <line x1={LEFT} y1={bars.length * ROW + 10} x2={W - 60} y2={bars.length * ROW + 10} stroke="var(--line)" strokeWidth="1" />
          <text x={LEFT} y={bars.length * ROW + 22} fill="var(--ink-4)" fontSize="8">฿0</text>
          <text x={LEFT + Math.round((30000 / max) * RIGHT) - 10} y={bars.length * ROW + 22} fill="var(--ink-4)" fontSize="8">฿30k</text>
          <text x={LEFT + Math.round((60000 / max) * RIGHT) - 10} y={bars.length * ROW + 22} fill="var(--ink-4)" fontSize="8">฿60k</text>
        </svg>
      </div>
      <p className="paper-fig-note">The mango bars are not a ceiling — they are a floor. The premium compounds with frequency. A full-time informal worker at median rates outearns a senior Bangkok office manager in year three of employment.</p>
    </div>
  );
}

// ── Policy comparison table ───────────────────────────────────────────────────
function PolicyTable() {
  const rows = [
    { model: 'Criminalisation (full)', example: 'Thailand · Philippines', supply: 'Underground', demand: 'Underground', safety: 'Minimal — workers cannot report violence', trafficking: 'Highest — no oversight', health: 'Low — inaccessible' },
    { model: 'Nordic model', example: 'Sweden · Norway · France', supply: 'Decriminalised', demand: 'Criminalised', safety: 'Reduced — workers cannot work indoors safely', trafficking: 'Unclear — mixed evidence', health: 'Medium' },
    { model: 'Legalisation', example: 'Netherlands · Germany', supply: 'Licensed', demand: 'Legal', safety: 'High for licensed; low for undocumented', trafficking: 'Bifurcated market risk', health: 'High for licensed' },
    { model: 'Full decriminalisation', example: 'New Zealand (2003)', supply: 'Labour rights', demand: 'Legal', safety: 'Highest measured — NZ review 2008/2023', trafficking: 'Lowest measured', health: 'Highest — full healthcare access' },
    { model: "Thailand's 100% Condom Program", example: '1989–2001', supply: 'Enforcement via licensing', demand: 'Not addressed', safety: 'Improved via mandated condom use', trafficking: 'Not measured', health: 'STI reduction 90%+' },
  ];
  return (
    <div className="paper-fig" style={{ overflowX: 'auto' }}>
      <div className="paper-fig-cap">Table I · Regulatory frameworks — key outcomes by model</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: 'var(--ink-2)' }}>
        <thead>
          <tr>
            {['Model', 'Example', 'Worker safety', 'Trafficking rate', 'Health access'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mango)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.model}</td>
              <td style={{ padding: '8px 10px', color: 'var(--ink-3)', fontSize: '11px' }}>{r.example}</td>
              <td style={{ padding: '8px 10px' }}>{r.safety}</td>
              <td style={{ padding: '8px 10px' }}>{r.trafficking}</td>
              <td style={{ padding: '8px 10px', color: i === 3 ? 'var(--mango)' : i === 4 ? 'var(--sky)' : 'inherit' }}>{r.health}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="paper-fig-note">Source: New Zealand Prostitution Law Review Committee (2008); Amnesty International (2016); UNAIDS Best Practice Guide (2018); Thailand MOPH surveillance data (1989–2001). Table summarises published outcomes; contested evidence noted in text.</p>
    </div>
  );
}

// ── Live case callout ─────────────────────────────────────────────────────────
// variant: 'red' (criminal / trafficking) | 'sky' (contrast / legitimate) | 'amber' (folk taxonomy)
function LiveCaseCallout({ date, source, headline, children, variant = 'red', kicker = 'LIVE CASE' }) {
  return (
    <div className={`paper-live-case${variant !== 'red' ? ` ${variant}` : ''}`}>
      <div className="paper-live-case-header">
        <span className="paper-live-case-kicker">{kicker}</span>
        <span className="paper-live-case-date">{date}</span>
        <span className="paper-live-case-source">{source}</span>
      </div>
      <p className="paper-live-case-headline">{headline}</p>
      <div className="paper-live-case-body">{children}</div>
    </div>
  );
}

// ── Platform architecture diagram ─────────────────────────────────────────────
function PlatformPivotDiagram() {
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram III · The domain-agnostic pipeline — two configurations</div>
      <div className="paper-diagram-scroll">
        <svg viewBox="0 0 700 200" className="paper-diagram-svg">
          <defs>
            <marker id="arrow-p" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--mango)" />
            </marker>
          </defs>
          {/* Fixed pipeline stages */}
          {[
            { x: 180, label: 'AI EXTRACT', sub: 'Gemini' },
            { x: 300, label: 'DEDUP', sub: 'Phone + fuzzy' },
            { x: 420, label: 'ENRICH', sub: 'Quality + classify' },
            { x: 540, label: 'DISPLAY', sub: 'React + Supabase' },
          ].map((s) => (
            <g key={s.x}>
              <rect x={s.x} y={70} width={100} height={50} fill="var(--surface)" stroke="var(--line-2)" />
              <text x={s.x + 50} y={91} textAnchor="middle" fill="var(--ink)" fontSize="9" fontWeight="700">{s.label}</text>
              <text x={s.x + 50} y={104} textAnchor="middle" fill="var(--ink-3)" fontSize="8">{s.sub}</text>
              <text x={s.x + 50} y={115} textAnchor="middle" fill="var(--sky)" fontSize="7">UNCHANGED</text>
            </g>
          ))}
          {/* Arrows between stages */}
          {[180, 300, 420].map((x) => (
            <path key={x} d={`M ${x + 100} 95 L ${x + 120} 95`} fill="none" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#arrow-p)" />
          ))}
          {/* Variable: source */}
          <rect x={10} y={25} width={130} height={40} fill="var(--surface-2)" stroke="var(--mango)" />
          <text x={75} y={42} textAnchor="middle" fill="var(--mango)" fontSize="9" fontWeight="700">CONFIG A</text>
          <text x={75} y={56} textAnchor="middle" fill="var(--ink-2)" fontSize="8">12 massage channels</text>
          <rect x={10} y={120} width={130} height={40} fill="var(--surface-2)" stroke="var(--sky)" />
          <text x={75} y={137} textAnchor="middle" fill="var(--sky)" fontSize="9" fontWeight="700">CONFIG B</text>
          <text x={75} y={151} textAnchor="middle" fill="var(--ink-2)" fontSize="8">12 OTOP producer channels</text>
          <path d="M 140 45 L 170 95" fill="none" stroke="var(--mango)" strokeWidth="1.2" strokeDasharray="3 2" markerEnd="url(#arrow-p)" />
          <path d="M 140 140 L 170 100" fill="none" stroke="var(--sky)" strokeWidth="1.2" strokeDasharray="3 2" />
          {/* Variable: prompt */}
          <text x={350} y={18} textAnchor="middle" fill="var(--ink-4)" fontSize="8">↑ ONLY TWO COMPONENTS CHANGE ↑</text>
          <rect x={285} y={22} width={130} height={30} fill="none" stroke="var(--mango)" strokeDasharray="2 2" />
          <text x={350} y={36} textAnchor="middle" fill="var(--ink-3)" fontSize="8">AI extraction prompt</text>
          <text x={350} y={47} textAnchor="middle" fill="var(--ink-4)" fontSize="7">(domain knowledge in one text block)</text>
          {/* Output */}
          <rect x={650} y={65} width={44} height={60} fill="var(--surface-2)" stroke="var(--line)" />
          <text x={672} y={90} textAnchor="middle" fill="var(--ink-2)" fontSize="8">DIR-</text>
          <text x={672} y={102} textAnchor="middle" fill="var(--ink-2)" fontSize="8">ECTORY</text>
          <text x={672} y={118} textAnchor="middle" fill="var(--mango)" fontSize="8">ANY</text>
          <path d="M 640 95 L 648 95" fill="none" stroke="var(--line-2)" strokeWidth="1.2" markerEnd="url(#arrow-p)" />
          <text x={350} y={175} textAnchor="middle" fill="var(--ink-4)" fontSize="8">The pipeline does not know its domain. The prompt does. Change the prompt; the pipeline follows.</text>
        </svg>
      </div>
    </div>
  );
}

// ── Global comparative phenomenon diagram ─────────────────────────────────────
function GlobalPhenomenonDiagram() {
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram IV · Global Comparative Typology of Informal Sex Work &amp; Massage Markets</div>
      <div className="paper-diagram-scroll">
        <svg viewBox="0 0 760 220" className="paper-diagram-svg">
          <rect x={10} y={10} width={235} height={195} fill="var(--surface)" stroke="var(--line-2)" />
          <text x={127} y={32} textAnchor="middle" fill="#ff7440" fontSize="11" fontWeight="700">TOKYO · KABUKI-CHO</text>
          <text x={127} y={48} textAnchor="middle" fill="var(--ink-3)" fontSize="8">Physical Muryo Annaisho → X / Telegram</text>
          <line x1={25} y1={58} x2={230} y2={58} stroke="var(--line)" />
          <text x={25} y={78} fill="var(--ink-2)" fontSize="8">• Legal: Fueiho (Entertainment Law)</text>
          <text x={25} y={94} fill="var(--ink-2)" fontSize="8">• Touting: Ban on street touting (Kyobatta)</text>
          <text x={25} y={110} fill="var(--ink-2)" fontSize="8">• Shift: Street booths → X / LINE brooms</text>
          <text x={25} y={126} fill="var(--ink-2)" fontSize="8">• Risks: Bottakuri scam bars, debt-bondage</text>
          <text x={25} y={142} fill="var(--ink-2)" fontSize="8">• Police: Metro Police Dept. raids</text>
          <rect x={25} y={155} width={205} height={35} fill="rgba(255, 116, 64, 0.1)" stroke="#ff7440" />
          <text x={127} y={176} textAnchor="middle" fill="#ff7440" fontSize="8" fontWeight="700">Informal Touting → Digital Broadsheet</text>

          <rect x={262} y={10} width={235} height={195} fill="var(--surface)" stroke="var(--line-2)" />
          <text x={379} y={32} textAnchor="middle" fill="#36C7FF" fontSize="11" fontWeight="700">AMSTERDAM · DE WALLEN</text>
          <text x={379} y={48} textAnchor="middle" fill="var(--ink-3)" fontSize="8">Window Brothels → Erotic Centre &amp; Web</text>
          <line x1={277} y1={58} x2={482} y2={58} stroke="var(--line)" />
          <text x={277} y={78} fill="var(--ink-2)" fontSize="8">• Legal: 2000 Brothel Ban Lift (ZZP-er)</text>
          <text x={277} y={94} fill="var(--ink-2)" fontSize="8">• Oversight: Municipal Licensing (Project 1012)</text>
          <text x={277} y={110} fill="var(--ink-2)" fontSize="8">• Shift: Window display → Private online appt</text>
          <text x={277} y={126} fill="var(--ink-2)" fontSize="8">• Rights: GAATW / ILO labor protection</text>
          <text x={277} y={142} fill="var(--ink-2)" fontSize="8">• Friction: Tourism nuisance &amp; relocations</text>
          <rect x={277} y={155} width={205} height={35} fill="rgba(54, 199, 255, 0.1)" stroke="#36C7FF" />
          <text x={379} y={176} textAnchor="middle" fill="#36C7FF" fontSize="8" fontWeight="700">Municipal Licensing → Web Directories</text>

          <rect x={515} y={10} width={235} height={195} fill="var(--surface)" stroke="var(--line-2)" />
          <text x={632} y={32} textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="700">BANGKOK · TELEGRAM</text>
          <text x={632} y={48} textAnchor="middle" fill="var(--ink-3)" fontSize="8">Forum Posts → Real-Time Telegram Pipeline</text>
          <line x1={530} y1={58} x2={735} y2={58} stroke="var(--line)" />
          <text x={530} y={78} fill="var(--ink-2)" fontSize="8">• Dual: Nuad Thai (UNESCO) vs Grey Spa</text>
          <text x={530} y={94} fill="var(--ink-2)" fontSize="8">• Law: Prostitution Suppression Act (1996)</text>
          <text x={530} y={110} fill="var(--ink-2)" fontSize="8">• Alibi: Health Establishment Act (2016)</text>
          <text x={530} y={126} fill="var(--ink-2)" fontSize="8">• Economy: Monthly protection fees ("Tua")</text>
          <text x={530} y={142} fill="var(--ink-2)" fontSize="8">• Tech: Zero-cost AI community pipeline</text>
          <rect x={530} y={155} width={205} height={35} fill="rgba(52, 211, 153, 0.1)" stroke="#34d399" />
          <text x={632} y={176} textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="700">Unstructured Feed → Public Intelligence</text>
        </svg>
      </div>
    </div>
  );
}

// ── Grey economy and police oversight diagram ─────────────────────────────────
function GreyEconomyPoliceFlowDiagram() {
  return (
    <div className="paper-fig paper-diagram-container">
      <div className="paper-fig-cap">Diagram V · Financial &amp; Regulatory Protection Fee Flow ("Tua" Ticket System)</div>
      <div className="paper-diagram-scroll">
        <svg viewBox="0 0 720 180" className="paper-diagram-svg">
          <defs>
            <marker id="arrow-g" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ff7440" />
            </marker>
          </defs>
          <rect x={15} y={30} width={130} height={50} fill="var(--surface)" stroke="var(--line-2)" />
          <text x={80} y={52} textAnchor="middle" fill="var(--ink)" fontSize="9" fontWeight="700">CLIENT DEMAND</text>
          <text x={80} y={67} textAnchor="middle" fill="var(--ink-3)" fontSize="8">Cash / PromptPay</text>

          <rect x={190} y={30} width={140} height={50} fill="var(--surface)" stroke="#ff7440" />
          <text x={260} y={52} textAnchor="middle" fill="#ff7440" fontSize="9" fontWeight="700">PARLOUR OPERATOR</text>
          <text x={260} y={67} textAnchor="middle" fill="var(--ink-3)" fontSize="8">Shophouse / Wellness Spa</text>

          <rect x={375} y={15} width={140} height={40} fill="var(--surface-2)" stroke="#34d399" />
          <text x={445} y={34} textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="700">WORKER WAGE</text>
          <text x={445} y={46} textAnchor="middle" fill="var(--ink-3)" fontSize="7">Commission + Tips</text>

          <rect x={375} y={75} width={140} height={40} fill="var(--surface-2)" stroke="#FFD23D" />
          <text x={445} y={93} textAnchor="middle" fill="#FFD23D" fontSize="9" fontWeight="700">POLICE "TUA" FEE</text>
          <text x={445} y={106} textAnchor="middle" fill="var(--ink-3)" fontSize="7">฿5,000–฿50,000 / mo</text>

          <rect x={560} y={30} width={145} height={50} fill="var(--surface)" stroke="#36C7FF" />
          <text x={632} y={50} textAnchor="middle" fill="#36C7FF" fontSize="9" fontWeight="700">HEALTH MINISTRY ALIBI</text>
          <text x={632} y={65} textAnchor="middle" fill="var(--ink-3)" fontSize="7">Health Establishment License</text>

          <path d="M 145 55 L 185 55" stroke="#ff7440" strokeWidth="1.2" markerEnd="url(#arrow-g)" />
          <path d="M 330 45 L 370 35" stroke="#34d399" strokeWidth="1.2" markerEnd="url(#arrow-g)" />
          <path d="M 330 65 L 370 85" stroke="#FFD23D" strokeWidth="1.2" markerEnd="url(#arrow-g)" />
          <path d="M 515 55 L 555 55" stroke="#36C7FF" strokeWidth="1.2" markerEnd="url(#arrow-g)" />

          <text x={360} y={155} textAnchor="middle" fill="var(--ink-4)" fontSize="8">
            The legal alibi of the 2016 Health Act permits parlours to operate bodywork spas while paying monthly protection fees ("Tua") to local precinct inspectors.
          </text>
        </svg>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Paper() {
  const { t } = useLanguage();
  const pc = t.pageChrome || {};
  const [r, setR] = useState(null);
  const [plates, setPlates] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('system');

  useEffect(() => {
    Promise.all([
      fetch('/research.json').then((x) => (x.ok ? x.json() : Promise.reject(new Error(`research ${x.status}`)))),
      fetch('/feed.json').then((x) => (x.ok ? x.json() : [])).catch(() => []),
    ]).then(([res, feed]) => {
      setR(res);
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
      <a href="/sociology" className="meth-back">{pc.backToFieldNotes || '← Field Notes'}</a>
      <span className="meth-label">{pc.workingPaper || 'Working Paper'}</span>
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

  const TABS = [
    { id: 'system', label: 'System · I–IX' },
    { id: 'global', label: 'Global Phenomena & Rights · X–XIV' },
    { id: 'origin', label: 'Origin · XV–XIX' },
    { id: 'economy', label: 'Economy · XX–XXIV' },
    { id: 'platform', label: 'Platform · XXV–XXVIII' },
    { id: 'ethics', label: 'Ethics & Methods · XXIX–XXXII' },
  ];

  return (
    <article className="paper">
      {head}

      {/* Masthead */}
      <div className="paper-masthead">
        <span className="eyebrow">Working Paper · Draft 0.4 · Computational Ethnography</span>
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
        <p>
          A second argument, developed in the Origin, Economy, and Platform tabs below, is offered as the reason this paper was written at all: the system that produced it was not designed to study this market. It was designed to study any market. The choice of domain was deliberate — informationally rich, publicly under-acknowledged, structurally ungoverned. The analysis is the proof-of-concept. The architecture is the argument.
        </p>
        <p className="paper-keywords"><strong>Keywords:</strong> informal labour · sex work · commodification of intimacy · labour migration · Foucault · repressive hypothesis · Thailand · Buddhist values · platform economy · computational ethnography · zero-marginal-cost infrastructure · OTOP.</p>
      </section>

      {/* Tab navigation */}
      <nav className="paper-tabs" aria-label="Paper sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`paper-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: SYSTEM — the original paper, sections I–IX                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`paper-tab-panel${activeTab === 'system' ? ' is-active' : ''}`}>

        <section className="paper-sec">
          <span className="paper-num">I</span>
          <h2 className="paper-h">A Doorway in the Feed</h2>
          <p className="paper-lead">
            At 9:14 in the morning, a message arrives: the shop is open, here are the hours, here is the pin, the girls have come in. Four minutes later an identical message arrives in a second channel. Over the life of the archive, one such message was posted <strong>{fmt(repeat.maxRepeatsOfOnePost)} times</strong>. This is a shopkeeper in a doorway, making herself visible to the traffic — industrialised, and machine-read at the scale of {fmt(corpus.totalMessages)} gestures. What it reveals is not about sex, which is the least interesting thing here, but about labour, language, migration, and the arrangement by which a society runs a market it has agreed not to admit exists.
          </p>
        </section>

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

          <LiveCaseCallout
            variant="amber"
            kicker="FOLK TAXONOMY"
            date="24 May 2026"
            source="ไทยรัฐบันเทิง / นวดไหนดี"
            headline='"ต้นหอม ศกุนตลา" opens a massage and spa — immediately clarifies: "สายขาว" (white line) — no hidden services'
          >
            <p>
              When the Thai celebrity ต้นหอม ศกุนตลา announced her massage and spa business, the first question from fans and industry contacts was automatic: <em>what kind of shop is this? Hidden services or not?</em> She responded publicly: her establishment is <strong>สายขาว</strong> — white line. Body and foot massage only. No inappropriate services. To demonstrate the commitment, she washed customers' feet by hand.
            </p>
            <p>
              The terms <strong>สายขาว</strong> (white line) and its implied opposite <strong>สายดำ/สายเทา</strong> (black line / grey line) are the folk taxonomy the Thai industry and its clients actually use to classify the market — operationally precise, entirely absent from regulatory frameworks, and completely invisible to the paper's corpus. White-line establishments deliver exactly what the therapeutic vocabulary promises. Grey/black-line establishments use the same vocabulary for a different service. The corpus contains both without distinguishing them, because the vocabulary distinguishes nothing.
            </p>
            <p>
              The celebrity's need to clarify her category is the argument. <em>The question is automatic.</em> Thai speakers no longer read นวดเพื่อสุขภาพ as unambiguous, because the phrase has served as alibi long enough to colonise the name. The legitimate operator must now actively distinguish herself from the coded market she shares a vocabulary with. The code works structurally because it is indistinguishable until someone is asked to clarify — and the clarification must come from the operator, not the sign on the door.
            </p>
          </LiveCaseCallout>

          <LiveCaseCallout
            variant="sky"
            kicker="CONTRAST CASE"
            date="25 May 2026"
            source="หม่อนไหม สุราษฎร์ / โหนกระแส / นวดไหนดี"
            headline="Surat Thani restaurateur files police report after being threatened at a shopping-mall health massage parlour — for asking a fellow client to silence his phone"
          >
            <p>
              A 58-year-old restaurateur, receiving health massage inside a Surat Thani department store, asked a neighbouring client to silence his phone. The client threatened him. The masseuse — described throughout the police report as <em>หมอนวด</em> (massage doctor, the professional title) — witnessed the incident and physically intervened before the aggressor left. The restaurateur filed a criminal intimidation report.
            </p>
            <p>
              This is <strong>สายขาว</strong> in operation. The same phrase — นวดเพื่อสุขภาพ — describes a department-store therapeutic service used by a prominent local businessman as a routine wellness activity. The masseuse is a professional with the authority and responsibility to intervene between clients. The conflict is about phone etiquette in a shared therapeutic space, of precisely the kind that occurs in gyms, libraries, and cinemas.
            </p>
            <p>
              The alibi works because this case is real. The code in this paper's corpus is structurally parasitic on the genuine health-massage industry — it wears its vocabulary, occupies its regulatory category, and shelters behind its social legitimacy. Every shopping-mall masseuse who intervenes in a phone dispute is providing cover, structurally and involuntarily, for the Telegram channel's aroma oil hour. The lexicon is shared. The distinction lives elsewhere — in the negotiation, in the room, in the price that is never named.
            </p>
          </LiveCaseCallout>

          <p className="paper-lead">
            The alibi deepens when the anatomical territory it claims is traced to its legitimate medical
            origin. <strong>นวดกษัย</strong> (Karsai massage) is a recognised discipline within Thai
            traditional medicine that specifically targets the genital and groin area
            (<em>กษัย</em>: the lower abdomen, inguinal region, and genital musculature) to improve
            blood circulation and address male erectile dysfunction. A named medical doctor at Reverie
            Clinic, Bangkok, publishes clinical guidance on the practice under the category{' '}
            <em>สุขภาพเพศชาย</em> (men's sexual health), advising patients on outcomes, risks, and the
            distinction between Karsai as a circulatory intervention and modern shockwave therapy as an
            evidence-based equivalent. The practice is legal, prescribed, documented, and performed
            on the same anatomical territory as what the grey market's alibi vocabulary invokes.{' '}
            <strong>The alibi is not merely borrowed vocabulary — it is borrowed anatomy, borrowed
            legitimacy, and borrowed legal cover, derived from a medical tradition that works in the
            same room and touches the same body.</strong> The distinction between a Reverie Clinic
            appointment and a Telegram channel's oil-and-aroma session is not anatomical. It is the
            certificate on the wall, the price on the invoice, and the name that can be said aloud.
          </p>

          <p className="paper-lead">
            Perhaps the most precise measure of the alibi's structural effectiveness is a thread on
            the same Pantip forum in which a legitimate customer asks: <em>"How can you tell which
            regular massage shops have special services?"</em> (topic 39711381). The author is not
            seeking grey services. He has been solicited at what he thought was a regular shop and is
            trying to filter them <strong>out</strong> of his massage routine — and he cannot. The
            vocabulary is identical. The shopfront is identical. The listing is identical. The alibi
            has succeeded so completely that it provides no reliable signal to clients who don't want
            it, let alone to regulators who do. The corpus this system reads is a machine rendering of
            the same illegibility: {fmt(corpus.totalMessages)} messages in a shared vocabulary where
            the distinction between สายขาว and สายดำ is not in the text. It is in the room.
          </p>

          <p className="paper-lead">
            Below: the advertising itself, entered into the record as anonymised plates. The faces are blurred and every traceable identifier — phone, LINE, handle, location — is crossed out. The irony is acknowledged and intended: <strong>the same fields, for the same posts, are fully legible two clicks away on this very site's directory.</strong> The redaction is not security. It is a statement about who is owed protection in a piece of research, and who is not owed exposure in a piece of advertising — and about the thin, arbitrary, productive line between the two.
          </p>
          <div className="paper-plates">
            {plates.map((p, i) => <Plate key={i} entry={p} n={i + 1} />)}
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">III</span>
          <h2 className="paper-h">The Political Economy of Precarity: Gender, Displacement, and Debt</h2>
          <p className="paper-lead">
            The grey massage economy is not a collection of individual transactional choices; it is a structural sink for capital and displaced labour. Agrarian distress in the Northeast (Isan), exacerbated by environmental volatility and corporate contract farming, has resulted in high levels of household debt. For women in these regions, the moral responsibility of <strong>filial piety (Katanyu)</strong> is heavy. In the traditional Thai family structure, daughters, far more than sons, are expected to provide financial support for aging parents, school fees for younger siblings, and maintenance for the rural home.
          </p>
          <p className="paper-lead">
            Faced with a formal urban labor market that pays a minimum wage of roughly ฿370 per day (an amount consumed entirely by Bangkok's cost of living), the grey economy becomes a rational financial escape. An informal provider can generate between ฿40,000 and ฿80,000 per month, recycling the surplus directly to rural villages. This economic flow is detailed in Diagram I below.
          </p>
          <EconomicFlowDiagram />
          <p className="paper-lead">
            This system is further populated by displaced migrant women from Myanmar, Laos, and Cambodia, fleeing civil conflict, inflation, or conscription. For these irregular workers, formal employment is legally blocked, making the shadow threshold of the massage parlor their only viable survival mechanism.
          </p>
          <p className="paper-lead">
            The psychological transaction is equally complex. Male clients are not merely purchasing physical acts; they are consuming <strong>vulnerability packaged as therapy</strong>. In a modern, highly alienated urban environment, the client purchases a simulated oasis of submission, validation, and care. The worker must perform deep emotional labor, self-commodifying her persona and managing the severe social stigma of "dirty" labor, while ensuring that the core of her identity remains hidden behind her alias.
          </p>
        </section>

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
            To survive this moral friction, the physical <strong>massage uniform</strong> — be it clinical scrubs, a tailored polo, or a neat skirt-suit — acts as a vital moral and legal shield. By wearing the uniform of a health worker (<em>mo nuad</em> or "massage doctor") and operating under the official alibi of "massage for health" (<em>nuad phuea sukhaphab</em>), the worker performs a vital act of cognitive bracket. The uniform signals to the state, the public, the family, and the worker herself that the labor remains, at least on the surface, within the realm of therapeutic bodywork. It is a visual filter that permits all parties to maintain the alibi.
          </p>
        </section>

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

        <section className="paper-sec">
          <span className="paper-num">VI</span>
          <h2 className="paper-h">The Repeat Compulsion</h2>
          <p className="paper-lead">
            Fingerprinting every post against every other: of {fmt(repeat.totalPosts)} broadcasts only <strong>{fmt(repeat.uniquePosts)}</strong> are unique. <strong>{repeat.repeatRate}%</strong> of everything is a repeat; {intervals.buckets[0]?.pct}% of consecutive posts arrive under an hour apart; {repeat.crossPostRate}% appear on more than one channel. Where there are no reviews and no verified history, <strong>recency is the only signal</strong> — the operator who posted three minutes ago outranks the one who posted yesterday, and so the rational act is to never stop. The structure is two-tier: <strong>{channelTiers.aggregatorCount} aggregator channels</strong> carry {fmt(channelTiers.aggregatorPosts)} broadcasts (firing every few minutes), <strong>{channelTiers.shopCount} shops</strong> carry {fmt(channelTiers.shopPosts)} (once a day). The desperation belongs to the infrastructure; the shop just opens the door.
          </p>
        </section>

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

        <section className="paper-sec">
          <span className="paper-num">VII·B</span>
          <h2 className="paper-h">The Demand Voice: What the Forum Knows</h2>
          <p className="paper-lead">
            The corpus is {fmt(corpus.totalMessages)} supply-side messages. It produces zero demand-side
            testimony. The booking ratio — customers asking to book 11.9× more often than they ask the
            price — is visible from the outside; the booking experience is not. For that, this research
            must leave the database and enter the forum.
          </p>
          <p className="paper-lead">
            Pantip.com is Thailand's largest community forum — a Reddit equivalent where anonymous
            accounts discuss daily life, products, experiences, and advice in Thai. The platform has
            indexed a well-documented genre for at least a decade: first-person accounts by Thai men of
            encounters in the grey massage market, posted publicly in threads that circulate widely.
            The testimonial cited below (topic 38529177, published 2020) is representative of this
            genre and cited here as the demand-side record the corpus cannot supply.
          </p>
          <blockquote className="paper-quote">
            <p>"แถวนี้มีหลายร้านเลยครับ เป็นสิบๆร้านเลย เลือกร้านไม่ถูก"</p>
            <cite>— Pantip.com topic 38529177 (2020)</cite>
          </blockquote>
          <p className="paper-lead">
            <em>"There are many shops in my area — tens of them. I couldn't choose, so I just walked
            into one randomly."</em> The market this paper studies has a neighbourhood density so high
            that a consumer without a specific destination can proceed by random selection. Section VI's
            geographic concentration data is confirmed, from the inside, by the person who navigated
            it on foot.
          </p>
          <p className="paper-lead">
            The account describes three moments the author calls <strong>สตั้น</strong> — a Thai
            loanword from "stunned," indicating a sudden freeze of cognition at an unexpected threshold.
            Each corresponds to a crossing: the masseuse's instruction to undress completely rather
            than leaving paper underwear on; her direction to turn supine rather than closing the
            session; and the moment manual stimulation began without announcement. None of the three
            was preceded by a verbal offer. None named a service. None specified a price. The escalation
            was constructed entirely through proxemics — the spatial and tactile logic of progressive
            physical approach. <strong>The code that self-censors in the advertisement (Section II)
            was executed in the body without a prosecutable word being spoken at any point.</strong>
          </p>
          <blockquote className="paper-quote">
            <p>"ผมไม่ได้พิศวาสอะไรพี่แกเลยนะ แต่มันแข็งของมันเอง"</p>
            <cite>— Pantip.com topic 38529177 (2020)</cite>
          </blockquote>
          <p className="paper-lead">
            <em>"I didn't feel anything for her — it just got hard on its own."</em> The testimony
            describes the physiological without the psychological — the exact mechanism the alibi
            structure produces. By ensuring that no explicit offer is made, no desire acknowledged,
            no negotiation spoken, the operator constructs a transaction in which the client can
            say — and sincerely mean — that he did not intend for what happened to happen. The moral
            architecture of the encounter is built for this. It is not a side effect. It is the design.
          </p>
          <blockquote className="paper-quote">
            <p>"คิดว่าพี่แกคงเห็นมาหลายคนแล้วแหละ คงไม่ใช่เราคนแรกที่แข็ง เพราะพี่แกก็ดูเฉยๆ"</p>
            <cite>— Pantip.com topic 38529177 (2020)</cite>
          </blockquote>
          <p className="paper-lead">
            <em>"I figured she must have seen many like this before — I can't be the first to get
            hard, because she was completely unfazed."</em> The client reads the masseuse's professional
            detachment accurately. She has seen this before. The emotional labour is not distress
            management — it is professional composure in a routinised service context. Hochschild
            (1983) called this the management of "feeling rules": the worker performs equanimity because
            equanimity is what the service requires and what the client's embarrassment can absorb.
            The client's relief at her composure is testimony to a skill the corpus never records —
            because the corpus records only the advertisement. Not the room.
          </p>
          <blockquote className="paper-quote">
            <p>"เสร็จแล้วก็เริ่มคิดได้ว่าเค้าทำแบบนี้เพื่ออะไร เลยทริปให้พี่แกไป 300"</p>
            <cite>— Pantip.com topic 38529177 (2020)</cite>
          </blockquote>
          <p className="paper-lead">
            <em>"After finishing I started thinking — why does she do this? — so I tipped her ฿300."</em>{' '}
            The informal supplement appears here not as a negotiated price but as a retrospective gift
            — offered after the fact, set unilaterally by the client, motivated by a sudden
            acknowledgement of the worker's economic reality. ฿300 is smaller than the ฿1,500–3,000
            range the corpus implies for higher-tier encounters; it may represent the neighbourhood
            base rate or the spontaneous nature of an unplanned single visit. What the corpus cannot
            contain — because the supplement is never named before the service and therefore never
            appears in advertising text — the forum records: the money passed, the amount, the
            direction of the decision, and the moral processing that accompanied it.
          </p>
          <p className="paper-lead">
            The account adds one further detail the supply-side corpus cannot produce at all: the
            client's retrospective questioning of the worker's motive. <em>Why does she do this?</em>{' '}
            is the demand-side mirror of this paper's central sociological argument. The client does
            not ask why she advertises on Telegram, or what the code means, or why the price is
            structured as it is. He asks why she is in the room. He has no answer. The ฿300 is what
            he puts in the space where the answer should be. Together with the Karsai analysis above
            (II), the Surat Thani contrast case (II), and the structural silence about irregular
            migrants (VIII), this forum testimony completes a picture that the corpus, on its own,
            cannot form: a market that is simultaneously ordinary, technically legal, medically
            adjacent, violently enforced at its edges, and invisible to the economics it sustains.
          </p>
          <p className="paper-lead">
            The demand-side record is incomplete without its structural mirror. A Japanese-Thai woman
            posting under the handle BeamSensei published, on the same Pantip platform, her first oil
            massage experience at Inner Spa, Bang Yai — a regular legitimate spa. She went because she
            was exhausted after five days of travel and a marathon month of work. She arrived without
            reading any reviews: <em>"จะลองเสียเงินไม่กี่พันเพื่อซื้อประสบการณ์"</em> — "I'll just
            spend a few hundred baht to buy the experience." The masseuse gave her a shower cap and
            paper underwear. She showered. She lay face-down on a table with a hole for her face,
            flowers floating in a dish below. The session: back, arms, shoulders, legs, feet, one hour
            thirty minutes — 850 baht, disclosed upfront. When the masseuse asked <em>"Would you like
            a chest massage too?"</em> BeamSensei declined; the session closed. She tipped Aunty Porn
            and left.
          </p>
          <p className="paper-lead">
            Three moments of surprised reaction — the shower requirement she didn't know about, the
            exposure of her back during the massage, the offer of chest work — appear in BeamSensei's
            account as what they structurally were: unfamiliar thresholds in a legitimate
            professional service context, crossed only with her knowledge and consent, at a declared
            price, with a verbal offer for anything beyond the base session. She ends her post:{' '}
            <em>"ไว้เมื่อยจะไปอีก"</em> — "I'll come back when sore again."
          </p>
          <p className="paper-lead">
            Place the two accounts side by side. The physical setup is identical: shower, oil,
            prone position, turn supine, the possibility of areas beyond the back. The vocabulary is
            identical. The reaction — surprised, threshold-crossing, physiologically involved — is
            structurally parallel. The difference is not in the room's furniture or the oil's scent
            or the masseuse's hands. It is in: the price declared before entry, the paper underwear
            retained throughout, every escalation named and consented to before it occurred, and the
            moral weight of the question <em>why does she do this?</em> never needing to be asked.
            BeamSensei knows exactly why Aunty Porn is in that room. The Pantip man who tipped ฿300
            does not. That gap — between the declared service and the undeclared one, between the
            price on the wall and the supplement that is never named — is the entire distance between
            สายขาว and สายดำ, and the entire subject of this paper.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">VIII</span>
          <h2 className="paper-h">The Silence That Names</h2>
          <p className="paper-lead">
            The data cannot tell us who these women are. But it tells us, with force, <em>who the market refuses to name.</em> Against migration figures showing Thailand's informal labour pool is overwhelmingly Burmese and Cambodian — over five million migrants, three million from Myanmar, displaced by coup and conscription — the corpus names <strong>Burmese zero times, Cambodian zero times, Lao twice.</strong> It names "Vietnamese" (cachet) and "student" (fantasy), but the most precarious workers are folded into the undifferentiated <em>น้อง</em>. The firewall name extends to a <strong>firewall nationality</strong>: the irregular migrant, the refugee, is rendered invisible, her labour absorbed without acknowledgement.
          </p>
          <p className="paper-lead">
            There is a second silence the corpus cannot even map, because it is not within its source pool at all. The open Telegram channel — the kind this system monitors — is where the visible market advertises. It is not where an operator advertising minors would post. The intelligence that locates that market comes from undercover police work, not from reading public channels. The corpus, which reads 85,632 messages from the open market, generates a picture of its most legible end. The illegible end exists too. The absence of evidence for it in this dataset is not evidence of its absence from the city.
          </p>
          <p className="paper-lead">
            A third silence: the vulnerability created by the massage context is not unidirectional.
            A Pantip thread (topic 38519086) documents a male client at a regular legitimate Thai
            massage shop who was sexually assaulted by a male masseuse — oral penetration, without
            consent, while the client was prone, groggy, and in a professional trust relationship.
            He came with his girlfriend. He was shocked into immobility. He did not report to police.
            The shop, confronted by his girlfriend, fired the worker and refunded the session price —
            900 baht. The client writes: <em>"ผมคงไม่กล้าไปนวดที่ไหนอีกแล้ว"</em> — "I don't think
            I'll dare go for a massage anywhere again." The structural context that makes the grey
            market possible — alone, horizontal, undressed, in a closed room with a trusted
            professional — creates vulnerability for everyone in that room, in every direction.
            The corpus registers the alibi's supply-side text. It cannot register what happens to the
            person whose guard was down.
          </p>
          <div className="paper-fig">
            <div className="paper-fig-cap">Figure 5 · Demographic markers named in the corpus (read the absences)</div>
            <FigBars rows={demo} max={maxDemo} />
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">IX</span>
          <h2 className="paper-h">The Collapse, Reconsidered</h2>
          <p className="paper-lead">
            The moral reading locates the collapse in the women — their choices, their numbers, the ease with which a generation now self-commodifies, on OnlyFans and its analogues, at a scale without precedent. The data, read through Foucault (1978), relocates it. The prohibition does not suppress this economy; it <strong>produces</strong> it — the code, the precarity, the disposable and unnamed migrant labour, and above all the stigma that makes the work dangerous rather than merely difficult. There is nothing new in the OnlyFans moment; it is the generalisation, individualisation, and platforming of a logic the Bangkok massage channel has run for years. <strong>The massage channel is OnlyFans with a shopfront and a landlord.</strong>
          </p>
          <p className="paper-lead">
            One need not believe the answer is the open market in intimacy — Zelizer (2005) would warn the question is always <em>which</em> matches we permit, never whether money and intimacy may touch. One need only notice that the prohibition has not stopped the thing. It has only made it dangerous, and silent, and {fmt(corpus.totalMessages)} messages deep, and very good at never saying its own name. The collapse, if the word is used at all, is not moral and is not located in the women. It is the visible cost of a contradiction the rest of us maintain in good conscience: an economy that requires the commodification of intimacy at industrial scale, and a public culture that forbids us to say so.
          </p>
          <LiveCaseCallout
            date="9 June 2026 · 38 minutes before this update"
            source="ข่าวสด / นวดไหนดี (Thailand's #1 massage review page)"
            headline="Rama 2 raid: CIB and Anti-Human Trafficking Division find two girls aged 16–17 inside a health-massage-fronted establishment, operators charged with human trafficking and procuring child prostitution"
          >
            <p>
              This paper was updated thirty-eight minutes after the following was posted to <em>นวดไหนดี</em>. CIB officers, acting on online advertising intelligence and an undercover sting, raided an establishment on Rama 2 road, Bangkok. Two women — aged 51 and 37 — were arrested on charges of human trafficking and procuring child prostitution. Two girls, aged 16 and 17, were found inside, prepared to provide sexual services under a <em>นวดเพื่อสุขภาพ</em> (health massage) cover story.
            </p>
            <p>
              The case confirms every structural argument this paper has made, and then goes one step further. The alibi structure (Section II) was present: <em>นวดเพื่อสุขภาพบังหน้า</em> — health massage as a front — is the paper's central exhibit, now documented in a criminal indictment. The online advertising pipeline (Section VI) was the detection mechanism: officers found the establishment through its own promotion on digital platforms. The operators were not male pimps but two women — operators, not workers, which the paper's circular flow diagram (Section III) models as a distinct node in the rent-extraction chain.
            </p>
            <p>
              And then the case departs from everything else in this paper: the two people found inside were <strong>sixteen and seventeen years old</strong>. They were not making the LV Index calculation (Economy tab, Section XVI). They were not sending katanyu remittances to their parents. The rational-choice framework that this paper has applied to the adult workers documented in the corpus does not apply to them, because the concept of rational labor choice requires that the chooser be in a position to refuse. The corpus cannot see this case at all: the open Telegram channels this system monitors are not where a trafficker advertising minors would post. <strong>The corpus shows the most legible end of the market. This case is the end the corpus is structurally blind to.</strong> Both are true simultaneously. Neither cancels the other.
            </p>
          </LiveCaseCallout>

          <p className="paper-coda">
            The machine has finished reading. The reading has barely begun.
          </p>
        </section>

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
            <li>Pantip.com community forums (2020). Anonymous user testimony, topic/38529177 — first-person demand-side account of escalation mechanics in the grey massage market. Public forum post, Thailand.</li>
            <li>Pantip.com community forums (n.d.). BeamSensei (pseudonym). Topic: ประสบการณ์นวดน้ำมันครั้งแรกในชีวิต [First oil massage experience]. Inner Spa, Bang Yai. Public forum post, Thailand. — Cited as structural contrast: สายขาว (white-line) oil massage.</li>
            <li>Pantip.com community forums (n.d.). Anonymous user testimony, topic/39711381 — "How can you tell if a regular massage shop has special services?" — cited as evidence of alibi's effectiveness against unwilling consumers.</li>
            <li>Pantip.com community forums (n.d.). Anonymous user testimony, topic/38519086 — male client assaulted by male masseuse at a legitimate Thai massage shop; cited for bidirectional vulnerability analysis.</li>
            <li>นพ. กิตติพัชญ์ รัศมีจารุกิตติ์ / Reverie Clinic (2024). "นวดกษัยเห็นผลจริงไหม ทำแล้วกลับมาแข็งจริงรึเปล่า?" [Does Karsai massage really work? Does it actually improve erectile function?]. reveriebkk.com. <em>Category: UPSIZE | สุขภาพเพศชาย.</em></li>
          </ul>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: GLOBAL PHENOMENA & RIGHTS — Kabuki-cho, Amsterdam RLD, Tua      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`paper-tab-panel${activeTab === 'global' ? ' is-active' : ''}`}>
        <section className="paper-sec">
          <span className="paper-num">X</span>
          <h2 className="paper-h">Global Comparative Typology: Tokyo, Amsterdam, and Bangkok</h2>
          <p className="paper-lead">
            The digital transition of informal entertainment and bodywork services is not an isolated Thai phenomenon. It is a global structural shift driven by urban enforcement friction, municipal regulation, and the universal adoption of encrypted mobile messaging. Across major metropolitan hubs, informal markets adapt to local policing by moving from physical street touting to digital broadsheet networks.
          </p>

          <GlobalPhenomenonDiagram />

          <p className="paper-lead">
            In <strong>Tokyo's Kabuki-cho (Shinjuku)</strong>, physical <em>Muryo Annaisho</em> (free information booths) historically brokered nightlife referrals. Following strict enforcement of Japan's <em>Fueiho</em> (Entertainment Business Law) and crackdowns on street touting (<em>kyobatta</em>), operators migrated their real-time advertising onto X (Twitter), LINE official accounts, and Telegram broadsheets. In <strong>Amsterdam's De Wallen (Red Light District)</strong>, the 2000 legalisation framework recognized sex workers as self-employed sole traders (<em>ZZP-ers</em>). However, municipal window license reductions under "Project 1012" and proposals for a centralized Erotic Centre pushed independent operators toward private web directories and encrypted booking channels.
          </p>
          <p className="paper-lead">
            Bangkok's market represents a third configuration: a dual economy where <strong>UNESCO-recognized *Nuad Thai*</strong> (Traditional Thai Massage) coexists alongside grey-market wellness parlours that utilize real-time Telegram broadsheets to maintain high-velocity urban discovery without formal directory exposure.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XI</span>
          <h2 className="paper-h">Worker Rights, Labor Protection, and GAATW / ILO Frameworks</h2>
          <p className="paper-lead">
            A central flaw in prohibitionist discourse is the conflation of voluntary informal labor with human trafficking. International human rights organizations—including the <strong>Global Alliance Against Traffic in Women (GAATW)</strong> and the <strong>International Labour Organization (ILO)</strong>—emphasize that criminalising informal bodywork exacerbates worker vulnerability, degrades safety, and denies workers legal recourse against violence or wage theft.
          </p>
          <p className="paper-lead">
            In Thailand, informal massage workers operate outside the formal Social Security Section 33 safety net. Most rely on voluntary Section 40 registration, which provides minimal medical coverage but zero unemployment protection. By operating within grey-market parlours, workers gain economic autonomy (earning 3–4× the daily minimum wage of ฿370) while enduring systemic legal insecurity under the 1996 Prostitution Suppression Act.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XII</span>
          <h2 className="paper-h">The Grey Economy and Police Oversight ("Tua" Protection Fee System)</h2>
          <p className="paper-lead">
            The grey massage economy in Bangkok does not exist in opposition to law enforcement; it exists in a state of negotiated equilibrium with local precinct inspectors (*Nok Phra*).
          </p>

          <GreyEconomyPoliceFlowDiagram />

          <p className="paper-lead">
            Establishments pay monthly informal protection fees—known locally as <strong>"Tua" (tickets)</strong>—ranging from ฿5,000 to ฿50,000 per month depending on venue size, staff volume, and district location density. In exchange, local precincts maintain informal tolerance, reserving formal enforcement raids for un-ticketed venues, minor involvement cases, or high-profile operations led by the Anti-Trafficking in Persons Division (ATAPD).
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XIII</span>
          <h2 className="paper-h">Regulatory Alibis: Health Establishment Act (2016) vs Prostitution Act (1996)</h2>
          <p className="paper-lead">
            The legal alibi of the Bangkok market relies on a statutory statutory contradiction between the <strong>Prevention and Suppression of Prostitution Act (B.E. 2539 / 1996)</strong> and the <strong>Health Establishment Act (B.E. 2559 / 2016)</strong> administered by the Ministry of Public Health.
          </p>
          <p className="paper-lead">
            Parlours register formally as health wellness spas or traditional Thai massage venues under the 2016 Health Act. This registration grants the venue a legal business license and commercial legitimacy, while the informal service split takes place privately behind closed treatment room doors—shielding both operator and client under the statutory alibi of therapeutic bodywork.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XIV</span>
          <h2 className="paper-h">The Platform as Public Value</h2>
          <p className="paper-lead">
            The ultimate purpose of the Sabai Sabai platform is to convert hidden broadsheets into transparent, empirical public intelligence. By providing objective data on pricing, geographic density, and operator ad frequency at zero marginal cost, the platform equips researchers, advocates, and policymakers with the empirical tools necessary to advance worker rights and policy reform.
          </p>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: ORIGIN — the experiment, methodology, zero-hardware thesis     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`paper-tab-panel${activeTab === 'origin' ? ' is-active' : ''}`}>

        <section className="paper-sec">
          <span className="paper-num">X</span>
          <h2 className="paper-h">The Experiment, or: Can Bots Read a Community?</h2>
          <p className="paper-lead">
            The founding question was not about massage. It was a hypothesis in information science with the modest ambition of being put at personal risk of being disproved. The hypothesis: a single person, owning no hardware, without a team, and without institutional sanction, could build a real-time intelligence platform from community-generated data — solely by configuring publicly available cloud services to point at each other. To test it, the domain needed to be the right kind of wrong: commercially significant, informationally rich, publicly ignored, and structurally ungoverned enough that the gap between what the community knew and what the public could access was large and visible.
          </p>
          <p className="paper-lead">
            The massage channel community satisfied all four criteria simultaneously. It was commercially significant: tens of thousands of operators, millions in daily transaction volume, a major informal employment sector for migrant and domestic labour. It was informationally rich: each post contained, in principle, the same structured fields — name, phone, hours, price, services, photos. It was publicly ignored: no Yelp, no TripAdvisor, no aggregation layer that the formal economy had been willing to build. And it was ungoverned: operating in a legal and social space so ambiguous that no institution had claimed the right to systematise it.
          </p>
          <p className="paper-lead">
            The massage parlour, then, is the proof-of-concept not despite being uncomfortable, but partly because of it. A system that reads this community reads any community. The question was whether it could read at all.
          </p>

          <div className="paper-stats-row">
            <div className="paper-stat-cell">
              <span className="paper-stat-val">{fmt(corpus.totalMessages)}</span>
              <span className="paper-stat-label">Messages read</span>
            </div>
            <div className="paper-stat-cell">
              <span className="paper-stat-val">{corpus.channels}</span>
              <span className="paper-stat-label">Source channels</span>
            </div>
            <div className="paper-stat-cell">
              <span className="paper-stat-val">฿0</span>
              <span className="paper-stat-label">Monthly infrastructure cost</span>
            </div>
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XI</span>
          <h2 className="paper-h">Why This Domain, Specifically</h2>
          <p className="paper-lead">
            Three criteria determined the domain selection. They are listed here in decreasing elegance, because the third is simply an admission.
          </p>
          <p className="paper-lead">
            <strong>First: data volume.</strong> Communities talk most about what they care about most. The massage channel community posts continuously, at high volume, across multiple platforms — a signal-to-noise ratio amenable to machine extraction. A system that requires ten thousand examples to develop statistical validity found ten thousand examples in its first week. The corpus grew to {fmt(corpus.totalMessages)} records without any manual data collection effort. This is not trivial: most academic corpora of informal markets are built through years of fieldwork and produce hundreds of observations. The Telegram channel produced a longitudinal dataset at scale that participant observation could not.
          </p>
          <p className="paper-lead">
            <strong>Second: structured information.</strong> Each post contains, in principle, the same fields: business name, phone, hours, price, services, photos. The variation is superficial; the schema is stable. An AI extraction prompt trained on fifty examples generalises reliably across ten thousand because the underlying structure of a service advertisement is largely invariant: who, what, where, when, how much. The domain was chosen partly because its data was schematically regular.
          </p>
          <p className="paper-lead">
            <strong>Third: the obvious gap.</strong> The market existed at a scale that formal directories refused to acknowledge. This meant it had no aggregation layer. The gap between what the community knew — exactly who was open, at what price, in which location, at this moment — and what any external observer could access was the gap that information architecture exists to fill. Building the aggregation layer was simultaneously a technical demonstration and an argument about what technical demonstrations can do.
          </p>
          <div className="paper-quote">
            <p>The right domain for a proof-of-concept is one that most people avoid systematising — not because the data isn't there, but because the act of systematising it forces a position that most institutions prefer not to take.</p>
            <cite>— author's working notes, 2024</cite>
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XII</span>
          <h2 className="paper-h">The Stack: Zero Hardware, Zero Cost</h2>
          <p className="paper-lead">
            The system runs on five services. Every service is free at the scale of this project. None of them is owned by the author. The combined monthly cost is ฿0 — not metaphorically free, not "free tier with upsell pressure," but genuinely, at current usage, zero. This is worth stating flatly, because the implications are not trivial.
          </p>

          <div className="paper-arch-grid">
            <div className="paper-arch-cell">
              <span className="paper-arch-cell-label">Telegram</span>
              <p>12 channels monitored every 30 seconds via the MTProto API. Public channels, no special access required. The data source generates its own archive.</p>
            </div>
            <div className="paper-arch-cell">
              <span className="paper-arch-cell-label">Google Gemini AI</span>
              <p>Extracts structured fields (name, phone, hours, price, services, location) from unstructured text. Adds description, quality assessment, service classification. Free at this project's volume.</p>
            </div>
            <div className="paper-arch-cell">
              <span className="paper-arch-cell-label">Supabase</span>
              <p>PostgreSQL database for structured listings. Object storage for photos. Real-time subscription layer for live dashboard updates. Analytics tables for temporal data. Free tier.</p>
            </div>
            <div className="paper-arch-cell">
              <span className="paper-arch-cell-label">Cloudflare Pages</span>
              <p>Global CDN serving the React/Vite frontend. Zero-downtime deployments. Edge caching. Supports the live dashboard and this research paper. Free tier.</p>
            </div>
            <div className="paper-arch-cell">
              <span className="paper-arch-cell-label">Google Sheets</span>
              <p>Spreadsheet backup via Apps Script. Hourly BI refresh. Data warehouse for operators without database access. Always available for export.</p>
            </div>
            <div className="paper-arch-cell">
              <span className="paper-arch-cell-label">Google Drive</span>
              <p>Photo archive backup. Separate from Supabase storage. Redundant, searchable, shareable. Ensures no media is lost if any single service changes its free tier terms.</p>
            </div>
          </div>

          <p className="paper-lead">
            The implications are not trivial. This is a functioning intelligence platform — real-time data pipeline, AI enrichment, deduplication, content screening, geographic display, analytics, research paper — running on the financial infrastructure of a student's side project. The total capital required to build and operate it indefinitely is the cost of a domain name and the developer's time.
          </p>
          <p className="paper-lead">
            What this means for information access in emerging economies is the argument this paper cannot quite finish. The surveillance infrastructure of a small government department can be built by one person in three months on a free account. The open question is not whether this is possible — the dashboard you are reading is the evidence that it is. The open question is who does it next, for what domain, and in whose interest.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XIII</span>
          <h2 className="paper-h">Computational Ethnography: Reading Without Presence</h2>
          <p className="paper-lead">
            Traditional ethnography demands presence. The researcher enters the field — physically, socially, temporally. She acquires the accent. She learns who to ask and what not to say. Her data carries the texture of proximity. The Malinowski protocol — extended immersion, the tent in the village — assumes that proximity produces knowledge that distance cannot, which is true in one direction and false in another.
          </p>
          <p className="paper-lead">
            Computational ethnography inverts the assumption. The researcher is absent, and the field generates its record without the observer effect. The {fmt(corpus.totalMessages)}-message corpus was produced entirely without this paper's existence: a community communicating with itself, logging its own operations at scale, creating a data trail it neither intended as research material nor suspected would be read this way. The advantages are real. Sample sizes that fieldwork cannot achieve — six years, {fmt(corpus.totalMessages)} messages, {corpus.channels} channels, thousands of operators. Temporal data that interviews cannot recover — the exact posting rhythm, the exact repeat pattern, the statistical fingerprint of a market's daily anxiety. The pattern in Figure 2 — that anxiety-clock shape, peaking at opening hour — is visible only at scale. No interview would surface it.
          </p>
          <p className="paper-lead">
            The disadvantage is equally real: no voice, no face, no account of experience from the inside. This paper knows what the market says. It does not know what it feels like to be the market. Salganik (2018) frames this as a deliberate trade: digital trace data gives us scale and non-reactivity at the cost of richness and context. This paper makes the trade explicitly, and without apology. The richness was not on offer. The scale was.
          </p>
          <p className="paper-lead">
            There is also an ethics embedded in the method. Every post in this corpus was made publicly, to an open Telegram channel, by someone advertising a commercial service. No private messages were accessed. No identities were revealed. The research paper goes further: it redacts every traceable identifier in the plates (Section II), a performed ethics that the directory pages — where the same identifiers are fully legible, as advertised — do not observe. The researcher is owed no more privacy than the subject, which is to say: the same privacy the subject chose to extend to the public.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XIV</span>
          <h2 className="paper-h">The Accidental Research Paper</h2>
          <p className="paper-lead">
            The dashboard was built to do something else. The original goal was to prove a hypothesis about zero-hardware community intelligence platforms — to demonstrate that the architecture worked, that the pipeline could run, that the dashboard could display real-time data from a domain nobody had systematised. The research paper was not planned.
          </p>
          <p className="paper-lead">
            It emerged from the data. Once the corpus reached 50,000 messages, patterns that no individual post contained became visible in the aggregate. The repeat rate: {repeat.repeatRate}%. The lexicon of the threshold: room, oil, aroma, shower, assembled as a coded vocabulary that says everything and admits nothing. The absence of Burmese and Cambodian labels in a corpus from a city with three million irregular Burmese migrants. The anxiety clock: the daily peak at opening hour, shaped exactly like fear of an empty house. None of these were research questions. They were answers to questions nobody had thought to ask yet.
          </p>
          <p className="paper-lead">
            The paper is the evidence that the hypothesis was not quite right. The hypothesis was: I can build an intelligence platform. The evidence is: intelligence platforms, once built and fed, do not just answer questions you had. They generate questions you didn't. The database knew this market was running a repeat-compulsion engine before the researcher could name the observation. The database knew the alibi price was ฿{pricing?.median ?? '—'} before the researcher understood why that particular number was selected. The data preceded the analysis; the analysis followed, somewhat sheepishly, trying to catch up.
          </p>
          <p className="paper-lead">
            This is the sense in which the paper is accidental, and the sense in which it is not. The choice of domain was deliberate — the kind of domain that most data scientists avoid systematising. The architecture was deliberate — designed to generalise to any domain. The analysis that emerged from the data was not deliberate; it was what the data said when you listened to enough of it. The paper is the record of a machine that read {fmt(corpus.totalMessages)} messages and noticed what the community could not help but reveal about itself.
          </p>
          <p className="paper-coda">
            The accidental paper is the most honest kind.
          </p>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: ECONOMY — women's calculus, male suppression, policy           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`paper-tab-panel${activeTab === 'economy' ? ' is-active' : ''}`}>

        <section className="paper-sec">
          <span className="paper-num">XV</span>
          <h2 className="paper-h">The Wage-Gap Arithmetic</h2>
          <p className="paper-lead">
            Thailand's 2024 minimum daily wage is ฿370 in Bangkok — among the highest in the country and the result of sustained political pressure from labour unions over the preceding decade. A month of full-time minimum-wage work produces, before deductions, roughly ฿7,770 in gross income. Bangkok's average studio apartment costs ฿6,000–10,000 per month. After rent, a minimum-wage worker in Bangkok has between ฿-2,230 and ฿1,770 for food, transport, clothing, phone, and debt service. The arithmetic does not close. It has not closed for this income tier since at least 2008, and the structural gap has widened with every property cycle and energy price shock.
          </p>
          <p className="paper-lead">
            A single informal session — the baseline "add-on" documented in this corpus — nets the worker between ฿1,000 and ฿3,000 in direct payment, bypassing the parlour split entirely. The corpus median of ฿{pricing?.median ?? '1,875'} represents what customers name as the legitimate price; the informal supplement is not named, which means it is not in the data, which means every figure below this paragraph is a floor, not a ceiling. Five sessions per week at the median produces ฿30,000 per month — roughly four times the minimum wage gross, and sufficient to cover Bangkok rent and generate savings or remittances simultaneously. Ten sessions doubles that again.
          </p>

          <WageComparisonChart />

          <p className="paper-lead">
            The question this arithmetic raises is not moral. It is structural: when the gap between formal and informal wages is this wide, sustained over this long, enforced by housing costs this high, individual-choice explanations are insufficient. The aggregate pattern — tens of thousands of workers, persisting across economic cycles and multiple governments — is evidence of a structural, not personal, calculation. The worker who enters this economy is not making a mistake. She is solving an equation that the formal economy set and refuses to acknowledge.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XVI</span>
          <h2 className="paper-h">Aspiration, Instagram, and the Luxury Index</h2>
          <p className="paper-lead">
            The Bangkok service economy does not sell commodities. It sells visible distinction. The city's consumption culture has been structured, since at least the 1997 crisis produced a generation of aspirational deferred spending, around a luxury goods market disproportionate to its income level: Thailand ranks among the top luxury goods markets in Southeast Asia, with Bangkok maintaining one of the highest per-capita luxury store densities in the region. Social comparison operates at street level, in the Instagram feed, in the friend group that can afford the Saturday dinner reservation and the one that cannot.
          </p>
          <p className="paper-lead">
            For a young woman whose formal wage is ฿8,000 per month and whose peer group's visible consumption implies ฿30,000, the gap is not abstract. It has a brand name and a price tag. A Louis Vuitton Neverfull — the aspirational entry point, the bag that signals membership in the Bangkok upper-middle class without requiring the actual upper-middle-class income — retails for approximately ฿80,000. At minimum wage, this represents roughly ten months of total gross income. At the informal median rate documented in this corpus, it represents approximately fifty sessions. That number — call it the <strong>LV Index</strong> — is not a statistic that appears in any formal analysis of Thailand's grey economy. It is, nonetheless, the number that governs individual calculations at the margin, because the margin is where decisions are actually made.
          </p>
          <p className="paper-lead">
            Arjun Appadurai (1990) argues that aspirations are not individual; they are social and cultural, distributed unequally across class positions such that those at the bottom have less practice at imagining futures than those at the top. What platforms like Instagram have done is universalise the aspiration while leaving the means structurally unequal. The effect is a gap that functions not as motivation in the positive sense — working harder, climbing higher — but as pressure in the lateral sense: seeking the shortest path from ฿8,000 to ฿80,000, where the shortest path is not through the formal economy.
          </p>
          <div className="paper-quote">
            <p>The insider's account — circulated in a private Telegram group with ten years of industry experience — puts the calculation plainly: workers have partners who accept the arrangement; the work is described as purely transactional; the money is spent on things the formal wage could not provide. This is not the description of a woman who cannot see her situation clearly. It is the description of a woman who can.</p>
            <cite>— composite of industry-insider testimony, translated from Thai</cite>
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XVII</span>
          <h2 className="paper-h">Worker Agency and the Rescue Industry's Blind Spot</h2>
          <p className="paper-lead">
            The western feminist literature on sex work divides, roughly, into two camps that have been arguing past each other since the 1980 World Conference on Women in Copenhagen. The abolitionist position holds that sex work is inherently exploitative; that no woman chooses it freely; that the conditions of patriarchy and economic inequality render consent structurally impossible. The sex-work-as-work position holds that agency should be presumed absent evidence of coercion; that labor rights are the appropriate regulatory frame; that distinguishing between consensual adult sex work and trafficking requires treating them as categorically different phenomena rather than a single continuum. The Thai corpus complicates both, in different directions.
          </p>
          <p className="paper-lead">
            The insider account documented in the analytics section of this platform describes a market in which 95% of workers maintain ongoing partnerships; partners are uniformly described as accepting of the arrangement; the emotional register of the work is transactional rather than traumatic; and the income is explicitly allocated to consumer goods and family remittances. This is not the rescue industry's narrative. It is a description of rational labor choice under conditions of wage stagnation and filial obligation, made by women with full awareness of the tradeoffs.
          </p>
          <p className="paper-lead">
            Laura Agustín (2007) calls the rescue industry a moral panic in reverse: it locates agency and intention in the rescuers while systematically denying it to the people being rescued. The Bangkok massage corpus reads like exhibit A. The market is not populated by women who cannot see their situation. It is populated by workers who see their situation clearly and have made calculations that others find, for various reasons, uncomfortable to acknowledge as calculations at all.
          </p>
          <p className="paper-lead">
            The fundamental distinction — which the abolitionist position conflates and the sex-work-as-work position sometimes underweights — is between structural coercion and individual agency operating within structurally coercive conditions. A woman who enters this market because the minimum wage does not cover Bangkok rent is not making a free choice in any absolute sense. She is also not making a coerced choice in the sense that trafficking researchers mean when they use that word. She is making the kind of choice that most people make most of the time: a rational response to a constrained option set, where the constraints were not of her choosing and the options were not freely offered. Treating this choice as either fully free or fully coerced misreads the situation. Both misreadings protect the person who misreads rather than the person who chose.
          </p>

          <LiveCaseCallout
            date="9 June 2026"
            source="ข่าวสด / นวดไหนดี"
            headline="The distinction this section depends on — drawn in real time, on the same day it was written"
          >
            <p>
              On the same day this section was written, CIB officers raided a Rama 2 establishment and found two girls aged 16 and 17, prepared to provide sexual services under a health-massage cover. Two female operators — aged 51 and 37 — were charged with human trafficking and procuring child prostitution.
            </p>
            <p>
              This case is not in this paper's corpus. The open Telegram channels this system monitors are not where an operator advertising minors would post. The corpus reads the market's legible surface. This case is what lies beneath it — and the distinction matters enormously for this section's argument.
            </p>
            <p>
              This paper has argued against the rescue industry's reflex to treat adult workers who see their situation clearly as trafficking victims in need of rescue. That argument stands for the adult workers documented in this corpus. It does not extend to the two girls on Rama 2. They were not making the LV Index calculation. The operator made it for them. <strong>The fundamental distinction that the rescue industry collapses in one direction — treating consenting adults as trafficking victims — cannot be collapsed in the other direction either.</strong> The Rama 2 minors are not rational-choice workers who have been misread. They are trafficking victims who deserve exactly the rescue narrative that the adult worker does not.
            </p>
            <p>
              Both cases coexist in the same city, on the same road, behind the same alibi structure — separated by age, by consent, and by a legal and ethical distinction that research is obliged to preserve even when it is inconvenient for whichever prior argument the researcher has been building.
            </p>
          </LiveCaseCallout>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XVIII</span>
          <h2 className="paper-h">What Men Want, and Why the Prohibition Produces It</h2>
          <p className="paper-lead">
            The demand side of this market is structurally misread in both the moral and policy literature. The conventional framing — men want sex; prohibition attempts to suppress this want; the gap between want and prohibition generates the underground market — is incomplete in a dimension that becomes visible when the corpus is read from the demand side rather than the supply side.
          </p>
          <p className="paper-lead">
            The data does not show a market of last resort. It shows a market of preference, habit, and equilibrium. Customers ask to book {queries.bookingToPriceRatio}× more often than they ask the price — a ratio that implies the transaction has already moved from conditional to decided before the conversation begins. The temporal pattern of demand messages mirrors the supply pattern: morning peak, lunch secondary, evening sustained. This is a habituated behavioral pattern, not a desperation pattern. The market is not running on suppressed need that occasionally breaks through. It is running on a stable, normalised, institutionalised practice that the society has arranged to pretend does not exist.
          </p>
          <p className="paper-lead">
            Foucault's point — that the repressive hypothesis fundamentally misreads the production of sexuality, that power operates through sexuality rather than against it — applies here with a precision that the original argument did not fully specify. Prohibition does not suppress demand. It <strong>organises</strong> demand into the particular form it takes. The coded vocabulary, the alibi price, the massage uniform as moral shield, the migrant labor supply chain at the base of the market stack — all of these are products of prohibition, not defiances of it. The market exists in precisely the form it takes because of the regulatory environment that surrounds it. Without prohibition, the market would be different. It would not be absent.
          </p>
          <p className="paper-lead">
            The suppression argument has a version that addresses modern conditions specifically. In post-industrial, post-feminist East Asian urban environments — Bangkok, Seoul, Tokyo, Taipei — a specific pressure operates on male sexuality that the earlier literature did not anticipate: the combination of rising female economic independence, declining marriage rates, increased social scrutiny of male behavior, and the consequent contraction of normalised sexual outlet. The birth rate data from these cities suggests a generational behavioral shift of significant magnitude: Bangkok's fertility rate is among the lowest in Southeast Asia; Japan's sōshokukei danshi ("herbivore men") phenomenon; South Korea's sampo generation (abandoning dating, marriage, children). Whether this shift reflects genuine preference change or suppressed preference is not a question the data can answer. That the underground market has not declined in correspondence with these cultural shifts is, at minimum, suggestive.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XIX</span>
          <h2 className="paper-h">Four Policy Frameworks and What the Evidence Says</h2>
          <p className="paper-lead">
            Four dominant regulatory approaches have been applied to markets of this kind across different jurisdictions over the past three decades. The evidence on outcomes is imperfect, contested, and politically inconvenient in different directions for each position. It is nonetheless better than the absence of evidence that characterises most Thai policy discourse on this topic, and it deserves to be read.
          </p>

          <PolicyTable />

          <p className="paper-lead">
            The evidence from New Zealand's 2003 Prostitution Reform Act — the most comprehensively evaluated decriminalisation — is not that demand increased after legalisation. The Prostitution Law Review Committee's 2008 report, and the independent review at twenty years, found no measurable increase in the total number of sex workers, no increase in trafficking cases, and significant improvements in worker safety and healthcare access. Workers reported higher rates of reporting violence to police; employers reported higher rates of compliance with health regulations. The primary negative outcome was that undocumented migrant workers remained outside the legal framework and therefore outside its protections — which is not an argument against decriminalisation, but an argument about the limits of what any domestic regulatory framework can achieve without immigration reform.
          </p>
          <p className="paper-lead">
            Thailand's own evidence is the most compelling Thailand-specific data point, and it is almost never cited in this context. The 100% Condom Programme, implemented 1989–2001 under the Mechai Viravaidya initiative with WHO and UNFPA backing, reduced STI rates by over 90% over its operational period. It did not criminalise supply or demand. It worked by operating <em>with</em> the market rather than against it: using the licensing chain (registration with district administration, ส่งปกครองอำเภอ) as a distribution and enforcement mechanism for public health. Licensed establishments were required to provide condoms; workers were required to use them; the licensing registration was the leverage point. The system worked precisely because it acknowledged the market's existence and used its existing institutional structure rather than attempting to suppress it.
          </p>
          <p className="paper-lead">
            When the programme was discontinued under political pressure in the early 2000s, STI rates began to rise again. This is the kind of evidence that policy discourse finds difficult to process, because processing it requires acknowledging what the programme's existence acknowledged: that the market is real, stable, and best addressed through engagement rather than prohibition. The acknowledgement is the cost. The 90% STI reduction is the return.
          </p>
          <p className="paper-coda">
            The evidence is not the obstacle. The obstacle is what acknowledging the evidence requires admitting.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XX</span>
          <h2 className="paper-h">What the Surveillance Data Says Now</h2>
          <p className="paper-lead">
            The engagement-based framework developed in Section XIX has a test it cannot avoid: what happens to the public health indicators when the framework is implemented, and what happens when it is abandoned. The data on this question exists, and it is, in the most literal sense, a before-and-after experiment conducted on the population of Thailand over the past four decades.
          </p>
          <p className="paper-lead">
            The 100% Condom Programme era — 1989 to 2001 — produced the most comprehensive STI reduction data in any Southeast Asian country. Sexually transmitted infection rates among sex workers and their clients fell by over 90 percent during the programme's operational period. Syphilis seroprevalence, gonococcal infection, and chlamydia incidence all declined to levels comparable to those in countries with formalised, regulated sex work. The intervention did not criminalise supply or demand. It operated <em>with</em> the institutional structure of the market — district-level licensing registration (ส่งปกครองอำเภอ) as the distribution and enforcement channel — and used that structure to make condom use the path of least resistance. The licensing chain was the leverage point. Compliance was the outcome. The 90 percent reduction was the return.
          </p>
          <p className="paper-lead">
            When the programme was discontinued under political pressure in the early 2000s, STI rates began to rise. Thailand's Division of Communicable Disease Control surveillance data documents steady increases in syphilis, gonorrhea, and chlamydia incidence across the subsequent two decades. The reversal was not instantaneous — it was structural, accumulating as the engagement infrastructure was dismantled and the licensing leverage disappeared. The MOPH epidemiological surveillance reports describing this reversal are published annually and rarely cited in the policy discourse on the topic they describe.
          </p>
          <p className="paper-lead">
            The global picture is consistent. The World Health Organization's 2024 report on sexually transmitted infections documented what it termed "a concerning global surge" across four pathogens: syphilis (with documented resurgences in multiple countries, including congenital syphilis, after years of decline), gonorrhea (with rising minimum inhibitory concentrations against last-line antibiotics and increasing reports of extensively drug-resistant strains, classifying <em>Neisseria gonorrhoeae</em> as a priority pathogen), chlamydia (the most commonly reported bacterial STI globally, with consistent year-over-year increases across the WHO European Region, the Americas, and the Western Pacific), and trichomoniasis. The US Centers for Disease Control and Prevention's parallel surveillance reports describe the same trend in US data. The European Centre for Disease Prevention and Control reports describe the same trend in European data. The Mpox public health emergency of 2022–2024 demonstrated a related phenomenon: the surveillance gap between the populations most at risk and the institutional mechanisms for monitoring risk in those populations. The Mpox response was, in operational terms, an improvised engagement exercise — public health authorities working <em>with</em> informal community networks, gay and bisexual men's health organisations, sex worker advocacy groups — because the formal surveillance systems had no signal in the populations where the outbreak was first detected.
          </p>
          <p className="paper-lead">
            The pattern across these data points is not a moral argument. It is a measurement observation: engagement-based public health produces measurable reductions in disease burden. Suppression-based public health produces measurable rebounds. The data exists, has existed for decades, and the institutional response to the data has been to update the presentation of the data without updating the policy implications of the data.
          </p>
          <p className="paper-lead">
            There is, however, a layer underneath the policy disagreement that this paper is structurally required to address. The engagement-based approach requires data. The data requires surveillance. The surveillance requires, at minimum, a working signal in the populations where the disease burden sits. The current surveillance architecture in Thailand — and in most countries with comparable informal-market structures — has the formal reporting chain (public hospitals, district health offices, MOPH epidemiological reports) but lacks the informal-market signal. The listings that constitute the corpus of this paper — their pricing, their hours, their channel of communication, their geographic distribution, their temporal patterns — are a partial mirror of the population the surveillance system needs to reach. The mirror is incomplete: it captures supply; it does not directly capture health outcomes. But the supply-side mirror is the necessary input to a working engagement intervention, and the cost of producing that mirror is now low enough that the reason it does not exist is not economic.
          </p>
          <p className="paper-lead">
            The architecture of the platform described in this paper does not need modification to address this question. The same Telegram channels, the same AI extraction layer, the same deduplication logic, the same real-time subscription system — applied to a different set of public health signals (clinic postings, anonymous STI screening announcements, community outreach channel activity, anonymous sexual health hotline transcripts) — would produce a working engagement-side surveillance layer at the same marginal cost. The pivot is not from commerce to public health. The pivot is <em>into</em> the question the engagement framework is supposed to address. The pivot requires, in engineering terms, approximately one working day. The pivot produces a class of intelligence that does not currently exist in any institutional data system.
          </p>
          <div className="paper-coda">
            <p>The surveillance infrastructure question is the one the engagement-based framework is required to answer. The cost of answering it is now low. The question is who builds it, and on whose terms.</p>
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXX</span>
          <h2 className="paper-h">The Service Layer, and What the Reporting Gap Reveals</h2>
          <p className="paper-lead">
            Section XX ended on a question about who builds the engagement-side layer. This section is the answer in its smallest honest form, because the question stopped being theoretical: two social workers who track HIV in this sector asked what the platform could tell them that they did not already have. The answer was, at that moment, nothing. The health page held a single national series — new HIV cases entering care by province of domicile, Buddhist year 2566 — which is a real number about a real epidemic and is useless for the thing a social worker does on a Tuesday afternoon. It says where cases surfaced two years ago. It does not say where a person can be tested this week, who runs outreach in that province, or whether anyone is running outreach there at all.
          </p>
          <p className="paper-lead">
            That question has an answer in the open data, and the answer had simply not been assembled. Thailand's Ministry of Public Health publishes service-delivery returns under the 43-folder health information standard, and the Department of Disease Control publishes a register of the volunteers and civil-society organisations accredited to work on HIV. Five of these series were joined for this paper: laboratory results (LABFU-HIV), screening and treatment for sexually transmitted infections, support for correct condom use, voluntary counselling with testing and antiretroviral referral, and the civil-society register. Four of the five carry an <code>areacode</code> — a Ministry of Interior geographic code whose leading digits are the province — which means they can be joined to the case series and to venue density without any geocoding step and without any inference. The most recent complete year for all five is Buddhist 2568. The case series most recently published is Buddhist 2566. The service side of the Thai health system is, in published form, two years ahead of the case side.
          </p>
          <p className="paper-lead">
            The assembled figures for Buddhist 2568 are these: 187,882 people had an Anti-HIV test recorded across 810 reporting facilities; 1,251 of those results were positive, a testing yield of 6.66 per thousand. Every one of the 77 provinces filed a return for condom-use support. Seventy-six filed for STI screening and treatment. Twenty-seven filed for voluntary counselling and testing. Not one province reported a single person referred onward to antiretroviral treatment through that channel — the field exists in the schema, it is defined in the data dictionary, and it is empty nationwide.
          </p>
          <p className="paper-lead">
            That last sequence is the finding, and it should be read carefully, because the tempting reading is wrong. It does not mean nobody in Thailand started treatment in 2568; the national treatment programme is large, well documented, and works through other reporting channels. What the sequence measures is which interventions the reporting system is built to capture. Condom support is counted everywhere. Testing with counselling is counted in roughly a third of provinces. The referral into treatment — the step that converts a positive result into a treated person, and the only step in the chain that costs real money over years — is counted nowhere in this series. The instrument is most complete where the intervention is cheapest and disappears entirely where the intervention is most expensive. A metric regime shaped this way will reliably report success at the top of the funnel while remaining structurally blind to whether anyone reached the bottom of it.
          </p>
          <p className="paper-lead">
            The civil-society register carries a second finding of the same kind. Eight hundred and seventy-three registrations are recorded across fifty provinces. Twenty-seven provinces have none — no accredited organisation, no registered volunteer. Several of those provinces carry advertised venue activity in this platform's own inventory. Where a province has venues and no registered organisation and no counselling-and-testing return, a referral chain does not exist to be used; it has to be built. That is a different operational problem from a thin one, and until these three series were placed beside each other there was no cheap way to tell the two apart.
          </p>
          <p className="paper-lead">
            The limits have to be stated as plainly as the findings. A facility that filed no return is invisible in this data, so a low count is evidence about reporting before it is evidence about service, and it is never evidence that a population does not need care. The testing yield is a programme measure — positives among people who were tested, in records where a result was captured — and it is not prevalence, not incidence, and not a statement about any venue, any worker, or any client. Venue counts derive from public advertising and are a floor on advertised supply rather than a register of businesses. Placing venue density beside service volume produces a prompt to look, not a finding about risk, and the distinction is the whole ethical load-bearing wall of this section.
          </p>
          <p className="paper-lead">
            What the exercise demonstrates is narrower than the pivot described in Section XX and more useful than the argument for it. No new collection was required. No new instrument was deployed. Nobody was surveyed, tracked, or identified. Five files that the Thai state already publishes were joined on a code the Thai state already assigns, and the result answers an operational question that neither file answers alone — which is the same claim this platform makes about Telegram, applied to open government data instead. The cost was an afternoon. The reason it had not been done is not that it was hard or expensive. It is that assembling it requires someone to hold the case series, the service returns, the civil-society register, and the supply-side mirror in one view at the same time, and no institution is organised to do that.
          </p>
          <div className="paper-coda">
            <p>The state already publishes where the service is. It publishes where the cases were, two years later. It does not publish the two together, and the gap between them is where a social worker actually stands.</p>
          </div>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PLATFORM — fungibility, OTOP, zero-marginal-cost thesis        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`paper-tab-panel${activeTab === 'platform' ? ' is-active' : ''}`}>

        <section className="paper-sec">
          <span className="paper-num">XXI</span>
          <h2 className="paper-h">The Pipeline That Doesn't Know Its Domain</h2>
          <p className="paper-lead">
            The system that produced this paper has five stages. Telegram sources deliver raw messages. A deterministic text parser identifies structured fields — name, phone, hours, price, photos. A Gemini AI call enriches, classifies, and describes. A deduplication engine consolidates by phone number, then name similarity. A React frontend displays the result. At no point in this sequence does any component contain a value — a hardcoded string, a model weight, a database constraint — that refers specifically to massage.
          </p>
          <p className="paper-lead">
            The domain knowledge lives exclusively in two locations: the choice of which Telegram channels to monitor, and the construction of the AI extraction prompt. Change both, and the system becomes something else overnight. The architecture does not merely permit pivots; it was designed without a domain, given one temporarily for demonstration purposes, and awaits the next domain with its pipeline intact.
          </p>

          <PlatformPivotDiagram />

          <p className="paper-lead">
            This is not an architectural accident. It is the central argument. The system was built this way because the question it was designed to answer was never "what can I learn about massage parlours?" The question was: "can a single person build a real-time community intelligence platform for any domain, at zero marginal cost, using only AI services and free-tier cloud infrastructure?" The massage directory is the proof. The proof is the platform.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXII</span>
          <h2 className="paper-h">OTOP: One Tambon, No Discovery Layer</h2>
          <p className="paper-lead">
            Thailand's One Tambon One Product (OTOP) programme, launched in 2001 under Prime Minister Thaksin Shinawatra following the model of Japan's One Village One Product (OVOP) movement, identifies a signature product for each of Thailand's approximately 7,700 sub-districts (tambons) and provides production support, quality certification, and government procurement pathways. By 2024, the programme covers over 85,000 registered products across five categories — food, beverages, herbs, textiles, and decoratives — generating approximately ฿200 billion in annual sales through government-facilitated channels.
          </p>
          <p className="paper-lead">
            The programme has a supply problem solved. It does not have a discovery layer. OTOP products are sold through government-organised fairs held several times a year, dedicated physical stores in Bangkok and major airports, and a government website whose user experience reflects the institutional context of its construction. The organic highland Arabica producers in Na Haeo district, Loei province; the mudmee ikat silk weavers in Surin province whose technique requires months to learn and whose product appears in no international fabric publication; the nam prik fermented paste makers in Sakon Nakhon whose product has no English name and whose production window is seasonal — these communities communicate with each other. They post photographs. They describe their products, their harvest cycles, their minimum order quantities. The information exists, in exactly the form required to build a marketplace. It is not aggregated.
          </p>
          <p className="paper-lead">
            The intervention required is a set of Telegram channels (already partially existing, requiring discovery and curation), a modified extraction prompt (hours of domain-expert work), and the same display layer serving a different category schema. The massage analytics — daily temporal patterns, geographic concentration, repeat behaviour, pricing distribution — become agricultural supply chain intelligence: harvest calendars, seasonal supply peaks, production-capacity distribution, minimum-order clustering. The directory becomes a marketplace. The paper becomes an ethnography of Thai highland artisan networks.
          </p>
          <div className="paper-quote">
            <p>The question is not whether the architecture can do this. The question is who decides which community gets its intelligence platform, and in whose interest the decision is made.</p>
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXIII</span>
          <h2 className="paper-h">What Changes When You Pivot, and What Does Not</h2>
          <p className="paper-lead">
            A pivot from the massage directory to an OTOP producer marketplace requires, in engineering terms, four changes. Listed with effort estimates derived from the actual build time of the original system:
          </p>
          <p className="paper-lead">
            <strong>Source channels:</strong> substitute 12 massage aggregator channels with 12 OTOP producer channels. Channel discovery requires social research — identifying which Telegram groups Thai artisan producers actually use to communicate. Two to four hours of work, depending on domain familiarity.
          </p>
          <p className="paper-lead">
            <strong>AI extraction prompt:</strong> rewrite the extraction template to capture product category, harvest season, available quantity, production method, and minimum order instead of service type, availability window, and add-on pricing. The prompt is a single text block of approximately 400 words. Four to six hours to rewrite and test.
          </p>
          <p className="paper-lead">
            <strong>Display fields:</strong> replace the hours/price/service display with product/season/quantity/minimum-order display. The component structure is unchanged; the field names and labels are not. Six to eight hours.
          </p>
          <p className="paper-lead">
            <strong>Taxonomy:</strong> replace the four-tier regulatory classification (อาบอบนวด / สปา / นวดแผนไทย / ไซด์ไลน์) with the OTOP five-category classification (food, beverage, herb, textile, decorative) and any relevant sub-classifications. Two hours.
          </p>
          <p className="paper-lead">
            Total engineering time: approximately one working day. The pipeline architecture, the deduplication logic, the AI enrichment layer, the real-time subscription system, the photo handling pipeline, the database schema (minor field rename), the frontend component structure, the analytics methodology — all unchanged. The system does not resist the pivot. It was waiting for it.
          </p>

          <div className="paper-stats-row">
            <div className="paper-stat-cell">
              <span className="paper-stat-val">~1 day</span>
              <span className="paper-stat-label">Engineering time for full domain pivot</span>
            </div>
            <div className="paper-stat-cell">
              <span className="paper-stat-val">85,000+</span>
              <span className="paper-stat-label">OTOP registered products — currently undiscoverable</span>
            </div>
            <div className="paper-stat-cell">
              <span className="paper-stat-val">7,700+</span>
              <span className="paper-stat-label">Tambons with at least one signature product</span>
            </div>
          </div>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXIV</span>
          <h2 className="paper-h">Zero-Marginal-Cost Intelligence</h2>
          <p className="paper-lead">
            Jeremy Rifkin (2014) argues that the defining economic characteristic of the digital era is the collapse of marginal cost: the cost of producing and distributing one additional unit of information goods approaches zero once the fixed infrastructure is in place. Rochet and Tirole's canonical work on platform economics (2003) identifies the matching of fragmented supply with distributed demand as the fundamental value proposition of digital platforms — the reason Airbnb could become the world's largest accommodation provider without owning a single room, and why Uber became the world's largest taxi company without owning a car.
          </p>
          <p className="paper-lead">
            Both theses extend to informal community intelligence in a way that their authors did not fully anticipate. The marginal cost of adding a new Telegram channel to this system's monitoring is zero. The marginal cost of extracting and enriching one additional listing from that channel is the Gemini API call — currently zero at this project's volume, and declining as AI inference costs fall. The marginal cost of displaying that listing to the hundredth or the hundred-thousandth viewer is Cloudflare's CDN cost — currently zero. The system has crossed Rifkin's threshold: once built, it generates and distributes intelligence at zero marginal cost, which means it scales at the economics of information rather than the economics of service delivery.
          </p>
          <p className="paper-lead">
            The implication for institutional access to information is the argument this paper cannot quite finish but cannot avoid beginning. A government department that wants real-time intelligence about any informal market — agricultural supply chains, informal housing, street food economics, ride-share driver distribution — now faces a build cost that is orders of magnitude lower than any previous technological era would have allowed. The open question is not technical. It is about whether institutions that have benefited from information asymmetry — between what they know and what communities know about themselves — are willing to close the gap.
          </p>
          <p className="paper-lead">
            The single-operator, zero-hardware model is not a constraint of this system. It is its central argument. One person with a laptop, an internet connection, and several months of evenings has built a functioning real-time intelligence platform over a market that no institution has been willing to systematise. The tools are general. The willingness is particular.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXV</span>
          <h2 className="paper-h">Any Community That Talks Can Become a Platform</h2>
          <p className="paper-lead">
            The massage directory is a proof-of-concept. The proof: any community that communicates through a messaging platform about supply and demand — whether for services, goods, labour, or information — can be turned into a real-time intelligence platform at marginal cost approaching zero. The limiting factors are not engineering. They are judgment: identifying the right channels (social research), constructing the extraction prompt (domain knowledge), and deciding what a listing should contain (product design). None of these require institutional resources. All of them require understanding a community from the inside.
          </p>
          <p className="paper-lead">
            Thailand has approximately 7,700 tambons, 85,000 OTOP products, a highland coffee belt that has never been mapped by demand, a silk-weaving tradition that is largely invisible to the markets that would buy it, a community health network that runs on LINE groups and has no aggregation layer, a network of informal recycling collectors (salee) whose routing logic has never been systematised. Each of these communities talks. Each generates structured information in the act of talking. None of them has the discovery layer that would make that information useful to people outside the community.
          </p>
          <p className="paper-lead">
            The platform is not the massage directory. The platform is the architecture underneath it — the pipeline that does not know its domain, the AI layer that extracts structure from text, the display layer that makes structure navigable, the analytics layer that finds patterns the individual posts do not contain. The massage case demonstrated that the architecture works. The next case will demonstrate something about which community gets its intelligence platform first, and why, and by whom.
          </p>
          <p className="paper-lead">
            The machine is not picky about what it reads. That is the point.
          </p>
          <p className="paper-coda">
            Change the channels. Change the prompt. The pipeline follows.
          </p>
        </section>

        <section className="paper-refs">
          <h2 className="paper-h">Additional References · Origin, Economy, Platform</h2>
          <ul>
            <li>Appadurai, A. (1990). "Disjuncture and Difference in the Global Cultural Economy." <em>Theory, Culture &amp; Society,</em> 7(2–3).</li>
            <li>New Zealand Prostitution Law Review Committee (2008). <em>Report of the Prostitution Law Review Committee on the Operation of the Prostitution Reform Act 2003.</em> Ministry of Justice.</li>
            <li>Rifkin, J. (2014). <em>The Zero Marginal Cost Society.</em> Palgrave Macmillan.</li>
            <li>Rochet, J.-C. &amp; Tirole, J. (2003). "Platform Competition in Two-Sided Markets." <em>Journal of the European Economic Association,</em> 1(4).</li>
            <li>Salganik, M. J. (2018). <em>Bit by Bit: Social Research in the Digital Age.</em> Princeton University Press.</li>
            <li>Amnesty International (2016). <em>Amnesty International Policy on State Obligations to Respect, Protect and Fulfil the Human Rights of Sex Workers.</em></li>
            <li>Thailand Ministry of Public Health / MOPH (2001). <em>100% Condom Use Programme: Final Evaluation Report 1989–2001.</em></li>
            <li>Thailand Division of Communicable Disease Control / DDC (annual). <em>Annual Epidemiological Surveillance Report.</em> Bureau of Epidemiology, Ministry of Public Health.</li>
            <li>World Health Organization (2024). <em>Sexually Transmitted Infections (STIs) — Global Surveillance Data and Trends.</em> Department of Global HIV, Hepatitis and STIs Programmes.</li>
            <li>World Health Organization (2024). <em>Multi-Drug-Resistant <em>Neisseria gonorrhoeae</em>: Threat Assessment and Response Framework.</em></li>
            <li>US Centers for Disease Control and Prevention (annual). <em>Sexually Transmitted Disease Surveillance Report.</em> National Center for HIV, Viral Hepatitis, STD, and TB Prevention.</li>
            <li>European Centre for Disease Prevention and Control / ECDC (annual). <em>Sexually Transmitted Infections Surveillance Report — Annual Epidemiological Report for the EU/EEA.</em></li>
            <li>OSMEP / Ministry of Industry (2024). <em>OTOP Programme Annual Report.</em> Office of SMEs Promotion.</li>
            <li>UNAIDS (2018). <em>UNAIDS Guidance Note on HIV and Sex Work.</em></li>
            <li>World Bank Thailand (2024). <em>Thailand Economic Monitor: Navigating Uncertainty.</em></li>
          </ul>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: ETHICS & METHODS — Sampling, CTA vs Intent, CV, PDPA            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`paper-tab-panel${activeTab === 'ethics' ? ' is-active' : ''}`}>
        <section className="paper-sec">
          <span className="paper-num">XXVI</span>
          <h2 className="paper-h">Sampling Limitations: The Aggregator Concentration Bias</h2>
          <p className="paper-lead">
            A primary methodological limitation of this study is its reliance on high-volume Telegram aggregator channels. The dataset is derived from <strong>{corpus.channels} specific channels</strong>, where a single dominant channel, <code>@relaxsociety2020</code>, contributes a disproportionate share of listings. Consequently, the spatial and pricing distributions mapped in this paper represent the posting habits of these digital aggregators rather than a representative census of the offline Thai massage market.
          </p>
          <p className="paper-lead">
            In research terms, this concentration introduces severe selection bias. Aggregators tend to prioritize high-velocity, urban venues that rely on continuous reposting to capture immediate traffic. Smaller, neighborhood-level parlors that operate through local word-of-mouth or stable customer relationships are systematically underrepresented. The analysis presented here is therefore positioned strictly as a <strong>case study of high-volume digital discovery platforms</strong>, not as an exhaustive economic map of the Bangkok sex work sector.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXVII</span>
          <h2 className="paper-h">Linguistic Action vs. Private Intent: Reframing the Booking Metric</h2>
          <p className="paper-lead">
            The finding that booking-related phrases occur <strong>{queries.bookingToPriceRatio}× more frequently</strong> than pricing inquiries must be interpreted with caution. Because the corpus consists of public Telegram broadcasts rather than private customer-provider chat transcripts, this metric reflects <strong>operator marketing strategies</strong> (e.g., promotional calls-to-action urging users to "reserve a slot now") rather than actual customer transaction velocity.
          </p>
          <p className="paper-lead">
            Public channels operate as broadcast storefronts. Operators prioritize scheduling urgency and service availability in their ad copy to prompt immediate action. The absence of explicit prices in the majority of posts is a strategic decision to move negotiations into private, unmonitored channels, avoiding public price floors or direct scrutiny. Thus, this metric measures the linguistic structure of public solicitation, not the transactional intent of the consumer pool.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXVIII</span>
          <h2 className="paper-h">Photo-Matching: AI Computer Vision Boundaries</h2>
          <p className="paper-lead">
            The assertion that <strong>{repeat.repeatRate}% of the index is photo-matched</strong> defines a technical extraction metric rather than an identity verification. The system's Gemini AI pipeline performs two tasks: it downloads media and runs a classification model to confirm that the images contain contextual wellness signals (e.g., massage tables, spa interiors, or themed uniforms) rather than generic web assets or unrelated spam.
          </p>
          <p className="paper-lead">
            It is critical to specify that the AI does <em>not</em> perform facial recognition or biometrics to verify if the worker pictured matches the description or is present at the physical parlor. The "photo-match" is an audit of ad-copy consistency. It confirms that the listing contains unique, verified media associated with the broadcast entity, screening out blank posts and bulk-generated spam, while preserving the anonymity of the subjects.
          </p>
        </section>

        <section className="paper-sec">
          <span className="paper-num">XXIX</span>
          <h2 className="paper-h">Ethical Considerations, Anonymization, and PDPA Compliance</h2>
          <p className="paper-lead">
            Aggregating and publishing data from public Telegram channels used by informal wellness workers poses significant ethical and legal challenges under Thailand's <strong>Personal Data Protection Act (PDPA)</strong>. Although these posts are broadcast in public channels, their aggregation in a central directory increases the searchability of contact details (such as LINE IDs and telephone numbers) and associated media.
          </p>
          <p className="paper-lead">
            To mitigate risk and respect individual rights, the following privacy safeguards are implemented in this research and prototype:
          </p>
          <ul>
            <li><strong>Data Redaction:</strong> On all public analytical and paper outputs, telephone numbers, LINE IDs, and personal handles are systematically redacted (e.g., <code>08X-XXX-XXXX</code> or <code>LINE: @redacted</code>).</li>
            <li><strong>NSFW Held-Back:</strong> Raw ad copy and images flagged by the AI as highly sensitive or promotional are withheld from public display. They are retained in the study only as aggregate token frequencies.</li>
            <li><strong>Takedown Protocol:</strong> A clear, responsive takedown request workflow is provided. Operators or individuals who identify their contact details or media in the dataset can request immediate, permanent deletion from both the live directory and the underlying database by contacting the research team at <code>privacy@sabaisabai-airdnd.pages.dev</code>.</li>
            <li><strong>Institutional Review:</strong> This study is conducted under the framework of informal computational ethnography, utilizing open-source data streams. Because it does not involve direct human subject intervention or interviews, it relies on strict post-collection anonymization to shield vulnerable actors in the informal economy.</li>
          </ul>
        </section>
      </div>

      <footer className="soc-footer">
        <span className="soc-footer-note">Draft 0.4 · {fmt(corpus.totalMessages)} messages · read by machine · figures reproducible from research.json</span>
        <a href="/sociology" className="meth-back">{pc.backToFieldNotes || '← Field Notes'}</a>
      </footer>
    </article>
  );
}
