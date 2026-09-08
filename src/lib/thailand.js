// Canonical Thai administrative gazetteer — the spine for every national dataset.
//
// Thai government CSVs carry จังหวัด as free text: sometimes prefixed (จ., จังหวัด),
// sometimes romanised, sometimes misspelled, sometimes abbreviated (กทม.). Nothing
// joins until that string resolves to a stable key. `code` is the official two-digit
// province code (TIS-1099 / ISO 3166-2:TH), which is what CDD, DOPA and NSO all key on
// internally — so it is the only safe join key across agencies.
//
// Centroids are approximate province centres, adequate for national-scale mapping.
// They are not administrative centroids and must not be used for area calculations.

export const PROVINCES = [
  // ── ภาคกลาง · Central ──────────────────────────────────────────────────────
  { code: '10', th: 'กรุงเทพมหานคร', en: 'Bangkok', region: 'Central', coords: [13.7563, 100.5018], aliases: ['กรุงเทพ', 'กรุงเทพฯ', 'กทม', 'กทม.', 'krung thep', 'bangkok metropolis', 'bkk'] },
  { code: '11', th: 'สมุทรปราการ', en: 'Samut Prakan', region: 'Central', coords: [13.5991, 100.5998], aliases: ['paknam', 'ปากน้ำ'] },
  { code: '12', th: 'นนทบุรี', en: 'Nonthaburi', region: 'Central', coords: [13.8591, 100.5217], aliases: [] },
  { code: '13', th: 'ปทุมธานี', en: 'Pathum Thani', region: 'Central', coords: [14.0208, 100.5250], aliases: ['patumthani'] },
  { code: '14', th: 'พระนครศรีอยุธยา', en: 'Phra Nakhon Si Ayutthaya', region: 'Central', coords: [14.3532, 100.5689], aliases: ['อยุธยา', 'ayutthaya', 'ayudhya'] },
  { code: '15', th: 'อ่างทอง', en: 'Ang Thong', region: 'Central', coords: [14.5896, 100.4550], aliases: ['angthong'] },
  { code: '16', th: 'ลพบุรี', en: 'Lopburi', region: 'Central', coords: [14.7995, 100.6534], aliases: ['lop buri'] },
  { code: '17', th: 'สิงห์บุรี', en: 'Sing Buri', region: 'Central', coords: [14.8907, 100.4017], aliases: ['singburi'] },
  { code: '18', th: 'ชัยนาท', en: 'Chai Nat', region: 'Central', coords: [15.1851, 100.1251], aliases: ['chainat'] },
  { code: '19', th: 'สระบุรี', en: 'Saraburi', region: 'Central', coords: [14.5289, 100.9108], aliases: ['sara buri'] },
  { code: '26', th: 'นครนายก', en: 'Nakhon Nayok', region: 'Central', coords: [14.2069, 101.2130], aliases: [] },
  { code: '60', th: 'นครสวรรค์', en: 'Nakhon Sawan', region: 'Central', coords: [15.7047, 100.1372], aliases: ['paknampho'] },
  { code: '61', th: 'อุทัยธานี', en: 'Uthai Thani', region: 'Central', coords: [15.3835, 100.0246], aliases: ['uthaithani'] },
  { code: '62', th: 'กำแพงเพชร', en: 'Kamphaeng Phet', region: 'Central', coords: [16.4828, 99.5220], aliases: ['kamphaengphet'] },
  { code: '64', th: 'สุโขทัย', en: 'Sukhothai', region: 'Central', coords: [17.0068, 99.8265], aliases: [] },
  { code: '65', th: 'พิษณุโลก', en: 'Phitsanulok', region: 'Central', coords: [16.8211, 100.2659], aliases: ['pitsanulok'] },
  { code: '66', th: 'พิจิตร', en: 'Phichit', region: 'Central', coords: [16.4429, 100.3487], aliases: ['pichit'] },
  { code: '67', th: 'เพชรบูรณ์', en: 'Phetchabun', region: 'Central', coords: [16.4190, 101.1591], aliases: ['petchabun'] },
  { code: '72', th: 'สุพรรณบุรี', en: 'Suphan Buri', region: 'Central', coords: [14.4745, 100.1177], aliases: ['suphanburi'] },
  { code: '73', th: 'นครปฐม', en: 'Nakhon Pathom', region: 'Central', coords: [13.8199, 100.0621], aliases: ['nakornpathom'] },
  { code: '74', th: 'สมุทรสาคร', en: 'Samut Sakhon', region: 'Central', coords: [13.5475, 100.2745], aliases: ['mahachai', 'มหาชัย'] },
  { code: '75', th: 'สมุทรสงคราม', en: 'Samut Songkhram', region: 'Central', coords: [13.4098, 100.0022], aliases: ['maeklong', 'แม่กลอง'] },

  // ── ภาคตะวันออก · East ─────────────────────────────────────────────────────
  { code: '20', th: 'ชลบุรี', en: 'Chon Buri', region: 'East', coords: [13.3611, 100.9847], aliases: ['chonburi', 'pattaya', 'พัทยา'] },
  { code: '21', th: 'ระยอง', en: 'Rayong', region: 'East', coords: [12.6814, 101.2816], aliases: [] },
  { code: '22', th: 'จันทบุรี', en: 'Chanthaburi', region: 'East', coords: [12.6112, 102.1039], aliases: ['chantaburi'] },
  { code: '23', th: 'ตราด', en: 'Trat', region: 'East', coords: [12.2428, 102.5175], aliases: [] },
  { code: '24', th: 'ฉะเชิงเทรา', en: 'Chachoengsao', region: 'East', coords: [13.6904, 101.0779], aliases: ['paetriu', 'แปดริ้ว'] },
  { code: '25', th: 'ปราจีนบุรี', en: 'Prachin Buri', region: 'East', coords: [14.0510, 101.3700], aliases: ['prachinburi'] },
  { code: '27', th: 'สระแก้ว', en: 'Sa Kaeo', region: 'East', coords: [13.8240, 102.0645], aliases: ['sakaeo', 'sakaew'] },

  // ── ภาคตะวันออกเฉียงเหนือ · Northeast (อีสาน) ────────────────────────────────
  { code: '30', th: 'นครราชสีมา', en: 'Nakhon Ratchasima', region: 'Northeast', coords: [14.9799, 102.0977], aliases: ['โคราช', 'korat', 'khorat'] },
  { code: '31', th: 'บุรีรัมย์', en: 'Buri Ram', region: 'Northeast', coords: [14.9930, 103.1029], aliases: ['buriram'] },
  { code: '32', th: 'สุรินทร์', en: 'Surin', region: 'Northeast', coords: [14.8818, 103.4936], aliases: [] },
  { code: '33', th: 'ศรีสะเกษ', en: 'Si Sa Ket', region: 'Northeast', coords: [15.1186, 104.3220], aliases: ['sisaket', 'ศรีษะเกษ'] },
  { code: '34', th: 'อุบลราชธานี', en: 'Ubon Ratchathani', region: 'Northeast', coords: [15.2448, 104.8473], aliases: ['ubon', 'อุบล'] },
  { code: '35', th: 'ยโสธร', en: 'Yasothon', region: 'Northeast', coords: [15.7921, 104.1452], aliases: [] },
  { code: '36', th: 'ชัยภูมิ', en: 'Chaiyaphum', region: 'Northeast', coords: [15.8068, 102.0317], aliases: [] },
  { code: '37', th: 'อำนาจเจริญ', en: 'Amnat Charoen', region: 'Northeast', coords: [15.8657, 104.6258], aliases: ['amnatcharoen'] },
  { code: '38', th: 'บึงกาฬ', en: 'Bueng Kan', region: 'Northeast', coords: [18.3609, 103.6466], aliases: ['buengkan', 'bung kan'] },
  { code: '39', th: 'หนองบัวลำภู', en: 'Nong Bua Lam Phu', region: 'Northeast', coords: [17.2218, 102.4260], aliases: ['nongbualamphu'] },
  { code: '40', th: 'ขอนแก่น', en: 'Khon Kaen', region: 'Northeast', coords: [16.4322, 102.8236], aliases: ['khonkaen'] },
  { code: '41', th: 'อุดรธานี', en: 'Udon Thani', region: 'Northeast', coords: [17.4138, 102.7870], aliases: ['udon', 'udonthani'] },
  { code: '42', th: 'เลย', en: 'Loei', region: 'Northeast', coords: [17.4860, 101.7223], aliases: ['loey'] },
  { code: '43', th: 'หนองคาย', en: 'Nong Khai', region: 'Northeast', coords: [17.8783, 102.7412], aliases: ['nongkhai'] },
  { code: '44', th: 'มหาสารคาม', en: 'Maha Sarakham', region: 'Northeast', coords: [16.1851, 103.3029], aliases: ['mahasarakham'] },
  { code: '45', th: 'ร้อยเอ็ด', en: 'Roi Et', region: 'Northeast', coords: [16.0538, 103.6520], aliases: ['roiet'] },
  { code: '46', th: 'กาฬสินธุ์', en: 'Kalasin', region: 'Northeast', coords: [16.4315, 103.5059], aliases: [] },
  { code: '47', th: 'สกลนคร', en: 'Sakon Nakhon', region: 'Northeast', coords: [17.1664, 104.1486], aliases: ['sakonnakhon'] },
  { code: '48', th: 'นครพนม', en: 'Nakhon Phanom', region: 'Northeast', coords: [17.4108, 104.7784], aliases: ['nakhonphanom'] },
  { code: '49', th: 'มุกดาหาร', en: 'Mukdahan', region: 'Northeast', coords: [16.5420, 104.7208], aliases: [] },

  // ── ภาคเหนือ · North ───────────────────────────────────────────────────────
  { code: '50', th: 'เชียงใหม่', en: 'Chiang Mai', region: 'North', coords: [18.7883, 98.9853], aliases: ['chiangmai', 'chiengmai'] },
  { code: '51', th: 'ลำพูน', en: 'Lamphun', region: 'North', coords: [18.5744, 99.0087], aliases: ['lampoon'] },
  { code: '52', th: 'ลำปาง', en: 'Lampang', region: 'North', coords: [18.2888, 99.4908], aliases: [] },
  { code: '53', th: 'อุตรดิตถ์', en: 'Uttaradit', region: 'North', coords: [17.6200, 100.0993], aliases: [] },
  { code: '54', th: 'แพร่', en: 'Phrae', region: 'North', coords: [18.1445, 100.1405], aliases: ['prae'] },
  { code: '55', th: 'น่าน', en: 'Nan', region: 'North', coords: [18.7756, 100.7730], aliases: [] },
  { code: '56', th: 'พะเยา', en: 'Phayao', region: 'North', coords: [19.1664, 99.9003], aliases: ['payao'] },
  { code: '57', th: 'เชียงราย', en: 'Chiang Rai', region: 'North', coords: [19.9105, 99.8406], aliases: ['chiangrai'] },
  { code: '58', th: 'แม่ฮ่องสอน', en: 'Mae Hong Son', region: 'North', coords: [19.3020, 97.9654], aliases: ['maehongson'] },

  // ── ภาคตะวันตก · West ──────────────────────────────────────────────────────
  { code: '63', th: 'ตาก', en: 'Tak', region: 'West', coords: [16.8839, 99.1258], aliases: ['maesot', 'แม่สอด'] },
  { code: '70', th: 'ราชบุรี', en: 'Ratchaburi', region: 'West', coords: [13.5283, 99.8134], aliases: ['rajburi'] },
  { code: '71', th: 'กาญจนบุรี', en: 'Kanchanaburi', region: 'West', coords: [14.0227, 99.5328], aliases: ['kanjanaburi'] },
  { code: '76', th: 'เพชรบุรี', en: 'Phetchaburi', region: 'West', coords: [13.1119, 99.9399], aliases: ['petchburi', 'phetburi'] },
  { code: '77', th: 'ประจวบคีรีขันธ์', en: 'Prachuap Khiri Khan', region: 'West', coords: [11.8126, 99.7957], aliases: ['prachuapkhirikhan', 'hua hin', 'หัวหิน'] },

  // ── ภาคใต้ · South ─────────────────────────────────────────────────────────
  { code: '80', th: 'นครศรีธรรมราช', en: 'Nakhon Si Thammarat', region: 'South', coords: [8.4304, 99.9631], aliases: ['nakhonsithammarat'] },
  { code: '81', th: 'กระบี่', en: 'Krabi', region: 'South', coords: [8.0863, 98.9063], aliases: [] },
  { code: '82', th: 'พังงา', en: 'Phang Nga', region: 'South', coords: [8.4501, 98.5255], aliases: ['phangnga'] },
  { code: '83', th: 'ภูเก็ต', en: 'Phuket', region: 'South', coords: [7.8804, 98.3923], aliases: ['puket'] },
  { code: '84', th: 'สุราษฎร์ธานี', en: 'Surat Thani', region: 'South', coords: [9.1382, 99.3215], aliases: ['suratthani', 'surat', 'samui', 'สมุย'] },
  { code: '85', th: 'ระนอง', en: 'Ranong', region: 'South', coords: [9.9529, 98.6085], aliases: [] },
  { code: '86', th: 'ชุมพร', en: 'Chumphon', region: 'South', coords: [10.4930, 99.1800], aliases: ['chumporn'] },
  { code: '90', th: 'สงขลา', en: 'Songkhla', region: 'South', coords: [7.1897, 100.5951], aliases: ['หาดใหญ่', 'hat yai', 'hatyai'] },
  { code: '91', th: 'สตูล', en: 'Satun', region: 'South', coords: [6.6238, 100.0673], aliases: ['satool'] },
  { code: '92', th: 'ตรัง', en: 'Trang', region: 'South', coords: [7.5593, 99.6110], aliases: [] },
  { code: '93', th: 'พัทลุง', en: 'Phatthalung', region: 'South', coords: [7.6167, 100.0742], aliases: ['pattalung'] },
  { code: '94', th: 'ปัตตานี', en: 'Pattani', region: 'South', coords: [6.8692, 101.2550], aliases: [] },
  { code: '95', th: 'ยะลา', en: 'Yala', region: 'South', coords: [6.5410, 101.2805], aliases: [] },
  { code: '96', th: 'นราธิวาส', en: 'Narathiwat', region: 'South', coords: [6.4254, 101.8253], aliases: ['narathiwas'] },
];

