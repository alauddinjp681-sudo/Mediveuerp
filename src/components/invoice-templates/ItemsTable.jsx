import React from 'react';
import { fmt } from './shared';
import { toNumber } from '../../lib/format';

const COLS = {
  sn: { label: '#', align: 'center', w: 26, get: (l) => l.sn },
  desc: { label: 'Description', align: 'left', get: (l) => <span className="font-semibold text-gray-900">{l.description}</span> },
  descFull: {
    label: 'Product',
    align: 'left',
    get: (l) => (
      <div>
        <div className="font-semibold text-gray-900">{l.description}</div>
        {(l.batch || l.expiry || l.hsn) && (
          <div className="text-[9px] text-gray-500">
            {[l.hsn && `HSN ${l.hsn}`, l.batch && `B: ${l.batch}`, l.expiry && `Exp: ${l.expiry}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    ),
  },
  hsn: { label: 'HSN', align: 'center', w: 50, get: (l) => l.hsn },
  batch: { label: 'Batch', align: 'center', w: 56, get: (l) => l.batch },
  exp: { label: 'Exp', align: 'center', w: 42, get: (l) => l.expiry },
  mrp: { label: 'MRP', align: 'right', w: 50, get: (l) => (toNumber(l.mrp) ? fmt(l.mrp) : '') },
  qty: { label: 'Qty', align: 'center', w: 36, get: (l) => l.calc.qty },
  free: { label: 'Free', align: 'center', w: 32, get: (l) => toNumber(l.free) || '' },
  unit: { label: 'Unit', align: 'center', w: 36, get: (l) => l.unit },
  rate: { label: 'Rate', align: 'right', w: 56, get: (l) => fmt(l.calc.rate) },
  dis: { label: 'Dis%', align: 'center', w: 34, get: (l) => toNumber(l.disPercent) || '' },
  gst: { label: 'GST%', align: 'center', w: 36, get: (l) => toNumber(l.gstPercent) },
  taxable: { label: 'Taxable', align: 'right', w: 64, get: (l) => fmt(l.calc.taxable) },
  amount: { label: 'Amount', align: 'right', w: 70, get: (l) => <span className="font-semibold text-gray-900">{fmt(l.calc.total)}</span> },
};

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

export default function ItemsTable({ lines, columns, accent = '#1f2937', variant = 'grid', minRows = 0, headText = '#ffffff', fontSize = 10.5 }) {
  const cols = columns.map((c) => ({ key: c, ...COLS[c] }));
  const filler = Math.max(0, minRows - lines.length);
  const grid = variant === 'grid';
  const cell = grid ? 'border border-gray-300' : 'border-b border-gray-200';
  const headStyle =
    variant === 'filled' || grid
      ? { backgroundColor: accent, color: headText }
      : variant === 'tint'
        ? { backgroundColor: `${accent}12`, color: accent }
        : { color: accent, borderBottom: `2px solid ${accent}` };

  return (
    <table className="w-full border-collapse" style={{ fontSize }}>
      <thead>
        <tr style={headStyle}>
          {cols.map((c) => (
            <th
              key={c.key}
              className={`${grid ? 'border border-gray-300' : ''} px-1.5 py-1.5 font-bold uppercase tracking-wide ${alignClass[c.align]}`}
              style={{ width: c.w, fontSize: fontSize - 1.5 }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={l.id || i} style={variant === 'striped' && i % 2 ? { backgroundColor: `${accent}08` } : undefined}>
            {cols.map((c) => (
              <td key={c.key} className={`${cell} px-1.5 py-1 align-top text-gray-700 ${alignClass[c.align]}`}>
                {c.get(l)}
              </td>
            ))}
          </tr>
        ))}
        {Array.from({ length: filler }).map((_, i) => (
          <tr key={`f-${i}`}>
            {cols.map((c) => (
              <td key={c.key} className={`${cell} px-1.5 py-1`}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
