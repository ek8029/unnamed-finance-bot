'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import posthog from 'posthog-js';

/**
 * A ticker box that sits inside an article.
 *
 * Readers can enter their own ticker or open an example without typing.
 * Track those choices separately; a click is not a completed analysis.
 */
export function AnalyzeTickerForm({
  source = 'blog',
  prompt = 'Run the free analysis on a stock you own',
  note = 'Live price and SEC EDGAR fundamentals for any US ticker. No account needed.',
}: {
  source?: string;
  prompt?: string;
  note?: string;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const ticker = raw.trim().toUpperCase().replace(/[^A-Z.\-]/g, '').slice(0, 10);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ticker) return;
        posthog.capture('blog_ticker_submitted', { source, ticker });
        router.push(`/analyze/${ticker}`);
      }}
      className="my-8 rounded-sm border border-[var(--color-gold-border)] bg-[var(--color-bg-elevated)] p-6"
    >
      <label htmlFor={`ticker-${source}`} className="mb-3 block font-sans text-[1.125rem] font-semibold text-[var(--color-text-primary)]">
        {prompt}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={`ticker-${source}`}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="NVDA"
          aria-label="Stock ticker"
          className="min-h-[44px] flex-1 rounded-sm border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] px-4 font-mono text-[15px] uppercase text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-gold)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ticker}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-[var(--color-gold)] px-5 text-[0.875rem] font-medium text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-gold-hi)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze {ticker || 'it'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem]">
        <span className="text-[var(--color-text-muted)]">Or try an example:</span>
        {['AAPL', 'MSFT', 'NVDA'].map((example) => (
          <a
            key={example}
            href={`/analyze/${example}`}
            onClick={() => posthog.capture('blog_example_clicked', { source, ticker: example })}
            className="inline-flex min-h-[44px] items-center px-1 font-mono text-[var(--color-gold)] underline underline-offset-4 hover:text-[var(--color-gold-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
          >
            {example}
          </a>
        ))}
      </div>
      <p className="mt-3 text-[0.875rem] text-[var(--color-text-muted)]">{note}</p>
    </form>
  );
}
