// Message-type classifier for the raw Telegram archive.
//
// Every message the scraper sees is archived with one of these labels, and the
// LIVE feed shows only `listing`. The tiers run in order: anything explicit
// (spam, admin, feedback, discussion) wins first, then shop keywords, then the
// contact / availability signals below.
//
// The last tier exists because the busiest channels post photo albums whose
// only caption is a phone number, a LINE id, or "คิวว่าง 1500". Those are
// broadcasts in every sense that matters, and until 2026-09 they were filed as
// `unknown` and dropped from the feed. Pure function: no I/O, unit-tested.

const SPAM_RE = /(?:คลิป|clip|vdo|video|โป้|โป๊|18\+|xxx|porn|nude|onlyfans|เสียว|หลุด|กลุ่มลับ|vip\s*group)/i;
const ADMIN_RE = /(?:ประกาศ|announcement|admin|rule|กฎ|กติกา|ข้อตกลง)/i;
const FEEDBACK_RE = /(?:รีวิว|review|ประสบการณ์|experience|ไปมา|เคยไป|recommend|แนะนำ|ดีมาก|แย่|สะอาด|clean|คุ้ม|worth|ประทับใจ|ไม่ประทับ)/i;
const DISCUSSION_RE = /(?:ใครเคย|สอบถาม|เป็นยังไง|ที่ไหน|ราคาเท่าไหร่|มีใครรู้|แนะนำหน่อย|\?$)/i;
const SHOP_RE = /(?:ร้าน|shop|spa|สปา|นวด|massage|clinic|คลินิก|health|สุขภาพ|therap|ราคา|price|baht|บาท|฿|โทร|tel|phone|line\s*(?:id)?|จอง|booking)/i;

// A Thai mobile or landline, with or without the country code, allowing the
// usual dash/space/dot separators: 081-234-5678, 0812345678, +66 81 234 5678.
const PHONE_RE = /(?:\+?66|0)\s*\d(?:[\s.-]?\d){7,8}/;
// LINE ids and @handles are how a seller says "reach me" without a shop word.
const CONTACT_RE = /line\s*(?:id)?\s*[:@]|(?:^|\s)@[a-z0-9_]{4,}|\bwa\b|whatsapp/i;
const AVAILABILITY_RE = /ว่าง|คิว|พร้อม|walk[ -]?in|available|จอง|booking/i;
// A price: currency marker, "1,500", "1500", "500บ", or a range like 1500/2000.
const PRICE_RE = /฿|บาท|baht|\b\d{1,2}[,.]?\d{3}\b|\b\d{3,4}\s*(?:บ|b)\b|\b\d{3,4}\s*[/-]\s*\d{3,4}\b/i;

export function classifyMessageType(text) {
  if (!text || text.length < 5) return 'unknown';
  if (SPAM_RE.test(text)) return 'spam';
  if (ADMIN_RE.test(text)) return 'admin';
  if (FEEDBACK_RE.test(text)) return 'feedback';
  if (DISCUSSION_RE.test(text)) return 'discussion';
  if (SHOP_RE.test(text)) return 'listing';
  // A broadcast with a way to reach the seller is a listing even without a
  // shop word; so is an availability call that names a price.
  if (PHONE_RE.test(text) || CONTACT_RE.test(text)) return 'listing';
  if (AVAILABILITY_RE.test(text) && PRICE_RE.test(text)) return 'listing';
  return 'unknown';
}
