import { useState, useEffect, useRef } from 'react';
import Findings from './atlas/Findings.jsx';
import Money from './atlas/Money.jsx';
import Reach from './atlas/Reach.jsx';
import Domain from './atlas/Domain.jsx';
import Record from './atlas/Record.jsx';
import Gaps from './atlas/Gaps.jsx';
import Universe from './atlas/Universe.jsx';

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
  { id: 'findings', label: 'Findings',  th: 'สิ่งที่ข้อมูลบอก',  q: 'What does the data say?',           qth: 'ข้อมูลบอกอะไร',                credit: 'Photo: Tony Wu / Pexels' },
  { id: 'domain',   label: 'Geography', th: 'ภูมิศาสตร์',         q: 'What is made where?',               qth: 'ผลิตอะไร ที่ไหน',               credit: 'Photo: Pexels' },
  { id: 'reach',    label: 'Reach',     th: 'การเข้าถึง',           q: 'Who can be contacted?',             qth: 'ติดต่อใครได้',                credit: 'Photo: Pexels' },
  { id: 'money',    label: 'Money',     th: 'เงิน',                 q: 'Where does the money move?',        qth: 'เงินไหลไปทางไหน',             credit: 'Photo: María Merlin / Pexels' },
  { id: 'record',   label: 'Record',    th: 'สภาพทะเบียน',          q: "What is the registry's condition?", qth: 'สภาพของทะเบียนเป็นอย่างไร', credit: 'Photo: María Merlin / Pexels' },
  { id: 'gaps',     label: 'Gaps',      th: 'ช่องว่าง',               q: 'What is missing — and what to do?', qth: 'อะไรหายไป และจะทำอย่างไร', credit: 'Photo: María Merlin / Pexels' },
  { id: 'universe', label: 'Universe',  th: 'จักรวาล',                q: 'How does everything connect?',      qth: 'ทุกอย่างเชื่อมกันอย่างไร',  credit: 'Photo: Tony Wu / Pexels' },
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
    catalogue = null, byYear = null, matrix = null, gaps = null, graph = null,
  } = insights;
  const [tab, setTab] = useState(tabFromUrl);
  // Province clicks open the dossier; the dossier holds the B2B link.
  const go = onSelectProvince ?? ((code) => { window.location.href = `/province/${code}/`; });

  // Keep the URL in sync so a tab can be shared as a link.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab') !== tab) {
      p.set('tab', tab);
      window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
    }
  }, [tab]);

  // Seven chapters do not fit across a phone. The band scrolls sideways,
  // so the chapter the reader is IN must be brought into view — otherwise
  // the strip shows four other chapters and no sign of where they are.
  const tabsRef = useRef(null);
  useEffect(() => {
    const cont = tabsRef.current;
    if (!cont) return;
    const el = cont.querySelector('.atlas-tab[data-active="1"]');
    if (!el) return;
    const c = cont.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const delta = (e.left + e.width / 2) - (c.left + c.width / 2);
    if (Math.abs(delta) > 2) cont.scrollBy({ left: delta, behavior: 'smooth' });
  }, [tab]);

  return (
    <>
      <nav className="atlas-tabs" role="tablist" aria-label="Atlas chapters" ref={tabsRef}>
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

      {/* Per-tab banner. It asks the chapter's question; the chapter below
          it carries the name. Nothing on the page says either thing twice. */}
      {(() => {
        const index = Math.max(0, CHAPTERS.findIndex((c) => c.id === tab));
        const current = CHAPTERS[index] ?? CHAPTERS[0];
        const n = index + 1;
        return (
          <div className="atlas-tab-banner" data-tab={current.id}>
            <p className="atlas-tab-q">Chapter {n} · บทที่ {n}</p>
            <h2 className="atlas-tab-h">{current.q}</h2>
            <p className="atlas-tab-th">{current.qth}</p>
            <span className="atlas-tab-credit">{current.credit}</span>
          </div>
        );
      })()}

      {tab === 'findings' && <Findings findings={findings} />}
      {tab === 'domain' && (
        <Domain
          national={national} byRegion={byRegion} byProvince={insights.byProvince}
          regionIdentity={regionIdentity}
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
      {tab === 'gaps' && <Gaps gaps={gaps} go={go} />}
      {tab === 'universe' && <Universe graph={graph} go={go} />}
    </>
  );
}
