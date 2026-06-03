import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const dataPath = path.join(__dirname, '../public/data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  console.log(`Starting migration of ${data.length} records...`);
  
  let successCount = 0;
  for (const item of data) {
    try {
      const docId = String(item.id);
      await setDoc(doc(db, 'companions', docId), item);
      successCount++;
      if (successCount % 10 === 0) console.log(`Migrated ${successCount}/${data.length}`);
    } catch (error) {
      console.error(`Failed to migrate record ${item.id}:`, error);
    }
  }
  
  console.log(`Migration complete. Successfully uploaded ${successCount}/${data.length} records.`);
  process.exit(0);
}

migrate();
