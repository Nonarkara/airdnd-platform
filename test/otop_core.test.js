import test from 'node:test';
import assert from 'node:assert/strict';

import { PROVINCES, REGION_ORDER, resolveProvince } from '../otop/core/provinces.js';
import { classifyCategory, parseStars, CATEGORIES } from '../otop/core/taxonomy.js';
import { decodeBuffer, csvToObjects } from '../otop/core/text_decode.js';
import { discoverFieldMap, isUsableMapping, classifyResource } from '../otop/core/field_map.js';
import { loadTambons, tambonFor, areaNameKey } from '../otop/core/geo.js';
import { tallyByTambon } from '../otop/core/tambon_tally.js';
import {
  buildRecord, gradeRecord, mergeRecords, findOverbroadSignals,
  normalizePhone, normalizeTaxId, parseBuddhistYear, parseCoordinate, parseLatLng, nameKey, parsePrice, parseIncome
} from '../otop/core/record.js';

const prov = (datasetId = 'ds1', resourceId = 'r1') => ({ datasetId, resourceId, retrievedAt: '2026-09-08T00:00:00Z' });
const row = (over = {}) => ({ sourceRowId: 'x#0', producerName: 'กลุ่มทดสอบ', productName: 'ผ้าทอ', province: 'บุรีรัมย์', provinceCode: 31, provenance: prov(), ...over });

test('77 provinces, unique codes, NESDC region totals reconcile', () => {
  assert.equal(PROVINCES.length, 77);
  assert.equal(new Set(PROVINCES.map((p) => p.code)).size, 77);
  const counts = Object.fromEntries(REGION_ORDER.map((r) => [r, PROVINCES.filter((p) => p.region === r).length]));
  assert.deepEqual(counts, { north: 9, northeast: 20, central: 22, east: 7, west: 5, south: 14 });
});

test('province resolves from Thai, romanisation, TIS-1099 code, ISO and free-text address', () => {
  for (const input of ['เชียงใหม่', 'จ.เชียงใหม่', 'Chiang Mai', 50, '50', 'TH-50', '119 ม.4 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200']) {
    assert.equal(resolveProvince(input)?.code, 50, `failed for ${input}`);
  }
});

test('province refuses to guess rather than defaulting to Bangkok', () => {
  for (const input of ['Narnia', '', null, 'ไม่ระบุ']) assert.equal(resolveProvince(input), null);
});

test('category prefers a declared code or name over inference', () => {
  assert.deepEqual(classifyCategory({ declared: '3' }), { category: 'textile', confidence: 'declared', matched: '3' });
  assert.equal(classifyCategory({ declared: 'ของใช้/ของตกแต่ง/ของที่ระลึก' }).category, 'craft');
});

test('category inference is head-initial: the leading noun names the product form', () => {
  // Without head weighting "ไวน์มะม่วง" scores as food on the longer ingredient word.
  assert.equal(classifyCategory({ text: 'ไวน์มะม่วงหาวมะนาวโห่' }).category, 'beverage');
  assert.equal(classifyCategory({ text: 'สบู่สมุนไพรข้าวหอมมะลิ' }).category, 'herbal');
  assert.equal(classifyCategory({ text: 'ตะกร้าจักสานผักตบชวา' }).category, 'craft');
});

test('category returns none rather than a wrong guess', () => {
  assert.deepEqual(classifyCategory({ text: 'zzzz' }), { category: null, confidence: 'none', matched: null });
  assert.equal(CATEGORIES.length, 5);
});

test('stars distinguish ungraded (0) from unrecorded (null)', () => {
  assert.equal(parseStars('ไม่ผ่าน'), 0);
  assert.equal(parseStars(''), null);
  assert.equal(parseStars('ระดับ 4 ดาว'), 4);
});

test('TIS-620 buffers are detected and decoded, UTF-8 is left alone', () => {
  const thai = 'ชื่อผลิตภัณฑ์,ราคา\nผ้าไหม,1500';
  const tis = Buffer.from([...thai].map((c) => (c.charCodeAt(0) > 0x0e00 ? c.charCodeAt(0) - 0x0d60 : c.charCodeAt(0))));
  const decoded = decodeBuffer(tis);
  assert.equal(decoded.encoding, 'tis-620');
  assert.equal(decoded.text, thai);
  assert.equal(decodeBuffer(Buffer.from(thai, 'utf8')).encoding, 'utf-8');
});

test('CSV handles quoted delimiters, doubled quotes and CRLF', () => {
  const rows = csvToObjects('a,b\r\n"x, y","he said ""hi"""\r\n');
  assert.deepEqual(rows, [{ a: 'x, y', b: 'he said "hi"' }]);
});

