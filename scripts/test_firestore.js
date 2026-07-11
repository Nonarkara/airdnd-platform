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

async function test() {
  const snapshot = await getDocs(collection(db, 'companions'));
  console.log('Total documents in companions collection:', snapshot.size);
  if (snapshot.size > 0) {
    const sample = snapshot.docs[0].data();
    console.log('Sample document keys:', Object.keys(sample));
    console.log('Sample document name:', sample.name);
    console.log('Sample document imageUrl:', sample.imageUrl || sample.image_url);
    console.log('Sample document allPhotoUrls:', sample.allPhotoUrls);
    console.log('Sample document photo_urls:', sample.photo_urls);
  }
  process.exit(0);
}

test().catch(console.error);
