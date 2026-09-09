/**
 * Demand/supply matching over the OTOP registry.
 *
 * ── What this data can and cannot answer ───────────────────────────────────
 *
 * A buyer's real questions are: can they make what I need, in the quantity I
 * need, to the standard I need, by when I need it? The OTOP registry answers
 * *none* of those. It records no capacity, no minimum order, no lead time, no
 * food-safety or export certification, and no evidence that a producer listed
 * in a 2020 filing is still trading.
 *
 * A matching engine that scored those anyway — inferring "capacity" from a star
 * rating, say — would be inventing the most consequential number on the page.
 * So this engine scores only what the registry actually attests, and every
 * result carries the caveats naming what it could not assess. The output is an
 * honest shortlist to go and verify, not a supplier ranking.
 *
 * ── What it does score ─────────────────────────────────────────────────────
 *
 *   contactability  can a buyer reach them at all — the binding constraint in
 *                   practice, and the field the registry is thinnest on
 *   assurance       OPC star grading, the state's own quality assessment
 *   freshness       how recent the filing is, as a liveness proxy
 *   corroboration   how many independent agencies attest the record
 *   locatability    resolved to tambon, district, or only province
 *
 * Every component is returned alongside the score, so the interface can show
 * *why* a producer ranks where it does rather than presenting a bare number.
 */

/**
 * Weights differ by who is asking, because the questions differ.
 *
 * A consumer needs to reach someone and buy a thing: contactability dominates,
 * and where they are matters because they may travel or arrange delivery.
 *
 * A business buyer is doing due diligence before committing a purchase order:
 * an independently corroborated, recently filed, formally graded producer is
 * worth more than an easily phoned one, because the phone call is cheap and
 * the failed order is not.
 */
export const PROFILES = {
  b2c: {
    label: 'Discover · B2C',
    weights: { contactability: 0.45, assurance: 0.20, freshness: 0.12, corroboration: 0.05, locatability: 0.18 },
  },
  b2b: {
    label: 'Source · B2B',
    weights: { contactability: 0.28, assurance: 0.27, freshness: 0.20, corroboration: 0.15, locatability: 0.10 },
  },
};

const CURRENT_YEAR = new Date().getUTCFullYear();

export function scoreComponents(record, { currentYear = CURRENT_YEAR } = {}) {
  // Contactability. A telephone number is worth more than a web presence
  // because it is what actually closes the loop with a village producer.
  let contactability = 0;
  if (record.phone) contactability = 1;
  else if (record.email) contactability = 0.6;
  else if (record.website) contactability = 0.45;

  // Assurance. Three distinct states the registry conflates at a glance:
  //   0     ไม่ผ่าน — assessed and NOT graded. A recorded negative.
  //   null  never assessed. Unknown, which is not the same as bad.
  //   1..5  assessed and passed, at a grade.
  // Ordering must be strict: failure < unknown < any pass. Mapping stars
  // linearly to stars/5 breaks that, because a verified 1-star (0.2) then ties
  // never-assessed (0.2) — and a recorded pass is stronger evidence than no
  // evidence at all. Passes are therefore banded above the unknown value.
  let assurance;
  if (record.stars == null) assurance = 0.2;
  else if (record.stars === 0) assurance = 0.1;
  else assurance = 0.3 + (record.stars / 5) * 0.7;

  // Freshness. Linear decay from full credit at <=2 years to zero at 10. An
  // unrecorded year is treated as weakly stale, not as fresh.
  let freshness;
  if (record.registeredYear == null) freshness = 0.2;
  else {
    const age = currentYear - record.registeredYear;
    freshness = age <= 2 ? 1 : Math.max(0, 1 - (age - 2) / 8);
  }

  const corroboration = record.sourceCount > 2 ? 1 : record.sourceCount === 2 ? 0.8 : 0.3;

  let locatability = 0.3;
  if (record.subdistrict && record.district) locatability = 1;
  else if (record.district || record.subdistrict) locatability = 0.6;

  return { contactability, assurance, freshness, corroboration, locatability };
}

