import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  buildFingerprint,
  insertListingsIfPossible,
  mergeSnapshotListings,
  normalizeExtractedListings,
  parseModelJson,
  readSnapshotListings,
  writeSnapshotListings,
} from './listing_pipeline.js';
import { exportToGoogle } from './google_export.js';
import { ensureLocalPhotosDir, uploadPhotoBuffer } from './photo_storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiId = Number.parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const DEFAULT_SOURCE_TARGETS = [
  '@relaxsociety2020',
  'dialog:2025289026',
  '@keawjaojormmassage',
  'dialog:2381945815',
  'dialog:2491020966',
  '@relaxsocietymassage',
  'dialog:2647876733',
  '@naarsom',
  '@chanelmassage',
  '@dreamgirlspav2',
  'dialog:3769808713',
  '@newmassagerama5',
];
const configuredTargetTokens = (
  process.env.TELEGRAM_SOURCE_TARGETS ||
  process.env.TELEGRAM_SOURCE_CHANNELS ||
  process.env.TELEGRAM_SOURCE_CHANNEL ||
  DEFAULT_SOURCE_TARGETS.join(',')
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const fetchLimit = Number.parseInt(process.env.TELEGRAM_FETCH_LIMIT || '200', 10);
const pollIntervalMs = Number.parseInt(process.env.TELEGRAM_POLL_INTERVAL_MS || '30000', 10);
const snapshotLimit = Number.parseInt(process.env.SNAPSHOT_LISTING_LIMIT || '400', 10);
const parseTimeoutMs = Number.parseInt(process.env.GEMINI_PARSE_TIMEOUT_MS || '8000', 10);
const aiEnrichmentPerCycle = Number.parseInt(process.env.AI_ENRICHMENT_PER_CYCLE || '5', 10);
const watchMode = process.argv.includes('--watch');

process.on('unhandledRejection', (error) => {
  if (String(error?.message || error).includes('TIMEOUT')) {
    return;
  }

  console.error(error);
});

if (!apiId || !apiHash) {
  console.error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env');
  process.exit(1);
}

if (!process.env.TELEGRAM_SESSION) {
  console.error('Missing TELEGRAM_SESSION in .env. Run userbot.js first.');
  process.exit(1);
}

const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

function buildEnrichmentPrompt(rawText) {
  return `
Enrich the following already-detected Thailand wellness, massage, or spa listings.
Each message group is labelled with a [CLUSTER <id>] tag. Return only data that is clearly present in that cluster.
Return only a JSON array with this shape:
[
  {
    "cluster_id": 0,
    "name": "Business or provider name or null",
    "location": "District or area, City/Province or null",
    "price": null,
    "metrics": {},
    "tags": ["Bangkok", "Massage"],
    "description": "Short factual summary of the service, area, hours, or availability or null",
    "phone": "0XX-XXX-XXXX or null",
    "hours": "10:00-23:00 or null",
    "lineUrl": "https://line.me/... or null",
    "telegramUrl": "https://t.me/... or null",
    "mapsUrl": "https://maps.app.goo.gl/... or null"
  }
]

Rules:
- Return at most one object per cluster.
- cluster_id must match the [CLUSTER <id>] from which the listing was enriched.
- Extract phone numbers, operating hours, LINE links, Telegram links, Google Maps links, location, price, and a short factual description when present.
- Use null for unknown name, location, price, phone, hours, or link values.
- Use an empty object for missing metrics.
- Add 1-3 short tags based on city/province, district, and service type.
- Do not invent ratings, reviews, or fields not clearly visible in the text.
- Keep descriptions factual and concise.
- Return only valid JSON.

Messages:
${rawText}
`;
}

function sanitizeTargetToken(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('dialog:')) {
    const dialogId = trimmed.slice('dialog:'.length).trim();
    return dialogId ? `dialog:${dialogId}` : null;
  }

  const username = trimmed.replace(/^@/, '');
  return username ? `@${username}` : null;
}

function isChannelEntity(entity) {
  return Boolean(entity?.broadcast || entity?.megagroup);
}

function getEntityId(entity) {
  return String(entity?.id || entity?.channelId || entity?.chatId || '');
}

function getEntityTitle(entity) {
  return entity?.title || [entity?.firstName, entity?.lastName].filter(Boolean).join(' ') || '';
}

function getSourceLabel(target, entity) {
  if (target.type === 'username' && target.lookupValue) {
    return `@${target.lookupValue}`;
  }

  const username = entity?.username ? `@${entity.username}` : '';
  return username || getEntityTitle(entity) || target.token;
}

