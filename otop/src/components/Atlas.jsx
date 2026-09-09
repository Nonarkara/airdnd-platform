import Findings from './atlas/Findings.jsx';
import Money from './atlas/Money.jsx';
import Reach from './atlas/Reach.jsx';
import Domain from './atlas/Domain.jsx';
import Record from './atlas/Record.jsx';

/**
 * Atlas — the registry read as one closed information package, in five
 * chapters, one question each. Every section that existed before the split
 * still exists; it now sits under the question it answers, below one chart.
 *
 * The aesthetic is Dr Non's white baggage tag, INDEX register: four type ranks,
 * an id that copies, a full-bleed rail carrying a domain that is genuinely in
 * the record, and a fallback rank that still identifies the object when every
 * rank above it is blank.
 */
const CHAPTERS = [
  ['findings', 'Findings'], ['money', 'Money'], ['reach', 'Reach'], ['domain', 'Domain'], ['record', 'Record'],
];

export default function Atlas({ insights, onSelectProvince }) {
  const {
    national, byRegion, findings = [], specialization = [], qualityLeaders = [], reachGap = [],
    corroborationQuadrant = {}, hiddenChampions = [], regionIdentity = [], revenue = null,
    catalogue = null, byYear = null, matrix = null,
  } = insights;
  // Province clicks open the dossier; the dossier holds the B2B link.
  const go = onSelectProvince ?? ((code) => { window.location.href = `/?view=province&code=${code}`; });

  return (
    <>
      <nav className="chapters" aria-label="Atlas chapters">
        {CHAPTERS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>
      <Findings findings={findings} />
      <Money revenue={revenue} catalogue={catalogue} go={go} />
      <Reach national={national} reachGap={reachGap} corroborationQuadrant={corroborationQuadrant} hiddenChampions={hiddenChampions} go={go} />
      <Domain national={national} byRegion={byRegion} regionIdentity={regionIdentity} matrix={matrix} byYear={byYear} specialization={specialization} qualityLeaders={qualityLeaders} go={go} />
      <Record insights={insights} go={go} />
    </>
  );
}
