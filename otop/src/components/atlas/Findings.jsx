import { Chapter } from './fmt.jsx';

export default function Findings({ findings }) {
  if (!findings.length) return null;
  return (
    <Chapter id="findings" q="What does the data say?" title="Findings" th="สิ่งที่ข้อมูลบอก">
      <section className="atlas-findings" aria-label="Headline findings">
        <ol className="atlas-findings-list">
          {findings.map((f) => (
            <li key={f.id} className="atlas-finding">
              <span className="atlas-finding-th">{f.th}</span>
              <span className="atlas-finding-text">{f.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </Chapter>
  );
}
