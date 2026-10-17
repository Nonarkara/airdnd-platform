import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMessageType } from '../src/lib/message_classifier.js';

const cases = [
  // explicit tiers keep winning
  ['ขายคลิป 18+', 'spam'],
  ['ประกาศจากแอดมิน', 'admin'],
  ['รีวิว: สะอาดมาก', 'feedback'],
  ['ที่ไหนดีแถวรัชดา?', 'discussion'],
  // shop keywords, as before
  ['นวดแผนไทย 2 ชม 500', 'listing'],
  ['Sabai Spa Thonglor', 'listing'],
  ['LINE: @sabai99', 'listing'],
  // photo-caption broadcasts that used to be filed as unknown
  ['📞 081-234-5678', 'listing'],
  ['0812345678', 'listing'],
  ['+66 81 234 5678', 'listing'],
  ['คิวว่างค่ะ 1500', 'listing'],
  ['ว่าง 2 คน 1,500/ชม โทร 0891234567', 'listing'],
  // honest unknowns: nothing that can be verified or contacted
  ['ว่างค่ะ 3 คน 🌸', 'unknown'],
  ['น้องแพร สุขุมวิท 22', 'unknown'],
  ['🔥🔥🔥', 'unknown'],
  ['', 'unknown'],
  [null, 'unknown'],
];

for (const [text, want] of cases) {
  test(`classifies ${JSON.stringify(text)} as ${want}`, () => {
    assert.equal(classifyMessageType(text), want);
  });
}

test('a bare four-digit number without an availability word is not a listing', () => {
  // house numbers and years must not be promoted on their own
  assert.equal(classifyMessageType('บ้านเลขที่ 2026'), 'unknown');
});
