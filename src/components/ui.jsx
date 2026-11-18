import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import logo from '../logo.webp';

export const cn = (...classes) => classes.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return <button type={type} className={cn(VARIANTS[variant], className)} {...props} />;
}

export function Field({ label, id, className = '', hint, as = 'input', children, ...props }) {
  const inputId = id || (label ? `f-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  const Comp = as;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="field-label">{label}</label>}
      <Comp id={inputId} className="field" {...props}>{children}</Comp>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Card({ className = '', children, ...props }) {
  return <div className={cn('card p-5', className)} {...props}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="hidden sm:flex w-11 h-11 rounded-xl bg-brand-gradient/10 border border-white/10 items-center justify-center text-brand-sky shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-white text-balance">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5 text-pretty">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  const tones = {
    neutral: 'bg-white/5 text-slate-300 border-white/10',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-300 border-red-500/20',
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  };
  return <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', tones[tone], className)}>{children}</span>;
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('bg-ink-900 border border-white/10 w-full rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl', sizes[size])}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 sticky top-0 bg-ink-900 z-10">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [message, onClose]);
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertTriangle : Info;
  const tone = type === 'success' ? 'border-emerald-500/40 text-emerald-100' : type === 'error' ? 'border-red-500/40 text-red-100' : 'border-sky-500/40 text-sky-100';
  return (
    <div role="status" aria-live="polite" className={cn('fixed z-[60] left-4 right-4 bottom-20 md:bottom-6 md:left-auto md:right-6 md:max-w-sm flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border bg-ink-850/95 backdrop-blur', tone)}>
      <Icon size={18} className="shrink-0" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

export function BrandMark({ size = 'md', className = '' }) {
  const s = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const t = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={logo} alt="" width="48" height="48" className={cn(s, 'rounded-xl object-cover shadow-glow')} />
      <span className={cn(t, 'font-extrabold tracking-tight text-white leading-none')}>
        MEDI<span className="text-brand-green">VEU</span> <span className="gradient-text">ERP</span>
      </span>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4">{icon}</div>
      <h3 className="text-white font-semibold">{title}</h3>
      {text && <p className="text-sm text-slate-400 mt-1 max-w-sm text-pretty">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-9 w-9 rounded-full border-2 border-white/10 border-t-brand-sky animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export const isComposing = (e) => e.nativeEvent?.isComposing || e.keyCode === 229;
