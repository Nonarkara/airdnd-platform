import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { canonicalizePublicListings, validatePublicListing } from '../src/lib/listing_contract.js';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';
const supabase = createClient(supabaseUrl, key, {
  auth: { persistSession: false },
});

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getGeoIndex } from './lib/geo.js';

const firebaseConfig = {
  projectId: "sub-i-platform-v3",
  appId: "1:190320143184:web:3ee20b36c95e0e856f5a55",
  storageBucket: "sub-i-platform-v3.firebasestorage.app",
  apiKey: "AIzaSyDeleUD1kuPIY4ibNhHMOHQ08QhLGnp7NI",
  authDomain: "sub-i-platform-v3.firebaseapp.com",
};

let rawData = [];

try {
  console.log('Fetching companions from Firestore...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'companions'));
  rawData = snap.docs.map(d => d.data());
  console.log(`Pulled ${rawData.length} raw docs from Firestore`);
} catch (fsErr) {
  console.warn(`Firestore pull failed (${fsErr.message}), falling back to Supabase...`);
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) {
    console.error(`Could not refresh snapshot: ${error.message}`);
    process.exit(1);
  }
  rawData = data || [];
}

const publicListings = canonicalizePublicListings(rawData, { source: 'snapshot', allowUnverified: true, geoIndex: getGeoIndex() })
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

  return url;
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
  allPhotoUrls: deployablePhotoUrls(listing.allPhotoUrls),
  drivePhotoUrls: listing.drivePhotoUrls,
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
  geoPrecision: listing.geoPrecision,
  geoRadiusKm: listing.geoRadiusKm,
  geoSource: listing.geoSource,
  geoUnit: listing.geoUnit,
  geoNote: listing.geoNote,
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
