import React, { useState } from 'react';
import { AlertTriangle, Copy, LogOut, RotateCw, ShieldCheck } from 'lucide-react';
import { BrandMark } from './ui';

export default function StoreSetupError({ error, running, onRetry, onSignOut }) {
  const [copied, setCopied] = useState(false);
  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(`${error.title}\n${error.message}\n${error.technical}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-ink-950 p-6">
      <BrandMark size="lg" />
      <section role="alert" aria-live="assertive" className="w-full max-w-lg rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-xl font-bold text-white text-balance">{error.title}</h1>
            <p className="text-sm leading-6 text-slate-300 text-pretty">{error.message}</p>
          </div>
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-emerald-300">
          <ShieldCheck size={16} aria-hidden="true" />
          Your existing bills, stock and customers have not been deleted.
        </p>

        {error.technical && (
          <details className="mt-4 rounded-xl border border-white/10 bg-ink-900/60 p-3 text-left">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">Technical details</summary>
            <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-400">{error.technical}</p>
            <button type="button" onClick={copyDetails} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-sky">
              <Copy size={14} aria-hidden="true" />
              {copied ? 'Copied' : 'Copy details for support'}
            </button>
          </details>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {error.retryable && (
            <button type="button" onClick={onRetry} disabled={running} aria-busy={running}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-sky px-4 py-2 text-sm font-semibold text-ink-950 disabled:opacity-60">
              <RotateCw size={16} className={running ? 'animate-spin' : ''} aria-hidden="true" />
              {running ? 'Retrying...' : 'Retry setup'}
            </button>
          )}
          <button type="button" onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200">
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
