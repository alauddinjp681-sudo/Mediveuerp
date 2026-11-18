import React from 'react';
import { calcLine } from '../../lib/invoice';
import { amountInWords, formatDate, formatINR, toNumber } from '../../lib/format';

export const PAPER = { a4: 794, a5: 560, t80: 302, t58: 219 };

export const visibleLines = (items = []) =>
  items
    .filter((i) => String(i.description || '').trim() || toNumber(i.rate))
    .map((i, idx) => ({ ...i, sn: idx + 1, calc: calcLine(i) }));

export const fmt = formatINR;
export const words = amountInWords;
export const dt = (v) => formatDate(v, { day: '2-digit', month: '2-digit', year: 'numeric' });

export function Paper({ width, children, className = '', style }) {
  return (
    <div className={`invoice-paper ${className}`} style={{ width, minHeight: width >= PAPER.a5 ? Math.round(width * 1.414) : undefined, ...style }}>
      {children}
    </div>
  );
}

export function StoreLines({ store, center = false, light = false }) {
  const muted = light ? 'opacity-90' : 'text-gray-600';
  return (
    <div className={`text-[11px] leading-relaxed ${muted} ${center ? 'text-center' : ''}`}>
      {store.address && <div className="whitespace-pre-line">{store.address}</div>}
      <div>
        {[store.phone && `Ph: ${store.phone}`, store.email].filter(Boolean).join('  |  ')}
      </div>
      <div className="font-semibold">
        {[store.gstin && `GSTIN: ${store.gstin}`, store.dlNumber && `D.L. No: ${store.dlNumber}`].filter(Boolean).join('  |  ')}
      </div>
    </div>
  );
}

export function BuyerBlock({ buyer, title = 'Bill To', accent }) {
  return (
    <div className="text-[11px] leading-relaxed">
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>{title}</div>
      <div className="text-[13px] font-bold text-gray-900">{buyer.name || 'Cash Customer'}</div>
      {buyer.address && <div className="text-gray-600 whitespace-pre-line">{buyer.address}</div>}
      {buyer.phone && <div className="text-gray-600">Ph: {buyer.phone}</div>}
      {buyer.gstin && <div className="text-gray-800 font-semibold">GSTIN: {buyer.gstin}</div>}
      {buyer.dlNumber && <div className="text-gray-800">D.L. No: {buyer.dlNumber}</div>}
      {buyer.stateName && <div className="text-gray-600">State: {buyer.stateName}</div>}
    </div>
  );
}

