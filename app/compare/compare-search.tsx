'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseResearchTicker } from '@/lib/research-ticker';

export function CompareSearch() {
  const router = useRouter();
  const [ticker1, setTicker1] = useState('');
  const [ticker2, setTicker2] = useState('');
  const [error, setError] = useState('');

  const handleCompare = useCallback(() => {
    const first = parseResearchTicker(ticker1);
    const second = parseResearchTicker(ticker2);
    if (!first.ok) { setError(first.message); return; }
    if (!second.ok) { setError(second.message); return; }
    setError('');
    const t1 = first.ticker;
    const t2 = second.ticker;
    if (t1 && t2 && t1 !== t2) {
      router.push(`/compare/${t1}-vs-${t2}`);
    }
  }, [ticker1, ticker2, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCompare();
    },
    [handleCompare],
  );

  const isValid =
    ticker1.trim().length >= 1 &&
    ticker2.trim().length >= 1 &&
    ticker1.trim().toUpperCase() !== ticker2.trim().toUpperCase();

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="AAPL"
          value={ticker1}
          onChange={(e) => { setTicker1(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={handleKeyDown}
          aria-label="First ticker symbol"
          className="flex-1 min-w-0 px-1 py-3 bg-transparent border-0 border-b border-[var(--color-rule)] rounded-none text-[18px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        <span
          className="text-[14px] font-semibold text-[var(--color-text-muted)] shrink-0"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          vs
        </span>
        <input
          type="text"
          placeholder="MSFT"
          value={ticker2}
          onChange={(e) => { setTicker2(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={handleKeyDown}
          aria-label="Second ticker symbol"
          className="flex-1 min-w-0 px-1 py-3 bg-transparent border-0 border-b border-[var(--color-rule)] rounded-none text-[18px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        <button
          onClick={handleCompare}
          disabled={!isValid}
          aria-label="Compare stocks"
          className="px-5 py-3 bg-[var(--color-gold)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all shrink-0"
        >
          Compare
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--color-negative-text)]">{error}</p>}
      <p className="text-[12px] text-[var(--color-text-muted)] mt-3">
        Enter any two US-listed ticker symbols (NYSE, NASDAQ, AMEX)
      </p>
    </div>
  );
}
