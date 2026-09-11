import { useState, useEffect } from 'react';
import Findings from './atlas/Findings.jsx';
import Money from './atlas/Money.jsx';
import Reach from './atlas/Reach.jsx';
import Domain from './atlas/Domain.jsx';
import Record from './atlas/Record.jsx';

/**
 * Atlas — the registry read as one closed information package, in five
 * chapters, one question each. The chapters are now tabs: the page is no
 * longer a long scroll. The first tab is the lede; the rest follow the
 * reader's question, "what, where, who, how much".
 *
 * The aesthetic is Dr Non's white baggage tag, INDEX register: four type ranks,
 * an id that copies, a full-bleed rail carrying a domain that is genuinely in
 * the record, and a fallback rank that still identifies the object when every
 * rank above it is blank.
 */
const CHAPTERS = [
  { id: 'findings', label: 'Findings',  th: 'สิ่งที่ข้อมูลบอก',  q: 'What does the data say?',          credit: 'Photo: Tony Wu / Pexels' },
  { id: 'domain',   label: 'Geography', th: 'ภูมิศาสตร์',         q: 'What is made where?',              credit: 'Photo: Pexels' },
  { id: 'reach',    label: 'Reach',     th: 'การเข้าถึง',           q: 'Who can be contacted?',            credit: 'Photo: Pexels' },
  { id: 'money',    label: 'Money',     th: 'เงิน',                 q: 'Where does the money move?',       credit: 'Photo: María Merlin / Pexels' },
  { id: 'record',   label: 'Record',    th: 'สภาพทะเบียน',          q: 'What is the registry\'s condition?', credit: 'Photo: María Merlin / Pexels' },
];

/** Read the active tab from the URL on first paint, defaulting to findings. */
function tabFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const t = p.get('tab');
  return CHAPTERS.some((c) => c.id === t) ? t : 'findings';
}

export default function Atlas({ insights, onSelectProvince }) {
  const {
    national, byRegion, findings = [], specialization = [], qualityLeaders = [], reachGap = [],
    corroborationQuadrant = {}, hiddenChampions = [], regionIdentity = [], revenue = null,
    catalogue = null, byYear = null, matrix = null,
  } = insights;
  const [tab, setTab] = useState(tabFromUrl);
  // Province clicks open the dossier; the dossier holds the B2B link.
  const go = onSelectProvince ?? ((code) => { window.location.href = `/?view=province&code=${code}`; });

  // Keep the URL in sync so a tab can be shared as a link.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab') !== tab) {
      p.set('tab', tab);
      window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
    }
  }, [tab]);

  return (
    <>
      <nav className="atlas-tabs" role="tablist" aria-label="Atlas chapters">
        {CHAPTERS.map((c) => (
          <button
            key={c.id}
            role="tab"
            type="button"
            aria-selected={tab === c.id}
            className="atlas-tab"
            data-active={tab === c.id ? '1' : '0'}
            onClick={() => setTab(c.id)}
          >
            <span className="atlas-tab-label">{c.label}</span>
            <span className="atlas-tab-th">{c.th}</span>
          </button>
        ))}
      </nav>

      {/* Per-tab festival banner with the question that tab answers. */}
      {(() => {
        const current = CHAPTERS.find((c) => c.id === tab) ?? CHAPTERS[0];
        return (
          <div className="atlas-tab-banner" data-tab={current.id}>
            <p className="atlas-tab-q">{current.q}</p>
            <h2 className="atlas-tab-h">{current.label}</h2>
            <p className="atlas-tab-th">{current.th}</p>
            <span className="atlas-tab-credit">{current.credit}</span>
          </div>
        );
      })()}

      {tab === 'findings' && <Findings findings={findings} />}
      {tab === 'domain' && (
        <Domain
          national={national} byRegion={byRegion} regionIdentity={regionIdentity}
          matrix={matrix} byYear={byYear} specialization={specialization}
          qualityLeaders={qualityLeaders} topBasins={insights.topBasins} go={go}
        />
      )}
      {tab === 'reach' && (
        <Reach
          national={national} reachGap={reachGap}
          corroborationQuadrant={corroborationQuadrant}
          hiddenChampions={hiddenChampions} go={go}
        />
      )}
      {tab === 'money' && <Money revenue={revenue} catalogue={catalogue} go={go} />}
      {tab === 'record' && <Record insights={insights} go={go} />}
    </>
  );
}
