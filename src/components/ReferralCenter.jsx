import React from 'react';
import useSWR from 'swr';
import { Check, Copy, Gift, Share2, ShieldCheck } from 'lucide-react';
import { Button, Card, PageHeader } from './ui';

async function fetchReferralDashboard(user) {
  const token = await user.getIdToken();
  const response = await fetch('/api/referral-dashboard', { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load referral rewards.');
  return data;
}

export default function ReferralCenter({ user, userData, showToast }) {
  const { data, error, isLoading } = useSWR(user?.uid ? ['referral-dashboard', user.uid] : null, () => fetchReferralDashboard(user));
  const referralCode = user?.uid ? `MEDI-${user.uid}` : '';
  const referralUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}` : '';
  const verified = Number(data?.verified || 0);
  const progressCount = verified > 0 ? ((verified - 1) % 3) + 1 : 0;
  const rewardDaysEarned = (Number(data?.rewardMonthsEarned) || 0) * 30;
  const referrals = Array.isArray(data?.referrals) ? data.referrals.filter(Boolean) : [];

  const copy = async (value, message) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(message);
    } catch {
      showToast('Clipboard access is unavailable in this browser.', 'error');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MEDIVEU ERP referral', text: `Use my referral code ${referralCode} when upgrading your MEDIVEU store.`, url: referralUrl });
      } catch (shareError) {
        if (shareError.name !== 'AbortError') showToast('Could not open the share menu.', 'error');
      }
    } else {
      await copy(referralUrl, 'Referral link copied.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader title="Referral rewards" subtitle="Invite store owners and earn subscription time after their verified paid plan purchase." icon={<Gift size={20} />} />
      {userData?.role !== 'owner' ? (
        <Card role="status" className="p-5 text-sm text-slate-300">Referral rewards are available to store owners.</Card>
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your unique referral code</div>
                <p className="mt-2 break-all font-mono text-xl font-bold tracking-wide text-white" aria-label={`Referral code ${referralCode}`}>{referralCode}</p>
                <p className="mt-2 text-sm text-slate-400">Share this code. The new owner enters it at checkout; each referred store counts after its first verified paid plan purchase.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" onClick={() => copy(referralCode, 'Referral code copied.')} aria-label="Copy referral code"><Copy size={16} /> Copy code</Button>
                <Button onClick={share} aria-label="Share referral link"><Share2 size={16} /> Share</Button>
              </div>
            </div>
          </Card>
          {error && <Card role="alert" className="border-red-500/30 p-4 text-sm text-red-200">{error.message}</Card>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-5"><p className="text-sm text-slate-400">Total referrals</p><p className="mt-2 text-3xl font-bold text-white">{isLoading ? '—' : data?.total || 0}</p></Card>
            <Card className="p-5"><p className="text-sm text-slate-400">Verified rewards</p><p className="mt-2 text-3xl font-bold text-white">{isLoading ? '—' : verified}</p><p className="mt-1 text-xs text-slate-500">Verified paid plan purchases</p></Card>
            <Card className="p-5"><p className="text-sm text-slate-400">Subscription time earned</p><p className="mt-2 text-3xl font-bold text-white">{isLoading ? '—' : `${rewardDaysEarned} days`}</p><p className="mt-1 text-xs text-slate-500">{Number(data?.rewardMonthsApplied) || 0} months applied to your account</p></Card>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-white">Progress to your next free month</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {isLoading ? '—' : `${progressCount} / 3 paid referrals towards 1 Month Free Subscription`}
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-brand-green/10 px-3 py-1 text-sm font-semibold text-brand-green">+30 days</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Paid referrals toward one free month" aria-valuemin={0} aria-valuemax={3} aria-valuenow={isLoading ? 0 : progressCount}>
              <div className="h-full rounded-full bg-brand-green transition-[width] duration-500" style={{ width: `${isLoading ? 0 : (progressCount / 3) * 100}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-400">Every 3 verified paid plan purchases using your code automatically adds 30 days to your store subscription.</p>
          </Card>
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-brand-green" /><h2 className="font-bold text-white">Referral activity</h2></div>
            {isLoading ? <p className="mt-4 text-sm text-slate-400" role="status">Loading referral activity…</p> : referrals.length ? (
              <ul className="mt-4 divide-y divide-white/[0.07]">
                {referrals.map((referral, index) => {
                  const referralId = String(referral?.id || `referral-${index}`);
                  const isVerified = referral?.status === 'verified';
                  return (
                    <li key={referralId} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="font-mono text-slate-300">{referralId.slice(0, 5)}…{referralId.slice(-4)}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isVerified ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                        {isVerified && <Check size={13} />}{isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-4 text-sm text-slate-400">No referrals yet. Share your code to get started.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
