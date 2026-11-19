import React from 'react';
import { Field } from '../ui';
import { DOCUMENT_TYPES } from '../../lib/invoice';

export default function BillDetails({
  buyer,
  setBuyer,
  invoice,
  setInvoice,
  taxMode,
  setTaxMode,
}) {
  const inv = (key) => ({
    value: invoice[key] || '',
    onChange: (e) => setInvoice({ ...invoice, [key]: e.target.value }),
  });
  return (
    <details className="mt-4 border-t border-white/10 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand-sky">
        Customer, tax & invoice details
      </summary>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ['phone', 'Mobile'],
          ['address', 'Address'],
          ['gstin', 'GSTIN'],
          ['dlNumber', 'D.L. No.'],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={buyer[key] || ''}
            onChange={(e) =>
              setBuyer({
                ...buyer,
                [key]:
                  key === 'gstin'
                    ? e.target.value.toUpperCase()
                    : e.target.value,
              })
            }
          />
        ))}
        <Field as="select" label="Document" {...inv('docType')}>
          {DOCUMENT_TYPES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </Field>
        <Field label="Invoice number" {...inv('invoiceNumber')} />
        <Field label="Date" type="date" {...inv('date')} />
        <Field label="Due date" type="date" {...inv('dueDate')} />
        <Field label="Place of supply" {...inv('placeOfSupply')} />
        <Field
          label="Tax type"
          as="select"
          value={taxMode}
          onChange={(e) => setTaxMode(e.target.value)}
        >
          <option value="intra">CGST + SGST</option>
          <option value="inter">IGST (Inter-state)</option>
        </Field>
        <Field
          label="Notes"
          as="textarea"
          rows={2}
          className="sm:col-span-2"
          {...inv('notes')}
        />
      </div>
    </details>
  );
}
