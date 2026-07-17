// Consolidated text normalization utilities
// Consolidates: listing_contract.js, listing_pipeline.js, telegram_scraper.js
// Removes 120+ lines of duplication

export const CITY_PATTERNS = [
  {
    canonical: 'Bangkok',
    patterns: [
      'bangkok',
      'กรุงเทพ',
      'กรุงเทพมหานคร',
      'สุขุมวิท',
      'ทองหล่อ',
      'เอกมัย',
      'อโศก',
      'ลาดพร้าว',
      'รามอินทรา',
      'พระราม',
      'รัชดา',
      'ห้วยขวาง',
      'สาทร',
      'สีลม',
      'บางนา',
      'นวมินทร์',
      'มีนบุรี',
      'ฉลองกรุง',
      'คลองสอง',
      'ศาลายา',
      'หนองจอก',
      'เสรีไทย',
      'หทัยราษฎร์',
    ],
  },
  {
    canonical: 'Nonthaburi',
    patterns: ['nonthaburi', 'นนทบุรี', 'นนทบุร', 'บางใหญ่', 'ปากเกร็ด', 'บางกรวย', 'วัดลาดปลาดุก'],
  },
  {
    canonical: 'Pathum Thani',
    patterns: ['pathum thani', 'ปทุมธานี', 'รังสิต', 'ลำลูกกา', 'คลอง4', 'คลอง 4'],
  },
  {
    canonical: 'Samut Prakan',
    patterns: ['samut prakan', 'สมุทรปราการ', 'สำโรง', 'แบริ่ง'],
  },
  {
    canonical: 'Chonburi',
    patterns: ['chonburi', 'ชลบุรี', 'pattaya', 'พัทยา', 'jomtien', 'บางแสน', 'ศรีราชา'],
  },
  {
    canonical: 'Phuket',
    patterns: ['phuket', 'ภูเก็ต', 'patong', 'ป่าตอง'],
  },
  {
    canonical: 'Chiang Mai',
    patterns: ['chiang mai', 'เชียงใหม่', 'chiangmai'],
  },
  {
    canonical: 'Chiang Rai',
    patterns: ['chiang rai', 'เชียงราย', 'chiangrai'],
  },
  {
    canonical: 'Saraburi',
    patterns: ['saraburi', 'สระบุรี'],
  },
  {
    canonical: 'Khon Kaen',
    patterns: ['khon kaen', 'ขอนแก่น', 'khonkaen'],
  },
  {
    canonical: 'Udon Thani',
    patterns: ['udon thani', 'อุดรธานี', 'อุดร', 'udon'],
  },
  {
    canonical: 'Nakhon Ratchasima',
    patterns: ['nakhon ratchasima', 'นครราชสีมา', 'โคราช', 'korat'],
  },
  {
    canonical: 'Songkhla',
    patterns: ['songkhla', 'สงขลา', 'hat yai', 'หาดใหญ่', 'hatyai'],
  },
  {
    canonical: 'Prachuap Khiri Khan',
    patterns: ['prachuap', 'ประจวบ', 'hua hin', 'หัวหิน', 'huahin'],
  },
  {
    canonical: 'Rayong',
    patterns: ['rayong', 'ระยอง'],
  },
  {
    canonical: 'Ayutthaya',
    patterns: ['ayutthaya', 'อยุธยา', 'พระนครศรีอยุธยา'],
  },
  {
    canonical: 'Nakhon Pathom',
    patterns: ['nakhon pathom', 'นครปฐม', 'nakhonpathom'],
  },
  {
    canonical: 'Surat Thani',
    patterns: ['surat thani', 'สุราษฎร์ธานี', 'สมุย', 'samui'],
  },
  // --- Additional Provinces to reach all 77 ---
  { canonical: 'Mae Hong Son', patterns: ['mae hong son', 'แม่ฮ่องสอน'] },
  { canonical: 'Lampang', patterns: ['lampang', 'ลำปาง'] },
  { canonical: 'Lamphun', patterns: ['lamphun', 'ลำพูน'] },
  { canonical: 'Phrae', patterns: ['phrae', 'แพร่'] },
  { canonical: 'Nan', patterns: ['nan', 'น่าน'] },
  { canonical: 'Phayao', patterns: ['phayao', 'พะเยา'] },
  { canonical: 'Uttaradit', patterns: ['uttaradit', 'อุตรดิตถ์'] },
  { canonical: 'Phitsanulok', patterns: ['phitsanulok', 'พิษณุโลก'] },
  { canonical: 'Sukhothai', patterns: ['sukhothai', 'สุโขทัย'] },
  { canonical: 'Tak', patterns: ['tak', 'ตาก'] },
  { canonical: 'Kamphaeng Phet', patterns: ['kamphaeng phet', 'กำแพงเพชร'] },
  { canonical: 'Phichit', patterns: ['phichit', 'พิจิตร'] },
  { canonical: 'Phetchabun', patterns: ['phetchabun', 'เพชรบูรณ์'] },
  { canonical: 'Nakhon Sawan', patterns: ['nakhon sawan', 'นครสวรรค์'] },
  { canonical: 'Uthai Thani', patterns: ['uthaithani', 'อุทัยธานี'] },
  { canonical: 'Chai Nat', patterns: ['chainat', 'ชัยนาท'] },
  { canonical: 'Sing Buri', patterns: ['singburi', 'สิงห์บุรี'] },
  { canonical: 'Ang Thong', patterns: ['angthong', 'อ่างทอง'] },
  { canonical: 'Lopburi', patterns: ['lopburi', 'ลพบุรี'] },
  { canonical: 'Nakhon Nayok', patterns: ['nakhon nayok', 'นครนายก'] },
  { canonical: 'Kanchanaburi', patterns: ['kanchanaburi', 'กาญจนบุรี'] },
  { canonical: 'Ratchaburi', patterns: ['ratchaburi', 'ราชบุรี'] },
  { canonical: 'Suphan Buri', patterns: ['suphan buri', 'สุพรรณบุรี'] },
  { canonical: 'Samut Sakhon', patterns: ['samut sakhon', 'สมุทรสาคร', 'มหาชัย'] },
  { canonical: 'Samut Songkhram', patterns: ['samut songkhram', 'สมุทรสงคราม', 'แม่กลอง'] },
  { canonical: 'Phetchaburi', patterns: ['phetchaburi', 'เพชรบุรี'] },
  { canonical: 'Sa Kaeo', patterns: ['sa kaeo', 'สระแก้ว'] },
  { canonical: 'Prachin Buri', patterns: ['prachin buri', 'ปราจีนบุรี'] },
  { canonical: 'Chachoengsao', patterns: ['chachoengsao', 'ฉะเชิงเทรา', 'แปดริ้ว'] },
  { canonical: 'Chanthaburi', patterns: ['chanthaburi', 'จันทบุรี'] },
  { canonical: 'Trat', patterns: ['trat', 'ตราด'] },
  { canonical: 'Nong Khai', patterns: ['nong khai', 'หนองคาย'] },
  { canonical: 'Bueng Kan', patterns: ['bueng kan', 'บึงกาฬ'] },
  { canonical: 'Loei', patterns: ['loei', 'เลย'] },
  { canonical: 'Sakon Nakhon', patterns: ['sakon nakhon', 'สกลนคร'] },
  { canonical: 'Nakhon Phanom', patterns: ['nakhon phanom', 'นครพนม'] },
  { canonical: 'Nong Bua Lamphu', patterns: ['nong bua lamphu', 'หนองบัวลำภู'] },
  { canonical: 'Mukdahan', patterns: ['mukdahan', 'มุกดาหาร'] },
  { canonical: 'Kalasin', patterns: ['kalasin', 'กาฬสินธุ์'] },
  { canonical: 'Chaiyaphum', patterns: ['chaiyaphum', 'ชัยภูมิ'] },
  { canonical: 'Maha Sarakham', patterns: ['maha sarakham', 'มหาสารคาม'] },
  { canonical: 'Roi Et', patterns: ['roi et', 'ร้อยเอ็ด'] },
  { canonical: 'Yasothon', patterns: ['yasothon', 'ยโสธร'] },
  { canonical: 'Amnat Charoen', patterns: ['amnat charoen', 'อำนาจเจริญ'] },
  { canonical: 'Ubon Ratchathani', patterns: ['ubon ratchathani', 'อุบลราชธานี', 'อุบล'] },
  { canonical: 'Si Sa Ket', patterns: ['si sa ket', 'ศรีสะเกษ'] },
  { canonical: 'Surin', patterns: ['surin', 'สุรินทร์'] },
  { canonical: 'Buriram', patterns: ['buriram', 'บุรีรัมย์'] },
  { canonical: 'Chumphon', patterns: ['chumphon', 'ชุมพร'] },
  { canonical: 'Ranong', patterns: ['ranong', 'ระนอง'] },
  { canonical: 'Phang Nga', patterns: ['phang nga', 'พังงา'] },
  { canonical: 'Krabi', patterns: ['krabi', 'กระบี่'] },
  { canonical: 'Nakhon Si Thammarat', patterns: ['nakhon si thammarat', 'นครศรีธรรมราช'] },
  { canonical: 'Trang', patterns: ['trang', 'ตรัง'] },
  { canonical: 'Phatthalung', patterns: ['phatthalung', 'พัทลุง'] },
  { canonical: 'Satun', patterns: ['satun', 'สตูล'] },
  { canonical: 'Pattani', patterns: ['pattani', 'ปัตตานี'] },
  { canonical: 'Yala', patterns: ['yala', 'ยะลา'] },
  { canonical: 'Narathiwat', patterns: ['narathiwat', 'นราธิวาส'] },
];

