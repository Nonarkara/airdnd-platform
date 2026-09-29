/**
 * What kind of place is this, and who can help the people in it?
 *
 * One classification, read three ways:
 *   · people in this economy — workers and customers — who need to know how a
 *     service is offered, when, and where support is;
 *   · disease control (กรมควบคุมโรค) — where to take condoms, testing and
 *     prevention materials, in which languages, at what hours;
 *   · social workers and labour protection (พม., NGOs) — where work happens
 *     out of sight of any venue-based programme.
 *
 * Categories describe how a service is offered, never who a person is. Every
 * category comes from the listing's own public words; where those words say
 * nothing, the category says "not stated" rather than guessing. The outreach
 * view aggregates to districts — it is for routing services to places, not for
 * profiling individuals.
 */

import { computeGreyScore } from './listings.js';
import { parseOpeningHours } from './mapAvailability.js';

// ── how the service is offered ──────────────────────────────────────────────

export const FORMATS = {
  bathhouse: { en: 'Bathhouse', th: 'อาบอบนวด' },
  'private-room': { en: 'Private room / condo', th: 'ห้องส่วนตัว' },
  shopfront: { en: 'Shop or spa', th: 'ร้าน · สปา' },
  outcall: { en: 'Outcall — home or hotel', th: 'นวดนอกสถานที่' },
  unstated: { en: 'Not stated', th: 'ไม่ระบุ' },
};

const BATHHOUSE = /(อาบอบนวด|อาบ\s*อบ\s*นวด|soap(?:y|land)|ห้องอาบ)/i;
const OUTCALL = /(นอกสถานที่|รับงานนอก|ส่งถึงที่|ถึงที่พัก|นวดตามบ้าน|นวดถึงบ้าน|ถึงโรงแรม|out\s?call|home\s?service|hotel\s?service)/i;
const PRIVATE_ROOM = /(ห้องส่วนตัว|ห้องนวดส่วนตัว|คอนโด|condo|private\s?room)/i;
const SHOP_WORDS = /(ร้าน|สปา|\bspa\b|สาขา|massage\s*(?:&|and)\s*spa|ที่จอดรถ|parking)/i;
const PLACED = new Set(['exact', 'tambon', 'district']);

// ── service line (from the existing grey score — one scale, not two) ────────

export const SERVICE_LINES = {
  therapeutic: { en: 'Therapeutic massage', th: 'นวดเพื่อสุขภาพ' },
  mixed: { en: 'Mixed signals', th: 'สัญญาณผสม' },
  adult: { en: 'Adult-service signals', th: 'สัญญาณบริการผู้ใหญ่' },
};
const LINE_BY_GREY = { legit: 'therapeutic', ambiguous: 'mixed', grey: 'adult', strong: 'adult' };

// ── hours ────────────────────────────────────────────────────────────────────

export const HOURS = {
  '24h': { en: 'Open 24 hours', th: 'เปิด 24 ชม.' },
  'late-night': { en: 'Open past midnight', th: 'เปิดดึก' },
  daytime: { en: 'Daytime / evening', th: 'กลางวัน · หัวค่ำ' },
  unstated: { en: 'Hours not stated', th: 'ไม่ระบุเวลา' },
};
const ALL_DAY = /(24\s*(?:ชม|ชั่วโมง|hours?|hrs?|h\b|小时|小時)|เปิด\s*24)/i;

// ── language of the ad — the community it speaks to ─────────────────────────

export const LANGUAGES = {
  th: 'ไทย', en: 'English', zh: '中文', my: 'မြန်မာ', lo: 'ລາວ', km: 'ខ្មែរ', vi: 'Tiếng Việt', ja: '日本語', ko: '한국어',
};
const SCRIPTS = [
  ['th', /[ก-๛]/],
  ['zh', /[一-鿿]/],
  ['my', /[က-႟]/],
  ['lo', /[຀-໿]/],
  ['km', /[ក-៿]/],
  ['ja', /[぀-ヿ]/],
  ['ko', /[가-힯]/],
  ['vi', /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]/i],
];
const ENGLISH_WORDS = /\b(massage|spa|open|service|booking|price|call|line|thai|oil|foot|hours?)\b/gi;

