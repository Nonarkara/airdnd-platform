import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdminIndex } from '../scripts/lib/geo_index.js';
import {
  coordinatesInMapsLink,
  placeListings,
  prepareAdminIndex,
  resolveListingPlace,
  resolvePlace,
} from '../src/lib/place_resolver.js';

// Full national index — what the pipeline resolves against.
const index = prepareAdminIndex(buildAdminIndex());
const place = (text, opts) => resolvePlace(text, index, opts);

test('a full Thai address resolves to its subdistrict', () => {
  const p = place('86 ซอย ลาดพร้าว 71 แขวงสะพานสอง เขตวังทองหลาง กรุงเทพมหานคร 10310');
  assert.equal(p.level, 'tambon');
  assert.equal(p.tambon.th, 'สะพานสอง');
  assert.equal(p.district.th, 'วังทองหลาง');
});

test('English addresses resolve, whatever the spacing of the romanisation', () => {
  const p = place('605 Soi Sangkhom Songkhro 15, Saphansong, Wang Thonglang, Bangkok 10310');
  assert.equal(p.tambon.th, 'สะพานสอง');
  assert.equal(p.district.th, 'วังทองหลาง');
  assert.equal(place('15 Seri Thai 4 Alley, Khlong Kum, Bueng Kum, Bangkok 10240').district.th, 'บึงกุ่ม');
});

test('a road that shares a district name is not that district', () => {
  // ลาดพร้าว 71 is a soi in Wang Thonglang; รามอินทรา 52/1 is a soi number.
  const p = place('Yesika Spa @ ลาดพร้าว 71', { cityHint: 'Bangkok' });
  assert.notEqual(p?.district?.th, 'ลาดพร้าว');
  assert.equal(p.level, 'province');
  assert.equal(place('ร้านนวด ลาดกระบัง54', { cityHint: 'Bangkok' }).level, 'province');
});

test('a bare district name, used as a place, still counts', () => {
  assert.equal(place('ฮันนี่69 นวดเพื่อสุขภาพ ลาดกระบัง', { cityHint: 'Bangkok' }).district.th, 'ลาดกระบัง');
});

test('the province written last wins over one named earlier as a road', () => {
  assert.equal(place('Rangsit-Nakhon Nayok 34/1, Pathum Thani').province.en, 'Pathum Thani');
});

test('dropped tone marks and truncated names are forgiven', () => {
  const bangYai = place('บางใหญ');
  assert.equal(bangYai.district.th, 'บางใหญ่');
  assert.equal(bangYai.province.en, 'Nonthaburi');
  assert.equal(place('ศิริมันตรา พิกัดสระบุร').province.en, 'Saraburi');
});

test('"เมือง <province>" means the capital district', () => {
  assert.equal(place('ตำบล หนองไม้แดง เมือง ชลบุรี 20000').district.th, 'เมืองชลบุรี');
  assert.equal(place('ร้านนวด พิกัด ตัวเมืองนครปฐม').district.th, 'เมืองนครปฐม');
});

test('a province name is never mistaken for the subdistrict that shares it', () => {
  const p = place('เทพี นวดเพื่อสุขภาพ พิกัด ศาลายา นครปฐม');
  assert.equal(p.tambon.th, 'ศาลายา');
  assert.equal(p.district.th, 'พุทธมณฑล');
});

test('duplicate subdistrict names need a postal code, or are left unresolved', () => {
  // Bangkok has two แขวงบางจาก: Phra Khanong (10260) and Phasi Charoen (10160).
  assert.equal(place('แขวงบางจาก กรุงเทพมหานคร').level, 'province');
  assert.equal(place('แขวงบางจาก กรุงเทพมหานคร 10260').district.th, 'พระโขนง');
  assert.equal(place('แขวงบางจาก กรุงเทพมหานคร 10160').district.th, 'ภาษีเจริญ');
});

test('nothing recognisable resolves to nothing, never to a default', () => {
  assert.equal(place('นวดใกล้ฉัน'), null);
});

test('coordinates written into the Maps link itself are read directly', () => {
  assert.deepEqual(coordinatesInMapsLink('https://maps.google.com/maps?q=13.788024%2C100.409086'), [13.788024, 100.409086]);
  assert.deepEqual(coordinatesInMapsLink('https://www.google.com/maps/place/x/@13.7317,100.5652,17z'), [13.7317, 100.5652]);
  assert.equal(coordinatesInMapsLink('https://maps.app.goo.gl/uXKLYmTN95E9CFXF7'), null);
});

test('the pipeline default location is not evidence, so it cannot veto a point', () => {
  const [g] = placeListings([{ id: 1, location: 'Bangkok, Thailand', city: 'Bangkok', latitude: 20.4335, longitude: 99.8853, mapsUrl: 'https://maps.app.goo.gl/a' }], index).values();
  assert.equal(g.geoPrecision, 'exact');
  assert.equal(g.geoSource, 'maps-unverified');
});