async function resolveSourceTargets(client) {
  const dialogs = await client.getDialogs({ limit: 500 });
  const channelDialogs = dialogs
    .map((dialog) => ({
      dialog,
      entity: dialog.entity,
      id: getEntityId(dialog.entity),
      username: dialog.entity?.username ? `@${dialog.entity.username}` : '',
    }))
    .filter((row) => isChannelEntity(row.entity));
  const dialogsById = new Map(
    channelDialogs
      .filter((row) => row.id)
      .map((row) => [row.id, row]),
  );
  const dialogsByUsername = new Map(
    channelDialogs
      .filter((row) => row.username)
      .map((row) => [row.username.toLowerCase(), row]),
  );
  const resolvedTargets = [];

  for (const rawToken of configuredTargetTokens) {
    const token = sanitizeTargetToken(rawToken);
    if (!token) {
      continue;
    }

    if (token.startsWith('dialog:')) {
      const dialogId = token.slice('dialog:'.length);
      const dialogRow = dialogsById.get(dialogId);
      if (!dialogRow) {
        console.warn(`Skipping ${token}: dialog not found in the current Telegram session.`);
        continue;
      }

      resolvedTargets.push({
        token,
        type: 'dialog',
        lookupValue: dialogId,
        fetchRef: dialogRow.entity,
        displayLabel: getSourceLabel({ token, type: 'dialog' }, dialogRow.entity),
      });
      continue;
    }

    const usernameKey = token.toLowerCase();
    const dialogRow = dialogsByUsername.get(usernameKey);
    if (dialogRow) {
      resolvedTargets.push({
        token,
        type: 'username',
        lookupValue: token.replace(/^@/, ''),
        fetchRef: dialogRow.entity,
        displayLabel: getSourceLabel({ token, type: 'username', lookupValue: token.replace(/^@/, '') }, dialogRow.entity),
      });
      continue;
    }

    try {
      const entity = await client.getEntity(token);
      if (!isChannelEntity(entity)) {
        console.warn(`Skipping ${token}: resolved entity is not a channel or group.`);
        continue;
      }

      resolvedTargets.push({
        token,
        type: 'username',
        lookupValue: token.replace(/^@/, ''),
        fetchRef: entity,
        displayLabel: getSourceLabel({ token, type: 'username', lookupValue: token.replace(/^@/, '') }, entity),
      });
    } catch (error) {
      console.warn(`Skipping ${token}: ${error.message}`);
    }
  }

  return resolvedTargets;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function attachImages(listings, files) {
  const imagePool = Array.isArray(files) && files.length > 0 ? files : ['109748.jpg'];

  return listings.map((listing) => {
    if (listing.imageUrl && !listing.imageUrl.startsWith('/mockups/')) {
      return listing;
    }
    const fingerprint = buildFingerprint(listing);
    const imageIndex = hashString(fingerprint) % imagePool.length;
    return {
      ...listing,
      imageUrl: `/mockups/${imagePool[imageIndex]}`,
    };
  });
}

function isTextOnlyCluster(cluster) {
  return cluster.texts.length > 0 && cluster.mediaMessages.length === 0;
}

function isMediaOnlyCluster(cluster) {
  return cluster.mediaMessages.length > 0 && cluster.texts.length === 0;
}

function normalizeClusterId(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function normalizeLine(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLink(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function cleanDisplayText(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/^[^\p{L}\p{N}@#]+/gu, '')
    .replace(/[^\p{L}\p{N})]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSourceLabelName(sourceLabel) {
  const raw = normalizeLine(sourceLabel).replace(/^@/, '');
  if (!raw) {
    return '';
  }

  const spaced = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(massage|spa|club|rama|society|girl|dream|relax)(\d)/gi, '$1 $2')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .replace(/(\d)([a-z])/gi, '$1 $2')
    .replace(/(massage|spa|club|rama|society|girl|dream|relax)/gi, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^[\p{Script=Latin}\d\s]+$/u.test(spaced)) {
    return spaced
      .split(' ')
      .filter(Boolean)
      .map((part) => {
        if (/^\d+$/.test(part)) {
          return part;
        }

        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return spaced;
}

function isReusableSourceLabel(sourceLabel) {
  const normalized = normalizeLine(sourceLabel);
  if (!normalized) {
    return false;
  }

  if (!normalized.startsWith('@')) {
    return true;
  }

  return /massage|spa|สปา|นวด|club|คลับ/i.test(normalized) && !/society/i.test(normalized) && !/\d{3,}/.test(normalized);
}

function isNoiseLine(line) {
  const normalized = cleanDisplayText(line);
  if (!normalized) {
    return true;
  }

  const lowered = normalized.toLowerCase();
  return (
    normalized.length < 2 ||
    /^group joining details$/i.test(normalized) ||
    /https?:\/\/|line\.me|t\.me|maps\.app|google\.com\/maps/i.test(lowered) ||
    /(?:โทร|tel|phone|line(?:\s*id)?|telegram|maps|map|พิกัด|location)\s*[:：]/i.test(normalized) ||
    /\b\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}\b/.test(normalized) ||
    /(?:ราคา|เรท|rate|บาท|฿|thb)\s*[:：]?\s*\d/i.test(normalized) ||
    /(?:ติดตาม|ห้ามพลาด|ทัก|แอดไลน์|ส่งไร|group joining|new group|join now|click|booking|จองเลย|เปิดให้บริการ|มีน้อง|ได้เลย|จะดู|เอาใจ|แซ่บ)/i.test(normalized)
  );
}

function isValidListingName(name) {
  const normalized = cleanDisplayText(name);
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (
    /^(group joining details|นี้|นวด|massage|spa|สปา|เปิด|open)$/i.test(normalized) ||
    /(?:group joining details|new group|line\s*id|เปิดให้บริการ|ติดตามน้องใหม่|ห้ามพลาด|ได้เลยนะ|ส่งไรนักหนา|ทักมา|แอดไลน์|มีน้องคนไหน|จะดู|เอาใจ|แซ่บ)/i.test(lowered) ||
    /(?:ครับ|ค่ะ|คะ|จ้า|นะคะ|นะครับ|ไหม|มั้ย)/i.test(normalized) ||
    /^[a-z\s.]+group[a-z\s.]*$/i.test(normalized) ||
    /[:：]/.test(normalized) ||
    /^(?:เปิด|line|group|new|ได้|มี|จะ|ติดตาม|โทร|พิกัด)\b/i.test(normalized) ||
    /^\d+$/.test(normalized) ||
    normalized.length < 3
  ) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 5 && !/massage|spa|สปา|นวด|คลับ|club/i.test(normalized)) {
    return false;
  }

  return true;
}

function scoreNameLine(line) {
  const normalized = cleanDisplayText(line);
  if (!isValidListingName(normalized)) {
    return -100;
  }

  let score = 0;

  if (normalized.length >= 5 && normalized.length <= 40) {
    score += 8;
  }

  if (/[#@]/.test(line)) {
    score += 3;
  }

  if (/massage|spa|สปา|นวด|คลับ|club|house|massage/i.test(normalized) && normalized.length > 6) {
    score += 6;
  }

  if (/^[\p{L}\p{N}\s.@#&()'-]+$/u.test(normalized)) {
    score += 4;
  }

  if (/^[^\d]{4,}$/u.test(normalized)) {
    score += 2;
  }

  if (isNoiseLine(line)) {
    score -= 30;
  }

  if (/(?:สวย|เด็ด|แซ่บ|เอาใจ|น่ารัก|ฟิน|งานดี|น้องใหม่|ติดตาม|ได้เลย|มีน้อง|จะดู)/i.test(normalized)) {
    score -= 20;
  }

  if (/\b\d{1,2}[:.]\d{2}\b|\d{3,5}\s*(?:บาท|฿|THB)/i.test(normalized)) {
    score -= 20;
  }

  return score;
}

function extractLocationFromText(text, lines) {
  const locationLine =
    lines.find((line) =>
      /พิกัด|แถว|ย่าน|เขต|ใกล้|สาขา|สุขุมวิท|ทองหล่อ|เอกมัย|อโศก|พระราม|รัชดา|ลาดพร้าว|ห้วยขวาง|สาทร|สีลม|พัทยา|ภูเก็ต|เชียงใหม่|ระยอง|นนทบุรี|location/i.test(line),
    ) || null;

  const cleaned = cleanDisplayText(
    locationLine
      ? locationLine
          .replace(/^(?:พิกัด|พิกัดฐานทัพ|แถว|ย่าน|เขต|ใกล้|สาขา|location|map|maps)\s*[:：]?\s*/i, '')
          .replace(/^แผนที่ร้านนวดใกล้ฉัน\s*/i, '')
          .replace(/^\s*(?:ถ\.|ถนน)?\s*/i, (match) => match.trim())
          .replace(/\([^)]*\)/g, ' ')
      : '',
  );

  if (cleaned) {
    return cleaned.slice(0, 72);
  }

  if (/bangkok|กรุงเทพ/i.test(text)) {
    return 'Bangkok, Thailand';
  }

  return 'Bangkok, Thailand';
}

function extractPriceFromText(text, lines) {
  const candidatePatterns = [
    /(?:ราคา|เรท|rate|ค่าตัว|โปร(?:โมชั่น)?|เริ่ม(?:ต้น|ที่)?|promotion)\s*[:：]?\s*(\d{2,5})/i,
    /(\d{2,5})\s*(?:บาท|฿|THB)\b/i,
  ];

  for (const line of lines) {
    const normalizedLine = normalizeLine(line);
    if (!normalizedLine || /(?:โทร|phone|tel|line|telegram)/i.test(normalizedLine)) {
      continue;
    }

    for (const pattern of candidatePatterns) {
      const match = normalizedLine.match(pattern);
      const amount = Number.parseInt(match?.[1] || '', 10);
      if (Number.isFinite(amount) && amount >= 100 && amount <= 20000) {
        return `${amount} THB`;
      }
    }
  }

  const textMatches = [...text.matchAll(/(\d{2,5})\s*(?:บาท|฿|THB)\b/gi)];
  for (const match of textMatches) {
    const amount = Number.parseInt(match?.[1] || '', 10);
    if (Number.isFinite(amount) && amount >= 100 && amount <= 20000) {
      return `${amount} THB`;
    }
  }

  return null;
}

function buildFallbackName(lines, explicitName, sourceLabel, location, clusterId) {
  const cleanedExplicitName = cleanDisplayText(explicitName);
  if (isValidListingName(cleanedExplicitName)) {
    return cleanedExplicitName.slice(0, 48);
  }

  const scoredCandidates = lines
    .map((line) => ({
      line: cleanDisplayText(line),
      score: scoreNameLine(line),
    }))
    .filter((candidate) => candidate.line)
    .sort((left, right) => right.score - left.score);

  if (scoredCandidates[0]?.score >= 6) {
    return scoredCandidates[0].line.slice(0, 48);
  }

  const sourceName = formatSourceLabelName(sourceLabel);
  if (isReusableSourceLabel(sourceLabel) && isValidListingName(sourceName)) {
    return sourceName.slice(0, 48);
  }

  const area = cleanDisplayText(location).split(',')[0]?.slice(0, 24);
  return `Massage Listing ${area || clusterId + 1}`.slice(0, 48);
}

function extractTagsFromText(text, location) {
  const nextTags = [];
  const hashtagMatches = [...text.matchAll(/#([^\s#]{2,24})/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  hashtagMatches.forEach((tag) => {
    if (!nextTags.includes(tag)) {
      nextTags.push(tag);
    }
  });

  if (/massage|นวด|สปา|spa/i.test(text) && !nextTags.includes('Massage')) {
    nextTags.push('Massage');
  }

  if (/bangkok|กรุงเทพ|สุขุมวิท|ทองหล่อ|เอกมัย|อโศก|พระราม|รัชดา|ลาดพร้าว|ห้วยขวาง|สาทร|สีลม/i.test(location || text) && !nextTags.includes('Bangkok')) {
    nextTags.push('Bangkok');
  }

  return nextTags.slice(0, 3);
}

function isSpamOrPornContent(text) {
  const lowered = text.toLowerCase();

  // Reject clickbait / porn / video selling / escort-style content
  const pornSignals = [
    /(?:คลิป|clip|vdo|video|วิดีโอ|หนัง)\s*(?:โป้|โป๊|18\+|xxx|เสียว|ลับ|หลุด|sex)/i,
    /(?:โป้|โป๊|xxx|18\+|porn|nude|naked|onlyfans|เสียว|หลุด|ลับเฉพาะ)/i,
    /(?:ขาย\s*(?:คลิป|clip|vdo|video)|sell\s*(?:clip|video|content))/i,
    /(?:group\s*joining\s*details|เข้ากลุ่ม|สนใจเข้ากลุ่ม|กลุ่มลับ|กลุ่มvip|vip\s*group)/i,
    /(?:มีเดีย|media)\s*(?:ลับ|vip|premium)/i,
    /(?:ดูฟรี|free\s*vid|watch\s*free|คลิปฟรี)/i,
    /(?:ทักซื้อ|ทักเลย|dm\s*(?:me|for)|inbox)\s*(?:คลิป|clip|vdo|video)/i,
    /(?:แอบถ่าย|hidden\s*cam|spy\s*cam)/i,
    // Escort / companion / "special service" signals
    /(?:น้องใหม่|พร้อมให้บริการ|บริการพิเศษ|บริการถึงที่|ถึงห้อง|out\s*call|in\s*call|service.*room)/i,
    /(?:ตัวจริง|ตัวเป็นๆ|รูปจริง|ไม่ผิดหวัง|งานดี|เด็ด|แซ่บ|ฟิน|sexy|hot\s*girl)/i,
    /(?:dream\s*girl|สาวสวย|สาวเซ็กซี่|สาวน่ารัก.*บริการ|companion|escort)/i,
    // Reject content focused on choosing girls / individual masseuses by appearance
    /(?:เลือกน้อง|เลือกหมอ|เลือกคน|เลือกสาว|choose.*girl|pick.*girl)/i,
    // Reject "update on girls" / girl lineup / staff showcase posts
    /(?:อัพเดต.*สาว|อัพเดท.*สาว|update.*girl|แจ้งเข้า|รอยดึก|น้องๆ.*วันนี้|สาว.*วันนี้|line.*up|lineup)/i,
    // Reject individual girl profiles (not business listings)
    /(?:น้อง\s*\S{1,12}\s*(?:อายุ|age|สูง|ผิว|หน้าอก|น้ำหนัก|weight|height))/i,
  ];

  if (pornSignals.some((pattern) => pattern.test(text))) {
    return true;
  }

  // Reject if text is mostly decorative symbols and no real content
  const stripped = text.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (stripped.length < 10 && text.length > 20) {
    return true;
  }

  // Reject if text is just "group joining details" with symbols
  if (/^[\s©▼▲●◆─+\-=*]*group\s*joining\s*details[\s©▼▲●◆─+\-=*]*$/i.test(text.trim())) {
    return true;
  }

  return false;
}

function isVideoOnlyCluster(cluster) {
  // Check if media messages are videos (not photos) — videos are often porn content
  return cluster.mediaMessages.length > 0 &&
    cluster.mediaMessages.every((m) => m.media?.document || m.media?.video) &&
    !cluster.mediaMessages.some((m) => m.media?.photo);
}

function buildFallbackListing(cluster, clusterId, sourceLabel) {
  const text = cluster.texts.join('\n').trim();
  if (!text || text.length < 24) {
    return null;
  }

  // Reject spam, porn, and clickbait content
  if (isSpamOrPornContent(text)) {
    return null;
  }

  // Reject if the cluster has no real massage/spa business signals
  const businessSignals = /(?:ร้าน|shop|spa|สปา|นวด|massage|clinic|คลินิก|health|สุขภาพ|therap|เพื่อสุขภาพ|แผนไทย|thai\s*(?:massage|spa)|พิกัด|location|maps|เปิด.*\d|open.*\d|\d{1,2}[:.]\d{2}|หมอ|บริการ|ราคา|price|baht|บาท|฿|โทร|tel|phone|line\s*(?:id)?|จอง|booking|reservation|ซอย|soi|ถนน|road|แยก|ใกล้|near|bts|mrt)/i;
  if (!businessSignals.test(text)) {
    return null;
  }

  // Reject video-only clusters (likely porn clips, not massage listings)
  if (isVideoOnlyCluster(cluster)) {
    return null;
  }

  const listingSignal = /massage|นวด|spa|สปา|ร้าน|therap|เปิดรับ|เปิดบริการ|จอง|พิกัด|location|line|telegram|ราคา|บาท|฿/i;
  if (!listingSignal.test(text)) {
    return null;
  }

  const lines = text
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const explicitName =
    text.match(/(?:ชื่อร้าน|ชื่อ|ร้าน)\s*[:：]?\s*([^\n]{2,48})/i)?.[1] ||
    [...text.matchAll(/#([^\s#]{2,28})/g)]
      .map((match) => cleanDisplayText(match[1]))
      .find((tag) => isValidListingName(tag)) ||
    null;
  const location = extractLocationFromText(text, lines);
  const candidateName = buildFallbackName(lines, explicitName, sourceLabel, location, clusterId);
  const price = extractPriceFromText(text, lines);
  const description = normalizeLine(lines.slice(0, 3).join(' ')).slice(0, 220);

  return {
    cluster_id: clusterId,
    name: candidateName.slice(0, 48) || `Listing ${clusterId + 1}`,
    age: null,
    location: location || 'Bangkok, Thailand',
    price,
    metrics: {},
    tags: extractTagsFromText(text, location),
    description: description || 'New listing captured from Telegram.',
    phone: text.match(/(?:\+?66|0)\d[\d -]{7,}/)?.[0] || null,
    hours: text.match(/\b\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}\b/)?.[0] || null,
    lineUrl: text.match(/https?:\/\/line\.me\/\S+/i)?.[0] || null,
    telegramUrl: text.match(/https?:\/\/t\.me\/\S+/i)?.[0] || null,
    mapsUrl: text.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com)\S+/i)?.[0] || null,
  };
}

function buildFallbackListings(clusters, sourceLabel) {
  return clusters
    .map((cluster, clusterId) => {
      // Only accept clusters that have BOTH text and photos from the same sender
      // This prevents mismatching photos with unrelated text
      if (cluster.texts.length === 0 || cluster.mediaMessages.length === 0) {
        return null;
      }
      return buildFallbackListing(cluster, clusterId, sourceLabel);
    })
    .filter(Boolean);
}

function needsEnrichment(listing) {
  if (!listing) {
    return false;
  }

  return (
    !listing.price ||
    !listing.location ||
    listing.location === 'Bangkok, Thailand' ||
    !listing.phone && !listing.lineUrl && !listing.telegramUrl && !listing.mapsUrl ||
    !listing.description ||
    listing.description === 'New listing captured from Telegram.'
  );
}

function mergeEnrichment(listing, enrichment) {
  if (!enrichment) {
    return listing;
  }

  const enrichedName = cleanDisplayText(enrichment.name || '');
  const nextName = isValidListingName(enrichedName)
    ? enrichedName.slice(0, 48)
    : listing.name;

  return {
    ...listing,
    name: nextName,
    location: normalizeLine(enrichment.location || listing.location) || listing.location,
    price: normalizeLine(enrichment.price || listing.price) || listing.price,
    description: normalizeLine(enrichment.description || listing.description) || listing.description,
    phone: normalizeLine(enrichment.phone || listing.phone) || listing.phone,
    hours: normalizeLine(enrichment.hours || listing.hours) || listing.hours,
    lineUrl: normalizeLink(enrichment.lineUrl || listing.lineUrl) || listing.lineUrl,
    telegramUrl: normalizeLink(enrichment.telegramUrl || listing.telegramUrl) || listing.telegramUrl,
    mapsUrl: normalizeLink(enrichment.mapsUrl || listing.mapsUrl) || listing.mapsUrl,
    tags: [...new Set([...(Array.isArray(listing.tags) ? listing.tags : []), ...(Array.isArray(enrichment.tags) ? enrichment.tags : [])])]
      .filter(Boolean)
      .slice(0, 4),
    metrics: {
      ...(listing.metrics || {}),
      ...((enrichment.metrics && typeof enrichment.metrics === 'object') ? enrichment.metrics : {}),
    },
  };
}

async function enrichListingsWithAi(listings, clusters, sourceLabel) {
  if (!ai || !Array.isArray(listings) || listings.length === 0 || aiEnrichmentPerCycle <= 0) {
    if (!ai) {
      console.log(`${sourceLabel}: Gemini not configured. Deterministic-only mode active.`);
    }

    return listings;
  }

  const candidates = listings
    .filter((listing) => needsEnrichment(listing))
    .slice(0, aiEnrichmentPerCycle);

  if (candidates.length === 0) {
    return listings;
  }

  const candidateClusterIds = new Set(
    candidates
      .map((listing) => normalizeClusterId(listing.cluster_id))
      .filter((clusterId) => clusterId !== null),
  );

  const rawText = clusters
    .map((cluster, clusterId) => ({ cluster, clusterId }))
    .filter(({ clusterId }) => candidateClusterIds.has(clusterId))
    .map(({ cluster, clusterId }) => `[CLUSTER ${clusterId}]\n${cluster.texts.join('\n')}`)
    .join('\n\n---\n\n');

  if (!rawText) {
    return listings;
  }

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildEnrichmentPrompt(rawText),
        config: {
          responseMimeType: 'application/json',
        },
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Gemini parsing timed out after ${parseTimeoutMs}ms.`));
        }, parseTimeoutMs);
      }),
    ]);

    const enrichedListings = parseModelJson(response.text);
    console.log(`${sourceLabel}: Gemini enriched ${enrichedListings.length} listing candidate(s).`);

    if (enrichedListings.length === 0) {
      return listings;
    }

    const enrichmentByCluster = new Map(
      enrichedListings
        .map((listing) => [normalizeClusterId(listing.cluster_id), listing])
        .filter(([clusterId]) => clusterId !== null),
    );

    return listings.map((listing) => {
      const clusterId = normalizeClusterId(listing.cluster_id);
      return mergeEnrichment(listing, enrichmentByCluster.get(clusterId));
    });
  } catch (error) {
    console.warn(`${sourceLabel}: Gemini enrichment skipped. ${error.message}`);
    return listings;
  }
}

/**
 * Cluster Telegram messages by groupedId (albums) or by sender + time proximity.
 * Each cluster has: { texts: string[], mediaMessages: Message[], senderId, startDate }
 */
function clusterMessages(messages, timeWindowSec = 300) {
  const groupedIdMap = new Map();
  const ungrouped = [];

  for (const msg of messages) {
    if (msg.groupedId) {
      const gid = String(msg.groupedId);
      if (!groupedIdMap.has(gid)) {
        groupedIdMap.set(gid, []);
      }
      groupedIdMap.get(gid).push(msg);
    } else {
      ungrouped.push(msg);
    }
  }

  const clusters = [];

  // Build clusters from grouped albums
  for (const [, groupMsgs] of groupedIdMap) {
    const sorted = groupMsgs.sort((a, b) => (a.date || 0) - (b.date || 0));
    const senderId = getSenderId(sorted[0]);
    const texts = sorted
      .map((m) => m.message)
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim());
    const mediaMessages = sorted.filter((m) => m.media && m.media.photo);
    clusters.push({
      texts,
      mediaMessages,
      senderId,
      startDate: sorted[0]?.date || 0,
      lastDate: sorted.at(-1)?.date || sorted[0]?.date || 0,
    });
  }

  // Cluster ungrouped messages by sender + time proximity
  const sorted = ungrouped.sort((a, b) => (a.date || 0) - (b.date || 0));
  let current = null;

  for (const msg of sorted) {
    const senderId = getSenderId(msg);
    const msgDate = msg.date || 0;

    if (
      current &&
      current.senderId === senderId &&
      Math.abs(msgDate - current.lastDate) <= timeWindowSec
    ) {
      // Same sender, within time window — add to current cluster
      if (msg.message && msg.message.trim()) {
        current.texts.push(msg.message.trim());
      }
      if (msg.media && msg.media.photo) {
        current.mediaMessages.push(msg);
      }
      current.lastDate = msgDate;
    } else {
      // Start a new cluster
      if (current && (current.texts.length > 0 || current.mediaMessages.length > 0)) {
        clusters.push(current);
      }
      current = {
        texts: msg.message && msg.message.trim() ? [msg.message.trim()] : [],
        mediaMessages: msg.media && msg.media.photo ? [msg] : [],
        senderId,
        startDate: msgDate,
        lastDate: msgDate,
      };
    }
  }
  if (current && (current.texts.length > 0 || current.mediaMessages.length > 0)) {
    clusters.push(current);
  }

  return clusters;
}

function mergeAdjacentClusters(clusters, mergeWindowSec = 600) {
  const sortedClusters = [...clusters].sort((left, right) => (left.startDate || 0) - (right.startDate || 0));
  const merged = [];

  for (const cluster of sortedClusters) {
    const lastCluster = merged.at(-1);
    const withinWindow =
      lastCluster &&
      lastCluster.senderId === cluster.senderId &&
      Math.abs((cluster.startDate || 0) - (lastCluster.lastDate || lastCluster.startDate || 0)) <= mergeWindowSec;
    const complementaryMedia =
      withinWindow &&
      (
        (isTextOnlyCluster(lastCluster) && isMediaOnlyCluster(cluster)) ||
        (isMediaOnlyCluster(lastCluster) && isTextOnlyCluster(cluster))
      );

    if (complementaryMedia) {
      lastCluster.texts.push(...cluster.texts);
      lastCluster.mediaMessages.push(...cluster.mediaMessages);
      lastCluster.startDate = Math.min(lastCluster.startDate || 0, cluster.startDate || 0);
      lastCluster.lastDate = Math.max(lastCluster.lastDate || 0, cluster.lastDate || cluster.startDate || 0);
      continue;
    }

    merged.push({
      ...cluster,
      texts: [...cluster.texts],
      mediaMessages: [...cluster.mediaMessages],
    });
  }

  return merged;
}

function getSenderId(msg) {
  if (msg.fromId) {
    return String(msg.fromId.userId || msg.fromId.channelId || msg.fromId);
  }
  if (msg.peerId) {
    return String(msg.peerId.userId || msg.peerId.channelId || msg.peerId);
  }
  return 'unknown';
}

const photosDir = ensureLocalPhotosDir();

async function downloadClusterPhotos(client, cluster, maxPhotos = 4) {
  const downloaded = [];
  const toDownload = cluster.mediaMessages.slice(0, maxPhotos);

  for (const msg of toDownload) {
    try {
      const buffer = await client.downloadMedia(msg, {});
      if (!buffer || buffer.length === 0) continue;

      const filename = `tg_${msg.id}_${Date.now()}.jpg`;
      const storageUrl = await uploadPhotoBuffer(buffer, filename);
      if (storageUrl) {
        downloaded.push(storageUrl);
        continue;
      }

      const filepath = path.join(photosDir, filename);
      fs.writeFileSync(filepath, buffer);
      downloaded.push(`/photos/${filename}`);
    } catch (err) {
      console.warn(`Failed to download photo from message ${msg.id}:`, err.message);
    }
  }

  return downloaded;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createMessageBatch(messages, minimumMessageId = 0) {
  const nextMessages = Array.isArray(messages) ? messages : [];
  const latestMessageId = nextMessages.reduce(
    (highest, message) => Math.max(highest, Number(message?.id) || 0),
    minimumMessageId,
  );

  const newMessages = nextMessages.filter(
    (message) => (Number(message?.id) || 0) > minimumMessageId,
  );

  return {
    latestMessageId,
    newMessages,
  };
}

async function extractListingsFromTarget(client, target, state = {}) {
  const messages = await client.getMessages(target.fetchRef, {
    limit: Number.isFinite(fetchLimit) ? fetchLimit : 30,
  });

  if (!state.lastSeenMessageIds) {
    state.lastSeenMessageIds = {};
  }

  const { latestMessageId, newMessages } = createMessageBatch(
    messages,
    state.lastSeenMessageIds[target.token] || 0,
  );

  console.log(
    `${target.displayLabel}: fetched ${messages.length} messages, ${newMessages.length} new message(s), latest id ${latestMessageId}.`,
  );

  state.lastSeenMessageIds[target.token] = latestMessageId;

  if (newMessages.length === 0) {
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  // Cluster messages by sender + time proximity or groupedId (albums)
  const clusters = mergeAdjacentClusters(clusterMessages(newMessages));
  const clustersWithText = clusters.filter((c) => c.texts.length > 0);
  console.log(
    `${target.displayLabel}: grouped into ${clusters.length} cluster(s), ${clustersWithText.length} with text.`,
  );

  if (clustersWithText.length === 0) {
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  const deterministicListings = buildFallbackListings(clusters, target.displayLabel);
  console.log(`${target.displayLabel}: deterministic parser returned ${deterministicListings.length} listing candidate(s).`);

  if (deterministicListings.length === 0) {
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  const rawEnrichedListings = await enrichListingsWithAi(deterministicListings, clusters, target.displayLabel);

  // Post-enrichment spam filter: reject listings with spam descriptions or names
  const enrichedListings = rawEnrichedListings.filter((listing) => {
    const combined = `${listing.name || ''} ${listing.description || ''}`;
    if (isSpamOrPornContent(combined)) {
      console.log(`${target.displayLabel}: filtered spam listing "${listing.name}"`);
      return false;
    }
    // Reject listings with only "group joining details" as description
    if (/^[\s.]*group\s*joining\s*details/i.test(listing.description || '')) {
      console.log(`${target.displayLabel}: filtered "group joining" listing "${listing.name}"`);
      return false;
    }
    return true;
  });

  const referencedClusterIds = [
    ...new Set(
      enrichedListings
        .map((listing) => normalizeClusterId(listing.cluster_id))
        .filter((clusterId) => clusterId !== null),
    ),
  ];

  const clusterPhotos = new Map();
  for (const clusterId of referencedClusterIds) {
    const cluster = clusters[clusterId];
    if (!cluster || cluster.mediaMessages.length === 0) {
      continue;
    }

    const photos = await downloadClusterPhotos(client, cluster);
    if (photos.length > 0) {
      clusterPhotos.set(clusterId, photos);
      console.log(`  ${target.displayLabel} cluster ${clusterId}: downloaded ${photos.length} photo(s)`);
    }
  }

  // Assign real photos, original post time, and source channel to listings based on cluster_id.
  // If the model cannot point to a valid cluster, skip the candidate instead of mismatching photos.
  const clusterAssignmentCounts = new Map();
  const listingsWithPhotos = [];
  let skippedInvalidClusterCount = 0;

  for (const listing of enrichedListings) {
    const clusterId = normalizeClusterId(listing.cluster_id);
    const cluster = clusterId !== null ? clusters[clusterId] : null;

    if (!cluster) {
      skippedInvalidClusterCount += 1;
      continue;
    }

    const photos = clusterPhotos.get(clusterId) || [];
    const assignmentIndex = clusterAssignmentCounts.get(clusterId) || 0;
    clusterAssignmentCounts.set(clusterId, assignmentIndex + 1);

    const enriched = {
      ...listing,
      cluster_id: clusterId,
      sourceChannel: target.displayLabel,
      sourceTarget: target.token,
    };

    if (photos.length > 0) {
      enriched.imageUrl = photos[assignmentIndex % photos.length];
    }

    if (cluster.startDate) {
      enriched.postedAt = new Date(cluster.startDate * 1000).toISOString();
    }

    listingsWithPhotos.push(enriched);
  }

  if (skippedInvalidClusterCount > 0) {
    console.warn(`${target.displayLabel}: skipped ${skippedInvalidClusterCount} candidate(s) with invalid cluster_id values.`);
  }

  const normalizedListings = normalizeExtractedListings(listingsWithPhotos, {
    source: 'snapshot',
  });
  console.log(`${target.displayLabel}: normalized ${normalizedListings.length} unique listing(s).`);

  if (normalizedListings.length === 0) {
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  // Fall back to mockup images for any listings without real photos
  const mockupsDir = path.join(__dirname, '../public/mockups');
  const files = fs
    .readdirSync(mockupsDir)
    .filter((file) => file.endsWith('.jpg') || file.endsWith('.png'));

  const listingsWithImages = attachImages(normalizedListings, files);
  const matchedPhotoCount = listingsWithImages.filter(
    (listing) => listing.imageUrl && !listing.imageUrl.startsWith('/mockups/'),
  ).length;
  const fallbackPhotoCount = listingsWithImages.length - matchedPhotoCount;
  console.log(
    `${target.displayLabel}: photo matching summary. Cluster-matched: ${matchedPhotoCount}, mockup fallback: ${fallbackPhotoCount}.`,
  );

  return {
    sourceLabel: target.displayLabel,
    fetchedMessages: messages.length,
    listings: listingsWithImages,
  };
}

async function runTelegramScrape(client, targets, state = {}) {
  const channelResults = [];
  for (const target of targets) {
    try {
      const result = await extractListingsFromTarget(client, target, state);
      channelResults.push(result);
    } catch (error) {
      console.error(`Error extracting from ${target.displayLabel}:`, error.message);
    }
  }

  const fetchedMessages = channelResults.reduce((sum, result) => sum + result.fetchedMessages, 0);
  const listingsWithImages = channelResults.flatMap((result) => result.listings || []);

  if (listingsWithImages.length === 0) {
    return {
      fetchedMessages,
      extractedListings: 0,
      inserted: 0,
      skipped: 0,
      snapshotCount: readSnapshotListings().length,
      wroteSnapshot: false,
    };
  }

  const allowedSourceChannels = new Set(targets.map((target) => target.displayLabel));
  const curatedExistingSnapshot = readSnapshotListings().filter((listing) =>
    allowedSourceChannels.has(listing?.sourceChannel),
  );

  const mergedSnapshot = mergeSnapshotListings(listingsWithImages, curatedExistingSnapshot, {
    limit: snapshotLimit,
  });
  const wroteSnapshot = writeSnapshotListings(mergedSnapshot);

  let inserted = 0;
  let skipped = 0;

  if (supabase) {
    const syncResult = await insertListingsIfPossible(supabase, listingsWithImages);
    inserted = syncResult.inserted;
    skipped = syncResult.skipped;
    console.log(`Supabase sync complete. Inserted: ${inserted}, skipped: ${skipped}`);
  } else {
    skipped = listingsWithImages.length;
    console.log('Supabase service role key not configured. Snapshot-only mode complete.');
  }

  // Export photos to Google Drive + listing data to Google Sheets
  try {
    await exportToGoogle(listingsWithImages);
  } catch (err) {
    console.warn('Google export failed (non-fatal):', err.message);
  }

  return {
    fetchedMessages,
    extractedListings: listingsWithImages.length,
    inserted,
    skipped,
    snapshotCount: mergedSnapshot.length,
    wroteSnapshot,
  };
}

async function main() {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  const state = {
    lastSeenMessageIds: {},
    shouldStop: false,
  };

  process.on('SIGINT', () => {
    state.shouldStop = true;
  });

  process.on('SIGTERM', () => {
    state.shouldStop = true;
  });

  await client.connect();
  const resolvedTargets = await resolveSourceTargets(client);

  if (resolvedTargets.length === 0) {
    console.error('No Telegram source targets could be resolved. Check TELEGRAM_SOURCE_TARGETS.');
    process.exit(1);
  }

  console.log(
    `Starting Telegram scraper for ${resolvedTargets.map((target) => target.displayLabel).join(', ')}${watchMode ? ` in watch mode (${pollIntervalMs}ms)` : '...'}`,
  );

  try {
    do {
      const startedAt = Date.now();

      try {
        const result = await runTelegramScrape(client, resolvedTargets, state);
        console.log(
          `Scrape cycle complete. Extracted: ${result.extractedListings}, snapshot size: ${result.snapshotCount}.`,
        );
      } catch (error) {
        console.error('Error fetching or parsing Telegram messages:', error.message);
        if (!watchMode) {
          process.exitCode = 1;
          break;
        }
      }

      if (!watchMode || state.shouldStop) {
        break;
      }

      const waitTime = Math.max(5_000, pollIntervalMs - (Date.now() - startedAt));
      console.log(`Waiting ${waitTime}ms before the next Telegram intake cycle...`);
      await delay(waitTime);
    } while (!state.shouldStop);
  } finally {
    await client.disconnect();
  }
}

main();
