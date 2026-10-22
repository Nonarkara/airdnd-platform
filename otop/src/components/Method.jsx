/**
 * Method — how the registry was built, and what the numbers can and cannot
 * mean. This is a view, not a paragraph appended to every other page.
 *
 * It used to sit at the bottom of every view, which meant four paragraphs of
 * methodology travelled with the reader on every step and pushed the actual
 * answer down the screen. It is now its own page, reachable from the header
 * and from the one-line build note under every view.
 *
 * The layout is two columns: the argument on the left at a readable measure,
 * the build facts on the right. The numbers that used to be illegible gauges
 * over a photograph live here, in the place that explains them.
 */

import { Bi } from './Bi.jsx';
import ProvenanceBanner from './ProvenanceBanner.jsx';

function Fact({ k, v }) {
  return (
    <div className="fact">
      <dt className="fact-k">{k}</dt>
      <dd className="fact-v">{v}</dd>
    </div>
  );
}

export default function Method({ meta, totals }) {
  if (!meta) return null;
  const c = meta.counts || {};

  const registry = [
    ['Producers', 'ผู้ผลิต', (totals?.records ?? c.recordsAfterMerge ?? 0).toLocaleString()],
    ['Provinces', 'จังหวัด', `${totals?.provincesWithRecords ?? 0} of 77`],
    ['With a contact channel', 'มีช่องทางติดต่อ', '5.7%'],
    ['Rated 5★', 'ระดับ 5 ดาว', '5,317'],
    ['Certificate valid', 'ใบรับรองใช้ได้', (c.certValid ?? 0).toLocaleString()],
    ['Placed at tambon', 'ระบุตำบลได้', (c.tambonPlaced ?? 0).toLocaleString()],
  ];

  const build = [
    ['Built', 'สร้างเมื่อ', (meta.builtAt || '').slice(0, 10) || '—'],
    ['Source', 'แหล่งข้อมูล', meta.source || 'data.go.th'],
    ['Resources cached', 'ทรัพยากรที่ดึงมา', (c.resourcesCached ?? 0).toLocaleString()],
    ['Resources used', 'ทรัพยากรที่ใช้', (c.resourcesUsable ?? 0).toLocaleString()],
    ['Resources skipped', 'ทรัพยากรที่ข้าม', (c.resourcesSkipped ?? 0).toLocaleString()],
    ['Source rows in', 'แถวต้นทาง', (c.rowsIn ?? 0).toLocaleString()],
    ['Rows accepted', 'แถวที่รับได้', (c.rowsAccepted ?? 0).toLocaleString()],
    ['Rows rejected', 'แถวที่ตกรอบคัดกรอง', (c.rowsRejected ?? 0).toLocaleString()],
    ['Duplicates collapsed', 'รวมซ้ำ', (c.duplicatesCollapsed ?? 0).toLocaleString()],
    ['Records after merge', 'รายการหลังรวมตัวตน', (c.recordsAfterMerge ?? 0).toLocaleString()],
    ['Province shards', 'ไฟล์แยกรายจังหวัด', String(meta.shardCount ?? 0)],
  ];

  return (
    <>
    <div className="method">
      <div className="method-prose">
        <ProvenanceBanner meta={meta} />
        <p>
          Records come from CKAN datasets published on <code>data.go.th</code>, mapped onto one schema by
          discovering each resource's columns rather than assuming them, and resolved into
          entities by unioning shared identity signals — tax ID, telephone, source-scoped
          registration number, and name-within-an-administrative-area. A telephone appearing
          in more than one province is treated as a switchboard and withdrawn as identity.
        </p>
        <p>
          <strong>The fit score ranks only what the registry attests</strong> — contactability,
          OPC grading, filing recency, cross-agency corroboration and how precisely the
          producer is located. It does not model capacity, price or reliability, because the
          registry holds none of those. Hover any score to see its components.
        </p>
        <p>
          <strong>These counts measure the registry, not the economy.</strong> A province with an
          active provincial office files more rows than a province with more producers and
          less paperwork. The same is true of every number here: they count what was
          filed, filed correctly, and filed recently enough to still be reachable.
        </p>
        <p>
          <strong>Every record carries its origin.</strong> Each row names the dataset it came
          from, the organisation that published it, the licence it carries and the date it was
          retrieved — so any figure on this site can be traced back to a filing.
        </p>
      </div>

      <aside className="method-facts">
        <h2 className="fact-h">
          <Bi en="Registry at a glance" th="ภาพรวมทะเบียน" />
        </h2>
        <dl className="facts">
          {registry.map(([k, th, v]) => (
            <Fact key={k} k={<><span>{k}</span> <span className="fact-th" lang="th">{th}</span></>} v={v} />
          ))}
        </dl>

        <h2 className="fact-h">
          <Bi en="The build" th="การสร้างข้อมูล" />
        </h2>
        <dl className="facts">
          {build.map(([k, th, v]) => (
            <Fact key={k} k={<><span>{k}</span> <span className="fact-th" lang="th">{th}</span></>} v={v} />
          ))}
        </dl>
      </aside>
    </div>

    {/* The legal line is a statement about the page, not the last beat of
        the argument, and not a third column either. It sits below the two
        columns as a note, the way every other page-level note does here.
        Held inside the prose it left the columns ending 78px apart with
        the facts column trailing into nothing; held inside the grid as a
        full-width row it became a track with 784px of empty field. */}
    <p className="method-legal">
      <Bi
        en="Terms of use, the privacy basis, and the takedown route are published as static pages."
        th="เงื่อนไขการใช้งาน เกณฑ์ความเป็นส่วนตัว และช่องทางขอแก้ไข เผยแพร่เป็นหน้าเว็บถาวร"
      />{' '}
      <a href="/legal/provenance/">Data provenance →</a>
    </p>
    </>
  );
}
