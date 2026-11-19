import React from 'react';
import { ArrowRight, Check, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Card, PageHeader } from './ui';

const PLAN_CARDS = [
  { id: 'trial', name: 'Starter', price: 0, display: '₹0', period: '7 days', text: 'Explore the full MEDIVEU workflow before upgrading.', features: ['All core ERP features', 'Offline-ready billing', 'No card required'], featured: false },
  { id: 'monthly', name: 'Monthly', price: 249, display: '₹249', period: 'month', text: 'Flexible access for growing medical stores.', features: ['Unlimited billing', 'All bill templates'], featured: true },
  { id: 'yearly', name: 'Yearly', price: 2799, display: '₹2,799', period: 'year', text: 'Best value for stores using MEDIVEU all year.', features: ['Everything in Monthly', 'One annual payment', 'Priority support'], featured: false },
];

export default function SubscriptionPlans({ user, userData, showToast, navigate }) {
  const startTrial = () => {
    if (!user) {
      showToast('Please sign in before opening your store.', 'error');
      navigate?.('public', 'login');
      return;
    }
    showToast('Your 7-day trial began when you created your account.');
    navigate?.('app', 'pos');
  };

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8">
      <PageHeader title="Choose the right plan" subtitle="Your free trial is activated when your account is created. Paid plan changes are temporarily unavailable in client-only mode." icon={<Crown size={20} />} />
      <div className="grid md:grid-cols-3 gap-4 lg:gap-6 items-stretch">
        {PLAN_CARDS.map((plan) => (
          <Card key={plan.id} className={`relative p-5 sm:p-6 flex flex-col ${plan.featured ? 'border-brand-sky/40 shadow-glow bg-gradient-to-b from-sky-500/[0.08] to-ink-900' : ''}`}>
            {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-sky px-3 py-1 text-[10px] tracking-wide text-ink-950 font-extrabold uppercase">Most popular</span>}
            <div className="flex items-center justify-between gap-2 mt-1"><h2 className="text-lg font-bold text-white">{plan.name}</h2>{plan.featured && <Sparkles size={17} className="text-brand-sky" />}</div>
            <p className="text-sm text-slate-400 mt-2 min-h-10">{plan.text}</p>
            <p className="mt-5 text-4xl font-extrabold tracking-tight text-white">{plan.display}<span className="text-sm font-medium text-slate-400"> / {plan.period}</span></p>
            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-slate-300"><Check size={16} className="text-brand-green mt-0.5 shrink-0" /> {feature}</li>)}
            </ul>
            <Button variant={plan.featured ? 'primary' : 'secondary'} className="w-full mt-7" onClick={plan.id === 'trial' ? startTrial : undefined} disabled={plan.id !== 'trial'}>
              {plan.id === 'trial' ? 'Continue free trial' : 'Paid plans unavailable'} <ArrowRight size={16} />
            </Button>
          </Card>
        ))}
      </div>
      <div role="note" className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex items-start gap-3 text-xs text-slate-400"><ShieldCheck size={17} className="text-brand-green shrink-0" /><p>Payment orders and subscription changes require a trusted server for verification. No payment will be taken or plan changed from this client-only app. Contact support for paid plan availability.</p></div>
      {userData?.subscriptionEndsAt && <p className="mt-3 text-center text-xs text-slate-500">Current plan: {userData.plan}. Expiry is {new Date(userData.subscriptionEndsAt?.toMillis?.() || userData.subscriptionEndsAt).toLocaleDateString('en-IN')}.</p>}
    </div>
  );
}