export function scoreRecord(record, profile = 'b2b', options = {}) {
  const weights = (PROFILES[profile] ?? PROFILES.b2b).weights;
  const components = scoreComponents(record, options);
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + components[key] * weight, 0);
  return { score: Math.round(score * 1000) / 10, components };
}

/** What the engine could not assess, stated every time it returns anything. */
export const STRUCTURAL_CAVEATS = [
  'The registry records no production capacity, minimum order quantity or lead time.',
  'It records no food-safety, organic, Halal or export certification.',
  'A listing is a filing, not proof that the producer is still trading.',
  'Prices, where present, are from the filing year and are not current quotes.',
];

function dynamicCaveats(matches) {
  const out = [];
  if (matches.length === 0) return out;
  const noContact = matches.filter((m) => !m.record.phone && !m.record.email && !m.record.website).length;
  const ungraded = matches.filter((m) => m.record.stars == null).length;
  const stale = matches.filter((m) => m.record.registeredYear != null && CURRENT_YEAR - m.record.registeredYear > 5).length;
  const pct = (n) => Math.round((n / matches.length) * 100);

  if (noContact > 0) out.push(`${pct(noContact)}% of these matches (${noContact}) have no contact of any kind recorded.`);
  if (ungraded > 0) out.push(`${pct(ungraded)}% (${ungraded}) carry no OPC grading.`);
  if (stale > 0) out.push(`${pct(stale)}% (${stale}) were last filed more than five years ago.`);
  return out;
}

/** Count records by signal tier (0-3). */
export function tierCounts(matches) {
  const counts = [0, 0, 0, 0];
  for (const m of matches) counts[signalTier(m.record)] += 1;
  return { tier0: counts[0], tier1: counts[1], tier2: counts[2], tier3: counts[3] };
}

/**
 * A record has a "signal" when any of the following is true: it carries a
 * declared category, a contact channel (phone / email / website), a star
 * grading, or a product name distinct from its producer name. Records
 * without any of these — a registered OTOP number with nothing else attached
 * — pass the schema but carry nothing the interface can communicate, and
 * listing them at the same score is a category error: the engine says
 * "equally good" when the truth is "equally empty". `requireSignal` drops
 * them by default; the all-rows view remains one click away for the
 * completeness-first reader.
 */
function hasSignal(record) {
  if (record.category) return true;
  if (record.phone || record.email || record.website) return true;
  if (record.stars != null) return true;
  if (record.productName && record.producerName && record.productName !== record.producerName) return true;
  return false;
}

/**
 * Tiered signal strength. Instead of binary signal/no-signal, classify
 * records by how many of the three "commercial-ready" attributes they carry:
 *   Tier 3 (commercial-ready): category + contact + stars
 *   Tier 2 (partially attested): any 2 of {category, contact, stars}
 *   Tier 1 (signal): exactly 1 of {category, contact, stars}
 *   Tier 0 (name-only): none of these
 *
 * This lets the UI surface progressively more records without dumping the
 * reader into 146k empty rows.
 */
export function signalTier(record) {
  const hasCategory = Boolean(record.category);
  const hasContact = Boolean(record.phone || record.email || record.website);
  const hasStars = record.stars != null;
  const bits = (hasCategory ? 1 : 0) + (hasContact ? 1 : 0) + (hasStars ? 1 : 0);
  return bits; // 0-3, higher is better
}

/**
 * Rank records against a buyer's requirement.
 *
 * `requirement` is a plain object so it round-trips through a URL and a
 * requirement can be shared as a link — which is the whole point of putting a
 * sourcing brief on the web rather than in an email.
 */
