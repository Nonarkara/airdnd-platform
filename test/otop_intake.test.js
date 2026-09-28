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

test('photoForRecord prioritizes exact photo; illustrative Commons come from test fixtures', async () => {
  const { __setTestMedia } = await import('../otop/core/photos.js');
  __setTestMedia({
    provinces: {
      46: {
        photos: [{
          url: 'https://upload.wikimedia.org/wikipedia/commons/test-silk.jpg',
          title: 'File:test-silk.jpg',
          description: 'Thai silk',
          author: 'Commons Author',
          license: 'CC BY-SA 4.0',
          source: 'Wikimedia Commons',
          isExactProducer: false,
          representation: 'illustrative',
        }],
      },
    },
    categories: {
      food: {
        photos: [{
          url: 'https://upload.wikimedia.org/wikipedia/commons/test-food.jpg',
          title: 'File:test-food.jpg',
          description: 'Thai food',
          author: 'Food Author',
          license: 'CC BY 4.0',
          source: 'Wikimedia Commons',
          isExactProducer: false,
        }],
      },
    },
  });

  const exact = photoForRecord({
    producerName: 'กลุ่มแม่บ้าน',
    provinceCode: 46,
    category: 'textile',
    imageUrl: 'https://images.example.com/real_craft.jpg',
  });
  assert.equal(exact.isExactProducer, true);
  assert.equal(exact.url, 'https://images.example.com/real_craft.jpg');

  const provMatch = photoForRecord({
    producerName: 'วิสาหกิจชุมชน',
    provinceCode: 46,
    category: 'textile',
  });
  assert.equal(provMatch.isExactProducer, false);
  assert.equal(provMatch.representation, 'illustrative');
  assert.ok(provMatch.url.includes('wikimedia.org'));
  assert.equal(provMatch.author, 'Commons Author');

  const catMatch = photoForRecord({
    producerName: 'กลุ่มเกษตรกร',
    provinceCode: 999,
    category: 'food',
  });
  assert.equal(catMatch.isExactProducer, false);
  assert.ok(catMatch.license);

  // Hard-coded Unsplash maps intentionally empty.
  assert.equal(Object.keys(CATEGORY_PHOTOS).length, 0);
  assert.equal(Object.keys(PROVINCIAL_CRAFT_PHOTOS).length, 0);
  __setTestMedia({});
});

test('photosForProvince is empty without a warmed manifest (placeholder path)', () => {
  assert.equal(photosForProvince(50).length, 0);
  assert.equal(photosForProvince(999).length, 0);
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
