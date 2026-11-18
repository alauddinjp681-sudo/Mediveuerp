import React from 'react';
import ItemsTable from './ItemsTable';
import { PAPER, Paper, StoreLines, BuyerBlock, MetaGrid, TotalsBox, Signature, visibleLines, words, dt, fmt } from './shared';
import { documentLabel } from '../../lib/invoice';
import { toNumber } from '../../lib/format';

export function CompactTemplate({ doc }) {
  const { store, buyer, invoice, items, totals, options } = doc;
  const accent = options.accent;
  return (
    <Paper width={PAPER.a5} className="p-5">
      <div className="text-center pb-2 border-b-2" style={{ borderColor: accent }}>
        <div className="text-[18px] font-extrabold uppercase" style={{ color: accent }}>{store.storeName || 'Your Store'}</div>
        <StoreLines store={store} center />
      </div>
      <div className="text-center text-[11px] font-bold tracking-widest my-2">{documentLabel(invoice.docType).toUpperCase()}</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <BuyerBlock buyer={buyer} accent={accent} />
        <MetaGrid invoice={invoice} />
      </div>
      <ItemsTable lines={visibleLines(items)} accent={accent} variant="grid" fontSize={9.5}
        columns={['sn', 'descFull', 'qty', 'rate', 'gst', 'amount']} />
      <div className="grid grid-cols-[1fr_1fr] gap-3 mt-3">
        <div className="text-[10px] text-gray-700">
          <b>In words:</b> {words(totals.grandTotal)}
          {store.terms && <div className="mt-2 whitespace-pre-line text-[9px] text-gray-500">{store.terms}</div>}
        </div>
        <TotalsBox totals={totals} taxMode={options.taxMode} accent={accent} />
      </div>
      <div className="mt-5"><Signature store={store} accent={accent} /></div>
    </Paper>
  );
}

function ThermalReceipt({ doc, width, fontSize }) {
  const { store, buyer, invoice, items, totals, options } = doc;
  const lines = visibleLines(items);
  const dash = <div className="border-t border-dashed border-gray-500 my-1.5" />;
  return (
    <Paper width={width} className="px-2 py-3 font-mono" style={{ fontSize, lineHeight: 1.35 }}>
      <div className="text-center">
        <div className="font-bold uppercase" style={{ fontSize: fontSize + 4 }}>{store.storeName || 'Your Store'}</div>
        {store.address && <div className="whitespace-pre-line">{store.address}</div>}
        {store.phone && <div>Ph: {store.phone}</div>}
        {store.gstin && <div>GSTIN: {store.gstin}</div>}
        {store.dlNumber && <div>DL: {store.dlNumber}</div>}
        {dash}
        <div className="font-bold">{documentLabel(invoice.docType).toUpperCase()}</div>
      </div>
      <div className="flex justify-between"><span>No: {invoice.invoiceNumber}</span><span>{dt(invoice.date)}</span></div>
      <div>To: {buyer.name || 'Cash'}{buyer.phone ? ` (${buyer.phone})` : ''}</div>
      {dash}
      <div className="flex font-bold"><span className="flex-1">Item</span><span className="w-8 text-right">Qty</span><span className="w-16 text-right">Amt</span></div>
      {dash}
      {lines.map((l) => (
        <div key={l.id} className="mb-1">
          <div className="font-semibold break-words">{l.description}</div>
          <div className="flex text-gray-700">
            <span className="flex-1">{fmt(l.calc.rate)}{toNumber(l.disPercent) ? ` -${l.disPercent}%` : ''} +{toNumber(l.gstPercent)}%</span>
            <span className="w-8 text-right">{l.calc.qty}</span>
            <span className="w-16 text-right">{fmt(l.calc.total)}</span>
          </div>
        </div>
      ))}
      {dash}
      <div className="flex justify-between"><span>Taxable</span><span>{fmt(totals.taxableValue)}</span></div>
      {options.taxMode === 'inter' ? (
        <div className="flex justify-between"><span>IGST</span><span>{fmt(totals.igst)}</span></div>
      ) : (
        <>
          <div className="flex justify-between"><span>CGST</span><span>{fmt(totals.cgst)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>{fmt(totals.sgst)}</span></div>
        </>
      )}
      {totals.extraDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{fmt(totals.extraDiscount)}</span></div>}
      {Math.abs(totals.roundOff) > 0.001 && <div className="flex justify-between"><span>Round Off</span><span>{fmt(totals.roundOff)}</span></div>}
      {dash}
      <div className="flex justify-between font-bold" style={{ fontSize: fontSize + 3 }}><span>TOTAL</span><span>₹{fmt(totals.grandTotal)}</span></div>
      <div className="flex justify-between"><span>Items: {lines.length}</span><span>Qty: {totals.totalQty}</span></div>
      {invoice.paymentMode && <div>Paid by: {invoice.paymentMode}</div>}
      {dash}
      <div className="text-center">
        {store.upiId && <div>UPI: {store.upiId}</div>}
        <div className="font-semibold">Thank you! Visit again.</div>
        <div className="text-gray-500" style={{ fontSize: fontSize - 2 }}>Powered by MEDIVEU ERP</div>
      </div>
    </Paper>
  );
}

export const Thermal80Template = ({ doc }) => <ThermalReceipt doc={doc} width={PAPER.t80} fontSize={11} />;
export const Thermal58Template = ({ doc }) => <ThermalReceipt doc={doc} width={PAPER.t58} fontSize={9.5} />;
