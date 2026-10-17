import { Chapter, n } from './fmt.jsx';
import Bars from '../charts/Bars.jsx';

/** Who can be contacted? */
export default function Reach({ national, reachGap, corroborationQuadrant, hiddenChampions, go }) {
  const top = reachGap.filter((p) => p.records > 0).slice(0, 20);
  return (
    <Chapter id="reach" q="Who can be contacted?" title="Reach" th="ช่องว่างการเข้าถึง">
      {reachGap.length > 0 && (
        <>
          <p className="t-note">
            Thailand has <strong>{n(national.records)}</strong> registered OTOP producers and{' '}
            <strong>{n(reachGap.reduce((s, p) => s + p.reachable, 0))}</strong> can be reached.
            Fix the second number and you lift the first. Bars are the gap — producers no one can telephone.
          </p>
          {/*
            Reach is the analytical read of contactability. Find is the action
            surface — the search box, the province picker, the tap-to-call phone.
            The two serve different questions; the CTA below bridges them so a
            reader of this chapter can go do the call in one click.
          */}
          <p className="t-cta">
            <a className="cta-btn" href="/?view=find&c=1">
              <span className="cta-en">Find a producer to call now →</span>
              <span className="cta-th" lang="th">ค้นหาผู้ผลิตที่โทรหาได้ทันที →</span>
            </a>
          </p>
          <Bars label="Unreachable producers by province, top 20" onSelect={go} format={n}
            rows={top.map((p) => ({ code: p.code, label: p.th, sub: `${p.reachable > 0 ? n(p.reachable) : 'none'} reachable`, value: p.unreachable }))} />
          <details className="t-more">
            <summary>The same 20 as a table, with corroboration</summary>
            <div className="t-rows" id="reach-gap">
              <div className="t-row t-row-hd">
                <span className="t-rail" />
                <span>Province · จังหวัด</span>
                <span className="t-row-num">Producing</span>
                <span className="t-row-num">Reachable</span>
                <span className="t-hide-sm t-row-num">Corroborated</span>
                <span className="t-row-num">Gap</span>
              </div>
              {top.map((p) => (
                <button type="button" className="t-row" key={p.code} onClick={() => go(p.code)}>
                  <span className="t-rail" />
                  <span>
                    <span className="t-row-th">{p.th}</span><br />
                    <span className="t-row-en">{p.en}</span>
                  </span>
                  <span className="t-row-num">{n(p.records)}</span>
                  <span className="t-row-num">{p.reachable > 0 ? n(p.reachable) : '—'}</span>
                  <span className="t-hide-sm t-row-num">{p.corroboratedPct}%</span>
                  <span className="t-row-num" data-high={p.unreachable > 1000}>{n(p.unreachable)}</span>
                </button>
              ))}
            </div>
          </details>
          <p className="t-note">
            Top 20 by number of unreachable producers. A high gap means a province with deep production
            but almost no way to reach those producers. Each row is a contact-drive waiting to happen.
          </p>
        </>
      )}

      {corroborationQuadrant.ready && (
        <>
          <h3 className="sub-h">The Quadrant · ตาราง 2×2</h3>
          <p className="t-note">
            Provinces classified by two independent axes: corroboration (is the data verified by
            more than one agency?) and contactability (can someone actually reach the producer?).
            The cut sits at ≥{corroborationQuadrant.thresholds.corroboration}% corroborated and ≥{corroborationQuadrant.thresholds.contact}% reachable —
            administrative lines, not natural kinds. {(() => {
              const t = corroborationQuadrant.thresholds;
              const edge = [...(corroborationQuadrant.blind ?? [])]
                .map((p) => ({ p, d: Math.abs(p.corroboratedPct - t.corroboration) + Math.abs(p.reachablePct - t.contact) }))
                .sort((a, b) => a.d - b.d)[0];
              return edge ? `${edge.p.th} (${edge.p.corroboratedPct}% / ${edge.p.reachablePct}%) sits just below both lines — move them slightly and it moves quadrants.` : 'Provinces near the lines move quadrants when the lines move.';
            })()}
          </p>
          <div className="t-quadrant">
            {[
              ['ready', '●', 'Ready to trade · พร้อมค้า', 'High corroboration, high contact', (p) => `${p.reachable} reachable`],
              ['documented', '■', 'Best docs, no reach · มีเอกสาร ไม่มีช่องทาง', 'High corroboration, low contact', (p) => `${n(p.records)} records, ${p.reachable} reachable`],
              ['reachable', '▲', 'Reachable, unverified · มีช่องทาง ไม่ได้ตรวจสอบ', 'Low corroboration, high contact', (p) => `${p.reachable} reachable`],
              ['blind', '▪', 'The poverty zones · พื้นที่ยากจน', 'Low corroboration, low contact', (p) => `${n(p.records)} records`],
            ].map(([key, icon, title, desc, line]) => (
              <div className="t-quad-cell" data-quad={key} key={key}>
                <div className="t-quad-h"><span className="t-quad-icon">{icon}</span>{title}</div>
                <span className="t-quad-count">{corroborationQuadrant[key].length}</span>
                <span className="t-quad-desc">{desc}</span>
                {corroborationQuadrant[key].slice(0, 5).map((p) => (
                  <button type="button" className="t-quad-row" key={p.code} onClick={() => go(p.code)}>
                    <span className="t-row-th">{p.th}</span>
                    <span className="t-row-num">{line(p)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {hiddenChampions.length > 0 && (
        <>
          <h3 className="sub-h">Hidden champions · แชมป์ที่ซ่อนอยู่</h3>
          <p className="t-note">
            The state's own certified producers — 4-5★, corroborated by multiple
            agencies — with <em>no phone number</em>. A star certifies process compliance,
            not market demand, so these are not proven sales waiting to happen; they are
            the shortest list a contact-drive could start from: certified names, not cold ones.
          </p>
          <div className="t-rows" id="hidden-champions">
            <div className="t-row t-row-hd">
              <span className="t-rail" />
              <span>Province · จังหวัด</span>
              <span className="t-row-num">Champions</span>
              <span className="t-hide-sm t-row-num">4-5★ total</span>
              <span className="t-hide-sm t-row-num">Reachable</span>
            </div>
            {hiddenChampions.map((p) => (
              <button type="button" className="t-row" key={p.code} onClick={() => go(p.code)}>
                <span className="t-rail" />
                <span>
                  <span className="t-row-th">{p.th}</span><br />
                  <span className="t-row-en">{p.en}</span>
                </span>
                <span className="t-row-num" data-high>{p.hiddenChampions}</span>
                <span className="t-hide-sm t-row-num">{p.highStars}</span>
                <span className="t-hide-sm t-row-num">{p.reachable}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Chapter>
  );
}
