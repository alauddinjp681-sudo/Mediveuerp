import React from 'react';
import { Gift, ShieldCheck } from 'lucide-react';
import { Card, PageHeader } from './ui';

export default function ReferralCenter() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader title="Referral rewards" subtitle="Referral tracking is unavailable in client-only mode." icon={<Gift size={20} />} />
      <Card className="flex items-start gap-3 p-5 sm:p-6" role="status">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-sky" aria-hidden="true" />
        <div>
          <h2 className="font-bold text-white">Referral rewards are paused</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Rewards depend on verified payments and protected referral records. This app now reads and writes store data directly through Firestore, so it does not create unverified referral rewards.</p>
        </div>
      </Card>
    </div>
  );
}
