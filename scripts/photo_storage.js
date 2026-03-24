import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const publicDir = path.join(__dirname, '../public');
const photosDir = path.join(publicDir, 'photos');
const bucketName = process.env.SUPABASE_PHOTO_BUCKET || 'listing-photos';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

let bucketReady = false;

function sanitizeFilename(filename) {
  return String(filename || 'photo.jpg')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

export function isLocalPhotoUrl(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/photos/');
}

export function resolveLocalPhotoPath(imageUrl) {
  if (!isLocalPhotoUrl(imageUrl)) {
    return null;
  }

  return path.join(publicDir, imageUrl.replace(/^\/+/, ''));
}

async function ensureBucket() {
  if (!supabase) {
    return false;
  }

  if (bucketReady) {
    return true;
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.warn('Failed to list Supabase storage buckets:', listError.message);
    return false;
  }

  const hasBucket = Array.isArray(buckets) && buckets.some((bucket) => bucket.name === bucketName);
  if (!hasBucket) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
    });

    if (createError && !createError.message?.toLowerCase().includes('already')) {
      console.warn(`Failed to create Supabase storage bucket "${bucketName}":`, createError.message);
      return false;
    }
  }

  bucketReady = true;
  return true;
}

export async function uploadPhotoBuffer(buffer, filename) {
  if (!supabase || !buffer || buffer.length === 0) {
    return null;
  }

  const ready = await ensureBucket();
  if (!ready) {
    return null;
  }

  const safeFilename = sanitizeFilename(filename);
  const storagePath = `telegram/${safeFilename}`;
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

export async function uploadLocalPhotoToStorage(imageUrl) {
  const localPath = resolveLocalPhotoPath(imageUrl);
  if (!localPath || !fs.existsSync(localPath)) {
    return null;
  }

  const buffer = fs.readFileSync(localPath);
  return uploadPhotoBuffer(buffer, path.basename(localPath));
}

export function ensureLocalPhotosDir() {
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  return photosDir;
}
