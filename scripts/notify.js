import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openOptionalDataClient } from './lib/data_store.js';
import dotenv from 'dotenv';
import { reportCapability } from './capability_report.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Opened on first use, from the same store the collector writes to.
let storePromise = null;
const getStore = () => (storePromise ||= openOptionalDataClient('notify').catch(() => null));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NOTIFY_CHAT_ID = process.env.TELEGRAM_NOTIFY_CHAT_ID;

// Announced at import, not per send: the scraper calls this every cycle and a
// per-call notice would bury itself.
reportCapability('telegram-notify', {
  enabled: Boolean(BOT_TOKEN),
  reason: 'TELEGRAM_BOT_TOKEN missing from .env',
  remedy: 'set TELEGRAM_BOT_TOKEN; the chat id is auto-discovered on first run',
});
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const publicDir = path.join(__dirname, '../public');

// Rate limiting: max 20 messages per minute to Telegram
const SEND_DELAY_MS = 3000;
let lastNotifyChatId = NOTIFY_CHAT_ID || null;

/**
 * Auto-discover the owner's chat ID by checking bot updates.
 * Called once on startup if TELEGRAM_NOTIFY_CHAT_ID is not set.
 */
async function discoverChatId() {
  if (lastNotifyChatId) return lastNotifyChatId;
  if (!BOT_TOKEN) return null;

  try {
    const resp = await fetch(`${BASE_URL}/getUpdates?limit=10`);
    const data = await resp.json();
    if (!data.ok || !data.result?.length) return null;

    // Find the first private chat message (your /start or any DM)
    for (const update of data.result) {
      const chat = update.message?.chat;
      if (chat?.type === 'private') {
        lastNotifyChatId = String(chat.id);
        console.log(`Notification target discovered: ${chat.first_name} (${lastNotifyChatId})`);
        return lastNotifyChatId;
      }
    }

    // Fall back to any chat (group where bot was added)
    const firstChat = data.result[0]?.message?.chat;
    if (firstChat) {
      lastNotifyChatId = String(firstChat.id);
      console.log(`Notification target (group): ${firstChat.title || firstChat.id}`);
      return lastNotifyChatId;
    }
  } catch {
    // Silently fail — notifications are non-critical
  }
  return null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a text message via the bot.
 */
async function sendMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId) return;

  await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}

/**
 * Send a photo with caption via the bot.
 */
async function sendPhoto(chatId, photoPath, caption) {
  if (!BOT_TOKEN || !chatId) return;

  // Try local file first
  const localPath = photoPath.startsWith('/')
    ? path.join(publicDir, photoPath.replace(/^\/+/, ''))
    : null;

  if (localPath && fs.existsSync(localPath)) {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('photo', new Blob([fs.readFileSync(localPath)]), path.basename(localPath));

    await fetch(`${BASE_URL}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    return;
  }

  // Try as URL (Supabase storage URL)
  if (photoPath.startsWith('http')) {
    await fetch(`${BASE_URL}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoPath,
        caption,
        parse_mode: 'HTML',
      }),
    });
    return;
  }

  // No photo available — send text only
  await sendMessage(chatId, caption);
}

/**
 * Format a listing as a Telegram notification message.
 */
function formatListingMessage(listing) {
  const parts = [];
  parts.push(`<b>${listing.name || 'New Listing'}</b>`);

  if (listing.sourceChannel) parts.push(`📡 ${listing.sourceChannel}`);
  if (listing.location) parts.push(`📍 ${listing.location}`);
  if (listing.priceLabel && listing.priceLabel !== 'Rate on request') parts.push(`💰 ${listing.priceLabel}`);
  if (listing.phone) parts.push(`📞 ${listing.phone}`);
  if (listing.hours) parts.push(`🕐 ${listing.hours}`);

  const tags = (listing.tags || []).slice(0, 3);
  if (tags.length > 0) parts.push(`🏷 ${tags.join(', ')}`);

  if (listing.description) {
    const desc = listing.description.slice(0, 200);
    parts.push(`\n${desc}${listing.description.length > 200 ? '...' : ''}`);
  }

  // Links
  const links = [];
  if (listing.lineUrl) links.push(`<a href="${listing.lineUrl}">LINE</a>`);
  if (listing.telegramUrl) links.push(`<a href="${listing.telegramUrl}">Telegram</a>`);
  if (listing.mapsUrl) links.push(`<a href="${listing.mapsUrl}">Maps</a>`);
  if (links.length > 0) parts.push(links.join(' | '));

  return parts.join('\n');
}