// Workforce origin — only explicit collocations ("น้องลาว", "สาวพม่า"), never a
// bare country name, which also appears in addresses and menus.
const ORIGINS = [
  ['myanmar', /(?:น้อง|สาว|ชาว|พนักงาน|หมอนวด)\s?พม่า|burmese\s+(?:girls?|staff|therapists?)/i],
  ['lao', /(?:น้อง|สาว|ชาว|พนักงาน|หมอนวด)\s?ลาว|lao\s+(?:girls?|staff|therapists?)/i],
  ['cambodia', /(?:น้อง|สาว|ชาว|พนักงาน|หมอนวด)\s?(?:เขมร|กัมพูชา)|cambodian\s+(?:girls?|staff|therapists?)/i],
  ['vietnam', /(?:น้อง|สาว|ชาว|พนักงาน|หมอนวด)\s?เวียดนาม|vietnamese\s+(?:girls?|staff|therapists?)/i],
  ['china', /(?:น้อง|สาว|ชาว|พนักงาน|หมอนวด)\s?จีน|chinese\s+(?:girls?|staff|therapists?)/i],
];
const NEW_STAFF = /(น้องใหม่|เด็กใหม่|มาใหม่|พนักงานใหม่|new\s+(?:girls?|staff|therapists?))/i;

// ── outreach signals ────────────────────────────────────────────────────────

export const OUTREACH = {
  'hard-to-reach': {
    en: 'Out of reach of venue visits', th: 'ไม่มีหน้าร้านให้ลงพื้นที่',
    why: 'Outcall or private-room work: no venue for an outreach team to visit.',
  },
  'late-night': {
    en: 'Works past midnight', th: 'ทำงานดึก',
    why: 'Night work sits outside clinic hours and most outreach shifts.',
  },
  'other-language': {
    en: 'Speaks to another language community', th: 'สื่อสารภาษาอื่น',
    why: 'Ads in a language other than Thai or English, or naming migrant staff: materials and counselling need that language.',
  },
  'adult-signals': {
    en: 'Adult-service signals', th: 'สัญญาณบริการผู้ใหญ่',
    why: 'Where condoms, testing and prevention information matter most.',
  },
  'new-staff': {
    en: 'Advertises new staff', th: 'ประกาศพนักงานใหม่',
    why: 'Frequent new-staff notices indicate turnover and recruitment — a labour-protection signal.',
  },
  'no-fixed-place': {
    en: 'No stated place', th: 'ไม่ระบุสถานที่',
    why: 'Names nothing finer than a province: invisible to any area-based programme.',
  },
};

export const AUDIENCES = {
  people: {
    en: 'Workers & customers', th: 'คนทำงานและผู้ใช้บริการ',
    lead: 'How each service is offered, when, where — and where support is.',
  },
  ddc: {
    en: 'Disease control', th: 'กรมควบคุมโรค',
    lead: 'Where to take condoms, testing and prevention materials, in which languages, at what hours.',
    signals: ['adult-signals', 'late-night', 'other-language', 'hard-to-reach'],
  },
  social: {
    en: 'Social workers & labour protection', th: 'นักสังคมสงเคราะห์ · คุ้มครองแรงงาน',
    lead: 'Where work happens out of sight of venue-based programmes, and where turnover suggests recruitment.',
    signals: ['hard-to-reach', 'new-staff', 'other-language', 'no-fixed-place', 'late-night'],
  },
};

function textOf(listing) {
  return [
    listing?.name, listing?.location, listing?.description, listing?.rawText, listing?.raw_text,
    ...(Array.isArray(listing?.tags) ? listing.tags : []),
    ...(Array.isArray(listing?.serviceTags) ? listing.serviceTags : []),
  ].filter(Boolean).join(' ');
}

