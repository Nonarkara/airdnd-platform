/**
 * Thailand administrative reference — 77 provinces.
 *
 * `code` is the TIS-1099 province code (รหัสจังหวัด). Thai government CSV exports
 * — including every OTOP release from กรมการพัฒนาชุมชน — key on this number, so it
 * is the join key of record. It is also the numeric half of ISO 3166-2:TH.
 *
 * `region` uses the NESDC six-region scheme (ภาคเหนือ / ภาคตะวันออกเฉียงเหนือ /
 * ภาคกลาง / ภาคตะวันออก / ภาคตะวันตก / ภาคใต้), which is the scheme Thai economic
 * policy is written in. Do not substitute the four-region tourist scheme: the
 * per-region OTOP counts stop reconciling with published NESDC tables.
 */

export const REGIONS = {
  north: { th: 'ภาคเหนือ', en: 'North' },
  northeast: { th: 'ภาคตะวันออกเฉียงเหนือ', en: 'Northeast' },
  central: { th: 'ภาคกลาง', en: 'Central' },
  east: { th: 'ภาคตะวันออก', en: 'East' },
  west: { th: 'ภาคตะวันตก', en: 'West' },
  south: { th: 'ภาคใต้', en: 'South' },
};

export const REGION_ORDER = ['north', 'northeast', 'central', 'east', 'west', 'south'];

/** [code, thai, english, region] */
const ROWS = [
  [10, 'กรุงเทพมหานคร', 'Bangkok', 'central'],
  [11, 'สมุทรปราการ', 'Samut Prakan', 'central'],
  [12, 'นนทบุรี', 'Nonthaburi', 'central'],
  [13, 'ปทุมธานี', 'Pathum Thani', 'central'],
  [14, 'พระนครศรีอยุธยา', 'Phra Nakhon Si Ayutthaya', 'central'],
  [15, 'อ่างทอง', 'Ang Thong', 'central'],
  [16, 'ลพบุรี', 'Lop Buri', 'central'],
  [17, 'สิงห์บุรี', 'Sing Buri', 'central'],
  [18, 'ชัยนาท', 'Chai Nat', 'central'],
  [19, 'สระบุรี', 'Saraburi', 'central'],
  [20, 'ชลบุรี', 'Chon Buri', 'east'],
  [21, 'ระยอง', 'Rayong', 'east'],
  [22, 'จันทบุรี', 'Chanthaburi', 'east'],
  [23, 'ตราด', 'Trat', 'east'],
  [24, 'ฉะเชิงเทรา', 'Chachoengsao', 'east'],
  [25, 'ปราจีนบุรี', 'Prachin Buri', 'east'],
  [26, 'นครนายก', 'Nakhon Nayok', 'central'],
  [27, 'สระแก้ว', 'Sa Kaeo', 'east'],
  [30, 'นครราชสีมา', 'Nakhon Ratchasima', 'northeast'],
  [31, 'บุรีรัมย์', 'Buri Ram', 'northeast'],
  [32, 'สุรินทร์', 'Surin', 'northeast'],
  [33, 'ศรีสะเกษ', 'Si Sa Ket', 'northeast'],
  [34, 'อุบลราชธานี', 'Ubon Ratchathani', 'northeast'],
  [35, 'ยโสธร', 'Yasothon', 'northeast'],
  [36, 'ชัยภูมิ', 'Chaiyaphum', 'northeast'],
  [37, 'อำนาจเจริญ', 'Amnat Charoen', 'northeast'],
  [38, 'บึงกาฬ', 'Bueng Kan', 'northeast'],
  [39, 'หนองบัวลำภู', 'Nong Bua Lam Phu', 'northeast'],
  [40, 'ขอนแก่น', 'Khon Kaen', 'northeast'],
  [41, 'อุดรธานี', 'Udon Thani', 'northeast'],
  [42, 'เลย', 'Loei', 'northeast'],
  [43, 'หนองคาย', 'Nong Khai', 'northeast'],
  [44, 'มหาสารคาม', 'Maha Sarakham', 'northeast'],
  [45, 'ร้อยเอ็ด', 'Roi Et', 'northeast'],
  [46, 'กาฬสินธุ์', 'Kalasin', 'northeast'],
  [47, 'สกลนคร', 'Sakon Nakhon', 'northeast'],
  [48, 'นครพนม', 'Nakhon Phanom', 'northeast'],
  [49, 'มุกดาหาร', 'Mukdahan', 'northeast'],
  [50, 'เชียงใหม่', 'Chiang Mai', 'north'],
  [51, 'ลำพูน', 'Lamphun', 'north'],
  [52, 'ลำปาง', 'Lampang', 'north'],
  [53, 'อุตรดิตถ์', 'Uttaradit', 'north'],
  [54, 'แพร่', 'Phrae', 'north'],
  [55, 'น่าน', 'Nan', 'north'],
  [56, 'พะเยา', 'Phayao', 'north'],
  [57, 'เชียงราย', 'Chiang Rai', 'north'],
  [58, 'แม่ฮ่องสอน', 'Mae Hong Son', 'north'],
  [60, 'นครสวรรค์', 'Nakhon Sawan', 'central'],
  [61, 'อุทัยธานี', 'Uthai Thani', 'central'],
  [62, 'กำแพงเพชร', 'Kamphaeng Phet', 'central'],
  [63, 'ตาก', 'Tak', 'west'],
  [64, 'สุโขทัย', 'Sukhothai', 'central'],
  [65, 'พิษณุโลก', 'Phitsanulok', 'central'],
  [66, 'พิจิตร', 'Phichit', 'central'],
  [67, 'เพชรบูรณ์', 'Phetchabun', 'central'],
  [70, 'ราชบุรี', 'Ratchaburi', 'west'],
  [71, 'กาญจนบุรี', 'Kanchanaburi', 'west'],
  [72, 'สุพรรณบุรี', 'Suphan Buri', 'central'],
  [73, 'นครปฐม', 'Nakhon Pathom', 'central'],
  [74, 'สมุทรสาคร', 'Samut Sakhon', 'central'],
  [75, 'สมุทรสงคราม', 'Samut Songkhram', 'central'],
  [76, 'เพชรบุรี', 'Phetchaburi', 'west'],
  [77, 'ประจวบคีรีขันธ์', 'Prachuap Khiri Khan', 'west'],
  [80, 'นครศรีธรรมราช', 'Nakhon Si Thammarat', 'south'],
  [81, 'กระบี่', 'Krabi', 'south'],
  [82, 'พังงา', 'Phang Nga', 'south'],
  [83, 'ภูเก็ต', 'Phuket', 'south'],
  [84, 'สุราษฎร์ธานี', 'Surat Thani', 'south'],
  [85, 'ระนอง', 'Ranong', 'south'],
  [86, 'ชุมพร', 'Chumphon', 'south'],
  [90, 'สงขลา', 'Songkhla', 'south'],
  [91, 'สตูล', 'Satun', 'south'],
  [92, 'ตรัง', 'Trang', 'south'],
  [93, 'พัทลุง', 'Phatthalung', 'south'],
  [94, 'ปัตตานี', 'Pattani', 'south'],
  [95, 'ยะลา', 'Yala', 'south'],
  [96, 'นราธิวาส', 'Narathiwat', 'south'],
];

