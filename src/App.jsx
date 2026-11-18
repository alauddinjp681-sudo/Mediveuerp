import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Toast, Spinner, BrandMark } from './components/ui';
import PublicSite from './components/public/PublicSite';

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

  const [userDoc, setUserDoc] = useState(null);
  const [settings, setSettings] = useState({});
  const [inventory, setInventory] = useState([]);
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type, key: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);

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
    const uid = user.uid;
    const fallback = setTimeout(() => setUserDoc((d) => d || {}), 5000);
    const onErr = (label) => (err) => console.error(`Listener ${label} failed`, err);
    const unsubs = [
      onSnapshot(doc(db, 'users', uid), (s) => setUserDoc(s.exists() ? s.data() : {}), (e) => { onErr('user')(e); setUserDoc((d) => d || {}); }),
      onSnapshot(collection(db, 'users', uid, 'settings'), (s) => {
        const next = {};
        s.docs.forEach((d) => { next[d.id] = d.data(); });
        setSettings(next);
      }, onErr('settings')),
      onSnapshot(collection(db, 'users', uid, 'inventory'), (s) => setInventory(docsOf(s)), onErr('inventory')),
      onSnapshot(collection(db, 'users', uid, 'bills'), (s) => setBills(docsOf(s)), onErr('bills')),
      onSnapshot(collection(db, 'users', uid, 'customers'), (s) => setCustomers(docsOf(s)), onErr('customers')),
      onSnapshot(collection(db, 'users', uid, 'suppliers'), (s) => setSuppliers(docsOf(s)), onErr('suppliers')),
    ];
    return () => { clearTimeout(fallback); unsubs.forEach((u) => u()); };
  }, [user, view]);

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
      email: userDoc?.email || user?.email,
      plan: userDoc?.plan || '7 Days Free Trial',
      status: userDoc?.status || 'Active',
      createdAt: userDoc?.createdAt || createdFallback,
      settings,
    };
  }, [userDoc, settings, user]);

  const handleAdminLogin = (ok) => {
    setIsAdminAuth(ok);
    if (ok) sessionStorage.setItem('mediveu-admin', '1');
  };

  let content;
  if (view === 'admin') {
    content = isAdminAuth ? <AdminPanel navigate={navigate} /> : <AdminLogin onLogin={handleAdminLogin} navigate={navigate} />;
  } else if (!authReady || (user && view === 'tenant' && userDoc === null)) {
    content = <FullScreenLoader />;
  } else if (view === 'tenant' && user) {
    content = (
      <TenantApp
        user={user}
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

  return (
    <>
      <Suspense fallback={<FullScreenLoader />}>{content}</Suspense>
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={closeToast} />}
    </>
  );
}
