import { authenticate, crypto, db, FieldValue, handleCors, handleError, millis, method, plans, razorpay, requireOwner, respond, safeEqualHex, Timestamp } from '../server/billing.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (!method(req, res, 'POST')) return;
  try {
    const uid = await authenticate(req);
    await requireOwner(uid);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value.length > 0)) {
      return respond(res, 400, { error: 'Payment confirmation details are incomplete.' });
    }

    const { client, keySecret } = razorpay();
    const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (!safeEqualHex(signature, expected)) return respond(res, 400, { error: 'The payment signature could not be verified.' });

    const [order, initialPayment] = await Promise.all([client.orders.fetch(orderId), client.payments.fetch(paymentId)]);
    let payment = initialPayment;
    if (payment.status === 'authorized') payment = await client.payments.capture(paymentId, payment.amount, payment.currency);
    const planId = String(order.notes?.planId || '');
    const plan = plans[planId];
    if (!plan || order.notes?.userId !== uid || order.amount !== plan.amount || payment.order_id !== orderId || payment.amount !== plan.amount || payment.currency !== 'INR' || payment.status !== 'captured') {
      return respond(res, 400, { error: 'The captured payment does not match this account and subscription plan.' });
    }

    const userRef = db.doc(`users/${uid}`);
    const paymentRef = db.doc(`users/${uid}/payments/${orderId}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return respond(res, 404, { error: 'Store account not found.' });
    const storeRef = db.doc(`stores/${userSnap.get('storeId')}`);
    const referrerUid = String(order.notes?.referrerUid || '');
    const referralRef = referrerUid && referrerUid !== uid ? db.doc(`referrals/${referrerUid}__${uid}`) : null;
    const referrerRef = referralRef ? db.doc(`users/${referrerUid}`) : null;
    const statsRef = referralRef ? db.doc(`referralStats/${referrerUid}`) : null;
    const now = Date.now();

    const result = await db.runTransaction(async (transaction) => {
      const [paymentSnap, buyerSnap, referralSnap, referrerSnap, statsSnap] = await Promise.all([
        transaction.get(paymentRef), transaction.get(userRef),
        referralRef ? transaction.get(referralRef) : Promise.resolve(null),
        referrerRef ? transaction.get(referrerRef) : Promise.resolve(null),
        statsRef ? transaction.get(statsRef) : Promise.resolve(null),
      ]);
      if (paymentSnap.exists) return { alreadyProcessed: true, referralRewardDays: 0 };
      if (!buyerSnap.exists) throw Object.assign(new Error('Store account not found.'), { statusCode: 404 });
      const buyer = buyerSnap.data();
      const prevEnd = millis(buyer.subscriptionEndsAt);
      const prevStart = millis(buyer.createdAt);
      const priorDays = /year|2799/i.test(buyer.plan || '') ? 365 : /month|249/i.test(buyer.plan || '') ? 30 : 0;
      const previousEnd = prevEnd || (priorDays && prevStart ? prevStart + priorDays * 86400000 : 0);
      const subscriptionEndsAt = Math.max(now, previousEnd) + plan.days * 86400000;
      transaction.set(paymentRef, { razorpayPaymentId: paymentId, planId, amount: plan.amount, status: 'captured', verifiedAt: FieldValue.serverTimestamp() });
      const profile = {
        plan: plan.name,
        status: 'Active',
        createdAt: previousEnd > now ? buyer.createdAt : now,
        subscriptionEndsAt: Timestamp.fromMillis(subscriptionEndsAt),
        hasPaidSubscription: true,
        razorpayPaymentId: paymentId,
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.set(userRef, profile, { merge: true });
      transaction.set(storeRef, profile, { merge: true });

      let referralRewardDays = 0;
      const canVerifyReferral = referralRef && referrerSnap?.exists
        && (!buyer.referredBy || buyer.referredBy === referrerUid)
        && (!referralSnap?.exists || referralSnap.get('status') === 'pending');
      if (canVerifyReferral) {
        const qualifiedCount = Number(statsSnap?.get('qualifiedPurchases') ?? statsSnap?.get('qualifiedMonthly') ?? 0) + 1;
        const earnedMonths = Math.floor(qualifiedCount / 3);
        const appliedMonths = Number(statsSnap?.get('rewardMonthsApplied') || 0);
        const monthsToApply = Math.max(0, earnedMonths - appliedMonths);
        transaction.set(userRef, { referredBy: referrerUid, referralLinkedAt: buyer.referralLinkedAt || FieldValue.serverTimestamp() }, { merge: true });
        transaction.set(referralRef, {
          referrerUid, referredUserId: uid, status: 'verified', rewardEligible: true,
          qualifyingOrderId: orderId, qualifyingPaymentId: paymentId, verifiedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(statsRef, {
          qualifiedPurchases: qualifiedCount,
          rewardMonthsEarned: earnedMonths,
          rewardMonthsApplied: appliedMonths + monthsToApply,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (monthsToApply > 0) {
          const referrer = referrerSnap.data();
          const referrerEnd = millis(referrer.subscriptionEndsAt);
          const referrerStart = millis(referrer.createdAt);
          const referrerPlanDays = /year|2799/i.test(referrer.plan || '') ? 365 : /month|249/i.test(referrer.plan || '') ? 30 : 0;
          const currentEnd = referrerEnd || (referrerPlanDays && referrerStart ? referrerStart + referrerPlanDays * 86400000 : 0);
          const rewardStart = Math.max(now, currentEnd);
          referralRewardDays = monthsToApply * 30;
          const rewardProfile = {
            plan: referrer.plan && referrer.plan !== '7 Days Free Trial' ? referrer.plan : plans.monthly.name,
            status: 'Active', createdAt: currentEnd > now ? referrer.createdAt : rewardStart,
            subscriptionEndsAt: Timestamp.fromMillis(rewardStart + referralRewardDays * 86400000),
            updatedAt: FieldValue.serverTimestamp(),
          };
          transaction.set(referrerRef, rewardProfile, { merge: true });
          if (referrer.storeId) transaction.set(db.doc(`stores/${referrer.storeId}`), rewardProfile, { merge: true });
        }
      }
      return { alreadyProcessed: false, referralRewardDays };
    });
    return respond(res, 200, { verified: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}
