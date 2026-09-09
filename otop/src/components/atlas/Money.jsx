import { Chapter, n, bnBaht } from './fmt.jsx';
import Sparkline from '../charts/Sparkline.jsx';
import Bars from '../charts/Bars.jsx';
import StackedBar from '../charts/StackedBar.jsx';
import { baht, MONTH_TH } from '../../lib/insights.js';

/** Where does the money move? The one layer here that measures the economy. */
export default function Money({ revenue, catalogue, go }) {
  if (!revenue) return null;
  const years = Object.keys(revenue.nationalAnnual).map(Number);
  const cat = revenue.byCategory;
  const rec = revenue.reconciliation;
  const catRows = cat ? cat.years.map((y) => ({
    label: `${y + 543} BE`,
    sub: `online ${Math.round((cat.national[y].online / Math.max(cat.national[y].total, 1)) * 1000) / 10}%`,
    values: Object.fromEntries(cat.categories.map((c) => [c.id, cat.national[y].categories[c.id]?.total ?? 0])),
  })) : [];
  const segOrder = cat ? [...cat.categories].sort((a, b) => (cat.national[cat.years[0]].categories[b.id]?.total ?? 0) - (cat.national[cat.years[0]].categories[a.id]?.total ?? 0)) : [];

  return (
    <Chapter id="money" q="Where does the money move?" title="Money" th="รายได้จากการจำหน่าย">
      <p className="t-note">
        Provincial sales aggregates from the Department of Community Development's monthly
        series (BE {Math.min(...years) + 543}–{Math.max(...years) + 543}).
        This is a <em>different dataset</em> from the producer registry: it says how much
        money moved, not who earned it. The two cannot be joined, and dividing these totals by
        registry row counts would turn filing energy into fake productivity — so this page refuses to.
        {catalogue?.resourcesAggregateEconomic != null && (
          <>
            {' '}The catalogue holds {catalogue.resourcesAggregateEconomic} such series under{' '}
            {catalogue.aggregateTitles} titles, almost all single-province, single-year filings.
            Only this one covers all 77 provinces, which is why it is the one used.
          </>
        )}
      </p>

      {revenue.nationalMonthly && (
        <Sparkline
          points={revenue.nationalMonthly.map((m) => ({ label: `${MONTH_TH[m.month]} ${m.year + 543}`, value: m.value }))}
          format={baht}
          label="National monthly OTOP sales, sum of reporting provinces"
        />
      )}
      <Bars
        label="Annual national OTOP sales"
        rows={Object.entries(revenue.nationalAnnual).sort(([a], [b]) => b - a).map(([year, a]) => ({
          label: `${Number(year) + 543} BE · ${year} CE${a.months < 12 ? ` (${a.months} months)` : ''}`, value: a.total,
        }))}
        format={bnBaht}
      />

      {cat && (
        <>
          <h3 className="sub-h">By category and channel · the annual filing</h3>
          <StackedBar rows={catRows} segments={segOrder.map((c) => ({ id: c.id, label: c.en }))} format={baht}
            label="National OTOP sales by product category per year, with online share" />
          <p className="t-note">
            A second table from the same department (resource <code>{cat.resourceId.slice(0, 8)}</code>): annual, by the five
            OTOP categories, offline and online.{' '}
            {rec && (
              <>
                <strong>It does not agree with the monthly series.</strong> Over the {rec.comparedProvinceYears} province-years both
                hold in full, {rec.matching} match within 1% and {rec.mismatching} differ, median gap {rec.medianGapPct}%.
                Neither is corrected toward the other; both are shown under their own resource id.
              </>
            )}
            {cat.excluded?.length > 0 && (
              <> {cat.excluded.map((e) => `${e.th} ${e.year + 543}`).join(', ')} excluded: {cat.excluded[0].reason}.</>
            )}
          </p>
        </>
      )}

      <h3 className="sub-h">Top ten provinces · {revenue.latestFullYear + 543} BE, latest full year</h3>
      {revenue.coverage.provincesMissing.length > 0 && (
        <p className="t-note">{revenue.coverage.provincesMissing.join(', ')} report{revenue.coverage.provincesMissing.length === 1 ? 's' : ''} no values in any month — {revenue.coverage.provincesWithData}/{revenue.coverage.provinces} provinces carry data.</p>
      )}
      <Bars label="Top ten provinces by annual OTOP sales" onSelect={go} format={bnBaht}
        rows={revenue.top10.map((p) => ({ code: p.code, label: p.th, sub: p.en, value: p.total }))} />
      <p className="t-note">{n(revenue.top10.length)} rows. Open a province for its own monthly series.</p>
    </Chapter>
  );
}
