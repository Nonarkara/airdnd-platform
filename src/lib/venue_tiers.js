/**
 * Venue type classification — Thai massage industry regulatory tiers.
 *
 * Four tiers derived from the industry insider framework (2024):
 *   Tier 1: อาบอบนวด — Government-licensed bath & massage
 *   Tier 2: สปา — Day spa (TAT licensing framework)
 *   Tier 3: นวดแผนไทย — Traditional Thai massage
 *   Tier 4: ไซด์ไลน์ — Freelance / sideline (unregistered, highest risk)
 *
 * Classification is keyword-based on name + description + raw text.
 * Used by the pipeline (listing_pipeline.js) to populate compliance_tier,
 * and by the analytics page (Analytics.jsx) for DDC reporting.
 */

export const VENUE_TIERS = [
  {
    key: 'licensed',
    tier: 1,
    label: 'อาบอบนวด · Licensed Bath & Massage',
    short: 'อาบอบนวด',
    keywords: ['อาบอบนวด', 'อ.อ.น', 'อาอบ'],
    risk: 'low',
    note: 'Government-registered. Mandatory VD testing & medical certificate every 2–3 months.',
  },
  {
    key: 'spa',
    tier: 2,
    label: 'สปา · Day Spa',
    short: 'สปา',
    keywords: ['สปา', ' spa', 'spa '],
    risk: 'moderate',
    note: 'Operating under TAT spa licensing framework. Voluntary health standards.',
  },
  {
    key: 'traditional',
    tier: 3,
    label: 'นวดแผนไทย · Traditional Thai',
    short: 'นวดแผนไทย',
    keywords: ['นวดแผนไทย', 'นวดไทย', 'แผนไทย'],
    risk: 'elevated',
    note: 'Most common category. Continuum from legitimate wellness to grey services.',
  },
  {
    key: 'freelance',
    tier: 4,
    label: 'ไซด์ไลน์ · Freelance / Sideline',
    short: 'ไซด์ไลน์',
    keywords: ['ไซด์ไลน์', 'sideline', 'ไซด์'],
    risk: 'high',
    note: 'No establishment oversight, no VD certification, no worker registration.',
  },
];

/**
 * Classify a listing into one of the four regulatory tiers.
 * Returns the tier key string, or 'unclassified' if no keywords match.
 *
 * @param {object} listing - must have name, description, rawText/raw_text
 * @returns {{ key: string, tier: number, risk: string }}
 */
export function classifyVenueTier(listing) {
  const text = `${listing.name || ''} ${listing.description || ''} ${listing.rawText || listing.raw_text || ''}`.toLowerCase();
  for (const tier of VENUE_TIERS) {
    if (tier.keywords.some((kw) => text.includes(kw))) {
      return { key: tier.key, tier: tier.tier, risk: tier.risk };
    }
  }
  return { key: 'unclassified', tier: 0, risk: 'unknown' };
}