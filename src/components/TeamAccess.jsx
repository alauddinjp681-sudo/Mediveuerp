import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Copy, KeyRound, RefreshCw, ShieldCheck, Trash2, Users, UserRoundX } from 'lucide-react';
import { db } from '../firebase';
import { Button, Card, Field, PageHeader, Badge } from './ui';
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

function invitationExpiry(invitation) {
  return invitation.expiresAt?.toDate?.() || (invitation.expiresAt ? new Date(invitation.expiresAt) : null);
}

export default function TeamAccess({ user, showToast }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('worker');
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user?.storeId || user.role !== 'owner') return undefined;
    setLoadError('');
    let membersReady = false;
    let invitationsReady = false;
    const handleError = (error) => {
      setLoadError(readableFirebaseError(error, 'Team membership could not be loaded.'));
    };
    const unsubs = [
      onSnapshot(collection(db, 'stores', user.storeId, 'members'), (snapshot) => {
        setMembers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        membersReady = true;
        if (invitationsReady) setLoadError('');
      }, handleError),
      onSnapshot(query(collection(db, 'storeInvitations'), where('createdBy', '==', user.uid)), (snapshot) => {
        setInvitations(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).filter((invitation) => invitation.storeId === user.storeId));
        invitationsReady = true;
        if (membersReady) setLoadError('');
      }, handleError),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
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
      const expiresAt = Timestamp.fromMillis(Date.now() + INVITATION_LIFETIME_MS);
      const invitationData = {
        storeId: user.storeId,
        email: normalizedEmail,
        role,
        status: 'pending',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt,
      };
      await setDoc(doc(db, 'storeInvitations', invitationId), invitationData);
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

  const removeMember = async (member) => {
    if (member.id === user.uid || member.role === 'owner') return;
    if (!window.confirm(`Remove ${member.email || 'this teammate'} from the store? Their store access will stop immediately.`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'stores', user.storeId, 'members', member.id));
      showToast('Team member removed');
    } catch (error) {
      showToast(readableFirebaseError(error, 'Could not remove team member.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (invitation) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'storeInvitations', invitation.id), { status: 'revoked' });
      showToast('Invitation revoked');
    } catch (error) {
      showToast(readableFirebaseError(error, 'Could not revoke invitation.'), 'error');
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

  const activeMembers = members.filter((member) => member.status === 'active');
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader title="Staff / Team Management" subtitle="Invite teammates, manage access, and remove former staff." icon={<Users size={20} />} />

      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-sky/20 bg-brand-sky/10 text-brand-sky"><Users size={19} /></div>
          <div>
            <h2 className="font-bold text-white">Invite a teammate</h2>
            <p className="mt-1 text-sm text-slate-400">Create a one-time code for the teammate&apos;s email. They enter it during registration to join your store.</p>
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
                <p className="mt-1 text-xs text-slate-400">This code expires in {invite.expiresInDays} days and can be used once.</p>
              </div>
              <Button type="button" variant="secondary" onClick={copyCode}><Copy size={15} /> Copy code</Button>
            </div>
            <code className="mt-3 block break-all rounded-lg bg-ink-950/70 p-3 text-xs leading-5 text-brand-sky">{invite.code}</code>
            <p className="mt-2 text-xs text-slate-500">Share it privately. Registration must use this exact email address.</p>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Active team <span className="text-slate-500">({activeMembers.length})</span></h2>
            <p className="mt-1 text-xs text-slate-500">Role updates apply immediately. Removing a teammate stops store access.</p>
          </div>
          <RefreshCw size={16} className="text-slate-500" aria-hidden="true" />
        </div>
        {loadError && <p role="alert" className="mb-3 text-sm text-red-300">{loadError} <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="text-brand-sky underline">Retry</button></p>}
        <div className="divide-y divide-white/[0.06]">
          {!loadError && activeMembers.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{member.email || member.id}</p>
                {member.id === user.uid && <span className="text-xs text-brand-sky">You</span>}
              </div>
              {member.role === 'owner' ? (
                <Badge tone="info"><ShieldCheck size={12} /> Shop Owner</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="sr-only">Role for {member.email || member.id}</span>
                    <select value={member.role} disabled={busy} onChange={(event) => changeRole(member.id, event.target.value)} className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-sky/60">
                      {roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <Button type="button" variant="danger" className="!px-3" disabled={busy} onClick={() => removeMember(member)} aria-label={`Remove ${member.email || 'team member'}`} title="Remove access"><UserRoundX size={16} /><span className="sr-only">Remove access</span></Button>
                </div>
              )}
            </div>
          ))}
          {!loadError && !activeMembers.length && <p className="py-4 text-sm text-slate-500">No active team members yet.</p>}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-3">
          <h2 className="font-bold text-white">Pending invitations <span className="text-slate-500">({pendingInvitations.length})</span></h2>
          <p className="mt-1 text-xs text-slate-500">Invitations expire after 14 days and can be revoked anytime.</p>
        </div>
        {loadError && <p role="alert" className="mb-3 text-sm text-red-300">{loadError}</p>}
        <div className="divide-y divide-white/[0.06]">
          {!loadError && pendingInvitations.map((invitation) => {
            const expiresAt = invitationExpiry(invitation);
            const expired = expiresAt && expiresAt.getTime() <= Date.now();
            const roleLabel = roles.find((item) => item.id === invitation.role)?.label || 'Team member';
            return (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{invitation.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{roleLabel} · {expiresAt ? `${expired ? 'Expired' : 'Expires'} ${expiresAt.toLocaleDateString()}` : 'Expiry unavailable'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={expired ? 'warning' : 'neutral'}>{expired ? 'Expired' : 'Pending'}</Badge>
                  <Button type="button" variant="ghost" className="!px-3 text-red-300" disabled={busy} onClick={() => revokeInvite(invitation)} aria-label={`Revoke invitation for ${invitation.email}`} title="Revoke invitation"><Trash2 size={16} /><span className="sr-only">Revoke invitation</span></Button>
                </div>
              </div>
            );
          })}
          {!loadError && !pendingInvitations.length && <p className="py-4 text-sm text-slate-500">No pending invitations.</p>}
        </div>
      </Card>
    </div>
  );
}
