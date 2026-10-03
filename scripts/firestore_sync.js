/**
 * Firestore is what the live site reads. syncListingsToFirestore is called by
 * the scraper every cycle. Run directly, this file re-points photo links:
 *
 *   node scripts/firestore_sync.js           # report: links still on Supabase
 *   node scripts/firestore_sync.js --apply   # rewrite them to published copies
 *
 * The scraper only re-syncs the listings in its snapshot; this reaches every
 * document, and changes nothing but imageUrl / allPhotoUrls.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';
import { applyPhotoMap, canonicalizePublicListings } from '../src/lib/listing_contract.js';
import { isListingMediaSafe } from '../src/lib/listings.js';
import { categorizeListing } from '../src/lib/taxonomy.js';
import { getGeoIndex } from './lib/geo.js';
import { getPhotoMap } from './lib/photo_map.js';

const FIREBASE_CONFIG = {
  projectId: 'sub-i-platform-v3',
  appId: '1:190320143184:web:3ee20b36c95e0e856f5a55',
  storageBucket: 'sub-i-platform-v3.firebasestorage.app',
  apiKey: 'AIzaSyDeleUD1kuPIY4ibNhHMOHQ08QhLGnp7NI',
  authDomain: 'sub-i-platform-v3.firebaseapp.com',
  messagingSenderId: '190320143184',
};

const app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, stripUndefined(nestedValue)]),
    );
  }

  return value;
}

function getDocumentId(listing) {
  const identity = listing.id ?? listing.canonicalKey;
  return identity == null ? null : encodeURIComponent(String(identity));
}

export async function syncListingsToFirestore(listings) {
  const publicListings = canonicalizePublicListings(listings, { source: 'supabase', allowUnverified: true, geoIndex: getGeoIndex(), photoMap: getPhotoMap() })
    // Categorised here, on the Mac, after placement (a shop's format depends
    // on whether it can be placed) — so every reader of Firestore gets them.
    .map((listing) => ({ ...listing, category: categorizeListing(listing) }))
    .map(stripUndefined)
    .filter((listing) => getDocumentId(listing));

  let synced = 0;
  for (let offset = 0; offset < publicListings.length; offset += 400) {
    const batch = writeBatch(db);
    const chunk = publicListings.slice(offset, offset + 400);

    chunk.forEach((listing) => {
      batch.set(doc(db, 'companions', getDocumentId(listing)), listing, { merge: true });
    });

    await batch.commit();
    synced += chunk.length;
  }

  return synced;
}

export async function syncFeedToFirestore(feedCards) {
  if (!Array.isArray(feedCards) || feedCards.length === 0) return 0;
  const cleaned = feedCards.slice(0, 400).map(stripUndefined);
  let synced = 0;
  for (let offset = 0; offset < cleaned.length; offset += 400) {
    const batch = writeBatch(db);
    const chunk = cleaned.slice(offset, offset + 400);
    chunk.forEach((card) => {
      const docId = encodeURIComponent(String(card.id));
      batch.set(doc(db, 'feed_activity', docId), card, { merge: true });
    });
    await batch.commit();
    synced += chunk.length;
  }
  return synced;
}


const SUPABASE_STORAGE = /supabase\.co\/storage\//;

function countStorageLinks(listing) {
  const urls = [listing.imageUrl, ...(Array.isArray(listing.allPhotoUrls) ? listing.allPhotoUrls : [])];
  return urls.filter((url) => typeof url === 'string' && SUPABASE_STORAGE.test(url)).length;
}

/**
 * docs: [{ id, data }] as read from the companions collection.
 * Returns the photo-field updates the published-photo map implies, and how
 * many links would still depend on the Supabase bucket afterwards.
 */
export function planPhotoRelink(docs, photoMap) {
  const updates = [];
  let before = 0;
  let after = 0;
  let hidden = 0;
  for (const { id, data } of docs) {
    before += countStorageLinks(data);
    const next = photoMap ? applyPhotoMap(data, photoMap) : data;
    // A screened-out listing's photos are never shown, so its leftover links
    // cannot blank anything on the site.
    if (isListingMediaSafe(next)) after += countStorageLinks(next);
    else hidden += countStorageLinks(next);
    const changed = next.imageUrl !== data.imageUrl
      || JSON.stringify(next.allPhotoUrls || []) !== JSON.stringify(data.allPhotoUrls || []);
    if (changed) {
      updates.push({ id, fields: stripUndefined({ imageUrl: next.imageUrl ?? null, allPhotoUrls: next.allPhotoUrls }) });
    }
  }
  return { updates, stats: { documents: docs.length, supabaseLinksBefore: before, supabaseLinksAfter: after, hiddenLinksAfter: hidden, documentsChanged: updates.length } };
}

async function relinkPhotos({ apply }) {
  const photoMap = getPhotoMap();
  if (!photoMap) {
    console.log('No data/photo_map.json yet — run scripts/publish_photos.js --upload first.');
  }
  const snap = await getDocs(collection(db, 'companions'));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const { updates, stats } = planPhotoRelink(docs, photoMap);
  console.log(`documents ${stats.documents} · photo links on Supabase now ${stats.supabaseLinksBefore} · after re-pointing ${stats.supabaseLinksAfter} shown + ${stats.hiddenLinksAfter} on screened-out listings (never shown) · documents to update ${stats.documentsChanged}`);
  if (!apply) {
    console.log('Dry run — nothing written. Add --apply to write.');
    return stats;
  }
  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = writeBatch(db);
    for (const { id, fields } of updates.slice(offset, offset + 400)) batch.update(doc(db, 'companions', id), fields);
    await batch.commit();
    console.log(`updated ${Math.min(offset + 400, updates.length)}/${updates.length}`);
  }
  console.log(stats.supabaseLinksAfter === 0
    ? 'SAFE — no photo shown on the site depends on Supabase any more.'
    : `NOT YET SAFE — ${stats.supabaseLinksAfter} shown photo links still point at Supabase: pictures missing from the archive folders given to publish_photos.js, or on no listing in the database.`);
  return stats;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  relinkPhotos({ apply: process.argv.includes('--apply') })
    .then(() => process.exit(0))
    .catch((error) => { console.error(error.message); process.exit(1); });
}