export function classifyHours(listing) {
  const hours = String(listing?.hours || '');
  // Titles in this corpus are often the post's first line, so "24h" can live there.
  const said = [hours, listing?.name, listing?.description].filter(Boolean).join(' ');
  if (ALL_DAY.test(said)) return '24h';
  const range = parseOpeningHours(hours);
  if (!range) return 'unstated';
  if (range.startMinutes === 0 && range.endMinutes === 24 * 60) return '24h';
  if (range.endMinutes <= range.startMinutes || range.endMinutes >= 23 * 60 + 30) return 'late-night';
  return 'daytime';
}

export function adLanguages(listing) {
  const text = [listing?.name, listing?.description, listing?.rawText, listing?.raw_text].filter(Boolean).join(' ');
  const found = SCRIPTS.filter(([, re]) => re.test(text)).map(([code]) => code);
  if ((text.match(ENGLISH_WORDS) || []).length >= 2) found.push('en');
  return [...new Set(found)];
}

/**
 * @returns {{
 *   format: string, alsoOutcall: boolean,
 *   serviceLine: string, greyScore: number,
 *   hours: string, languages: string[], origins: string[],
 *   contacts: string[], outreach: string[]
 * }}
 */
export function categorizeListing(listing) {
  const text = textOf(listing);
  const isBathhouse = BATHHOUSE.test(text);
  const isOutcall = OUTCALL.test(text);
  const isPrivate = PRIVATE_ROOM.test(text);
  const placed = PLACED.has(listing?.geoPrecision);
  const isShop = SHOP_WORDS.test(text) && (placed || Boolean(listing?.mapsUrl));

  const format = isBathhouse ? 'bathhouse'
    : isPrivate ? 'private-room'
      : isShop ? 'shopfront'
        : isOutcall ? 'outcall'
          : 'unstated';

  const grey = computeGreyScore(listing);
  const serviceLine = LINE_BY_GREY[grey.level] || 'mixed';
  const hours = classifyHours(listing);
  const languages = adLanguages(listing);
  const origins = ORIGINS.filter(([, re]) => re.test(text)).map(([id]) => id);
  const contacts = [
    listing?.phone && 'phone',
    listing?.lineUrl && 'line',
    listing?.telegramUrl && 'telegram',
    listing?.mapsUrl && 'maps',
  ].filter(Boolean);

  const outreach = [];
  if (format === 'outcall' || format === 'private-room') outreach.push('hard-to-reach');
  if (hours === 'late-night' || hours === '24h') outreach.push('late-night');
  if (languages.some((l) => l !== 'th' && l !== 'en') || origins.length) outreach.push('other-language');
  if (serviceLine === 'adult') outreach.push('adult-signals');
  if (NEW_STAFF.test(text)) outreach.push('new-staff');
  if (listing?.geoPrecision === 'province' || listing?.geoPrecision === 'none') outreach.push('no-fixed-place');

  return {
    format,
    alsoOutcall: isOutcall && format !== 'outcall',
    serviceLine,
    greyScore: grey.score,
    hours,
    languages,
    origins,
    contacts,
    outreach,
  };
}

/** Filter values for the directory: "format:outcall", "line:therapeutic", "hours:late-night". */
export function matchesCategory(category, filterValue) {
  if (!filterValue || filterValue === 'all') return true;
  const [kind, id] = String(filterValue).split(':');
  if (kind === 'format') return category.format === id || (id === 'outcall' && category.alsoOutcall);
  if (kind === 'line') return category.serviceLine === id;
  if (kind === 'hours') return id === 'late-night' ? ['late-night', '24h'].includes(category.hours) : category.hours === id;
  return true;
}

// ── support: province health services and community organisations ─────────