test('field discovery maps Thai and Latin headers, and refuses irrelevant resources', () => {
  const aliases = { productName: ['ชื่อผลิตภัณฑ์', 'product_name'], province: ['จังหวัด', 'province_code'] };
  assert.ok(isUsableMapping(discoverFieldMap(['ชื่อผลิตภัณฑ์', 'จังหวัด'], aliases).map));
  assert.ok(isUsableMapping(discoverFieldMap(['PRODUCT_NAME', 'PROVINCE_CODE'], aliases).map));
  assert.equal(isUsableMapping(discoverFieldMap(['หัวข้อ', 'เนื้อหา'], aliases).map), false);
});

test('phone normalisation handles +66, Thai numerals, extensions; rejects placeholders', () => {
  assert.equal(normalizePhone('+66812345678'), '0812345678');
  assert.equal(normalizePhone('๐๘๑๒๓๔๕๖๗๘'), '0812345678');
  assert.equal(normalizePhone('053-123456 ต่อ 12'), '053123456');
  assert.equal(normalizePhone('0000000000'), '');
});

test('tax ID enforces the mod-11 checksum', () => {
  const stem = '310170121234';
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(stem[i]) * (13 - i);
  const valid = stem + ((11 - (sum % 11)) % 10);
  assert.equal(normalizeTaxId(valid), valid);
  assert.equal(normalizeTaxId(stem + (((11 - (sum % 11)) % 10) + 1) % 10), '');
});

test('Buddhist and Common era both normalise to CE', () => {
  assert.equal(parseBuddhistYear('2563'), 2020);
  assert.equal(parseBuddhistYear(2020), 2020);
  assert.equal(parseBuddhistYear(''), null);
});

test('name keys keep Thai vowel signs and tone marks', () => {
  assert.notEqual(nameKey('บ้าน'), nameKey('บาน'));
  assert.equal(nameKey('กลุ่มทอผ้าบ้านหนองบัว'), nameKey('กลุ่ม ทอผ้า บ้านหนองบัว'));
});

test('buildRecord refuses to exist without provenance', () => {
  assert.throws(() => buildRecord(row(), null), /provenance/);
});

test('quality gate reports reasons, and never defaults a missing province', () => {
  const r = buildRecord(row({ province: 'ไม่ระบุ' }), prov());
  assert.equal(r.provinceCode, null);
  assert.deepEqual(gradeRecord(r).rejects, ['no_area']);
});

test('a source-local registration id never merges across datasets', () => {
  // The exact trap that a ranked identity key falls into: "P-002" is a row
  // number in one agency's export, not a national identifier.
  const a = buildRecord(row({ registrationId: 'P-002', producerName: 'กลุ่ม ก' }), prov('dsA', 'rA'));
  const b = buildRecord(row({ registrationId: 'P-002', producerName: 'กลุ่ม ข' }), prov('dsB', 'rB'));
  assert.equal(mergeRecords([a, b]).length, 2);
});

test('records union transitively across sources: tax ID joins A-B, phone joins B-C', () => {
  const stem = '310170121234';
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(stem[i]) * (13 - i);
  const tax = stem + ((11 - (sum % 11)) % 10);

  const a = buildRecord(row({ sourceRowId: 'a', taxId: tax, producerName: 'ชื่อ A' }), prov('ds1', 'r1'));
  const b = buildRecord(row({ sourceRowId: 'b', taxId: tax, phone: '081-111-2222', producerName: 'ชื่อ B' }), prov('ds2', 'r2'));
  const c = buildRecord(row({ sourceRowId: 'c', phone: '0811112222', producerName: 'ชื่อ C' }), prov('ds3', 'r3'));

  const merged = mergeRecords([a, b, c]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].mergedFrom, 3);
  assert.equal(merged[0].sourceCount, 3);
});

test('a phone spanning two provinces is withdrawn as identity', () => {
  const a = buildRecord(row({ sourceRowId: 'a', phone: '02-111-2222', province: 'บุรีรัมย์', producerName: 'กลุ่ม ก' }), prov());
  const b = buildRecord(row({ sourceRowId: 'b', phone: '02-111-2222', province: 'เชียงใหม่', producerName: 'กลุ่ม ข' }), prov());
  assert.equal(findOverbroadSignals([a, b]).size, 1);
  const merged = mergeRecords([a, b]);
  assert.equal(merged.length, 2, 'a shared office number must not fuse two provinces');
  assert.deepEqual(merged[0].withdrawnSignals, ['phone']);
});

