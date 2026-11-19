export function validateLines(items, discount) {
  const lines = items.filter((i) => i.description?.trim() || Number(i.rate));
  if (!lines.length) throw Error('Add at least one item before saving.');
  for (const [index, i] of lines.entries()) {
    if (
      !i.description?.trim() ||
      !(Number(i.qty) > 0) ||
      ['qty', 'rate', 'free', 'mrp', 'disPercent', 'gstPercent'].some(
        (k) => !Number.isFinite(Number(i[k] || 0)) || Number(i[k]) < 0,
      ) ||
      Number(i.disPercent) > 100 ||
      Number(i.gstPercent) > 100
    )
      throw Error(
        `Check the name, quantity, prices and percentages on item ${index + 1}.`,
      );
  }
  if (!Number.isFinite(Number(discount || 0)) || Number(discount) < 0)
    throw Error('Enter a non-negative extra discount.');
  return lines;
}

export function stockChanges(previous, next, inventory) {
  const changes = new Map();
  function count(bill, sign) {
    if (
      !bill ||
      bill.status === 'draft' ||
      ['estimate', 'proforma'].includes(bill.invoiceDetails?.docType)
    )
      return;
    for (const line of bill.items || []) {
      const id =
        line.inventoryId ||
        (bill === previous && !previous.revision
          ? inventory.find((i) => i.name === line.description)?.id
          : '');
      if (id)
        changes.set(
          id,
          (changes.get(id) || 0) +
            sign * (Number(line.qty || 0) + Number(line.free || 0)),
        );
    }
  }
  count(previous, 1);
  count(next, -1);
  return [...changes].filter(([, delta]) => delta !== 0);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}

export function changeLabels(previous, next) {
  if (!previous) return [];
  return [
    ['items', 'Line items'],
    ['buyerDetails', 'Buyer'],
    ['invoiceDetails', 'Invoice details'],
    ['options', 'Tax, discount or style'],
    ['templateName', 'Template'],
    ['status', 'Status'],
  ]
    .filter(
      ([key]) =>
        JSON.stringify(canonical(previous[key])) !==
        JSON.stringify(canonical(next[key])),
    )
    .map(([, label]) => label);
}
