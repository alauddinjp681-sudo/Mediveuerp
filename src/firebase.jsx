import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDjmAHxhhEmIfpmMC-glskeSHNXuVXXlBU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mediveuerp.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mediveuerp',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mediveuerp.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '203997741439',
  appId: env.VITE_FIREBASE_APP_ID || '1:203997741439:web:a44659832e6a107d80da4a',
};

const app = initializeApp(firebaseConfig);

function createDb() {
  try {
    // IndexedDB cache shared across tabs: reads work offline, writes queue and sync when back online.
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('Offline cache unavailable, using memory cache:', err?.message);
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
}

export const db = createDb();
export const auth = getAuth(app);
