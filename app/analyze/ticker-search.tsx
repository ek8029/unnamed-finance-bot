'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';

export function TickerSearch() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const clean = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (clean && clean.length <= 5) {
        setLoading(true);
        router.push(`/analyze/${clean}`);
      }
    },
    [ticker, router],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto w-full">
      <div className="flex-1 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter ticker symbol (e.g. AAPL)"
          maxLength={5}
          disabled={loading}
          className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-sm tracking-wider disabled:opacity-60"
          style={{ fontFamily: 'var(--font-mono)' }}
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={!ticker.trim() || loading}
        className="px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-sm transition-colors text-sm whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          'Analyze'
        )}
      </button>
    </form>
  );
}
