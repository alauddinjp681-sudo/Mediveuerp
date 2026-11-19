import { toNumber } from './format';

export const emptyItem = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  inventoryId: '',
  description: '',
  hsn: '',
  batch: '',
  expiry: '',
  mrp: '',
  qty: 1,
  free: '',
  rate: '',
  disPercent: '',
  gstPercent: 12,
  unit: 'PCS',
});

export function calcLine(item) {
  const qty = toNumber(item.qty);
  const rate = toNumber(item.rate);
  const gross = qty * rate;
  const discount = (gross * toNumber(item.disPercent)) / 100;
  const taxable = gross - discount;
  const gst = (taxable * toNumber(item.gstPercent)) / 100;
  return { qty, rate, gross, discount, taxable, gst, total: taxable + gst };
}

export function calcTotals(items, { taxMode = 'intra', extraDiscount = 0, roundOff = true } = {}) {
  let gross = 0;
  let discount = 0;
  let taxableValue = 0;
  let gstTotal = 0;
  let totalQty = 0;
  const slabs = {};

  items.forEach((item) => {
    if (!item.description && !toNumber(item.rate)) return;
    const line = calcLine(item);
    gross += line.gross;
    discount += line.discount;
    taxableValue += line.taxable;
    gstTotal += line.gst;
    totalQty += line.qty;
    const key = toNumber(item.gstPercent);
    if (!slabs[key]) slabs[key] = { rate: key, taxable: 0, gst: 0 };
    slabs[key].taxable += line.taxable;
    slabs[key].gst += line.gst;
  });

  const extra = Math.min(toNumber(extraDiscount), taxableValue + gstTotal);
  const beforeRound = taxableValue + gstTotal - extra;
  const grandTotal = roundOff ? Math.round(beforeRound) : beforeRound;
  const isInter = taxMode === 'inter';

  return {
    gross,
    discount,
    extraDiscount: extra,
    taxableValue,
    gstTotal,
    cgst: isInter ? 0 : gstTotal / 2,
    sgst: isInter ? 0 : gstTotal / 2,
    igst: isInter ? gstTotal : 0,
    totalQty,
    roundOff: grandTotal - beforeRound,
    grandTotal,
    slabs: Object.values(slabs).sort((a, b) => a.rate - b.rate),
  };
}

export function nextInvoiceNumber(bills, prefix = 'INV') {
  const year = new Date().getFullYear().toString().slice(2);
  const literalPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${literalPrefix}-${year}-(\\d+)$`);
  const max = bills.reduce((acc, b) => {
    const m = String(b.invoiceDetails?.invoiceNumber || '').match(pattern);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

export const DOCUMENT_TYPES = [
  { id: 'tax-invoice', label: 'Tax Invoice' },
  { id: 'bill-of-supply', label: 'Bill of Supply' },
  { id: 'cash-memo', label: 'Cash Memo' },
  { id: 'estimate', label: 'Estimate / Quotation' },
  { id: 'proforma', label: 'Proforma Invoice' },
  { id: 'delivery-challan', label: 'Delivery Challan' },
];

export const documentLabel = (id) => DOCUMENT_TYPES.find((d) => d.id === id)?.label || 'Tax Invoice';
