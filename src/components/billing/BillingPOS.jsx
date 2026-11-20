import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  FileDown,
  FilePlus2,
  History,
  LayoutTemplate,
  Mic,
  PencilLine,
  Printer,
  Receipt,
  Save,
  Share2,
} from 'lucide-react';
import { Badge, Button, Card, Field, cn } from '../ui';
import {
  calcTotals,
  documentLabel,
  emptyItem,
  nextInvoiceNumber,
} from '../../lib/invoice';
import { formatMoney, todayISO } from '../../lib/format';
import { isPlanBlocked } from '../../lib/plan';
import { ACCENTS, getTemplate, TEMPLATES } from '../invoice-templates';
import InvoicePreview from '../invoice-templates/InvoicePreview';
import ItemsEditor, { fromInventory } from './ItemsEditor';
import VoiceBillingAssistant from './VoiceBillingAssistant';
import TemplatePicker from './TemplatePicker';
import BillRegister from './BillRegister';
import BillHistory from './BillHistory';
import BillDetails from './BillDetails';
import { saveBill } from './saveBill';
import { downloadPdf, printInvoice, shareInvoice } from './exportInvoice';

const blankBuyer = {
  name: '',
  phone: '',
  address: '',
  gstin: '',
  dlNumber: '',
  stateName: '',
};
export default function BillingPOS(props) {
  const [selected, select] = useState(props.editBill || null);
  const [key, setKey] = useState(0);
  const [register, setRegister] = useState(
    props.user.role === 'accountant' && !props.editBill,
  );
  const open = (bill) => {
    select(bill);
    setKey((n) => n + 1);
    setRegister(false);
  };
  if (register)
    return (
      <div className="grid gap-4">
        {props.user.role !== 'accountant' && (
          <Button className="justify-self-start" onClick={() => open(null)}>
            <FilePlus2 size={16} /> New invoice
          </Button>
        )}
        <BillRegister bills={props.bills} onOpen={open} />
      </div>
    );
  return (
    <Counter
      key={key}
      {...props}
      selected={selected}
      showRegister={() => setRegister(true)}
      newBill={() => open(null)}
    />
  );
}

