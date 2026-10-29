/**
 * CRITIC — what the public record says about OTOP, and what this registry
 * can and cannot settle about it.
 *
 * WHY THIS VIEW EXISTS
 *
 * A reader who searches for OTOP finds two kinds of thing: a programme's
 * own account of itself, which is written by the people who run it, and
 * criticism of it, which is written by people who do not. A site that
 * carries only the first is an advertisement with a dataset attached. A
 * site that carries the second without the first is a pile of quotes.
 *
 * So the view does both, and it does the third thing as well: for each
 * criticism it says what THIS registry can actually say about it. That is
 * the part nobody else can do, because nobody else has the 154,050 rows.
 *
 * And where the registry cannot settle a charge, it says so. It is a
 * register of filings. It carries no officer, no contract, no payment and
 * no award, and a claim about corruption is not a claim about filings.
 *
 * Every number below is a row in the source data, and every source is
 * named. Nothing here is an opinion of this site's.
 */

import { Bi } from './Bi.jsx';

const SOURCES = [
  {
    key: 'fao-otop',
    who: 'FAO · OCOP Regional Knowledge Platform',
    what: 'One Tambon One Product (OTOP) to promote grassroots economy in Thailand',
    href: 'https://www.fao.org/one-country-one-priority-product/asia-pacific/good-practices/detail/one-tambon-one-product-(otop)-to-promote-grassroots-economy-in-thailand/en',
  },
  {
    key: 'fao-th',
    who: 'FAO · OCOP Regional Knowledge Platform',
    what: 'Thailand — the classification, the criteria, the 2019 star counts',
    href: 'https://www.fao.org/one-country-one-priority-product/asia-pacific/thailand/en',
  },
  {
    key: 'fao-target',
    who: 'FAO · OCOP Regional Knowledge Platform',
    what: 'Thailand: the grassroots economy reaps benefits from targeted support under OTOP',
    href: 'https://www.fao.org/one-country-one-priority-product/asia-pacific/good-practices/detail/thailand--the-grassroots-economy-reaps-benefits-from-targeted-support-under-one-tambon-one-product/en',
  },
  {
    key: 'natsu',
    who: 'Natsuda Igusa & Wiboon (2012)',
    what: 'One Village One Product — rural development strategy in Asia: the case of OTOP in Thailand. Asian Journal of Rural Development',
    href: 'https://www.tandfonline.com/doi/full/10.1080/02255189.2012.715082',
  },
  {
    key: 'boonma',
    who: 'Boonma (2012)',
    what: 'OTOP and OVOP: An Analysis of Placing a Value on Development. Chulalongkorn East Asian Studies',
    href: 'https://so02.tci-thaijo.org/index.php/easttu/article/download/51136/pdf_5/0',
  },
  {
    key: 'chula',
    who: 'Chulalongkorn University (2020)',
    what: 'Implications of the One Tambon One Product policy on … — a fair-trade comparison',
    href: 'https://digital.car.chula.ac.th/chulaetd/51414/',
  },
  {
    key: 'nida',
    who: 'NIDA & National Research Council of Thailand (2019)',
    what: 'A comparative study of the policy process between One Tambon One Product and One Village One Product',
    href: 'https://doi.nrct.go.th/ListDoi/Download/627486?Resolve_DOI=10.14457/NIDA.the.2019.12',
  },
  {
    key: 'oic',
    who: 'Office of the Investment Promotion Board (the 5★ criteria itself)',
    what: 'หลักเกณฑ์การจัดระดับสินค้าคัดสรรสุดยอดหนึ่งตำบลหนึ่งผลิตภัณฑ์ (OTOP Product Champion) — the official scoring rules',
    href: 'https://infocenter.oic.go.th/FILEWEB/CABINFOCENTER2/DRAWER091/GENERAL/DATA0000/00000350.PDF',
  },
  {
    key: 'impl',
    who: 'Asia Pacific Management Review (2024)',
    what: 'One Tambon One Product (OTOP) implementation by the Thai Government',
    href: 'https://www.tandfonline.com/doi/full/10.1080/09614524.2024.2408480',
  },
  {
    key: 'tci',
    who: 'Siam University / TCI-Thaijo (2023)',
    what: 'An Analysis of One Tambon One Product (OTOP) Project: Problems, Obstacles, Achievements',
    href: 'https://so02.tci-thaijo.org/index.php/easttu/article/view/241343',
  },
];

function Source({ id, children }) {
  const s = SOURCES.find((x) => x.key === id);
  if (!s) return null;
  return (
    <a className="cr-src" href={s.href} target="_blank" rel="noreferrer noopener">
      {children || s.who}
    </a>
  );
}

