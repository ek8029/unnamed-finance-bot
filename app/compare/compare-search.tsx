'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function CompareSearch() {
  const router = useRouter();
  const [ticker1, setTicker1] = useState('');
  const [ticker2, setTicker2] = useState('');

  const handleCompare = useCallback(() => {
    const t1 = ticker1.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const t2 = ticker2.trim().toUpperCase().replace(/[^A-Z]/g, '');
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
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="AAPL"
          value={ticker1}
          onChange={(e) => setTicker1(e.target.value.toUpperCase().slice(0, 5))}
          onKeyDown={handleKeyDown}
          maxLength={5}
          aria-label="First ticker symbol"
          className="flex-1 px-4 py-3 bg-white/[0.04] border border-[var(--color-border-base)] rounded-lg text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors text-center uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        <span
          className="text-[13px] font-semibold text-[var(--color-text-muted)] shrink-0"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          vs
        </span>
        <input
          type="text"
          placeholder="MSFT"
          value={ticker2}
          onChange={(e) => setTicker2(e.target.value.toUpperCase().slice(0, 5))}
          onKeyDown={handleKeyDown}
          maxLength={5}
          aria-label="Second ticker symbol"
          className="flex-1 px-4 py-3 bg-white/[0.04] border border-[var(--color-border-base)] rounded-lg text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors text-center uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        <button
          onClick={handleCompare}
          disabled={!isValid}
          aria-label="Compare stocks"
          className="px-5 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-bg-base)] text-[13px] font-semibold rounded-lg transition-colors shrink-0"
        >
          Compare
        </button>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-2">
        Enter any two US-listed ticker symbols (NYSE, NASDAQ, AMEX)
      </p>
    </div>
  );
}
