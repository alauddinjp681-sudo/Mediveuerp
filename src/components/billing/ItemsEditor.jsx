import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Search, ScanBarcode } from 'lucide-react';
import { calcLine, emptyItem } from '../../lib/invoice';
import { formatINR, toNumber } from '../../lib/format';
import { isComposing } from '../ui';

const fromInventory = (inv) => ({
  ...emptyItem(),
  inventoryId: inv.id,
  description: inv.name || '',
  hsn: inv.hsn || '',
  batch: inv.batchNo && inv.batchNo !== 'N/A' ? inv.batchNo : '',
  expiry: inv.expiryDate ? String(inv.expiryDate).slice(0, 7) : '',
  mrp: inv.mrp || '',
  rate: inv.rate || '',
  gstPercent: inv.gstPercent ?? 12,
});

function ProductSearch({ inventory, onPick }) {
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return inventory
      .filter((i) => [i.name, i.batchNo, i.hsn, i.barcode].some((v) => String(v || '').toLowerCase().includes(q)))
      .slice(0, 8);
  }, [term, inventory]);

  const pick = (inv) => {
    onPick(inv ? fromInventory(inv) : { ...emptyItem(), description: term.trim().toUpperCase() });
    setTerm('');
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && !isComposing(e)) {
      e.preventDefault();
      if (!term.trim()) return;
      const code = term.trim().toLowerCase();
      const exact = inventory.find((i) => [i.barcode, i.batchNo].some((v) => String(v || '').toLowerCase() === code));
      pick(exact || results[active] || null);
    }
    if (e.key === 'Escape') setTerm('');
  };

  return (
    <div className="relative">
      <label htmlFor="product-search" className="sr-only">Search product or scan barcode</label>
      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        id="product-search"
        ref={inputRef}
        value={term}
        onChange={(e) => { setTerm(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        placeholder="Search medicine / scan barcode, press Enter"
        className="field pl-10 pr-10 py-3"
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="product-results"
      />
      <ScanBarcode size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      {term && (
        <ul id="product-results" role="listbox" className="absolute z-30 mt-1 w-full card p-1 shadow-2xl max-h-80 overflow-y-auto bg-ink-850">
          {results.map((inv, idx) => (
            <li key={inv.id} role="option" aria-selected={idx === active}>
              <button
                onMouseDown={(e) => { e.preventDefault(); pick(inv); }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 ${idx === active ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">{inv.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    Batch {inv.batchNo || '-'} · Exp {inv.expiryDate || '-'} · MRP ₹{formatINR(inv.mrp)}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-sm font-bold text-brand-green">₹{formatINR(inv.rate)}</span>
                  <span className={`block text-[11px] ${toNumber(inv.qty) > 10 ? 'text-slate-400' : 'text-amber-400'}`}>Stock {inv.qty ?? 0}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button onMouseDown={(e) => { e.preventDefault(); pick(null); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand-sky hover:bg-white/5">
              + Add &quot;{term.trim().toUpperCase()}&quot; as new line
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

const NUM_FIELDS = [
  { key: 'qty', label: 'Qty' },
  { key: 'free', label: 'Free' },
  { key: 'rate', label: 'Rate' },
  { key: 'disPercent', label: 'Dis %' },
  { key: 'gstPercent', label: 'GST %', select: [0, 5, 12, 18, 28] },
];

const TEXT_FIELDS = [
  { key: 'hsn', label: 'HSN' },
  { key: 'batch', label: 'Batch' },
  { key: 'expiry', label: 'Expiry', placeholder: 'MM/YY' },
  { key: 'mrp', label: 'MRP', type: 'number' },
];

function ItemRow({ item, index, onChange, onRemove }) {
  const line = calcLine(item);
  const set = (key) => (e) => onChange(index, key, e.target.value);
  const small = 'w-full bg-ink-950 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none focus:border-brand-sky';
  return (
    <div className="rounded-xl border border-white/[0.07] bg-ink-950/50 p-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-slate-500 mt-2.5 w-5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <label className="sr-only" htmlFor={`desc-${item.id}`}>Item description</label>
          <input id={`desc-${item.id}`} value={item.description} onChange={set('description')} placeholder="Item / medicine name" className={`${small} font-semibold`} />
          <div className="grid grid-cols-4 gap-2 mt-2">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`${f.key}-${item.id}`} className="text-[10px] uppercase text-slate-500">{f.label}</label>
                <input id={`${f.key}-${item.id}`} type={f.type || 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} value={item[f.key]} onChange={set(f.key)} placeholder={f.placeholder} className={small} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {NUM_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`${f.key}-${item.id}`} className="text-[10px] uppercase text-slate-500">{f.label}</label>
                {f.select ? (
                  <select id={`${f.key}-${item.id}`} value={item[f.key]} onChange={set(f.key)} className={small}>
                    {f.select.map((v) => <option key={v} value={v}>{v}%</option>)}
                  </select>
                ) : (
                  <input id={`${f.key}-${item.id}`} type="number" inputMode="decimal" min="0" value={item[f.key]} onChange={set(f.key)} className={small} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button onClick={() => onRemove(index)} className="p-2 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10" aria-label={`Remove item ${index + 1}`}>
            <Trash2 size={16} />
          </button>
          <div className="text-right mt-auto">
            <div className="text-[10px] uppercase text-slate-500">Amount</div>
            <div className="text-sm font-bold text-white tabular">₹{formatINR(line.total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItemsEditor({ items, setItems, inventory }) {
  const onChange = (index, key, value) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== index) return it;
      if (key === 'disPercent') value = Math.min(100, Math.max(0, toNumber(value))) || '';
      return { ...it, [key]: value };
    }));
  };
  const onRemove = (index) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyItem()]));
  const onPick = (newItem) => {
    setItems((prev) => {
      const existing = newItem.inventoryId && prev.findIndex((p) => p.inventoryId === newItem.inventoryId);
      if (existing !== '' && existing > -1) {
        return prev.map((p, i) => (i === existing ? { ...p, qty: toNumber(p.qty) + 1 } : p));
      }
      const blankIdx = prev.findIndex((p) => !p.description && !toNumber(p.rate));
      if (blankIdx > -1) return prev.map((p, i) => (i === blankIdx ? newItem : p));
      return [...prev, newItem];
    });
  };

  return (
    <div className="space-y-3">
      <ProductSearch inventory={inventory} onPick={onPick} />
      <div className="space-y-2">
        {items.map((item, idx) => (
          <ItemRow key={item.id} item={item} index={idx} onChange={onChange} onRemove={onRemove} />
        ))}
      </div>
      <button onClick={() => setItems((p) => [...p, emptyItem()])} className="btn-secondary w-full border-dashed">
        <Plus size={16} /> Add blank row
      </button>
    </div>
  );
}
