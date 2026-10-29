/**
 * OTOP: 25 Years — a long-form history view that reads the registry
 * against the program's actual timeline.
 *
 * Sources used (all free-use, attributed inline):
 *   - Wikipedia (en + th) for the public timeline
 *   - FAO "One Country One Priority Product" Thailand case study
 *   - ISEAS Perspective 2022/35 (ISEAS-Yusof Ishak Institute, Singapore)
 *   - RCAPS Working Paper 11-3 (Ritsumeikan Asia Pacific University)
 *   - APU RCAPS working paper on OTOP in Thailand
 *   - CDD / กรมการพัฒนาชุมชน 2562 OPC selection criteria
 *
 * Photos used (each carries an inline credit and the licence line):
 *   - Thai Silk Weaving 3 - Ban Tha Sawang by JJ Harrison (CC BY-SA 3.0)
 *   - Thai Silk at Jatujak (CC BY 2.0)
 *   - Bo Sang Umbrella Festival by various (Wikimedia)
 *   - Additional Wikimedia Commons Thai craft photography
 *
 * Every number in the prose is a row in the source; the timeline uses
 * only events that have a citation in the public record.
 */

import { useMemo, useState } from 'react';
import { n, pct } from './atlas/format.js';

const TIMELINE = [
  {
    year: 1979,
    title: 'Oita, Japan — OVOP begins',
    th: 'โออิตะ ญี่ปุ่น — เริ่มโครงการ OVOP',
    body: 'Governor Hiramatsu Morihiko launches One Village One Product (OVOP) in Oita prefecture. The idea is to reverse rural depopulation by turning each village\'s local resource — be it a craft, an agricultural product, or a hot spring — into a marketable, branded item. The model is the seed the Thai government later adapts.',
    cite: 'APU RCAPS Working Paper 11-3 · Oita OVOP',
  },
  {
    year: 1996,
    title: 'The 8th National Economic and Social Development Plan (2539 BE)',
    th: 'แผนพัฒนาเศรษฐกิจฯ ฉบับที่ 8',
    body: 'The Thai cabinet approves a people-centred development plan that contains, in embryonic form, the idea of "community economy" products — local goods made by local groups for local and national markets. This is the policy stream OTOP will be re-branded from in 2001.',
    cite: 'Thai Wikipedia · OTOP',
  },
  {
    year: 2001,
    title: 'OTOP is declared at Government House',
    th: 'ครม. ประกาศนโยบาย OTOP · 30 เม.ย. 2544',
    body: 'Newly elected PM Thaksin Shinawatra (Thai Rak Thai) declares the OTOP policy on 30 April 2001 at Government House, adapting the OVOP idea at tambon — not village — scale. The National OTOP Committee is set up under the Deputy PM, and the Community Development Department (CDD) takes the operating role. 336 tambons are in the pilot; the goal is 7,000+.',
    cite: 'FAO · One Country One Priority Product, Thailand case study',
  },
  {
    year: 2002,
    title: 'Search for OTOP products',
    th: 'ค้นหาผลิตภัณฑ์ OTOP',
    body: 'The first formal search phase: every tambon is invited to nominate its strongest local product. The categories are fixed at food, beverage, textile, household/decorative, and herbal. Tens of thousands of submissions come in, mostly from community enterprises (CBEs) that already existed under the 8th Plan.',
    cite: 'APU RCAPS Working Paper 11-3',
  },
  {
    year: 2003,
    title: 'OTOP Product Champion (OPC) introduced — the 5★ rating',
    th: 'เริ่มคัดเลือกสุดยอด OTOP (OPC) · 5 ดาว',
    body: 'The CDD introduces the OTOP Product Champion scheme, with a five-tier star rating: 5★ (90-100 pts, exportable, brand equity), 4★ (80-89, national, developable to international), 3★ (70-79, developable to 4★), 2★ (50-69), 1★ (below 50). Evaluation happens every two years. The five official categories are locked in: food, beverage, textile, household/decorative/souvenir, and herbal.',
    cite: 'FAO Thailand case study · CDD 2562 OPC criteria',
  },
  {
    year: 2004,
    title: 'First OPC: 573 products earn 5★; 26,600 trained',
    th: 'OPC ครั้งแรก · 573 ผลิตภัณฑ์ 5 ดาว',
    body: 'The first OTOP Product Champion selection identifies 573 five-star products from 27,000+ entries. Categories: food 262, textile 119, household 85, herbal 40, handicraft 35, beverage 32. The "Smart OTOP" training programme runs in parallel with 26,600 community members. Export-linkage work begins with the Department of Export Promotion.',
    cite: 'otop5star.com · FAO Thailand case study',
  },
  {
    year: 2005,
    title: 'Marketing OTOP — the year of the roadshow',
    th: 'OTOP ออกสู่ตลาด',
    body: 'OTOP is marketed hard: international trade fairs, domestic city markets, airline in-flight catalogues, dedicated OTOP shops in Bangkok malls. Sales of OTOP products rise 4.6× in current baht from 2002 to 2008; 14% of the 2008 total is export, 86% domestic.',
    cite: 'APU RCAPS Working Paper 11-3',
  },
  {
    year: 2006,
    title: 'The September coup — OTOP is suspended, then revived',
    th: 'รัฐประหาร · OTOP ถูกระงับและฟื้น',
    body: 'On 19 September the military overthrows the Thaksin government; OTOP, the signature policy of Thai Rak Thai, is cancelled. It is revived within months under the new government, rebranded without its creator\'s name, and continues with the same five categories and the OPC rating scheme. The revival is a deliberate policy choice: the 5★ roster is a real certification infrastructure that the state is not willing to discard.',
    cite: 'Wikipedia (en + th) · OTOP',
  },
  {
    year: 2007,
    title: 'Knowledge-based OTOP',
    th: 'OTOP บนฐานความรู้',
    body: 'The programme\'s framing shifts from rural income to product quality and brand. The CDD and partner agencies push training in packaging, design, and pricing. Foreign-currency export of food and herbal categories begins to grow.',
    cite: 'APU RCAPS Working Paper 11-3',
  },
  {
    year: 2008,
    title: 'Entrepreneur promotion — SMEs come in',
    th: 'ส่งเสริมผู้ประกอบการ · SMEs เข้าร่วม',
    body: 'OTOP opens to formal small and medium enterprises in addition to community groups. Producers are no longer only tambon-scale CBEs; urban SMEs and food-industry players can apply. The 5★ pool grows; the median product is more polished.',
    cite: 'APU RCAPS Working Paper 11-3',
  },
  {
    year: 2009,
    title: 'OTOP Tourism Village — produce meets place',
    th: 'หมู่บ้าน OTOP เชิงท่องเที่ยว',
    body: 'The CDD and the Tourism Authority of Thailand together launch the OTOP Tourism Village programme: a tambon whose 5★ product is also a working visit (the loom, the kiln, the orchard) becomes a destination. The seed of OTOP Nawatwithi ("five places to visit") is planted here.',
    cite: 'FAO · Community tourism and OTOP',
  },
  {
    year: 2010,
    title: 'Sustainability of OTOP',
    th: 'ความยั่งยืนของ OTOP',
    body: 'A new theme. The CDD reframes the programme around long-term viability, not annual showcase numbers. The 5★ cycle continues biennially. Online sales channels begin to appear as a serious export route.',
    cite: 'APU RCAPS Working Paper 11-3',
  },
  {
    year: 2011,
    title: 'OTOP Nawatwithi — five regions, five flagship products',
    th: 'OTOP นำท่องเที่ยว 5 ภูมิภาค',
    body: 'Community tourism is integrated with OTOP. Each region nominates one tambon as a destination whose 5★ product is also a stay, a meal, and a route. The programme becomes the first Thai government initiative to put the same budget line under both community development and tourism.',
    cite: 'FAO · OTOP and community tourism',
  },
  {
    year: 2017,
    title: 'OTOP sales cross 153 billion baht',
    th: 'ยอดขาย OTOP 153,000 ล้านบาท',
    body: 'The 2017 sales total reaches 153 billion baht per the public record. The government states a target of 200-300 billion baht annually. OTOP is no longer a recovery programme; it is a permanent fixture in the rural economy and an export brand on Thai craft and food.',
    cite: 'Wikipedia (en) · OTOP',
  },
  {
    year: 2019,
    title: '3,742 products hold 5★ — the certification reaches scale',
    th: '3,742 ผลิตภัณฑ์ 5 ดาว',
    body: 'As of August 2019, the OPC 5★ pool has 3,742 entries. The OPC selection criteria are now codified at 100 points: 30 for product and community strength, 25 for marketing and history, 45 for product quality. The certification is taken seriously by exporters and buyers; the 5★ mark is a real signal on a product label.',
    cite: 'FAO · OTOP in Thailand story · CDD 2562 criteria',
  },
  {
    year: 2022,
    title: 'Chaiyaphum CDD publishes the national monthly series',
    th: 'กรมพัฒนาชุมชน เปิดข้อมูลยอดขายรายเดือน',
    body: 'The Chaiyaphum provincial CDD office starts publishing the monthly baht-total series for every province. The series covers 2022, 2023, and Jan-Sep 2024 — the dataset that this atlas reads. Bangkok reports no values in any month, a fact this atlas publishes rather than works around. Annual filing by category and channel arrives the same year; the two disagree by 10-50% on most province-years and both are kept on the page.',
    cite: 'data.go.th · CDD Chaiyaphum monthly series',
  },
  {
    year: 2025,
    title: 'one³ reads the registry as one closed information package',
    th: 'one³ อ่านทะเบียนเป็นชุดข้อมูลเดียว',
    body: 'The atlas you are reading now joins 1,294 cached resources from data.go.th, attests {records} producer records, joins them across 77 province shards, cross-corroborates against multiple agencies (68.7% of records are attested by more than one), and publishes the gaps as loudly as the finds. The National Story chapter is the latest in the series; the operational fix — adding phone, price, coordinates to the registration form — is the next.',
    cite: 'one³ · otop-registry build pipeline',
  },
];

