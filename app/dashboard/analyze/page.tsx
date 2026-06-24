'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TickerSearch } from '@/app/analyze/ticker-search';
import { TrendingUp, TrendingDown, Loader2, SearchX } from 'lucide-react';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface HoldingMover {
  ticker: string;
  name: string;
  changePct: number;
  dollarImpact: number;
}

interface MarketMover {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
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

/* ── "Helm is analyzing {TICKER}…" overlay ──
   Mirrors the spec's generating state: absolute over the screen,
   spinner + headline + sub-line + three shimmering skeleton bars. */
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
        Helm is analyzing <span className="text-[var(--color-gold)]">{symbol}</span>…
      </div>
      <div
        className="text-[12px] tracking-[0.04em] text-[var(--color-text-muted)]"
        style={MONO}
      >
        Reading filings · pulling market data · scoring the thesis
      </div>
      <div className="mt-1.5 flex w-[min(460px,80%)] flex-col gap-[9px]">
        <div className="h-[9px] w-[92%] rounded-[3px] bg-white/[0.06] animate-pulse" />
        <div className="h-[9px] w-[78%] rounded-[3px] bg-white/[0.06] animate-pulse [animation-delay:0.2s]" />
        <div className="h-[9px] w-[85%] rounded-[3px] bg-white/[0.06] animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  );
}

/* ── Invalid-ticker panel ──
   Mirrors README_round3 §2: red search-x icon, "We couldn't find {TICKER}",
   US-listed-only copy, "Search another ticker". */
function NotFoundPanel({ symbol, onReset }: { symbol: string; onReset: () => void }) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center px-10"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div className="max-w-[440px] text-center">
        <div
          className="mx-auto mb-[22px] flex h-[60px] w-[60px] items-center justify-center rounded-[14px]"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)' }}
        >
          <SearchX className="w-[26px] h-[26px] text-[var(--color-negative-text)]" strokeWidth={1.6} />
        </div>
        <div className="mb-3 text-[24px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)]">
          We couldn&apos;t find{' '}
          <span className="text-[var(--color-negative-text)]" style={MONO}>
            {symbol}
          </span>
        </div>
        <p className="mb-6 text-[15px] leading-[1.65] text-[var(--color-text-muted)]">
          Helm covers US-listed stocks and ETFs (NYSE, NASDAQ, AMEX). International, OTC, and mutual
          funds aren&apos;t supported yet.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-[7px] border border-[var(--color-border-base)] px-5 py-[11px] text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-gold-border)]"
          style={MONO}
        >
          Search another ticker
        </button>
      </div>
    </div>
  );
}

