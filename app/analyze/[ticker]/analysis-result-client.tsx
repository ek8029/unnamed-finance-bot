'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StockAnalysisCard, AnalysisWatermark } from '@/components/analysis/analysis-cards';
import type { StockAnalysis } from '@/components/analysis/types';
import { Lock, Search, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'helm_analysis_count';
const FREE_LIMIT = 1;

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];

function getViewCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementViewCount(): number {
  const current = getViewCount();
  const next = current + 1;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // localStorage not available
  }
  return next;
}

function InlineSearch({ currentTicker }: { currentTicker: string }) {
  const router = useRouter();
  const [input, setInput] = useState(currentTicker);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const clean = input.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (clean && clean.length <= 5 && clean !== currentTicker) {
        setLoading(true);
        router.push(`/analyze/${clean}`);
      }
    },
    [input, currentTicker, router],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Ticker symbol"
          maxLength={5}
          disabled={loading}
          className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-sm tracking-wider disabled:opacity-60"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>
      <button
        type="submit"
        disabled={!input.trim() || input.trim().toUpperCase() === currentTicker || loading}
        className="px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-sm transition-colors text-sm whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analyzing…
          </>
        ) : (
          'Analyze'
        )}
      </button>
    </form>
  );
}

function RelatedTickers({ currentTicker }: { currentTicker: string }) {
  const others = POPULAR_TICKERS.filter((t) => t !== currentTicker).slice(0, 6);

  return (
    <div className="space-y-3">
      <p
        className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Analyze another stock
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((t) => (
          <a
            key={t}
            href={`/analyze/${t}`}
            className="px-3.5 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold-border)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {t}
          </a>
        ))}
      </div>
    </div>
  );
}

export function AnalysisResultClient({
  analysis,
  ticker,
}: {
  analysis: StockAnalysis;
  ticker: string;
}) {
  const [gated, setGated] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const count = incrementViewCount();
    if (count > FREE_LIMIT) {
      setGated(true);
    }
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setGated(false);
        // Grant 5 more analyses
        try {
          localStorage.setItem(STORAGE_KEY, '0');
        } catch {
          // ignore
        }
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const shareUrl = `https://helmterminal.dev/analyze/${ticker}`;
  const shareText = `Check out this AI analysis of $${ticker} — institutional-grade insights for free:`;

  const shareOnX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
    );
  };

  // Don't render gated state during SSR — show full content for crawlers
  if (!mounted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <StockAnalysisCard analysis={analysis} />
        <AnalysisWatermark />
      </div>
    );
  }

  const searchBar = <InlineSearch currentTicker={ticker} />;
  const relatedTickers = <RelatedTickers currentTicker={ticker} />;

  if (gated) {
    return (
      <div className="space-y-6">
        {/* Search bar */}
        {searchBar}

        {/* Blurred preview */}
        <div className="relative">
          <div className="blur-[6px] pointer-events-none select-none" aria-hidden="true">
            <StockAnalysisCard analysis={analysis} />
          </div>

          {/* Gate overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="glass-card rounded-sm p-8 max-w-sm w-full mx-4 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
                  <Lock className="w-4 h-4 text-[var(--color-gold)]" />
                </div>
              </div>
              <div>
                <h3 className="type-h2 text-[var(--color-text-primary)] mb-1">
                  Enter your email to continue
                </h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  Get unlimited free stock analyses and early access to Helm Terminal.
                </p>
              </div>
              <form onSubmit={handleUnlock} className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full px-4 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-sm transition-colors text-sm disabled:opacity-50"
                >
                  {status === 'loading' ? 'Unlocking...' : 'Unlock Analysis'}
                </button>
              </form>
              {status === 'error' && (
                <p className="text-[12px] text-[var(--color-negative)]">Something went wrong. Try again.</p>
              )}
            </div>
          </div>
        </div>
        <AnalysisWatermark />

        {/* Related tickers */}
        {relatedTickers}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search bar */}
      {searchBar}

      <StockAnalysisCard analysis={analysis} />

      {/* Share bar */}
      <div className="flex items-center justify-between py-3 border-t border-b border-[var(--color-border-subtle)]">
        <span className="type-eyebrow text-[var(--color-text-muted)]">Share this analysis</span>
        <div className="flex gap-2">
          <button
            onClick={shareOnX}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
        </div>
      </div>

      <AnalysisWatermark />

      {/* Related tickers */}
      {relatedTickers}

      {/* CTA */}
      <div className="glass-card rounded-sm p-6 text-center space-y-3">
        <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
          Want AI analysis of your entire portfolio?
        </p>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
          Helm Terminal connects to your brokerage, analyzes your holdings, and delivers actionable intelligence weekly.
        </p>
        <a
          href="/signup"
          className="inline-block px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded-sm transition-colors"
        >
          Get started free
        </a>
      </div>
    </div>
  );
}
