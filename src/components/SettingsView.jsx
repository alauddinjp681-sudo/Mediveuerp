import React, { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { Download, Upload, Save } from 'lucide-react';
import { db } from '../firebase';
import { Button, Card, Field, PageHeader } from './ui';
import { TEMPLATES } from './invoice-templates';
import { storeCollection, storeDocument } from '../lib/storeAccess';
import { readableFirebaseError } from '../lib/firebaseError';

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

export default function SettingsView({ user, userData, data, showToast, navigate }) {
  const s = userData?.settings || {};
  const [general, setGeneral] = useState(() => ({ ...Object.fromEntries(GENERAL_FIELDS.map(([k]) => [k, ''])), ...Object.fromEntries(BANK_FIELDS.map(([k]) => [k, ''])), terms: '', ...(s.general || {}) }));
  const [invoice, setInvoice] = useState(() => ({ prefix: 'INV', defaultTemplate: 'pharma', allowedTemplates: TEMPLATES.map((template) => template.id), ...(s.invoice || {}) }));
  const allowedTemplates = Array.isArray(invoice.allowedTemplates) ? invoice.allowedTemplates : TEMPLATES.map((template) => template.id);
  const toggleTemplate = (templateId) => setInvoice((current) => {
    const currentAllowed = Array.isArray(current.allowedTemplates) ? current.allowedTemplates : TEMPLATES.map((template) => template.id);
    const nextAllowed = currentAllowed.includes(templateId)
      ? currentAllowed.filter((id) => id !== templateId)
      : [...currentAllowed, templateId];
    if (!nextAllowed.length) return current;
    return {
      ...current,
      allowedTemplates: nextAllowed,
      defaultTemplate: nextAllowed.includes(current.defaultTemplate) ? current.defaultTemplate : nextAllowed[0],
    };
  });

  const save = async (e) => {
    e.preventDefault();
    try {
      const batch = writeBatch(db);
      batch.set(storeDocument(user.storeId, 'settings', 'general'), general, { merge: true });
      batch.set(storeDocument(user.storeId, 'settings', 'invoice'), invoice, { merge: true });
      await batch.commit();
      showToast('Settings saved');
    } catch (error) {
      showToast(readableFirebaseError(error, 'Settings could not be saved.'), 'error');
    }
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
    const input = e.target;
    const reader = new FileReader();
    reader.onload = async (event) => {
      let imported;
      try {
        imported = JSON.parse(event.target.result);
        if (!imported.exportDate) throw new Error('invalid');
        for (const list of [imported.inventory || imported.medicines, imported.bills, imported.customers, imported.suppliers]) {
          if (list !== undefined && !Array.isArray(list)) throw new Error('invalid');
        }
      } catch {
        showToast('Invalid or corrupted backup file', 'error');
        input.value = '';
        return;
      }

      try {
        const batch = writeBatch(db);
        const put = (name, list) => (list || []).forEach(({ id, ...rest }) => batch.set(id ? storeDocument(user.storeId, name, id) : doc(storeCollection(user.storeId, name)), rest, { merge: true }));
        put('inventory', imported.inventory || imported.medicines);
        put('bills', imported.bills);
        put('customers', imported.customers);
        put('suppliers', imported.suppliers);
        if (imported.settings?.general) batch.set(storeDocument(user.storeId, 'settings', 'general'), imported.settings.general, { merge: true });
        await batch.commit();
        showToast('Backup restored');
      } catch (error) {
        showToast(readableFirebaseError(error, 'Backup restore failed. No records were confirmed as restored.'), 'error');
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      showToast('The backup file could not be read.', 'error');
      input.value = '';
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
            {TEMPLATES.filter((template) => allowedTemplates.includes(template.id)).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.paper})</option>)}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Templates available to staff</legend>
            <p className="mb-3 text-xs text-slate-500">Choose which print layouts workers can use. At least one template must remain enabled.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((template) => (
                <label key={template.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-ink-950/50 p-3 text-sm text-slate-200">
                  <input type="checkbox" checked={allowedTemplates.includes(template.id)} disabled={allowedTemplates.length === 1 && allowedTemplates.includes(template.id)} onChange={() => toggleTemplate(template.id)} className="mt-0.5 accent-cyan-400" />
                  <span>{template.name}<span className="ml-1 text-xs text-slate-500">{template.paper}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-white mb-1">Legal information</h2>
        <p className="mb-3 text-sm text-slate-400">Review how account and store data is handled, and the terms for using MEDIVEU ERP.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate?.('privacy')}>Privacy Policy</Button>
          <Button type="button" variant="secondary" onClick={() => navigate?.('terms')}>Terms &amp; Conditions</Button>
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

    </form>
  );
}
