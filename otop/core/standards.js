/**
 * Community Product Standards (มผช. / Thai Community Product Standards - TCPS).
 *
 * Published by the Thai Industrial Standards Institute (TISI / สมอ., Ministry of Industry).
 * Each standard sets technical quality specifications (moisture, microbial thresholds,
 * packaging, and hygiene rules) for community-produced goods.
 */

export const STANDARD_CATEGORY_MAP = {
  'อาหาร': 'food',
  'เครื่องดื่ม': 'beverage',
  'ของใช้-ของตกแต่ง-ของที่ระลึก': 'decor',
  'ของใช้ ของตกแต่ง ของที่ระลึก': 'decor',
  'ผ้า เครื่องแต่งกาย': 'textile',
  'ผ้าและเครื่องแต่งกาย': 'textile',
  'สมุนไพรที่ไม่ใช่อาหาร': 'herbal',
};

/**
 * Normalizes raw Thai product group name to canonical OTOP category ID.
 * @param {string} raw
 * @returns {'food'|'beverage'|'decor'|'textile'|'herbal'|null}
 */
export function normalizeStandardCategory(raw) {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (STANDARD_CATEGORY_MAP[cleaned]) return STANDARD_CATEGORY_MAP[cleaned];
  for (const [k, v] of Object.entries(STANDARD_CATEGORY_MAP)) {
    if (cleaned.includes(k) || k.includes(cleaned)) return v;
  }
  return null;
}

/**
 * Normalizes Thai text for fuzzy standard title matching:
 * removes whitespace, quotes, and punctuation.
 * @param {string} s
 * @returns {string}
 */
export function normalizeTitle(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/["'()（）\s\-_/]/g, '')
    .trim();
}

/**
 * Matches a product name against a list of standards.
 * Prefers exact substring match of standard Thai title in the product name.
 *
 * @param {string} productName
 * @param {Array<{ code: string, titleTh: string, titleEn: string, category: string, pdfUrl: string }>} standards
 * @param {string} [preferredCategory]
 * @returns {{ code: string, titleTh: string, titleEn: string, category: string, pdfUrl: string }|null}
 */
export function matchStandardForProduct(productName, standards, preferredCategory = null) {
  if (!productName || !Array.isArray(standards) || standards.length === 0) return null;
  const normProduct = normalizeTitle(productName);
  if (normProduct.length < 2) return null;

  let bestMatch = null;
  let maxMatchedLength = 0;

  for (const s of standards) {
    if (preferredCategory && s.category && s.category !== preferredCategory) continue;
    const normStandard = normalizeTitle(s.titleTh);
    if (normStandard.length < 3) continue;

    // Check if the product contains the standard title (e.g. "กล้วยตากอบน้ำผึ้ง" contains "กล้วยตาก")
    // Or if the standard title contains the product (e.g. "กล้วยตาก" in "กล้วยตาก")
    if (normProduct.includes(normStandard) || (normProduct.length >= 4 && normStandard.includes(normProduct))) {
      if (normStandard.length > maxMatchedLength) {
        maxMatchedLength = normStandard.length;
        bestMatch = s;
      }
    }
  }

  // If no match found in preferred category, try across all standards
  if (!bestMatch && preferredCategory) {
    return matchStandardForProduct(productName, standards, null);
  }

  return bestMatch;
}