export function matchRequirement(records, requirement = {}) {
  const {
    profile = 'b2b',
    categories = [],
    provinceCodes = [],
    regions = [],
    minStars = null,
    minTier = null,
    requireContact = false,
    requireCorroborated = false,
    requireSignal = false,
    maxFilingAge = null,
    query = '',
  } = requirement;

  const needle = String(query).trim().toLowerCase();

  const matches = records
    .filter((record) => {
      if (requireSignal && !hasSignal(record)) return false;
      if (minTier != null && signalTier(record) < minTier) return false;
      if (categories.length && !categories.includes(record.category)) return false;
      if (provinceCodes.length && !provinceCodes.includes(record.provinceCode)) return false;
      if (regions.length && !regions.includes(record.region)) return false;
      if (minStars != null && (record.stars == null || record.stars < minStars)) return false;
      if (requireContact && !record.phone && !record.email && !record.website) return false;
      if (requireCorroborated && record.sourceCount < 2) return false;
      if (maxFilingAge != null) {
        if (record.registeredYear == null) return false;
        if (CURRENT_YEAR - record.registeredYear > maxFilingAge) return false;
      }
      if (needle) {
        const hay = [record.productName, record.producerName, record.province, record.district, record.subdistrict]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .map((record) => ({ record, ...scoreRecord(record, profile) }))
    .sort((a, b) => b.score - a.score || (a.record.productName ?? '').localeCompare(b.record.productName ?? '', 'th'));

  return {
    matches,
    total: records.length,
    tiers: tierCounts(matches),
    caveats: [...dynamicCaveats(matches), ...STRUCTURAL_CAVEATS],
    profile,
  };
}

/**
 * Sourcing basins: provinces ranked by how much *usable* supply they hold for a
 * requirement, not merely how many rows they have.
 *
 * This is the question a business buyer actually has and a flat directory
 * cannot answer — "where can I meet six credible suppliers of this in one
 * trip?" Depth and redundancy in one administrative area are worth more than
 * the same count scattered across the country, because a single sourcing visit
 * and a single logistics run can cover them.
 */
export function sourcingBasins(matches, { minDepth = 2, top = 12 } = {}) {
  const byProvince = new Map();

  for (const match of matches) {
    const code = match.record.provinceCode;
    if (code == null) continue;
    if (!byProvince.has(code)) {
      byProvince.set(code, {
        code,
        province: match.record.province,
        provinceEn: match.record.provinceEn,
        region: match.record.region,
        matches: [],
      });
    }
    byProvince.get(code).matches.push(match);
  }

  return [...byProvince.values()]
    .map((basin) => {
      const depth = basin.matches.length;
      const reachable = basin.matches.filter((m) => m.record.phone || m.record.email || m.record.website).length;
      const graded = basin.matches.filter((m) => m.record.stars != null && m.record.stars >= 4).length;
      const districts = new Set(basin.matches.map((m) => m.record.district).filter(Boolean));
      const meanScore = basin.matches.reduce((n, m) => n + m.score, 0) / depth;

      return {
        code: basin.code,
        province: basin.province,
        provinceEn: basin.provinceEn,
        region: basin.region,
        depth,
        reachable,
        graded4Plus: graded,
        districts: districts.size,
        meanScore: Math.round(meanScore * 10) / 10,
        // Depth is what distinguishes a basin from a lone supplier, so it leads —
        // but only reachable depth counts, since a supplier you cannot phone is
        // not a supplier you can source from.
        basinScore: Math.round((reachable * 2 + graded + depth) * (meanScore / 100) * 10) / 10,
        top: basin.matches.slice(0, 3),
      };
    })
    .filter((basin) => basin.depth >= minDepth)
    .sort((a, b) => b.basinScore - a.basinScore)
    .slice(0, top);
}

/** Shortlist as CSV, so a sourcing brief leaves the browser and reaches a buyer. */
export function toCsv(matches) {
  const header = [
    'score', 'product', 'producer', 'category', 'stars', 'province', 'district', 'subdistrict',
    'phone', 'email', 'website', 'price_filed', 'filing_year', 'sources', 'dataset',
  ];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = matches.map(({ record, score }) => [
    score, record.productName, record.producerName, record.category, record.stars,
    record.province, record.district, record.subdistrict,
    record.phone, record.email, record.website, record.price, record.registeredYear,
    record.sourceCount, record.provenance?.map((p) => p.datasetTitle ?? p.datasetId).join(' | '),
  ].map(escape).join(','));
  return [header.join(','), ...rows].join('\n');
}
