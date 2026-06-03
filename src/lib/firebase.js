import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "sub-i-platform-v3",
  appId: "1:190320143184:web:3ee20b36c95e0e856f5a55",
  storageBucket: "sub-i-platform-v3.firebasestorage.app",
  apiKey: "AIzaSyDeleUD1kuPIY4ibNhHMOHQ08QhLGnp7NI",
  authDomain: "sub-i-platform-v3.firebaseapp.com",
  messagingSenderId: "190320143184"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
