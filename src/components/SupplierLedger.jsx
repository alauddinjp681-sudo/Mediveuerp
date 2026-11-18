import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ArrowLeft, IndianRupee } from 'lucide-react';
import { db } from '../firebase';
import { Button, Card, Field, PageHeader } from './ui';
import { formatDate, formatMoney, toMillis, toNumber, todayISO } from '../lib/format';

export default function SupplierLedger({ user, supplier, onBack, showToast }) {
  const [txns, setTxns] = useState([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!user?.uid || !supplier?.id) return undefined;
    const q = query(collection(db, 'users', user.uid, 'supplier_transactions'), where('supplierId', '==', supplier.id));
    return onSnapshot(q, (s) => setTxns(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(e));
  }, [user, supplier]);

  const rows = useMemo(() => {
    const sorted = [...txns].sort((a, b) => (toMillis(a.date) || toMillis(a.timestamp)) - (toMillis(b.date) || toMillis(b.timestamp)));
    let bal = 0;
    return sorted.map((t) => {
      bal += t.type === 'DEBIT' ? toNumber(t.amount) : -toNumber(t.amount);
      return { ...t, balance: bal };
    }).reverse();
  }, [txns]);
  const balance = rows[0]?.balance || 0;

  const addPayment = (e) => {
    e.preventDefault();
    const amt = toNumber(amount);
    if (amt <= 0) return showToast('Enter a valid amount', 'error');
    setDoc(doc(collection(db, 'users', user.uid, 'supplier_transactions')), {
      supplierId: supplier.id,
      supplierName: supplier.name,
      type: 'CREDIT',
      amount: amt,
      description: note || 'Payment made',
      date: todayISO(),
      timestamp: serverTimestamp(),
    }).catch(() => showToast('Sync failed', 'error'));
    setAmount('');
    setNote('');
    showToast('Payment recorded');
    return undefined;
  };

  if (!supplier) {
    return <Card className="p-6 text-center text-slate-400">No supplier selected. <Button variant="ghost" onClick={onBack}>Go back</Button></Card>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-brand-sky hover:underline"><ArrowLeft size={16} /> Suppliers</button>
      <PageHeader title={supplier.name} subtitle={supplier.phone || 'Supplier ledger (khata)'} />
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5 sm:col-span-1">
          <div className="text-xs uppercase text-slate-400">Balance payable</div>
          <div className={`text-3xl font-extrabold mt-1 tabular ${balance > 0 ? 'text-red-400' : 'text-brand-green'}`}>{formatMoney(Math.abs(balance))}</div>
          <div className="text-xs text-slate-500 mt-1">{balance > 0 ? 'You owe this supplier' : 'Settled / advance'}</div>
        </Card>
        <Card className="p-5 sm:col-span-2">
          <form onSubmit={addPayment} className="grid sm:grid-cols-[1fr_2fr_auto] gap-3 items-end">
            <Field label="Amount paid" type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI / Cash / Cheque no." />
            <Button type="submit"><IndianRupee size={16} /> Record</Button>
          </form>
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="table-head"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Particulars</th><th className="p-3 text-right">Purchase</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="p-3 text-slate-400">{formatDate(t.date || t.timestamp)}</td>
                <td className="p-3 text-white">{t.description}</td>
                <td className="p-3 text-right tabular text-red-300">{t.type === 'DEBIT' ? formatMoney(t.amount) : ''}</td>
                <td className="p-3 text-right tabular text-brand-green">{t.type === 'CREDIT' ? formatMoney(t.amount) : ''}</td>
                <td className="p-3 text-right tabular font-semibold">{formatMoney(t.balance)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No transactions yet</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