/**
 * Push all processed listings to your Telegram as notifications.
 * Each listing gets a photo (if available) + formatted caption.
 */
export async function notifyListings(listings) {
  if (!BOT_TOKEN || !Array.isArray(listings) || listings.length === 0) return;

  const chatId = await discoverChatId();
  if (!chatId) {
    console.log('Telegram notifications: no chat ID. Send /start to @AirDnDProBot to enable.');
    return;
  }

  let sent = 0;
  for (const listing of listings) {
    try {
      const caption = formatListingMessage(listing);
      const photoUrl = listing.imageUrl && !listing.imageUrl.startsWith('/mockups/')
        ? listing.imageUrl
        : null;

      if (photoUrl) {
        await sendPhoto(chatId, photoUrl, caption);
      } else {
        await sendMessage(chatId, caption);
      }

      sent++;
      // Rate limit to avoid Telegram API throttling
      if (sent < listings.length) {
        await delay(SEND_DELAY_MS);
      }
    } catch (err) {
      console.warn(`Failed to notify listing "${listing.name}":`, err.message);
    }
  }

  if (sent > 0) {
    console.log(`Pushed ${sent} listing notification(s) to Telegram.`);
  }
}

/**
 * Query recent demand signals and push a digest to Telegram.
 * Designed to run every 15 minutes via cron or the scraper loop.
 */
export async function notifyDemandSignals(sinceMinutes = 15) {
  if (!BOT_TOKEN) return;
  const supabase = await getStore();
  if (!supabase) return;

  const chatId = await discoverChatId();
  if (!chatId) return;

  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

  // Fetch recent signals joined with listing names
  const { data: signals, error } = await supabase
    .from('signals')
    .select('listing_id, signal_type, payload, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error || !signals || signals.length === 0) return;

  // Group by listing
  const byListing = {};
  for (const sig of signals) {
    const lid = sig.listing_id || 'unknown';
    if (!byListing[lid]) byListing[lid] = { saves: 0, inquiries: [], shares: 0 };
    if (sig.signal_type === 'save') byListing[lid].saves++;
    if (sig.signal_type === 'share') byListing[lid].shares++;
    if (sig.signal_type === 'inquire') byListing[lid].inquiries.push(sig.payload?.contact || '(no contact)');
  }

  // Fetch listing names for all listing IDs
  const listingIds = Object.keys(byListing).filter(k => k !== 'unknown').map(Number);
  let nameMap = {};
  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('companions')
      .select('id, name')
      .in('id', listingIds);
    if (listings) {
      nameMap = Object.fromEntries(listings.map(l => [l.id, l.name]));
    }
  }

  // Build digest message
  const lines = ['<b>📊 Demand Signal Digest</b>', ''];
  let hasContent = false;

  for (const [lid, counts] of Object.entries(byListing)) {
    const name = nameMap[lid] || `Listing #${lid}`;
    const parts = [];
    if (counts.saves > 0) parts.push(`${counts.saves} save${counts.saves > 1 ? 's' : ''}`);
    if (counts.shares > 0) parts.push(`${counts.shares} share${counts.shares > 1 ? 's' : ''}`);
    if (counts.inquiries.length > 0) parts.push(`${counts.inquiries.length} inquir${counts.inquiries.length > 1 ? 'ies' : 'y'}`);

    if (parts.length > 0) {
      lines.push(`<b>${name}</b>: ${parts.join(', ')}`);
      hasContent = true;
    }

    // Surface inquiry contacts directly — this is the actionable data
    for (const contact of counts.inquiries) {
      lines.push(`  → Contact: <code>${contact}</code>`);
    }
  }

  if (!hasContent) return;

  lines.push('');
  lines.push(`<i>${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })} ICT</i>`);

  await sendMessage(chatId, lines.join('\n'));
  console.log(`[DEMAND] Pushed signal digest: ${signals.length} signal(s) across ${Object.keys(byListing).length} listing(s).`);
}
