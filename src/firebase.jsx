import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const env = import.meta.env;
const firebaseEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];
const configuredFirebaseKeys = firebaseEnvKeys.filter((key) => String(env[key] || '').trim());
const missingFirebaseKeys = firebaseEnvKeys.filter((key) => !String(env[key] || '').trim());
export const firebaseConfigError = configuredFirebaseKeys.length > 0 && missingFirebaseKeys.length > 0
  ? `Firebase configuration is incomplete. Add all VITE_FIREBASE_* variables: ${missingFirebaseKeys.join(', ')}.`
  : null;

const firebaseConfig = configuredFirebaseKeys.length === firebaseEnvKeys.length
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY.trim(),
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN.trim(),
      projectId: env.VITE_FIREBASE_PROJECT_ID.trim(),
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET.trim(),
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID.trim(),
      appId: env.VITE_FIREBASE_APP_ID.trim(),
    }
  : {
      apiKey: 'AIzaSyDjmAHxhhEmIfpmMC-glskeSHNXuVXXlBU',
      authDomain: 'mediveuerp.firebaseapp.com',
      projectId: 'mediveuerp',
      storageBucket: 'mediveuerp.firebasestorage.app',
      messagingSenderId: '203997741439',
      appId: '1:203997741439:web:a44659832e6a107d80da4a',
    };

const app = initializeApp(firebaseConfig);

function createDb() {
  try {
    // IndexedDB cache shared across tabs: reads work offline, writes queue and sync when back online.
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('Offline cache unavailable; using the existing Firestore instance:', err?.message);
    try {
      return getFirestore(app);
    } catch {
      return initializeFirestore(app, { localCache: memoryLocalCache() });
    }
  }
}

export const db = createDb();
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-south1');