export const REGIONS = ['Central', 'North', 'Northeast', 'East', 'West', 'South'];

export const REGION_TH = {
  Central: 'ภาคกลาง',
  North: 'ภาคเหนือ',
  Northeast: 'ภาคตะวันออกเฉียงเหนือ',
  East: 'ภาคตะวันออก',
  West: 'ภาคตะวันตก',
  South: 'ภาคใต้',
};

// Prefixes agencies attach inconsistently. Stripped before matching.
const TH_PREFIXES = ['จังหวัด', 'จ.', 'จ ', 'เขต', 'อำเภอ', 'อ.', 'ตำบล', 'ต.'];
const EN_PREFIXES = ['changwat', 'province of', 'province', 'amphoe', 'amphur', 'tambon'];

export function normalizePlaceName(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  for (const p of TH_PREFIXES) if (s.startsWith(p)) s = s.slice(p.length).trim();
  let lower = s.toLowerCase();
  for (const p of EN_PREFIXES) if (lower.startsWith(p)) { s = s.slice(p.length).trim(); lower = s.toLowerCase(); }
  // Collapse separators and whitespace: "Chiang-Mai", "chiang  mai" -> "chiang mai"
  return lower.replace(/[-_.]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Build lookup once. Every key is a normalized string -> province record.
const INDEX = (() => {
  const map = new Map();
  const put = (key, province) => {
    const k = normalizePlaceName(key);
    if (k && !map.has(k)) map.set(k, province);
  };
  for (const p of PROVINCES) {
    put(p.th, p);
    put(p.en, p);
    put(p.en.replace(/\s+/g, ''), p);
    put(p.code, p);
    for (const a of p.aliases) put(a, p);
  }
  return map;
})();

export const PROVINCE_BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

/**
 * Resolve a free-text place string to a province record.
 *
 * Handles the three shapes government CSVs actually ship: an exact name, a
 * prefixed name (จ.เชียงใหม่), and a longer string that merely contains one
 * (ต.สุเทพ อ.เมือง จ.เชียงใหม่). Returns null rather than guessing.
 */
export function resolveProvince(input) {
  const q = normalizePlaceName(input);
  if (!q) return null;

  const exact = INDEX.get(q);
  if (exact) return exact;

  // Zero-padded numeric codes arriving as integers: 10 -> "10", 8 -> "08"
  if (/^\d{1,2}$/.test(q)) {
    const padded = q.padStart(2, '0');
    if (PROVINCE_BY_CODE.has(padded)) return PROVINCE_BY_CODE.get(padded);
  }

  // Containment: longest name wins, so "นครศรีธรรมราช" is not shadowed by "นคร".
  let best = null;
  let bestLen = 0;
  for (const [key, province] of INDEX) {
    if (key.length < 4) continue; // too short to match safely inside a sentence
    if (key.length > bestLen && q.includes(key)) {
      best = province;
      bestLen = key.length;
    }
  }
  return best;
}

/** Resolve to a [lat, lng] centroid, or null. */
export function resolveCoords(input) {
  const p = resolveProvince(input);
  return p ? p.coords : null;
}

/** Scan an arbitrary record for the first field that resolves to a province. */
export function resolveProvinceFromRecord(record, hintKeys = []) {
  if (!record || typeof record !== 'object') return null;
  const keys = Object.keys(record);
  const preferred = [
    ...hintKeys,
    ...keys.filter((k) => /จังหวัด|province|changwat|prov_?name|prov_?id|prov/i.test(k)),
  ];
  for (const k of preferred) {
    const hit = resolveProvince(record[k]);
    if (hit) return hit;
  }
  for (const k of keys) {
    const hit = resolveProvince(record[k]);
    if (hit) return hit;
  }
  return null;
}
