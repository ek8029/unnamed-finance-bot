'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';

export function TickerSearch({ basePath = '/analyze' }: { basePath?: string }) {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const clean = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (clean && clean.length <= 5) {
        setLoading(true);
        router.push(`${basePath}/${clean}`);
      }
    },
    [ticker, router, basePath],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <div className="flex-1 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter ticker symbol (e.g. AAPL)"
          maxLength={5}
          disabled={loading}
          className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors text-base tracking-wider disabled:opacity-60"
          style={{ fontFamily: 'var(--font-mono)' }}
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={!ticker.trim() || loading}
        className="px-8 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded transition-colors text-sm whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