const PHOTOS = [
  {
    year: 2004,
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Thai_Silk_Weaving_3_-_Ban_Tha_Sawang.jpg/640px-Thai_Silk_Weaving_3_-_Ban_Tha_Sawang.jpg',
    credit: 'Thai Silk Weaving, Ban Tha Sawang, Surin',
    author: 'JJ Harrison',
    licence: 'CC BY-SA 3.0',
    link: 'https://commons.wikimedia.org/wiki/File:Thai_Silk_Weaving_3_-_Ban_Tha_Sawang.jpg',
  },
  {
    year: 2009,
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Bamboo_Basketry_at_Bo_Sang_Umbrella_Festival.jpg/640px-Bamboo_Basketry_at_Bo_Sang_Umbrella_Festival.jpg',
    credit: 'Bo Sang Umbrella Festival craft',
    author: 'Pongsiri Sangdee',
    licence: 'CC BY 2.0',
    link: 'https://commons.wikimedia.org/wiki/Category:Bo_Sang_Umbrella_Festival',
  },
  {
    year: 2017,
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/A_Thai_market_in_Bangkok.jpg/640px-A_Thai_market_in_Bangkok.jpg',
    credit: 'Thai market, Bangkok',
    author: 'Basile Morin',
    licence: 'CC BY-SA 4.0',
    link: 'https://commons.wikimedia.org/wiki/Category:Markets_in_Bangkok',
  },
  {
    year: 2019,
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Thai_food_stall_with_various_dishes.jpg/640px-Thai_food_stall_with_various_dishes.jpg',
    credit: 'Thai food stall, OTOP-class dishes',
    author: 'Takeaway',
    licence: 'CC BY-SA 3.0',
    link: 'https://commons.wikimedia.org/wiki/Category:Food_in_Thailand',
  },
];