export function MetaGrid({ invoice, rows, className = '' }) {
  const all = rows || [
    ['Invoice No', invoice.invoiceNumber],
    ['Date', dt(invoice.date)],
    invoice.dueDate && ['Due Date', dt(invoice.dueDate)],
    invoice.paymentMode && ['Payment', invoice.paymentMode],
    invoice.placeOfSupply && ['Place of Supply', invoice.placeOfSupply],
  ].filter(Boolean);
  return (
    <div className={`text-[11px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 ${className}`}>
      {all.map(([k, v]) => (
        <React.Fragment key={k}>
          <span className="text-gray-500">{k}</span>
          <span className="font-semibold text-gray-900 text-right">{v || '-'}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function TaxRows({ totals, taxMode }) {
  return taxMode === 'inter' ? (
    <Row label="IGST" value={totals.igst} />
  ) : (
    <>
      <Row label="CGST" value={totals.cgst} />
      <Row label="SGST" value={totals.sgst} />
    </>
  );
}

export function Row({ label, value, bold = false, className = '' }) {
  return (
    <div className={`flex justify-between gap-4 py-0.5 ${bold ? 'font-bold text-gray-900' : 'text-gray-700'} ${className}`}>
      <span>{label}</span>
      <span>{typeof value === 'number' ? fmt(value) : value}</span>
    </div>
  );
}

export function TotalsBox({ totals, taxMode, accent, className = '' }) {
  return (
    <div className={`text-[11px] ${className}`}>
      <Row label="Sub Total" value={totals.gross} />
      {totals.discount > 0 && <Row label="Discount" value={-totals.discount} />}
      <Row label="Taxable Value" value={totals.taxableValue} />
      <TaxRows totals={totals} taxMode={taxMode} />
      {totals.extraDiscount > 0 && <Row label="Extra Discount" value={-totals.extraDiscount} />}
      {Math.abs(totals.roundOff) > 0.001 && <Row label="Round Off" value={totals.roundOff} />}
      <div className="flex justify-between gap-4 mt-1.5 pt-1.5 border-t-2 text-[14px] font-extrabold" style={{ borderColor: accent, color: accent }}>
        <span>Grand Total</span>
        <span>₹ {fmt(totals.grandTotal)}</span>
      </div>
    </div>
  );
}

export function GstSlabTable({ totals, taxMode, accent }) {
  if (!totals.slabs.length) return null;
  const inter = taxMode === 'inter';
  return (
    <table className="w-full text-[10px] border-collapse">
      <thead>
        <tr style={{ backgroundColor: `${accent}14` }}>
          <th className="border border-gray-300 px-1.5 py-1 text-left">GST %</th>
          <th className="border border-gray-300 px-1.5 py-1 text-right">Taxable</th>
          {inter ? (
            <th className="border border-gray-300 px-1.5 py-1 text-right">IGST</th>
          ) : (
            <>
              <th className="border border-gray-300 px-1.5 py-1 text-right">CGST</th>
              <th className="border border-gray-300 px-1.5 py-1 text-right">SGST</th>
            </>
          )}
          <th className="border border-gray-300 px-1.5 py-1 text-right">Total Tax</th>
        </tr>
      </thead>
      <tbody>
        {totals.slabs.map((s) => (
          <tr key={s.rate}>
            <td className="border border-gray-300 px-1.5 py-0.5">{s.rate}%</td>
            <td className="border border-gray-300 px-1.5 py-0.5 text-right">{fmt(s.taxable)}</td>
            {inter ? (
              <td className="border border-gray-300 px-1.5 py-0.5 text-right">{fmt(s.gst)}</td>
            ) : (
              <>
                <td className="border border-gray-300 px-1.5 py-0.5 text-right">{fmt(s.gst / 2)}</td>
                <td className="border border-gray-300 px-1.5 py-0.5 text-right">{fmt(s.gst / 2)}</td>
              </>
            )}
            <td className="border border-gray-300 px-1.5 py-0.5 text-right">{fmt(s.gst)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BankAndTerms({ store, compact = false }) {
  const hasBank = store.bankName || store.accountNo || store.ifsc || store.upiId;
  return (
    <div className={`text-[10px] leading-relaxed text-gray-700 ${compact ? 'space-y-1' : 'space-y-2'}`}>
      {hasBank && (
        <div>
          <div className="font-bold text-gray-900 uppercase tracking-wide">Bank Details</div>
          {store.bankName && <div>Bank: {store.bankName}</div>}
          {store.accountNo && <div>A/c No: {store.accountNo}</div>}
          {store.ifsc && <div>IFSC: {store.ifsc}</div>}
          {store.upiId && <div>UPI: {store.upiId}</div>}
        </div>
      )}
      {store.terms && (
        <div>
          <div className="font-bold text-gray-900 uppercase tracking-wide">Terms & Conditions</div>
          <div className="whitespace-pre-line">{store.terms}</div>
        </div>
      )}
    </div>
  );
}

export function Signature({ store, accent }) {
  return (
    <div className="text-[11px] text-right">
      <div className="font-bold" style={{ color: accent }}>For {store.storeName || 'Your Store'}</div>
      <div className="h-12" />
      <div className="border-t border-gray-400 inline-block pt-1 px-6 text-gray-600">Authorised Signatory</div>
    </div>
  );
}

export function PoweredBy() {
  return <div className="text-center text-[9px] text-gray-400 mt-3">Generated with MEDIVEU ERP</div>;
}
