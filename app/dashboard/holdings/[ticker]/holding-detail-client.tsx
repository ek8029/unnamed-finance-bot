'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, ExternalLink, ArrowLeft } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FinnhubQuote } from '@/lib/financial-data';

interface HoldingData {
  ticker: string; name: string; sector: string; exchange: string;
  shares: number; currentPrice: number; totalValue: number;
  costBasis: number; avgCost: number; unrealizedGL: number;
  unrealizedPct: number; dayChangePct: number; allocPct: number;
}

interface NewsItem {
  id: string; title: string; summary: string | null; source: string | null;
  url: string | null; publishedAt: string; sentiment: number | null;
}

interface Transaction {
  id: string; amount: number; date: string; description: string; merchantName: string | null;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HoldingDetailClient({
  holding, priceHistory, news, transactions, quote,
}: {
  holding: HoldingData;
  priceHistory: { date: string; close: number }[];
  news: NewsItem[];
  transactions: Transaction[];
  quote: FinnhubQuote | null;
}) {
  const up = holding.dayChangePct >= 0;
  const glUp = holding.unrealizedGL >= 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard/portfolio"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Portfolio
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-gold)]" style={MONO}>{holding.ticker}</h1>
              <span className="text-base sm:text-lg text-[var(--color-text-secondary)] truncate max-w-[200px] sm:max-w-none">{holding.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[13px] text-[var(--color-text-muted)]" style={MONO}>
              {holding.exchange && <span>{holding.exchange}</span>}
              {holding.exchange && holding.sector && <span className="opacity-30">|</span>}
              <span>{holding.sector}</span>
            </div>
          </div>
          <Link
            href={`/dashboard/analyze/${holding.ticker}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black text-[13px] font-semibold rounded transition-colors"
          >
            Full AI Analysis <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {[
          { label: 'Price', value: fmt(holding.currentPrice) },
          { label: 'Day Change', value: fmtPct(holding.dayChangePct), color: up ? 'var(--color-positive)' : 'var(--color-negative)' },
          { label: 'Shares', value: holding.shares.toLocaleString() },
          { label: 'Market Value', value: fmt(holding.totalValue) },
          { label: 'Avg Cost', value: fmt(holding.avgCost) },
          { label: 'Unrealized P&L', value: `${glUp ? '+' : ''}${fmt(holding.unrealizedGL)}`, color: glUp ? 'var(--color-positive)' : 'var(--color-negative)' },
          { label: 'Allocation', value: `${holding.allocPct.toFixed(1)}%`, color: holding.allocPct > 25 ? 'var(--color-negative)' : undefined },
        ].map(m => (
          <div key={m.label} className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-3.5">
            <div className="text-[11px] font-mono tracking-wider text-[var(--color-text-muted)] uppercase">{m.label}</div>
            <div className="text-[15px] sm:text-[18px] font-bold tabular-nums mt-1" style={{ ...MONO, color: m.color || 'var(--color-text-primary)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Chart + News side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Price Chart */}
        <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Price History (90d)</h2>
            <div className="flex items-center gap-1.5">
              {up ? <TrendingUp className="w-4 h-4 text-[var(--color-positive)]" /> : <TrendingDown className="w-4 h-4 text-[var(--color-negative)]" />}
              <span className={`text-[14px] font-bold tabular-nums ${up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={MONO}>
                {fmtPct(holding.dayChangePct)}
              </span>
            </div>
          </div>
          {priceHistory.length > 2 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceHistory} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="holdingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} fontFamily="var(--font-mono)" />
                  <YAxis stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} fontFamily="var(--font-mono)" width={50} />
                  <Tooltip
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
                    contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-base)', borderRadius: 4, fontSize: 12 }}
                    labelStyle={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}
                  />
                  <Area type="monotone" dataKey="close" stroke="var(--color-gold)" fill="url(#holdingGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
              Not enough price data yet. Chart builds as market data syncs.
            </div>
          )}
        </div>

        {/* News */}
        <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-4">Recent News</h2>
          {news.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">No recent news for {holding.ticker}.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[280px] custom-scrollbar">
              {news.map(n => (
                <div key={n.id} className="border-b border-[var(--color-border-subtle)] pb-3">
                  <h3 className="text-[14px] font-medium leading-snug">
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-primary)] hover:text-[var(--color-gold)] transition-colors">
                        {n.title}
                      </a>
                    ) : n.title}
                  </h3>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-1" style={MONO}>
                    {n.source} · {timeAgo(n.publishedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Quote (if available) */}
      {quote && quote.c > 0 && (
        <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-3">Live Quote</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {[
              { label: 'Last', value: `$${quote.c.toFixed(2)}` },
              { label: 'Open', value: `$${quote.o.toFixed(2)}` },
              { label: 'High', value: `$${quote.h.toFixed(2)}` },
              { label: 'Low', value: `$${quote.l.toFixed(2)}` },
              { label: 'Prev Close', value: `$${quote.pc.toFixed(2)}` },
              { label: 'Change', value: quote.d != null ? `${quote.d >= 0 ? '+' : ''}${quote.d.toFixed(2)}` : '—', color: (quote.d ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' },
              { label: 'Change %', value: quote.dp != null ? fmtPct(quote.dp) : '—', color: (quote.dp ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' },
            ].map(m => (
              <div key={m.label}>
                <div className="text-[10px] font-mono tracking-wider text-[var(--color-text-muted)] uppercase">{m.label}</div>
                <div className="text-[15px] font-bold tabular-nums mt-0.5" style={{ ...MONO, color: m.color || 'var(--color-text-primary)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions for this ticker */}
      {transactions.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-border-subtle)]">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] sm:text-[14px] text-[var(--color-text-primary)] truncate block">{t.description || t.merchantName || 'Transaction'}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] block sm:inline sm:ml-2" style={MONO}>{t.date}</span>
                </div>
                <span className={`text-[13px] sm:text-[14px] font-bold tabular-nums shrink-0 ${t.amount >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-primary)]'}`} style={MONO}>
                  {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
