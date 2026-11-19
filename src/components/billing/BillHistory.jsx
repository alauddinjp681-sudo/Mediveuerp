import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { storeDocument } from '../../lib/storeAccess';
import { formatMoney, toMillis } from '../../lib/format';

export default function BillHistory({ storeId, billId }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open || !storeId) return;
    setError(false);
    setEvents(null);
    return onSnapshot(
      collection(storeDocument(storeId, 'bills', billId), 'events'),
      (snapshot) =>
        setEvents(
          snapshot.docs
            .map((d) => ({ ...d.data(), id: d.id }))
            .sort((a, b) => toMillis(b.changedAt) - toMillis(a.changedAt)),
        ),
      () => setError(true),
    );
  }, [open, storeId, billId]);
  return (
    <details
      className="card p-4 no-print"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="text-sm font-semibold cursor-pointer">
        Invoice change history
      </summary>
      <ol className="grid gap-3 mt-3">
        {events?.map((e) => (
          <li key={e.id} className="text-sm">
            <strong className="capitalize">
              {e.action?.replaceAll('_', ' ') || 'Updated'}
            </strong>{' '}
            · {e.actorEmail || e.actorRole || 'Team member'}
            <div className="text-slate-400">
              {e.changedAt?.toDate?.().toLocaleString('en-IN') ||
                'Sync pending'}
              {e.revision ? ` · Revision ${e.revision}` : ''}
            </div>
            {!!e.changes?.length && <p>{e.changes.join(', ')}</p>}
            {e.previousTotal != null && e.total !== e.previousTotal && (
              <p>
                Total: {formatMoney(e.previousTotal)} → {formatMoney(e.total)}
              </p>
            )}
          </li>
        ))}
      </ol>
      {(!events?.length || error) && (
        <p className="text-sm text-slate-400">
          {error
            ? 'History could not be loaded.'
            : events
              ? 'No recorded changes for this invoice.'
              : 'Loading history…'}
        </p>
      )}
    </details>
  );
}