export const PROVINCES = ROWS.map(([code, th, en, region]) => ({
  code,
  iso: `TH-${String(code).padStart(2, '0')}`,
  th,
  en,
  region,
}));

export const PROVINCE_BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

/**
 * Strip the noise that Thai administrative source data carries: the จ./จังหวัด
 * prefix, zero-width and non-breaking spaces, Latin case, and internal spacing.
 * Thai has no word separator, so a naive `trim()` leaves "จ. เชียงใหม่" unmatched.
 */
export function normalizeAdminName(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[​-‍﻿ ]/g, ' ')
    .replace(/^\s*(?:จ\.|จังหวัด|province\s+of|province)\s*/i, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

const LOOKUP = new Map();
for (const p of PROVINCES) {
  LOOKUP.set(normalizeAdminName(p.th), p);
  LOOKUP.set(normalizeAdminName(p.en), p);
  LOOKUP.set(p.iso.toLowerCase(), p);
}

/**
 * Common romanisation variants that appear in real government exports. Thai
 * transliteration is not standardised, so "Buriram", "Buri Ram" and "Burirum"
 * all occur across CDD, DBD and provincial releases for the same province.
 */
const ALIASES = {
  buriram: 31,
  sisaket: 33,
  srisaket: 33,
  ubon: 34,
  nongbualamphu: 39,
  nongbualumphu: 39,
  udon: 41,
  korat: 30,
  nakhonrachasima: 30,
  nakornratchasima: 30,
  lopburi: 16,
  chonburi: 20,
  prachinburi: 25,
  ayutthaya: 14,
  phranakhonsriayutthaya: 14,
  bangkokmetropolis: 10,
  bangkokmetropolitan: 10,
  krungthep: 10,
  krungthepmahanakhon: 10,
  bkk: 10,
  suphanburi: 72,
  kamphangphet: 62,
  petchaburi: 76,
  phetburi: 76,
  prachuapkirikhan: 77,
  suratthani: 84,
  nakhonsithammarat: 80,
  phangnga: 82,
  phanga: 82,
  chiangmai: 50,
  chiengmai: 50,
  chiangrai: 57,
  maehongson: 58,
  maehongsorn: 58,
  ubonratchathani: 34,
  buengkan: 38,
  bungkan: 38,
};
for (const [alias, code] of Object.entries(ALIASES)) {
  const province = PROVINCE_BY_CODE.get(code);
  if (province) LOOKUP.set(alias, province);
}

/**
 * Resolve a province from anything a source row offers: a TIS-1099 code, a Thai
 * name, a romanisation, an ISO code, or a free-text address containing one.
 * Returns null rather than guessing — an unresolved province must stay visible
 * as unresolved, never be silently defaulted to Bangkok.
 */
export function resolveProvince(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number' || /^\d{1,2}$/.test(String(value).trim())) {
    return PROVINCE_BY_CODE.get(Number(value)) ?? null;
  }

  const raw = String(value);
  const key = normalizeAdminName(raw);
  if (!key) return null;

  const direct = LOOKUP.get(key);
  if (direct) return direct;

  // Free-text address: find the longest province name contained in the string.
  // Longest-first prevents "นคร" style prefixes matching the wrong province.
  let best = null;
  for (const [name, province] of LOOKUP) {
    if (name.length < 4) continue;
    if (key.includes(name) && (!best || name.length > best.name.length)) {
      best = { name, province };
    }
  }
  return best ? best.province : null;
}
