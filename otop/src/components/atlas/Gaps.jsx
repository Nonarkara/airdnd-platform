import { Chapter, n } from './fmt.jsx';
import Composition from './Composition.jsx';
import Bars from '../charts/Bars.jsx';

/**
 * Gaps — what the registry does NOT show, and what to do about each blank.
 *
 * Every number comes from `insights.gaps`, computed over the same corpus as
 * the other chapters. A gap with no honest denominator is not printed.
 * Each section ends with the one operational fix it points at.
 */
export default function Gaps({ gaps, go }) {
  if (!gaps) return null;
  const { funnel, darkness, desert, energy, silentTambons, temporal, standardsGap, revenueGap } = gaps;

  return (
    <Chapter id="gaps" q="What is missing — and what to do?" title="Gaps" th="ช่องว่างที่ต้องอุด">
      {/* ── 1 · the funnel ─────────────────────────────────────────── */}
      <p className="t-note">
        <strong>{n(funnel.distinctTitles)}</strong> dataset titles were cached from data.go.th.
        Only <strong>{n(funnel.usableTitles)}</strong> ever yielded a producer row —{' '}
        <strong>{n(funnel.silentTitles)}</strong> titles filed paperwork the registry cannot
        place. {n(funnel.resourcesSkipped)} resources were skipped for lack of a name or area
        column; {n(funnel.resourcesAggregateEconomic)} are money series, not producer lists.
      </p>
      <Composition
        parts={[
          { id: 'usable', label: `Usable titles (${n(funnel.usableTitles)})`, count: funnel.usableTitles, tone: 'is-ink' },
          { id: 'silent', label: `Silent titles (${n(funnel.silentTitles)})`, count: funnel.silentTitles, tone: 'is-hole' },
        ]}
        total={funnel.distinctTitles}
      />
      <p className="t-note">
        {n(funnel.rowsIn)} rows in → {n(funnel.rowsAccepted)} accepted →{' '}
        {n(funnel.records)} deduplicated producers ({n(funnel.duplicatesCollapsed)} duplicate
        filings collapsed). Fix: extend the field-alias dictionary against the skipped
        columns — each recovered alias turns silent titles into supply.
      </p>

      {/* ── 2 · category darkness ──────────────────────────────────── */}
      <h3 className="sub-h">Category darkness · {n(darkness.unclassified)} records without a category</h3>
      <p className="t-note">
        Beverages ({n(darkness.beverage)}) and non-food herbal ({n(darkness.herbal)}) are
        nearly invisible next to food — not because Thailand makes less of them, but because
        almost nobody files the category. The least-classified provinces:
      </p>
      <Bars
        label="Lowest classified share by province"
        onSelect={go}
        format={(v) => `${v}%`}
        rows={darkness.leastClassified.map((p) => ({ code: p.code, label: p.th, sub: `${n(p.records)} records`, value: p.classifiedPct }))}
      />
      <p className="t-note">
        Fix: make category a required field on the registration form — one dropdown
        recovers the whole product-domain chapter.
      </p>

      {/* ── 3 · contact desert ─────────────────────────────────────── */}
      <h3 className="sub-h">Contact desert · {desert.reachableShare}% reachable, {desert.withPrice}% priced</h3>
      <p className="t-note">
        {n(desert.hiddenChampions)} state-certified 4–5★ producers carry no contact channel;
        coordinates exist for {desert.withCoordinates}% of records. The worst gaps:
      </p>
      <Bars
        label="Most unreachable producers by province"
        onSelect={go}
        format={n}
        rows={desert.worstUnreachable.map((p) => ({ code: p.code, label: p.th, sub: `${p.reachable} reachable`, value: p.records - p.reachable }))}
      />
      <p className="t-note">
        Fix: add phone, price, and coordinates to the registration form — the single
        highest-ROI change in this entire atlas.
      </p>

      {/* ── 4 · filing energy ──────────────────────────────────────── */}
      <h3 className="sub-h">Filing energy ≠ supply · top ten hold {energy.top10Share}%</h3>
      <p className="t-note">
        Row counts measure how energetically a provincial office files, not how much is
        made there. {energy.mostTrusted?.th} is {energy.mostTrusted?.share}% corroborated;{' '}
        {energy.leastTrusted?.th} is {energy.leastTrusted?.share}%. Quadrants: {energy.quadrant.ready} ready
        to trade · {energy.quadrant.documented} documented but unreachable · {energy.quadrant.reachable} reachable
        but unverified · {energy.quadrant.blind} blind
        {energy.blindProvinces.length > 0 && (
          <> ({energy.blindProvinces.map((p) => p.th).join(', ')})</>
        )}.
        Fix: run the contact-drive in the blind provinces first — smallest denominator,
        largest relative lift.
      </p>

      {/* ── 5 · silent tambons + time ──────────────────────────────── */}
      <h3 className="sub-h">Silent ground · {n(silentTambons.silent)} tambons file nothing</h3>
      <p className="t-note">
        {n(silentTambons.withRecords)} of {n(silentTambons.reference)} reference tambons carry
        records. Of those that file, {n(silentTambons.buckets.one)} hold a single producer,{' '}
        {n(silentTambons.buckets.few)} hold 2–5, {n(silentTambons.buckets.cluster)} hold 6–20,
        and {n(silentTambons.buckets.basin)} are true basins (21+). Only {n(temporal.dated)} records{' '}
        ({temporal.datedShare}%) carry a filing year (median {temporal.median ?? '—'}
        {temporal.missingYearsCount > 0 && (
          <>, {temporal.missingYearsCount} years in {temporal.earliest}–{temporal.latest} filed nothing ({temporal.missingYears.join(', ')})</>
        )}
        ). Peak filing: {temporal.peak.map((y) => `${y.year} (${n(y.count)})`).join(' · ')}.
        Fix: backfill years on re-certification; visit the silent tambons before assuming
        they make nothing.
      </p>

      {/* ── 6 · standards + money ──────────────────────────────────── */}
      {standardsGap && (
        <>
          <h3 className="sub-h">Standards mismatch · who the specifications actually cover</h3>
          <p className="t-note">
            {standardsGap.map((s) => `${s.id} ${n(s.products)} products / ${n(s.standards)} standards`).join(' · ')}.
            Textile carries {n(standardsGap[0]?.productsPerStandard)} products per standard —
            the most under-specified shelf in the country.
            Fix: point the next มผช. drafting round at the highest-ratio category.
          </p>
        </>
      )}
      {revenueGap && (
        <p className="t-note">
          Money: {revenueGap.provincesWithData}/{revenueGap.provinces} provinces report sales
          ({(revenueGap.missing ?? []).join(', ') || 'none'} missing)
          {revenueGap.medianGapPct != null && (
            <>, and the two money filings disagree by a median {revenueGap.medianGapPct}% — read either series, never their average</>
          )}.
          Fix: require Bangkok's monthly filing before quoting a national total.
        </p>
      )}
    </Chapter>
  );
}
