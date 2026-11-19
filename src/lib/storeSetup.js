import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const STORE_COLLECTIONS_TO_MIGRATE = [
  'settings',
  'inventory',
  'bills',
  'customers',
  'suppliers',
  'purchases',
  'transactions',
  'supplier_transactions',
  'payments',
];
const PAGE_SIZE = 200;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

async function hashInvitationCode(code) {
  const bytes = new TextEncoder().encode(String(code || '').trim());
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function profileDefaults(user, registration) {
  return {
    email: normalizeEmail(user.email),
    status: 'Active',
    plan: '7 Days Free Trial',
    createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now(),
    storeName: String(registration.storeName || '').trim().slice(0, 120),
    phone: String(registration.phone || '').trim().slice(0, 40),
  };
}

async function acceptInvitation(user, invitationCode) {
  if (!/^[a-f\d]{64}$/i.test(invitationCode)) {
    throw Object.assign(new Error('Enter a valid store invitation code.'), { code: 'invalid-argument' });
  }
  const invitationId = await hashInvitationCode(invitationCode);
  const userRef = doc(db, 'users', user.uid);
  const invitationRef = doc(db, 'storeInvitations', invitationId);
  const invitationSnapshot = await getDoc(invitationRef);
  if (!invitationSnapshot.exists()) {
    throw Object.assign(new Error('This invitation code is invalid or has expired. Ask the store owner for a new invitation.'), { code: 'invalid-argument' });
  }

  const invitation = invitationSnapshot.data();
  const storeId = String(invitation.storeId || '');
  const role = String(invitation.role || '');
  if (!storeId || !['manager', 'worker', 'accountant'].includes(role)) {
    throw Object.assign(new Error('This invitation is not valid. Ask the store owner to send a new one.'), { code: 'invalid-argument' });
  }

  const memberRef = doc(db, 'stores', storeId, 'members', user.uid);
  await runTransaction(db, async (transaction) => {
    const [currentUser, currentInvitation, currentMember] = await Promise.all([
      transaction.get(userRef),
      transaction.get(invitationRef),
      transaction.get(memberRef),
    ]);
    const currentData = currentUser.exists() ? currentUser.data() : {};
    const liveInvitation = currentInvitation.exists() ? currentInvitation.data() : null;
    if (currentData.storeId) {
      if (currentData.storeId === storeId && currentMember.exists() && currentMember.get('status') === 'active') return;
      throw Object.assign(new Error('This account is already connected to a store.'), { code: 'failed-precondition' });
    }
    if (!liveInvitation || liveInvitation.email !== normalizeEmail(user.email)) {
      throw Object.assign(new Error('This invitation was issued to a different email address.'), { code: 'permission-denied' });
    }
    if (liveInvitation.status !== 'pending' && !(liveInvitation.status === 'accepted' && liveInvitation.acceptedUid === user.uid)) {
      throw Object.assign(new Error('This invitation has already been used or is no longer available.'), { code: 'failed-precondition' });
    }
    if (liveInvitation.expiresAt?.toMillis?.() <= Date.now()) {
      throw Object.assign(new Error('This invitation has expired. Ask the store owner to send a new one.'), { code: 'failed-precondition' });
    }
    const alreadyJoined = liveInvitation.status === 'accepted'
      && liveInvitation.acceptedUid === user.uid
      && currentMember.exists()
      && currentMember.get('status') === 'active';
    if (currentMember.exists() && currentMember.get('status') === 'active' && !alreadyJoined) {
      throw Object.assign(new Error('This account already has an active membership.'), { code: 'failed-precondition' });
    }

    if (liveInvitation.status === 'pending') {
      transaction.update(invitationRef, {
        status: 'accepted',
        acceptedUid: user.uid,
        acceptedAt: serverTimestamp(),
      });
    }
    if (!alreadyJoined) {
      transaction.set(memberRef, {
        uid: user.uid,
        email: normalizeEmail(user.email),
        role,
        status: 'active',
        invitationId,
        invitedBy: liveInvitation.createdBy || '',
        joinedAt: serverTimestamp(),
      });
    }
    transaction.set(userRef, {
      ...profileDefaults(user, {}),
      storeId,
      role,
      migrationStatus: 'complete',
      migrationCompletedAt: serverTimestamp(),
      pendingInvitationCode: deleteField(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  return { storeId, role };
}

async function initializeOwnerStore(user, registration) {
  const userRef = doc(db, 'users', user.uid);
  const storeRef = doc(db, 'stores', user.uid);
  const memberRef = doc(db, 'stores', user.uid, 'members', user.uid);
  const defaults = profileDefaults(user, registration);
  const legacySettings = await getDoc(doc(db, 'users', user.uid, 'settings', 'general'));
  const legacyStoreName = legacySettings.exists() ? legacySettings.get('storeName') : '';

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, storeSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(storeRef),
      transaction.get(memberRef),
    ]);
    const existingProfile = userSnapshot.exists() ? userSnapshot.data() : {};
    if (existingProfile.storeId) return;
    if (storeSnapshot.exists() && storeSnapshot.get('ownerUid') !== user.uid) {
      throw Object.assign(new Error('A store with this account ID already exists but is not owned by your account.'), { code: 'permission-denied' });
    }
    if (memberSnapshot.exists() && memberSnapshot.get('status') === 'active' && memberSnapshot.get('role') !== 'owner') {
      throw Object.assign(new Error('This account has an existing non-owner membership.'), { code: 'failed-precondition' });
    }

    const profile = { ...defaults, ...existingProfile };
    const storeName = String(
      legacyStoreName
      || existingProfile.storeName
      || defaults.storeName
      || user.displayName
      || 'My Store',
    ).trim().slice(0, 120);
    transaction.set(userRef, {
      ...(userSnapshot.exists() ? {} : defaults),
      migrationStoreId: user.uid,
      migrationStatus: 'in_progress',
      migrationError: deleteField(),
      migrationFailedAt: deleteField(),
      pendingInvitationCode: deleteField(),
    }, { merge: true });
    transaction.set(storeRef, {
      ownerUid: user.uid,
      name: storeName,
      status: profile.status || 'Active',
      plan: profile.plan || '7 Days Free Trial',
      subscriptionEndsAt: profile.subscriptionEndsAt || null,
      createdAt: storeSnapshot.exists() ? (storeSnapshot.get('createdAt') || serverTimestamp()) : serverTimestamp(),
      migrationStatus: 'in_progress',
    }, { merge: true });
    if (!memberSnapshot.exists()) {
      transaction.set(memberRef, {
        uid: user.uid,
        email: normalizeEmail(user.email || existingProfile.email),
        role: 'owner',
        status: 'active',
        joinedAt: serverTimestamp(),
      });
    }
  });
}

async function migrateLegacyCollections(user, storeId, profile) {
  const userRef = doc(db, 'users', user.uid);
  const storeRef = doc(db, 'stores', storeId);
  const legacySettingsRef = doc(db, 'users', user.uid, 'settings', 'general');
  const legacySettings = await getDoc(legacySettingsRef);
  const existingSettings = legacySettings.exists() ? legacySettings.data() : null;
  const storeName = String(existingSettings?.storeName || profile.storeName || user.displayName || 'My Store').trim().slice(0, 120);

  if (!existingSettings) {
    await setDoc(doc(db, 'stores', storeId, 'settings', 'general'), {
      storeName,
      phone: String(profile.phone || ''),
      address: '',
      gstin: '',
      dlNumber: '',
    }, { merge: true });
  }

  for (const collectionName of STORE_COLLECTIONS_TO_MIGRATE) {
    const source = collection(db, 'users', user.uid, collectionName);
    const destination = collection(db, 'stores', storeId, collectionName);
    let lastDocument = null;
    while (true) {
      let page = query(source, orderBy(documentId()), limit(PAGE_SIZE));
      if (lastDocument) page = query(source, orderBy(documentId()), startAfter(lastDocument), limit(PAGE_SIZE));
      const snapshot = await getDocs(page);
      if (snapshot.empty) break;

      const batch = writeBatch(db);
      snapshot.docs.forEach((legacyDocument) => {
        batch.set(doc(destination, legacyDocument.id), legacyDocument.data(), { merge: true });
      });
      await batch.commit();
      lastDocument = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < PAGE_SIZE) break;
    }
  }

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, storeSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(storeRef),
      transaction.get(doc(db, 'stores', storeId, 'members', user.uid)),
    ]);
    if (!userSnapshot.exists() || !storeSnapshot.exists() || !memberSnapshot.exists()) {
      throw Object.assign(new Error('Store setup is incomplete. Press Retry setup to continue.'), { code: 'failed-precondition' });
    }
    const latestProfile = userSnapshot.data();
    if (latestProfile.storeId && latestProfile.storeId !== storeId) {
      throw Object.assign(new Error('This account is already connected to a different store.'), { code: 'failed-precondition' });
    }
    if (memberSnapshot.get('status') !== 'active' || memberSnapshot.get('role') !== 'owner') {
      throw Object.assign(new Error('The store owner membership could not be verified.'), { code: 'permission-denied' });
    }
    transaction.set(storeRef, {
      migrationStatus: 'complete',
      migratedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(userRef, {
      storeId,
      role: 'owner',
      migrationStoreId: deleteField(),
      migrationStatus: 'complete',
      migrationError: deleteField(),
      migrationFailedAt: deleteField(),
      migrationCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

export async function setupStoreForUser(user, registration = {}) {
  if (!user?.uid) throw Object.assign(new Error('Sign in to open your store.'), { code: 'unauthenticated' });

  const userRef = doc(db, 'users', user.uid);
  let userSnapshot = await getDoc(userRef);
  let userData = userSnapshot.exists() ? userSnapshot.data() : {};
  const invitationCode = String(registration.invitationCode || userData.pendingInvitationCode || '').trim();

  if (invitationCode && !userData.storeId) {
    return acceptInvitation(user, invitationCode);
  }

  if (userData.storeId) {
    const storeId = userData.storeId;
    const memberRef = doc(db, 'stores', storeId, 'members', user.uid);
    const [storeSnapshot, memberSnapshot] = await Promise.all([getDoc(doc(db, 'stores', storeId)), getDoc(memberRef)]);
    let member = memberSnapshot;
    if (!member.exists() && storeSnapshot.exists() && storeSnapshot.get('ownerUid') === user.uid) {
      await setDoc(memberRef, {
        uid: user.uid,
        email: normalizeEmail(user.email || userData.email),
        role: 'owner',
        status: 'active',
        joinedAt: serverTimestamp(),
      });
      member = await getDoc(memberRef);
    }
    if (!member.exists() || member.get('status') !== 'active' || !['owner', 'manager', 'worker', 'accountant'].includes(member.get('role'))) {
      throw Object.assign(new Error('Your store membership is not active. Ask the store owner to re-invite you.'), { code: 'permission-denied' });
    }
    if (userData.role !== member.get('role') || userData.migrationStatus !== 'complete' || userData.migrationError || userData.migrationFailedAt || userData.pendingInvitationCode) {
      await setDoc(userRef, {
        role: member.get('role'),
        migrationStatus: 'complete',
        migrationError: deleteField(),
        migrationFailedAt: deleteField(),
        pendingInvitationCode: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    return { storeId, role: member.get('role') };
  }

  await initializeOwnerStore(user, registration);
  userSnapshot = await getDoc(userRef);
  userData = userSnapshot.exists() ? userSnapshot.data() : {};
  if (userData.storeId) {
    return { storeId: userData.storeId, role: userData.role };
  }

  const storeId = userData.migrationStoreId || user.uid;
  if (storeId !== user.uid) {
    throw Object.assign(new Error('The store migration could not be verified for this account.'), { code: 'failed-precondition' });
  }
  await migrateLegacyCollections(user, storeId, userData);
  return { storeId, role: 'owner' };
}
