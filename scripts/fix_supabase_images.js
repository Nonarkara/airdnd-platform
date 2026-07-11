import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

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

// 1. Read mockups folder to get all available mockup files
const mockupsDir = 'public/mockups';
const mockupFiles = fs.readdirSync(mockupsDir)
  .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
  .map(f => `/mockups/${f}`);

console.log(`Found ${mockupFiles.length} mockup files available.`);

// 2. Read replacements and data.json
const replacements = JSON.parse(fs.readFileSync('scripts/replacements.json', 'utf8'));
const dataPath = 'public/data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Create a map of replacements for quick lookup
const replacementMap = new Map();
for (const r of replacements) {
  replacementMap.set(r.id, r);
}

// Helper to get stable hash for a string
function getStableHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

console.log(`Starting image repair on ${data.length} listings...`);

let copiedCount = 0;
let replacedLocalCount = 0;
let fallbackMockupCount = 0;

const updatedData = [];

for (const item of data) {
  const nextItem = { ...item };
  let newImageUrl = null;
  
  if (item.imageUrl && item.imageUrl.includes('supabase.co')) {
    const r = replacementMap.get(item.id);
    if (r) {
      // We have a local match in public/photos/ or public/images/
      const oldLocalPath = r.newUrl;
      const filename = path.basename(oldLocalPath);
      const destPath = `/images/${filename}`;
      
      if (oldLocalPath.startsWith('/photos/')) {
        // Needs copy from public/photos/... to public/images/...
        const srcFullPath = path.join('public', oldLocalPath.replace(/^\//, ''));
        const destFullPath = path.join('public', 'images', filename);
        
        try {
          if (fs.existsSync(srcFullPath)) {
            fs.copyFileSync(srcFullPath, destFullPath);
            copiedCount++;
            newImageUrl = destPath;
          } else {
            console.warn(`Source file not found: ${srcFullPath}`);
          }
        } catch (err) {
          console.error(`Failed to copy ${srcFullPath} -> ${destFullPath}:`, err.message);
        }
      } else if (oldLocalPath.startsWith('/images/')) {
        // Already in public/images/
        newImageUrl = oldLocalPath;
      }
      
      if (newImageUrl) {
        replacedLocalCount++;
        console.log(`Updated ${item.name} to local photo: ${newImageUrl}`);
      }
    }
    
    if (!newImageUrl) {
      // No local match, use a stable mockup fallback
      const hash = getStableHash(String(item.id || item.name));
      const mockupFile = mockupFiles[hash % mockupFiles.length];
      newImageUrl = mockupFile;
      fallbackMockupCount++;
      console.log(`Updated ${item.name} to fallback mockup: ${newImageUrl}`);
    }
    
    // Set the new image URL
    nextItem.imageUrl = newImageUrl;
    
    // Update Firestore
    try {
      const docId = String(item.id);
      await updateDoc(doc(db, 'companions', docId), { imageUrl: newImageUrl });
      console.log(`  Uploaded new imageUrl to Firestore for ID ${docId}`);
    } catch (err) {
      console.error(`  Failed to update Firestore document ${item.id}:`, err.message);
    }
  }
  
  updatedData.push(nextItem);
}

// 3. Write updated data.json back
fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));

console.log('Fix complete!');
console.log(`- Copied ${copiedCount} files from public/photos to public/images.`);
console.log(`- Replaced ${replacedLocalCount} Supabase URLs with matched local images.`);
console.log(`- Replaced ${fallbackMockupCount} Supabase URLs with mockup fallback images.`);
process.exit(0);
