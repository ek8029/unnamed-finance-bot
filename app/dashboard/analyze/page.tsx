'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TickerSearch } from '@/app/analyze/ticker-search';
import { TrendingUp, TrendingDown } from 'lucide-react';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

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

export default function DashboardAnalyzePage() {
  const [movers, setMovers] = useState<HoldingMover[]>([]);
  const [marketMovers, setMarketMovers] = useState<{ gainers: MarketMover[]; losers: MarketMover[] }>({ gainers: [], losers: [] });

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

  return (
    <div className="px-6 sm:px-8 lg:px-10 py-8 space-y-8">
      {/* Search */}
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Analyze a ticker</h1>
          <p className="text-[15px] text-[var(--color-text-secondary)] mt-1">Real-time AI-powered stock analysis.</p>
        </div>
        <div className="max-w-2xl">
          <TickerSearch basePath="/dashboard/analyze" />
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TICKERS.map((ticker) => (
            <Link
              key={ticker}
              href={`/dashboard/analyze/${ticker}`}
              className="px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {ticker}
            </Link>
          ))}
        </div>
      </div>

      {/* Holdings movers + Gainers/Losers */}
      {movers.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8 border-t border-[var(--color-border-subtle)] pt-8">
          {/* Your top movers */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Your Holdings — Today</h2>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>By Impact</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {movers.slice(0, 8).map((m) => {
                const up = m.changePct >= 0;
                return (
                  <Link
                    key={m.ticker}
                    href={`/dashboard/analyze/${m.ticker}`}
                    className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:border-[var(--color-border-strong)] transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors" style={{ fontFamily: 'var(--font-mono)' }}>{m.ticker}</span>
                        {up ? <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" /> : <TrendingDown className="w-3.5 h-3.5 text-[var(--color-negative)]" />}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">{m.name}</div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className={`text-sm font-bold tabular-nums ${up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                        {up ? '+' : ''}{m.changePct.toFixed(2)}%
                      </div>
                      <div className={`text-xs tabular-nums ${up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                        {m.dollarImpact >= 0 ? '+' : '-'}${Math.abs(m.dollarImpact) >= 1000 ? `${(Math.abs(m.dollarImpact) / 1000).toFixed(1)}K` : Math.abs(m.dollarImpact).toFixed(0)}
                      </div>
                    </div>
                  </Link>
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
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Top Gainers</h2>
                </div>
                <div className="space-y-1">
                  {marketMovers.gainers.map((m) => (
                    <Link
                      key={m.ticker}
                      href={`/dashboard/analyze/${m.ticker}`}
                      className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-[var(--color-bg-surface)] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors w-14" style={{ fontFamily: 'var(--font-mono)' }}>{m.ticker}</span>
                        <span className="text-sm text-[var(--color-text-muted)] truncate">{m.name}</span>
                      </div>
                      <span className="text-sm font-bold text-[var(--color-positive)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>+{m.changePct.toFixed(2)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {marketMovers.losers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[var(--color-negative)]" />
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Top Losers</h2>
                </div>
                <div className="space-y-1">
                  {marketMovers.losers.map((m) => (
                    <Link
                      key={m.ticker}
                      href={`/dashboard/analyze/${m.ticker}`}
                      className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-[var(--color-bg-surface)] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors w-14" style={{ fontFamily: 'var(--font-mono)' }}>{m.ticker}</span>
                        <span className="text-sm text-[var(--color-text-muted)] truncate">{m.name}</span>
                      </div>
                      <span className="text-sm font-bold text-[var(--color-negative)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{m.changePct.toFixed(2)}%</span>
                    </Link>
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
