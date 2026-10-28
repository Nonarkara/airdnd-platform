/**
 * The canonical OTOP record, and entity resolution over it.
 *
 * Grain: one record = one *product*, carrying the producer that makes it.
 * Source datasets mix the two grains freely, so both are normalised out of
 * every row and resolved independently.
 *
 * ── Why identity is a union of signals, not a ranked key ────────────────────
 *
 * The obvious design is to rank the identifiers (tax ID beats phone beats name)
 * and key each row on the strongest one it has. That design is wrong, and it
 * fails in a way this project has already paid for once: Sabai Sabai keyed
 * venues on a Google Maps link, which is locally unique but globally
 * meaningless, and distinct businesses were merged while real ones vanished
 * (tasks/lessons.md · 2026-08-04).
 *
 * The same trap here is a column like PRODUCT_ID = "P-002". It is a row number
 * inside one agency's spreadsheet. Under a ranked key it outranks the phone
 * number and *blocks* the genuine cross-agency match, so the same producer
 * appears twice and the national count inflates.
 *
 * So: each record emits every identity signal it can support, and records that
 * share ANY signal are unioned. This resolves transitively — A shares a tax ID
 * with B, B shares a phone with C, all three are one producer — which a ranked
 * key can never do.
 *
 * ── The over-merge guard ────────────────────────────────────────────────────
 *
 * Union-find's failure mode is the opposite one: a single shared contact number
 * swallowing the country. A district CDD office phone printed on 200 producer
 * rows would collapse 200 real producers into one.
 *
 * The guard is administrative, not statistical: a phone that appears in more
 * than one province is a switchboard or an aggregator, not a producer, and is
 * withdrawn as an identity signal. A tax ID is never withdrawn — one legal
 * entity can operate across provinces, and that is exactly the multi-site
 * producer we want to see merged.
 */

import { resolveProvince, resolveDistrictToProvince } from './provinces.js';
import { dedupeCerts } from './certs.js';
import { classifyCategory, classifyProducerType, parseStars } from './taxonomy.js';

export const SIGNAL_STRENGTH = ['tax_id', 'phone', 'registration', 'name_area'];

const THAI_DIGITS = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };

export function normalizeText(value, fallback = '') {
  if (value == null) return fallback;
  const out = String(value)
    .replace(/[๐-๙]/g, (d) => THAI_DIGITS[d])
    .replace(/[\u200B-\u200D\uFEFF ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!out || /^(?:null|undefined|n\/?a|-|--|ไม่มี|ไม่ระบุ|ไม่มีข้อมูล)$/i.test(out)) return fallback;
  return out;
}

/**
 * Thai phone numbers reduced to a comparable form. Handles +66 / 66 country
 * codes, Thai numerals, and the multi-number strings government exports are
 * full of ("053-123456 ต่อ 12, 081-2345678" → the first number only).
 */
export function normalizePhone(value) {
  const raw = normalizeText(value, '');
  if (!raw) return '';
  const first = raw.split(/[,;/]|\sหรือ\s|\bor\b/i)[0];
  let digits = first.replace(/ต่อ.*$/, '').replace(/ext\.?.*$/i, '').replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  if (digits.length === 9 && !digits.startsWith('0')) digits = `0${digits}`;
  if (digits.length < 9 || digits.length > 10) return '';
  if (!digits.startsWith('0')) return '';
  if (/^0(\d)\1{7,}$/.test(digits)) return ''; // 0000000000 / 0999999999 placeholders
  return digits;
}

/** เลขประจำตัวผู้เสียภาษี / เลขนิติบุคคล — 13 digits, mod-11 checksum. */
export function normalizeTaxId(value) {
  const digits = normalizeText(value, '').replace(/\D/g, '');
  if (digits.length !== 13) return '';
  if (/^(\d)\1{12}$/.test(digits)) return '';
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]) ? digits : '';
}