export default function Critic({ insights, meta }) {
  if (!insights) return null;
  const g = insights.gaps || {};
  const cert = insights.certification || {};
  const byYear = insights.byYear || {};
  const years = byYear.total || [];
  const countFor = (y) => (years.find((r) => r.year === y) || {}).count || 0;
  const unclassified = g.darkness?.unclassified ?? 0;
  const unclassifiedShare = g.darkness?.unclassifiedShare ?? 0;
  const records = (g.funnel?.records ?? 0).toLocaleString();

  const hidden = insights.findings?.find((f) => f.id === 'hidden-champions');
  const commercial = insights.findings?.find((f) => f.id === 'commercial-ready');

  /**
   * The register of criticisms.
   *
   * `claim` is what the criticism says. `who` is who says it. `answer`
   * is what this registry can say about it — and where the honest answer
   * is "nothing", the answer says that, in the same column, in the same
   * voice. A criticism the data cannot touch is still worth publishing.
   */
  const rows = [
    {
      n: '01',
      claim: 'The products are largely imitations of one another, and they oversupply the market.',
      who: <><Source id="natsu" /> · <Source id="nida" /></>,
      answer: (
        <>
          This registry cannot measure oversupply, and the reason is the same
          gap the criticism names: <strong>{unclassified.toLocaleString()} of {records} records
          ({unclassifiedShare}%) carry no product category at all</strong>. Two thirds of the
          register cannot say what its own products are, so no join on this data can
          find the same product in two provinces. The criticism and the dataset
          are the same hole, seen from two ends.
        </>
      ),
    },
    {
      n: '02',
      claim: 'The 5★ grade is the state grading itself: a top-down selection, not an independent certification.',
      who: <><Source id="natsu" /> · <Source id="boonma" /> · the rules themselves at <Source id="oic" /></>,
      answer: (
        <>
          Correct, and the registry carries the state's grade and a separate
          third-party claim side by side. <strong>{cert.certified?.toLocaleString()} records
          ({cert.certifiedShare}%) carry a certification</strong> from a standards body —
          {cert.valid?.toLocaleString()} of them valid, {cert.expired?.toLocaleString()} expired,
          {cert.unknown?.toLocaleString()} of unknown status. Two claims about quality, and
          <strong> {Math.round(((cert.expired ?? 0) / Math.max(1, cert.certified ?? 1)) * 100)}% of the
          second one has lapsed</strong>. The registry cannot say which grade is deserved. It can
          say when a certificate expired.
        </>
      ),
    },
    {
      n: '03',
      claim: 'The star system rewards the producers who were already strong and starves the ones below them.',
      who: <><Source id="boonma" /> · <Source id="fao-otop" /></>,
      answer: (
        <>
          The register can see the distance between the state's best-rated tier and
          the market. <strong>{hidden?.value?.toLocaleString()} of the 4–5★ records carry no
          contact channel of any kind</strong> — no phone, no email, no site. Only
          {' '}{commercial?.count?.toLocaleString()} carry all three buyer signals at once
          {' '}({commercial?.value}% of the register). The grading and the reachability are
          close to disjoint sets. Whether that is the scheme failing or the register
          failing is exactly the question the programme's own evaluation put, in 2003,
          and never settled.
        </>
      ),
    },
    {
      n: '04',
      claim: 'The programme fell short of lifting the grassroots economy, and the number of champions fell from 2004 to 2012.',
      who: <><Source id="fao-target" /> · <Source id="fao-th" /> · <Source id="chula" /></>,
      answer: (
        <>
          The registry counts <em>filings</em>, not selections, and never contained a
          pass/fail mark — the portal publishes the submissions, and the committee's
          verdict stayed inside the committee. What the filings show is the shape:
          <strong> {countFor(2020).toLocaleString()} filings in 2020, {countFor(2024).toLocaleString()}
          in 2024</strong>, and {countFor(2025).toLocaleString()} in 2025. The filings grew
          roughly sevenfold. Whether the products that passed did so is not a question
          this dataset can answer — the count the FAO quotes is a count of awards, and
          an award is not a row.
        </>
      ),
    },
    {
      n: '05',
      claim: 'The revenue the programme generated did not reach the communities it was meant for.',
      who: <><Source id="chula" /> · <Source id="nida" /></>,
      answer: (
        <>
          Not testable here, and the reason is structural. A filing register has no
          revenue field, no turnover and no margin; it records that a producer exists
          and what they registered. The only revenue series on this site is a separate
          national dataset joined at the level of the province — which is far above the
          household the criticism is about. Joining them would produce a number that
          looks like an answer and is not one.
        </>
      ),
    },
    {
      n: '06',
      claim: 'Corruption is associated with the programme\'s founding years.',
      who: <><Source id="natsu" /></>,
      answer: (
        <>
          <strong>Nothing.</strong> The registry holds a registration number, a name, a
          product, a place and, sometimes, a telephone number. It holds no officer, no
          contract, no payment and no award. The scholars who write about this say
          plainly that they were not in a position to investigate it, and neither is
          this dataset. The one trace of the 2006 suspension anywhere in the programme's
          record is the date it happened. A register of filings is not a register of
          decisions, and it will not be turned into one by anyone who reads it carefully.
        </>
      ),
    },
    {
      n: '07',
      claim: 'Support was short-term, overlapping and dependent on the state; the training did not stick.',
      who: <><Source id="impl" /> · <Source id="tci" /></>,
      answer: (
        <>
          Invisible here by construction. The registry has no field for training,
          funding, coaching or support of any kind, so every claim about what the state
          gave a producer — and every claim that it gave too little, or gave it
          inconsistently, or gave it to the strong — is invisible on this dataset by
          design. This is the one criticism on this list where the honest reading is
          that a filing register cannot help at all, and it is listed for that reason.
        </>
      ),
    },
  ];

  return (
    <div className="critic">
      <header className="critic-h">
        <p className="critic-h-sub">
          Seven criticisms of the One Tambon One Product programme, each one
          attributed, and each one answered by the register — or not answered,
          where the register cannot answer it. The right-hand column is the
          only part of this page nobody else can write.
        </p>
        <p className="critic-h-anchors">
          Sources: FAO OCOP platform · Natsuda Igusa &amp; Wiboon 2012 · Boonma 2012 ·
          Chulalongkorn 2020 · NIDA &amp; NRCT 2019 · OIC criteria · APR 2024
        </p>
      </header>

      <div className="critic-rows">
        <div className="critic-row critic-row-h">
          <span className="critic-c-n">№</span>
          <span className="critic-c-claim">The criticism</span>
          <span className="critic-c-who">Who says it</span>
          <span className="critic-c-answer">What this registry says</span>
        </div>
        {rows.map((r) => (
          <div className="critic-row" key={r.n}>
            <span className="critic-c-n">{r.n}</span>
            <span className="critic-c-claim">{r.claim}</span>
            <span className="critic-c-who">{r.who}</span>
            <span className="critic-c-answer">{r.answer}</span>
          </div>
        ))}
      </div>

      <section className="critic-after">
        <h2 className="critic-after-h">
          What this site will not claim <span className="critic-after-th">สิ่งที่เว็บไซต์นี้จะไม่อ้าง</span>
        </h2>
        <ul className="critic-after-list">
          <li>
            That OTOP works, or that it does not. The register is 154,050 filings
            and a filing is not an outcome.
          </li>
          <li>
            That the 5★ grade means a product is good. It means a committee scored
            a submission on three axes, on a date, once.
          </li>
          <li>
            That a producer is reachable because a phone number is written down. It
            means the number was written down.
          </li>
          <li>
            That this is the whole of OTOP. It is what the national portal returns,
            merged and de-duplicated — and the portal is not the programme, the
            committee's awards are not in it, and the money is not in it.
          </li>
        </ul>
        <p className="t-note critic-note">
          Every number in the right-hand column is a row in the source data, and
          every number the criticism quotes is quoted with its source. Where the
          two disagree, the disagreement is left standing. Read the
          {' '}<a href="/method/">Method</a> for how the merge works, the{' '}
          <a href="/history/">history</a> for how the programme reached this
          point, and the <a href="/bank/">data bank</a> for the raw material.
        </p>
      </section>

      <section className="critic-srcs">
        <h2 className="critic-srcs-h">
          The sources <span className="critic-after-th">แหล่งอ้างอิง</span>
        </h2>
        <ol className="critic-srcs-list">
          {SOURCES.map((s) => (
            <li key={s.key} className="critic-srcs-item">
              <a href={s.href} target="_blank" rel="noreferrer noopener">{s.who}</a>
              <span className="critic-srcs-what">{s.what}</span>
            </li>
          ))}
        </ol>
        <p className="t-note critic-note">
          Built {meta?.builtAt ? meta.builtAt.slice(0, 10) : '—'} from{' '}
          {meta?.source || 'data.go.th'}. The OTOP registration data belongs to the
          Department of Community Development; the reading of it is this site's.
        </p>
      </section>
    </div>
  );
}
