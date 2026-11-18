import React from 'react';
import ItemsTable from './ItemsTable';
import {
  PAPER, Paper, StoreLines, BuyerBlock, MetaGrid, TotalsBox, GstSlabTable, BankAndTerms,
  Signature, PoweredBy, visibleLines, words, dt, fmt,
} from './shared';
import { documentLabel } from '../../lib/invoice';

const title = (doc) => documentLabel(doc.invoice.docType).toUpperCase();

function Footer({ doc, accent, showSlabs = true }) {
  const { totals, options, store } = doc;
  return (
    <>
      <div className="grid grid-cols-[1.4fr_1fr] gap-5 mt-4">
        <div className="space-y-3">
          <div className="text-[11px]">
            <span className="text-gray-500">Amount in words: </span>
            <span className="font-semibold text-gray-900">{words(totals.grandTotal)}</span>
          </div>
          {showSlabs && <GstSlabTable totals={totals} taxMode={options.taxMode} accent={accent} />}
          {doc.invoice.notes && (
            <div className="text-[10px] text-gray-700"><span className="font-bold">Note: </span>{doc.invoice.notes}</div>
          )}
        </div>
        <TotalsBox totals={totals} taxMode={options.taxMode} accent={accent} />
      </div>
      <div className="grid grid-cols-2 gap-5 mt-6 items-end">
        <BankAndTerms store={store} />
        <Signature store={store} accent={accent} />
      </div>
      <PoweredBy />
    </>
  );
}

export function ClassicTemplate({ doc }) {
  const { store, buyer, invoice, items } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4} className="p-8">
      <div className="border-2 border-gray-800">
        <div className="text-center py-3 border-b-2 border-gray-800">
          <div className="text-[10px] font-bold tracking-[0.3em] text-gray-500">{title(doc)}</div>
          <div className="text-[24px] font-extrabold uppercase" style={{ color: accent }}>{store.storeName || 'Your Store Name'}</div>
          <StoreLines store={store} center />
        </div>
        <div className="grid grid-cols-2 border-b-2 border-gray-800">
          <div className="p-3 border-r-2 border-gray-800"><BuyerBlock buyer={buyer} accent={accent} /></div>
          <div className="p-3"><MetaGrid invoice={invoice} /></div>
        </div>
        <ItemsTable lines={visibleLines(items)} accent={accent} variant="grid" minRows={10}
          columns={['sn', 'desc', 'hsn', 'batch', 'exp', 'qty', 'rate', 'dis', 'gst', 'amount']} />
      </div>
      <Footer doc={doc} accent={accent} />
    </Paper>
  );
}

export function PharmaTemplate({ doc }) {
  const { store, buyer, invoice, items, totals } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4} className="p-7">
      <div className="border border-gray-700">
        <div className="grid grid-cols-[1.3fr_1fr] border-b border-gray-700">
          <div className="p-3 border-r border-gray-700">
            <div className="text-[22px] font-black uppercase leading-tight" style={{ color: accent }}>{store.storeName || 'Pharma Distributors'}</div>
            <StoreLines store={store} />
          </div>
          <div className="p-3 flex flex-col justify-between">
            <div className="text-center text-[13px] font-extrabold tracking-widest py-1 text-white" style={{ backgroundColor: accent }}>{title(doc)}</div>
            <MetaGrid invoice={invoice} className="mt-2" />
          </div>
        </div>
        <div className="p-3 border-b border-gray-700"><BuyerBlock buyer={buyer} title="Party Details" accent={accent} /></div>
        <ItemsTable lines={visibleLines(items)} accent={accent} variant="grid" minRows={12} fontSize={10}
          columns={['sn', 'desc', 'hsn', 'batch', 'exp', 'mrp', 'qty', 'free', 'rate', 'dis', 'gst', 'amount']} />
        <div className="flex justify-between text-[10px] px-3 py-1.5 border-t border-gray-700 bg-gray-50">
          <span>Total Items: <b>{visibleLines(items).length}</b></span>
          <span>Total Qty: <b>{totals.totalQty}</b></span>
          <span>Taxable: <b>{fmt(totals.taxableValue)}</b></span>
          <span>GST: <b>{fmt(totals.gstTotal)}</b></span>
        </div>
      </div>
      <Footer doc={doc} accent={accent} />
    </Paper>
  );
}