/** Province-level services from public/data/health/hiv-services.json. */
export function supportFor(listing, servicesPayload) {
  const code = listing?.geoUnit?.province?.code;
  if (!code || !servicesPayload?.provinces) return null;
  const row = servicesPayload.provinces.find((p) => String(p.code).padStart(2, '0') === String(code).padStart(2, '0'));
  if (!row) return null;
  const s = row.services || {};
  return {
    province: { code: row.code, en: row.name, th: row.nameTh },
    // Counts are facilities that FILED a return this year — not a census. A
    // missing row is "did not report" (null), never 0: showing Bangkok as
    // "0 STI clinics" would tell someone there is nowhere to go.
    testingSites: s.lab ? s.lab.facilities ?? null : null,
    stiClinics: s.sti ? s.sti.facilities ?? null : null,
    condomPoints: s.condom ? s.condom.facilities ?? null : null,
    counselling: s.vct ? s.vct.facilities ?? null : null,
    organisations: row.civilSociety?.orgs || [],
    year: servicesPayload.meta?.yearBuddhist || null,
  };
}

// ── district outreach table ────────────────────────────────────────────────

/**
 * Aggregate listings to districts (or to their province when no district is
 * named) with counts per outreach signal, format and service line.
 */
export function summarizeByDistrict(listings) {
  const rows = new Map();
  for (const listing of listings || []) {
    const unit = listing?.geoUnit;
    const key = unit?.district?.code || (unit?.province?.code ? `p${unit.province.code}` : 'unknown');
    const label = unit?.district
      ? { th: unit.district.th, en: unit.district.en, provinceTh: unit.province?.th, provinceEn: unit.province?.en }
      : unit?.province
        ? { th: `${unit.province.th} · ไม่ระบุเขต`, en: `${unit.province.en} · district not stated`, provinceTh: unit.province.th, provinceEn: unit.province.en }
        : { th: 'ไม่ระบุสถานที่', en: 'No place stated', provinceTh: '', provinceEn: '' };
    const row = rows.get(key) || {
      key, ...label, provinceCode: unit?.province?.code || null, isDistrict: Boolean(unit?.district),
      listings: 0, formats: {}, lines: {}, outreach: Object.fromEntries(Object.keys(OUTREACH).map((k) => [k, 0])),
    };
    const c = listing.category || categorizeListing(listing);
    row.listings += 1;
    row.formats[c.format] = (row.formats[c.format] || 0) + 1;
    row.lines[c.serviceLine] = (row.lines[c.serviceLine] || 0) + 1;
    for (const flag of c.outreach) row.outreach[flag] += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => (b.isDistrict - a.isDistrict) || (b.listings - a.listings) || a.en.localeCompare(b.en));
}

/** Attach a category to every listing once, so filters and views share it. */
export function attachCategories(listings) {
  return Array.isArray(listings) ? listings.map((listing) => ({ ...listing, category: categorizeListing(listing) })) : listings;
}

/**
 * Grouped filter options with live counts, hiding any category no listing has —
 * an empty choice in a filter is a question the data cannot answer.
 */
export function categoryFilterGroups(listings) {
  const count = (value) => (listings || []).filter((l) => matchesCategory(l.category || categorizeListing(l), value)).length;
  const option = (value, label) => ({ value, label, count: count(value) });
  const groups = [
    {
      label: 'How it is offered · รูปแบบบริการ',
      options: ['shopfront', 'outcall', 'private-room', 'bathhouse'].map((id) => option(`format:${id}`, `${FORMATS[id].en} · ${FORMATS[id].th}`)),
    },
    {
      label: 'Service · ประเภทบริการ',
      options: ['therapeutic', 'mixed', 'adult'].map((id) => option(`line:${id}`, `${SERVICE_LINES[id].en} · ${SERVICE_LINES[id].th}`)),
    },
    {
      label: 'Hours · เวลา',
      options: [option('hours:late-night', `${HOURS['late-night'].en} · ${HOURS['late-night'].th}`)],
    },
  ];
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.count > 0) }))
    .filter((g) => g.options.length > 0);
}
