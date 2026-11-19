import crypto from 'node:crypto';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import Razorpay from 'razorpay';

export const plans = {
  monthly: { name: 'Monthly Plan (₹249)', amount: 24900, days: 30 },
  yearly: { name: 'Yearly Plan (₹2799)', amount: 279900, days: 365 },
};

function serviceAccount() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error('Missing service-account fields.');
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    throw Object.assign(new Error('Firebase server credentials are not configured correctly.'), { statusCode: 500 });
  }
}

const firebaseApp = getApps()[0] || initializeApp({
  credential: serviceAccount() ? cert(serviceAccount()) : applicationDefault(),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'mediveuerp',
});
export const db = getFirestore(firebaseApp);

export function respond(res, statusCode, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(statusCode).json(payload);
}

export function method(req, res, expected) {
  if (req.method !== expected) {
    res.setHeader('Allow', expected);
    respond(res, 405, { error: 'Method not allowed.' });
    return false;
  }
  return true;
}

export async function authenticate(req) {
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Sign in to continue.'), { statusCode: 401 });
  const decoded = await (await import('firebase-admin/auth')).getAuth(firebaseApp).verifyIdToken(token);
  return decoded.uid;
}

export function razorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw Object.assign(new Error('Online payments are not configured.'), { statusCode: 503 });
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

export async function requireOwner(uid) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists || !userSnap.get('storeId')) throw Object.assign(new Error('Your store profile is not ready.'), { statusCode: 409 });
  const storeId = userSnap.get('storeId');
  const member = await db.doc(`stores/${storeId}/members/${uid}`).get();
  if (!member.exists || member.get('role') !== 'owner' || member.get('status') !== 'active') {
    throw Object.assign(new Error('Only the active store owner can manage a subscription.'), { statusCode: 403 });
  }
  return { userSnap, storeId };
}

export function handleError(res, error) {
  const statusCode = Number(error?.statusCode) || (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error' ? 401 : 500);
  if (statusCode >= 500) console.error('Payment API request failed.', { code: error?.code, statusCode });
  respond(res, statusCode, { error: statusCode >= 500 ? 'A secure payment operation could not be completed. Please retry or contact support.' : error.message });
}

export function safeEqualHex(left, right) {
  if (!/^[a-f\d]{64}$/i.test(String(left || '')) || !/^[a-f\d]{64}$/i.test(String(right || ''))) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
}

export { FieldValue, Timestamp, crypto };