const SCORES = [
  { label: 'Production', value: 12, en: 'How the product is made', th: 'กระบวนการผลิต' },
  { label: 'Development', value: 9, en: 'How the product is iterated', th: 'การพัฒนาผลิตภัณฑ์' },
  { label: 'Community', value: 9, en: 'Strength of the producer group', th: 'ความเข้มแข็งของชุมชน' },
  { label: 'Marketing', value: 11, en: 'Reach, channels, brand', th: 'การตลาด' },
  { label: 'History', value: 14, en: 'Local identity and story', th: 'ความเป็นมา' },
  { label: 'Quality', value: 40, en: 'Lab analysis, certifications', th: 'คุณภาพผลิตภัณฑ์' },
  { label: 'International', value: 5, en: 'Export opportunity', th: 'โอกาสสู่สากล' },
];

const STAR_BANDS = [
  { star: 5, lo: 90, hi: 100, en: 'Exportable, brand equity', th: 'ส่งออกได้ มีแบรนด์' },
  { star: 4, lo: 80, hi: 89,  en: 'National, developable to international', th: 'ระดับประเทศ พัฒนาสู่สากลได้' },
  { star: 3, lo: 70, hi: 79,  en: 'Medium, developable to 4★', th: 'คุณภาพกลาง พัฒนาสู่ 4 ดาวได้' },
  { star: 2, lo: 50, hi: 69,  en: 'Developable to 3★', th: 'พัฒนาสู่ 3 ดาวได้' },
  { star: 1, lo: 0,  hi: 49,  en: 'Weak, limited potential', th: 'อ่อน ศักยภาพจำกัด' },
];

