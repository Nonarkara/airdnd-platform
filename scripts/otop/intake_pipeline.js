#!/usr/bin/env node
/**
 * OTOP Live Intake & Intelligence Pipeline
 *
 * Modeled on the proven D&D (Sabai Sabai) architecture:
 * Telegram / Web / Social Community Chatter
 *     ↓
 * Deterministic Thai text parser (phone, LINE, Facebook, area, price, stars)
 *     ↓
 * Gemini AI enrichment (craft story, raw materials, technique, export readiness)
 *     ↓
 * Photo downloader & archive
 *     ↓
 * Phone-first entity resolution against the 154,078 government registry records:
 *   - Stale government records are corroborated, verified, and enriched with live media
 *   - New community producers are ingested with full provenance
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePhone, normalizeText, parsePrice } from '../../otop/core/record.js';
import { resolveProvince, resolveDistrictToProvince } from '../../otop/core/provinces.js';
import { classifyCategory, parseStars } from '../../otop/core/taxonomy.js';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SHARDS_DIR = path.join(ROOT, 'otop/public/p');

/**
 * Deterministic parser for Thai community postings and marketplace chatter.
 */
export function parseOtopPost(text, metadata = {}) {
  const raw = String(text ?? '');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Phone extraction
  const phoneMatch = raw.match(/(?:โทร|tel|phone|ติดต่อ|เบอร์|โทรศัพท์|call)?[:.\s-]*((?:\+?66|0)[0-9]{1,2}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4})/i);
  const phone = phoneMatch ? normalizePhone(phoneMatch[1]) : null;

  // 2. LINE ID extraction
  const lineMatch = raw.match(/(?:line(?:\s*id)?|ไลน์)[:.\s-]*([a-zA-Z0-9_.-@]+)/i) ||
                    raw.match(/(?:https?:\/\/)?line\.me\/ti\/p\/([a-zA-Z0-9_.-]+)/i);
  let lineId = lineMatch ? lineMatch[1].trim() : null;
  if (lineId && /^(?:id|me|ti|http|https)$/i.test(lineId)) lineId = null;

  // 3. Facebook / Social link extraction
  const fbMatch = raw.match(/(?:https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/|(?:เพจ\s*(?:facebook|fb)?|facebook|fb)\s*[:.\s-]+)([a-zA-Z0-9_.-]+)/i);
  const facebook = fbMatch ? fbMatch[1].trim() : null;

  // 4. Stars (OPC)
  let stars = null;
  const starTextMatch = raw.match(/([1-5])\s*ดาว/);
  if (starTextMatch) stars = Number(starTextMatch[1]);
  else if (/★★★★★/.test(raw)) stars = 5;
  else if (/★★★★/.test(raw)) stars = 4;
  else if (/★★★/.test(raw)) stars = 3;

  // 5. Province / District resolution
  let province = null;
  for (const line of lines) {
    const p = resolveProvince(line);
    if (p) { province = p; break; }
  }
  if (!province) {
    // Try resolving district names mentioned in text
    const distMatch = raw.match(/(?:อ\.|อำเภอ|เขต)\s*([ก-๙a-zA-Z]+)/);
    if (distMatch) {
      province = resolveDistrictToProvince(distMatch[1]);
    }
  }

  // 6. Price in unstructured text: look for ราคา 3,500 or 3,500 บาท
  let price = null;
  const priceMatch = raw.match(/(?:ราคา|฿|price)?\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:บาท|.-|thb)/i) ||
                     raw.match(/(?:ราคา|price)[:.\s]*([0-9,]+)/i);
  if (priceMatch) {
    const num = Number(priceMatch[1].replace(/,/g, ''));
    if (Number.isFinite(num) && num > 0 && num < 10_000_000) price = num;
  }
  if (price == null) price = parsePrice(raw);

  // 7. Category
  const categoryResult = classifyCategory({ declared: null, text: raw });

  // 8. Image URLs in text
  const imageMatches = [...raw.matchAll(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?/gi)].map((m) => m[0]);
  const imageUrl = imageMatches[0] ?? metadata.imageUrl ?? null;

  // 9. Names: Header or first line as product/producer
  const producerName = metadata.producerName || (lines[0] ? lines[0].slice(0, 100) : 'ผู้ประกอบการชุมชน');
  const productName = metadata.productName || (lines[1] ? lines[1].slice(0, 100) : producerName);

  return {
    producerName,
    productName,
    category: categoryResult.category,
    categoryConfidence: categoryResult.confidence,
    stars,
    province: province?.th ?? null,
    provinceEn: province?.en ?? null,
    provinceCode: province?.code ?? null,
    region: province?.region ?? null,
    phone,
    lineId,
    facebook,
    price,
    imageUrl,
    rawText: raw,
    intakeSource: metadata.source || 'community_feed',
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Gemini AI enrichment for product storytelling, craft materials, and B2B readiness.
 */
export async function enrichOtopWithAi(parsed, { apiKey = process.env.GEMINI_API_KEY } = {}) {
  if (!apiKey) {
    // Graceful offline fallback: return parsed data with rule-based craft tags
    return {
      ...parsed,
      aiEnriched: false,
      craftStory: null,
      craftTechnique: parsed.category ? `งานหัตถกรรมประเภท ${parsed.category}` : null,
      exportReadiness: parsed.phone ? 'Basic contact ready' : 'Unverified',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a heritage craft and agricultural product specialist for Thailand's OTOP (One Tambon One Product) program.
Analyze this community producer post and return a JSON object with:
1. "story": A concise 2-sentence summary of the product's cultural or local significance in Thai.
2. "craftTechnique": The traditional technique or processing method used (e.g. ทอมือ, ย้อมคราม, สกัดเย็น, อบแห้งพลังงานแสงอาทิตย์).
3. "rawMaterials": Main local natural ingredients or materials used.
4. "b2bReadiness": Assessment of commercial readiness ("export_ready", "domestic_ready", or "local_only").

Producer/Product: ${parsed.productName} by ${parsed.producerName}
Location: ${parsed.province || ''}
Raw text:
${parsed.rawText}

Respond ONLY with valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const enriched = JSON.parse(response.text);
    return {
      ...parsed,
      aiEnriched: true,
      craftStory: enriched.story ?? null,
      craftTechnique: enriched.craftTechnique ?? null,
      rawMaterials: enriched.rawMaterials ?? null,
      exportReadiness: enriched.b2bReadiness ?? null,
    };
  } catch (err) {
    console.warn(`[otop:intake] Gemini enrichment warning: ${err.message}. Proceeding with deterministic data.`);
    return {
      ...parsed,
      aiEnriched: false,
      craftStory: null,
      craftTechnique: null,
      exportReadiness: null,
    };
  }
}

/**
 * Phone-first reconciliation: Match new intake against the 154,078 registry records.
 *
 * If the phone number matches an existing province record:
 * - Corroborates the record (confirming it is actively trading).
 * - Enriches missing photos, active LINE/FB, or verified prices.
 */
export function reconcileAgainstRegistry(intakeRecord, shardsDir = SHARDS_DIR) {
  if (!intakeRecord.phone || !intakeRecord.provinceCode) {
    return { status: 'new_entry', matchedRecordId: null, enriched: intakeRecord };
  }

  const shardPath = path.join(shardsDir, `${intakeRecord.provinceCode}.json`);
  if (!fs.existsSync(shardPath)) {
    return { status: 'new_entry', matchedRecordId: null, enriched: intakeRecord };
  }

  try {
    const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
    const cleanIntakePhone = normalizePhone(intakeRecord.phone);
    const match = shard.find((r) => r.phone && normalizePhone(r.phone) === cleanIntakePhone);

    if (match) {
      // Reconciled! Enrich the government record
      const enriched = {
        ...match,
        imageUrl: match.imageUrl || intakeRecord.imageUrl,
        website: match.website || (intakeRecord.lineId ? `line.me/ti/p/${intakeRecord.lineId}` : null) || (intakeRecord.facebook ? `facebook.com/${intakeRecord.facebook}` : null),
        price: match.price || intakeRecord.price,
        craftStory: intakeRecord.craftStory || match.description,
        craftTechnique: intakeRecord.craftTechnique,
        lastLiveVerification: intakeRecord.ingestedAt,
        corroboratedByLiveFeed: true,
      };
      return { status: 'corroborated_match', matchedRecordId: match.sourceRowId || match.identityKey, enriched };
    }
  } catch (e) {
    console.warn(`[otop:intake] failed reading shard ${shardPath}: ${e.message}`);
  }

  return { status: 'new_entry', matchedRecordId: null, enriched: intakeRecord };
}