test('merge keeps the highest star grading and every attesting source', () => {
  const a = buildRecord(row({ sourceRowId: 'a', phone: '081-111-2222', stars: '3' }), prov('ds1', 'r1'));
  const b = buildRecord(row({ sourceRowId: 'b', phone: '081-111-2222', stars: '5' }), prov('ds2', 'r2'));
  const [merged] = mergeRecords([a, b]);
  assert.equal(merged.stars, 5);
  assert.equal(merged.sourceCount, 2);
  assert.equal(merged.mergeBasis, 'phone');
});

test('a singleton reports no merge basis', () => {
  const [merged] = mergeRecords([buildRecord(row({ phone: '081-111-2222' }), prov())]);
  assert.equal(merged.mergeBasis, null);
  assert.equal(merged.strongestSignal, 'phone');
});

test('zero is a null-placeholder, not a coordinate', () => {
  assert.equal(parseCoordinate(0), null);
  assert.equal(parseCoordinate('0'), null);
  assert.equal(parseCoordinate('0.000000'), null);
  assert.equal(parseCoordinate('13.7563'), 13.7563);
});

test('lat/lng validate jointly inside a Thailand box with border margin', () => {
  // Real producers at the edges survive.
  assert.deepEqual(parseLatLng('20.4278', '99.8841'), { latitude: 20.4278, longitude: 99.8841 }); // Mae Sai
  assert.deepEqual(parseLatLng('5.7776', '101.0609'), { latitude: 5.7776, longitude: 101.0609 }); // Betong
  // Null-island placeholders and misparses do not.
  assert.deepEqual(parseLatLng(0, 0), { latitude: null, longitude: null }); // seven Satun rows
  assert.deepEqual(parseLatLng('3.695545', '100.41582'), { latitude: null, longitude: null }); // off Malaysia
  // A lone half-coordinate is worse than none: both go null.
  assert.deepEqual(parseLatLng('13.7563', null), { latitude: null, longitude: null });
  assert.deepEqual(parseLatLng(null, '100.5018'), { latitude: null, longitude: null });
});

test('buildRecord carries valid coordinates and nulls the rest', () => {
  const ok = buildRecord(row({ latitude: '15.2297', longitude: '104.8579' }), prov());
  assert.equal(ok.latitude, 15.2297);
  assert.equal(ok.longitude, 104.8579);
  const bad = buildRecord(row({ latitude: 0, longitude: 0 }), prov());
  assert.equal(bad.latitude, null);
  assert.equal(bad.longitude, null);
});

test('parseIncome handles messy values and large numbers up to 10 billion', () => {
  assert.equal(parseIncome('1500000.0'), 1500000);
  assert.equal(parseIncome('50,000-100,000 บาท'), 50000);
  assert.equal(parseIncome('๑๕๐,๐๐๐'), 150000);
  assert.equal(parseIncome('20,000,000'), 20000000);
  assert.equal(parseIncome('ไม่ระบุ'), null);
});

test('classifyResource is the one definition of an economic aggregate', () => {
  const unusable = { title: 'รายได้จากการจำหน่ายสินค้า OTOP', map: { province: 'จังหวัด' }, unmapped: ['มูลค่า', 'หน่วย'] };
  assert.equal(classifyResource(unusable), 'aggregate-economic');
  // The leak: field discovery mapped a revenue column as the product name.
  const leak = { title: 'รายได้จากหมู่บ้านท่องเที่ยว OTOP นวัตวิถี', map: { productName: 'รายได้จากผลิตภัณฑ์', province: 'จังหวัด' }, unmapped: [] };
  assert.equal(classifyResource(leak), 'aggregate-economic');
  assert.equal(classifyResource({ title: 'ข้อมูลผลิตภัณฑ์ OTOP', map: { productName: 'ชื่อผลิตภัณฑ์', province: 'จังหวัด' }, unmapped: [] }), 'producer');
  assert.equal(classifyResource({ title: '(มอก.) รายชื่อมาตรฐานผลิตภัณฑ์อุตสาหกรรม', map: {}, unmapped: ['เลขที่ มอก.', 'ชื่อ'] }), 'other');
});

