import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Monitor, Smartphone } from 'lucide-react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';
import { storeCollection, storeDocument } from './lib/storeAccess';
import { describeSetupError } from './lib/setupError';
import { Toast, Spinner, BrandMark } from './components/ui';
import PublicSite from './components/public/PublicSite';
import StoreSetupError from './components/StoreSetupError';

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

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState(isAdminRoute() ? 'admin' : 'public');
  const [path, setPath] = useState('home');
  const [toast, setToast] = useState(null);
  const [isAdminAuth, setIsAdminAuth] = useState(() => sessionStorage.getItem('mediveu-admin') === '1');
  const [siteView, setSiteView] = useState(() => sessionStorage.getItem('mediveu-site-view') === 'desktop' ? 'desktop' : 'mobile');

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
    sessionStorage.setItem('mediveu-site-view', siteView);
  }, [siteView]);

  useEffect(() => {
    const onPop = () => setView(isAdminRoute() ? 'admin' : (auth.currentUser ? 'tenant' : 'public'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthReady(true);
    if (isAdminRoute()) return;
    if (u) {
      setView('tenant');
      setPath((p) => (['home', 'features', 'pricing', 'contact', 'login', 'register'].includes(p) ? 'dashboard' : p));
    } else {
      setView('public');
    }
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

    const callEnsureStore = async (payload) => {
      const ensureStore = httpsCallable(functions, 'ensureStore', { timeout: 540000 });
      try {
        return await ensureStore(payload);
      } catch (error) {
        if (!active || !describeSetupError(error).autoRetry) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!active) throw error;
        return ensureStore(payload);
      }
    };

    const bootstrap = async () => {
      setMembership(null);
      setStoreSetupError(null);
      setSetupRunning(true);
      try {
        let registration = {};
        try {
          registration = JSON.parse(sessionStorage.getItem('mediveu-registration') || '{}');
        } catch {
          registration = {};
        }
        const { data: context } = await callEnsureStore({
          invitationCode: registration.invitationCode || '',
          registration: { storeName: registration.storeName || '', phone: registration.phone || '' },
        });
        if (!active) return;
        if (!context?.storeId) throw Object.assign(new Error('The setup service returned no store.'), { code: 'failed-precondition' });
        sessionStorage.removeItem('mediveu-registration');
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
        unsubs.push(onSnapshot(storeCollection(storeId, 'suppliers'), (snapshot) => setSuppliers(docsOf(snapshot)), onErr('suppliers')));
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
      sessionStorage.removeItem('mediveu-admin');
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
    } catch {
      showToast('Error logging out', 'error');
    }
  }, [navigate, showToast]);

  const userData = useMemo(() => {
    const createdFallback = user?.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
    return {
      ...(userDoc || {}),
      ...(storeData || {}),
      storeId: userDoc?.storeId,
      role: membership?.role,
      email: userDoc?.email || user?.email,
      plan: storeData?.plan || userDoc?.plan || '7 Days Free Trial',
      status: storeData?.status || userDoc?.status || 'Active',
      createdAt: storeData?.createdAt || userDoc?.createdAt || createdFallback,
      settings,
    };
  }, [userDoc, storeData, membership, settings, user]);

  const handleAdminLogin = (ok) => {
    setIsAdminAuth(ok);
    if (ok) sessionStorage.setItem('mediveu-admin', '1');
  };

  let content;
  if (view === 'admin') {
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
      />
    );
  } else {
    content = <PublicSite navigate={navigate} showToast={showToast} tab={path} setTab={setPath} />;
  }

  const switchSiteView = () => setSiteView((current) => current === 'mobile' ? 'desktop' : 'mobile');
  const ViewIcon = siteView === 'mobile' ? Monitor : Smartphone;

  return (
    <>
      <Suspense fallback={<FullScreenLoader />}>{content}</Suspense>
      <button className={`view-mode-toggle no-print ${view === 'public' ? 'view-mode-toggle-public' : ''}`} type="button" onClick={switchSiteView}
        aria-label={`Switch to ${siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}`}>
        <ViewIcon size={16} aria-hidden="true" />
        <span>{siteView === 'mobile' ? 'Desktop Site View' : 'Mobile View'}</span>
      </button>
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={closeToast} />}
    </>
  );
}
