'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TickerSearch } from '@/app/analyze/ticker-search';
import { TrendingUp, TrendingDown, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { parseResearchTicker } from '@/lib/research-ticker';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface HoldingMover {
  ticker: string;
  name: string;
  changePct: number;
  dollarImpact: number;
}

/* ── Mono uppercase eyebrow ── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
      style={MONO}
    >
      {children}
    </div>
  );
}

// Navigation does not tell us whether a report is cached or being generated.
function GeneratingOverlay({ symbol }: { symbol: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-6 sm:px-10 text-center"
      style={{ background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(3px)' }}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-[30px] h-[30px] text-[var(--color-gold)] animate-spin" strokeWidth={1.8} />
      <div className="text-[16px] font-semibold text-[var(--color-text-primary)]">
        Opening research on <span className="text-[var(--color-gold)]">{symbol}</span>…
      </div>
      <div
        className="text-[12px] tracking-[0.04em] text-[var(--color-text-muted)]"
        style={MONO}
      >
        Company overview · bull and bear cases · supporting sources
      </div>
      <div className="mt-1.5 flex w-[min(460px,80%)] flex-col gap-[9px]">
        <div className="h-[9px] w-[92%] rounded-[3px] bg-white/[0.06] animate-pulse" />
        <div className="h-[9px] w-[78%] rounded-[3px] bg-white/[0.06] animate-pulse [animation-delay:0.2s]" />
        <div className="h-[9px] w-[85%] rounded-[3px] bg-white/[0.06] animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  );
}

export default function DashboardAnalyzePage() {
  const router = useRouter();
  const [movers, setMovers] = useState<HoldingMover[]>([]);
  const [holdingsStatus, setHoldingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null);
  const [tickerError, setTickerError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setHoldingsStatus('loading');
    async function loadHoldings() {
      try {
        const response = await fetch('/api/dashboard/brief', { signal: controller.signal });
        if (!response.ok) throw new Error('Holdings unavailable');
        const data = await response.json();
        if (!Array.isArray(data?.allHoldings)) throw new Error('Holdings unavailable');
        if (controller.signal.aborted) return;
        setMovers([...data.allHoldings].sort((a: HoldingMover, b: HoldingMover) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)));
        setHoldingsStatus('ready');
      } catch {
        if (!controller.signal.aborted) setHoldingsStatus('error');
      }
    }
    void loadHoldings();
    return () => controller.abort();
  }, [attempt]);

  const portfolioMovers = {
    gainers: movers.filter(m => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 4),
    losers: movers.filter(m => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 4),
  };

  const analyzeTicker = useCallback(
    (raw: string) => {
      const result = parseResearchTicker(raw);
      if (!result.ok) {
        setTickerError(result.message);
        return;
      }
      setTickerError(null);
      setGenerating(result.ticker);
      router.push(`/dashboard/analyze/${result.ticker}`);
    },
    [router],
  );

  return (
    <div className="relative px-6 sm:px-8 lg:px-10 py-8 space-y-8">
      {generating && <GeneratingOverlay symbol={generating} />}

      {/* Search */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Eyebrow>Analyze</Eyebrow>
          <h1 className="text-[32px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] leading-none">
            Know the position. Read the evidence.
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            Explore the bull case, the risks, and the data behind a US stock. Start with a ticker.
          </p>
        </div>
        <div className="max-w-2xl">
          <TickerSearch basePath="/dashboard/analyze" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mr-1" style={MONO}>
            Popular
          </span>
          {POPULAR_TICKERS.map((ticker) => (
            <button
              key={ticker}
              type="button"
              onClick={() => analyzeTicker(ticker)}
              className="rounded-[5px] border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-4 py-2 text-[15px] font-semibold uppercase tracking-[0.04em] text-[var(--color-gold)] transition-colors hover:bg-[rgba(230,185,77,0.14)]"
              style={MONO}
            >
              {ticker}
            </button>
          ))}
        </div>
        {tickerError && <p role="alert" className="text-sm text-[var(--color-negative-text)]">{tickerError}</p>}
      </div>

      {holdingsStatus === 'loading' && (
        <div className="border-t border-[var(--color-border-subtle)] pt-7" role="status" aria-live="polite">
          <p className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading your holdings</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]" />)}
          </div>
        </div>
      )}

      {holdingsStatus === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-gold)]" />
            <div><p className="text-sm font-semibold text-[var(--color-text-primary)]">Your holdings couldn&apos;t load.</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">You can still research any ticker above.</p></div>
          </div>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-md border border-[var(--color-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-gold-border)]">Try again</button>
        </div>
      )}

      {holdingsStatus === 'ready' && movers.length === 0 && (
        <div className="grid gap-6 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-xl space-y-3">
            <Eyebrow>Make this research personal</Eyebrow>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Start with one position.</h2>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">Add a stock you own to see its reported daily change and open its research from here. You can enter positions yourself or connect a brokerage.</p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <Link href="/dashboard/portfolio/add" className="inline-flex items-center gap-2 rounded-md bg-[var(--color-gold)] px-5 py-3 text-sm font-semibold text-[var(--color-bg-base)] hover:bg-[var(--color-gold-hi)]">Add a position <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/dashboard/accounts" className="text-sm text-[var(--color-text-secondary)] underline underline-offset-4 hover:text-[var(--color-gold)]">Connect a brokerage</Link>
          </div>
        </div>
      )}

      {/* Holdings movers + Gainers/Losers */}
      {holdingsStatus === 'ready' && movers.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8 border-t border-[var(--color-border-subtle)] pt-8">
          {/* Your top movers */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div className="space-y-1.5">
                <Eyebrow>Largest reported dollar moves</Eyebrow>
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] leading-none">
                  Your holdings
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">Daily changes from your saved portfolio data. Open a position to read the evidence behind the business.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {movers.slice(0, 8).map((m) => {
                const up = m.changePct > 0;
                const tone = m.changePct === 0 ? 'text-[var(--color-text-muted)]' : up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]';
                return (
                  <button
                    key={m.ticker}
                    type="button"
                    onClick={() => analyzeTicker(m.ticker)}
                    aria-label={`Research ${m.ticker}`}
                    disabled={!parseResearchTicker(m.ticker).ok}
                    title={!parseResearchTicker(m.ticker).ok ? 'Research is not available for this symbol format yet.' : undefined}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-gold-border)] group"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold uppercase tracking-[0.02em] text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                        {m.changePct !== 0 && (up ? <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" /> : <TrendingDown className="w-3.5 h-3.5 text-[var(--color-negative-text)]" />)}
                      </div>
                      <div className="mt-0.5 truncate text-[14px] text-[var(--color-text-muted)]">{m.name}</div>
                      {!parseResearchTicker(m.ticker).ok && <span className="block mt-1 text-xs text-[var(--color-text-secondary)]">Research unavailable</span>}
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <div className={`text-[15px] font-bold tabular-nums ${tone}`} style={MONO}>
                        {up ? '+' : ''}{m.changePct.toFixed(2)}%
                      </div>
                      <div className={`text-[14px] tabular-nums ${tone}`} style={MONO}>
                        {m.dollarImpact > 0 ? '+' : m.dollarImpact < 0 ? '-' : ''}${Math.abs(m.dollarImpact) >= 1000 ? `${(Math.abs(m.dollarImpact) / 1000).toFixed(1)}K` : Math.abs(m.dollarImpact).toFixed(0)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Link href="/dashboard/portfolio" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-gold)]">View all {movers.length} holdings <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>

          {/* Gainers / Losers */}
          <div className="space-y-6">
            <Eyebrow>Within your holdings · percentage change</Eyebrow>
            {portfolioMovers.gainers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--color-positive)]" />
                  <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] leading-none">Largest gains</h2>
                </div>
                <div className="space-y-1">
                  {portfolioMovers.gainers.map((m) => (
                    <button
                      key={m.ticker}
                      type="button"
                      onClick={() => analyzeTicker(m.ticker)}
                      disabled={!parseResearchTicker(m.ticker).ok}
                      title={!parseResearchTicker(m.ticker).ok ? 'Research unavailable for this symbol format' : undefined}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-surface)] group"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-14 shrink-0 text-[15px] font-bold uppercase text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                        <span className="truncate text-[15px] text-[var(--color-text-muted)]">{m.name}{!parseResearchTicker(m.ticker).ok && <span className="block text-xs">Research unavailable</span>}</span>
                      </div>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--color-positive)]" style={MONO}>+{m.changePct.toFixed(2)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {portfolioMovers.losers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[var(--color-negative-text)]" />
                  <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] leading-none">Largest declines</h2>
                </div>
                <div className="space-y-1">
                  {portfolioMovers.losers.map((m) => (
                    <button
                      key={m.ticker}
                      type="button"
                      onClick={() => analyzeTicker(m.ticker)}
                      disabled={!parseResearchTicker(m.ticker).ok}
                      title={!parseResearchTicker(m.ticker).ok ? 'Research unavailable for this symbol format' : undefined}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-surface)] group"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-14 shrink-0 text-[15px] font-bold uppercase text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                        <span className="truncate text-[15px] text-[var(--color-text-muted)]">{m.name}{!parseResearchTicker(m.ticker).ok && <span className="block text-xs">Research unavailable</span>}</span>
                      </div>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--color-negative-text)]" style={MONO}>{m.changePct.toFixed(2)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {portfolioMovers.gainers.length === 0 && portfolioMovers.losers.length === 0 && <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">No price moves are reported in your saved holdings. You can still open a position for research.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