export default function DashboardAnalyzePage() {
  const router = useRouter();
  const [movers, setMovers] = useState<HoldingMover[]>([]);
  const [marketMovers, setMarketMovers] = useState<{ gainers: MarketMover[]; losers: MarketMover[] }>({ gainers: [], losers: [] });

  // Presentational states from the spec's Analyze screen.
  const [generating, setGenerating] = useState<string | null>(null);
  const [notFoundSym, setNotFoundSym] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user holdings movers
    fetch('/api/dashboard/brief')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.allHoldings) {
          const sorted = [...data.allHoldings]
            .sort((a: HoldingMover, b: HoldingMover) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact))
            .slice(0, 12);
          setMovers(sorted);
        }
      })
      .catch(() => {});

    // Fetch market movers from ticker tape data (already cached)
    fetch('/api/dashboard/brief')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        // We already have allHoldings with changePct — use those plus market data
      })
      .catch(() => {});

    // Fetch top market movers from market_prices via a lightweight endpoint
    fetch('/api/market/intelligence')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.news) return;
        // Extract unique tickers from recent news as "trending"
      })
      .catch(() => {});
  }, []);

  // Build market movers from holdings data (all we have client-side)
  useEffect(() => {
    if (movers.length === 0) return;
    const gainers = [...movers].filter(m => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 6);
    const losers = [...movers].filter(m => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 6);
    setMarketMovers({
      gainers: gainers.map(m => ({ ticker: m.ticker, name: m.name, price: 0, changePct: m.changePct })),
      losers: losers.map(m => ({ ticker: m.ticker, name: m.name, price: 0, changePct: m.changePct })),
    });
  }, [movers]);

  // Show the "Helm is analyzing…" overlay, then route to the detail view.
  const analyzeTicker = useCallback(
    (raw: string) => {
      const clean = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (!clean || clean.length > 5) {
        setNotFoundSym(raw.trim().toUpperCase() || raw);
        return;
      }
      setGenerating(clean);
      router.push(`/dashboard/analyze/${clean}`);
    },
    [router],
  );

  return (
    <div className="relative px-6 sm:px-8 lg:px-10 py-8 space-y-8">
      {generating && <GeneratingOverlay symbol={generating} />}
      {notFoundSym && <NotFoundPanel symbol={notFoundSym} onReset={() => setNotFoundSym(null)} />}

      {/* Search */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Eyebrow>Analyze</Eyebrow>
          <h1 className="text-[32px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] leading-none">
            Analyze a ticker
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            Real-time AI-powered stock analysis. Every figure sourced and timestamped.
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
      </div>

      {/* Holdings movers + Gainers/Losers */}
      {movers.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8 border-t border-[var(--color-border-subtle)] pt-8">
          {/* Your top movers */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div className="space-y-1.5">
                <Eyebrow>By impact</Eyebrow>
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] leading-none">
                  Your holdings · today
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {movers.slice(0, 8).map((m) => {
                const up = m.changePct >= 0;
                return (
                  <button
                    key={m.ticker}
                    type="button"
                    onClick={() => analyzeTicker(m.ticker)}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-gold-border)] group"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold uppercase tracking-[0.02em] text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                        {up ? <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" /> : <TrendingDown className="w-3.5 h-3.5 text-[var(--color-negative-text)]" />}
                      </div>
                      <div className="mt-0.5 truncate text-[14px] text-[var(--color-text-muted)]">{m.name}</div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <div className={`text-[15px] font-bold tabular-nums ${up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`} style={MONO}>
                        {up ? '+' : ''}{m.changePct.toFixed(2)}%
                      </div>
                      <div className={`text-[14px] tabular-nums ${up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`} style={MONO}>
                        {m.dollarImpact >= 0 ? '+' : '-'}${Math.abs(m.dollarImpact) >= 1000 ? `${(Math.abs(m.dollarImpact) / 1000).toFixed(1)}K` : Math.abs(m.dollarImpact).toFixed(0)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gainers / Losers */}
          <div className="space-y-6">
            {marketMovers.gainers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--color-positive)]" />
                  <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] leading-none">Top gainers</h2>
                </div>
                <div className="space-y-1">
                  {marketMovers.gainers.map((m) => (
                    <button
                      key={m.ticker}
                      type="button"
                      onClick={() => analyzeTicker(m.ticker)}
                      className="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-surface)] group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-14 text-[15px] font-bold uppercase text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                        <span className="truncate text-[15px] text-[var(--color-text-muted)]">{m.name}</span>
                      </div>
                      <span className="text-[15px] font-bold tabular-nums text-[var(--color-positive)]" style={MONO}>+{m.changePct.toFixed(2)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {marketMovers.losers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[var(--color-negative-text)]" />
                  <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] leading-none">Top losers</h2>
                </div>
                <div className="space-y-1">
                  {marketMovers.losers.map((m) => (
                    <button
                      key={m.ticker}
                      type="button"
                      onClick={() => analyzeTicker(m.ticker)}
                      className="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-surface)] group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-14 text-[15px] font-bold uppercase text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                        <span className="truncate text-[15px] text-[var(--color-text-muted)]">{m.name}</span>
                      </div>
                      <span className="text-[15px] font-bold tabular-nums text-[var(--color-negative-text)]" style={MONO}>{m.changePct.toFixed(2)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
