import React, { useState } from 'react';
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button, Card, Field, BrandMark } from './ui';

const ADMIN_EMAIL = 'admin@mediveu.com';
const ADMIN_PASSWORD = 'mediveu@2006';

export default function AdminLogin({ onLogin, navigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setError('');
      onLogin(true);
    } else {
      setError('Invalid admin ID or password');
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center p-4 bg-ink-950 bg-[radial-gradient(ellipse_at_top,rgba(30,123,240,0.18),transparent_60%)]">
      <Card className="w-full max-w-md p-7">
        <div className="flex flex-col items-center gap-4 mb-6">
          <BrandMark />
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-300 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
            <Shield size={14} /> Super Admin
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Admin Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
          <Button type="submit" className="w-full">Authenticate <ArrowRight size={16} /></Button>
          <button type="button" onClick={() => navigate('public', 'home')} className="w-full text-slate-500 text-sm hover:text-slate-300">
            Back to website
          </button>
        </form>
      </Card>
    </main>
  );
}
