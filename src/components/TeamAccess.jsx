import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Copy, KeyRound, RefreshCw, Users } from 'lucide-react';
import { db } from '../firebase';
import { storeCollection } from '../lib/storeAccess';
import { Button, Card, Field } from './ui';
import { readableFirebaseError } from '../lib/firebaseError';

const roles = [
  { id: 'manager', label: 'Manager' },
  { id: 'worker', label: 'Worker / Staff' },
  { id: 'accountant', label: 'Accountant' },
];
const INVITATION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function makeInvitationCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashInvitationCode(code) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function TeamAccess({ user, showToast }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('worker');
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user?.storeId || user.role !== 'owner') return undefined;
    setLoadError('');
    return onSnapshot(collection(db, 'stores', user.storeId, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    }, (error) => {
      setLoadError(readableFirebaseError(error, 'Team membership could not be loaded.'));
    });
  }, [user?.storeId, user?.role, retryKey]);

  const createInvite = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      showToast('Enter a valid teammate email address', 'error');
      return;
    }
    if (!roles.some((item) => item.id === role)) {
      showToast('Choose a valid team role', 'error');
      return;
    }

    setBusy(true);
    try {
      const code = makeInvitationCode();
      const invitationId = await hashInvitationCode(code);
      await setDoc(doc(db, 'storeInvitations', invitationId), {
        storeId: user.storeId,
        email: normalizedEmail,
        role,
        status: 'pending',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + INVITATION_LIFETIME_MS),
      });
      setInvite({ code, email: normalizedEmail, expiresInDays: 14 });
      setEmail('');
      showToast('Invitation code created. Share it only with the invited email.');
    } catch (error) {
      showToast(readableFirebaseError(error, 'Could not create invitation.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (memberUid, nextRole) => {
    if (!roles.some((item) => item.id === nextRole)) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'stores', user.storeId, 'members', memberUid), { role: nextRole });
      showToast('Team permissions updated');
    } catch (error) {
      showToast(readableFirebaseError(error, 'Could not update team role.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      showToast('Invitation code copied');
    } catch {
      showToast('Select and copy the invitation code manually', 'error');
    }
  };

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-sky/20 bg-brand-sky/10 text-brand-sky"><Users size={19} /></div>
        <div>
          <h2 className="font-bold text-white">Store team access</h2>
          <p className="mt-1 text-sm text-slate-400">Invite teammates by email and give each person only the access their job needs.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_190px_auto] sm:items-end">
        <Field label="Teammate email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@store.com" />
        <Field as="select" label="Role" value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Field>
        <Button type="button" onClick={createInvite} disabled={busy}><KeyRound size={16} /> Create invite</Button>
      </div>

      {invite && (
        <div className="rounded-xl border border-brand-sky/20 bg-brand-sky/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Invitation for {invite.email}</p>
              <p className="mt-1 text-xs text-slate-400">Share the code with this person. It expires in {invite.expiresInDays} days and can be used once.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyCode}><Copy size={15} /> Copy code</Button>
          </div>
          <code className="mt-3 block break-all rounded-lg bg-ink-950/70 p-3 text-xs leading-5 text-brand-sky">{invite.code}</code>
          <p className="mt-2 text-xs text-slate-500">They should enter the code during registration using this exact email address.</p>
        </div>
      )}

      <div className="border-t border-white/[0.07] pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Active members <span className="text-slate-500">({members.length})</span></h3>
            <p className="mt-1 text-xs text-slate-500">Role changes take effect on the next Firestore operation.</p>
          </div>
          <RefreshCw size={16} className="text-slate-500" aria-hidden="true" />
        </div>
        {loadError && <p role="alert" className="mb-3 text-sm text-red-300">{loadError} <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="text-brand-sky underline">Retry</button></p>}
        <div className="divide-y divide-white/[0.06]">
          {!loadError && members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{member.email || member.id}</p>
                {member.id === user.uid && <span className="text-xs text-brand-sky">You</span>}
              </div>
              {member.role === 'owner' ? (
                <span className="rounded-full border border-brand-sky/20 bg-brand-sky/10 px-3 py-1 text-xs font-semibold text-brand-sky">Owner</span>
              ) : (
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="sr-only">Role for {member.email || member.id}</span>
                  <select value={member.role} disabled={busy} onChange={(event) => changeRole(member.id, event.target.value)} className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-sky/60">
                    {roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
          {!loadError && !members.length && <p className="py-4 text-sm text-slate-500">No team members yet.</p>}
        </div>
      </div>
    </Card>
  );
}