export function ModernTemplate({ doc }) {
  const { store, buyer, invoice, items } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4}>
      <div className="px-9 py-7 text-white" style={{ background: `linear-gradient(120deg, ${accent} 0%, ${accent}cc 60%, #0f172a 100%)` }}>
        <div className="flex justify-between items-start gap-6">
          <div>
            <div className="text-[26px] font-extrabold leading-tight">{store.storeName || 'Your Store Name'}</div>
            <StoreLines store={store} light />
          </div>
          <div className="text-right">
            <div className="text-[28px] font-black tracking-tight opacity-95">{documentLabel(invoice.docType)}</div>
            <div className="text-[12px] opacity-90">#{invoice.invoiceNumber}</div>
            <div className="text-[12px] opacity-90">{dt(invoice.date)}</div>
          </div>
        </div>
      </div>
      <div className="px-9 py-6">
        <div className="grid grid-cols-2 gap-6 mb-5">
          <BuyerBlock buyer={buyer} accent={accent} />
          <MetaGrid invoice={invoice} />
        </div>
        <ItemsTable lines={visibleLines(items)} accent={accent} variant="striped"
          columns={['sn', 'descFull', 'qty', 'rate', 'dis', 'gst', 'amount']} />
        <Footer doc={doc} accent={accent} />
      </div>
    </Paper>
  );
}

export function CorporateTemplate({ doc }) {
  const { store, buyer, invoice, items } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4} className="p-9">
      <div className="flex justify-between items-end pb-4 border-b-4" style={{ borderColor: accent }}>
        <div>
          <div className="text-[24px] font-extrabold text-gray-900">{store.storeName || 'Your Company'}</div>
          <StoreLines store={store} />
        </div>
        <div className="text-right">
          <div className="text-[30px] font-black tracking-tight" style={{ color: accent }}>{title(doc)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 my-5">
        <div className="col-span-2 rounded-md p-3 bg-gray-50 border border-gray-200"><BuyerBlock buyer={buyer} accent={accent} /></div>
        <div className="rounded-md p-3 border border-gray-200"><MetaGrid invoice={invoice} /></div>
      </div>
      <ItemsTable lines={visibleLines(items)} accent={accent} variant="filled"
        columns={['sn', 'desc', 'hsn', 'qty', 'unit', 'rate', 'gst', 'taxable', 'amount']} />
      <Footer doc={doc} accent={accent} />
    </Paper>
  );
}

export function ElegantTemplate({ doc }) {
  const { store, buyer, invoice, items } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4} className="p-10" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      <div className="text-center">
        <div className="text-[30px] tracking-wide" style={{ color: accent }}>{store.storeName || 'Your Store Name'}</div>
        <div className="mx-auto my-2 h-px w-40" style={{ backgroundColor: accent }} />
        <StoreLines store={store} center />
        <div className="mt-4 text-[12px] tracking-[0.4em] text-gray-500">{title(doc)}</div>
      </div>
      <div className="grid grid-cols-2 gap-8 my-6 py-4 border-y border-gray-200">
        <BuyerBlock buyer={buyer} title="Billed To" accent={accent} />
        <MetaGrid invoice={invoice} />
      </div>
      <ItemsTable lines={visibleLines(items)} accent={accent} variant="line"
        columns={['sn', 'descFull', 'qty', 'rate', 'gst', 'amount']} fontSize={11} />
      <Footer doc={doc} accent={accent} />
    </Paper>
  );
}

