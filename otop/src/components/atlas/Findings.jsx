import { Chapter } from './fmt.jsx';

/**
 * Each finding can carry a deep link into Find. The Atlas is the analytical
 * read; Find is the action surface. The two are bridged here so a reader
 * can go do the call in one click. The mapping is by finding id, not by
 * text, so the data side stays the source of truth and the linkage can
 * evolve without rewriting prose.
 */
const FIND_LINKS = {
  // 7,089 records carry a 4-5★ grade but no contact — Find shows them
  // sorted contactability-first so the reachable ones are at the top.
  'hidden-champions': {
    href: '/?view=find&s=4-5',
    en: 'Open in Find →',
    th: 'เปิดใน Find →',
  },
  // 117 records have all three signals — the rarest, most useful slice.
  'commercial-ready': {
    href: '/?view=find&s=4-5&c=1',
    en: 'Find the 117 →',
    th: 'ค้นหา 117 ราย →',
  },
  // Concentration finding: show the top province.
  'concentration': {
    href: '/?view=find',
    en: 'Browse all provinces →',
    th: 'ดูทุกจังหวัด →',
  },
  // 5★ only — narrow the search to the top grade.
  'graded': {
    href: '/?view=find&s=5',
    en: 'Find 5★ only →',
    th: 'ค้นหาเฉพาะ 5 ดาว →',
  },
};

export default function Findings({ findings }) {
  if (!findings.length) return null;
  return (
    <Chapter id="findings" q="What does the data say?" title="Findings" th="สิ่งที่ข้อมูลบอก">
      <section className="atlas-findings" aria-label="Headline findings">
        <ol className="atlas-findings-list">
          {findings.map((f) => {
            const link = FIND_LINKS[f.id];
            return (
              <li key={f.id} className="atlas-finding">
                <span className="atlas-finding-th">{f.th}</span>
                <span className="atlas-finding-text">{f.text}</span>
                {link && (
                  <a className="atlas-finding-link" href={link.href}>
                    <span className="atlas-finding-link-en">{link.en}</span>
                    <span className="atlas-finding-link-th" lang="th">{link.th}</span>
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </Chapter>
  );
}
