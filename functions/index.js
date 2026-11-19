const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue, FieldPath } = require('firebase-admin/firestore');
const Razorpay = require('razorpay');
const crypto = require('node:crypto');

initializeApp();
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
const plans = {
  monthly: { name: 'Monthly Plan (₹249)', amount: 24900, days: 30 },
  yearly: { name: 'Yearly Plan (₹2799)', amount: 279900, days: 365 },
};

function razorpayClient() {
  return new Razorpay({ key_id: razorpayKeyId.value(), key_secret: razorpayKeySecret.value() });
}

function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
}

function safeEqualHex(left, right) {
  if (!/^[a-f\d]{64}$/i.test(left || '') || !/^[a-f\d]{64}$/i.test(right || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

exports.attachReferral = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to attach a referral.');
  const uid = request.auth.uid;
  const referrerUid = String(request.data?.referrerUid || '').trim();
  if (!referrerUid || referrerUid === uid || !/^[A-Za-z0-9_-]{20,128}$/.test(referrerUid)) {
    throw new HttpsError('invalid-argument', 'This referral link is invalid.');
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const referrerRef = db.doc(`users/${referrerUid}`);
  const referralRef = db.doc(`referrals/${referrerUid}__${uid}`);
  await db.runTransaction(async (transaction) => {
    const [userSnap, referrerSnap, referralSnap] = await Promise.all([
      transaction.get(userRef), transaction.get(referrerRef), transaction.get(referralRef),
    ]);
    if (!referrerSnap.exists || !userSnap.exists) throw new HttpsError('not-found', 'The account for this referral could not be found.');
    const userData = userSnap.data();
    if (userData.referredBy) {
      if (userData.referredBy === referrerUid) return;
      throw new HttpsError('failed-precondition', 'A referral is already linked to this account.');
    }
    if (userData.hasPaidSubscription || userData.razorpayPaymentId) {
      throw new HttpsError('failed-precondition', 'A referral can only be attached before the first paid subscription.');
    }
    if (!referralSnap.exists) {
      transaction.set(userRef, { referredBy: referrerUid, referralLinkedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(referralRef, {
        referrerUid,
        referredUserId: uid,
        status: 'pending',
        linkedAt: FieldValue.serverTimestamp(),
        rewardEligible: false,
      });
    }
  });
  return { linked: true };
});

exports.getReferralDashboard = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to view referral rewards.');
  const uid = request.auth.uid;
  const db = getFirestore();
  const [statsSnap, referralsSnap] = await Promise.all([
    db.doc(`referralStats/${uid}`).get(),
    db.collection('referrals').where('referrerUid', '==', uid).limit(100).get(),
  ]);
  const referrals = referralsSnap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: data.referredUserId,
      status: data.status,
      qualifiedAt: data.qualifiedAt?.toMillis?.() || null,
    };
  });
  return { stats: statsSnap.exists ? statsSnap.data() : {}, referrals };
});

exports.createSubscriptionOrder = onCall({ secrets: [razorpayKeyId, razorpayKeySecret] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before purchasing a plan.');
  const planId = String(request.data?.planId || '');
  const plan = plans[planId];
  if (!plan) throw new HttpsError('invalid-argument', 'Choose a valid subscription plan.');

  const db = getFirestore();
  const userSnap = await db.doc(`users/${request.auth.uid}`).get();
  if (!userSnap.exists || !userSnap.get('storeId')) throw new HttpsError('failed-precondition', 'Your store profile is not ready.');
  const memberSnap = await db.doc(`stores/${userSnap.get('storeId')}/members/${request.auth.uid}`).get();
  if (!memberSnap.exists || memberSnap.get('role') !== 'owner' || memberSnap.get('status') !== 'active') {
    throw new HttpsError('permission-denied', 'Only the store owner can manage the subscription.');
  }
  const referrerUid = String(userSnap.get('referredBy') || '');
  const order = await razorpayClient().orders.create({
    amount: plan.amount,
    currency: 'INR',
    receipt: `mediveu_${request.auth.uid.slice(0, 12)}_${Date.now()}`,
    notes: { userId: request.auth.uid, planId, referrerUid },
  });
  return { id: order.id, amount: order.amount, currency: order.currency, keyId: razorpayKeyId.value() };
});