test('tambon placement joins on the name the record carries and refuses ambiguity', () => {
  const geo = loadTambons();
  assert.ok(geo.byCode.size >= 7400);
  assert.equal(tambonFor({ provinceCode: 20, district: 'สัตหีบ', subdistrict: 'สัตหีบ' }, geo), '200901');
  // prefixes the registry sometimes carries are stripped
  assert.equal(tambonFor({ provinceCode: 20, district: 'อ.สัตหีบ', subdistrict: 'ต.สัตหีบ' }, geo), '200901');
  // fallback by tambon name only when unique within the province
  const anyUnique = [...geo.byTambon].find(([, v]) => v.length === 1);
  const [prov, tKey] = anyUnique[0].split(':');
  const ref = geo.byCode.get(anyUnique[1][0]);
  assert.equal(tambonFor({ provinceCode: Number(prov), district: 'wrong', subdistrict: ref.th }, geo), anyUnique[1][0]);
  assert.equal(areaNameKey(ref.th), tKey);
  // junk and missing never place
  for (const bad of ['FALSE', '0', 'ป.ร.', null]) assert.equal(tambonFor({ provinceCode: 10, district: 'x', subdistrict: bad }, geo), null);
});

test('tallyByTambon groups matcher output or bare records, counts reachability, caps and sorts', () => {
  const rec = (tambonCode, phone) => ({ tambonCode, phone });
  const matches = [
    { record: rec('100101', '0812345678'), score: 90 },
    { record: rec('100101', null), score: 80 },
    rec('200901', null),
    rec(null, '0899999999'), // unplaceable: counted nowhere
  ];
  const out = tallyByTambon(matches);
  assert.equal(out.placeable, 3);
  assert.deepEqual(out.rows.map((r) => [r.code, r.n, r.reachable]), [['100101', 2, 1], ['200901', 1, 0]]);
  assert.equal(out.maxN, 2);
  assert.equal(tallyByTambon(matches, { max: 1 }).rows.length, 1);
  assert.equal(tallyByTambon(matches, { max: 0 }).placeable, 3); // placeable is counted before the cap
});

test('over-merge guard: phone spanning 2+ provinces is withdrawn as identity', () => {
  const r1 = { ...row(), phone: '0812345678', provinceCode: 10, sourceRowId: 'ds1#0' };
  const r2 = { ...row(), phone: '0812345678', provinceCode: 30, sourceRowId: 'ds1#1' };
  const withdrawn = findOverbroadSignals([r1, r2]);
  assert.equal(withdrawn.size, 1, 'one phone signal withdrawn');
  const key = `tel:0812345678`;
  assert.equal(withdrawn.has(key), true);
});

test('over-merge guard: phone scoped to one province is NOT withdrawn', () => {
  const r1 = { ...row(), phone: '0812345678', provinceCode: 10, sourceRowId: 'ds1#0' };
  const r2 = { ...row(), phone: '0812345678', provinceCode: 10, sourceRowId: 'ds1#1' };
  const withdrawn = findOverbroadSignals([r1, r2]);
  assert.equal(withdrawn.size, 0, 'no withdrawal for single-province phone');
});

test('tax ID is NEVER withdrawn even if it spans provinces', () => {
  const r1 = { ...row(), taxId: '1234567890123', provinceCode: 10, sourceRowId: 'ds1#0' };
  const r2 = { ...row(), taxId: '1234567890123', provinceCode: 30, sourceRowId: 'ds1#1' };
  const withdrawn = findOverbroadSignals([r1, r2]);
  assert.equal(withdrawn.size, 0, 'tax ID must never be withdrawn');
  const merged = mergeRecords([r1, r2]);
  assert.equal(merged.length, 1, 'same tax ID merges into one entity');
  assert.equal(merged[0].mergedFrom, 2, 'both records merged');
});

test('ranked key trap: a low-signal registration number does not block a phone match', () => {
  const r1 = { ...row(), phone: '0811111111', registrationId: 'P-002', provinceCode: 10, sourceRowId: 'ds1#0' };
  const r2 = { ...row(), phone: '0811111111', registrationId: 'P-999', provinceCode: 10, sourceRowId: 'ds2#0' };
  const merged = mergeRecords([r1, r2]);
  assert.equal(merged.length, 1, 'phone match wins over registration numbers');
});

test('buildRecord throws if provenance is missing', () => {
  assert.throws(() => buildRecord(row(), null), /provenance/);
  assert.throws(() => buildRecord(row(), {}), /provenance/);
  assert.throws(() => buildRecord(row(), { datasetId: 'x' }), /provenance/);
});

test('gradeRecord rejects no-name and no-area rows, never silently dropping them', () => {
  const noName = { ...row(), producerName: null, productName: null, province: 'บุรีรัมย์' };
  const noArea = { ...row(), province: null, provinceCode: null };
  assert.deepEqual(gradeRecord(noName).rejects, ['no_name']);
  assert.deepEqual(gradeRecord(noArea).rejects, ['no_area']);
  assert.equal(gradeRecord(row()).ok, true);
});
