/**
 * OTOP domain taxonomy.
 *
 * The five product groups are the official ประเภทผลิตภัณฑ์ OTOP used by
 * กรมการพัฒนาชุมชน. Source rows label them inconsistently — sometimes the full
 * Thai phrase, sometimes a single digit, sometimes an English gloss, sometimes
 * nothing at all — so every row goes through `classifyCategory`, which returns
 * both the resolved category and how it was resolved. A row classified by
 * keyword is a weaker claim than one carrying an explicit code, and the
 * frontend is entitled to know which it is looking at.
 */

export const CATEGORIES = [
  {
    id: 'food',
    code: 1,
    th: 'อาหาร',
    en: 'Food',
    keywords: [
      'อาหาร', 'ข้าว', 'ขนม', 'น้ำพริก', 'กาแฟ', 'แปรรูป', 'ปลา', 'กุ้ง', 'หมู', 'ไก่',
      'ผลไม้', 'กล้วย', 'ทุเรียน', 'มะม่วง', 'เนื้อ', 'ไส้กรอก', 'แหนม', 'ปลาร้า', 'น้ำปลา',
      'เส้น', 'ทอด', 'อบ', 'กวน', 'แยม', 'ซอส', 'เครื่องแกง', 'ผัก', 'เห็ด', 'ไข่', 'นม', 'ชีส',
      'น้ำผึ้ง', 'น้ำตาล', 'ถั่ว', 'งา', 'พริก', 'เครื่องเทศ', 'ผงปรุงรส', 'ทองม้วน', 'กระยาสารท',
      'food', 'snack', 'rice', 'dried', 'sauce', 'paste', 'jam', 'coffee bean',
    ],
  },
  {
    id: 'beverage',
    code: 2,
    th: 'เครื่องดื่ม',
    en: 'Beverages',
    keywords: [
      'เครื่องดื่ม', 'น้ำผลไม้', 'น้ำสมุนไพร', 'ชา', 'สุรา', 'ไวน์', 'เบียร์', 'สาโท', 'อุ',
      'กระชายน้ำผึ้ง', 'น้ำอ้อย', 'น้ำมะพร้าว', 'เครื่องดื่มผง', 'น้ำดื่ม',
      'beverage', 'drink', 'juice', 'tea', 'wine', 'liquor',
    ],
  },
  {
    id: 'textile',
    code: 3,
    th: 'ผ้าและเครื่องแต่งกาย',
    en: 'Fabric & Apparel',
    keywords: [
      'ผ้า', 'ทอ', 'ไหม', 'ฝ้าย', 'มัดหมี่', 'ขิด', 'บาติก', 'ปาเต๊ะ', 'ย้อม', 'คราม',
      'เสื้อ', 'กางเกง', 'กระโปรง', 'ผ้าถุง', 'ผ้าซิ่น', 'ผ้าขาวม้า', 'ผ้าพันคอ', 'ชุด',
      'รองเท้า', 'กระเป๋าผ้า', 'หมวก', 'เครื่องแต่งกาย', 'เครื่องประดับ',
      'fabric', 'textile', 'silk', 'cotton', 'woven', 'batik', 'indigo', 'apparel', 'garment', 'scarf',
    ],
  },
  {
    id: 'craft',
    code: 4,
    th: 'ของใช้ ของตกแต่ง ของที่ระลึก',
    en: 'Household, Decorative & Souvenir',
    keywords: [
      'ของใช้', 'ของตกแต่ง', 'ของที่ระลึก', 'จักสาน', 'สาน', 'เครื่องปั้น', 'ดินเผา', 'เซรามิก',
      'ไม้', 'แกะสลัก', 'เครื่องเงิน', 'เครื่องทอง', 'เครื่องเขิน', 'เครื่องจักสาน', 'กระเป๋า',
      'ตะกร้า', 'เสื่อ', 'โคม', 'เทียน', 'กระดาษสา', 'ผลิตภัณฑ์จาก', 'ตุ๊กตา', 'แจกัน', 'ของชำร่วย',
      'craft', 'wicker', 'basket', 'ceramic', 'pottery', 'wood carving', 'silverware', 'souvenir', 'decor',
    ],
  },
  {
    id: 'herbal',
    code: 5,
    th: 'สมุนไพรที่ไม่ใช่อาหาร',
    en: 'Non-food Herbal',
    keywords: [
      'สมุนไพร', 'ลูกประคบ', 'ยาหม่อง', 'น้ำมันนวด', 'สบู่', 'แชมพู', 'ครีม', 'โลชั่น', 'เซรั่ม',
      'ยาสีฟัน', 'สเปรย์', 'ธูป', 'ยากันยุง', 'เครื่องสำอาง', 'บำรุงผิว', 'อโรมา', 'สปา',
      'herbal', 'balm', 'soap', 'shampoo', 'lotion', 'cream', 'spa', 'aroma', 'compress',
    ],
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const CATEGORY_BY_CODE = new Map(CATEGORIES.map((c) => [c.code, c]));

const CATEGORY_NAME_LOOKUP = new Map();
for (const c of CATEGORIES) {
  const keys = [c.th, c.en, c.id, `ประเภท${c.th}`, c.th.replace(/\s+/g, '')];
  for (const k of keys) CATEGORY_NAME_LOOKUP.set(k.replace(/\s+/g, '').toLowerCase(), c);
}
// Shorthand labels that appear in real exports for group 4.
for (const k of ['ของใช้', 'ของตกแต่ง', 'ของที่ระลึก', 'ของใช้/ของตกแต่ง/ของที่ระลึก', 'ของใช้ของตกแต่งของที่ระลึก']) {
  CATEGORY_NAME_LOOKUP.set(k.replace(/\s+/g, '').toLowerCase(), CATEGORY_BY_ID.get('craft'));
}

/**
 * @returns {{category: string|null, confidence: 'declared'|'inferred'|'none', matched: string|null}}
 */
export function classifyCategory({ declared = null, text = '' } = {}) {
  if (declared != null && declared !== '') {
    const raw = String(declared).trim();
    if (/^[1-5]$/.test(raw)) {
      const hit = CATEGORY_BY_CODE.get(Number(raw));
      if (hit) return { category: hit.id, confidence: 'declared', matched: raw };
    }
    const hit = CATEGORY_NAME_LOOKUP.get(raw.replace(/\s+/g, '').toLowerCase());
    if (hit) return { category: hit.id, confidence: 'declared', matched: raw };
  }

  const haystack = String(text || '').toLowerCase();
  if (haystack) {
    // Score every category and take the best, so a name like "สบู่สมุนไพรข้าวหอม"
    // resolves to herbal (2 hits) rather than food (1 hit) on first-match order.
    // Thai product names are head-initial: the leading noun names the product
    // *form* (ไวน์, สบู่, ผ้า, ตะกร้า) and the rest names ingredients or origin.
    // A keyword at position 0 therefore outranks a longer ingredient word later
    // in the string — without this, "ไวน์มะม่วง" scores as food, not beverage.
    let best = null;
    for (const c of CATEGORIES) {
      let score = 0;
      let matched = null;
      let matchedAt = Infinity;
      for (const kw of c.keywords) {
        const at = haystack.indexOf(kw.toLowerCase());
        if (at === -1) continue;
        score += kw.length * (at === 0 ? 4 : 1);
        if (at < matchedAt) {
          matched = kw;
          matchedAt = at;
        }
      }
      if (score > 0 && (!best || score > best.score)) best = { c, score, matched };
    }
    if (best) return { category: best.c.id, confidence: 'inferred', matched: best.matched };
  }

  return { category: null, confidence: 'none', matched: null };
}

/**
 * OPC star rating (ระดับดาว, OTOP Product Champion). 1–5, or null when the
 * source carries no grading. "ไม่ผ่าน" / 0 means assessed but ungraded — that is
 * still information, and is preserved as 0 rather than collapsed to null.
 */
export function parseStars(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (/ไม่ผ่าน|not\s*graded|ungraded/i.test(raw)) return 0;
  const match = raw.match(/([0-5])\s*(?:ดาว|stars?|★)?/);
  if (!match) return null;
  const stars = Number(match[1]);
  return stars >= 0 && stars <= 5 ? stars : null;
}

/** ประเภทผู้ผลิต — who is behind the product. */
export const PRODUCER_TYPES = [
  { id: 'community_group', th: 'กลุ่มผู้ผลิตชุมชน', en: 'Community producer group', patterns: [/กลุ่ม/, /วิสาหกิจชุมชน/, /สหกรณ์/, /community\s*group/i, /cooperative/i] },
  { id: 'sme', th: 'ผู้ประกอบการ SMEs', en: 'SME enterprise', patterns: [/sme/i, /บริษัท/, /ห้างหุ้นส่วน/, /หจก/, /จำกัด/, /co\.?,?\s*ltd/i] },
  { id: 'individual', th: 'ผู้ผลิตรายเดียว', en: 'Individual producer', patterns: [/รายเดียว|รายบุคคล|บุคคลธรรมดา/, /individual/i, /^(?:นาย|นาง|นางสาว|น\.ส\.)/] },
];

export function classifyProducerType({ declared = null, name = '' } = {}) {
  const subject = `${declared ?? ''} ${name ?? ''}`.trim();
  if (!subject) return null;
  for (const t of PRODUCER_TYPES) {
    if (t.patterns.some((re) => re.test(subject))) return t.id;
  }
  return null;
}
