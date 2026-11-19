import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { storeCollection, storeDocument } from '../lib/storeAccess';
import { collection, onSnapshot, doc, serverTimestamp, query, where, runTransaction } from 'firebase/firestore';
import { readableFirebaseError } from '../lib/firebaseError';
import { ShoppingCart, Save, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function PurchaseEntry({ user, onNavigate, preSelectedSupplier, showToast }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierError, setSupplierError] = useState('');
  const [supplierRetry, setSupplierRetry] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const pendingOperationRef = useRef(null);

  // Bill Details State
  const [billDetails, setBillDetails] = useState({
    supplierId: preSelectedSupplier?.id || '',
    supplierName: preSelectedSupplier?.name || '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
  });

  // Items State
  const [items, setItems] = useState([
    { id: 1, name: '', batchNo: '', expiryDate: '', qty: 0, rate: 0, mrp: 0, gstPercent: 12 }
  ]);

  const [totals, setTotals] = useState({
    taxableValue: 0, cgst: 0, sgst: 0, grandTotal: 0
  });

  // 1. Fetch Suppliers Dropdown
  useEffect(() => {
    if (!user?.uid || !user?.storeId) return undefined;
    setSupplierError('');
    return onSnapshot(storeCollection(user.storeId, 'suppliers'), (snapshot) => {
      const suppData = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      setSuppliers(suppData);
    }, (error) => {
      setSupplierError(readableFirebaseError(error, 'Supplier list could not be loaded.'));
    });
  }, [user?.uid, user?.storeId, supplierRetry]);

  // 2. Auto-Calculate Totals
  useEffect(() => {
    let tValue = 0, tGst = 0;
    items.forEach(item => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const gstP = Number(item.gstPercent) || 0;
      
      const baseAmt = qty * rate;
      const gstAmt = baseAmt * (gstP / 100);
      
      tValue += baseAmt;
      tGst += gstAmt;
    });

    setTotals({
      taxableValue: tValue,
      cgst: tGst / 2,
      sgst: tGst / 2,
      grandTotal: Math.round(tValue + tGst)
    });
  }, [items]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addRow = () => setItems([...items, { id: Date.now(), name: '', batchNo: '', expiryDate: '', qty: 0, rate: 0, mrp: 0, gstPercent: 12 }]);
  const removeRow = (index) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)); };

  const handleSavePurchase = async () => {
    if (isProcessingRef.current) return;
    if (!billDetails.supplierId) return showToast?.('Choose a supplier from the list.', 'error');
    if (!billDetails.invoiceNumber.trim()) return showToast?.('Enter the supplier invoice number.', 'error');
    const normalizedItems = items.filter((item) => item.name.trim()).map((item) => ({
      ...item,
      name: item.name.trim().toUpperCase(),
      batchNo: item.batchNo.trim().toUpperCase() || 'N/A',
      qty: Number(item.qty),
      rate: Number(item.rate),
      mrp: Number(item.mrp) || 0,
      gstPercent: Number(item.gstPercent),
    }));
    if (!normalizedItems.length) return showToast?.('Add at least one medicine to this purchase.', 'error');
    if (items.some((item) => !item.name.trim() && (Number(item.qty) || Number(item.rate)))) {
      return showToast?.('Complete or remove each purchase line before saving.', 'error');
    }
    if (normalizedItems.some((item) => !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(item.rate) || item.rate < 0 || !Number.isFinite(item.mrp) || item.mrp < 0 || !Number.isFinite(item.gstPercent))) {
      return showToast?.('Enter valid positive quantities and non-negative prices for every medicine.', 'error');
    }

    const groups = new Map();
    normalizedItems.forEach((item) => {
      const key = `${item.name}::${item.batchNo}`;
      const group = groups.get(key) || { ...item, qty: 0, weightedRate: 0 };
      group.qty += item.qty;
      group.weightedRate += item.qty * item.rate;
      group.mrp = item.mrp;
      group.gstPercent = item.gstPercent;
      group.expiryDate = item.expiryDate || group.expiryDate;
      groups.set(key, group);
    });
    const stockGroups = [...groups.values()];
    if (stockGroups.length > 450) return showToast?.('This purchase has too many unique stock lines. Split it into smaller purchases.', 'error');

    isProcessingRef.current = true;
    setIsProcessing(true);
    const operationKey = JSON.stringify({ billDetails, normalizedItems, totals });
    if (pendingOperationRef.current?.key !== operationKey) {
      pendingOperationRef.current = {
        key: operationKey,
        purchaseRef: doc(collection(storeCollection(user.storeId, 'purchases'))),
        supplierTransactionRef: doc(collection(storeCollection(user.storeId, 'supplier_transactions'))),
        inventoryRefs: new Map(stockGroups.map((group) => [`${group.name}::${group.batchNo}`, doc(collection(storeCollection(user.storeId, 'inventory')))])),
      };
    }
    const operation = pendingOperationRef.current;

    try {
      const result = await runTransaction(db, async (transaction) => {
        const previousPurchase = await transaction.get(operation.purchaseRef);
        if (previousPurchase.exists()) return 'already-saved';

        const supplierRef = storeDocument(user.storeId, 'suppliers', billDetails.supplierId);
        const supplierSnapshot = await transaction.get(supplierRef);
        const names = [...new Set(stockGroups.map((group) => group.name))];
        const inventorySnapshots = await Promise.all(names.map((name) => transaction.get(query(
          storeCollection(user.storeId, 'inventory'),
          where('name', '==', name),
        ))));
        if (!supplierSnapshot.exists()) throw new Error('The selected supplier no longer exists. Refresh the supplier list.');

        const byName = new Map(names.map((name, index) => [name, inventorySnapshots[index]]));
        const matches = stockGroups.map((group) => {
          const snapshot = byName.get(group.name);
          const match = snapshot.docs.find((document) => (String(document.data().batchNo || 'N/A').trim().toUpperCase() || 'N/A') === group.batchNo);
          return { group, match };
        });

        transaction.set(operation.purchaseRef, {
          billDetails: { ...billDetails, invoiceNumber: billDetails.invoiceNumber.trim() },
          items: normalizedItems,
          totals,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
        matches.forEach(({ group, match }) => {
          const key = `${group.name}::${group.batchNo}`;
          const rate = group.weightedRate / group.qty;
          const fields = {
            qty: (Number(match?.data().qty) || 0) + group.qty,
            rate,
            mrp: group.mrp,
            gstPercent: group.gstPercent,
            expiryDate: group.expiryDate || match?.data().expiryDate || '',
            updatedAt: serverTimestamp(),
          };
          if (match) {
            transaction.update(storeDocument(user.storeId, 'inventory', match.id), fields);
          } else {
            transaction.set(operation.inventoryRefs.get(key), {
              name: group.name,
              batchNo: group.batchNo,
              ...fields,
              createdAt: serverTimestamp(),
            });
          }
        });
        transaction.set(operation.supplierTransactionRef, {
          supplierId: billDetails.supplierId,
          supplierName: billDetails.supplierName,
          type: 'DEBIT',
          amount: totals.grandTotal,
          description: `Purchase Bill: ${billDetails.invoiceNumber.trim()}`,
          date: billDetails.invoiceDate,
          timestamp: serverTimestamp(),
        });
        return 'saved';
      });

      pendingOperationRef.current = null;
      showToast?.(result === 'already-saved' ? 'This purchase was already saved.' : 'Purchase saved; inventory and supplier ledger updated.');
      onNavigate?.('suppliers');
    } catch (error) {
      showToast?.(readableFirebaseError(error, 'Purchase could not be saved. No purchase, stock, or ledger changes were committed.'), 'error');
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const fiClass = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 text-sm transition-colors uppercase font-bold";
  const flClass = "block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="bg-slate-900 min-h-screen p-4 md:p-8 text-slate-300 font-sans">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-6 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
        <div>
          <button onClick={() => onNavigate && onNavigate('suppliers')} className="flex items-center text-blue-400 hover:text-blue-300 font-bold mb-2 transition-colors text-sm">
            <ArrowLeft size={16} className="mr-1" /> Back to Suppliers
          </button>
          <h2 className="text-2xl font-black text-white flex items-center">
            <ShoppingCart className="mr-3 text-blue-400" size={28} /> Purchase Bill Entry
          </h2>
        </div>
        
        <div className="mt-4 md:mt-0 text-right">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Bill Value</p>
          <div className="text-3xl font-black text-emerald-400">₹{totals.grandTotal.toFixed(2)}</div>
        </div>
      </div>

      {/* BILL DETAILS FORM */}
      <div className="max-w-6xl mx-auto bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm mb-6">
        <h3 className="text-white font-bold mb-4 border-b border-slate-700 pb-2">1. Distributor & Bill Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={flClass}>Select Distributor / Supplier</label>
            <select 
              className={fiClass}
              value={billDetails.supplierName}
              onChange={(e) => {
                const supp = suppliers.find(s => s.name === e.target.value);
                setBillDetails({...billDetails, supplierName: e.target.value, supplierId: supp?.id || ''});
              }}
            >
              <option value="">-- SELECT SUPPLIER --</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            {supplierError && <p role="alert" className="mt-2 text-xs text-red-300">{supplierError} <button type="button" onClick={() => setSupplierRetry((key) => key + 1)} className="text-brand-sky underline">Retry</button></p>}
          </div>
          <div>
            <label className={flClass}>Supplier Invoice No.</label>
            <input type="text" className={fiClass} placeholder="e.g. INV-9988" value={billDetails.invoiceNumber} onChange={e => setBillDetails({...billDetails, invoiceNumber: e.target.value})} />
          </div>
          <div>
            <label className={flClass}>Bill Date</label>
            <input type="date" className={fiClass} value={billDetails.invoiceDate} onChange={e => setBillDetails({...billDetails, invoiceDate: e.target.value})} />
          </div>
        </div>
      </div>

      {/* ITEMS ARRAY */}
      <div className="max-w-6xl mx-auto bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm mb-6">
        <h3 className="text-white font-bold mb-4 border-b border-slate-700 pb-2">2. Received Medicines (Stock Entry)</h3>
        
        {items.map((item, index) => (
          <div key={item.id} className="p-4 bg-slate-900 border border-slate-700 rounded-lg mb-4 relative shadow-inner">
            {items.length > 1 && (
              <button onClick={() => removeRow(index)} className="absolute top-3 right-3 text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-colors"><Trash2 size={18} /></button>
            )}
            <div className="grid grid-cols-2 md:grid-cols-8 gap-3 pr-8 md:pr-0">
              <div className="col-span-2 md:col-span-2"><label className={flClass}>Medicine Name</label><input type="text" className={fiClass} value={item.name} onChange={e => handleItemChange(index, 'name', e.target.value)} placeholder="Item Name"/></div>
              <div><label className={flClass}>Batch No</label><input type="text" className={fiClass} value={item.batchNo} onChange={e => handleItemChange(index, 'batchNo', e.target.value)} /></div>
              <div><label className={flClass}>Expiry</label><input type="date" className={fiClass} value={item.expiryDate} onChange={e => handleItemChange(index, 'expiryDate', e.target.value)} /></div>
              <div><label className={flClass}>Qty Received</label><input type="number" className={fiClass} value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value)} /></div>
              <div><label className={flClass}>Purch. Rate</label><input type="number" className={fiClass} value={item.rate} onChange={e => handleItemChange(index, 'rate', e.target.value)} /></div>
              <div><label className={flClass}>MRP</label><input type="number" className={fiClass} value={item.mrp} onChange={e => handleItemChange(index, 'mrp', e.target.value)} /></div>
              <div><label className={flClass}>GST %</label>
                <select className={fiClass} value={item.gstPercent} onChange={e => handleItemChange(index, 'gstPercent', e.target.value)}>
                  <option value={0}>0%</option><option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        
        <button onClick={addRow} className="w-full flex justify-center items-center text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 py-3 rounded-lg border border-blue-500/20 font-bold transition-colors border-dashed mt-4">
          <Plus size={18} className="mr-2"/> Add Another Medicine
        </button>
      </div>

      {/* SAVE BUTTON */}
      <div className="max-w-6xl mx-auto flex justify-end">
        <button 
          onClick={handleSavePurchase} 
          disabled={isProcessing}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black shadow-lg transition-all disabled:opacity-50 text-lg"
        >
          <Save size={20} className="mr-2" /> {isProcessing ? 'Saving to Inventory...' : 'Save Purchase Bill & Update Stock'}
        </button>
      </div>

    </div>
  );
}
