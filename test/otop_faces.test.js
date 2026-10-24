import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  photoForRecord,
  photosForProvince,
  attributionLine,
  photoCaption,
  cleanFileTitle,
  __setTestMedia,
  CATEGORY_PHOTOS,
  PROVINCIAL_CRAFT_PHOTOS,
} from '../otop/core/photos.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FACES = path.join(ROOT, 'otop/public/otop_province_faces.json');

test('otop_province_faces.json covers 77 provinces with registry-grounded fields', () => {
  assert.ok(fs.existsSync(FACES), 'run node scripts/otop/province-faces.js first');
  const faces = JSON.parse(fs.readFileSync(FACES, 'utf8'));
  assert.equal(faces.counts.provinces, 77);
  assert.ok(Array.isArray(faces.provinces));
  assert.equal(faces.provinces.length, 77);
  const kalasin = faces.provinces.find((p) => p.code === 46);
  assert.ok(kalasin);
  assert.ok(kalasin.dominantCategory, 'Kalasin should have a dominant category from the registry');
  assert.ok(kalasin.topProducts.length > 0, 'Kalasin has repeated product names in the shard');
  // No invented heritage essays — only counts and names.
  assert.equal(typeof kalasin.topProducts[0].name, 'string');
  assert.equal(typeof kalasin.topProducts[0].count, 'number');
  assert.ok(Array.isArray(kalasin.mediaQuerySeeds));
});

test('photoForRecord prefers exact imageUrl and never invents Unsplash heritage', () => {
  __setTestMedia({
    provinces: {
      46: {
        dominantCategory: { id: 'textile', en: 'Fabric & Apparel' },
        photos: [{
          url: 'https://upload.wikimedia.org/wikipedia/commons/example-silk.jpg',
          title: 'File:Example silk.jpg',
          description: 'Thai silk weaving',
          author: 'JJ Harrison',
          license: 'CC BY-SA 3.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
          source: 'Wikimedia Commons',
          filePage: 'https://commons.wikimedia.org/wiki/File:Example_silk.jpg',
          isExactProducer: false,
          representation: 'illustrative',
        }],
      },
    },
    categories: {
      food: {
        photos: [{
          url: 'https://upload.wikimedia.org/wikipedia/commons/example-food.jpg',
          title: 'File:Example food.jpg',
          description: 'Thai food stall',
          author: 'Takeaway',
          license: 'CC BY-SA 3.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
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

  const prov = photoForRecord({
    producerName: 'วิสาหกิจชุมชน',
    provinceCode: 46,
    category: 'textile',
  });
  assert.equal(prov.isExactProducer, false);
  assert.equal(prov.representation, 'illustrative');
  assert.ok(prov.url.includes('wikimedia.org'));
  assert.equal(prov.author, 'JJ Harrison');
  assert.match(attributionLine(prov), /Photo: JJ Harrison/);
  assert.match(attributionLine(prov), /License: CC BY-SA 3\.0/);

  const cat = photoForRecord({
    producerName: 'กลุ่มเกษตรกร',
    provinceCode: 999,
    category: 'food',
  });
  assert.equal(cat.isExactProducer, false);
  assert.ok(cat.url.includes('example-food'));

  const missing = photoForRecord({
    producerName: 'ไม่มีภาพ',
    provinceCode: 999,
    category: 'herbal',
  });
  assert.equal(missing, null);

  // Legacy hard-coded maps must stay empty — Unsplash heritage theatre removed.
  assert.equal(Object.keys(CATEGORY_PHOTOS).length, 0);
  assert.equal(Object.keys(PROVINCIAL_CRAFT_PHOTOS).length, 0);

  __setTestMedia({}); // reset
});

test('photosForProvince returns empty for unknown codes (placeholder path)', () => {
  __setTestMedia({ provinces: {} });
  assert.deepEqual(photosForProvince(999), []);
  __setTestMedia({});
});

test('a caption is a caption, never the Commons file page article', () => {
  // A Commons "description" is the file page's article body. For the Chiang
  // Saen lion statue it is 4,819 characters of Thai Wikipedia text, and the
  // province dossier was setting it as a HEADING — a 2,976px wall of text in
  // a 240px photo panel. A caption is a line or two that names the picture.
  const article = 'ประวัติความเป็นมาของเมืองเชียงแสน '.repeat(140);
  assert.ok(article.length > 4000, 'the article is long enough to be the defect');

  const long = photoCaption({
    title: 'File:พระเชียงแสน สิงห์๑ องค์จ้อย.jpg',
    description: article,
  });
  assert.equal(long, 'พระเชียงแสน สิงห์๑ องค์จ้อย');
  assert.ok(long.length <= 200, 'the caption is never a page');

  // A description that reads like a caption IS the caption.
  const short = photoCaption({
    title: 'File:Thai Silk Weaving 1 - Ban Tha Sawang.jpg',
    description: 'A person weaving silk at a loom, Ban Tha Sawang, Surin Province, Thailand',
  });
  assert.equal(short, 'A person weaving silk at a loom, Ban Tha Sawang, Surin Province, Thailand');

  // The file name is cleaned, not pasted: no "File:", no ".jpg", no uploader.
  assert.equal(cleanFileTitle('File:ร้าน OTOP สิห์บุรี - panoramio.jpg'), 'ร้าน OTOP สิห์บุรี');

  // Nothing long enough to be an article is ever returned.
  for (const d of [article, article.slice(0, 400), 'x'.repeat(201)]) {
    const c = photoCaption({ title: 'File:Named.jpg', description: d });
    assert.ok(c.length <= 200, `caption of ${c.length} characters is too long`);
  }
});

test('the province dossier is given a caption, not an article', () => {
  __setTestMedia({
    provinces: {
      50: {
        dominantCategory: { id: 'decor', en: 'Decor & Craft' },
        photos: [{
          url: 'https://upload.wikimedia.org/wikipedia/commons/example-lion.jpg',
          title: 'File:พระเชียงแสน สิงห์๑ องค์จ้อย.jpg',
          description: 'ประวัติความเป็นมาของเมืองเชียงแสน '.repeat(140),
          author: 'Suriya aruno',
          license: 'CC BY-SA 4.0',
          source: 'Wikimedia Commons',
        }],
      },
    },
  });
  const photo = photoForRecord({ producerName: 'กลุ่มแม่บ้าน', provinceCode: 50, category: 'decor' });
  assert.ok(photo);
  assert.equal(photo.caption, 'พระเชียงแสน สิงห์๑ องค์จ้อย');
  assert.ok(photo.caption.length <= 200);
  __setTestMedia({});
});
