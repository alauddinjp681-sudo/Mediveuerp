import { authenticate, db, FieldValue, handleCors, handleError, method, plans, razorpay, requireOwner, respond } from '../server/billing.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (!method(req, res, 'POST')) return;
  try {
    const uid = await authenticate(req);
    const planId = String(req.body?.planId || '');
    const plan = plans[planId];
    if (!plan) return respond(res, 400, { error: 'Choose a valid subscription plan.' });
    const { userSnap } = await requireOwner(uid);
    const userData = userSnap.data();
    let referrerUid = '';
    const referralCode = String(req.body?.referralCode || '').trim();
    if (referralCode) {
      const matched = referralCode.match(/^MEDI-([A-Za-z0-9_-]{20,128})$/);
      if (!matched) return respond(res, 400, { error: 'That referral code is invalid.' });
      referrerUid = matched[1];
      if (referrerUid === uid) return respond(res, 400, { error: 'You cannot use your own referral code.' });
      if (userData.referredBy && userData.referredBy !== referrerUid) {
        return respond(res, 409, { error: 'A different referral is already linked to this account.' });
      }
      const referrer = await db.doc(`users/${referrerUid}`).get();
      if (!referrer.exists || !referrer.get('storeId')) return respond(res, 400, { error: 'That referral code is not active.' });
    } else {
      referrerUid = String(userData.referredBy || '');
    }

    const { client, keyId } = razorpay();
    const order = await client.orders.create({
      amount: plan.amount,
      currency: 'INR',
      receipt: `mediveu_${uid.slice(0, 12)}_${Date.now()}`,
      notes: { userId: uid, planId, referrerUid },
    });
    if (referrerUid) {
      const buyerRef = db.doc(`users/${uid}`);
      const referrerRef = db.doc(`users/${referrerUid}`);
      const referralRef = db.doc(`referrals/${referrerUid}__${uid}`);
      await db.runTransaction(async (transaction) => {
        const [buyerSnap, referrerSnap, referralSnap] = await Promise.all([
          transaction.get(buyerRef), transaction.get(referrerRef), transaction.get(referralRef),
        ]);
        if (!buyerSnap.exists || !referrerSnap.exists) throw Object.assign(new Error('The referral account is not available.'), { statusCode: 400 });
        const buyer = buyerSnap.data();
        if (buyer.referredBy && buyer.referredBy !== referrerUid) {
          throw Object.assign(new Error('A different referral is already linked to this account.'), { statusCode: 409 });
        }
        if (!referralSnap.exists) {
          transaction.set(buyerRef, { referredBy: referrerUid, referralLinkedAt: FieldValue.serverTimestamp() }, { merge: true });
          transaction.set(referralRef, {
            referrerUid, referredUserId: uid, status: 'pending',
            linkedAt: FieldValue.serverTimestamp(), rewardEligible: false,
          });
        }
      });
    }
    return respond(res, 200, { id: order.id, amount: order.amount, currency: order.currency, keyId, planId });
  } catch (error) {
    return handleError(res, error);
  }
}