export function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function cleanDisplayText(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/^[^\p{L}\p{N}@#]+/gu, '')
    .replace(/[^\p{L}\p{N})]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) {
    return '';
  }

  let phone = digits;
  if (phone.startsWith('66') && phone.length >= 10) {
    phone = `0${phone.slice(2)}`;
  }

  if (phone.length > 10 && phone.startsWith('0')) {
    phone = phone.slice(0, 10);
  }

  return phone.length >= 8 ? phone : '';
}

// Thai phone → E.164 tel: link. iPhone needs +66 to dial internationally and to
// resolve in WhatsApp. Strips leading 0, removes 66 prefix duplication, accepts
// `0838506969`, `838506969`, `66838506969`, `+66838506969`. Returns null if the
// input cannot be coerced into a 8–10-digit national-format number.
export function formatTelLink(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  let digits = cleaned.replace(/^\+/, '');
  if (digits.startsWith('66')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length < 8 || digits.length > 10) return null;
  return `tel:+66${digits}`;
}

// Human-readable phone display: +66 83 850 6969
export function formatTelDisplay(value) {
  const link = formatTelLink(value);
  if (!link) return null;
  const digits = link.replace('tel:+66', '');
  if (digits.length === 9) return `+66 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  if (digits.length === 8) return `+66 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `+66 ${digits}`;
}

