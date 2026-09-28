import { getApps, initializeApp } from 'firebase/app';
import { doc, getFirestore, writeBatch } from 'firebase/firestore';
import { canonicalizePublicListings } from '../src/lib/listing_contract.js';
import { getGeoIndex } from './lib/geo.js';

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
  const publicListings = canonicalizePublicListings(listings, { source: 'supabase', allowUnverified: true, geoIndex: getGeoIndex() })
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

