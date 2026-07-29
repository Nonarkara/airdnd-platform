import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const publicDir = path.join(__dirname, '../public');
const photosBaseDir = path.join(publicDir, 'images');
const bucketName = process.env.SUPABASE_PHOTO_BUCKET || 'listing-photos';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Fail-fast fetch — see telegram_scraper.js: a stalled Supabase must never
// block photo processing (uploads simply skip while it is down).
const configuredSupabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        global: {
          fetch: (url, opts = {}) =>
            fetch(url, { ...opts, signal: AbortSignal.timeout(8_000) }),
        },
      })
    : null;
let supabase = configuredSupabase;

let bucketReady = false;

export function setPhotoStorageSupabaseEnabled(enabled) {
  supabase = enabled ? configuredSupabase : null;
  if (!enabled) {
    bucketReady = false;
  }
}

function sanitizeFilename(filename) {
  return String(filename || 'photo.jpg')
    .replace(/[^a-zA-Z0-9._\-\u0E00-\u0E7F]/g, '_')
    .replace(/_+/g, '_');
}

function sanitizeChannelName(channel) {
  return String(channel || 'unknown')
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_\-\u0E00-\u0E7F]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
}

function getDateFolder() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Extract original filename from a Telegram message's media.
 * Documents (files sent as attachments) preserve original filenames.
 * Photos (compressed Telegram photos) don't have filenames — returns null.
 */
export function extractOriginalFilename(msg) {
  const doc = msg?.media?.document;
  if (!doc) return null;

  const attrs = doc.attributes || [];
  const fnAttr = attrs.find((a) => a.className === 'DocumentAttributeFilename');
  return fnAttr?.fileName || null;
}

/**
 * Build a structured filename that preserves intelligence about the source.
 * Format: {channel}_{msgId}_{originalFilename_or_photoId}.{ext}
 */
export function buildStoredFilename(msg, channelName, originalFilename) {
  const channelSlug = sanitizeChannelName(channelName);
  const msgId = msg?.id || Date.now();

  if (originalFilename) {
    // Preserve the original filename but prefix with channel + msgId for uniqueness
    const safeName = sanitizeFilename(originalFilename);
    return `${channelSlug}_${msgId}_${safeName}`;
  }

  // For Telegram photo objects, use the photo ID as fingerprint
  const photoId = msg?.media?.photo?.id;
  if (photoId) {
    return `${channelSlug}_${msgId}_photo${photoId}.jpg`;
  }

  return `${channelSlug}_${msgId}_${Date.now()}.jpg`;
}

/**
 * Ensure a channel/date subfolder exists under public/images/.
 * Returns the full directory path.
 * Structure: photos/{channel}/{YYYY-MM-DD}/
 */
export function ensureChannelPhotosDir(channelName) {
  const channelSlug = sanitizeChannelName(channelName);
  const dateFolder = getDateFolder();
  const dir = path.join(photosBaseDir, channelSlug, dateFolder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function isLocalPhotoUrl(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/images/');
}

export function resolveLocalPhotoPath(imageUrl) {
  if (!isLocalPhotoUrl(imageUrl)) {
    return null;
  }
  return path.join(publicDir, imageUrl.replace(/^\/+/, ''));
}

async function ensureBucket() {
  if (!supabase) return false;
  if (bucketReady) return true;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.warn('Failed to list Supabase storage buckets:', listError.message);
    return false;
  }

  const hasBucket = Array.isArray(buckets) && buckets.some((bucket) => bucket.name === bucketName);
  if (!hasBucket) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
    if (createError && !createError.message?.toLowerCase().includes('already')) {
      console.warn(`Failed to create Supabase storage bucket "${bucketName}":`, createError.message);
      return false;
    }
  }

  bucketReady = true;
  return true;
}

/**
 * Upload a photo buffer to Supabase storage with structured path.
 * Storage path: telegram/{channel}/{YYYY-MM-DD}/{stored_filename}
 */
