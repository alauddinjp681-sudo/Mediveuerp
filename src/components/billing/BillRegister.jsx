import React, { useMemo, useState } from 'react';
import { Search, FileText, ArrowRight } from 'lucide-react';
import { formatMoney, formatDate, toMillis } from '../../lib/format';

export default function BillRegister({ bills, onOpen }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [limit, setLimit] = useState(30);
  const matches = useMemo(
    () =>
      bills
        .filter(
          (b) =>
            (status === 'all' || (b.status || 'final') === status) &&
            [b.invoiceDetails?.invoiceNumber, b.buyerDetails?.name].some((v) =>
              String(v || '')
                .toLowerCase()
                .includes(search.trim().toLowerCase()),
            ),
        )
        .sort(
          (a, b) =>
            toMillis(b.updatedAt || b.createdAt) -
            toMillis(a.updatedAt || a.createdAt),
        ),
    [bills, status, search],
  );
  return (
    <section className="card p-4 sm:p-6 no-print" aria-label="Invoice register">
      <h2 className="text-xl font-bold text-white">Invoice register</h2>
      <p className="mt-1 text-sm text-slate-400">
        Find a receipt, review changes or resume a draft.
      </p>
      <div className="my-4 flex flex-wrap gap-2">
        <label className="relative flex-1 min-w-40">
          <Search size={16} className="absolute top-3 left-3 text-slate-400" />
          <input
            aria-label="Search invoices"
            className="field pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(30);
            }}
            placeholder="Invoice number or customer"
          />
        </label>
        <select
          aria-label="Invoice status"
          className="field w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setLimit(30);
          }}
        >
          <option value="all">All statuses</option>
          <option value="draft">Drafts</option>
          <option value="final">Finalized</option>
        </select>
      </div>
      <ul className="divide-y divide-white/10">
        {matches.slice(0, limit).map((b) => (
          <li key={b.id}>
            <button
              className="flex w-full items-center gap-3 py-3 text-left hover:bg-white/5"
              onClick={() => onOpen(b)}
            >
              <FileText size={18} className="shrink-0 text-brand-sky" />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-white">
                  {b.invoiceDetails?.invoiceNumber || 'Invoice'}
                </strong>
                <span className="block truncate text-sm text-slate-400">
                  {b.buyerDetails?.name || 'Cash Customer'} ·{' '}
                  {formatDate(b.invoiceDetails?.date)}
                </span>
              </span>
              <span className="text-right">
                <strong className="block">
                  {formatMoney(b.totals?.grandTotal)}
                </strong>
                <span className="text-xs text-slate-400">
                  {b.status === 'draft' ? 'Draft' : 'Finalized'}
                </span>
              </span>
              <ArrowRight size={16} />
            </button>
          </li>
        ))}
      </ul>
      {!matches.length && (
        <p className="py-8 text-center text-slate-400">
          {bills.length ? 'No matching invoices.' : 'No invoices saved yet.'}
        </p>
      )}
      {matches.length > limit && (
        <button
          className="btn-secondary mt-3"
          onClick={() => setLimit(limit + 30)}
        >
          Show more invoices
        </button>
      )}
    </section>
  );
}