test('the listing name places it when the location says nothing', () => {
  const p = resolveListingPlace({ name: 'ฟ้ารุ่งเรือง นวดเพื่อสุขภาพ เชียงราย', location: 'Bangkok, Thailand', city: 'Bangkok' }, index);
  assert.equal(p.province.en, 'Chiang Rai');
});

test('placeholders are rejected: Google page default and the city centroid', () => {
  const out = placeListings([
    { id: 'g', location: 'แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', latitude: 13.9522, longitude: 100.565, mapsUrl: 'https://maps.app.goo.gl/g' },
    { id: 'c', location: 'Bangkok, Thailand', city: 'Bangkok', latitude: 13.7563, longitude: 100.5018 },
  ], index);
  assert.equal(out.get('g').geoPrecision, 'tambon');
  assert.match(out.get('g').geoNote, /google-page-default/);
  assert.equal(out.get('c').geoPrecision, 'province');
  assert.equal(out.get('c').latitude, 13.7563); // province centroid, labelled as such
  assert.match(out.get('c').geoNote, /centroid-of-Bangkok/);
});

test('a cluster the listings\' own addresses contradict is declared fabricated', () => {
  // Three different Maps links, three different districts, one shared point.
  const out = placeListings([
    { id: 1, location: 'แขวงบางชัน เขตคลองสามวา กรุงเทพมหานคร 10510', latitude: 14.0213, longitude: 100.518, mapsUrl: 'https://maps.app.goo.gl/one' },
    { id: 2, location: 'แขวงสามเสนนอก เขตห้วยขวาง กรุงเทพมหานคร 10310', latitude: 14.0213, longitude: 100.518, mapsUrl: 'https://maps.app.goo.gl/two' },
    { id: 3, location: 'ร้านนวดฝั่งธนฯ ย่านพระราม2', city: 'Bangkok', latitude: 14.0214, longitude: 100.516, mapsUrl: 'https://maps.app.goo.gl/three' },
  ], index);
  assert.equal(out.get(1).geoPrecision, 'tambon');
  assert.equal(out.get(1).geoUnit.district.th, 'คลองสามวา');
  assert.equal(out.get(2).geoUnit.tambon.th, 'สามเสนนอก');
  // Nothing in #3's own words is finer than "Bangkok" — the honest answer.
  assert.equal(out.get(3).geoPrecision, 'province');
  assert.ok(out.get(3).geoNote);
});

test('several listings for one real venue at one point are not a fabrication', () => {
  const out = placeListings([1, 2, 3].map((id) => ({
    id, location: 'Sukhumvit 22, Bangkok', city: 'Bangkok', latitude: 13.7317, longitude: 100.565, mapsUrl: 'https://maps.app.goo.gl/same',
  })), index);
  for (const g of out.values()) assert.equal(g.geoPrecision, 'exact');
});

test('a point that contradicts its own address is replaced, and says by how much', () => {
  const [g] = placeListings([{
    id: 1, location: '113 DN Massage 6 ตำบล หนองไม้แดง เมือง ชลบุรี 20000', latitude: 13.8805, longitude: 100.604, mapsUrl: 'https://maps.app.goo.gl/x',
  }], index).values();
  assert.equal(g.geoUnit.tambon.th, 'หนองไม้แดง');
  assert.match(g.geoNote, /~\d+ km from the tambon/);
});

test('the placement verdict survives export and re-import unchanged', async () => {
  const { canonicalizePublicListings } = await import('../src/lib/listing_contract.js');
  const exported = canonicalizePublicListings([{
    id: 7, name: 'Test Spa', phone: '0812345678',
    location: '98 ตำบล ศีรษะจรเข้ใหญ่ อำเภอบางเสาธง สมุทรปราการ 10570',
    maps_url: 'https://maps.app.goo.gl/abc', latitude: 13.9522, longitude: 100.565,
  }], { source: 'snapshot', allowUnverified: true, geoIndex: index });
  assert.equal(exported[0].geoPrecision, 'tambon');
  assert.equal(exported[0].geoUnit.district.th, 'บางเสาธง');

  // Round-trip through JSON (data.json / Firestore) and the browser normaliser,
  // which runs without an index: nothing may be lost or re-guessed.
  const reread = canonicalizePublicListings(JSON.parse(JSON.stringify(exported)), { source: 'snapshot', allowUnverified: true });
  for (const field of ['geoPrecision', 'geoRadiusKm', 'geoSource', 'geoUnit', 'geoNote', 'latitude', 'longitude']) {
    assert.deepEqual(reread[0][field], exported[0][field], field);
  }
});