export function MinimalTemplate({ doc }) {
  const { store, buyer, invoice, items } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4} className="p-12">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-gray-400">{documentLabel(invoice.docType)}</div>
          <div className="text-[34px] font-light text-gray-900 leading-tight">{invoice.invoiceNumber}</div>
          <div className="text-[12px] text-gray-500 mt-1">Issued {dt(invoice.date)}</div>
        </div>
        <div className="text-right max-w-[300px]">
          <div className="text-[16px] font-bold text-gray-900">{store.storeName || 'Your Store Name'}</div>
          <StoreLines store={store} />
        </div>
      </div>
      <div className="mt-10 mb-8 grid grid-cols-2 gap-8">
        <BuyerBlock buyer={buyer} accent={accent} />
        <MetaGrid invoice={invoice} />
      </div>
      <ItemsTable lines={visibleLines(items)} accent={accent} variant="line"
        columns={['desc', 'qty', 'rate', 'gst', 'amount']} fontSize={11} />
      <Footer doc={doc} accent={accent} showSlabs={false} />
    </Paper>
  );
}

export function ServiceTemplate({ doc }) {
  const { store, buyer, invoice, items } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4}>
      <div className="flex">
        <div className="w-3" style={{ backgroundColor: accent }} />
        <div className="flex-1 p-9">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[24px] font-extrabold text-gray-900">{store.storeName || 'Your Business'}</div>
              <StoreLines store={store} />
            </div>
            <div className="text-right rounded-lg px-4 py-3 text-white" style={{ backgroundColor: accent }}>
              <div className="text-[11px] uppercase tracking-widest opacity-90">Amount Due</div>
              <div className="text-[22px] font-black">₹ {fmt(doc.totals.grandTotal)}</div>
            </div>
          </div>
          <div className="text-[20px] font-bold mt-6" style={{ color: accent }}>{documentLabel(invoice.docType)}</div>
          <div className="grid grid-cols-2 gap-6 my-4">
            <BuyerBlock buyer={buyer} title="Client" accent={accent} />
            <MetaGrid invoice={invoice} />
          </div>
          <ItemsTable lines={visibleLines(items)} accent={accent} variant="tint"
            columns={['sn', 'desc', 'hsn', 'qty', 'rate', 'gst', 'amount']} fontSize={11} />
          <Footer doc={doc} accent={accent} />
        </div>
      </div>
    </Paper>
  );
}

export function ChallanTemplate({ doc }) {
  const { store, buyer, invoice, items, totals } = doc;
  const accent = doc.options.accent;
  return (
    <Paper width={PAPER.a4} className="p-8">
      <div className="border-2 border-gray-800">
        <div className="flex justify-between items-center p-4 border-b-2 border-gray-800">
          <div>
            <div className="text-[22px] font-extrabold uppercase" style={{ color: accent }}>{store.storeName || 'Your Store Name'}</div>
            <StoreLines store={store} />
          </div>
          <div className="text-[18px] font-black tracking-widest border-2 px-3 py-1" style={{ borderColor: accent, color: accent }}>DELIVERY CHALLAN</div>
        </div>
        <div className="grid grid-cols-2 border-b-2 border-gray-800">
          <div className="p-3 border-r-2 border-gray-800"><BuyerBlock buyer={buyer} title="Deliver To" accent={accent} /></div>
          <div className="p-3">
            <MetaGrid invoice={invoice} rows={[['Challan No', invoice.invoiceNumber], ['Date', dt(invoice.date)], ['Vehicle / Mode', invoice.paymentMode]]} />
          </div>
        </div>
        <ItemsTable lines={visibleLines(items)} accent={accent} variant="grid" minRows={14}
          columns={['sn', 'desc', 'hsn', 'batch', 'exp', 'qty', 'free', 'unit']} />
        <div className="flex justify-end gap-8 text-[11px] px-3 py-2 border-t-2 border-gray-800 font-bold">
          <span>Total Qty: {totals.totalQty}</span>
        </div>
      </div>
      {invoice.notes && <div className="text-[11px] mt-3"><b>Note:</b> {invoice.notes}</div>}
      <div className="grid grid-cols-2 gap-6 mt-14 text-[11px]">
        <div><div className="border-t border-gray-400 inline-block pt-1 px-6 text-gray-600">{"Receiver's Signature"}</div></div>
        <Signature store={store} accent={accent} />
      </div>
      <PoweredBy />
    </Paper>
  );
}