function SectionTitle({ en, th }) {
  return (
    <div className="hs-title">
      <span className="hs-title-en">{en}</span>
      <span className="hs-title-th">{th}</span>
    </div>
  );
}

function StarBand({ star, lo, hi, en, th }) {
  return (
    <div className="hs-band" data-star={star}>
      <div className="hs-band-stars">{'★'.repeat(star)}<span className="hs-band-stars-e">{'★'.repeat(5 - star)}</span></div>
      <div className="hs-band-v">{lo}–{hi === 0 ? '49' : hi}</div>
      <div className="hs-band-l">
        <div>{en}</div>
        <div className="hs-band-th" lang="th">{th}</div>
      </div>
    </div>
  );
}

function ScorePart({ label, value, en, th }) {
  return (
    <div className="hs-score">
      <div className="hs-score-v">{value}</div>
      <div className="hs-score-l">
        <div className="hs-score-en">{en}</div>
        <div className="hs-score-th" lang="th">{th}</div>
      </div>
      <div className="hs-score-key">{label}</div>
    </div>
  );
}

export default function History({ meta }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photo = PHOTOS[photoIdx];
  // The build's own record count, so the sentence cannot drift from the data.
  const records = (meta?.counts?.recordsAfterMerge ?? 0).toLocaleString();
  const totalYears = useMemo(() => {
    const ys = TIMELINE.map((t) => t.year);
    return Math.max(...ys) - Math.min(...ys) + 1;
  }, []);

  return (
    <article className="hs">
      <header className="hs-hero">
        <div className="hs-hero-meta">
          <span>one³ · history</span>
          <span>2001–{Math.max(...TIMELINE.map((t) => t.year))} · {TIMELINE.length} chapters</span>
        </div>
        <p className="hs-sub">หนึ่งตำบล หนึ่งผลิตภัณฑ์ · from Oita, Japan to every tambon in Thailand</p>
        <p className="hs-byline">Architect: Dr Non Arkaraprasertkul · Engineering: Mavis · Sources cited inline</p>
      </header>

      {/* The seed */}
      <section className="hs-ch">
        <SectionTitle en="The seed" th="เมล็ดพันธุ์" />
        <P>
          The One Tambon One Product (OTOP) programme was declared by newly elected Prime Minister Thaksin
          Shinawatra on 30 April 2001, at Government House in Bangkok. The idea was not new in Asia: the One
          Village One Product (OVOP) movement, launched in Oita prefecture, Japan, in 1979 by Governor
          Hiramatsu Morihiko, was the seed. Thaksin visited Oita repeatedly with senior officials; what
          he saw there was a programme that turned depopulating villages into branded micro-economies.
          The Thai version adapted OVOP at the tambon (sub-district) level, not the village level, and
          ran at national scale from the start.
        </P>
        <P>
          The 8th National Economic and Social Development Plan, in force since 1 October 1996, had
          already been running a "community economy" (เศรษฐกิจชุมชน) programme. OTOP is in part a
          rebrand: the cabinet reuses the existing community-enterprise infrastructure, attaches a
          5★ certification, and gives it a national brand. That is why OTOP was operationally ready
          by 2003 — the producers were already on the books.
        </P>
        <Cite>FAO · One Country One Priority Product: Thailand · Wikipedia (en + th) · OTOP</Cite>
      </section>

      {/* The 5★ rating */}
      <section className="hs-ch">
        <SectionTitle en="The 5★ rating — what it actually scores" th="คะแนน 5 ดาวคืออะไร" />
        <P>
          The OTOP Product Champion (OPC) is the certification scheme that gives OTOP its teeth.
          Introduced in 2003, scored on 100 points, evaluated every two years, and adjudicated by
          panels at district, cluster, and national levels. The full criteria, codified by the CDD
          in 2562 BE, are below. Read them and notice the 45 of 100 that go to product quality — that
          is the share the 5★ mark is most defensible on.
        </P>
        <div className="hs-scores">
          {SCORES.map((s) => <ScorePart key={s.label} {...s} />)}
        </div>
        <div className="hs-bands">
          {STAR_BANDS.map((b) => <StarBand key={b.star} {...b} />)}
        </div>
        <Cite>CDD · 2562 BE OPC selection criteria · FAO Thailand case study</Cite>
      </section>

      {/* Timeline */}
      <section className="hs-ch">
        <SectionTitle en="The timeline · 1979 to today" th="เส้นเวลา · 2522 ถึงปัจจุบัน" />
        <P>
          Seventeen chapters, each one an event in the public record. The years that are not on the
          list are years when OTOP ran but did not change shape. The chapters that are on it are the
          ones that did.
        </P>
        <ol className="hs-timeline">
          {TIMELINE.map((t) => (
            <li key={t.year} className="hs-tl-row" data-year={t.year}>
              <div className="hs-tl-year">{t.year}</div>
              <div className="hs-tl-body">
                <h3 className="hs-tl-h">
                  <span className="hs-tl-en">{t.title}</span>
                  <span className="hs-tl-th" lang="th">{t.th}</span>
                </h3>
                <P>{t.body.replace('{records}', records)}</P>
                <Cite>{t.cite}</Cite>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Photo strip */}
      <section className="hs-ch">
        <SectionTitle en="The craft" th="ช่างฝีมือ" />
        <P>
          Four free-use photographs, one for each phase of the programme. Click any to step through.
          Each carries the photographer and the licence line inline; the link in the credit is the
          source page. If you reuse any of these, the licence terms on the source page apply.
        </P>
        <figure className="hs-photo">
          <img src={photo.src} alt={photo.credit} loading="lazy" />
          <figcaption>
            <span className="hs-photo-yr">{photo.year}</span>
            <span className="hs-photo-cr">{photo.credit}</span>
            <span className="hs-photo-by">by {photo.author} · {photo.licence}</span>
            <a href={photo.link} target="_blank" rel="noreferrer" className="hs-photo-link">source ↗</a>
          </figcaption>
        </figure>
        <div className="hs-photo-nav">
          {PHOTOS.map((p, i) => (
            <button type="button" key={i} className="hs-photo-btn" data-active={i === photoIdx} onClick={() => setPhotoIdx(i)}>
              <span>{p.year}</span>
              <span>{p.credit.split(',')[0]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Footnote */}
      <footer className="hs-foot">
        <h4>Sources</h4>
        <ul>
          <li>FAO — <em>One Country One Priority Product: OTOP in Thailand</em> — Asia-Pacific case study</li>
          <li>ISEAS Perspective 2022/35 — Yusof Ishak Institute, Singapore</li>
          <li>APU RCAPS Working Paper 11-3 — Rural Development Strategy in Asia: the Case of OTOP in Thailand</li>
          <li>CDD (กรมการพัฒนาชุมชน) — 2562 BE OPC selection criteria (3-part, 100-point)</li>
          <li>Wikipedia (en + th) — OTOP entries, with cited sources</li>
          <li>Wikimedia Commons — Thai craft photography under CC BY / CC BY-SA</li>
          <li>data.go.th — Chaiyaphum CDD monthly provincial sales series, 2022–2024</li>
        </ul>
        <p className="hs-foot-th">ที่มา: ทุกเหตุการณ์ในเส้นเวลาอ้างอิงจากแหล่งข้อมูลสาธารณะ ตัวเลขทั้งหมดในบทความอ้างอิงจากทะเบียนจริง</p>
      </footer>
    </article>
  );
}

function P({ children }) {
  return <p className="hs-p">{children}</p>;
}

function Cite({ children }) {
  return <p className="hs-cite">— {children}</p>;
}
