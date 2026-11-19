import {
  collection,
  doc,
  getDocsFromServer,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { storeCollection, storeDocument } from '../../lib/storeAccess';
import { calcTotals, documentLabel } from '../../lib/invoice';
import {
  stockChanges,
  validateLines,
  changeLabels,
} from '../../lib/billRevision.js';

export async function saveBill({
  user,
  previous,
  status,
  bills,
  customers,
  inventory,
  buyer,
  invoice,
  items,
  templateId,
  options,
}) {
  if (
    !['owner', 'manager', 'worker'].includes(user.role) ||
    (previous &&
      user.role === 'worker' &&
      (previous.createdBy !== user.uid || previous.status !== 'draft'))
  )
    throw Error('This invoice is read-only.');
  if (previous && previous.status !== 'draft' && status === 'draft')
    throw Error('A completed sale cannot become a draft.');
  const lines = validateLines(items, options.extraDiscount).map((line) => {
    if (
      line.inventoryId ||
      !previous ||
      previous.revision ||
      !previous.items?.some(
        (old) => old.id === line.id && old.description === line.description,
      )
    )
      return line;
    const match = inventory.find((item) => item.name === line.description);
    return match ? { ...line, inventoryId: match.id } : line;
  });
  const number = invoice.invoiceNumber.trim();
  if (!number || !invoice.date)
    throw Error('Enter an invoice number and date.');
  if (
    bills.some(
      (b) =>
        b.id !== previous?.id && b.invoiceDetails?.invoiceNumber === number,
    )
  )
    throw Error('This invoice number already exists.');
  const refFor = (name, id) => storeDocument(user.storeId, name, id);
  const newRef = (name) => doc(storeCollection(user.storeId, name));
  const bill = previous ? refFor('bills', previous.id) : newRef('bills');
  const batch = writeBatch(db);
  const totals = calcTotals(lines, options);
  const buyerName = buyer.name.trim();
  const named =
    buyerName && !['cash', 'cash customer'].includes(buyerName.toLowerCase());
  let customerId = named
    ? customers.find((c) => c.name?.toLowerCase() === buyerName.toLowerCase())
        ?.id || ''
    : '';
  if (status === 'final' && named && !customerId) {
    const customer = newRef('customers');
    customerId = customer.id;
    batch.set(customer, {
      ...buyer,
      name: buyerName,
      createdAt: serverTimestamp(),
    });
  }
  const next = {
    invoiceDetails: { ...invoice, invoiceNumber: number },
    buyerDetails: { ...buyer, name: buyerName || 'Cash Customer' },
    customerId,
    items: lines,
    totals,
    options,
    templateName: templateId,
    status,
    createdBy: previous?.createdBy || user.uid,
    lastEditedBy: user.uid,
    updatedAt: serverTimestamp(),
    revision: (previous?.revision || 0) + 1,
    paymentStatus: invoice.paymentMode === 'Credit' ? 'Unpaid' : 'Paid',
  };
  if (!previous) next.createdAt = serverTimestamp();
  if (status === 'final') {
    for (const [id, delta] of stockChanges(previous, next, inventory)) {
      const item = inventory.find((i) => i.id === id);
      if (!item || Number(item.qty || 0) + delta < 0)
        throw Error(`Insufficient or missing stock: ${item?.name || id}`);
      batch.update(refFor('inventory', id), { qty: increment(delta) });
    }
    const oldDebit = previous?.ledgerTxnId;
    let oldCredit = previous?.paymentTxnId;
    if (
      previous &&
      previous.status !== 'draft' &&
      oldDebit &&
      oldCredit === undefined
    ) {
      const legacy = await getDocsFromServer(
        query(
          storeCollection(user.storeId, 'transactions'),
          where('billId', '==', previous.id),
        ),
      );
      const receipts = legacy.docs.filter(
        (d) =>
          d.data().type === 'CREDIT' &&
          String(d.data().description).startsWith('Payment received ('),
      );
      if (receipts.length > 1)
        throw Error(
          'Multiple linked receipts found. Review this invoice in the ledger first.',
        );
      oldCredit = receipts[0]?.id;
    }
    const post =
      customerId && !['estimate', 'proforma'].includes(invoice.docType);
    for (const [key, oldId, needed, type] of [
      ['ledgerTxnId', oldDebit, post, 'DEBIT'],
      [
        'paymentTxnId',
        oldCredit,
        post && invoice.paymentMode !== 'Credit',
        'CREDIT',
      ],
    ]) {
      next[key] = '';
      if (!needed) {
        if (oldId) batch.delete(refFor('transactions', oldId));
        continue;
      }
      const ref = oldId
        ? refFor('transactions', oldId)
        : newRef('transactions');
      next[key] = ref.id;
      batch.set(
        ref,
        {
          customerId,
          customerName: buyerName,
          type,
          amount: totals.grandTotal,
          description:
            type === 'DEBIT'
              ? `${documentLabel(invoice.docType)} ${number}`
              : `Payment received (${invoice.paymentMode}) - ${number}`,
          billId: bill.id,
          ...(!oldId
            ? { date: new Date().toISOString(), timestamp: serverTimestamp() }
            : {}),
        },
        { merge: true },
      );
    }
  }
  batch.set(bill, next, { merge: Boolean(previous) });
  const action =
    status === 'draft'
      ? previous
        ? 'draft_updated'
        : 'draft_saved'
      : previous
        ? previous.status === 'draft'
          ? 'draft_finalized'
          : 'updated'
        : 'created';
  batch.set(doc(collection(bill, 'events')), {
    action,
    actorUid: user.uid,
    actorEmail: user.email || '',
    actorRole: user.role,
    invoiceNumber: number,
    changedAt: serverTimestamp(),
    revision: next.revision,
    changes: changeLabels(previous, next),
    previousTotal: previous?.totals?.grandTotal ?? null,
    total: totals.grandTotal,
  });
  await batch.commit();
  return { ...previous, ...next, id: bill.id };
}