export async function uploadPhotoBuffer(buffer, storedFilename, channelName) {
  if (!supabase || !buffer || buffer.length === 0) return null;

  const ready = await ensureBucket();
  if (!ready) return null;

  const channelSlug = sanitizeChannelName(channelName || 'unknown');
  const dateFolder = getDateFolder();
  const safeFilename = sanitizeFilename(storedFilename);
  const storagePath = `telegram/${channelSlug}/${dateFolder}/${safeFilename}`;

  const { error } = await supabase.storage.from(bucketName).upload(storagePath, buffer, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error && !error.message?.toLowerCase().includes('already')) {
    console.warn(`Failed to upload ${safeFilename} to Supabase storage:`, error.message);
    return null;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/**
 * Save a photo buffer locally with structured path.
 * Local path: public/images/{channel}/{YYYY-MM-DD}/{stored_filename}
 * Returns the URL path relative to public/ (e.g., /photos/channel/2026-03-30/file.jpg)
 */
export function savePhotoLocally(buffer, storedFilename, channelName) {
  const dir = ensureChannelPhotosDir(channelName);
  const safeFilename = sanitizeFilename(storedFilename);
  const filepath = path.join(dir, safeFilename);
  fs.writeFileSync(filepath, buffer);

  // Return URL relative to public/
  const relativePath = path.relative(publicDir, filepath);
  return `/${relativePath}`;
}

/**
 * Download a photo from a Telegram message, save locally + upload to Supabase.
 * Preserves original filename when available.
 * Returns { localUrl, supabaseUrl, storedFilename, originalFilename, fileSize }
 */
export async function downloadAndStorePhoto(client, msg, channelName) {
  try {
    const buffer = await client.downloadMedia(msg, {});
    if (!buffer || buffer.length === 0) return null;

    const originalFilename = extractOriginalFilename(msg);
    const storedFilename = buildStoredFilename(msg, channelName, originalFilename);

    // Save locally (always — this is the primary archive)
    const localUrl = savePhotoLocally(buffer, storedFilename, channelName);

    // Upload to Supabase storage (cloud backup)
    const supabaseUrl = await uploadPhotoBuffer(buffer, storedFilename, channelName);

    return {
      localUrl,
      supabaseUrl,
      storedFilename,
      originalFilename,
      fileSize: buffer.length,
      photoTelegramId: msg?.media?.photo?.id ? String(msg.media.photo.id) : null,
      mediaType: msg?.media?.document ? 'document' : 'photo',
      mimeType: msg?.media?.document?.mimeType || 'image/jpeg',
    };
  } catch (err) {
    console.warn(`Failed to download photo from message ${msg?.id}:`, err.message);
    return null;
  }
}

/**
 * Archive photo metadata to the photo_archive table in Supabase.
 */
export async function archivePhotoMetadata(photoInfo, msg, channelId, channelName) {
  if (!supabase || !photoInfo) return;

  try {
    const { error } = await supabase.from('photo_archive').upsert({
      telegram_message_id: Number(msg?.id) || 0,
      channel_id: String(channelId),
      channel_name: channelName,
      sender_id: msg?.fromId ? String(msg.fromId.userId || msg.fromId.channelId || msg.fromId) : null,
      message_date: msg?.date ? new Date(msg.date * 1000).toISOString() : null,
      original_filename: photoInfo.originalFilename,
      stored_filename: photoInfo.storedFilename,
      local_path: photoInfo.localUrl,
      supabase_url: photoInfo.supabaseUrl,
      file_size_bytes: photoInfo.fileSize,
      media_type: photoInfo.mediaType,
      mime_type: photoInfo.mimeType,
      photo_telegram_id: photoInfo.photoTelegramId,
      grouped_id: msg?.groupedId ? String(msg.groupedId) : null,
    }, {
      onConflict: 'channel_id,telegram_message_id,stored_filename',
      ignoreDuplicates: true,
    });

    if (error && !error.message?.includes('photo_archive')) {
      console.warn(`Photo archive error: ${error.message}`);
    }
  } catch {
    // Table might not exist yet — skip gracefully
  }
}

export async function uploadLocalPhotoToStorage(imageUrl) {
  const localPath = resolveLocalPhotoPath(imageUrl);
  if (!localPath || !fs.existsSync(localPath)) return null;

  const buffer = fs.readFileSync(localPath);
  return uploadPhotoBuffer(buffer, path.basename(localPath));
}

export function ensureLocalPhotosDir() {
  if (!fs.existsSync(photosBaseDir)) {
    fs.mkdirSync(photosBaseDir, { recursive: true });
  }
  return photosBaseDir;
}