// LINE deep-link. Accepts @handle, bare handle, line.me/ti/p/~ID, lin.ee/X,
// page.line.me/X. Returns canonical HTTPS URL. line:// native scheme is not
// emitted (desktop browsers cannot open it).
export function formatLineUrl(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const tiMatch = s.match(/line\.me\/(?:R\/)?ti\/p\/~?([A-Za-z0-9@_.-]+)/i);
  if (tiMatch) return `https://line.me/ti/p/~${tiMatch[1]}`;
  const linEeMatch = s.match(/lin\.ee\/([A-Za-z0-9]+)/i);
  if (linEeMatch) return `https://lin.ee/${linEeMatch[1]}`;
  const pageMatch = s.match(/page\.line\.me\/([A-Za-z0-9_@.-]+)/i);
  if (pageMatch) return `https://page.line.me/${pageMatch[1]}`;
  const handleMatch = s.match(/^@?([A-Za-z0-9_.-]{2,40})$/);
  if (handleMatch) return `https://line.me/ti/p/~${handleMatch[1]}`;
  return null;
}

// Telegram deep-link. Accepts t.me/username, https://t.me/username, @username,
// tg://resolve?domain=username. Returns canonical HTTPS URL.
export function formatTelegramUrl(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const tMe = s.match(/t\.me\/([A-Za-z0-9_]{3,32})/i);
  if (tMe) return `https://t.me/${tMe[1]}`;
  const tg = s.match(/tg:\/\/resolve\?domain=([A-Za-z0-9_]+)/i);
  if (tg) return `https://t.me/${tg[1]}`;
  const handle = s.match(/^@?([A-Za-z0-9_]{3,32})$/);
  if (handle) return `https://t.me/${handle[1]}`;
  return null;
}

// Maps URL. Prefers a coordinate-based search URL when lat/lng are known
// (deterministic, no shortlink expansion). Falls back to a whitelisted Google
// Maps URL when only a maps_url is available.
export function formatMapsUrl(rawUrl, latitude, longitude) {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (!rawUrl) return null;
  const s = String(rawUrl).trim();
  if (!s) return null;
  if (/^https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google|g\.co\/kgs)/i.test(s)) {
    return s.replace(/^http:/, 'https:');
  }
  return null;
}

export function inferCityFromLocation(location) {
  const normalized = normalizeText(location, '').toLowerCase();
  if (!normalized) {
    return null;
  }

  const matchedCity = CITY_PATTERNS.find(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern.toLowerCase())),
  );

  return matchedCity?.canonical || null;
}
