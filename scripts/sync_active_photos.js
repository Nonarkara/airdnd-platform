import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

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

const publicDir = path.join(process.cwd(), 'public');
const imagesDir = path.join(publicDir, 'images');

if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

function processUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('/photos/')) return url; // Leave others alone
  
  const srcPath = path.join(publicDir, url.replace(/^\/+/, ''));
  const filename = path.basename(url);
  const destPath = path.join(imagesDir, filename);
  const newUrl = `/images/${filename}`;
  
  if (fs.existsSync(srcPath)) {
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
    return newUrl;
  }
  return url; // Keep original if source not found
}

async function run() {
  const snapshot = await getDocs(collection(db, 'companions'));
  let updatedCount = 0;
  
  for (const document of snapshot.docs) {
    const data = document.data();
    let changed = false;
    const updates = {};
    
    if (data.imageUrl && data.imageUrl.startsWith('/photos/')) {
      const newUrl = processUrl(data.imageUrl);
      if (newUrl !== data.imageUrl) {
        updates.imageUrl = newUrl;
        changed = true;
      }
    }
    
    if (Array.isArray(data.allPhotoUrls)) {
      const newAllPhotoUrls = data.allPhotoUrls.map(url => {
        const newUrl = processUrl(url);
        if (newUrl !== url) changed = true;
        return newUrl;
      });
      if (changed) {
        updates.allPhotoUrls = newAllPhotoUrls;
      }
    }
    
    if (changed) {
      await updateDoc(doc(db, 'companions', document.id), updates);
      updatedCount++;
    }
  }
  
  console.log(`Synced active photos to /images/. Updated ${updatedCount} Firestore documents.`);
  process.exit(0);
}

run().catch(console.error);
