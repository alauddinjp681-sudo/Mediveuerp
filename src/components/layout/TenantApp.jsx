import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Home, Receipt, Package, Users, Truck, BarChart3, Crown, Settings, LogOut, Menu, X, Wifi, WifiOff, ShoppingCart, MoreHorizontal, Gift, Monitor, Smartphone } from 'lucide-react';
import { BrandMark, Spinner, cn } from '../ui';
import { useSubscriptionTimer } from '../../lib/plan';
import { canAccessView, canEditInventory, canManageBills, canManageStore, ROLE_LABELS } from '../../lib/storeAccess';

const Dashboard = lazy(() => import('../Dashboard'));
const BillingPOS = lazy(() => import('../billing/BillingPOS'));
const Inventory = lazy(() => import('../Inventory'));
const Customers = lazy(() => import('../Customers'));
const Suppliers = lazy(() => import('../Suppliers'));
const SupplierLedger = lazy(() => import('../SupplierLedger'));
const PurchaseEntry = lazy(() => import('../PurchaseEntry'));
const Reports = lazy(() => import('../Reports'));
const SubscriptionPlans = lazy(() => import('../SubscriptionPlans'));
const SettingsView = lazy(() => import('../SettingsView'));
const ReferralCenter = lazy(() => import('../ReferralCenter'));
const TeamAccess = lazy(() => import('../TeamAccess'));

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'billing', label: 'Billing / POS', icon: Receipt, short: 'Billing' },
  { id: 'inventory', label: 'Inventory', icon: Package, short: 'Stock' },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'purchaseEntry', label: 'Purchase Entry', icon: ShoppingCart },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'team', label: 'Staff / Team Management', icon: Users },
  { id: 'plans', label: 'Upgrade Plan', icon: Crown },
  { id: 'referrals', label: 'Referral rewards', icon: Gift },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const BOTTOM = ['dashboard', 'billing', 'inventory', 'reports'];
const WORKER_BOTTOM = ['dashboard', 'billing', 'inventory', 'customers'];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function NavList({ path, go, onLogout, role }) {
  const visibleNav = NAV.filter(({ id }) => canAccessView(role, id));
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main">
      {visibleNav.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => go(id)} aria-current={path === id ? 'page' : undefined}
          className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
            path === id ? 'bg-brand-gradient text-white shadow-glow' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white')}>
          <Icon size={18} /> {label}
        </button>
      ))}
      <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10 mt-6">
        <LogOut size={18} /> Logout
      </button>
    </nav>
  );
}

