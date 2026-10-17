import fs from 'fs';
import { withCycleTimeout, CycleTimeoutError } from '../src/lib/cycle_timeout.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { GoogleGenAI } from '@google/genai';
import { createDataClient } from './lib/local_db.js';
import dotenv from 'dotenv';
import {
  archiveChannelMessages,
  buildFingerprint,
  insertListingsIfPossible,
  mergeSnapshotListings,
  normalizeExtractedListings,
  parseModelJson,
  readSnapshotListings,
  writeSnapshotListings,
} from './listing_pipeline.js';
import { notifyListings } from './notify.js';
import { exportToGoogle } from './google_export.js';
import {
  archivePhotoMetadata,
  downloadAndStorePhoto,
  ensureLocalPhotosDir,
  setPhotoStorageSupabaseEnabled,
} from './photo_storage.js';
import { syncListingsToFirestore } from './firestore_sync.js';

import { cleanDisplayText, normalizeText } from '../src/lib/normalization.js';
import { detectIntakeGap, mergeCatchUpPages, CATCH_UP_MAX_PAGES } from '../src/lib/intake_gap.js';
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
const snapshotLimit = Number.parseInt(process.env.SNAPSHOT_LISTING_LIMIT || '2000', 10);
const parseTimeoutMs = Number.parseInt(process.env.GEMINI_PARSE_TIMEOUT_MS || '15000', 10);
const aiEnrichmentPerCycle = Number.parseInt(process.env.AI_ENRICHMENT_PER_CYCLE || '5', 10);
// Global AI governor: channels run concurrently, so the RPM budget must be
// shared across the whole cycle — not per channel. Without this, N channels
// firing at once bursts past Gemini's free-tier limit and every call 429s.
const aiCycleBudget = Number.parseInt(process.env.AI_ENRICHMENT_PER_CYCLE_TOTAL || '12', 10);
const aiMinGapMs = Number.parseInt(process.env.AI_MIN_GAP_MS || '4000', 10);
let aiCallsRemaining = aiCycleBudget;
let aiLastCallAt = 0;
let aiDisabledReason = null;
let aiDisabledLogged = false;
function resetAiCycleBudget() {
  aiCallsRemaining = aiCycleBudget;
}
export async function waitAiTurn() {
  // Reserve the next slot SYNCHRONOUSLY, before any await: the previous
  // version read aiLastCallAt, slept, then stamped Date.now() — so N
  // concurrent channels each read the same aiLastCallAt, waited the same
  // window, and fired together. The whole point was serializing them. The
  // reservation below is atomic (nothing is awaited between read and write);
  // each caller chains onto the previous slot and sleep-until its reserved
  // time instead of all waking in unison.
  const now = Date.now();
  const nextSlot = Math.max(now, aiLastCallAt + aiMinGapMs);
  const waitMs = nextSlot - now;
  aiLastCallAt = nextSlot;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
// Local-model transport: the always-on M3 Air runs Ollama (or the operator
// gateway — both speak OpenAI /v1/chat/completions). Same prompt contract and
// JSON parsing as Gemini, $0, no API keys that can spend money. Takes
// precedence over Gemini when configured.
const localAiUrl = (process.env.LOCAL_AI_URL || '').replace(/\/+$/, '');
const localAiModel = process.env.LOCAL_AI_MODEL || 'gemma3n:e4b';
const localAiKey = process.env.LOCAL_AI_KEY || process.env.OPERATOR_KEY || '';
const localAiTimeoutMs = Number.parseInt(process.env.LOCAL_AI_TIMEOUT_MS || '120000', 10);
// The M3's Ollama daemon runs with OLLAMA_CONTEXT_LENGTH=65536 (see
// setup_m3_local_ai.sh) so the card serves its full window. A per-request
// num_ctx below that silently truncates every enrichment — align with the
// daemon by default; override only to save memory on the M3.
const localAiNumCtx = Number.parseInt(process.env.LOCAL_AI_NUM_CTX || '65536', 10);

/**
 * Run one enrichment prompt against the local model endpoint.
 * Returns the raw text content; callers parse it with parseModelJson.
 */
export async function generateLocalEnrichment(promptText) {
  const response = await fetch(`${localAiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localAiKey ? { Authorization: `Bearer ${localAiKey}` } : {}),
    },
    body: JSON.stringify({
      model: localAiModel,
      messages: [
        { role: 'system', content: 'You extract structured business listings from Thai Telegram posts. Reply with JSON only — no prose, no markdown fences.' },
        { role: 'user', content: promptText },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
      // Align the request context with the daemon (65536) so enrichments use
      // the card's full window; override via LOCAL_AI_NUM_CTX if the M3 needs
      // to trade context for memory.
      options: { num_ctx: localAiNumCtx },
    }),
    signal: AbortSignal.timeout(localAiTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Local AI ${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Local AI returned no content.');
  }
  return text;
}
const watchMode = process.argv.includes('--watch');

process.on('unhandledRejection', (error) => {
  // Never swallow: a fatal rejection with no exit left a zombie process that
  // held the session, produced zero intake, and blocked daemon restarts.
  // A "TIMEOUT" in the message is NOT proof the rejection was benign — the
  // Gemini race timer, AbortSignal timeouts, network stalls, and genuinely
  // hung requests all reject with timeout-like messages. Swallowing those
  // would reproduce the exact zombie we are defending against. Only a
  // rejection the caller already integrated into normal flow is acceptable,
  // and those never reach this handler. So: log, persist, and exit always.
  console.error('FATAL unhandled rejection — exiting for daemon restart:', error);
  try {
    savePersistedState(globalScraperState);
  } catch {
    /* noop */
  }
  process.exit(1);
});
let globalScraperState = { lastSeenMessageIds: {}, intakeGaps: {} };

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
// Fail-fast fetch: Supabase free tier can stall for days (522s) — without a
// timeout every pipeline call blocks serially and the whole scraper hangs.
// Local data station on the M3 (DATABASE_URL, default localhost/airdnd).
// Supabase is retired; the variable keeps its old name to keep the diff small.
void supabaseUrl; void supabaseServiceRoleKey;
const configuredSupabase = createDataClient();

const domainConfigPath = path.join(__dirname, '../domain.config.json');
let domainConfig = {};
if (fs.existsSync(domainConfigPath)) {
  domainConfig = JSON.parse(fs.readFileSync(domainConfigPath, 'utf-8'));
} else {
  console.warn('No domain.config.json found, using empty configuration.');
}
let supabase = configuredSupabase;

async function refreshSupabaseAvailability() {
  if (!configuredSupabase) {
    supabase = null;
    setPhotoStorageSupabaseEnabled(false);
    return;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 4_000);

  try {
    const { error } = await configuredSupabase
      .from('companions')
      .select('id')
      .limit(1)
      .abortSignal(abortController.signal);

    supabase = error ? null : configuredSupabase;
  } catch {
    supabase = null;
  } finally {
    clearTimeout(timeoutId);
  }

  setPhotoStorageSupabaseEnabled(Boolean(supabase));
  if (!supabase) {
    console.warn('Supabase is unavailable; continuing with snapshot and Firestore sync.');
  }
}

function buildEnrichmentPrompt(rawText) {
  const defaultPrompt = `
Enrich the following already-detected Thailand wellness, massage, or spa listings.
Each message group is labelled with a [CLUSTER <id>] tag. Return only data that is clearly present in that cluster.
Return only a JSON array with this shape:
[
  {
    "cluster_id": 0,
    "name": "Business or provider name or null",
    "location": "District or area, City/Province or null",
    "price": null,
    "metrics": {
      "best_time_to_book": "Extracted time window (e.g. 'Afternoon', '14:00-18:00') or 'Unknown'",
      "staff_count": "Extracted number of girls/staff (e.g. '5', 'Many') or 'Unknown'",
      "price_assessment": "Extracted assessment (e.g. 'Value', 'Standard', 'Premium') or 'Unknown'"
    },
    "tags": ["Thai Massage", "Oil Massage"],
    "description": "Short factual summary of the service, area, hours, or availability or null",
    "phone": "0XX-XXX-XXXX or null",
    "hours": "10:00-23:00 or null",
    "lineUrl": "https://line.me/... or null",
    "telegramUrl": "https://t.me/... or null",
    "mapsUrl": "https://maps.app.goo.gl/... or null",
    "user_rating": null,
    "service_quality": [],
    "user_feedback_summary": null
  }
]

Rules:
- Be EXTREMELY airtight and accurate with your full data entry.
- Thoroughly extract location data specifically to map it accurately later (e.g. precise District and City).
- **Consolidation Rule**: Return EXACTLY ONE object per cluster. If a cluster mentions multiple people (e.g. a list of available staff), consolidate them into a single listing for that venue. Mention the staff variety in the "description" instead of creating multiple cards.
- **Human-Centric Priority**: Focus on listings that describe people/staff availability. If a cluster only describes the shop facility/room with no mention of staff, it is lower priority.
- cluster_id must match the [CLUSTER <id>] from which the listing was enriched.
- Extract phone numbers, operating hours, LINE links, Telegram links, Google Maps links, location, price, and a short factual description when present.
- Use null for unknown name, location, price, phone, hours, or link values.
- For the metrics object, carefully evaluate the text:
  - best_time_to_book: What time is generally recommended or when are girls most available?
  - staff_count: How many staff or girls are listed as available?
  - price_assessment: Based on the price, evaluate if it is 'Value', 'Standard', 'Premium', or 'Luxury'.
- Tags must be SERVICE TYPES only (e.g., "Thai Massage", "Oil Massage", "Aromatherapy", "Foot Massage", "Health Spa", "Late Night", "24 Hours"). Do NOT use city or location names as tags.
- Keep descriptions factual and concise.

User feedback & ratings extraction:
- If users mention ratings (e.g., "10/10", "5 stars", "4.5/5", "ให้ 9 เต็ม 10"), normalize to a 1.0-5.0 scale in user_rating.
- Extract service quality keywords into service_quality array: "clean", "friendly", "skilled", "professional", "relaxing", "value", "private", "late_night", "new_staff", "experienced".
- If the text contains genuine user reviews or experience reports (not ads), summarize them briefly in user_feedback_summary.
- Do NOT invent ratings or feedback. Only extract what users explicitly stated.
`;

  const promptBody = domainConfig?.ai_enrichment?.system_prompt || defaultPrompt;
  const availabilityContract = `
Availability metrics (required inside the metrics object):
- availability_status: "available" only when the post explicitly says a slot/person is free now or today; "unavailable" only when it explicitly says full/not available; otherwise "unknown".
- availability_evidence: the shortest exact phrase supporting that status, or null.
- available_staff_count: the explicit count of currently available staff, or null.
- Never infer slot availability merely because the business is open.`;
  return `${promptBody}\n\n${availabilityContract}\n\nMessages:\n${rawText}`;
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
  return listings.map((listing) => {
    if (listing.imageUrl && !listing.imageUrl.startsWith('/mockups/')) {
      return listing;
    }
    return {
      ...listing,
      imageUrl: null,
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
    /(?:group joining details|new group|line\s*id|id\s*line|เปิดให้บริการ|ติดตามน้องใหม่|ห้ามพลาด|ได้เลยนะ|ส่งไรนักหนา|ทักมา|แอดไลน์|มีน้องคนไหน|จะดู|เอาใจ|แซ่บ|สะอาด|ปลอดภัย|คนไม่พลุกพล่าน|เงียบสงบ|ที่จอดรถ|private room|parking|จับจอง|แล้วค่า|แล้วครับ|แล้วค่ะ)/i.test(lowered) ||
    /(?:ครับ|ค่ะ|คะ|จ้า|นะคะ|นะครับ|ไหม|มั้ย)/i.test(normalized) ||
    /^[a-z\s.]+group[a-z\s.]*$/i.test(normalized) ||
    /[:：]/.test(normalized) ||
    /^(?:เปิด|line|group|new|ได้|มี|จะ|ติดตาม|โทร|พิกัด)\b/i.test(normalized) ||
    (/society/i.test(normalized) && !/massage|spa|สปา|นวด/i.test(normalized)) ||
    /^\d+$/.test(normalized) ||
    (/^[\u0E00-\u0E7F]{1,4}$/.test(normalized) && !/massage|spa|สปา|นวด/i.test(normalized)) ||
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

  if (/(?:สะอาด|ปลอดภัย|คนไม่พลุกพล่าน|เงียบสงบ|private room|parking|ที่จอดรถ|เปิดทุกวัน)/i.test(normalized)) {
    score -= 24;
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

  // Load from domain configuration if available, otherwise fallback to defaults
  let pornSignals = [
    /(?:คลิป|clip|vdo|video|วิดีโอ|หนัง)\s*(?:โป้|โป๊|18\+|xxx|เสียว|ลับ|หลุด|sex|เซ็ก)/i,
    /(?:โป้|โป๊|xxx|18\+|porn|nude|naked|onlyfans|เสียว|หลุด|ลับเฉพาะ|เซ็กส์|เย็ด)/i,
    /(?:ขาย\s*(?:คลิป|clip|vdo|video)|sell\s*(?:clip|video|content))/i,
    /(?:group\s*joining\s*details|เข้ากลุ่ม|สนใจเข้ากลุ่ม|กลุ่มลับ|กลุ่มvip|vip\s*group)/i,
    /(?:มีเดีย|media)\s*(?:ลับ|vip|premium)/i,
    /(?:ดูฟรี|free\s*vid|watch\s*free|คลิปฟรี)/i,
    /(?:ทักซื้อ|ทักเลย|dm\s*(?:me|for)|inbox)\s*(?:คลิป|clip|vdo|video)/i,
    /(?:แอบถ่าย|hidden\s*cam|spy\s*cam)/i,
    /(?:บริการพิเศษ|บริการถึงที่|ถึงห้อง|out\s*call|in\s*call|service.*room)/i,
    /(?:ตัวจริง|ตัวเป็นๆ|รูปจริง|ไม่ผิดหวัง|งานดี|เด็ด|แซ่บ|ฟิน|sexy|hot\s*girl)/i,
    /(?:dream\s*girl|สาวสวย|สาวเซ็กซี่|สาวน่ารัก.*บริการ|companion|escort)/i,
    /(?:เลือกน้อง|เลือกหมอ|เลือกคน|เลือกสาว|choose.*girl|pick.*girl)/i,
    /(?:อัพเดต.*สาว|อัพเดท.*สาว|update.*girl|แจ้งเข้า|รอยดึก|น้องๆ.*วันนี้|สาว.*วันนี้|line.*up|lineup)/i,
    /(?:น้อง\s*\S{1,12}\s*(?:อายุ|age|สูง|ผิว|หน้าอก|น้ำหนัก|weight|height))/i,
  ];

  if (domainConfig?.content_screening?.spam_signals) {
    pornSignals = domainConfig.content_screening.spam_signals.map(s => new RegExp(s, 'i'));
  }

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

function extractAvailabilityMetrics(text) {
  const source = String(text || '');
  const unavailable = source.match(/(?:คิวเต็ม|เต็มแล้ว|ไม่ว่าง|ปิดวันนี้|fully\s+booked|no\s+(?:slots?|availability)|closed\s+today)/i);
  const available = source.match(/(?:คิวว่าง|ว่างตอนนี้|ว่างวันนี้|ว่างแล้ว|พร้อมให้บริการ|available\s*(?:now|today)|slots?\s+available|walk[ -]?ins?\s+welcome)/i);
  const count = source.match(/(?:ว่าง|เหลือ|พร้อม)\s*(\d{1,2})\s*(?:คน|ท่าน|หมอ)?|(?:available|free)\s*(\d{1,2})\s*(?:staff|therapists?|slots?)?/i);

  return {
    availability_status: unavailable ? 'unavailable' : available ? 'available' : 'unknown',
    availability_evidence: unavailable?.[0] || available?.[0] || null,
    available_staff_count: count ? Number(count[1] || count[2]) : null,
  };
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
  let businessSignals = /(?:ร้าน|shop|spa|สปา|นวด|massage|clinic|คลินิก|health|สุขภาพ|therap|เพื่อสุขภาพ|แผนไทย|thai\s*(?:massage|spa)|พิกัด|location|maps|เปิด.*\d|open.*\d|\d{1,2}[:.]\d{2}|หมอ|บริการ|ราคา|price|baht|บาท|฿|โทร|tel|phone|line\s*(?:id)?|จอง|booking|reservation|ซอย|soi|ถนน|road|แยก|ใกล้|near|bts|mrt)/i;

  if (domainConfig?.content_screening?.business_signals) {
    businessSignals = new RegExp(domainConfig.content_screening.business_signals.join('|'), 'i');
  }

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
    metrics: extractAvailabilityMetrics(text),
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
    // BI enrichment from Gemini
    user_rating: enrichment.user_rating || listing.user_rating || null,
    service_quality: Array.isArray(enrichment.service_quality) && enrichment.service_quality.length > 0
      ? enrichment.service_quality
      : listing.service_quality || [],
    user_feedback_summary: normalizeLine(enrichment.user_feedback_summary || listing.user_feedback_summary) || null,
  };
}

async function enrichListingsWithAi(listings, clusters, sourceLabel) {
  if ((!ai && !localAiUrl) || !Array.isArray(listings) || listings.length === 0 || aiEnrichmentPerCycle <= 0) {
    if (!aiDisabledLogged) {
      aiDisabledLogged = true;
      if (!ai && !localAiUrl) {
        console.log('No AI backend configured. Deterministic-only mode active ($0, no API spend).');
      } else if (aiEnrichmentPerCycle <= 0) {
        console.log('AI_ENRICHMENT_PER_CYCLE=0. Deterministic-only mode active ($0, no API spend).');
      }
    }

    return listings;
  }

  if (aiDisabledReason) {
    return listings;
  }

  if (aiCallsRemaining <= 0) {
    console.log(`${sourceLabel}: AI cycle budget exhausted. Deterministic-only for the rest of this cycle.`);
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

  // Claim one call from the shared cycle budget, then wait for the global
  // minimum gap so concurrent channels serialize their AI calls instead of
  // bursting the rate limit together (or overloading the M3's small model).
  aiCallsRemaining -= 1;
  await waitAiTurn();
  const aiBackend = localAiUrl ? `local AI ${localAiModel}` : 'Gemini';
  console.log(`${sourceLabel}: Calling ${aiBackend} (cycle budget left: ${aiCallsRemaining})...`);

  let responseText = null;
  const MAX_RETRIES = 2;
  let attempts = 0;

  while (attempts <= MAX_RETRIES) {
    try {
      attempts += 1;
      if (localAiUrl) {
        responseText = await generateLocalEnrichment(buildEnrichmentPrompt(rawText));
      } else {
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
        responseText = response.text;
      }
      break;
    } catch (error) {
      // Auth failures never heal with retries: disable AI for the process
      // lifetime so cycles stop burning minutes on doomed calls.
      if (/API_KEY_INVALID|API key not valid|UNAUTHENTICATED|PERMISSION_DENIED|invalid_api_key|Local AI 401|Local AI 403/i.test(String(error?.message || error))) {
        aiDisabledReason = String(error?.message || error).slice(0, 160);
        const hint = localAiUrl
          ? 'Check LOCAL_AI_KEY/OPERATOR_KEY (or leave unset on a trusted LAN) and restart the scraper.'
          : 'Set a valid GEMINI_API_KEY in .env and restart the scraper.';
        console.error(`AI backend rejected the request (${aiDisabledReason}). AI enrichment DISABLED until restart — deterministic-only mode. ${hint}`);
        return listings;
      }
      if (attempts <= MAX_RETRIES) {
        console.warn(`${sourceLabel}: ${aiBackend} enrichment failed (attempt ${attempts}/${MAX_RETRIES + 1}). Error: ${error.message}. Waiting for next AI turn...`);
        // Retries must re-queue through the governor too — a raw fixed sleep
        // fired 2s after the last call, mid-window of a 4s gap, so a busy
        // channel's retry could stomp another channel's in-flight call.
        await waitAiTurn();
      } else {
        console.warn(`${sourceLabel}: ${aiBackend} enrichment skipped. All ${MAX_RETRIES + 1} attempts failed. Last error: ${error.message}`);
        return listings;
      }
    }
  }

  try {
    // parseModelJson accepts both the requested array and a bare single
    // object (small local models sometimes return the latter).
    const enrichedListings = parseModelJson(responseText);
    console.log(`${sourceLabel}: ${aiBackend} enriched ${enrichedListings.length} listing candidate(s).`);

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
    console.warn(`${sourceLabel}: ${aiBackend} parsing of response failed. ${error.message}`);
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
      messageIds: sorted.map((m) => Number(m.id)).filter(Boolean),
      rawMessages: sorted,
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
      if (msg.id) current.messageIds.push(Number(msg.id));
      current.rawMessages.push(msg);
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
        messageIds: [Number(msg.id)].filter(Boolean),
        rawMessages: [msg],
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
      if (cluster.messageIds) lastCluster.messageIds.push(...cluster.messageIds);
      if (cluster.rawMessages) lastCluster.rawMessages.push(...cluster.rawMessages);
      continue;
    }

    merged.push({
      ...cluster,
      texts: [...cluster.texts],
      mediaMessages: [...cluster.mediaMessages],
      messageIds: [...(cluster.messageIds || [])],
      rawMessages: [...(cluster.rawMessages || [])],
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

async function downloadClusterPhotos(client, cluster, channelName, maxPhotos = 15) {
  // Download ALL media (photos + image documents)
  const allMedia = [
    ...cluster.mediaMessages.filter((m) => m.media?.photo),
    ...cluster.mediaMessages.filter((m) => m.media?.document?.mimeType?.startsWith('image/')),
  ];
  // Limit to maxPhotos but prioritize what might be 'profile' photos if we could tell
  const toDownload = allMedia.slice(0, maxPhotos);
  const channelId = cluster.rawMessages?.[0]?.peerId
    ? String(cluster.rawMessages[0].peerId.channelId || cluster.rawMessages[0].peerId)
    : channelName;

  // Download concurrently (bounded) with order preserved: 15 serial
  // downloads at ~1.5s each would stall every active cluster for 20s+.
  const photoConcurrency = Math.max(1, Number.parseInt(process.env.PHOTO_CONCURRENCY || '4', 10));
  const slots = new Array(toDownload.length).fill(null);
  let nextPhoto = 0;
  const downloadWorkers = Array.from({ length: Math.min(photoConcurrency, toDownload.length) }, async () => {
    while (nextPhoto < toDownload.length) {
      const index = nextPhoto;
      nextPhoto += 1;
      const photoInfo = await downloadAndStorePhoto(client, toDownload[index], channelName);
      if (photoInfo) {
        // Archive metadata to photo_archive table
        await archivePhotoMetadata(photoInfo, toDownload[index], channelId, channelName);
        // Use Supabase URL if available, otherwise local
        slots[index] = photoInfo.supabaseUrl || photoInfo.localUrl;
      }
    }
  });
  await Promise.all(downloadWorkers);

  return slots.filter(Boolean);
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

/**
 * Fetch the newest page for a channel and, if that page does not reach back to
 * the last message we processed, keep paging backwards until it does.
 *
 * Without this, any outage longer than it takes a channel to post `fetchLimit`
 * messages loses everything that scrolled out of the window: the next run just
 * records the new high-water mark. Gaps that cannot be closed within the page
 * ceiling are recorded in `state.intakeGaps` so they are never silent.
 */
async function fetchMessagesWithCatchUp(client, target, lastSeenId, state) {
  const limit = Number.isFinite(fetchLimit) ? fetchLimit : 30;
  const newest = await client.getMessages(target.fetchRef, { limit });
  const gap = detectIntakeGap(newest, lastSeenId);
  if (!gap.hasGap) {
    return { messages: newest, catchUpPages: 0 };
  }

  console.warn(
    `${target.displayLabel}: newest page starts at id ${gap.oldestFetchedId} but last processed id was ${lastSeenId}; paging back to close the gap.`,
  );

  const pages = [newest];
  let offsetId = gap.missingBelow;
  let catchUpPages = 0;
  let reachedLastSeen = false;
  while (catchUpPages < CATCH_UP_MAX_PAGES) {
    // offsetId pages backwards from that id; minId stops Telegram from
    // returning anything we have already processed.
    const page = await client.getMessages(target.fetchRef, { limit, offsetId, minId: lastSeenId });
    catchUpPages += 1;
    if (!Array.isArray(page) || page.length === 0) {
      reachedLastSeen = true;
      break;
    }
    pages.push(page);
    const oldest = Math.min(...page.map((message) => Number(message?.id) || Infinity));
    if (page.length < limit || !Number.isFinite(oldest) || oldest <= lastSeenId + 1) {
      reachedLastSeen = true;
      break;
    }
    offsetId = oldest;
  }

  const messages = mergeCatchUpPages(pages, lastSeenId);
  if (!reachedLastSeen) {
    const oldestFetched = messages.length ? Number(messages[0].id) : gap.oldestFetchedId;
    state.intakeGaps = state.intakeGaps || {};
    state.intakeGaps[target.token] = {
      afterId: lastSeenId,
      beforeId: oldestFetched,
      recordedAt: new Date().toISOString(),
    };
    // Flag for heartbeat-triggered backfill (auto-recovery).
    state.pendingBackfill = state.pendingBackfill || {};
    state.pendingBackfill[target.token] = {
      afterId: lastSeenId,
      beforeId: oldestFetched,
      flaggedAt: new Date().toISOString(),
    };
    console.warn(
      `${target.displayLabel}: gap ${lastSeenId}..${oldestFetched} not closed after ${catchUpPages} page(s); recorded in state.intakeGaps. Backfill flagged for heartbeat.`,
    );
  } else if (state.intakeGaps?.[target.token]) {
    delete state.intakeGaps[target.token];
  }

  return { messages, catchUpPages };
}

export async function extractListingsFromTarget(client, target, state = {}) {
  if (!state.lastSeenMessageIds) {
    state.lastSeenMessageIds = {};
  }

  const lastSeenId = state.lastSeenMessageIds[target.token] || 0;
  const { messages, catchUpPages } = await fetchMessagesWithCatchUp(client, target, lastSeenId, state);

  const { latestMessageId, newMessages } = createMessageBatch(messages, lastSeenId);

  console.log(
    `${target.displayLabel}: fetched ${messages.length} messages${catchUpPages ? ` (+${catchUpPages} catch-up page(s))` : ''}, ${newMessages.length} new message(s), latest id ${latestMessageId}.`,
  );

  // Commit the high-water mark ONLY after processing succeeds. Advancing it
  // earlier (before clustering/photo-download/archive) meant any throw below
  // silently skipped an entire batch forever — the next cycle fetched only
  // `> lastSeen`, so the lost messages were never recovered.
  const commitHighWaterMark = () => {
    state.lastSeenMessageIds[target.token] = latestMessageId;
  };

  if (newMessages.length === 0) {
    // Nothing new — advancing is idempotent and prevents re-polling the set.
    commitHighWaterMark();
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  // Cluster messages by sender + time proximity or groupedId (albums)
  const clusters = mergeAdjacentClusters(clusterMessages(newMessages));
  const clustersWithText = clusters.filter((c) => c.texts.length > 0);
  const mediaOnlyClusters = clusters.filter((c) => c.texts.length === 0 && c.mediaMessages.length > 0);
  console.log(
    `${target.displayLabel}: grouped into ${clusters.length} cluster(s), ${clustersWithText.length} with text, ${mediaOnlyClusters.length} media-only.`,
  );

  if (clustersWithText.length === 0 && mediaOnlyClusters.length === 0) {
    commitHighWaterMark();
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  const deterministicListings = buildFallbackListings(clusters, target.displayLabel);
  console.log(`${target.displayLabel}: deterministic parser returned ${deterministicListings.length} listing candidate(s).`);

  // If no text-based listings but there are media-only clusters, continue
  // so photos can still be archived.
  if (deterministicListings.length === 0 && mediaOnlyClusters.length === 0) {
    commitHighWaterMark();
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  const rawEnrichedListings = deterministicListings.length > 0
    ? await enrichListingsWithAi(deterministicListings, clusters, target.displayLabel)
    : [];

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
    ...new Set([
      ...enrichedListings
        .map((listing) => normalizeClusterId(listing.cluster_id))
        .filter((clusterId) => clusterId !== null),
      // Also download photos from media-only clusters so they are archived
      ...mediaOnlyClusters.map((_, idx) => {
        // Find the cluster index in the original clusters array
        const clusterIdx = clusters.indexOf(mediaOnlyClusters[idx]);
        return clusterIdx >= 0 ? clusterIdx : null;
      }).filter((id) => id !== null),
    ]),
  ];

  const clusterPhotos = new Map();
  for (const clusterId of referencedClusterIds) {
    const cluster = clusters[clusterId];
    if (!cluster || cluster.mediaMessages.length === 0) {
      continue;
    }

    const photos = await downloadClusterPhotos(client, cluster, target.displayLabel);
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

    // Repetition Prevention: If we've already assigned a listing to this cluster,
    // skip subsequent ones to avoid "same post as multiple cards".
    // All photos will be available in the first card's modal gallery.
    if (assignmentIndex > 0) {
      console.log(`${target.displayLabel}: consolidating multiple candidates from cluster ${clusterId} into single listing.`);
      continue;
    }

    clusterAssignmentCounts.set(clusterId, assignmentIndex + 1);

    // Check if cluster text contains adult/explicit signals — if so, flag images as unsafe
    // Photos still get saved (for training data) but won't display on the web
    const clusterText = cluster.texts.join('\n');
    const hasAdultSignals = /(?:เปลือย|naked|nude|โป้|โป๊|18\+|xxx|เสียว|หลุด|sex|ขายตัว|full\s*service|fs\b|hj\b|bj\b|cim\b|cif\b|a-level|ตัวจริง.*เต็ม|บริการ.*ครบ|ไม่สวม)/i.test(clusterText);

    const enriched = {
      ...listing,
      cluster_id: clusterId,
      sourceChannel: target.displayLabel,
      sourceTarget: target.token,
      rawText: clusterText,
      sourceMessageIds: cluster.messageIds || [],
      allPhotoUrls: photos,
      isSafeImage: !hasAdultSignals,
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

  // Media-only clusters (photo updates with no text) cannot produce their own
  // listings, but their photos are already downloaded + archived above via
  // clusterPhotos. Merge them into a text-based listing from the SAME sender
  // in this batch — that is how a parlor's gallery grows when they post new
  // staff photos without retyping the ad. Photos with no same-sender text
  // listing stay in photo_archive for later matching; no orphan listings.
  const mediaOnlyBySender = new Map();
  for (const mediaCluster of mediaOnlyClusters) {
    const clusterIdx = clusters.indexOf(mediaCluster);
    if (clusterIdx < 0) continue;
    const photos = clusterPhotos.get(clusterIdx) || [];
    if (photos.length === 0) continue;
    const senderId = mediaCluster.senderId ?? null;
    if (!mediaOnlyBySender.has(senderId)) mediaOnlyBySender.set(senderId, []);
    mediaOnlyBySender.get(senderId).push(clusterIdx);
  }
  let mergedMediaPhotoCount = 0;
  for (const listing of listingsWithPhotos) {
    const senderId = clusters[listing.cluster_id]?.senderId ?? null;
    const senderClusters = mediaOnlyBySender.get(senderId);
    if (!senderClusters || senderClusters.length === 0) continue;
    const extra = [...new Set(senderClusters.flatMap((idx) => clusterPhotos.get(idx) || []))]
      .filter((url) => !(listing.allPhotoUrls || []).includes(url));
    if (extra.length === 0) continue;
    listing.allPhotoUrls = [...(listing.allPhotoUrls || []), ...extra];
    if (!listing.imageUrl) {
      listing.imageUrl = extra[0];
    }
    mergedMediaPhotoCount += extra.length;
    // Consume so a second same-sender listing does not duplicate them.
    mediaOnlyBySender.set(senderId, []);
  }
  const archiveOnlyMediaCount = [...mediaOnlyBySender.values()].reduce((n, arr) => n + arr.length, 0);
  if (mergedMediaPhotoCount > 0 || archiveOnlyMediaCount > 0) {
    console.log(`${target.displayLabel}: media-only photos merged into listings: ${mergedMediaPhotoCount}, archive-only clusters: ${archiveOnlyMediaCount}.`);
  }

  const normalizedListings = normalizeExtractedListings(listingsWithPhotos, {
    source: 'snapshot',
  });
  console.log(`${target.displayLabel}: normalized ${normalizedListings.length} unique listing(s).`);

  if (normalizedListings.length === 0) {
    commitHighWaterMark();
    return {
      sourceLabel: target.displayLabel,
      fetchedMessages: messages.length,
      listings: [],
    };
  }

  const listingsWithImages = attachImages(normalizedListings);
  const matchedPhotoCount = listingsWithImages.filter(
    (listing) => listing.imageUrl && !listing.imageUrl.startsWith('/mockups/'),
  ).length;
  const noPublicPhotoCount = listingsWithImages.length - matchedPhotoCount;
  console.log(
    `${target.displayLabel}: photo matching summary. Cluster-matched: ${matchedPhotoCount}, no public photo: ${noPublicPhotoCount}.`,
  );

  // Archive ALL raw messages to channel_messages table for BI
  if (supabase) {
    const allRawMessages = clusters.flatMap((c) => c.rawMessages || []);
    if (allRawMessages.length > 0) {
      const channelId = target.token;
      const channelName = target.displayLabel;
      const archived = await archiveChannelMessages(supabase, allRawMessages, channelId, channelName);
      if (archived > 0) {
        console.log(`${target.displayLabel}: archived ${archived} raw message(s) to channel_messages.`);
      }
    }
  }

  // Processing succeeded end-to-end — now it is safe to advance the mark.
  commitHighWaterMark();

  return {
    sourceLabel: target.displayLabel,
    fetchedMessages: messages.length,
    listings: listingsWithImages,
  };
}

// Bounded fan-out: channels are independent, but the Telegram session and
// the Gemini budget are shared. Cap concurrency so we go faster than serial
// without flooding the session or bursting the AI rate limit.
const channelConcurrency = Math.max(1, Number.parseInt(process.env.CHANNEL_CONCURRENCY || '3', 10));
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await fn(items[index]);
      } catch (error) {
        console.error(`Error extracting from ${items[index]?.displayLabel || '?'}:`, error.message);
        results[index] = { sourceLabel: items[index]?.displayLabel || '?', fetchedMessages: 0, listings: [] };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function runTelegramScrape(client, targets, state = {}) {
  resetAiCycleBudget();
  const channelResults = await mapWithConcurrency(
    targets,
    channelConcurrency,
    (target) => extractListingsFromTarget(client, target, state),
  );

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

  // Keep the previous snapshot's listings for every channel we are configured
  // to watch, keyed by the stable target token rather than the display label.
  // A dialog channel's label is its Telegram title, so a rename, or a channel
  // that simply failed to resolve on this run, used to orphan and silently drop
  // every listing it had ever produced from the next snapshot write.
  const configuredTokens = new Set(configuredTargetTokens);
  const resolvedLabels = new Set(targets.map((target) => target.displayLabel));
  const existingSnapshot = readSnapshotListings();
  const curatedExistingSnapshot = existingSnapshot.filter(
    (listing) => configuredTokens.has(listing?.sourceTarget) || resolvedLabels.has(listing?.sourceChannel),
  );
  const droppedFromSnapshot = existingSnapshot.length - curatedExistingSnapshot.length;
  if (droppedFromSnapshot > 0) {
    console.warn(
      `Snapshot merge: dropping ${droppedFromSnapshot} listing(s) whose source channel is no longer configured.`,
    );
  }

  const mergedSnapshot = mergeSnapshotListings(listingsWithImages, curatedExistingSnapshot, {
    limit: snapshotLimit,
  });
  const wroteSnapshot = writeSnapshotListings(mergedSnapshot);

  let firestoreSynced = 0;
  try {
    firestoreSynced = await syncListingsToFirestore(mergedSnapshot);
    console.log(`Firestore sync complete. Synced: ${firestoreSynced}`);
  } catch (error) {
    console.error(`Firestore sync failed: ${error.message}`);
  }

  let inserted = 0;
  let skipped = 0;

  let newListings = [];
  if (supabase) {
    const syncResult = await insertListingsIfPossible(supabase, listingsWithImages);
    inserted = syncResult.inserted;
    skipped = syncResult.skipped;
    newListings = syncResult.newListings || [];
    const rejectedCount = syncResult.rejected || 0;
    console.log(`Supabase sync complete. Inserted: ${inserted}, skipped: ${skipped}, rejected: ${rejectedCount}`);
  } else {
    skipped = listingsWithImages.length;
    console.log('Supabase service role key not configured. Snapshot-only mode complete.');
  }

  // Only push notifications for genuinely NEW listings (not updates to existing ones)
  if (newListings.length > 0) {
    try {
      await notifyListings(newListings);
    } catch (err) {
      console.warn('Telegram notification failed (non-fatal):', err.message);
    }
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
    firestoreSynced,
  };
}

const STATE_FILE = path.join(__dirname, '../.sabai-scraper-state.json');

function loadPersistedState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log(`Loaded persisted state: ${Object.keys(data.lastSeenMessageIds || {}).length} channel(s) tracked.`);
      return data;
    }
  } catch {
    console.warn('Could not load persisted state, starting fresh.');
  }
  return null;
}

function savePersistedState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      lastSeenMessageIds: state.lastSeenMessageIds,
      // Intake gaps must survive restarts or unrecovered ranges go silent.
      intakeGaps: state.intakeGaps || {},
    }, null, 2));
  } catch {
    // Non-critical — state will rebuild on next cycle
  }
}

const cycleTimeoutMs = Math.max(60_000, Number.parseInt(process.env.INTAKE_CYCLE_TIMEOUT_MS || '600000', 10));

async function main() {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  const persisted = loadPersistedState();
  const state = {
    lastSeenMessageIds: persisted?.lastSeenMessageIds || {},
    intakeGaps: persisted?.intakeGaps || {},
    shouldStop: false,
  };
  globalScraperState = state;
  const pendingGaps = Object.keys(state.intakeGaps || {}).length;
  if (pendingGaps > 0) {
    console.warn(`Resumed with ${pendingGaps} unrecovered intake gap(s). Run scripts/backfill_history.js to recover them.`);
  }

  process.on('SIGINT', () => {
    state.shouldStop = true;
    savePersistedState(state);
  });

  process.on('SIGTERM', () => {
    state.shouldStop = true;
    savePersistedState(state);
  });

  // Startup is the flakiest phase (Telegram "internal issues" on getDialogs).
  // Retry with backoff instead of dying on the first attempt — but exit
  // non-zero if it never succeeds so the daemon restarts us cleanly.
  const maxStartupAttempts = Math.max(1, Number.parseInt(process.env.STARTUP_ATTEMPTS || '6', 10));
  let resolvedTargets = [];
  for (let attempt = 1; attempt <= maxStartupAttempts; attempt += 1) {
    try {
      await client.connect();
      resolvedTargets = await resolveSourceTargets(client);
      if (resolvedTargets.length === 0) {
        throw new Error('No Telegram source targets could be resolved. Check TELEGRAM_SOURCE_TARGETS.');
      }
      break;
    } catch (error) {
      console.error(`Startup attempt ${attempt}/${maxStartupAttempts} failed: ${error.message}`);
      try {
        await client.disconnect();
      } catch {
        /* noop */
      }
      if (attempt >= maxStartupAttempts) {
        console.error('Startup failed after all attempts. Exiting for daemon restart.');
        process.exit(1);
      }
      await delay(20_000);
    }
  }

  console.log(
    `Starting Telegram scraper for ${resolvedTargets.map((target) => target.displayLabel).join(', ')}${watchMode ? ` in watch mode (${pollIntervalMs}ms)` : '...'}`,
  );

  try {
    do {
      const startedAt = Date.now();

      try {
        await refreshSupabaseAvailability();
        const result = await withCycleTimeout(
          runTelegramScrape(client, resolvedTargets, state),
          cycleTimeoutMs,
        );
        savePersistedState(state);
        console.log(
          `Scrape cycle complete. Extracted: ${result.extractedListings}, snapshot size: ${result.snapshotCount}.`,
        );
      } catch (error) {
        if (error instanceof CycleTimeoutError) {
          console.error(`${error.message}; exiting so the daemon restarts a fresh Telegram session.`);
          savePersistedState(state);
          process.exit(1);
        }
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

// Import-safe: unit tests and one-off scripts import helpers (e.g.
// generateLocalEnrichment) from this module. Only auto-run the intake loop
// when executed directly — importing must never open a second Telegram
// session (that triggers AUTH_KEY_DUPLICATED against the running scraper).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
