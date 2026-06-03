import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

// Base coordinates for common locations
const BASE_COORDS = {
  'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
  'Nonthaburi, Thailand': { lat: 13.8591, lng: 100.5217 },
  'Muang Thong, Bangkok': { lat: 13.9126, lng: 100.5401 },
  'Ramintra km 11, Bangkok': { lat: 13.8202, lng: 100.6865 },
  'บางนา อุดมสุข9': { lat: 13.6765, lng: 100.6136 },
  'โชคชัย4/ สตรีวิทยา2': { lat: 13.8116, lng: 100.6015 },
  'รามอินทรา': { lat: 13.8402, lng: 100.6365 },
  // Default to central BKK
  'DEFAULT': { lat: 13.7367, lng: 100.5231 } 
};

function getRandomJitter() {
  // Generate a random float between -0.04 and +0.04 for realistic city scattering
  return (Math.random() - 0.5) * 0.08;
}

async function enrichCoordinates() {
  console.log("Fetching companions from Firestore...");
  const snapshot = await getDocs(collection(db, 'companions'));
  const docs = snapshot.docs;
  
  console.log(`Found ${docs.length} documents. Processing...`);

  let updatedCount = 0;

  for (const document of docs) {
    const data = document.data();
    
    // Only update if missing valid coordinates
    if (!data.lat || !data.lng || data.lat === 0 || data.lng === 0) {
      const locKey = data.location || 'DEFAULT';
      
      let base = BASE_COORDS[locKey];
      if (!base) {
        base = BASE_COORDS['DEFAULT'];
      }

      const newLat = base.lat + getRandomJitter();
      const newLng = base.lng + getRandomJitter();

      try {
        await updateDoc(doc(db, 'companions', document.id), {
          lat: newLat,
          lng: newLng
        });
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`Updated ${updatedCount} documents...`);
        }
      } catch (error) {
        console.error(`Failed to update doc ${document.id}:`, error);
      }
    }
  }

  console.log(`Enrichment complete. Updated ${updatedCount} records with geocoordinates.`);
  process.exit(0);
}

enrichCoordinates();
