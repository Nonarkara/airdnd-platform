import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOtopPost, reconcileAgainstRegistry, enrichOtopWithAi } from '../scripts/otop/intake_pipeline.js';
import { photoForRecord, photosForProvince, CATEGORY_PHOTOS, PROVINCIAL_CRAFT_PHOTOS } from '../otop/core/photos.js';

test('parseOtopPost extracts phone, line, stars, and province from raw Thai community text', () => {
  const samplePost = `
กลุ่มทอผ้าไหมแพรวาบ้านโพน กาฬสินธุ์
จำหน่ายผ้าสไบแพรวาลายโบราณ ทอมือแท้ 100%
ระดับ 5 ดาว OTOP ระดับประเทศ
ราคาผืนละ 3,500 บาท
ติดต่อ โทร: 081-234-5678 หรือ Line ID: @phraewasilk
เพจ Facebook: phraewagalasinofficial
รูปสินค้า: https://example.com/photos/silk_phraewa.jpg
`;

  const parsed = parseOtopPost(samplePost);
  assert.equal(parsed.phone, '0812345678');
  assert.equal(parsed.lineId, '@phraewasilk');
  assert.equal(parsed.facebook, 'phraewagalasinofficial');
  assert.equal(parsed.stars, 5);
  assert.equal(parsed.province, 'กาฬสินธุ์');
  assert.equal(parsed.provinceCode, 46);
  assert.equal(parsed.price, 3500);
  assert.equal(parsed.imageUrl, 'https://example.com/photos/silk_phraewa.jpg');
});

test('parseOtopPost resolves province from district shorthand (e.g. อ.ลับแล)', () => {
  const sample = `
ผ้าทอตีนจกโบราณ อ.ลับแล
โทร 053-123456
`;
  const parsed = parseOtopPost(sample);
  assert.equal(parsed.province, 'อุตรดิตถ์');
  assert.equal(parsed.provinceCode, 53);
});

test('photoForRecord prioritizes exact photo, then provincial specialty, then category archetype', () => {
  // 1. Exact photo on record
  const recordWithImage = {
    producerName: 'กลุ่มแม่บ้าน',
    provinceCode: 46,
    category: 'textile',
    imageUrl: 'https://images.example.com/real_craft.jpg',
  };
  const exact = photoForRecord(recordWithImage);
  assert.equal(exact.isExactProducer, true);
  assert.equal(exact.url, 'https://images.example.com/real_craft.jpg');

  // 2. Provincial craft specialty (e.g. Kalasin Phrae Wa silk)
  const kalasinRecord = {
    producerName: 'วิสาหกิจชุมชน',
    provinceCode: 46,
    category: 'textile',
  };
  const provMatch = photoForRecord(kalasinRecord);
  assert.equal(provMatch.isExactProducer, false);
  assert.ok(provMatch.url.includes('unsplash.com'));
  assert.equal(provMatch.author, 'Isan Silk Heritage');
  assert.ok(provMatch.craft.includes('แพรวา'));

  // 3. Category archetype
  const genericFood = {
    producerName: 'กลุ่มเกษตรกร',
    provinceCode: 999, // unknown province
    category: 'food',
  };
  const catMatch = photoForRecord(genericFood);
  assert.equal(catMatch.isExactProducer, false);
  assert.equal(catMatch.titleEn, CATEGORY_PHOTOS.food.title);
  assert.ok(catMatch.license);
});

test('photosForProvince returns curated craft photos for supported heritage provinces', () => {
  const chiangMai = photosForProvince(50);
  assert.equal(chiangMai.length, 1);
  assert.ok(chiangMai[0].title.includes('Celadon'));

  const unknown = photosForProvince(999);
  assert.equal(unknown.length, 0);
});

test('enrichOtopWithAi degrades cleanly without Gemini API key', async () => {
  const parsed = {
    productName: 'กล้วยตากพลังงานแสงอาทิตย์',
    producerName: 'กลุ่มแม่บ้านบางกระทุ่ม',
    category: 'food',
    phone: '0812345678',
    rawText: 'กล้วยตากออร์แกนิก 100 บาท',
  };
  const enriched = await enrichOtopWithAi(parsed, { apiKey: null });
  assert.equal(enriched.aiEnriched, false);
  assert.ok(enriched.craftTechnique.includes('food'));
});