/** Collapse a name to a comparison key: drop honorifics, org wrappers, spacing. */
export function nameKey(value) {
  const raw = normalizeText(value, '').toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/^(?:นาย|นาง|นางสาว|น\.ส\.|ดร\.|mr\.?|mrs\.?|ms\.?|dr\.?)\s*/i, '')
    .replace(/^(?:กลุ่ม|วิสาหกิจชุมชน|สหกรณ์|ชมรม|ร้าน|บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.?|บจก\.?)\s*/g, '')
    .replace(/\s*(?:จำกัด|\(มหาชน\)|co\.?,?\s*ltd\.?|company limited)\s*$/i, '')
    // Keep \p{M}: Thai vowel signs and tone marks are Mn, not L. Dropping them
    // collapses บ้าน→บาน and บัว→บว, merging genuinely different names.
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

export function areaKey(record) {
  return [record.provinceCode ?? '', nameKey(record.district), nameKey(record.subdistrict)].join(':');
}

/**
 * Every identity signal this record can support.
 * `registration` is namespaced by dataset: a registration number is only
 * meaningful inside the export that issued it, so it may de-duplicate rows
 * within one agency's file and can never join across agencies.
 */
export function identitySignals(record) {
  const signals = [];
  if (record.taxId) signals.push({ type: 'tax_id', key: `tax:${record.taxId}` });
  if (record.phone) signals.push({ type: 'phone', key: `tel:${record.phone}` });
  if (record.registrationId && record.provenance?.datasetId) {
    signals.push({ type: 'registration', key: `reg:${record.provenance.datasetId}:${record.registrationId}` });
  }
  const name = nameKey(record.producerName);
  // Name is never identity on its own: Thai community groups reuse names
  // constantly — there are dozens of กลุ่มทอผ้าบ้านหนองบัว nationwide — so a
  // name-only key silently merges unrelated producers in different provinces.
  if (name && record.provinceCode != null) signals.push({ type: 'name_area', key: `nm:${name}@${areaKey(record)}` });
  return signals;
}