export default function TenantApp({ user = {}, userData = {}, path = 'dashboard', setPath = () => {}, navigate = () => {}, showToast = () => {}, onLogout = () => {}, data = {}, showViewToggle = false, siteView = 'mobile', onSwitchSiteView = () => {}, onHideViewToggle = () => {}, onShowViewToggle = () => {} }) {
  const safeData = {
    ...data,
    bills: Array.isArray(data?.bills) ? data.bills : [],
    inventory: Array.isArray(data?.inventory) ? data.inventory : [],
    customers: Array.isArray(data?.customers) ? data.customers : [],
    suppliers: Array.isArray(data?.suppliers) ? data.suppliers : [],
  };
  const [drawer, setDrawer] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [activeSupplier, setActiveSupplier] = useState(null);
  const online = useOnline();
  const role = user?.role || 'worker';
  const visibleBottom = (role === 'worker' ? WORKER_BOTTOM : BOTTOM).filter((id) => canAccessView(role, id));
  const { plan, timeLeft, isUrgent } = useSubscriptionTimer(userData || {});
  const ViewIcon = siteView === 'mobile' ? Monitor : Smartphone;

  useEffect(() => {
    if (!canAccessView(role, path)) setPath('dashboard');
  }, [role, path, setPath]);

  const go = (id, extra) => {
    if (!canAccessView(role, id)) return;
    if (id === 'billing') setEditBill(extra || null);
    if (id === 'purchaseEntry' || id === 'supplierLedger') setActiveSupplier(extra || null);
    setPath(id);
    setDrawer(false);
    document.getElementById('main-scroll')?.scrollTo(0, 0);
  };

  const storeName = userData?.settings?.general?.storeName || 'My Store';

  const page = (() => {
    switch (canAccessView(role, path) ? path : 'dashboard') {
      case 'billing': return <BillingPOS user={user} userData={userData} editBill={editBill} onClearEdit={() => setEditBill(null)} showToast={showToast} bills={safeData.bills} inventory={safeData.inventory} customers={safeData.customers} navigate={go} />;
      case 'inventory': return <Inventory user={user} showToast={showToast} canEdit={canEditInventory(role)} />;
      case 'customers': return <Customers user={user} showToast={showToast} canEdit={role !== 'accountant'} canManageBills={canManageBills(role)} />;
      case 'suppliers': return <Suppliers user={user} onNavigate={go} showToast={showToast} canEdit={canManageStore(role)} />;
      case 'supplierLedger': return <SupplierLedger user={user} supplier={activeSupplier} onBack={() => go('suppliers')} showToast={showToast} canEdit={canManageStore(role)} />;
      case 'purchaseEntry': return <PurchaseEntry user={user} preSelectedSupplier={activeSupplier} onNavigate={go} showToast={showToast} canEdit={canManageStore(role)} />;
      case 'reports': return <Reports data={{ ...safeData, medicines: safeData.inventory }} role={role} onOpenBill={(bill) => go('billing', bill)} />;
      case 'plans': return <SubscriptionPlans user={user} userData={userData} showToast={showToast} navigate={(v, p) => (v === 'public' ? navigate(v, p) : go(p === 'pos' ? 'billing' : p || 'dashboard'))} />;
      case 'referrals': return <ReferralCenter user={user} userData={userData} showToast={showToast} />;
      case 'team': return <TeamAccess user={user} showToast={showToast} />;
      case 'settings': return <SettingsView user={user} userData={userData} data={safeData} showToast={showToast} />;
      default: return <Dashboard userData={userData} data={safeData} go={go} />;
    }
  })();

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-950">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/[0.07] bg-ink-900/70 no-print">
        <div className="h-16 px-4 flex items-center border-b border-white/[0.07]"><BrandMark size="sm" /></div>
        <NavList path={path} go={go} onLogout={onLogout} role={role} />
        <div className="p-4 border-t border-white/[0.07] text-xs text-slate-500">
          <div className="text-slate-300 font-semibold truncate">{storeName}</div>
          <div className="truncate">{user.email}</div>
          <span className="mt-2 inline-flex rounded-full border border-brand-sky/25 bg-brand-sky/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-sky">{ROLE_LABELS[role] || ROLE_LABELS.worker}</span>
              <button type="button" aria-pressed={showViewToggle} onClick={() => { (showViewToggle ? onHideViewToggle : onShowViewToggle)(); setDrawer(false); }} className="mt-3 block text-xs font-semibold text-slate-300 hover:text-white">{showViewToggle ? 'Hide view switcher' : 'Show view switcher'}</button>
        </div>
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-ink-900 border-r border-white/10 flex flex-col">
            <div className="drawer-header h-16 px-4 flex items-center justify-between border-b border-white/10">
              <BrandMark size="sm" />
              <button onClick={() => setDrawer(false)} className="p-2 text-slate-400" aria-label="Close menu"><X size={20} /></button>
            </div>
            <NavList path={path} go={go} onLogout={onLogout} role={role} />
            <div className="border-t border-white/10 p-4 text-xs text-slate-400">
              <div className="truncate font-semibold text-white">{storeName}</div>
              <div className="mt-1 truncate">{user.email}</div>
              <span className="mt-2 inline-flex rounded-full border border-brand-sky/25 bg-brand-sky/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-sky">{ROLE_LABELS[role] || ROLE_LABELS.worker}</span>
              <button type="button" aria-pressed={showViewToggle} onClick={() => { (showViewToggle ? onHideViewToggle : onShowViewToggle)(); setDrawer(false); }} className="mt-3 block text-xs font-semibold text-slate-300 hover:text-white">{showViewToggle ? 'Hide view switcher' : 'Show view switcher'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="tenant-header shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-white/[0.07] bg-ink-950/80 backdrop-blur no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setDrawer(true)} className="lg:hidden p-2 -ml-2 text-slate-300" aria-label="Open menu"><Menu size={22} /></button>
            <div className="lg:hidden"><BrandMark size="sm" /></div>
            <div className="hidden lg:block min-w-0">
              <div className="text-sm font-semibold text-white truncate">{NAV.find((n) => n.id === path)?.label || 'Dashboard'}</div>
              <div className="text-xs text-slate-500 truncate">{storeName}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {showViewToggle && (
              <div className="view-mode-toggle view-mode-toggle-tenant no-print">
                <button className="view-mode-toggle-action" type="button" onClick={onSwitchSiteView}
                  aria-label={`Switch to ${siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}`} title={`Switch to ${siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}`}>
                  <ViewIcon size={16} aria-hidden="true" />
                  <span className="hidden md:inline">{siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}</span>
                </button>
                <button className="view-mode-toggle-dismiss" type="button" onClick={onHideViewToggle} aria-label="Hide view toggle" title="Hide view toggle"><X size={15} aria-hidden="true" /></button>
              </div>
            )}
            <span className={cn('hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
              online ? 'text-brand-green border-brand-green/30 bg-brand-green/10' : 'text-amber-300 border-amber-400/30 bg-amber-400/10')}>
              {online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? 'Online' : 'Offline'}
            </span>
            <span className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">{ROLE_LABELS[role] || ROLE_LABELS.worker}</span>
            {role === 'owner' && <button onClick={() => go('plans')} className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border',
              isUrgent || timeLeft.isExpired ? 'text-red-300 border-red-500/40 bg-red-500/10' : 'text-slate-300 border-white/10 bg-white/[0.04]')}>
              {timeLeft.isExpired ? 'Plan expired' : `${plan.replace('7 Days Free Trial', 'Trial')} · ${timeLeft.days}d`}
            </button>}
          </div>
        </header>
        {!online && (
          <div className="sm:hidden bg-amber-400/10 text-amber-200 text-xs text-center py-1.5 no-print" role="status">
            Offline mode: changes will sync automatically
          </div>
        )}
        <main id="main-scroll" className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6">
          <Suspense fallback={<div className="py-24 flex justify-center"><Spinner /></div>}>{page}</Suspense>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-900/95 backdrop-blur border-t border-white/10 safe-bottom no-print" aria-label="Quick">
        <div className="grid grid-cols-5">
          {visibleBottom.map((id) => {
            const item = NAV.find((n) => n.id === id);
            const Icon = item.icon;
            const active = path === id;
            return (
              <button key={id} onClick={() => go(id)} aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', active ? 'text-brand-sky' : 'text-slate-400')}>
                <Icon size={20} /> {item.short || item.label}
              </button>
            );
          })}
          <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-400">
            <MoreHorizontal size={20} /> More
          </button>
        </div>
      </nav>
    </div>
  );
}
