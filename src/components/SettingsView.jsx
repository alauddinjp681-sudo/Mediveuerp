import React, { useState } from 'react';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Download, Upload, Save } from 'lucide-react';
import { db } from '../firebase';
import { Button, Card, Field, PageHeader } from './ui';
import { TEMPLATES } from './invoice-templates';
import TeamAccess from './TeamAccess';
import { storeCollection, storeDocument } from '../lib/storeAccess';

const GENERAL_FIELDS = [
  ['storeName', 'Store Name', 'sm:col-span-2'],
  ['tagline', 'Tagline (optional)', 'sm:col-span-2'],
  ['address', 'Address', 'sm:col-span-2'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['gstin', 'GSTIN'],
  ['dlNumber', 'Drug License No.'],
  ['stateName', 'State'],
  ['upiId', 'UPI ID (for QR on bill)'],
];

const BANK_FIELDS = [['bankName', 'Bank Name'], ['accountNo', 'Account No.'], ['ifsc', 'IFSC'], ['branch', 'Branch']];

export default function SettingsView({ user, userData, data, showToast }) {
  const s = userData?.settings || {};
  const [general, setGeneral] = useState(() => ({ ...Object.fromEntries(GENERAL_FIELDS.map(([k]) => [k, ''])), ...Object.fromEntries(BANK_FIELDS.map(([k]) => [k, ''])), terms: '', ...(s.general || {}) }));
  const [invoice, setInvoice] = useState(() => ({ prefix: 'INV', defaultTemplate: 'pharma', ...(s.invoice || {}) }));

  const save = (e) => {
    e.preventDefault();
    Promise.all([
      setDoc(storeDocument(user.storeId, 'settings', 'general'), general, { merge: true }),
      setDoc(storeDocument(user.storeId, 'settings', 'invoice'), invoice, { merge: true }),
    ]).catch(() => showToast('Failed to sync settings', 'error'));
    showToast('Settings saved');
  };

  const exportBackup = async () => {
    try {
      const { generateZipBackup } = await import('../utils/backupExporter');
      await generateZipBackup({ settings: s, medicines: data.inventory, bills: data.bills, customers: data.customers, suppliers: data.suppliers, exportDate: new Date().toISOString() }, general.storeName);
      showToast('Backup downloaded');
    } catch (err) {
      console.error(err);
      showToast('Error creating backup', 'error');
    }
  };

  const importBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.exportDate) throw new Error('invalid');
        const batch = writeBatch(db);
        const put = (name, list) => (list || []).forEach(({ id, ...rest }) => batch.set(id ? storeDocument(user.storeId, name, id) : doc(storeCollection(user.storeId, name)), rest, { merge: true }));
        put('inventory', imported.inventory || imported.medicines);
        put('bills', imported.bills);
        put('customers', imported.customers);
        put('suppliers', imported.suppliers);
        if (imported.settings?.general) batch.set(storeDocument(user.storeId, 'settings', 'general'), imported.settings.general, { merge: true });
        batch.commit().catch(() => showToast('Restore sync failed', 'error'));
        showToast('Backup restored');
      } catch {
        showToast('Invalid or corrupted backup file', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const g = (k) => (ev) => setGeneral((p) => ({ ...p, [k]: ev.target.value }));

  return (
    <form onSubmit={save} className="max-w-4xl mx-auto space-y-5">
      <PageHeader title="Settings" subtitle="Store profile, invoice defaults and backup" actions={<Button type="submit"><Save size={16} /> Save</Button>} />

      <Card className="p-5">
        <h2 className="font-bold text-white mb-4">Store profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {GENERAL_FIELDS.map(([k, label, cls]) => <Field key={k} label={label} value={general[k]} onChange={g(k)} className={cls} required={k === 'storeName'} />)}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-white mb-4">Bank details & terms (shown on invoices)</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {BANK_FIELDS.map(([k, label]) => <Field key={k} label={label} value={general[k]} onChange={g(k)} />)}
          <Field as="textarea" rows={3} label="Terms & Conditions" value={general.terms} onChange={g('terms')} className="sm:col-span-2" placeholder="1. Goods once sold will not be taken back." />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-white mb-4">Invoice defaults</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Invoice Prefix" value={invoice.prefix} onChange={(e) => setInvoice((p) => ({ ...p, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9/]/g, '') }))} />
          <Field as="select" label="Default Template" value={invoice.defaultTemplate} onChange={(e) => setInvoice((p) => ({ ...p, defaultTemplate: e.target.value }))}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.paper})</option>)}
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-white mb-1">Backup & restore</h2>
        <p className="text-sm text-slate-400 mb-4">Download your full data as a ZIP (CSV + JSON) or restore from a JSON backup.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" onClick={exportBackup}><Download size={16} /> Download Backup</Button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} /> Restore from JSON
            <input type="file" accept=".json,application/json" onChange={importBackup} className="sr-only" />
          </label>
        </div>
      </Card>

      {userData?.role === 'owner' && <TeamAccess user={user} showToast={showToast} />}
    </form>
  );
}
