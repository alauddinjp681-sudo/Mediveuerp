import { authenticate, db, FieldValue, handleCors, handleError, method, plans, razorpay, requireOwner, respond } from '../server/billing.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (!method(req, res, 'POST')) return;
  try {
    const uid = await authenticate(req);
    const planId = String(req.body?.planId || '');
    const plan = plans[planId];
    if (!plan) return respond(res, 400, { error: 'Choose a valid subscription plan.' });
    const { userSnap, storeId } = await requireOwner(uid);
    const userData = userSnap.data();
    const submittedReferralCode = String(req.body?.referralCode || '').trim();
    let referrerUid = String(userData.referredBy || '');
    if (submittedReferralCode) {
      const matched = submittedReferralCode.match(/^MEDI-([A-Za-z0-9_-]{20,128})$/);
      if (!matched) return respond(res, 400, { error: 'That owner referral code is invalid.' });
      if (referrerUid && referrerUid !== matched[1]) {
        return respond(res, 409, { error: 'A different owner referral is already linked to this account.' });
      }
      referrerUid = matched[1];
    }

    if (referrerUid) {
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(referrerUid) || referrerUid === uid) {
        return respond(res, 400, { error: 'That owner referral code is not valid for this account.' });
      }
      const buyerRef = db.doc(`users/${uid}`);
      const buyerStoreRef = db.doc(`stores/${storeId}`);
      const buyerMemberRef = db.doc(`stores/${storeId}/members/${uid}`);
      const referrerRef = db.doc(`users/${referrerUid}`);
      const referralRef = db.doc(`referrals/${referrerUid}__${uid}`);
      await db.runTransaction(async (transaction) => {
        const [buyerSnap, buyerStoreSnap, buyerMemberSnap, referrerSnap, referralSnap] = await Promise.all([
          transaction.get(buyerRef), transaction.get(buyerStoreRef), transaction.get(buyerMemberRef),
          transaction.get(referrerRef), transaction.get(referralRef),
        ]);
        if (!buyerSnap.exists || !buyerStoreSnap.exists || buyerStoreSnap.get('ownerUid') !== uid
          || !buyerMemberSnap.exists || buyerMemberSnap.get('role') !== 'owner' || buyerMemberSnap.get('status') !== 'active') {
          throw Object.assign(new Error('Only an active store owner can link an owner referral.'), { statusCode: 403 });
        }
        const buyer = buyerSnap.data();
        if (buyer.referredBy && buyer.referredBy !== referrerUid) {
          throw Object.assign(new Error('A different owner referral is already linked to this account.'), { statusCode: 409 });
        }
        if (!referrerSnap.exists || !referrerSnap.get('storeId')) {
          throw Object.assign(new Error('That owner referral code is not active.'), { statusCode: 400 });
        }
        const referrerStoreId = String(referrerSnap.get('storeId'));
        const [referrerStoreSnap, referrerMemberSnap] = await Promise.all([
          transaction.get(db.doc(`stores/${referrerStoreId}`)),
          transaction.get(db.doc(`stores/${referrerStoreId}/members/${referrerUid}`)),
        ]);
        if (!referrerStoreSnap.exists || referrerStoreSnap.get('ownerUid') !== referrerUid
          || !referrerMemberSnap.exists || referrerMemberSnap.get('role') !== 'owner' || referrerMemberSnap.get('status') !== 'active') {
          throw Object.assign(new Error('That owner referral code is not active.'), { statusCode: 400 });
        }
        if (!buyer.referredBy && (buyer.hasPaidSubscription || buyer.razorpayPaymentId)) {
          throw Object.assign(new Error('An owner referral can only be linked before the first paid subscription.'), { statusCode: 409 });
        }
        if (!referralSnap.exists) {
          transaction.set(buyerRef, { referredBy: referrerUid, referralLinkedAt: FieldValue.serverTimestamp() }, { merge: true });
          transaction.set(referralRef, {
            referrerUid, referredUserId: uid, status: 'pending',
            linkedAt: FieldValue.serverTimestamp(), rewardEligible: false,
          });
        } else if (referralSnap.get('referrerUid') !== referrerUid || referralSnap.get('referredUserId') !== uid) {
          throw Object.assign(new Error('This owner referral record could not be verified.'), { statusCode: 409 });
        }
      });
    }

    const { client, keyId } = razorpay();
    const order = await client.orders.create({
      amount: plan.amount,
      currency: 'INR',
      receipt: `mediveu_${uid.slice(0, 12)}_${Date.now()}`,
      notes: { userId: uid, planId, referrerUid },
    });
    return respond(res, 200, { id: order.id, amount: order.amount, currency: order.currency, keyId, planId });
  } catch (error) {
    return handleError(res, error);
  }
}
