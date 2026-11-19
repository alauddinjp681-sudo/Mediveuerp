import React, { useMemo } from 'react';
import { IndianRupee, FileText, Package, Users, AlertTriangle, ArrowRight, Plus, ShieldCheck, Clock } from 'lucide-react';
import { Card, Button, Badge, cn } from './ui';
import { formatMoney, formatDate, toMillis, toNumber } from '../lib/format';
import { useSubscriptionTimer } from '../lib/plan';

const DAY = 86400000;

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', tone)}><Icon size={18} /></span>
      </div>
      <div className="text-2xl md:text-3xl font-extrabold text-white mt-3 tabular">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}

function PlanBanner({ userData, go }) {
  const { plan, status, expiryLabel, timeLeft, isUrgent } = useSubscriptionTimer(userData);
  const danger = isUrgent || timeLeft.isExpired || status !== 'Active';
  return (
    <Card className={cn('p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between', danger && 'border-red-500/40 bg-red-950/30')}>
      <div className="flex items-center gap-3">
        <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', danger ? 'bg-red-500/15 text-red-300' : 'bg-brand-green/15 text-brand-green')}>
          {danger ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{plan}</span>
            <Badge tone={status === 'Active' ? 'success' : 'danger'}>{status}</Badge>
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Clock size={12} />
            {timeLeft.isExpired ? 'Plan expired' : `${timeLeft.days}d ${timeLeft.hours}h left`} · valid till {expiryLabel}
          </div>
        </div>
      </div>
      <Button variant={danger ? 'primary' : 'secondary'} onClick={() => go('plans')}>Upgrade <ArrowRight size={16} /></Button>
    </Card>
  );
}

export default function Dashboard({ userData, data, go }) {
  const { bills, inventory, customers } = data;

  const stats = useMemo(() => {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const t0 = startToday.getTime();
    const monthStart = new Date(startToday.getFullYear(), startToday.getMonth(), 1).getTime();
    let today = 0; let month = 0; let total = 0;
    const days = Array.from({ length: 7 }, (_, i) => ({ t: t0 - (6 - i) * DAY, v: 0 }));
    bills.forEach((b) => {
      if (b.status === 'draft' || ['estimate', 'proforma'].includes(b.invoiceDetails?.docType)) return;
      const amt = toNumber(b.totals?.grandTotal);
      const ts = toMillis(b.createdAt) || toMillis(b.invoiceDetails?.date);
      total += amt;
      if (ts >= t0) today += amt;
      if (ts >= monthStart) month += amt;
      const idx = Math.floor((ts - days[0].t) / DAY);
      if (idx >= 0 && idx < 7) days[idx].v += amt;
    });
    const now = Date.now();
    const lowStock = inventory.filter((i) => toNumber(i.qty) <= toNumber(i.minQty || 10));
    const expiring = inventory.filter((i) => {
      const e = toMillis(i.expiryDate);
      return e && e - now < 90 * DAY;
    });
    const recent = [...bills].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 6);
    return { today, month, total, days, lowStock, expiring, recent };
  }, [bills, inventory]);

  const max = Math.max(1, ...stats.days.map((d) => d.v));
  const storeName = userData?.settings?.general?.storeName;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white text-balance">{storeName || 'Your Store'}</h1>
        </div>
        <Button onClick={() => go('billing')}>{userData.role === 'accountant' ? <><FileText size={16} /> View invoices</> : <><Plus size={16} /> New Bill</>}</Button>
      </div>

      {userData.role === 'owner' && <PlanBanner userData={userData} go={go} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat icon={IndianRupee} label="Today" value={formatMoney(stats.today)} sub={`Month ${formatMoney(stats.month)}`} tone="bg-brand-green/15 text-brand-green" />
        <Stat icon={FileText} label="Invoices" value={bills.length} sub={`Lifetime ${formatMoney(stats.total)}`} tone="bg-brand-blue/15 text-brand-sky" />
        <Stat icon={Package} label="Products" value={inventory.length} sub={`${stats.lowStock.length} low stock`} tone="bg-amber-500/15 text-amber-300" />
        <Stat icon={Users} label="Customers" value={customers.length} tone="bg-fuchsia-500/15 text-fuchsia-300" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Sales: last 7 days</h2>
            <span className="text-xs text-slate-400 tabular">{formatMoney(stats.days.reduce((a, d) => a + d.v, 0))}</span>
          </div>
          <div className="flex items-end gap-2 sm:gap-4 h-44" role="img" aria-label="Bar chart of sales for the last 7 days">
            {stats.days.map((d) => (
              <div key={d.t} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] text-slate-500 tabular hidden sm:block">{d.v ? Math.round(d.v) : ''}</span>
                <div className="w-full rounded-t-lg bg-brand-gradient opacity-90 min-h-[4px]" style={{ height: `${(d.v / max) * 100}%` }} />
                <span className="text-[11px] text-slate-400">{new Date(d.t).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Stock alerts</h2>
            {userData.role !== 'accountant' && <button onClick={() => go('inventory')} className="text-xs text-brand-sky hover:underline">View stock</button>}
          </div>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {stats.expiring.slice(0, 5).map((i) => (
              <li key={`e-${i.id}`} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate text-slate-200">{i.name}</span>
                <Badge tone="danger">Exp {formatDate(i.expiryDate, { month: 'short', year: '2-digit' })}</Badge>
              </li>
            ))}
            {stats.lowStock.slice(0, 5).map((i) => (
              <li key={`l-${i.id}`} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate text-slate-200">{i.name}</span>
                <Badge tone="warning">Qty {i.qty ?? 0}</Badge>
              </li>
            ))}
            {!stats.expiring.length && !stats.lowStock.length && <li className="text-sm text-slate-500">All good. No alerts.</li>}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-bold text-white">Recent invoices</h2>
          {userData.role !== 'worker' && <button onClick={() => go('reports')} className="text-xs text-brand-sky hover:underline">All reports</button>}
        </div>
        <ul className="divide-y divide-white/5">
          {stats.recent.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{b.buyerDetails?.name || 'Cash Customer'}</div>
                <button onClick={() => go('billing', b)} className="text-sm text-brand-sky hover:underline">{b.invoiceDetails?.invoiceNumber || 'Open invoice'} · {b.status === 'draft' ? 'Draft' : formatDate(b.createdAt || b.invoiceDetails?.date)}</button>
              </div>
              <span className="text-sm font-bold text-white tabular">{formatMoney(b.totals?.grandTotal)}</span>
            </li>
          ))}
          {!stats.recent.length && <li className="px-5 py-8 text-center text-sm text-slate-500">No invoices yet. Create your first bill.</li>}
        </ul>
      </Card>
    </div>
  );
}
