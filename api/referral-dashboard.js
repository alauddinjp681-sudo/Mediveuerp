import { authenticate, db, handleError, method, requireOwner, respond } from '../server/billing.js';

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  try {
    const uid = await authenticate(req);
    await requireOwner(uid);
    const referralQuery = db.collection('referrals').where('referrerUid', '==', uid);
    const [statsSnap, referralsSnap, countSnap] = await Promise.all([
      db.doc(`referralStats/${uid}`).get(),
      referralQuery.limit(100).get(),
      referralQuery.count().get(),
    ]);
    const referrals = referralsSnap.docs.map((entry) => {
      const data = entry.data();
      return { id: data.referredUserId, status: data.status, verifiedAt: data.verifiedAt?.toMillis?.() || null };
    });
    const stats = statsSnap.exists ? statsSnap.data() : {};
    return respond(res, 200, {
      referrals,
      total: countSnap.data().count,
      verified: Number(stats.qualifiedMonthly || 0),
      rewardMonthsEarned: Number(stats.rewardMonthsEarned || 0),
      rewardMonthsApplied: Number(stats.rewardMonthsApplied || 0),
    });
  } catch (error) {
    return handleError(res, error);
  }
}
