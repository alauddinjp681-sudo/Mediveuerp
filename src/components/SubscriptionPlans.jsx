import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ArrowRight, Check, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { functions } from '../firebase';
import { readableFirebaseError } from '../lib/firebaseError';
import { Button, Card, PageHeader } from './ui';

const PLAN_CARDS = [
  { id: 'trial', name: 'Starter', price: 0, display: '₹0', period: '7 days', text: 'Explore the full MEDIVEU workflow before upgrading.', features: ['All core ERP features', 'Offline-ready billing', 'No card required'], featured: false },
  { id: 'monthly', name: 'Monthly', price: 249, display: '₹249', period: 'month', text: 'Flexible access for growing medical stores.', features: ['Unlimited billing', 'All bill templates', 'Verified referral rewards'], featured: true },
  { id: 'yearly', name: 'Yearly', price: 2799, display: '₹2,799', period: 'year', text: 'Best value for stores using MEDIVEU all year.', features: ['Everything in Monthly', 'One annual payment', 'Priority support'], featured: false },
];

let checkoutPromise = null;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutPromise) return checkoutPromise;

  checkoutPromise = new Promise((resolve, reject) => {
    const script = document.querySelector('script[data-razorpay-checkout]') || document.createElement('script');
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeoutId);
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!window.Razorpay) script.remove();
      reject(error);
    };
    const handleLoad = () => {
      if (window.Razorpay) {
        settled = true;
        cleanup();
        resolve();
      } else {
        fail(new Error('Razorpay checkout loaded without its payment interface. Try again or contact support.'));
      }
    };
    const handleError = () => fail(new Error('Secure checkout could not load. Check your connection or content-blocker settings, then try again.'));
    const timeoutId = window.setTimeout(() => fail(new Error('Secure checkout took too long to load. Check your connection and try again.')), 15000);

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    if (!script.src) {
      script.dataset.razorpayCheckout = 'true';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }).catch((error) => {
    checkoutPromise = null;
    throw error;
  });

  return checkoutPromise;
}

export default function SubscriptionPlans({ user, userData, showToast, navigate }) {
  const [loading, setLoading] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(Boolean(window.Razorpay));
  const [checkoutLoading, setCheckoutLoading] = useState(!window.Razorpay);
  const [checkoutError, setCheckoutError] = useState('');

  const retryCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      await loadCheckout();
      setCheckoutReady(true);
    } catch (error) {
      setCheckoutReady(false);
      setCheckoutError(error?.message || 'Secure checkout could not be loaded.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadCheckout().then(() => {
      if (active) setCheckoutReady(true);
    }).catch((error) => {
      if (active) {
        setCheckoutReady(false);
        setCheckoutError(error?.message || 'Secure checkout could not be loaded.');
      }
    }).finally(() => {
      if (active) setCheckoutLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleSubscribe = async (plan) => {
    if (!user) {
      showToast('Please sign in before subscribing.', 'error');
      navigate?.('public', 'login');
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      if (plan.id === 'trial') {
        const activateTrial = httpsCallable(functions, 'activateStarterPlan');
        await activateTrial();
        showToast('7-day trial activated.');
        navigate?.('app', 'pos');
        return;
      }
      if (!checkoutReady || !window.Razorpay) throw new Error('Secure checkout could not load. Check your connection and try again.');

      const createOrder = httpsCallable(functions, 'createSubscriptionOrder');
      const { data: order } = await createOrder({ planId: plan.id });
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'MEDIVEU ERP',
        description: `${plan.name} subscription`,
        order_id: order.id,
        prefill: { email: user.email || '' },
        theme: { color: '#38bdf8' },
        handler: async (paymentResponse) => {
          try {
            const verifyPayment = httpsCallable(functions, 'confirmSubscriptionPayment');
            const { data: verification } = await verifyPayment({
              orderId: paymentResponse.razorpay_order_id,
              paymentId: paymentResponse.razorpay_payment_id,
              signature: paymentResponse.razorpay_signature,
            });
            showToast(verification.referralReward ? 'Payment verified. Referral month added to your subscription!' : 'Payment verified. Your plan is active.');
            navigate?.('app', 'pos');
          } catch (error) {
            console.error('Payment verification failed:', error);
            showToast(`Payment verification is pending: ${readableFirebaseError(error, 'contact support for a status check')}. Do not submit payment again until your plan status is confirmed.`, 'error');
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      checkout.on('payment.failed', () => {
        setLoading(false);
        showToast('Payment did not complete. You have not been charged.', 'error');
      });
      checkout.open();
    } catch (error) {
      console.error('Subscription checkout error:', error);
      showToast(readableFirebaseError(error, 'Secure checkout could not be started.'), 'error');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8">
      <PageHeader title="Choose the right plan" subtitle="Secure checkout. Your subscription is activated only after the server verifies your payment." icon={<Crown size={20} />} />
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
            <Button variant={plan.featured ? 'primary' : 'secondary'} className="w-full mt-7" onClick={() => handleSubscribe(plan)} disabled={loading || (plan.id !== 'trial' && !checkoutReady)}>
              {loading ? 'Processing…' : plan.id === 'trial' ? 'Start free trial' : `Subscribe ${plan.name}`} <ArrowRight size={16} />
            </Button>
          </Card>
        ))}
      </div>
      {!checkoutReady && (
        <div role={checkoutError ? 'alert' : 'status'} className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
          <p>{checkoutLoading ? 'Loading secure checkout…' : checkoutError || 'Secure checkout is unavailable.'}</p>
          {!checkoutLoading && <Button type="button" variant="secondary" onClick={retryCheckout}>Retry checkout</Button>}
        </div>
      )}
      <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex items-start gap-3 text-xs text-slate-400"><ShieldCheck size={17} className="text-brand-green shrink-0" /><p>Payments are verified on MEDIVEU&apos;s secure server before a plan or referral reward is applied. Referral rewards need 3 separate, verified monthly subscriptions; yearly purchases do not count.</p></div>
      {userData?.subscriptionEndsAt && <p className="mt-3 text-center text-xs text-slate-500">Current plan: {userData.plan}. Expiry is updated automatically after verified payments.</p>}
    </div>
  );
}
