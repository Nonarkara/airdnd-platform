import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeStandardCategory,
  normalizeTitle,
  matchStandardForProduct,
} from '../otop/core/standards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('standards: category normalization maps 5 canonical categories', () => {
  assert.equal(normalizeStandardCategory('อาหาร'), 'food');
  assert.equal(normalizeStandardCategory('เครื่องดื่ม'), 'beverage');
  assert.equal(normalizeStandardCategory('ของใช้-ของตกแต่ง-ของที่ระลึก'), 'decor');
  assert.equal(normalizeStandardCategory('ของใช้ ของตกแต่ง ของที่ระลึก'), 'decor');
  assert.equal(normalizeStandardCategory('ผ้า เครื่องแต่งกาย'), 'textile');
  assert.equal(normalizeStandardCategory('สมุนไพรที่ไม่ใช่อาหาร'), 'herbal');
  assert.equal(normalizeStandardCategory('unknown'), null);
});

test('standards: normalizeTitle strips punctuation and spaces', () => {
  assert.equal(normalizeTitle('น้ำตาลมะพร้าว (แท้)'), 'น้ำตาลมะพร้าวแท้');
  assert.equal(normalizeTitle('กระเป๋าผ้า-ทอมือ'), 'กระเป๋าผ้าทอมือ');
});

test('standards: matchStandardForProduct finds matching standard by product title', () => {
  const sampleStandards = [
    { code: '5/2561', titleTh: 'น้ำตาลมะพร้าว', titleEn: 'COCONUT SUGAR', category: 'food', pdfUrl: 'http://tcps.tisi.go.th/pub/tcps0005_61.pdf' },
    { code: '417/2558', titleTh: 'กระเป๋าผ้า', titleEn: 'FABRIC BAG', category: 'textile', pdfUrl: 'http://tcps.tisi.go.th/pub/tcps0417_58.pdf' },
    { code: '285/2547', titleTh: 'กระเทียมดอง', titleEn: 'PICKLED GARLIC', category: 'food', pdfUrl: 'http://tcps.tisi.go.th/pub/tcps285_47.pdf' },
  ];

  const m1 = matchStandardForProduct('น้ำตาลมะพร้าวแท้แม่กลอง', sampleStandards, 'food');
  assert.ok(m1);
  assert.equal(m1.code, '5/2561');
  assert.equal(m1.titleTh, 'น้ำตาลมะพร้าว');

  const m2 = matchStandardForProduct('กระเป๋าผ้าฝ้ายทอมือ', sampleStandards);
  assert.ok(m2);
  assert.equal(m2.code, '417/2558');

  const m3 = matchStandardForProduct('ผลิตภัณฑ์ไม้แกะสลัก', sampleStandards);
  assert.equal(m3, null);
});

test('standards: compiled otop_standards.json exists and contains 1489 entries', () => {
  const pubFile = path.join(ROOT, 'otop/public/otop_standards.json');
  assert.ok(fs.existsSync(pubFile), 'otop_standards.json must exist');
  const payload = JSON.parse(fs.readFileSync(pubFile, 'utf8'));
  assert.equal(payload.total, 1489);
  assert.equal(payload.byCategory.food, 553);
  assert.equal(payload.byCategory.decor, 461);
  assert.equal(payload.byCategory.beverage, 262);
  assert.equal(payload.byCategory.textile, 110);
  assert.equal(payload.byCategory.herbal, 103);
});
