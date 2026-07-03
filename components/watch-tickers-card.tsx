'use client';

// "Watch my tickers" capture card — the no-account middle step of the funnel.
// Email + up to 5 tickers; Helm emails when evidence lands. Rendered on the
// public /analyze/[ticker] and /thesis/[ticker] pages, prefilled with the page's
// ticker. POSTs to /api/watch/subscribe (double opt-in via email).

import { useState } from 'react';

const MAX_TICKERS = 5;

export function WatchTickersCard({ ticker }: { ticker: string }) {
  const [email, setEmail] = useState('');
  const [tickers, setTickers] = useState<string[]>([ticker.toUpperCase()]);
  const [entry, setEntry] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  function addTicker(raw: string) {
    const t = raw.trim().toUpperCase().replace(/[^A-Z.\-]/g, '');
    if (!t || tickers.includes(t) || tickers.length >= MAX_TICKERS) return;
    setTickers([...tickers, t]);
  }

  function onEntryKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTicker(entry);
      setEntry('');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'sending') return;
    const pending = entry.trim() ? [...tickers, entry.trim().toUpperCase()] : tickers;
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/watch/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tickers: pending.slice(0, MAX_TICKERS) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Try again.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setError('Something went wrong. Try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="border border-[var(--color-border-base)] rounded-lg p-6 bg-[rgba(230,185,77,0.04)]">
        <p className="type-eyebrow text-[var(--color-gold)] mb-2">Check your email</p>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
          One click to confirm and Helm starts watching {tickers.join(', ')}. You get an email
          when something in the filings or reporting actually changes. No account needed.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-border-base)] rounded-lg p-6">
      <p className="type-eyebrow text-[var(--color-gold)] mb-2">Watch my tickers</p>
      <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)] mb-1.5">
        Helm reads the filings so you don&apos;t have to.
      </h3>
      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-4">
        Get an email when something changes on your tickers: the exact quote, dated and sourced.
        No account, no brokerage connection, unsubscribe anytime.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {tickers.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-mono font-semibold text-[var(--color-text-primary)] border border-[var(--color-border-base)] rounded"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => setTickers(tickers.filter((x) => x !== t))}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-red,#F87171)] transition-colors"
              >
                ×
              </button>
            </span>
          ))}
          {tickers.length < MAX_TICKERS && (
            <input
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={onEntryKey}
              onBlur={() => { if (entry.trim()) { addTicker(entry); setEntry(''); } }}
              placeholder="Add ticker"
              aria-label="Add another ticker"
              className="w-24 px-2 py-1 text-[12px] font-mono bg-transparent border border-dashed border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]"
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="flex-1 min-w-0 px-3 py-2.5 text-[14px] bg-[var(--color-bg-base)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]"
          />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="px-5 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-60 text-[var(--color-bg-base)] text-[14px] font-semibold rounded transition-colors whitespace-nowrap"
          >
            {state === 'sending' ? 'Sending…' : 'Start watching'}
          </button>
        </div>

        {error && <p className="text-[12px] text-[#F87171]">{error}</p>}
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Evidence is quoted verbatim from public sources. Not financial advice.
        </p>
      </form>
    </div>
  );
}
