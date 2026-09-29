import assert from 'node:assert/strict';
import test from 'node:test';

import {
  categorizeListing, classifyHours, matchesCategory, summarizeByDistrict, supportFor,
} from '../src/lib/taxonomy.js';

const unit = (districtTh, districtEn, code = '1047') => ({
  province: { code: '10', th: 'กรุงเทพมหานคร', en: 'Bangkok' },
  district: { code, th: districtTh, en: districtEn },
  tambon: null,
});

test('a bathhouse is a bathhouse, whatever else the ad says', () => {
  const c = categorizeListing({ name: 'The Bank Massage Club', description: 'The Bank by Noar อาบอบนวด สุดหรู ครบวงจร ย่านพระราม 9', geoPrecision: 'exact' });
  assert.equal(c.format, 'bathhouse');
});

test('home and hotel service is outcall — out of reach of venue visits', () => {
  const c = categorizeListing({ name: 'คุณได้รับคำเชิญให้เข้าร่วม "นวดตามบ้าน"', location: 'Bangkok, Thailand', geoPrecision: 'province' });
  assert.equal(c.format, 'outcall');
  assert.ok(c.outreach.includes('hard-to-reach'));
  assert.ok(c.outreach.includes('no-fixed-place'));
});

test('a private room is its own format', () => {
  assert.equal(categorizeListing({ name: 'ห้องนวดส่วนตัว ทักจองคิว' }).format, 'private-room');
});

test('a spa with a placed address is a shop, and may also do outcall', () => {
  const c = categorizeListing({ name: 'สปาเปิดใหม่ มนตา สปา บางนา', description: 'รับงานนอกสถานที่ด้วย', geoPrecision: 'district' });
  assert.equal(c.format, 'shopfront');
  assert.equal(c.alsoOutcall, true);
  assert.ok(matchesCategory(c, 'format:outcall'), 'outcall filter includes shops that also go out');
});

test('shop words without any place do not make a shop', () => {
  assert.equal(categorizeListing({ name: 'สปา', geoPrecision: 'province' }).format, 'unstated');
});

test('nothing stated means "not stated", never a guess', () => {
  const c = categorizeListing({ name: 'นวดใกล้ฉัน' });
  assert.equal(c.format, 'unstated');
  assert.equal(c.hours, 'unstated');
});

test('hours: 24h in Thai, English and Chinese; past midnight is late-night', () => {
  assert.equal(classifyHours({ hours: 'เปิด 24 ชม.' }), '24h');
  assert.equal(classifyHours({ hours: '24 hours' }), '24h');
  assert.equal(classifyHours({ description: '我们竭诚为所有顾客提供24小时服务' }), '24h');
  assert.equal(classifyHours({ hours: '11.00-24.00' }), 'late-night');
  assert.equal(classifyHours({ hours: '18:00-02:00' }), 'late-night');
  assert.equal(classifyHours({ hours: '10:00-22:00' }), 'daytime');
});

test('an ad written in another language is flagged for materials in that language', () => {
  const c = categorizeListing({ name: '我们竭诚为所有顾客提供24小时服务🙏 ☎️0933074220' });
  assert.deepEqual(c.languages, ['zh']);
  assert.ok(c.outreach.includes('other-language'));
  assert.ok(c.outreach.includes('late-night'));
});

test('workforce origin needs an explicit collocation, not a country name in an address', () => {
  assert.deepEqual(categorizeListing({ description: 'มีน้องลาว น้องพม่า ทุกวัน' }).origins.sort(), ['lao', 'myanmar']);
  assert.deepEqual(categorizeListing({ location: 'ถนนเจริญกรุง ใกล้สถานทูตลาว' }).origins, []);
});

test('new-staff notices are a labour-protection signal', () => {
  assert.ok(categorizeListing({ description: 'น้องใหม่มาเพิ่มวันนี้' }).outreach.includes('new-staff'));
});

test('service line comes from the existing grey score, not a second scale', () => {
  const c = categorizeListing({ name: 'นวดแผนไทย นวดเท้า', description: 'นวดแผนไทย นวดเท้า นวดประคบสมุนไพร' });
  assert.ok(['therapeutic', 'mixed', 'adult'].includes(c.serviceLine));
  assert.equal(typeof c.greyScore, 'number');
});

test('support is looked up by the listing\'s own province', () => {
  const payload = { meta: { yearBuddhist: 2568 }, provinces: [{ code: '10', name: 'Bangkok', nameTh: 'กรุงเทพมหานคร', services: { lab: { facilities: 40 }, sti: { facilities: 12 }, condom: { facilities: 90 }, vct: { facilities: 7 } }, civilSociety: { orgs: ['มูลนิธิเพื่อนพนักงานบริการ (SWING)'] } }] };
  const s = supportFor({ geoUnit: unit('บางนา', 'Bang Na') }, payload);
  assert.equal(s.testingSites, 40);
  assert.equal(s.condomPoints, 90);
  assert.deepEqual(s.organisations, ['มูลนิธิเพื่อนพนักงานบริการ (SWING)']);
  assert.equal(supportFor({ geoUnit: null }, payload), null);
  // A service with no reported row is "not reported", never zero.
  const partial = { provinces: [{ code: '10', name: 'Bangkok', nameTh: 'กรุงเทพมหานคร', services: { lab: { facilities: 4 }, sti: null }, civilSociety: { orgs: [] } }] };
  const p = supportFor({ geoUnit: unit('บางนา', 'Bang Na') }, partial);
  assert.equal(p.testingSites, 4);
  assert.equal(p.stiClinics, null);
  assert.equal(p.condomPoints, null);
});

test('the outreach table aggregates to districts, then to "district not stated"', () => {
  const rows = summarizeByDistrict([
    { name: 'ห้องนวดส่วนตัว', geoUnit: unit('บางนา', 'Bang Na'), geoPrecision: 'district' },
    { name: 'สปา นวดไทย', geoUnit: unit('บางนา', 'Bang Na'), geoPrecision: 'exact', mapsUrl: 'x' },
    { name: 'นวดตามบ้าน', geoUnit: { province: { code: '10', th: 'กรุงเทพมหานคร', en: 'Bangkok' } }, geoPrecision: 'province' },
  ]);
  assert.equal(rows[0].en, 'Bang Na');
  assert.equal(rows[0].listings, 2);
  assert.equal(rows[0].outreach['hard-to-reach'], 1);
  assert.equal(rows[1].en, 'Bangkok · district not stated');
  assert.equal(rows[1].outreach['no-fixed-place'], 1);
});
