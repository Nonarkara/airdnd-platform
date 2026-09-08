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

/** [code, thai, english, region, lat, lng] */
const ROWS = [
  [10, 'กรุงเทพมหานคร', 'Bangkok', 'central', 13.7563, 100.5018],
  [11, 'สมุทรปราการ', 'Samut Prakan', 'central', 13.5991, 100.5998],
  [12, 'นนทบุรี', 'Nonthaburi', 'central', 13.8591, 100.5217],
  [13, 'ปทุมธานี', 'Pathum Thani', 'central', 14.0208, 100.525],
  [14, 'พระนครศรีอยุธยา', 'Phra Nakhon Si Ayutthaya', 'central', 14.3532, 100.5689],
  [15, 'อ่างทอง', 'Ang Thong', 'central', 14.5896, 100.455],
  [16, 'ลพบุรี', 'Lop Buri', 'central', 14.7995, 100.6534],
  [17, 'สิงห์บุรี', 'Sing Buri', 'central', 14.8907, 100.4037],
  [18, 'ชัยนาท', 'Chai Nat', 'central', 15.1851, 100.1251],
  [19, 'สระบุรี', 'Saraburi', 'central', 14.5289, 100.9101],
  [20, 'ชลบุรี', 'Chon Buri', 'east', 13.3611, 100.9847],
  [21, 'ระยอง', 'Rayong', 'east', 12.6814, 101.2816],
  [22, 'จันทบุรี', 'Chanthaburi', 'east', 12.6113, 102.1035],
  [23, 'ตราด', 'Trat', 'east', 12.2427, 102.5175],
  [24, 'ฉะเชิงเทรา', 'Chachoengsao', 'east', 13.6904, 101.0779],
  [25, 'ปราจีนบุรี', 'Prachin Buri', 'east', 14.0509, 101.366],
  [26, 'นครนายก', 'Nakhon Nayok', 'central', 14.2069, 101.213],
  [27, 'สระแก้ว', 'Sa Kaeo', 'east', 13.824, 102.0645],
  [30, 'นครราชสีมา', 'Nakhon Ratchasima', 'northeast', 14.9799, 102.0977],
  [31, 'บุรีรัมย์', 'Buri Ram', 'northeast', 14.993, 103.1029],
  [32, 'สุรินทร์', 'Surin', 'northeast', 14.8818, 103.496],
  [33, 'ศรีสะเกษ', 'Si Sa Ket', 'northeast', 15.1186, 104.322],
  [34, 'อุบลราชธานี', 'Ubon Ratchathani', 'northeast', 15.2448, 104.8473],
  [35, 'ยโสธร', 'Yasothon', 'northeast', 15.7921, 104.1452],
  [36, 'ชัยภูมิ', 'Chaiyaphum', 'northeast', 15.8068, 102.0317],
  [37, 'อำนาจเจริญ', 'Amnat Charoen', 'northeast', 15.8657, 104.6256],
  [38, 'บึงกาฬ', 'Bueng Kan', 'northeast', 18.3609, 103.6466],
  [39, 'หนองบัวลำภู', 'Nong Bua Lam Phu', 'northeast', 17.2042, 102.426],
  [40, 'ขอนแก่น', 'Khon Kaen', 'northeast', 16.4322, 102.8236],
  [41, 'อุดรธานี', 'Udon Thani', 'northeast', 17.4138, 102.787],
  [42, 'เลย', 'Loei', 'northeast', 17.486, 101.7223],
  [43, 'หนองคาย', 'Nong Khai', 'northeast', 17.8783, 102.747],
  [44, 'มหาสารคาม', 'Maha Sarakham', 'northeast', 16.185, 103.3029],
  [45, 'ร้อยเอ็ด', 'Roi Et', 'northeast', 16.0538, 103.652],
  [46, 'กาฬสินธุ์', 'Kalasin', 'northeast', 16.4315, 103.5059],
  [47, 'สกลนคร', 'Sakon Nakhon', 'northeast', 17.1545, 104.1348],
  [48, 'นครพนม', 'Nakhon Phanom', 'northeast', 17.4108, 104.7787],
  [49, 'มุกดาหาร', 'Mukdahan', 'northeast', 16.542, 104.7208],
  [50, 'เชียงใหม่', 'Chiang Mai', 'north', 18.7883, 98.9853],
  [51, 'ลำพูน', 'Lamphun', 'north', 18.5744, 99.0087],
  [52, 'ลำปาง', 'Lampang', 'north', 18.2888, 99.4909],
  [53, 'อุตรดิตถ์', 'Uttaradit', 'north', 17.62, 100.0993],
  [54, 'แพร่', 'Phrae', 'north', 18.1445, 100.1405],
  [55, 'น่าน', 'Nan', 'north', 18.7756, 100.773],
  [56, 'พะเยา', 'Phayao', 'north', 19.1664, 99.9003],
  [57, 'เชียงราย', 'Chiang Rai', 'north', 19.9105, 99.8406],
  [58, 'แม่ฮ่องสอน', 'Mae Hong Son', 'north', 19.302, 97.9654],
  [60, 'นครสวรรค์', 'Nakhon Sawan', 'central', 15.7047, 100.1372],
  [61, 'อุทัยธานี', 'Uthai Thani', 'central', 15.3835, 100.0246],
  [62, 'กำแพงเพชร', 'Kamphaeng Phet', 'central', 16.4827, 99.5226],
  [63, 'ตาก', 'Tak', 'west', 16.8839, 99.1258],
  [64, 'สุโขทัย', 'Sukhothai', 'central', 17.0068, 99.8265],
  [65, 'พิษณุโลก', 'Phitsanulok', 'central', 16.8211, 100.2659],
  [66, 'พิจิตร', 'Phichit', 'central', 16.4429, 100.3487],
  [67, 'เพชรบูรณ์', 'Phetchabun', 'central', 16.419, 101.1591],
  [70, 'ราชบุรี', 'Ratchaburi', 'west', 13.5283, 99.8134],
  [71, 'กาญจนบุรี', 'Kanchanaburi', 'west', 14.0227, 99.5328],
  [72, 'สุพรรณบุรี', 'Suphan Buri', 'central', 14.4745, 100.1177],
  [73, 'นครปฐม', 'Nakhon Pathom', 'central', 13.8199, 100.062],
  [74, 'สมุทรสาคร', 'Samut Sakhon', 'central', 13.5475, 100.2745],
  [75, 'สมุทรสงคราม', 'Samut Songkhram', 'central', 13.4098, 100.0022],
  [76, 'เพชรบุรี', 'Phetchaburi', 'west', 13.1111, 99.9399],
  [77, 'ประจวบคีรีขันธ์', 'Prachuap Khiri Khan', 'west', 11.8127, 99.797],
  [80, 'นครศรีธรรมราช', 'Nakhon Si Thammarat', 'south', 8.4304, 99.9631],
  [81, 'กระบี่', 'Krabi', 'south', 8.0863, 98.9063],
  [82, 'พังงา', 'Phang Nga', 'south', 8.4501, 98.5255],
  [83, 'ภูเก็ต', 'Phuket', 'south', 7.8804, 98.3923],
  [84, 'สุราษฎร์ธานี', 'Surat Thani', 'south', 9.1382, 99.3215],
  [85, 'ระนอง', 'Ranong', 'south', 9.9529, 98.6085],
  [86, 'ชุมพร', 'Chumphon', 'south', 10.493, 99.18],
  [90, 'สงขลา', 'Songkhla', 'south', 7.1897, 100.5951],
  [91, 'สตูล', 'Satun', 'south', 6.6238, 100.0674],
  [92, 'ตรัง', 'Trang', 'south', 7.5563, 99.6114],
  [93, 'พัทลุง', 'Phatthalung', 'south', 7.6167, 100.0742],
  [94, 'ปัตตานี', 'Pattani', 'south', 6.8692, 101.255],
  [95, 'ยะลา', 'Yala', 'south', 6.5411, 101.281],
  [96, 'นราธิวาส', 'Narathiwat', 'south', 6.4254, 101.8253],
];

export const PROVINCES = ROWS.map(([code, th, en, region, lat, lng]) => ({
  code,
  iso: `TH-${String(code).padStart(2, '0')}`,
  th,
  en,
  region,
  // Coordinates of the provincial capital (อำเภอเมือง), NOT a polygon centroid
  // and emphatically not a producer address — the registry records no producer
  // coordinates at all. Anything drawn at this point represents the province,
  // and the map must say so rather than implying a located business.
  lat,
  lng,
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