exports.confirmSubscriptionPayment = onCall({ secrets: [razorpayKeyId, razorpayKeySecret] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to verify this payment.');
  const { orderId, paymentId, signature } = request.data || {};
  if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value.length > 0)) {
    throw new HttpsError('invalid-argument', 'Payment confirmation details are incomplete.');
  }

  const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret.value()).update(`${orderId}|${paymentId}`).digest('hex');
  if (!safeEqualHex(signature, expectedSignature)) throw new HttpsError('permission-denied', 'The payment signature could not be verified.');

  const razorpay = razorpayClient();
  let order;
  let payment;
  try {
    [order, payment] = await Promise.all([razorpay.orders.fetch(orderId), razorpay.payments.fetch(paymentId)]);
    if (payment.status === 'authorized') payment = await razorpay.payments.capture(paymentId, payment.amount, payment.currency);
  } catch {
    throw new HttpsError('not-found', 'The payment could not be confirmed with Razorpay.');
  }
  const uid = request.auth.uid;
  const planId = String(order.notes?.planId || '');
  const plan = plans[planId];
  if (!plan || order.notes?.userId !== uid || order.amount !== plan.amount || payment.order_id !== orderId || payment.amount !== plan.amount || payment.currency !== 'INR' || payment.status !== 'captured') {
    throw new HttpsError('failed-precondition', 'The captured payment does not match this account and subscription plan.');
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const storeRef = db.doc(`stores/${uid}`);
  const paymentRef = db.doc(`users/${uid}/payments/${orderId}`);
  const referrerUid = String(order.notes?.referrerUid || '');
  const referralRef = referrerUid ? db.doc(`referrals/${referrerUid}__${uid}`) : null;
  const statsRef = referrerUid ? db.doc(`referralStats/${referrerUid}`) : null;
  const referrerRef = referrerUid ? db.doc(`users/${referrerUid}`) : null;
  const now = Date.now();

  const result = await db.runTransaction(async (transaction) => {
    const [paymentSnap, userSnap, referralSnap, statsSnap, referrerSnap] = await Promise.all([
      transaction.get(paymentRef), transaction.get(userRef),
      referralRef ? transaction.get(referralRef) : Promise.resolve(null),
      statsRef ? transaction.get(statsRef) : Promise.resolve(null),
      referrerRef ? transaction.get(referrerRef) : Promise.resolve(null),
    ]);
    if (paymentSnap.exists) return { alreadyProcessed: true, referralReward: false };
    if (!userSnap.exists) throw new HttpsError('not-found', 'Store account not found.');

    const userData = userSnap.data();
    const previousEnd = millis(userData.subscriptionEndsAt);
    const previousStart = millis(userData.createdAt);
    const existingDays = /year|2799/i.test(userData.plan || '') ? 365 : /month|249/i.test(userData.plan || '') ? 30 : 0;
    const currentEnd = previousEnd || (existingDays && previousStart ? previousStart + existingDays * 86400000 : 0);
    const subscriptionEndsAt = Math.max(now, currentEnd) + plan.days * 86400000;
    transaction.set(paymentRef, {
      razorpayPaymentId: paymentId,
      planId,
      amount: plan.amount,
      status: 'captured',
      verifiedAt: FieldValue.serverTimestamp(),
    });
    const subscriptionProfile = {
      plan: plan.name,
      status: 'Active',
      createdAt: currentEnd > now ? userData.createdAt : now,
      subscriptionEndsAt: Timestamp.fromMillis(subscriptionEndsAt),
      hasPaidSubscription: true,
      razorpayPaymentId: paymentId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(userRef, subscriptionProfile, { merge: true });
    transaction.set(storeRef, subscriptionProfile, { merge: true });

    let referralReward = false;
    if (referralRef && referralSnap?.exists && userData.referredBy === referrerUid && referralSnap.get('referrerUid') === referrerUid && referralSnap.get('referredUserId') === uid && referralSnap.get('status') === 'pending' && planId === 'monthly' && referrerSnap?.exists) {
      const qualifiedCount = Number(statsSnap?.get('qualifiedMonthly') || 0) + 1;
      const earnedMonths = Math.floor(qualifiedCount / 3);
      const appliedMonths = Number(statsSnap?.get('rewardMonthsApplied') || 0);
      const monthsToApply = Math.max(0, earnedMonths - appliedMonths);
      transaction.update(referralRef, {
        status: 'qualified',
        rewardEligible: true,
        qualifyingOrderId: orderId,
        qualifyingPaymentId: paymentId,
        qualifiedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(statsRef, {
        qualifiedMonthly: qualifiedCount,
        rewardMonthsEarned: earnedMonths,
        rewardMonthsApplied: appliedMonths + monthsToApply,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (monthsToApply > 0) {
        const referrerData = referrerSnap.data();
        const referrerEnd = millis(referrerData.subscriptionEndsAt);
        const referrerStart = millis(referrerData.createdAt);
        const referrerDays = /year|2799/i.test(referrerData.plan || '') ? 365 : /month|249/i.test(referrerData.plan || '') ? 30 : 0;
        const currentReferrerEnd = referrerEnd || (referrerDays && referrerStart ? referrerStart + referrerDays * 86400000 : 0);
        const rewardStart = Math.max(now, currentReferrerEnd);
        const rewardEnd = rewardStart + monthsToApply * 30 * 86400000;
        const rewardProfile = {
          plan: referrerData.plan && referrerData.plan !== '7 Days Free Trial' ? referrerData.plan : plans.monthly.name,
          status: 'Active',
          createdAt: currentReferrerEnd > now ? referrerData.createdAt : rewardStart,
          subscriptionEndsAt: Timestamp.fromMillis(rewardEnd),
          updatedAt: FieldValue.serverTimestamp(),
        };
        transaction.set(referrerRef, rewardProfile, { merge: true });
        transaction.set(db.doc(`stores/${referrerUid}`), rewardProfile, { merge: true });
        referralReward = true;
      }
    }
    return { alreadyProcessed: false, referralReward };
  });
  return { verified: true, ...result };
});

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
const STORE_ROLES = ['owner', 'manager', 'worker', 'accountant'];
const INVITABLE_ROLES = ['manager', 'worker', 'accountant'];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashInvitationCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
}

function requireOwnerRole(memberSnap) {
  if (!memberSnap.exists || memberSnap.get('status') !== 'active' || memberSnap.get('role') !== 'owner') {
    throw new HttpsError('permission-denied', 'Only the store owner can manage team access.');
  }
}

async function acceptInvitation(db, uid, email, rawCode) {
  const code = String(rawCode || '').trim();
  if (!/^[a-f\d]{64}$/i.test(code)) throw new HttpsError('invalid-argument', 'Enter a valid store invitation code.');
  const invitationRef = db.doc(`storeInvitations/${hashInvitationCode(code)}`);
  const userRef = db.doc(`users/${uid}`);
  const profileSnap = await userRef.get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  const emailAddress = normalizeEmail(email || profile.email);

  return db.runTransaction(async (transaction) => {
    const invitationSnap = await transaction.get(invitationRef);
    if (!invitationSnap.exists) throw new HttpsError('not-found', 'This invitation is invalid or has expired.');
    const invitation = invitationSnap.data();
    const memberRef = db.doc(`stores/${invitation.storeId}/members/${uid}`);
    const memberSnap = await transaction.get(memberRef);

    if (invitation.status === 'accepted' && invitation.acceptedUid === uid && memberSnap.exists) {
      return { storeId: invitation.storeId, role: memberSnap.get('role') };
    }
    if (invitation.status !== 'pending' || invitation.expiresAt?.toMillis?.() <= Date.now()) {
      throw new HttpsError('failed-precondition', 'This invitation is no longer active. Ask the owner for a new code.');
    }
    if (!emailAddress || emailAddress !== normalizeEmail(invitation.email)) {
      throw new HttpsError('permission-denied', 'Sign in with the email address this invitation was created for.');
    }
    if (profile.storeId && profile.storeId !== invitation.storeId) {
      throw new HttpsError('failed-precondition', 'This account already belongs to another store.');
    }
    const member = {
      uid,
      email: emailAddress,
      role: invitation.role,
      status: 'active',
      joinedAt: FieldValue.serverTimestamp(),
      invitedBy: invitation.createdBy,
    };
    transaction.set(memberRef, member);
    transaction.set(userRef, {
      email: emailAddress,
      storeId: invitation.storeId,
      role: invitation.role,
      pendingInvitationCode: FieldValue.delete(),
      migrationStatus: 'complete',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.update(invitationRef, {
      status: 'accepted',
      acceptedUid: uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });
    return { storeId: invitation.storeId, role: invitation.role };
  });
}

exports.ensureStore = onCall({ timeoutSeconds: 540 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to open your store.');
  const db = getFirestore();
  const uid = request.auth.uid;
  const userRef = db.doc(`users/${uid}`);
  let userSnap = await userRef.get();
  let userData = userSnap.exists ? userSnap.data() : {};
  const invitationCode = String(request.data?.invitationCode || userData.pendingInvitationCode || '').trim();

  if (invitationCode) {
    const accepted = await acceptInvitation(db, uid, request.auth.token.email, invitationCode);
    return { ...accepted, migrationStatus: 'complete' };
  }

  if (userData.storeId) {
    const memberSnap = await db.doc(`stores/${userData.storeId}/members/${uid}`).get();
    if (!memberSnap.exists || memberSnap.get('status') !== 'active') {
      throw new HttpsError('permission-denied', 'Your store membership is not active. Contact the store owner.');
    }
    return { storeId: userData.storeId, role: memberSnap.get('role'), migrationStatus: userData.migrationStatus || 'complete' };
  }

  const registration = request.data?.registration || {};
  await db.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(userRef);
    const current = currentSnap.exists ? currentSnap.data() : {};
    if (current.storeId) return;
    const defaults = {
      email: normalizeEmail(request.auth.token.email),
      status: 'Active',
      plan: '7 Days Free Trial',
      createdAt: Date.now(),
    };
    const profile = { ...defaults, ...current };
    if (!currentSnap.exists) {
      profile.storeName = String(registration.storeName || '').trim().slice(0, 120);
      profile.phone = String(registration.phone || '').trim().slice(0, 40);
    }
    transaction.set(userRef, {
      ...profile,
      migrationStoreId: uid,
      migrationStatus: 'in_progress',
      pendingInvitationCode: FieldValue.delete(),
    }, { merge: true });
  });

  userSnap = await userRef.get();
  userData = userSnap.data() || {};
  if (userData.storeId) {
    const memberSnap = await db.doc(`stores/${userData.storeId}/members/${uid}`).get();
    if (!memberSnap.exists) throw new HttpsError('failed-precondition', 'Store membership is not ready. Please retry.');
    return { storeId: userData.storeId, role: memberSnap.get('role'), migrationStatus: 'complete' };
  }

  const storeId = userData.migrationStoreId || uid;
  const storeRef = db.doc(`stores/${storeId}`);
  const legacySettings = await userRef.collection('settings').doc('general').get();
  const general = legacySettings.exists ? legacySettings.data() : {};
  const storeSnap = await storeRef.get();
  const storeDefaults = {
    ownerUid: uid,
    name: String(general.storeName || userData.storeName || request.auth.token.name || 'My Store').trim().slice(0, 120),
    status: userData.status || 'Active',
    plan: userData.plan || '7 Days Free Trial',
    subscriptionEndsAt: userData.subscriptionEndsAt || null,
    createdAt: storeSnap.exists ? (storeSnap.get('createdAt') || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
    migrationStatus: 'in_progress',
  };
  await storeRef.set(storeDefaults, { merge: true });
  if (!legacySettings.exists) {
    await storeRef.collection('settings').doc('general').set({
      storeName: storeDefaults.name,
      phone: String(userData.phone || ''),
      address: '',
      gstin: '',
      dlNumber: '',
    }, { merge: true });
  }

  try {
    for (const collectionName of STORE_COLLECTIONS_TO_MIGRATE) {
      const source = userRef.collection(collectionName);
      const target = storeRef.collection(collectionName);
      let lastDocument = null;
      let copied = 0;
      while (true) {
        let page = source.orderBy(FieldPath.documentId()).limit(250);
        if (lastDocument) page = page.startAfter(lastDocument);
        const snapshot = await page.get();
        if (snapshot.empty) break;
        const batch = db.batch();
        snapshot.docs.forEach((legacyDocument) => {
          batch.set(target.doc(legacyDocument.id), legacyDocument.data(), { merge: true });
        });
        await batch.commit();
        copied += snapshot.size;
        lastDocument = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < 250) break;
      }
      const targetCount = await target.count().get();
      if (targetCount.data().count < copied) {
        throw new Error(`Verification failed for ${collectionName}`);
      }
    }

    const memberRef = storeRef.collection('members').doc(uid);
    const batch = db.batch();
    batch.set(memberRef, {
      uid,
      email: normalizeEmail(request.auth.token.email || userData.email),
      role: 'owner',
      status: 'active',
      joinedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(storeRef, { migrationStatus: 'complete', migratedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(userRef, {
      storeId,
      role: 'owner',
      migrationStoreId: FieldValue.delete(),
      migrationStatus: 'complete',
      migrationCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return { storeId, role: 'owner', migrationStatus: 'complete' };
  } catch (error) {
    await userRef.set({ migrationStatus: 'error', migrationError: 'Migration paused; original records are unchanged.' }, { merge: true });
    await storeRef.set({ migrationStatus: 'error' }, { merge: true });
    console.error('Store migration paused:', uid, error?.message || error);
    throw new HttpsError('internal', 'Store setup paused safely. Your original data is unchanged; retry to resume migration.');
  }
});

exports.createStoreInvitation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to invite a teammate.');
  const db = getFirestore();
  const uid = request.auth.uid;
  const profileSnap = await db.doc(`users/${uid}`).get();
  const storeId = profileSnap.get('storeId');
  if (!storeId) throw new HttpsError('failed-precondition', 'Your store is still being set up.');
  const memberRef = db.doc(`stores/${storeId}/members/${uid}`);
  requireOwnerRole(await memberRef.get());

  const email = normalizeEmail(request.data?.email);
  const role = String(request.data?.role || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpsError('invalid-argument', 'Enter a valid teammate email address.');
  }
  if (!INVITABLE_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Choose a valid team role.');
  const code = crypto.randomBytes(32).toString('hex');
  const invitationRef = db.doc(`storeInvitations/${hashInvitationCode(code)}`);
  await invitationRef.set({
    storeId,
    email,
    role,
    status: 'pending',
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 86400000),
  });
  return { code, email, role, expiresInDays: 14 };
});

exports.acceptStoreInvitation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before accepting a store invitation.');
  const result = await acceptInvitation(getFirestore(), request.auth.uid, request.auth.token.email, request.data?.code);
  return { ...result, migrationStatus: 'complete' };
});

exports.activateStarterPlan = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before starting a trial.');
  const db = getFirestore();
  const uid = request.auth.uid;
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const storeId = userSnap.get('storeId');
  if (!storeId) throw new HttpsError('failed-precondition', 'Your store is still being set up.');
  requireOwnerRole(await db.doc(`stores/${storeId}/members/${uid}`).get());
  if (userSnap.get('hasPaidSubscription') || userSnap.get('trialActivatedAt')) {
    throw new HttpsError('failed-precondition', 'The starter trial has already been used on this account.');
  }

  const now = Date.now();
  const trialProfile = {
    plan: '7 Days Free Trial',
    status: 'Active',
    createdAt: now,
    subscriptionEndsAt: Timestamp.fromMillis(now + 7 * 86400000),
    trialActivatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await db.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(userRef);
    if (currentSnap.get('hasPaidSubscription') || currentSnap.get('trialActivatedAt')) {
      throw new HttpsError('failed-precondition', 'The starter trial has already been used on this account.');
    }
    transaction.set(userRef, trialProfile, { merge: true });
    transaction.set(db.doc(`stores/${storeId}`), trialProfile, { merge: true });
  });
  return { activated: true };
});

exports.changeStoreMemberRole = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to change team access.');
  const db = getFirestore();
  const uid = request.auth.uid;
  const profileSnap = await db.doc(`users/${uid}`).get();
  const storeId = profileSnap.get('storeId');
  if (!storeId) throw new HttpsError('failed-precondition', 'Your store is not ready.');
  requireOwnerRole(await db.doc(`stores/${storeId}/members/${uid}`).get());

  const memberUid = String(request.data?.memberUid || '');
  const role = String(request.data?.role || '');
  if (!memberUid || memberUid === uid || !INVITABLE_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'Choose a valid team member and role.');
  }
  const targetRef = db.doc(`stores/${storeId}/members/${memberUid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists || targetSnap.get('status') !== 'active') throw new HttpsError('not-found', 'Active team member not found.');
  await targetRef.update({ role, updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`users/${memberUid}`).set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { updated: true };
});
