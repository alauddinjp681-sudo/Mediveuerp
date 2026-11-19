import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const STORE_ROLES = ['owner', 'manager', 'worker', 'accountant'];

export const ROLE_LABELS = {
  owner: 'Shop Owner',
  manager: 'Manager',
  worker: 'Worker (Staff)',
  accountant: 'Accountant / Client (read-only)',
};

export const ROLE_VIEWS = {
  owner: ['dashboard', 'billing', 'inventory', 'customers', 'suppliers', 'supplierLedger', 'purchaseEntry', 'reports', 'team', 'plans', 'referrals', 'settings'],
  manager: ['dashboard', 'billing', 'inventory', 'customers', 'suppliers', 'supplierLedger', 'purchaseEntry', 'reports', 'referrals'],
  worker: ['dashboard', 'billing', 'inventory', 'customers'],
  accountant: ['dashboard', 'billing', 'customers', 'suppliers', 'supplierLedger', 'reports'],
};

export const canAccessView = (role, view) => (ROLE_VIEWS[role] || ROLE_VIEWS.worker).includes(view);
export const canManageStore = (role) => role === 'owner' || role === 'manager';
export const canManageTeam = (role) => role === 'owner';
export const canEditInventory = (role) => role === 'owner' || role === 'manager';
export const canManageBills = (role) => role === 'owner' || role === 'manager';
export const isReadOnlyRole = (role) => role === 'accountant';

export const storeCollection = (storeId, name) => collection(db, 'stores', storeId, name);
export const storeDocument = (storeId, name, id) => doc(db, 'stores', storeId, name, id);
