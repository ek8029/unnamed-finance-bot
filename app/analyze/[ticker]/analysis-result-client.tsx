'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StockAnalysisCard, AnalysisWatermark } from '@/components/analysis/analysis-cards';
import type { StockAnalysis } from '@/components/analysis/types';
import { Search, Loader2, Link2, Check } from 'lucide-react';
import { FinancialDisclaimer } from '@/components/financial-disclaimer';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Ticker symbol"
          maxLength={5}
          disabled={loading}
          aria-label="Stock ticker symbol"
          className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/30 transition-colors text-[15px] tracking-wider disabled:opacity-60"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>
      <button
        type="submit"
        disabled={!input.trim() || input.trim().toUpperCase() === currentTicker || loading}
        className="px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-sm transition-colors text-[15px] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
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
        className="text-[12px] uppercase tracking-wider text-[var(--color-text-muted)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Analyze another stock
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((t) => (
          <a
            key={t}
            href={`/analyze/${t}`}
            className="px-3.5 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[14px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold-border)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {t}
          </a>
        ))}
      </div>
    </div>
  );
}

function ShareBar({ ticker, shareText, copyText, utmUrl }: { ticker: string; shareText: string; copyText: string; utmUrl: (medium: string) => string }) {
  const [copied, setCopied] = useState(false);

  const shareOnX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(utmUrl('twitter'))}`,
      '_blank',
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${copyText} ${utmUrl('copy')}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const btnClass = "flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[0.6875rem] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors";

  return (
    <div className="flex items-center justify-between py-3 border-t border-b border-[var(--color-border-subtle)]">
      <span className="type-eyebrow text-[var(--color-text-muted)]">Share this analysis</span>
      <div className="flex gap-2">
        <button onClick={shareOnX} className={btnClass} style={{ fontFamily: 'var(--font-mono)' }} aria-label={`Share ${ticker} analysis on X`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X
        </button>
        <button onClick={copyLink} className={btnClass} style={{ fontFamily: 'var(--font-mono)' }} aria-label={`Copy link to ${ticker} analysis`}>
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-positive)]" aria-hidden="true" /> : <Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
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
  const baseUrl = `https://helmterminal.dev/analyze/${ticker}`;
  const utmUrl = (medium: string) => `${baseUrl}?utm_source=${medium}&utm_medium=social&utm_campaign=analysis_share&utm_content=${ticker}`;

  const verdictEmoji = analysis.verdict === 'bullish' ? '🟢' : analysis.verdict === 'bearish' ? '🔴' : '🟡';
  const verdictLabel = analysis.verdict.charAt(0).toUpperCase() + analysis.verdict.slice(1);
  const shareText = `${verdictEmoji} $${ticker} (${analysis.companyName}) — ${verdictLabel}\n\n${analysis.recommendation}\n\nFull AI analysis:`;
  const copyText = `$${ticker} — ${analysis.companyName}\nVerdict: ${verdictLabel}\n\n${analysis.summary}\n\n${analysis.recommendation}\n\nFull analysis:`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search bar */}
      <InlineSearch currentTicker={ticker} />

      <StockAnalysisCard analysis={analysis} />

      <ShareBar ticker={ticker} shareText={shareText} copyText={copyText} utmUrl={utmUrl} />

      <AnalysisWatermark />

      {/* Related tickers */}
      <RelatedTickers currentTicker={ticker} />

      {/* CTA — portfolio upgrade, not a content gate */}
      <div className="glass-card rounded-sm p-6 text-center space-y-3">
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
          Want AI analysis of your entire portfolio?
        </p>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
          Helm Terminal connects to your brokerage, analyzes your holdings, and delivers actionable intelligence weekly.
        </p>
        <a
          href="/signup"
          className="inline-block px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[14px] font-semibold rounded-sm transition-colors"
        >
          Get started free
        </a>
      </div>

      <FinancialDisclaimer />
      <div className="flex items-center justify-center gap-3 py-1">
        <a href="/privacy" className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">Privacy</a>
        <span className="text-[10px] text-[var(--color-text-muted)]">&middot;</span>
        <a href="/terms" className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">Terms</a>
      </div>
    </div>
  );
}
