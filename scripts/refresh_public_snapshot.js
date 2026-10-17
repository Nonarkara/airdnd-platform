import fs from 'fs';
import path from 'path';
import { createDataClient, closeDataClient } from './lib/local_db.js';
import { rewriteMediaUrl } from '../src/lib/media.js';
import dotenv from 'dotenv';
import { canonicalizePublicListings, validatePublicListing } from '../src/lib/listing_contract.js';

dotenv.config();

const PHOTOS_PER_LISTING = Number(process.env.SNAPSHOT_PHOTOS_PER_LISTING || 12);

let rawData = [];
try {
  const db = createDataClient();
  const { data, error } = await db
    .from('companions')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  rawData = data || [];
  console.log(`Pulled ${rawData.length} companions from local Postgres`);
} catch (dbErr) {
  console.error(`Could not refresh snapshot from local Postgres: ${dbErr.message}`);
  process.exit(1);
} finally {
  await closeDataClient();
}

// Bridge until the Telegram intake runs on the M3: the old cloud worker still
// writes fresh posts to Firestore (not to Postgres). Merge only the Firestore
// docs posted after the newest Postgres row, so the snapshot is never staler
// than the intake. Disable with SNAPSHOT_FIRESTORE_DELTA=0.
if (process.env.SNAPSHOT_FIRESTORE_DELTA !== '0') {
  const latestPg = rawData.reduce((max, row) => {
    const t = Date.parse(row.updated_at || row.created_at || 0);
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);
  try {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
    const app = initializeApp({
      projectId: 'sub-i-platform-v3',
      appId: '1:190320143184:web:3ee20b36c95e0e856f5a55',
      apiKey: 'AIzaSyDeleUD1kuPIY4ibNhHMOHQ08QhLGnp7NI',
      authDomain: 'sub-i-platform-v3.firebaseapp.com',
    });
    const since = new Date(latestPg || 0).toISOString();
    const snap = await getDocs(query(collection(getFirestore(app), 'companions'), where('postedAt', '>', since)));
    const fresh = snap.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id }));
    console.log(`Merged ${fresh.length} Firestore doc(s) posted after ${since}`);
    rawData = [...rawData, ...fresh];
  } catch (fsErr) {
    console.warn(`Firestore delta skipped: ${fsErr.message}`);
  }
}

const publicListings = canonicalizePublicListings(rawData, { source: 'snapshot', allowUnverified: true })
  .filter((listing) => validatePublicListing(listing).ok);
console.log(`Canonicalized ${publicListings.length} unique parlour listings`);

function createImageIndex() {
  const imageRoot = path.join(process.cwd(), 'public', 'images');
  const byBasename = new Map();

  function visit(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else {
        byBasename.set(entry.name, `/${path.relative(path.join(process.cwd(), 'public'), entryPath)}`);
      }
    }
  }

  visit(imageRoot);
  return byBasename;
}

const imageIndex = createImageIndex();

function deployablePhotoUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  if (url.startsWith('/images/')) {
    return fs.existsSync(path.join(process.cwd(), 'public', url)) ? url : null;
  }

  if (url.startsWith('/photos/')) {
    return imageIndex.get(path.basename(url)) || null;
  }

  // Legacy Supabase storage URLs map 1:1 onto the airdnd-media Pages project.
  return rewriteMediaUrl(url);
}

function deployablePhotoUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }

  return [...new Set(urls.map(deployablePhotoUrl).filter(Boolean))];
}

// Per-listing credibility score (see research/findings-2026-05-02.md §5).
// Composite of mention volume, contact channel breadth, photo count,
// description quality, and recency. Range [0, 100]. Used as default sort
// on the directory and exposed on each card.
function computeCredibility(listing) {
  const mc = Number(listing.mentionCount) || 0;
  const photos = Array.isArray(listing.allPhotoUrls) ? listing.allPhotoUrls.length
    : Array.isArray(listing.photo_urls) ? listing.photo_urls.length : 0;
  const descLen = (listing.description || '').length;
  const ageDays = (Date.now() - new Date(listing.updatedAt || listing.createdAt || Date.now()).getTime()) / 86_400_000;
  const score =
    Math.min(25, Math.log2(1 + mc) * 5)
    + Math.min(12, Math.log2(1 + photos) * 3)
    + (listing.phone ? 10 : 0)
    + (listing.lineUrl ? 8 : 0)
    + (listing.mapsUrl ? 6 : 0)
    + (Number.isFinite(listing.latitude) && listing.latitude != null ? 8 : 0)
    + Math.min(12, descLen / 30)
    + Math.max(0, 12 - ageDays * 0.2);
  return Math.max(0, Math.min(100, +score.toFixed(1)));
}

function getSnapshotFreshnessValue(listing) {
  const value = listing?.postedAt || listing?.updatedAt || listing?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const slimListings = publicListings.map((listing) => ({
  id: listing.id,
  canonicalKey: listing.canonicalKey,
  name: listing.name,
  age: listing.age,
  location: listing.location,
  city: listing.city,
  priceLabel: listing.priceLabel,
  priceValue: listing.priceValue,
  description: listing.description,
  tags: listing.tags,
  metrics: listing.metrics,
  imageUrl: deployablePhotoUrl(listing.imageUrl),
  // Newest 12 per listing — matches the published snapshot shape and keeps the
  // airdnd-media Pages project far below its 20,000-file limit.
  allPhotoUrls: deployablePhotoUrls(listing.allPhotoUrls).slice(0, PHOTOS_PER_LISTING),
  drivePhotoUrls: (listing.drivePhotoUrls || []).map(rewriteMediaUrl),
  rating: listing.rating,
  reviews: listing.reviews,
  updatedAt: listing.updatedAt,
  postedAt: listing.postedAt,
  // Carried into the snapshot to power the modal "Community Signal" section:
  // first-seen timestamp + Gemini-extracted feedback + community tags.
  createdAt: listing.createdAt,
  userFeedbackSummary: listing.userFeedbackSummary,
  serviceTags: listing.serviceTags,
  sourceChannel: listing.sourceChannel,
  sourceTarget: listing.sourceTarget,
  phone: listing.phone,
  hours: listing.hours,
  lineUrl: listing.lineUrl,
  telegramUrl: listing.telegramUrl,
  mapsUrl: listing.mapsUrl,
  latitude: listing.latitude,
  longitude: listing.longitude,
  isSafeImage: listing.isSafeImage,
  mentionCount: listing.mentionCount,
  aliasNames: Array.isArray(listing.aliasNames) ? listing.aliasNames : [],
  aliasCount: listing.aliasCount || ((listing.aliasNames?.length || 0) + 1),
  credibility: computeCredibility(listing),
})).sort((left, right) => {
  const timestampDelta = getSnapshotFreshnessValue(right) - getSnapshotFreshnessValue(left);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }
  return Number(right.id || 0) - Number(left.id || 0);
});

fs.writeFileSync('public/data.json', JSON.stringify(slimListings, null, 2));
console.log(`Refreshed public/data.json with ${slimListings.length} canonical public listing(s).`);
