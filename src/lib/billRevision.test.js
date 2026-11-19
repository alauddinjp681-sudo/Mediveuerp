import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLines, stockChanges, changeLabels } from './billRevision.js';
const line = {
  description: 'Item',
  inventoryId: 'stock',
  qty: 2,
  free: 1,
  rate: 40,
  disPercent: 10,
  gstPercent: 5,
};
const sale = { status: 'final', items: [line], revision: 1 },
  draft = { ...sale, status: 'draft' };
test('drafts never consume stock; finalizing includes free units', () => {
  assert.deepEqual(stockChanges(null, draft, []), []);
  assert.deepEqual(stockChanges(draft, sale, []), [['stock', -3]]);
});
test('saved edits apply only net changes by inventory id', () => {
  assert.deepEqual(stockChanges(sale, sale, []), []);
  assert.deepEqual(stockChanges(sale, { ...sale, items: [line, line] }, []), [
    ['stock', -3],
  ]);
  assert.deepEqual(
    stockChanges(
      sale,
      { ...sale, items: [{ ...line, inventoryId: 'other' }] },
      [],
    ),
    [
      ['stock', 3],
      ['other', -3],
    ],
  );
});
test('estimates do not consume stock', () =>
  assert.deepEqual(
    stockChanges(
      null,
      { ...sale, invoiceDetails: { docType: 'estimate' } },
      [],
    ),
    [],
  ));
test('invalid amounts and unnamed priced lines are not silently posted', () => {
  for (const patch of [
    { qty: 0 },
    { rate: -1 },
    { free: -2 },
    { disPercent: 101 },
    { gstPercent: -1 },
    { description: '' },
  ])
    assert.throws(() => validateLines([{ ...line, ...patch }], 0));
  assert.throws(() => validateLines([line], -1));
  assert.deepEqual(validateLines([line, { description: '', rate: '' }], 0), [
    line,
  ]);
});
test('audit identifies line and status changes', () =>
  assert.deepEqual(changeLabels(draft, { ...sale, items: [] }), [
    'Line items',
    'Status',
  ]));
