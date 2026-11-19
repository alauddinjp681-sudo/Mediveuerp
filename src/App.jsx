import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Eye, Monitor, Smartphone, X } from 'lucide-react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db, firebaseConfigError } from './firebase';
import { storeCollection, storeDocument } from './lib/storeAccess';
import { setupStoreForUser } from './lib/storeSetup';
import { describeSetupError } from './lib/setupError';
import { readableFirebaseError } from './lib/firebaseError';
import { persistentStore, sessionStore } from './lib/sessionStore';
import { Toast, Spinner, BrandMark } from './components/ui';
import PublicSite from './components/public/PublicSite';
import StoreSetupError from './components/StoreSetupError';

const PromotionHub = lazy(() => import('./components/PromotionHub'));
const TenantApp = lazy(() => import('./components/layout/TenantApp'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));

const isAdminRoute = () => window.location.pathname.startsWith('/admin') || window.location.hash.includes('admin');
const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

function FullScreenLoader() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-ink-950">
      <BrandMark size="lg" />
      <Spinner label="Loading your store..." />
    </div>
  );
}

function AuthenticatedApp() {
  const lastAuthUidRef = useRef(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authObserverError, setAuthObserverError] = useState('');
  const [view, setView] = useState(isAdminRoute() ? 'admin' : 'public');
  const [path, setPath] = useState('home');
  const [toast, setToast] = useState(null);
  const [isAdminAuth, setIsAdminAuth] = useState(() => sessionStore.getItem('mediveu-admin') === '1');
  const [siteView, setSiteView] = useState(() => sessionStore.getItem('mediveu-site-view') === 'desktop' ? 'desktop' : 'mobile');
  const [showViewToggle, setShowViewToggle] = useState(() => {
    const preference = persistentStore.getItem('mediveu-view-toggle');
    if (preference !== null) return preference !== 'hidden';
    const legacyPreference = sessionStore.getItem('mediveu-view-toggle');
    if (legacyPreference === 'hidden') persistentStore.setItem('mediveu-view-toggle', 'hidden');
    return legacyPreference !== 'hidden';
  });

  const [userDoc, setUserDoc] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [membership, setMembership] = useState(null);
  const [storeSetupError, setStoreSetupError] = useState(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [setupRunning, setSetupRunning] = useState(false);
  const [settings, setSettings] = useState({});
  const [inventory, setInventory] = useState([]);
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type, key: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    viewport.content = siteView === 'desktop'
      ? 'width=1024, initial-scale=1, viewport-fit=cover'
      : 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    document.documentElement.classList.toggle('site-view-desktop', siteView === 'desktop');
    sessionStore.setItem('mediveu-site-view', siteView);
  }, [siteView]);

  useEffect(() => {
    const onPop = () => setView(isAdminRoute() ? 'admin' : (auth.currentUser ? 'tenant' : 'public'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    const nextUid = u?.uid || null;
    if (lastAuthUidRef.current !== nextUid) {
      setUserDoc(null);
      setStoreData(null);
      setMembership(null);
      setStoreSetupError(null);
      setSettings({});
      setInventory([]);
      setBills([]);
      setCustomers([]);
      setSuppliers([]);
    }
    lastAuthUidRef.current = nextUid;
    setUser(u);
    setAuthObserverError('');
    setAuthReady(true);
    if (isAdminRoute()) return;
    if (u) {
      setView('tenant');
      setPath((p) => (['home', 'features', 'pricing', 'contact', 'login', 'register'].includes(p) ? 'dashboard' : p));
    } else {
      setView('public');
    }
  }, (error) => {
    console.error('Authentication state observer failed', error);
    setAuthObserverError(readableFirebaseError(error, 'Your sign-in state could not be verified. Reload the app and try again.'));
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!user || view !== 'tenant') return undefined;
    let active = true;
    const unsubs = [];
    const onErr = (label) => (error) => {
      console.error(`Listener ${label} failed`, error);
      if (!active) return;
      const described = describeSetupError(error);
      setStoreSetupError({ ...described, title: `Could not load ${label}`, retryable: true });
    };

    const accessError = (error, message) => {
      const described = describeSetupError(error);
      return { ...described, title: 'Store access unavailable', message: message || described.message, retryable: true };
    };

    const bootstrap = async () => {
      setMembership(null);
      setStoreSetupError(null);
      setSetupRunning(true);
      try {
        let registration = {};
        try {
          registration = JSON.parse(sessionStore.getItem('mediveu-registration') || '{}');
        } catch {
          registration = {};
        }
        const context = await setupStoreForUser(user, {
          invitationCode: registration.invitationCode || '',
          storeName: registration.storeName || '',
          phone: registration.phone || '',
        });
        if (!active) return;
        if (!context?.storeId) throw Object.assign(new Error('Client-side store setup returned no store.'), { code: 'failed-precondition' });
        sessionStore.removeItem('mediveu-registration');
        setStoreSetupError(null);
        const storeId = context.storeId;

        unsubs.push(onSnapshot(doc(db, 'users', user.uid), (snapshot) => setUserDoc(snapshot.exists() ? snapshot.data() : {}), onErr('account')));
        unsubs.push(onSnapshot(storeDocument(storeId, 'members', user.uid), (snapshot) => {
          if (!active) return;
          const member = snapshot.data();
          if (member?.status === 'active' && ['owner','manager','worker','accountant'].includes(member.role)) setMembership(member);
          else { setMembership(null); setStoreSetupError(accessError(null, 'Your store membership is not active. Contact the store owner.')); }
        }, (error) => {
          console.error('Membership listener failed', error);
          if (active) { setMembership(null); setStoreSetupError(accessError(error)); }
        }));
        unsubs.push(onSnapshot(doc(db, 'stores', storeId), (snapshot) => setStoreData(snapshot.exists() ? snapshot.data() : null), onErr('store')));
        unsubs.push(onSnapshot(storeCollection(storeId, 'settings'), (snapshot) => {
          const next = {};
          snapshot.docs.forEach((document) => { next[document.id] = document.data(); });
          setSettings(next);
        }, onErr('settings')));
        unsubs.push(onSnapshot(storeCollection(storeId, 'inventory'), (snapshot) => setInventory(docsOf(snapshot)), onErr('inventory')));
        unsubs.push(onSnapshot(storeCollection(storeId, 'bills'), (snapshot) => setBills(docsOf(snapshot)), onErr('bills')));
        unsubs.push(onSnapshot(storeCollection(storeId, 'customers'), (snapshot) => setCustomers(docsOf(snapshot)), onErr('customers')));
      } catch (error) {
        const described = describeSetupError(error);
        console.error('Store setup failed', { code: described.code, details: error?.details, message: error?.message });
        if (active) setStoreSetupError(described);
      } finally {
        if (active) setSetupRunning(false);
      }
    };

    bootstrap();
    return () => { active = false; unsubs.forEach((unsubscribe) => unsubscribe()); };
  }, [user, view, bootstrapAttempt]);

  const navigate = useCallback((nextView, nextPath) => {
    const v = nextView === 'app' ? 'tenant' : nextView;
    setView(v);
    if (nextPath) setPath(nextPath === 'pos' ? 'billing' : nextPath);
    const url = v === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== url) window.history.pushState({}, '', url);
    if (v !== 'admin') {
      setIsAdminAuth(false);
      sessionStore.removeItem('mediveu-admin');
    }
    window.scrollTo(0, 0);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      setUserDoc(null);
      setStoreData(null); setMembership(null); setStoreSetupError(null);
      setBills([]); setInventory([]); setCustomers([]); setSuppliers([]); setSettings({});
      navigate('public', 'home');
      showToast('Logged out');
    } catch (error) {
      showToast(readableFirebaseError(error, 'Could not sign out. Please retry.'), 'error');
    }
  }, [navigate, showToast]);

  useEffect(() => {
    if (!user || view !== 'tenant' || !userDoc?.storeId || !membership || membership.role === 'worker') {
      setSuppliers([]);
      return undefined;
    }
    return onSnapshot(
      storeCollection(userDoc.storeId, 'suppliers'),
      (snapshot) => setSuppliers(docsOf(snapshot)),
      (error) => {
        console.error('Listener suppliers failed', error);
        const described = describeSetupError(error);
        setStoreSetupError({ ...described, title: 'Could not load suppliers', retryable: true });
      },
    );
  }, [user?.uid, view, userDoc?.storeId, membership?.role]);

  const userData = useMemo(() => {
    const subscription = storeData?.subscription || userDoc?.subscription || {};
    const createdFallback = user?.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
    return {
      ...(userDoc || {}),
      ...(storeData || {}),
      storeId: userDoc?.storeId || storeData?.storeId || null,
      role: membership?.role || userDoc?.role || 'worker',
      email: userDoc?.email || user?.email || '',
      plan: storeData?.plan || subscription?.plan || userDoc?.plan || '7 Days Free Trial',
      status: storeData?.status || subscription?.status || userDoc?.status || 'Active',
      subscriptionEndsAt: storeData?.subscriptionEndsAt || subscription?.endsAt || userDoc?.subscriptionEndsAt || null,
      referralCode: storeData?.referralCode || userDoc?.referralCode || null,
      referrals: Array.isArray(storeData?.referrals) ? storeData.referrals : [],
      createdAt: storeData?.createdAt || userDoc?.createdAt || createdFallback,
      settings: settings || {},
    };
  }, [userDoc, storeData, membership, settings, user]);

  const handleAdminLogin = (ok) => {
    setIsAdminAuth(ok);
    if (ok) sessionStore.setItem('mediveu-admin', '1');
  };

  const switchSiteView = () => setSiteView((current) => current === 'mobile' ? 'desktop' : 'mobile');
  const ViewIcon = siteView === 'mobile' ? Monitor : Smartphone;

  let content;
  if (firebaseConfigError) {
    content = (
      <main className="min-h-dvh grid place-items-center bg-ink-950 p-6">
        <section role="alert" className="max-w-xl rounded-2xl border border-red-400/30 bg-red-950/30 p-6 text-center">
          <h1 className="text-lg font-bold text-white">App configuration is incomplete</h1>
          <p className="mt-2 text-sm text-slate-300">{firebaseConfigError}</p>
          <p className="mt-3 text-xs text-slate-400">Set the Firebase web configuration in the Vercel project environment variables, then redeploy.</p>
        </section>
      </main>
    );
  } else if (authObserverError) {
    content = (
      <main className="min-h-dvh grid place-items-center bg-ink-950 p-6">
        <section role="alert" className="max-w-xl rounded-2xl border border-red-400/30 bg-red-950/30 p-6 text-center">
          <h1 className="text-lg font-bold text-white">Sign-in state unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">{authObserverError}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Reload app</button>
        </section>
      </main>
    );
  } else if (view === 'admin') {
    content = isAdminAuth ? <AdminPanel navigate={navigate} /> : <AdminLogin onLogin={handleAdminLogin} navigate={navigate} />;
  } else if (!authReady || (user && view === 'tenant' && (!userDoc || !membership) && !storeSetupError)) {
    content = <FullScreenLoader />;
  } else if (view === 'tenant' && user && storeSetupError) {
    content = (
      <StoreSetupError
        error={storeSetupError}
        running={setupRunning}
        onRetry={() => { if (!setupRunning) setBootstrapAttempt((attempt) => attempt + 1); }}
        onSignOut={handleLogout}
      />
    );
  } else if (view === 'tenant' && user) {
    content = (
      <TenantApp
        user={{ ...user, storeId: userData.storeId, role: userData.role }}
        userData={userData}
        path={path}
        setPath={setPath}
        navigate={navigate}
        showToast={showToast}
        onLogout={handleLogout}
        data={{ inventory, bills, customers, suppliers }}
        showViewToggle={showViewToggle}
        siteView={siteView}
        onSwitchSiteView={switchSiteView}
        onHideViewToggle={() => { persistentStore.setItem('mediveu-view-toggle', 'hidden'); setShowViewToggle(false); }}
        onShowViewToggle={() => { persistentStore.removeItem('mediveu-view-toggle'); sessionStore.removeItem('mediveu-view-toggle'); setShowViewToggle(true); }}
      />
    );
  } else {
    content = <PublicSite navigate={navigate} showToast={showToast} tab={path} setTab={setPath} />;
  }

  return (
    <>
      <Suspense fallback={<FullScreenLoader />}>{content}</Suspense>
      {showViewToggle && view !== 'tenant' && (
        <div className={`view-mode-toggle no-print ${view === 'public' ? 'view-mode-toggle-public' : ''}`}>
          <button className="view-mode-toggle-action" type="button" onClick={switchSiteView}
            aria-label={`Switch to ${siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}`}>
            <ViewIcon size={16} aria-hidden="true" />
            <span>{siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}</span>
          </button>
          <button className="view-mode-toggle-dismiss" type="button" onClick={() => { persistentStore.setItem('mediveu-view-toggle', 'hidden'); setShowViewToggle(false); }} aria-label="Hide view toggle" title="Hide view toggle">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      {!showViewToggle && <button type="button" className="view-mode-restore no-print" onClick={() => { persistentStore.removeItem('mediveu-view-toggle'); sessionStore.removeItem('mediveu-view-toggle'); setShowViewToggle(true); }} aria-label="Restore view switcher" title="Restore view switcher"><Eye size={16} aria-hidden="true" /><span>View</span></button>}
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={closeToast} />}
    </>
  );
}

export default function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/promote-assets') {
    return <Suspense fallback={<FullScreenLoader />}><PromotionHub /></Suspense>;
  }
  return <AuthenticatedApp />;
}
