'use client';

import posthog from 'posthog-js';

// Signup door on the public /analyze/[ticker] page. The analysis above it is
// something anyone can read; the proposition here is the same ticker against
// the reader's own holdings, which is what an account adds. Rendered twice:
// inside the terminal's center pane and again after the watch card, so the
// click event carries the placement.
export function AnalyzeSignupCta({
  ticker,
  placement,
}: {
  ticker: string;
  placement: 'terminal' | 'after_watch';
}) {
  return (
    <div className="border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.025] rounded-lg p-6 text-center space-y-2.5">
      <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">
        Hold {ticker}? See what it does to your whole book.
      </p>
      <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
        Connect a brokerage read-only and Helm shows {ticker} next to everything you hold: how
        concentrated you are, what moved today, and a daily brief on all of it. Free, no card.
      </p>
      <a
        href={`/signup?next=${encodeURIComponent(`/dashboard/analyze/${encodeURIComponent(ticker.trim().toUpperCase())}`)}`}
        onClick={() => posthog.capture('analyze_cta_clicked', { ticker, placement })}
        className="inline-block px-6 py-2.5 bg-[var(--color-gold)] hover:brightness-[1.08] text-[var(--color-text-inverse)] text-[15px] font-semibold rounded-md transition-all"
      >
        See {ticker} in my portfolio
      </a>
    </div>
  );
}
