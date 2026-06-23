'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useLivePrices } from '@/hooks/use-live-prices';
import { PriceFlash } from '@/components/price-flash';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import { useThesisEnabled } from '@/lib/use-thesis-access';
import { usePreview } from '@/lib/preview-context';
import { ArrowLeft, ArrowUpRight, Link2, TrendingUp, TrendingDown } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StockQuote } from '@/lib/financial-data';

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

// ── Section eyebrow ──────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
      style={MONO}
    >
      {children}
    </div>
  );
}

// ── Connect-your-brokerage empty state (dataState === 'empty') ────────────
// Read-only Plaid framing + gold Connect CTA, mirroring the portfolio surface.
function ConnectBrokerage({ ticker }: { ticker: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-[470px] text-center">
        <div className="w-[60px] h-[60px] mx-auto mb-[22px] rounded-[14px] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
          <Link2 className="w-[26px] h-[26px] text-[var(--color-gold)]" strokeWidth={1.6} />
        </div>
        <h1 className="text-[26px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] mb-3">
          Connect your brokerage
        </h1>
        <p className="text-[15px] leading-[1.65] text-[var(--color-text-muted)] mb-6">
          Link an account and Helm tracks your {ticker} position, cost basis and unrealized P&amp;L automatically.{' '}
          <span className="text-[var(--color-positive)]">Read-only access</span> &mdash; Helm can never move money or place trades.
        </p>
        <Link
          href="/dashboard/accounts"
          className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-gold)] hover:brightness-[1.06] rounded-[7px] text-[#0A0A0A] font-mono text-[12px] font-bold uppercase tracking-[0.12em] transition-all"
          style={{ boxShadow: '0 8px 24px rgba(230,185,77,0.25)' }}
        >
          Connect account
        </Link>
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-[18px] tracking-[0.04em]">
          12,000+ institutions &middot; 256-bit encryption &middot; via Plaid
        </div>
        <div className="mt-5">
          <Link
            href={`/dashboard/analyze/${ticker}`}
            className="font-mono text-[12px] tracking-[0.04em] text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors"
          >
            Open analysis for {ticker} &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HoldingDetailClient({
  holding: serverHolding, priceHistory, news, transactions, quote,
}: {
  holding: HoldingData;
  priceHistory: { date: string; close: number }[];
  news: NewsItem[];
  transactions: Transaction[];
  quote: StockQuote | null;
}) {
  const thesisEnabled = useThesisEnabled();
  const { dataState } = usePreview();
  // Live price overlay: poll /api/market/quotes every 30s while market open.
  const { quotes: liveQuotes } = useLivePrices(useMemo(() => [serverHolding.ticker], [serverHolding.ticker]));
  const holding = useMemo(() => {
    const q = liveQuotes[serverHolding.ticker?.toUpperCase()];
    if (!q) return serverHolding;
    const totalValue = serverHolding.shares * q.price;
    return {
      ...serverHolding,
      currentPrice: q.price,
      totalValue,
      unrealizedGL: totalValue - serverHolding.costBasis,
      unrealizedPct: serverHolding.costBasis > 0 ? ((totalValue - serverHolding.costBasis) / serverHolding.costBasis) * 100 : serverHolding.unrealizedPct,
      dayChangePct: q.dayChangePct ?? serverHolding.dayChangePct,
    };
  }, [serverHolding, liveQuotes]);

  const up = holding.dayChangePct >= 0;
  const glUp = holding.unrealizedGL >= 0;

  // No linked brokerage (preview dataState === 'empty').
  if (dataState === 'empty') return <ConnectBrokerage ticker={holding.ticker} />;

  // Secondary KPI tiles (price + day change are surfaced large in the header).
  const tiles: { label: string; value: string; flash?: number; color?: string }[] = [
    { label: 'Market value', value: fmt(holding.totalValue), flash: holding.totalValue },
    { label: 'Shares', value: holding.shares.toLocaleString() },
    { label: 'Avg cost', value: fmt(holding.avgCost) },
    { label: 'Cost basis', value: fmt(holding.costBasis) },
    {
      label: 'Unrealized P&L',
      value: `${glUp ? '+' : ''}${fmt(holding.unrealizedGL)}  (${fmtPct(holding.unrealizedPct)})`,
      color: glUp ? 'var(--color-positive)' : 'var(--color-negative-text)',
    },
    {
      label: 'Portfolio weight',
      value: `${holding.allocPct.toFixed(1)}%`,
      color: holding.allocPct > 25 ? 'var(--color-warning-text)' : undefined,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-7 space-y-8 max-w-[1180px]">
      {/* ── Back link ── */}
      <Link
        href="/dashboard/portfolio"
        className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-[0.06em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        style={MONO}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Portfolio
      </Link>

      {/* ── Header: identity + price + day change + CTA ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Eyebrow>
            Position{holding.exchange ? ` · ${holding.exchange}` : ''}
            {holding.sector ? ` · ${holding.sector}` : ''}
          </Eyebrow>
          <div className="flex items-baseline gap-3 flex-wrap mt-2.5">
            <h1 className="text-[40px] sm:text-[48px] leading-none font-bold text-[var(--color-gold)] tracking-[-0.02em]" style={MONO}>
              {holding.ticker}
            </h1>
            <span className="text-[18px] sm:text-[20px] text-[var(--color-text-secondary)] tracking-[-0.01em]">
              {holding.name}
            </span>
          </div>
          {/* Live price + day change, surfaced large. */}
          <div className="flex items-end gap-4 mt-5">
            <PriceFlash value={holding.currentPrice}>
              <span className="text-[34px] sm:text-[40px] leading-none font-bold tabular-nums text-[var(--color-text-primary)]" style={MONO}>
                {fmt(holding.currentPrice)}
              </span>
            </PriceFlash>
            <span
              className="inline-flex items-center gap-1.5 text-[16px] font-bold tabular-nums pb-1"
              style={{ ...MONO, color: up ? 'var(--color-positive)' : 'var(--color-negative-text)' }}
            >
              {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {fmtPct(holding.dayChangePct)}
            </span>
          </div>
        </div>

        <Link
          href={`/dashboard/analyze/${holding.ticker}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-gold)] hover:brightness-[1.06] text-[#0A0A0A] font-mono text-[12px] font-bold uppercase tracking-[0.12em] rounded-[7px] transition-all shrink-0"
          style={{ boxShadow: '0 8px 24px rgba(230,185,77,0.25)' }}
        >
          Open analysis <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-border-base)] border border-[var(--color-border-base)] rounded-lg overflow-hidden">
        {tiles.map((m) => (
          <div key={m.label} className="bg-[var(--color-bg-surface)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--color-text-muted)] uppercase" style={MONO}>
              {m.label}
            </div>
            <div
              className="text-[19px] sm:text-[22px] font-bold tabular-nums mt-2 tracking-[-0.01em]"
              style={{ ...MONO, color: m.color || 'var(--color-text-primary)' }}
            >
              {m.flash !== undefined ? <PriceFlash value={m.flash}>{m.value}</PriceFlash> : m.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + News ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Price chart */}
        <div className="sovereign-card rounded-lg p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <Eyebrow>Price history · 90d</Eyebrow>
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ ...MONO, color: up ? 'var(--color-positive)' : 'var(--color-negative-text)' }}
            >
              {fmtPct(holding.dayChangePct)}
            </span>
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
            <div className="h-64 flex items-center justify-center text-center text-[15px] text-[var(--color-text-muted)] px-6">
              Not enough price data yet. The chart builds as market data syncs.
            </div>
          )}
        </div>

        {/* News */}
        <div className="sovereign-card rounded-lg p-5 sm:p-6">
          <Eyebrow>Recent news</Eyebrow>
          {news.length === 0 ? (
            <p className="text-[15px] text-[var(--color-text-muted)] mt-4">No recent news for {holding.ticker}.</p>
          ) : (
            <div className="space-y-3.5 overflow-y-auto max-h-[300px] custom-scrollbar mt-4 -mr-1 pr-1">
              {news.map(n => (
                <div key={n.id} className="border-b border-[var(--color-border-subtle)] pb-3.5 last:border-0 last:pb-0">
                  <h3 className="text-[15px] font-medium leading-snug tracking-[-0.01em]">
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-primary)] hover:text-[var(--color-gold)] transition-colors">
                        {n.title}
                      </a>
                    ) : n.title}
                  </h3>
                  <div className="font-mono text-[12px] text-[var(--color-text-muted)] mt-1.5 tracking-[0.02em]" style={MONO}>
                    {n.source} · {timeAgo(n.publishedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── The thesis on this holding (links to thesis detail inside) ── */}
      {thesisEnabled && (
        <div className="space-y-4">
          <Eyebrow>The thesis on this holding</Eyebrow>
          <WhyIOwnThis ticker={holding.ticker} />
        </div>
      )}

      {/* ── Live quote ── */}
      {quote && quote.c > 0 && (
        <div className="sovereign-card rounded-lg p-5 sm:p-6">
          <Eyebrow>Live quote</Eyebrow>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-5 gap-y-4 mt-4">
            {[
              { label: 'Last', value: `$${quote.c.toFixed(2)}` },
              { label: 'Open', value: `$${quote.o.toFixed(2)}` },
              { label: 'High', value: `$${quote.h.toFixed(2)}` },
              { label: 'Low', value: `$${quote.l.toFixed(2)}` },
              { label: 'Prev close', value: `$${quote.pc.toFixed(2)}` },
              { label: 'Change', value: quote.d != null ? `${quote.d >= 0 ? '+' : ''}${quote.d.toFixed(2)}` : '—', color: (quote.d ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative-text)' },
              { label: 'Change %', value: quote.dp != null ? fmtPct(quote.dp) : '—', color: (quote.dp ?? 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative-text)' },
            ].map(m => (
              <div key={m.label}>
                <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--color-text-muted)] uppercase" style={MONO}>{m.label}</div>
                <div className="text-[16px] font-bold tabular-nums mt-1" style={{ ...MONO, color: m.color || 'var(--color-text-primary)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-holding transactions ── */}
      {transactions.length > 0 && (
        <div className="sovereign-card rounded-lg p-5 sm:p-6">
          <Eyebrow>Activity in {holding.ticker}</Eyebrow>
          <div className="mt-4">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3 border-b border-[var(--color-border-subtle)] last:border-0">
                <div className="min-w-0 flex-1">
                  <span className="text-[15px] text-[var(--color-text-primary)] truncate block tracking-[-0.01em]">
                    {t.description || t.merchantName || 'Transaction'}
                  </span>
                  <span className="font-mono text-[12px] text-[var(--color-text-muted)] mt-0.5 block tracking-[0.02em]" style={MONO}>{t.date}</span>
                </div>
                <span
                  className="text-[15px] font-bold tabular-nums shrink-0"
                  style={{ ...MONO, color: t.amount >= 0 ? 'var(--color-positive)' : 'var(--color-text-primary)' }}
                >
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
