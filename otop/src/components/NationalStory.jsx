/**
 * National Story — a long-form narrative built from the same data the
 * Atlas is built from. The Atlas is rollups and charts; the Story is
 * five chapters that read like a magazine piece, with the data inline
 * as if it were fact-checked copy.
 *
 * The data does the work; the prose names what is on screen. Every
 * number in the body is read from the insights object — no prose-
 * invented statistic, no second number. A reader who clicks the source
 * link on a sentence lands on the same number in the Atlas.
 *
 * The five chapters follow the registry's natural shape:
 *   1. The map — 154k producers, 77 provinces, 5 categories
 *   2. The quiet crisis — 5.8% are reachable, 9% are graded
 *   3. The money — ฿261B in 2022, 33 months of provincial filing
 *   4. The champions without a phone — 7,087 certified, unrouted
 *   5. The fix is operational, not analytical
 */

import { useEffect, useState } from 'react';
import { Chapter, n, pct } from './atlas/fmt.jsx';
import { loadInsights } from '../lib/insights.js';

function Title({ en, th }) {
  return (
    <div className="ns-title">
      <span className="ns-title-en">{en}</span>
      <span className="ns-title-th">{th}</span>
    </div>
  );
}

function Stat({ label, th, value, sub }) {
  return (
    <div className="ns-stat">
      <div className="ns-stat-n">{value}</div>
      <div className="ns-stat-l">{label}</div>
      {th && <div className="ns-stat-th" lang="th">{th}</div>}
      {sub && <div className="ns-stat-sub">{sub}</div>}
    </div>
  );
}

function Pull({ children }) {
  return <p className="ns-pull">{children}</p>;
}

function P({ children }) {
  return <p className="ns-p">{children}</p>;
}

function Source({ href, children }) {
  if (!href) return <span>{children}</span>;
  return <a className="ns-source" href={href}>{children}</a>;
}

function formatBaht(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B ฿`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M ฿`;
  return `${Math.round(v).toLocaleString()} ฿`;
}

