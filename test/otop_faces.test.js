import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  photoForRecord,
  photosForProvince,
  attributionLine,
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
