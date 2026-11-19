import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught application render error', error, info);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error) || 'An unexpected error occurred.';
      return (
        <main className="min-h-dvh grid place-items-center bg-ink-950 p-6">
          <section role="alert" className="w-full max-w-xl rounded-2xl border border-red-400/30 bg-ink-900 p-6 shadow-2xl">
            <h1 className="text-xl font-bold text-white">The app ran into a problem</h1>
            <p className="mt-2 text-sm text-slate-300">An unexpected error stopped this screen from rendering.</p>
            <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-red-200">{message}</pre>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/60">Reload App</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