class UnionFind {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); return x; }
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let cursor = x;
    while (this.parent.get(cursor) !== root) { const next = this.parent.get(cursor); this.parent.set(cursor, root); cursor = next; }
    return root;
  }
  union(a, b) {
    const ra = this.find(a); const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Identify phone signals that span more than one province. Those are shared
 * office or aggregator numbers, not producer identity, and using them would
 * collapse every producer in a district into a single record.
 * @returns {Set<string>} signal keys to withdraw
 */
export function findOverbroadSignals(records, { maxProvinces = 1 } = {}) {
  const provincesBySignal = new Map();

  for (const record of records) {
    for (const signal of identitySignals(record)) {
      if (signal.type !== 'phone') continue;
      if (!provincesBySignal.has(signal.key)) provincesBySignal.set(signal.key, new Set());
      if (record.provinceCode != null) provincesBySignal.get(signal.key).add(record.provinceCode);
    }
  }

  const withdrawn = new Set();
  for (const [key, provinces] of provincesBySignal) {
    if (provinces.size > maxProvinces) withdrawn.add(key);
  }
  return withdrawn;
}

/**
 * Build a canonical record from an already field-mapped row. Every field is
 * optional and a missing field is null — never a default. `provenance` is
 * mandatory: a record that cannot say where it came from does not get to exist.
 */
export function buildRecord(row, provenance) {
  if (!provenance || !provenance.datasetId || !provenance.resourceId) {
    throw new Error('buildRecord: provenance {datasetId, resourceId, retrievedAt} is required');
  }

  const producerName = normalizeText(row.producerName, '') || null;
  const productName = normalizeText(row.productName, '') || null;
  const districtRaw = normalizeText(row.district, '') || '';
  // Province resolution. The central OTOP producer registry exports only
  // อำเภอ and ตำบล, not จังหวัด, so the district→province reverse index is a
  // required second pass. Order: explicit province → district lookup → address
  // substring. Returns null on ambiguity rather than guessing.
  let province = resolveProvince(row.province ?? row.provinceCode ?? '');
  if (!province && districtRaw) province = resolveDistrictToProvince(districtRaw);
  if (!province) province = resolveProvince(row.address ?? '');
  const category = classifyCategory({
    declared: row.category,
    text: [productName, row.productDescription].filter(Boolean).join(' '),
  });
  // Coordinates are validated jointly: a lone half-coordinate is worse than
  // none, and these exports use 0 as a null-placeholder (seven Satun rows
  // sit at exactly 0,0; one Bangkok row parses to lat 3.69, deep in
  // Malaysia). Both halves must parse and land inside a Thailand bounding
  // box with border margin, or both are null.
  const { latitude, longitude } = parseLatLng(row.latitude, row.longitude);

  return {
    sourceRowId: String(row.sourceRowId ?? ''),
    producerName,
    producerType: classifyProducerType({ declared: row.producerType, name: producerName ?? '' }),
    productName,
    description: normalizeText(row.productDescription, '') || null,

    category: category.category,
    categoryConfidence: category.confidence,
    stars: parseStars(row.stars),

    province: province ? province.th : null,
    provinceEn: province ? province.en : null,
    provinceCode: province ? province.code : null,
    region: province ? province.region : null,
    district: districtRaw || null,
    subdistrict: normalizeText(row.subdistrict, '') || null,
    address: normalizeText(row.address, '') || null,

    phone: normalizePhone(row.phone) || null,
    email: normalizeText(row.email, '') || null,
    website: normalizeText(row.website, '') || null,
    imageUrl: normalizeText(row.imageUrl, '') || null,
    taxId: normalizeTaxId(row.taxId) || null,
    registrationId: normalizeText(row.registrationId, '') || null,

    price: parsePrice(row.price),
    income: parseIncome(row.income),
    registeredYear: parseBuddhistYear(row.registeredYear),

    latitude,
    longitude,

    certs: (() => {
      const cert = buildCert({
        number: row.certNumber,
        standardCode: row.certStandardCode,
        standardTitle: row.certStandardTitle,
        issued: row.certIssued,
        expires: row.certExpires,
      });
      return cert ? [cert] : [];
    })(),

    provenance: {
      datasetId: provenance.datasetId,
      datasetTitle: provenance.datasetTitle ?? null,
      resourceId: provenance.resourceId,
      organization: provenance.organization ?? null,
      retrievedAt: provenance.retrievedAt ?? null,
      licence: provenance.licence ?? null,
    },
  };
}

/** Coordinates from government exports: "13.7563", "13°45'22.7\"N", Thai numerals. */
export function parseCoordinate(value) {
  const raw = normalizeText(value, '');
  if (!raw) return null;
  // Simple decimal: "13.7563"
  const decimal = Number(raw.replace(/,/g, ''));
  // Exact zero is the null-placeholder in these exports, never a real
  // producer location — no Thai producer sits on the equator or the prime
  // meridian.
  if (Number.isFinite(decimal) && decimal !== 0 && Math.abs(decimal) <= 180) {
    return Math.round(decimal * 1_000_000) / 1_000_000;
  }
  if (decimal === 0) return null;
  // DMS: "13°45'22.7\"N" or "13 45 22.7"
  const dms = raw.match(/(\d+)[°\s]+(\d+)[′'"]+\s*([\d.]+)[″""]*\s*([NSEW]?)/i);
  if (dms) {
    let dd = Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600;
    if (dms[4]?.toUpperCase() === 'S' || dms[4]?.toUpperCase() === 'W') dd = -dd;
    if (Math.abs(dd) <= 180) return Math.round(dd * 1_000_000) / 1_000_000;
  }
  return null;
}

/**
 * Joint lat/lng validation. Thailand spans roughly 5.6–20.5°N, 97.3–105.6°E;
 * the box below carries border margin so legitimate edge producers (Mae Sai,
 * Betong, Mae Hong Son) survive while misparses (lat 3.69, off Malaysia) do
 * not. Anything failing any check yields { latitude: null, longitude: null }.
 */
export function parseLatLng(latValue, lngValue) {
  const none = { latitude: null, longitude: null };
  const latitude = parseCoordinate(latValue);
  const longitude = parseCoordinate(lngValue);
  if (latitude == null || longitude == null) return none;
  if (latitude < 4.5 || latitude > 21.5) return none;
  if (longitude < 96.5 || longitude > 106.5) return none;
  return { latitude, longitude };
}

/** Prices arrive as "150", "150 บาท", "100-250", "๑๕๐". Take the low bound. */
export function parsePrice(value) {
  const raw = normalizeText(value, '');
  if (!raw) return null;
  const match = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const price = Number(match[1]);
  return Number.isFinite(price) && price > 0 && price < 10_000_000 ? price : null;
}

/** Income can be much larger than a single product price. */
export function parseIncome(value) {
  const raw = normalizeText(value, '');
  if (!raw) return null;
  const match = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const income = Number(match[1]);
  // Allow up to 10 billion for annual income
  return Number.isFinite(income) && income > 0 && income < 10_000_000_000 ? income : null;
}

/**
 * Certificate dates from the มผช. holder lists. Usually ISO ("2024-06-21"),
 * sometimes Thai-style day/month with a Buddhist-Era year ("21/06/2567").
 * Returns YYYY-MM-DD or null. A date that cannot be read is null, never a
 * guess — an unreadable expiry must surface as "unknown", not "valid".
 */
export function parseCertDate(value) {
  const raw = normalizeText(value, '');
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    let year = Number(iso[1]);
    if (year >= 2400 && year <= 2700) year -= 543;
    if (year < 1900 || year > 2200) return null;
    const month = Number(iso[2]); const day = Number(iso[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const dmy = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year >= 2400 && year <= 2700) year -= 543;
    if (year < 1900 || year > 2200) return null;
    const month = Number(dmy[2]); const day = Number(dmy[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

/**
 * One มผช. (Community Product Standard) certificate carried by a source row.
 * All fields optional; null when the row carries no certificate at all.
 * This is provenance, never identity: two products from one certified holder
 * share a certificate but are different records, so cert fields must never
 * enter identitySignals().
 */
export function buildCert({ number, standardCode, standardTitle, issued, expires }) {
  const cert = {
    number: normalizeText(number, '') || null,
    standardCode: normalizeText(standardCode, '') || null,
    standardTitle: normalizeText(standardTitle, '') || null,
    issued: parseCertDate(issued),
    expires: parseCertDate(expires),
  };
  return (cert.number || cert.standardCode || cert.standardTitle || cert.issued || cert.expires) ? cert : null;
}

/**
 * The identity of a certificate is its number and its dates — see core/certs.js,
 * which the browser also uses so a built shard's repeated filing is printed
 * once. Re-exported here because the build thinks in records.
 */
export { dedupeCerts } from './certs.js';

/**
 * Certificate standing of a merged record as of a build date (YYYY-MM-DD).
 *   valid   — at least one certificate expires on or after asOf
 *   expired — certificates exist, every parseable expiry is before asOf
 *   unknown — certificates exist but none carries a parseable expiry
 *   null    — no certificate at all
 * asOf is a parameter, not "today", so the same inputs always build the
 * same output and the standing is stamped next to the date it was judged on.
 */
export function certStatus(certs, asOf) {
  if (!certs || certs.length === 0) return null;
  if (typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return 'unknown';
  let anyDated = false;
  for (const cert of certs) {
    if (!cert.expires) continue;
    anyDated = true;
    if (cert.expires >= asOf) return 'valid';
  }
  return anyDated ? 'expired' : 'unknown';
}

/**
 * Thai government data is Buddhist Era: 2563 → 2020. Both eras are accepted and
 * normalised to CE, because merged exports routinely carry mixed-era columns.
 */
export function parseBuddhistYear(value) {
  const raw = normalizeText(value, '');
  if (!raw) return null;
  const match = raw.match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (year >= 2400 && year <= 2700) return year - 543;
  if (year >= 1900 && year <= 2200) return year;
  return null;
}

const QUALITY_RULES = [
  { id: 'no_name', test: (r) => !r.producerName && !r.productName },
  { id: 'numeric_name', test: (r) => /^[\d\s.-]+$/.test(r.productName ?? r.producerName ?? 'x') },
  { id: 'no_area', test: (r) => r.provinceCode == null },
];

/**
 * The quality gate returns reasons, not a boolean. A rejected row is counted and
 * reported: a silently dropped row is indistinguishable from a row that was
 * never fetched, and that difference decides whether "national coverage" is a
 * claim or a guess.
 */
export function gradeRecord(record) {
  const rejects = QUALITY_RULES.filter((rule) => rule.test(record)).map((rule) => rule.id);
  return { ok: rejects.length === 0, rejects };
}

/**
 * Resolve records into entities by unioning shared identity signals, then merge
 * each group.
 *
 * Merge rules — first non-null wins, except:
 *   stars       highest grading ever awarded (a 5-star result is not undone by
 *               an older 3-star row)
 *   provenance  every source that attested the record is kept, which is what
 *               makes cross-agency agreement measurable rather than assumed
 */
export function mergeRecords(records, { maxProvincesPerPhone = 1 } = {}) {
  const withdrawn = findOverbroadSignals(records, { maxProvinces: maxProvincesPerPhone });
  const uf = new UnionFind();

  records.forEach((record, index) => {
    const self = `row:${index}`;
    uf.find(self);
    for (const signal of identitySignals(record)) {
      if (withdrawn.has(signal.key)) continue;
      uf.union(self, signal.key);
    }
  });

  const groups = new Map();
  records.forEach((record, index) => {
    const root = uf.find(`row:${index}`);
    if (!groups.has(root)) groups.set(root, []);
    // Carry the index: resolving it later with records.indexOf() would be
    // O(n2), which is fine on a fixture and ruinous on a national pull.
    groups.get(root).push({ record, index });
  });

  const merged = [];
  for (const [root, members] of groups) {
    const group = members.map((m) => m.record);
    const out = { ...group[0], provenance: [group[0].provenance] };

    for (const record of group.slice(1)) {
      for (const [field, value] of Object.entries(record)) {
        if (field === 'provenance') continue;
        if (field === 'certs') continue;
        if (out[field] == null && value != null) out[field] = value;
      }
      if (record.stars != null && (out.stars == null || record.stars > out.stars)) out.stars = record.stars;
      if (!out.provenance.some((p) => p.resourceId === record.provenance.resourceId)) {
        out.provenance.push(record.provenance);
      }
    }

    // Certificates union across the group like any other provenance: one
    // holder certified for three products carries three certificates, and a
    // cert row merged with a non-cert row must not lose the certificate.
    // Distinct by certificate identity, so repeated filings of the same
    // certificate (the มผช. list is snapshotted many times, and the agencies
    // disagree about which columns they fill) count once.
    out.certs = dedupeCerts(group.flatMap((record) => record.certs ?? []));

    // Which signal types actually held this group together. Only meaningful for
    // a group of more than one: a singleton was not merged by anything, and
    // reporting its strongest *available* signal as a merge basis would inflate
    // the apparent amount of cross-source corroboration in the dataset.
    let mergeBasis = null;
    if (group.length > 1) {
      const counts = new Map();
      const shared = new Set();
      for (const record of group) {
        for (const signal of identitySignals(record)) {
          if (withdrawn.has(signal.key)) continue;
          counts.set(signal.key, (counts.get(signal.key) ?? 0) + 1);
          if (counts.get(signal.key) > 1) shared.add(signal.type);
        }
      }
      mergeBasis = SIGNAL_STRENGTH.find((type) => shared.has(type)) ?? null;
    }

    merged.push({
      ...out,
      identityKey: root,
      mergeBasis,
      strongestSignal: identitySignals(out)[0]?.type ?? 'unmergeable',
      mergedFrom: group.length,
      sourceCount: out.provenance.length,
      withdrawnSignals: [...new Set(identitySignals(out).filter((s) => withdrawn.has(s.key)).map((s) => s.type))],
    });
  }

  return merged;
}
