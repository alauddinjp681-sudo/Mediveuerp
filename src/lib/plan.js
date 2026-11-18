import { useEffect, useState } from 'react';
import { toMillis } from './format';

const DAY = 24 * 60 * 60 * 1000;

export function getPlanDays(plan) {
  const s = String(plan || '').toLowerCase();
  if (s.includes('custom')) {
    const match = s.match(/(\d+)\s*days?/);
    return match ? Number(match[1]) : 7;
  }
  if (s.includes('lifetime') || s.includes('unlimited')) return 36500;
  if (s.includes('year') || s.includes('2799')) return 365;
  if (s.includes('month') || s.includes('249')) return 30;
  return 7;
}

export function getPlanInfo(data) {
  const plan = data?.plan || '7 Days Free Trial';
  const status = data?.status || 'Active';
  const startedAt = toMillis(data?.createdAt) || Date.now();
  const expiresAt = startedAt + getPlanDays(plan) * DAY;
  return {
    plan,
    status,
    startedAt,
    expiresAt,
    expiryLabel: new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export function isPlanBlocked(data) {
  const { status, expiresAt } = getPlanInfo(data);
  return status !== 'Active' || Date.now() > expiresAt;
}

export function useSubscriptionTimer(data) {
  const info = getPlanInfo(data);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, info.expiresAt - now);
  const timeLeft = {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff / (60 * 60 * 1000)) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    isExpired: diff <= 0,
  };
  return { ...info, timeLeft, isUrgent: timeLeft.days <= 3 };
}
