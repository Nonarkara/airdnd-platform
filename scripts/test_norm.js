import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "sub-i-platform-v3",
  appId: "1:190320143184:web:3ee20b36c95e0e856f5a55",
  storageBucket: "sub-i-platform-v3.firebasestorage.app",
  apiKey: "AIzaSyDeleUD1kuPIY4ibNhHMOHQ08QhLGnp7NI",
  authDomain: "sub-i-platform-v3.firebaseapp.com",
  messagingSenderId: "190320143184"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const UNSAFE_VISUAL_TAGS = new Set([
  'Adult Entertainment',
  'Adult Services',
  'Erotic Massage',
  'Escort',
  'Model',
  'Young Talent',
]);

const UNSAFE_VISUAL_RE =
  /(?:adult|erotic|escort|full\s*service|xxx|porn|nude|naked|onlyfans|18\+|vip\s*group|งานแรง|งานครบ|บริการพิเศษ|เสียว|เสร[็้]จ|อม(?:ไม่)?อั้?น|อมไม|จบ\s*\d{3,5}|โป้|โป๊|กลุ่มลับ|คลิป(?:โป้|โป๊|ลับ))/i;

function hasUnsafeVisualSignal(listing) {
  const tags = [
    ...(Array.isArray(listing?.tags) ? listing.tags : []),
    ...(Array.isArray(listing?.serviceTags) ? listing.serviceTags : []),
    ...(Array.isArray(listing?.service_tags) ? listing.service_tags : []),
  ].map((tag) => String(tag).trim());

  if (tags.some((tag) => UNSAFE_VISUAL_TAGS.has(tag))) {
    return true;
  }

  const text = [
    listing?.name,
    listing?.location,
    listing?.description,
    listing?.rawText,
    listing?.raw_text,
    ...tags,
  ].filter(Boolean).join(' ');

  return UNSAFE_VISUAL_RE.test(text);
}

function getListingGalleryUrls(listing) {
  if (!listing) return [];

  const urls = [
    ...(Array.isArray(listing.allPhotoUrls) ? listing.allPhotoUrls : []),
    ...(Array.isArray(listing.photo_urls) ? listing.photo_urls : []),
    listing.imageUrl,
    listing.image_url,
  ];

  return [...new Set(
    urls
      .filter(Boolean)
      .map((url) => String(url).trim())
      .filter((url) => url && !url.startsWith('/mockups/')),
  )];
}

function isListingMediaSafe(listing) {
  return listing?.isSafeImage !== false && !hasUnsafeVisualSignal(listing);
}

async function test() {
  const snapshot = await getDocs(collection(db, 'companions'));
  const docs = snapshot.docs.map(d => d.data());
  for (const doc of docs) {
    const safe = isListingMediaSafe(doc);
    const urls = getListingGalleryUrls(doc);
    if (doc.name.includes('Malee') || doc.name.includes('กุหลาบ') || doc.name.includes('Pls') || doc.name.includes('ฟ้ารุ่งเรือง')) {
      console.log('---', doc.name);
      console.log('isSafe:', safe);
      console.log('urls:', urls);
      console.log('hasUnsafeVisualSignal:', hasUnsafeVisualSignal(doc));
    }
  }
  process.exit(0);
}

test().catch(console.error);