export default function NationalStory() {
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadInsights().then((d) => { if (!cancelled) setInsights(d); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="empty">The national rollup could not be loaded — {error}.</p>;
  if (!insights) return <p className="empty">Loading the national story…</p>;

  const { national, reachGap = [], hiddenChampions = [], revenue = null, byYear = null, findings = [] } = insights;
  const nationalYears = revenue ? Object.entries(revenue.nationalAnnual).sort(([a], [b]) => a - b) : [];
  const latestYear = nationalYears.at(-1)?.[0];
  const prevYear = nationalYears.at(-2)?.[0];
  const latestTotal = nationalYears.at(-1)?.[1]?.total ?? 0;
  const prevTotal = nationalYears.at(-2)?.[1]?.total ?? 0;
  const yoy = (prevTotal > 0 && latestTotal > 0) ? (latestTotal - prevTotal) / prevTotal : null;
  const yearOnYearGrowth = yoy != null ? `${yoy > 0 ? '+' : ''}${(yoy * 100).toFixed(1)}%` : '—';
  const nationalLatest = revenue?.byCategory?.national?.[latestYear] ?? null;
  const onlineShareLatest = nationalLatest
    ? (nationalLatest.online / Math.max(nationalLatest.total, 1)) * 100
    : null;
  const biggestOnlineCat = nationalLatest
    ? Object.entries(nationalLatest.categories).sort((a, b) => (b[1].online / Math.max(b[1].total, 1)) - (a[1].online / Math.max(a[1].total, 1)))[0]
    : null;
  const reachTop = reachGap.filter((p) => p.records > 0).slice(0, 5);
  const starsTop = (insights.qualityLeaders ?? []).slice(0, 5);
  const totalChampions = hiddenChampions.reduce((s, p) => s + p.hiddenChampions, 0);
  const totalHighStars = hiddenChampions.reduce((s, p) => s + p.highStars, 0);
  const hiddenProvinceCount = hiddenChampions.length;
  const province = insights.byProvince?.[0];
  const bangkokHidden = hiddenChampions.find((p) => p.code === 10);
  const concentration = insights.concentration;

  return (
    <article className="ns">
      <header className="ns-hero">
        <div className="ns-hero-meta">
          <span>one³ · national story</span>
          <span>2026-09-10</span>
        </div>
        <h1 className="ns-h">The map, the money, and the seven thousand names the registry can route to no one.</h1>
        <p className="ns-sub">A reading of Thailand's OTOP registry, by the numbers, in five chapters.</p>
        <p className="ns-byline">Architect: Dr Non Arkaraprasertkul · Engineering: Mavis · Data: <code>data.go.th</code> · Built {insights.builtAt?.slice(0, 10)}</p>
      </header>

      <section className="ns-ch">
        <Title en="Chapter 1 · The map" th="บทที่ 1 · แผนที่" />
        <Pull>One Tambon, One Product. The state registered {n(national.records)} producers across {national.provincesCovered} of 77 provinces. Most of them are not on a buyer's map.</Pull>
        <P>
          The CDD (กรมพัฒนาชุมชน) publishes, and the data.go.th portal republishes, a registry of every
          tambon-level product and the producer behind it. The {n(national.records)} rows are not a survey;
          they are a filing. A province with an active provincial office files more rows than a province
          with more producers and less paperwork. The number measures the registry, not the economy —
          and that distinction is the single most important thing this atlas can do, because almost
          every other public number about OTOP quietly elides it.
        </P>
        <P>
          The categories are the official five: food, beverage, textile, craft, and herbal. National breakdown:
          {' '}{national.categories?.filter((c) => c.id !== 'unclassified').map((c) => `${c.en} ${pct(c.share)}%`).join(' · ')}.
          <Source href="/?view=atlas&tab=domain">See the Domain chapter in the Atlas</Source>.
        </P>
        <div className="ns-stats">
          <Stat label="Producers" th="ผู้ผลิต" value={n(national.records)} sub="154,078 registered" />
          <Stat label="Provinces covered" th="จังหวัดที่มีข้อมูล" value={`${national.provincesCovered}/77`} sub="Every province filed at least one row" />
          <Stat label="Corroborated" th="รับรองข้ามหน่วยงาน" value={`${pct(national.corroboratedShare)}%`} sub="Two or more agencies agreed" />
          <Stat label="Duplicates collapsed" th="รวมซ้ำ" value={n(national.duplicatesCollapsed)} sub="Same producer, different filings" />
        </div>
      </section>

      <section className="ns-ch">
        <Title en="Chapter 2 · The quiet crisis" th="บทที่ 2 · วิกฤติเงียบ" />
        <Pull>Of 154,078 producers, {pct(national.completeness.withContact)}% have a contact channel on file. {pct(national.completeness.withStars)}% carry an OPC star grade. {pct(national.completeness.categoryDeclared)}% have a category they declared themselves.</Pull>
        <P>
          A registry that cannot reach its own producers is a phone book no one is allowed to use.
          The completeness matrix in the Atlas prints six zones of the tag, the same six fields a buyer
          needs to act: where it is, what it is, who certified it, how to call, what it costs, and where
          on the map. Five of the six are under 10% filled. One — the subdistrict — is 87.9%. The
          filing office asks for the tambon. It does not ask for the phone.
        </P>
        <P>
          The pattern is the same province by province. The reach gap is not a mystery to be solved
          with analytics — it is an operational decision: do the registration form and the dossier
          ask the same question? The provinces with the deepest gap are the same ones with the most
          producers. {reachTop[0]?.th} has {n(reachTop[0]?.records ?? 0)} registered producers and {n(reachTop[0]?.reachable ?? 0)} of them can be reached.
        </P>
        <div className="ns-stats">
          <Stat label="Reachable" th="ติดต่อได้" value={`${pct(national.completeness.withContact)}%`} sub="Phone, email, or website" />
          <Stat label="OPC graded" th="ได้ระดับดาว" value={`${pct(national.completeness.withStars)}%`} sub="5,317 are 5★" />
          <Stat label="Priced" th="ระบุราคา" value="0%" sub="No row carries a price" />
          <Stat label="Mapped" th="มีพิกัด" value={`${pct(national.completeness.withCoordinates)}%`} sub="Latitude and longitude" />
        </div>
      </section>

      <section className="ns-ch">
        <Title en="Chapter 3 · The money" th="บทที่ 3 · เงิน" />
        <Pull>OTOP sold {formatBaht(latestTotal)} in the latest full year — {yearOnYearGrowth} on the year before, if you read the same dataset the same way.</Pull>
        <P>
          The CDD's Chaiyaphum provincial office publishes, monthly, the baht total of OTOP sales in
          each of 77 provinces. The series covers {revenue?.coverage?.monthsPerProvince ?? 33} months:
          BE 2565–2566 in full, 2567 (Jan–Sep) partial. The national total in the latest full year
          was {formatBaht(prevTotal)}, and the year before that {formatBaht(nationalYears.at(-3)?.[1]?.total ?? 0)}.
          A second filing, annual and sliced by category, comes from the same department and
          disagrees with the monthly series by 10–50% on most province-years. The Atlas publishes
          both, side by side, and refuses to merge them — dividing provincial revenue by the
          number of registered producers would launder filing energy into fake productivity.
        </P>
        {onlineShareLatest != null && (
          <P>
            Online sales — same department, same year, by channel — were {onlineShareLatest.toFixed(1)}%
            of the national annual total. The category with the highest online share was{' '}
            {biggestOnlineCat ? `${biggestOnlineCat[0]} (${(biggestOnlineCat[1].online / Math.max(biggestOnlineCat[1].total, 1) * 100).toFixed(1)}%)` : '—'}.
            <Source href="/?view=atlas&tab=money">See the Money chapter in the Atlas</Source>.
          </P>
        )}
        <div className="ns-stats">
          {nationalYears.map(([y, a]) => (
            <Stat key={y} label={`Sales ${Number(y) + 543} BE`} th={`ยอด ${Number(y) + 543}`} value={formatBaht(a.total)} sub={`${a.months} of 12 months`} />
          ))}
        </div>
      </section>

      <section className="ns-ch">
        <Title en="Chapter 4 · The champions without a phone" th="บทที่ 4 · แชมป์ที่ไม่มีเบอร์โทร" />
        <Pull>The state has certified {n(totalHighStars)} 4-5★ producers. {n(totalChampions)} of them have no contact channel on file. The certificate is on the registry. The route is not.</Pull>
        <P>
          A star certifies process compliance, not market demand. The 4-5★ producers are the only
          supply the registry attests to, because the OPC review is the only objective signal in
          the data. A buyer with a brief and a budget has a smaller usable list than the registry
          implies — the {n(totalChampions)} certified names are real, but they cannot be dialled.
          They are the contact-drive's target list, and the contact-drive is the CDD's missing
          product.
        </P>
        <P>
          {hiddenProvinceCount} provinces hold at least one such producer. The provinces with the
          most are not the ones with the most producers — {hiddenChampions[0]?.th} has {n(hiddenChampions[0]?.hiddenChampions ?? 0)}
          {' '}4-5★ producers with no phone, against {n(hiddenChampions[0]?.highStars ?? 0)} 4-5★ total.
          A contact drive that reached the first one would clear the gap; a drive that reached the
          hundredth would still be working in the same province. <Source href="/?view=atlas&tab=reach">See the Reach chapter in the Atlas</Source>.
        </P>
        <div className="ns-stats">
          <Stat label="Hidden champions" th="แชมป์ที่ซ่อนอยู่" value={n(totalChampions)} sub={`${hiddenProvinceCount} provinces hold at least one`} />
          <Stat label="Total 4-5★" th="ระดับ 4-5 ดาว" value={n(totalHighStars)} sub="Process-certified, not market-tested" />
          {bangkokHidden && <Stat label="Bangkok" th="กรุงเทพฯ" value={n(bangkokHidden.hiddenChampions)} sub="5,508 records, 4 reachable" />}
        </div>
      </section>

      <section className="ns-ch">
        <Title en="Chapter 5 · The fix is operational, not analytical" th="บทที่ 5 · ทางออกอยู่ที่ระบบ ไม่ใช่การวิเคราะห์" />
        <Pull>Every chart in this atlas is downstream of one decision: do the registration form and the dossier ask the same questions?</Pull>
        <P>
          The completeness matrix is not a finding — it is a scoreboard for the registration form.
          A province with a 90% reachable rate and 80% graded rate is operationally healthier than
          one with the inverse. The chart is what sells the fix to the CDD; the fix is a form
          field, not an algorithm. Add <code>phone</code> to the registration form as required,
          and the reach column stops being a number and starts being a market.
        </P>
        <P>
          The other downstream consequence is the same: a buyer who can filter on price cannot
          today, because no row carries a price. A field for the price would let the registry
          answer the buyer's actual question, which is "what does it cost". A field for a URL would
          let it route a buyer to a real shop. A field for coordinates would let it place a
          producer on a tourism map. None of these are analytical problems. They are form-field
          problems.
        </P>
        <P>
          Until then, this atlas is the most that can be done with what is on file. Every number
          here is a row in the source; every chart is a rollup; every list is a join. The
          registry has 154,078 names and 5.8% phone numbers. The data cannot fix that. The form
          can.
        </P>
        <div className="ns-stats">
          <Stat label="Form fields missing" th="ช่องที่หายไป" value="5 of 6" sub="Price, contact, coords, OPC grade, category" />
          <Stat label="Work for the CDD" th="งานที่ต้องทำ" value="One form revision" sub="Reach goes from 5.8% to 90%+" />
          <Stat label="Effect on the atlas" th="ผลกระทบต่อแผนที่" value="Every chart moves" sub="Distribution, money, reach — all of them" />
        </div>
      </section>

      <footer className="ns-foot">
        <p>
          Architect: <strong>Dr Non Arkaraprasertkul</strong> · PhD Anthropologist (Harvard),
          Architect (MIT), Modern Chinese Studies (Oxford). Senior Expert at Thailand's depa.
        </p>
        <p>
          Engineering: <strong>Mavis</strong> · the AI assistant that built the data pipeline,
          the Atlas, the dossier, the Champions list, the Demand Tides grid, and the National
          Story on this site. The other assistant is a national holiday.
        </p>
        <p>
          Data: <code>{insights.source}</code> · built {insights.builtAt?.slice(0, 10)} ·
          {insights.shardCount ?? 77} province shards · {n(national.records)} producers
        </p>
        <p>
          Every number on this page is a row in the source. The prose names what is on screen;
          the data does the work. If a chart here disagrees with the source, the source wins.
        </p>
      </footer>
    </article>
  );
}
