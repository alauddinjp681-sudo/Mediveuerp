import React from 'react';
import { Check } from 'lucide-react';
import { Modal, cn } from '../ui';
import { TEMPLATES, ACCENTS } from '../invoice-templates';

const THUMB_W = 200;

export default function TemplatePicker({ isOpen, onClose, value, onChange, accent, onAccentChange, sampleDoc }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Bill Template" size="xl">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-sm text-slate-400">Accent colour</span>
        {ACCENTS.map((c) => (
          <button
            key={c}
            onClick={() => onAccentChange(c)}
            className={cn('w-8 h-8 rounded-full border-2 transition', accent === c ? 'border-white scale-110' : 'border-transparent')}
            style={{ backgroundColor: c }}
            aria-label={`Accent ${c}`}
            aria-pressed={accent === c}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {TEMPLATES.map((t) => {
          const scale = THUMB_W / t.width;
          const active = value === t.id;
          const { Component } = t;
          return (
            <button
              key={t.id}
              onClick={() => { onChange(t.id); onClose(); }}
              className={cn('group text-left rounded-xl border p-2 transition bg-ink-950', active ? 'border-brand-sky ring-2 ring-brand-sky/30' : 'border-white/10 hover:border-white/30')}
            >
              <div className="relative h-[220px] overflow-hidden rounded-lg bg-slate-200 flex justify-center">
                <div className="pointer-events-none shrink-0" style={{ width: t.width, transform: `scale(${scale})`, transformOrigin: 'top center' }} aria-hidden="true">
                  <Component doc={{ ...sampleDoc, options: { ...sampleDoc.options, accent } }} />
                </div>
                {active && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand-sky text-white flex items-center justify-center">
                    <Check size={14} />
                  </span>
                )}
              </div>
              <div className="px-1 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{t.name}</span>
                  <span className="text-[10px] text-slate-400 border border-white/10 rounded px-1.5">{t.paper}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