function Counter({
  selected,
  user,
  userData,
  bills,
  inventory,
  customers,
  showToast,
  showRegister,
  newBill,
  navigate,
}) {
  const general = userData.settings?.general || {};
  const settings = userData.settings?.invoice || {};
  const templateChoices = Array.isArray(settings.allowedTemplates)
    ? TEMPLATES.filter((template) => settings.allowedTemplates.includes(template.id))
    : TEMPLATES;
  const defaultTemplate = templateChoices.find((template) => template.id === settings.defaultTemplate)?.id || templateChoices[0]?.id || 'pharma';
  const [previous, setPrevious] = useState(selected);
  const canWrite =
    ['owner', 'manager', 'worker'].includes(user.role) &&
    !(
      user.role === 'worker' &&
      previous &&
      (previous.status !== 'draft' || previous.createdBy !== user.uid)
    );
  const [templateId, setTemplate] = useState(
    selected?.templateName || defaultTemplate,
  );
  const [accent, setAccent] = useState(
    selected?.options?.accent || settings.accent || ACCENTS[0],
  );
  const [taxMode, setTaxMode] = useState(selected?.options?.taxMode || 'intra');
  const [extraDiscount, setDiscount] = useState(
    selected?.options?.extraDiscount || '',
  );
  const [buyer, setBuyer] = useState({
    ...blankBuyer,
    ...selected?.buyerDetails,
  });
  const [invoice, setInvoice] = useState({
    date: todayISO(),
    dueDate: '',
    paymentMode: 'Cash',
    docType: 'tax-invoice',
    notes: '',
    placeOfSupply: general.stateName || '',
    ...selected?.invoiceDetails,
  });
  const workerPrefix = user.role === 'worker'
    ? `${settings.prefix || 'INV'}-${user.uid.slice(0, 4).toUpperCase()}`
    : settings.prefix || 'INV';
  const number = invoice.invoiceNumber ?? nextInvoiceNumber(bills, workerPrefix);
  const [items, setItems] = useState(() =>
    selected?.items?.length
      ? selected.items.map((i) => ({
          ...emptyItem(),
          ...i,
          batch: i.batch || i.code || '',
        }))
      : [emptyItem()],
  );
  const [picker, setPicker] = useState(false);
  const [voice, setVoice] = useState(false);
  const [tab, setTab] = useState('edit');
  const [busy, setBusy] = useState('');
  const [dirty, setDirty] = useState(false);
  const pending = useRef(false);
  const paper = useRef(null);
  const locked = isPlanBlocked(userData);
  const template = getTemplate(templateId);
  const totals = useMemo(
    () => calcTotals(items, { taxMode, extraDiscount }),
    [items, taxMode, extraDiscount],
  );
  const details = { ...invoice, invoiceNumber: number };
  const docData = {
    store: general,
    buyer,
    invoice: details,
    items,
    totals,
    options: { accent, taxMode },
  };
  const leave = (callback) => {
    if (
      !pending.current &&
      (!dirty || window.confirm('Discard unsaved invoice changes?'))
    )
      callback();
  };
  async function save(status) {
    if (pending.current || !canWrite || locked || !user.storeId) return;
    pending.current = true;
    setBusy('save');
    try {
      const result = await saveBill({
        user,
        previous,
        status,
        bills,
        customers,
        inventory,
        buyer,
        invoice: details,
        items,
        templateId,
        options: { accent, taxMode, extraDiscount: Number(extraDiscount) },
      });
      setPrevious(result);
      setInvoice(result.invoiceDetails);
      setDirty(false);
      showToast(
        status === 'draft'
          ? 'Draft saved. Stock and ledgers are unchanged.'
          : 'Invoice and sale records saved.',
      );
    } catch (error) {
      showToast(
        error.code === 'permission-denied'
          ? 'Save declined. Reopen the invoice to check its latest revision and your permissions.'
          : error.message || 'Could not save invoice.',
        'error',
      );
    } finally {
      pending.current = false;
      setBusy('');
    }
  }
  const print = () => {
    setTab('preview');
    requestAnimationFrame(() => printInvoice(template.paper));
  };
  async function exportBill(kind) {
    if (!paper.current || busy) return;
    setBusy(kind);
    const name = `${number}-${buyer.name || 'cash'}`.replace(/[^\w-]/g, '_');
    try {
      if (kind === 'pdf') await downloadPdf(paper.current, name);
      else
        await shareInvoice(paper.current, name, {
          phone: buyer.phone,
          text: `${documentLabel(invoice.docType)} ${number} · ${general.storeName || 'Mediveu ERP'} · ${formatMoney(totals.grandTotal)}`,
        });
    } catch {
      showToast('Could not export the invoice.', 'error');
    } finally {
      setBusy('');
    }
  }
  useEffect(() => {
    function shortcut(e) {
      if (locked || picker || busy || e.repeat) return;
      if (!['F2', 'F3', 'F4', 'F9'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'F2' && canWrite) save('final');
      if (e.key === 'F3' && canWrite) {
        setTab('edit');
        requestAnimationFrame(() =>
          document.getElementById('product-search')?.focus(),
        );
      }
      if (e.key === 'F4') print();
      if (e.key === 'F9' && user.role !== 'accountant') leave(newBill);
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  function chooseCustomer(name) {
    const match = customers.find(
      (c) => c.name?.toLowerCase() === name.trim().toLowerCase(),
    );
    setBuyer(match ? { ...blankBuyer, ...match } : { ...buyer, name });
  }
  if (locked)
    return (
      <Card>
        <h1 className="text-xl font-bold">Billing is locked</h1>
        <p className="my-3">Ask the store owner to renew the plan.</p>
        {user.role === 'owner' && (
          <Button onClick={() => navigate('plans')}>View plans</Button>
        )}
      </Card>
    );
  return (
    <div className="grid gap-4 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-sky">
            Billing counter
          </p>
          <h1 className="text-2xl font-bold text-white">
            {!canWrite
              ? 'Invoice review'
              : previous
                ? 'Edit invoice'
                : 'New invoice'}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
            <span>{number}</span>
            <Badge>
              {!canWrite
                ? 'Read-only'
                : previous
                  ? previous.status === 'draft'
                    ? 'Draft'
                    : 'Finalized'
                  : 'Unsaved'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={() => leave(showRegister)}
          >
            <History size={16} /> Invoice register
          </Button>
          {user.role !== 'accountant' && (
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => leave(newBill)}
            >
              <FilePlus2 size={16} /> New
            </Button>
          )}
        </div>
      </header>
      {previous && <BillHistory storeId={user.storeId} billId={previous.id} />}
      {canWrite && (
        <div
          role="group"
          aria-label="Workspace view"
          className="flex flex-wrap gap-2 no-print xl:hidden"
        >
          {[
            ['edit', 'Entry', PencilLine],
            ['preview', 'Live preview', Eye],
          ].map(([id, label, Icon]) => (
            <Button
              key={id}
              variant={tab === id ? 'primary' : 'secondary'}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {label}
            </Button>
          ))}
        </div>
      )}
      <div
        className={cn(
          'grid min-w-0 items-start gap-5',
          canWrite && 'xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]',
        )}
      >
        {canWrite && (
          <fieldset
            disabled={Boolean(busy)}
            className={cn(
              'min-w-0 grid gap-4 no-print',
              tab !== 'edit' && 'hidden xl:grid',
            )}
            onChange={() => setDirty(true)}
          >
            <Card>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-bold text-white">Sale items</h2>
                <Button
                  variant="ghost"
                  aria-pressed={voice}
                  onClick={() => setVoice(!voice)}
                >
                  <Mic size={16} /> Voice entry
                </Button>
              </div>
              {voice && (
                <VoiceBillingAssistant
                  inventory={inventory}
                  onApply={({ buyerName, matchedItems }) => {
                    if (buyerName) chooseCustomer(buyerName);
                    setItems((old) => [
                      ...old.filter((i) => i.description),
                      ...matchedItems.map(({ item, quantity }) => ({
                        ...fromInventory(item),
                        qty: quantity,
                      })),
                    ]);
                    setDirty(true);
                    setVoice(false);
                  }}
                />
              )}
              <ItemsEditor
                inventory={inventory}
                items={items}
                setItems={(fn) => {
                  setItems(fn);
                  setDirty(true);
                }}
              />
            </Card>
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Customer"
                  list="buyer-list"
                  value={buyer.name}
                  onChange={(e) => chooseCustomer(e.target.value)}
                  placeholder="Cash Customer"
                />
                <datalist id="buyer-list">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <Field
                  label="Payment mode"
                  as="select"
                  value={invoice.paymentMode}
                  onChange={(e) =>
                    setInvoice({ ...invoice, paymentMode: e.target.value })
                  }
                >
                  {[
                    'Cash',
                    'UPI',
                    'Card',
                    'Credit',
                    'Bank Transfer',
                    'Cheque',
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Field>
              </div>
              <BillDetails
                {...{
                  buyer,
                  setBuyer,
                  invoice: details,
                  setInvoice,
                  taxMode,
                  setTaxMode,
                }}
              />
            </Card>
            <Card>
              <div className="flex flex-wrap justify-between items-end gap-4">
                <div>
                  <p className="text-sm text-slate-400">Grand total</p>
                  <strong className="text-3xl text-brand-green tabular">
                    {formatMoney(totals.grandTotal)}
                  </strong>
                </div>
                <Field
                  label="Extra discount (₹)"
                  className="max-w-40"
                  type="number"
                  min="0"
                  value={extraDiscount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Taxable {formatMoney(totals.taxableValue)} · GST{' '}
                {formatMoney(totals.gstTotal)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(!previous || previous.status === 'draft') && (
                  <Button variant="secondary" onClick={() => save('draft')}>
                    <Save size={16} /> Save draft
                  </Button>
                )}
                <Button onClick={() => save('final')}>
                  <Receipt size={16} />
                  {busy === 'save'
                    ? 'Waiting for sync…'
                    : previous && previous.status !== 'draft'
                      ? 'Update invoice'
                      : 'Complete sale'}
                </Button>
              </div>
            </Card>
          </fieldset>
        )}
        <section
          className={cn(
            'min-w-0',
            canWrite && tab !== 'preview' && 'hidden xl:block',
          )}
          aria-label="Invoice preview"
        >
          <div className="flex flex-wrap gap-2 mb-3 no-print">
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => setPicker(true)}
            >
              <LayoutTemplate size={16} />
              {template.name}
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={print}
            >
              <Printer size={16} /> Print
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => exportBill('pdf')}
            >
              <FileDown size={16} /> PDF
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => exportBill('share')}
            >
              <Share2 size={16} /> Share
            </Button>
          </div>
          <div className="rounded-xl bg-slate-300 p-3 sm:p-5">
            <InvoicePreview ref={paper} doc={docData} templateId={templateId} />
          </div>
        </section>
      </div>
      {picker && (
        <TemplatePicker
          isOpen
          onClose={() => setPicker(false)}
          value={templateId}
          onChange={(v) => {
            setTemplate(v);
            if (canWrite) setDirty(true);
          }}
          accent={accent}
          onAccentChange={(v) => {
            setAccent(v);
            if (canWrite) setDirty(true);
          }}
          sampleDoc={docData}
          templates={templateChoices}
        />
      )}
    </div>
  );
}
