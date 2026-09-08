'use client';

import { useState, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { parseResearchTicker } from '@/lib/research-ticker';

export function TickerSearch({ basePath = '/analyze', size = 'md' }: { basePath?: string; size?: 'md' | 'lg' }) {
  const isLg = size === 'lg';
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result = parseResearchTicker(ticker);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setLoading(true);
      router.push(`${basePath}/${result.ticker}`);
    },
    [ticker, router, basePath],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <div className="flex-1 relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] ${isLg ? 'w-6 h-6' : 'w-5 h-5'}`} />
        <input
          type="text"
          value={ticker}
          onChange={(e) => { setTicker(e.target.value.toUpperCase()); setError(null); }}
          placeholder="Enter ticker symbol (e.g. AAPL)"
          aria-label="Stock or ETF ticker"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          className={`w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors tracking-wider disabled:opacity-60 ${isLg ? 'pl-14 pr-5 py-5 text-xl' : 'pl-12 pr-4 py-3.5 text-base'}`}
          style={{ fontFamily: 'var(--font-mono)' }}
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={!ticker.trim() || loading}
        className={`bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${isLg ? 'px-10 py-5 text-lg' : 'px-8 py-3.5 text-[15px]'}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Opening…
          </>
        ) : (
          'Analyze'
        )}
      </button>
      </div>
      {error && <p id={errorId} role="alert" className="mt-2 text-sm leading-relaxed text-[var(--color-negative-text)]">{error}</p>}
    </form>
  );
}
