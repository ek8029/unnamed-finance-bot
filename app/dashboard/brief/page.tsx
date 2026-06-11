'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLivePrices } from '@/hooks/use-live-prices';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import {
  ChevronDown,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Scissors,
  ArrowUpRight,
} from 'lucide-react';
import { useTier } from '@/hooks/use-tier';
import { ProBlur } from '@/components/pro-blur';

/* ─── Types ─── */

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
  ticker: string | null;
  sentiment: number | null;
  isHolding: boolean;
  sourceTier?: 'tier1' | 'tier2' | 'other';
  positionValue?: number | null;
  portfolioWeight?: number | null;
  impactNote?: string | null;
}

interface BriefData {
  portfolio: { totalValue: number; overnightChange: number; overnightChangePct: number; vsBenchmark: number | null };
  market: {
    spy: { price: number; changePct: number } | null;
    qqq: { price: number; changePct: number } | null;
    vix: { price: number; level: string } | null;
    treasury: { price: number; changePct: number } | null;
  };
  movers: { ticker: string; name: string; sector: string; changePct: number; dollarImpact: number }[];
  allHoldings: { ticker: string; name: string; sector: string; changePct: number; dollarImpact: number }[];
  sectorHeat: { sector: string; weight: number; changePct: number; tickers: string[] }[];
  earningsThisWeek: { ticker: string; reportDate: string; portfolioWeight: number }[];
  dividendsThisWeek: { ticker: string; exDate: string; cashAmount: number | null; payDate: string | null }[];
  positionNews: NewsItem[];
  generalNews: NewsItem[];
  digest: string | null;
  digestGeneratedAt: string | null;
}

/* ─── Formatters ─── */

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}
function getMarketSession(): string {
  // Convert to US Eastern time regardless of browser timezone
  const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const [, timePart] = etStr.split(', ');
  const [hStr, mStr] = timePart.split(':');
  const mins = parseInt(hStr) * 60 + parseInt(mStr);
  if (mins < 570) return 'PRE-MARKET';
  if (mins < 960) return 'MARKET OPEN';
  return 'AFTER-HOURS';
}
function estimateReadTime(data: BriefData): number {
  let sections = 2; // lead + market tape always count
  if (data.positionNews.length > 0) sections += 1;
  if (data.movers.length > 0) sections += 1;
  if (data.generalNews.length > 0) sections += 1;
  if (data.earningsThisWeek.length > 0 || data.dividendsThisWeek.length > 0) sections += 1;
  return Math.max(3, Math.min(7, sections));
}

/* ─── Shared Styles ─── */

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: '"Source Serif Pro", Georgia, "Times New Roman", serif' };

/* ─── Mover Reasoning ─── */

function moverReason(m: { ticker: string; name: string; sector: string; changePct: number }): string {
  const abs = Math.abs(m.changePct);
  if (abs > 5) return m.changePct > 0 ? 'Outsized rally, check for catalyst' : 'Sharp sell-off, monitor position';
  if (abs > 2) return m.changePct > 0 ? 'Strong session, sector momentum' : 'Pullback on elevated volume';
  return m.changePct > 0 ? 'Modest gain, in line with market' : 'Mild weakness, no action needed';
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  BRIEF PAGE                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function BriefPage() {
  const { isPro } = useTier();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<{ ticker: string; price: number; changePct: number; changeAmt: number; isDefault: boolean }[]>([]);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [showWatchlistAdd, setShowWatchlistAdd] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Live price overlay: poll /api/market/quotes every 30s while market open.
  const { quotes: liveQuotes } = useLivePrices(watchlist.map(w => w.ticker));
  const liveWatchlist = useMemo(() => watchlist.map(w => {
    const q = liveQuotes[w.ticker?.toUpperCase()];
    if (!q) return w;
    return {
      ...w,
      price: q.price,
      changePct: q.dayChangePct ?? w.changePct,
      changeAmt: q.prevClose != null ? q.price - q.prevClose : w.changeAmt,
    };
  }), [watchlist, liveQuotes]);

  // Load watchlist (skip in demo mode)
  useEffect(() => {
    const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
    if (isDemo) {
      setWatchlist([
        { ticker: 'SPY', price: 528.40, changePct: 0.35, changeAmt: 1.85, isDefault: true },
        { ticker: 'QQQ', price: 452.15, changePct: 0.52, changeAmt: 2.34, isDefault: true },
        { ticker: 'VIXY', price: 14.20, changePct: -1.8, changeAmt: -0.26, isDefault: true },
        { ticker: 'TLT', price: 92.80, changePct: -0.18, changeAmt: -0.17, isDefault: true },
      ]);
      return;
    }
    fetch('/api/dashboard/watchlist')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tickers) setWatchlist(d.tickers); })
      .catch(() => {});
  }, []);

  const handleAddWatchlistTicker = async () => {
    const ticker = watchlistInput.trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) return;
    setWatchlistLoading(true);
    try {
      const res = await fetch('/api/dashboard/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) {
        setWatchlistInput('');
        setShowWatchlistAdd(false);
        // Refresh watchlist
        const updated = await fetch('/api/dashboard/watchlist').then(r => r.json());
        if (updated?.tickers) setWatchlist(updated.tickers);
      }
    } catch {} finally { setWatchlistLoading(false); }
  };

  const handleRemoveWatchlistTicker = async (ticker: string) => {
    try {
      const res = await fetch('/api/dashboard/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) {
        setWatchlist(prev => prev.filter(w => w.ticker !== ticker));
      }
    } catch {}
  };

  useEffect(() => {
    const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';

    if (isDemo) {
      setData({
        portfolio: { totalValue: 284750, overnightChange: 1820, overnightChangePct: 0.64, vsBenchmark: 0.12 },
        market: {
          spy: { price: 528.40, changePct: 0.35 },
          qqq: { price: 452.15, changePct: 0.52 },
          vix: { price: 14.20, level: 'greed' },
          treasury: { price: 92.80, changePct: -0.18 },
        },
        movers: [
          { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', changePct: 3.2, dollarImpact: 960 },
          { ticker: 'AAPL', name: 'Apple', sector: 'Technology', changePct: -0.8, dollarImpact: -320 },
          { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', changePct: 0.4, dollarImpact: 180 },
        ],
        allHoldings: [
          { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', changePct: 3.2, dollarImpact: 960 },
          { ticker: 'AAPL', name: 'Apple', sector: 'Technology', changePct: -0.8, dollarImpact: -320 },
          { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', changePct: 0.4, dollarImpact: 180 },
          { ticker: 'VOO', name: 'Vanguard S&P 500', sector: 'ETF', changePct: 0.35, dollarImpact: 245 },
          { ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology', changePct: 0.6, dollarImpact: 150 },
        ],
        sectorHeat: [
          { sector: 'Technology', weight: 62, changePct: 1.1, tickers: ['NVDA', 'AAPL', 'MSFT', 'GOOGL'] },
          { sector: 'ETF', weight: 25, changePct: 0.35, tickers: ['VOO'] },
        ],
        earningsThisWeek: [{ ticker: 'NVDA', reportDate: new Date(Date.now() + 86400000 * 3).toISOString(), portfolioWeight: 18.5 }],
        dividendsThisWeek: [{ ticker: 'VOO', exDate: new Date(Date.now() + 86400000 * 2).toISOString(), cashAmount: 1.5975, payDate: new Date(Date.now() + 86400000 * 9).toISOString().split('T')[0] }],
        positionNews: [],
        generalNews: [],
        digest: 'NVIDIA is the story this morning. The stock is up 3.2% pre-market after reporting data center revenue that beat estimates by 12%, pushing your largest holding to a $960 gain overnight. Demand for Blackwell GPUs continues to outstrip supply, and management raised full-year guidance for the third consecutive quarter.\n\nApple slipped 0.8% on reports of slower iPhone 16 sales in China, trimming $320 from your position. The weakness is contained to the China market — North American and European sales remain on track. Microsoft edged up 0.4% on steady Azure growth.\n\nThe broader market is calm. SPY is up 0.35% with the VIX sitting at 14.2, firmly in the greed zone. Treasury yields ticked up slightly, pulling TLT down 0.18%. No major macro catalysts today, but keep an eye on NVDA earnings exposure — your 18.5% portfolio weight means any post-earnings reversal hits hard.',
        digestGeneratedAt: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    fetch('/api/dashboard/brief')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${dayNames[now.getDay()]} · ${monthNames[now.getMonth()]} ${now.getDate()} · ${now.getFullYear()}`;
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const issueNum = dayOfYear();
  const session = getMarketSession();

  /* ─── Derived Data (memoized) — MUST be before early returns to satisfy React hook rules ─── */

  const topGainers = useMemo(() => data ? [...data.movers].filter(m => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5) : [], [data]);
  const topLosers = useMemo(() => data ? [...data.movers].filter(m => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5) : [], [data]);
  const allMovers = useMemo(() => [...topGainers, ...topLosers].sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 8), [topGainers, topLosers]);
  const portfolioUp = data ? data.portfolio.overnightChangePct >= 0 : true;
  const topSector = data && data.sectorHeat.length > 0 ? [...data.sectorHeat].sort((a, b) => b.weight - a.weight)[0] : null;
  const biggestMover = allMovers[0] || null;
  const readTime = data ? estimateReadTime(data) : 3;

  const harvestCandidates = useMemo(() => data ? data.allHoldings.filter(h => h.changePct < -3).sort((a, b) => a.changePct - b.changePct) : [], [data]);
  const showHarvestCTA = harvestCandidates.length > 0;

  const leadHeadline = useMemo(() => {
    if (!data) return '';
    const abs = Math.abs(data.portfolio.overnightChangePct);
    const earningsCount = data.earningsThisWeek.length;

    if (abs > 3) {
      return portfolioUp
        ? `A ${abs.toFixed(1)}% surge reshapes your portfolio. Here's what drove it`
        : `Markets deliver a ${abs.toFixed(1)}% blow. What it means for your positions`;
    }
    if (earningsCount >= 3) {
      return `${earningsCount} of your holdings report this week. Positioning matters`;
    }
    if (biggestMover && Math.abs(biggestMover.changePct) > 4) {
      return biggestMover.changePct > 0
        ? `${biggestMover.ticker} jumps ${biggestMover.changePct.toFixed(1)}%, lifting your portfolio ${fmt(Math.abs(data.portfolio.overnightChange))}`
        : `${biggestMover.ticker} drops ${Math.abs(biggestMover.changePct).toFixed(1)}%. Your exposure and what to watch`;
    }
    if (data.portfolio.vsBenchmark !== null && Math.abs(data.portfolio.vsBenchmark) > 1.5) {
      return data.portfolio.vsBenchmark > 0
        ? `You're outpacing the S&P by ${data.portfolio.vsBenchmark.toFixed(1)}%. What's working`
        : `Trailing the S&P by ${Math.abs(data.portfolio.vsBenchmark).toFixed(1)}%. Where the drag is`;
    }
    if (data.market.vix && data.market.vix.price > 25) {
      return `Volatility elevated at ${data.market.vix.price.toFixed(0)}. What it signals for your ${data.allHoldings.length} positions`;
    }
    if (showHarvestCTA) {
      return `Tax-loss harvest window: ${harvestCandidates.length} position${harvestCandidates.length > 1 ? 's' : ''} down more than 3%`;
    }
    return portfolioUp
      ? `Your portfolio gained ${fmt(Math.abs(data.portfolio.overnightChange))}. Steady course across ${data.allHoldings.length} positions`
      : `A ${fmt(Math.abs(data.portfolio.overnightChange))} drawdown across ${data.allHoldings.length} positions. The full picture`;
  }, [data, portfolioUp, biggestMover, showHarvestCTA, harvestCandidates]);

  const spyDir = data?.market.spy ? (data.market.spy.changePct >= 0 ? 'up' : 'down') : null;
  const qqqDir = data?.market.qqq ? (data.market.qqq.changePct >= 0 ? 'up' : 'down') : null;

  const marketTapeItems = useMemo(() => {
    if (!data) return [];
    const items: [string, string, string, boolean][] = [];
    if (data.market.spy) items.push(['SPY', `$${data.market.spy.price.toFixed(2)}`, fmtPct(data.market.spy.changePct), data.market.spy.changePct >= 0]);
    if (data.market.qqq) items.push(['QQQ', `$${data.market.qqq.price.toFixed(2)}`, fmtPct(data.market.qqq.changePct), data.market.qqq.changePct >= 0]);
    if (data.market.vix) items.push(['VIXY', data.market.vix.price.toFixed(2), data.market.vix.level.replace(/_/g, ' '), data.market.vix.price < 20]);
    if (data.market.treasury) items.push(['BONDS (TLT)', `$${data.market.treasury.price.toFixed(2)}`, fmtPct(data.market.treasury.changePct), data.market.treasury.changePct >= 0]);
    return items;
  }, [data]);

  /* ─── No data guard ─── */

  if (!loading && data && data.allHoldings.length === 0 && data.portfolio.totalValue === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center px-4 sm:px-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">No portfolio data yet</h1>
          <p className="text-[var(--color-text-secondary)] mb-4">Add your holdings to see a personalized daily brief with portfolio performance, sector analysis, and market intelligence.</p>
          <a href="/dashboard/accounts" className="px-5 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[14px] rounded transition-colors inline-block">Connect brokerage</a>
          <a href="/dashboard/portfolio/add" className="mt-3 block text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors" style={{ fontFamily: 'var(--font-mono)' }}>Or add holdings manually</a>
          <a href="/dashboard/accounts" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-bold rounded-lg transition-colors">
            Connect Account
          </a>
        </div>
      </div>
    );
  }

  /* ─── Skeleton Loader ─── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)]">
        <div className="border-b-2 border-[var(--color-gold)]/30 animate-pulse">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="h-3 w-48 bg-white/[0.06] rounded mb-3" />
            <div className="h-10 w-full max-w-96 bg-white/[0.06] rounded" />
          </div>
        </div>
        <div className="bg-[#080808] border-b border-white/[0.06] animate-pulse">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i}>
                <div className="h-2 w-16 bg-white/[0.04] rounded mb-2" />
                <div className="h-5 w-20 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 animate-pulse space-y-6">
          <div className="h-3 w-32 bg-[var(--color-gold)]/10 rounded" />
          <div className="h-8 w-3/4 bg-white/[0.06] rounded" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-white/[0.04] rounded" />
            <div className="h-4 w-5/6 bg-white/[0.04] rounded" />
            <div className="h-4 w-4/6 bg-white/[0.04] rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/[0.04] rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Error State ─── */

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="text-sm text-[var(--color-negative)]">
          Failed to load brief.{' '}
          <Link href="/dashboard" className="text-[var(--color-gold)]">Back to dashboard</Link>
        </div>
      </div>
    );
  }

    /* ═══════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">

      {/* ═══ Masthead ═══ */}
      <header className="border-b-2 border-[var(--color-gold)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">

          {/* Top line: issue info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]" style={MONO}>
              <span>ISSUE No. {issueNum}</span>
              <span className="text-[var(--color-border-subtle)]">|</span>
              <span>{session}</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>
              {readTime} min read
            </div>
          </div>

          {/* Masthead title + meta */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-[var(--color-gold)] mb-2" style={MONO}>{dateStr}</div>
              <div className="flex items-center gap-3">
                <HelmMark size={28} />
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight">The Current</h1>
              </div>
            </div>
            <div className="text-left md:text-right" style={MONO}>
              <div className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)]">PRICES AS OF {timeStr}</div>
              <div className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] mt-1">{data.allHoldings.length} POSITIONS · {fmt(data.portfolio.totalValue)}</div>
              <div className="mt-2 text-[11px] tracking-[0.1em] text-[var(--color-gold)]">
                GENERATED DAILY AT 9:15 AM ET
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Market Tape (watchlist-driven) ═══ */}
      <div className="bg-[#080808] border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]" style={MONO}>WATCHLIST</span>
            <button
              onClick={() => setShowWatchlistAdd(!showWatchlistAdd)}
              className="text-[10px] text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
              aria-label="Add ticker to watchlist"
            >
              + ADD
            </button>
            {showWatchlistAdd && (
              <form onSubmit={(e) => { e.preventDefault(); handleAddWatchlistTicker(); }} className="flex items-center gap-1 ml-2">
                <input
                  type="text"
                  value={watchlistInput}
                  onChange={(e) => setWatchlistInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
                  placeholder="AAPL"
                  className="w-16 px-2 py-0.5 text-xs bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                  autoFocus
                  maxLength={5}
                />
                <button type="submit" disabled={watchlistLoading} className="text-[10px] px-2 py-0.5 bg-[var(--color-gold)] text-black rounded font-semibold disabled:opacity-50">
                  {watchlistLoading ? '...' : 'ADD'}
                </button>
              </form>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
          {(liveWatchlist.length > 0 ? liveWatchlist.filter(w => w.price != null && w.changePct != null).map(w => [w.ticker, `$${w.price.toFixed(2)}`, fmtPct(w.changePct), w.changePct >= 0] as [string, string, string, boolean]) : marketTapeItems).map(([label, value, delta, pos]) => (
            <div key={label} className="group relative">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>{label}</div>
              <div className="text-sm sm:text-lg font-bold mt-1 tabular-nums">{value}</div>
              <div
                className={`text-[13px] font-semibold mt-0.5 ${pos ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}
                style={MONO}
              >
                {delta}
              </div>
              {watchlist.length > 0 && (
                <button
                  onClick={() => handleRemoveWatchlistTicker(label)}
                  className="absolute top-0 right-0 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs p-1"
                  aria-label={`Remove ${label} from watchlist`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* ═══ Two-column editorial layout ═══ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-4 md:gap-8 lg:gap-12">

          {/* ══ MAIN COLUMN ══ */}
          <main className="space-y-6 sm:space-y-10">

            {/* ── Lead Story: Editorial headline ── */}
            <article>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                YOUR PORTFOLIO
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-[2.75rem] font-bold tracking-tight leading-[1.08] mb-2" aria-live="polite">
                {leadHeadline}
              </h2>
              {data.portfolio.vsBenchmark !== null && (
                <div className={`text-base md:text-lg font-medium mb-4 ${
                  data.portfolio.vsBenchmark >= 2 ? 'text-[var(--color-positive)]'
                  : data.portfolio.vsBenchmark >= 0.5 ? 'text-[var(--color-positive)]/70'
                  : data.portfolio.vsBenchmark >= -0.5 ? 'text-[var(--color-text-muted)]'
                  : data.portfolio.vsBenchmark >= -2 ? 'text-[var(--color-negative)]/70'
                  : 'text-[var(--color-negative)]'
                }`}>
                  {data.portfolio.vsBenchmark >= 2
                    ? `Crushing the S&P by ${Math.abs(data.portfolio.vsBenchmark).toFixed(2)}%.`
                    : data.portfolio.vsBenchmark >= 0.5
                    ? `Beating the S&P by ${Math.abs(data.portfolio.vsBenchmark).toFixed(2)}%.`
                    : data.portfolio.vsBenchmark >= -0.5
                    ? `In line with the S&P (${data.portfolio.vsBenchmark >= 0 ? '+' : ''}${data.portfolio.vsBenchmark.toFixed(2)}%).`
                    : data.portfolio.vsBenchmark >= -2
                    ? `Trailing the S&P by ${Math.abs(data.portfolio.vsBenchmark).toFixed(2)}%.`
                    : `Lagging the S&P by ${Math.abs(data.portfolio.vsBenchmark).toFixed(2)}%.`}
                </div>
              )}

              <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-[var(--color-text-muted)] mb-6 flex-wrap" style={MONO}>
                <span>HELM ANALYST</span>
                <span>·</span>
                <span>{data.allHoldings.length} POSITIONS</span>
                <span>·</span>
                <span>{fmt(data.portfolio.totalValue)} TOTAL</span>
              </div>

              {/* Lead body text — larger serif with drop cap */}
              <p className="text-[16px] sm:text-[18px] leading-[1.7] text-[var(--color-text-secondary)]" style={SERIF}>
                <span
                  className="float-left text-[3rem] sm:text-[4rem] font-bold leading-[0.8] mr-2 sm:mr-3 mt-[0.1em] text-[var(--color-gold)]"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {portfolioUp ? 'Y' : 'A'}
                </span>
                {portfolioUp
                  ? `our portfolio gained ${fmt(Math.abs(data.portfolio.overnightChange))} since yesterday's close, a ${fmtPct(data.portfolio.overnightChangePct)} move that puts your total at ${fmt(data.portfolio.totalValue)}.`
                  : ` ${Math.abs(data.portfolio.overnightChangePct).toFixed(2)}% drawdown took ${fmt(Math.abs(data.portfolio.overnightChange))} off your portfolio since yesterday's close.`}
                {' '}
                {data.market.spy && `The broader market (SPY) was ${spyDir} ${fmtPct(data.market.spy.changePct)}`}
                {data.market.qqq && ` while the Nasdaq moved ${qqqDir} ${fmtPct(data.market.qqq.changePct)}.`}
                {biggestMover && ` ${biggestMover.name} (${biggestMover.ticker}) was your biggest mover at ${fmtPct(biggestMover.changePct)}, ${biggestMover.changePct >= 0 ? 'adding' : 'costing'} ${fmt(Math.abs(biggestMover.dollarImpact))} to your portfolio.`}
                {topSector && ` ${topSector.sector} remains your largest sector exposure at ${topSector.weight.toFixed(1)}%.`}
              </p>
            </article>

            {/* ── AI Digest + Portfolio Intelligence (Pro) ── */}
            {!isPro && (
              <ProBlur
                label="Unlock your daily intelligence brief"
                description="AI-generated portfolio digest, news affecting your positions, and your top movers. Personalized to your holdings."
                minHeight="200px"
              >
                <article className="border border-[var(--color-border-base)] rounded-md bg-[var(--color-bg-surface)] overflow-hidden">
                  <div className="px-5 py-2.5 border-b border-[var(--color-border-subtle)] flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>AI Digest</span>
                  </div>
                  <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-3">
                    <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-full" />
                    <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-5/6" />
                    <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-4/6" />
                    <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-full" />
                    <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-3/4" />
                  </div>
                </article>
              </ProBlur>
            )}

            {isPro && data.digest && (
              <article className="border border-[var(--color-border-base)] rounded-md bg-[var(--color-bg-surface)] overflow-hidden">
                <div className="px-5 py-2.5 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>
                      AI Digest
                    </span>
                  </div>
                  {data.digestGeneratedAt && (
                    <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                      GENERATED {new Date(data.digestGeneratedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                    </span>
                  )}
                </div>
                <div className="px-3 sm:px-5 py-3 sm:py-4">
                  {data.digest.split('\n\n').map((para, i) => (
                    <p
                      key={i}
                      className="text-[15px] leading-[1.75] text-[var(--color-text-secondary)] mb-3 last:mb-0"
                      style={SERIF}
                    >
                      {para}
                    </p>
                  ))}
                </div>
                <div className="px-5 py-2 border-t border-[var(--color-border-subtle)]">
                  <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
                    AI-generated summary · Not financial advice
                  </span>
                </div>
              </article>
            )}

            {/* ── Position News ── */}
            {isPro && data.positionNews.length > 0 && (
              <article>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  NEWS AFFECTING YOUR POSITIONS
                </h2>
                <div className="space-y-5">
                  {data.positionNews.slice(0, 5).map((news, i) => (
                    <div key={news.id} className={i > 0 ? 'pt-5 border-t border-white/[0.06]' : ''}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {news.ticker && (
                          <Link
                            href={`/dashboard/analyze/${news.ticker}`}
                            className="font-mono text-xs font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] motion-safe:transition-colors px-1.5 py-0.5 bg-[var(--color-gold)]/10 rounded"
                          >
                            {news.ticker}
                          </Link>
                        )}
                        <SentimentBadge value={news.sentiment} />
                        <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1" style={MONO}>
                          {news.sourceTier === 'tier1' && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" title="Tier 1 Source" />
                          )}
                          {news.sourceTier === 'tier2' && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" title="Tier 2 Source" />
                          )}
                          {news.source} · {timeAgo(news.publishedAt)}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold leading-snug mb-1">
                        {news.url ? (
                          <a href={news.url} target="_blank" rel="noopener noreferrer" aria-label={`Read: ${news.title} (opens in new tab)`} className="hover:text-[var(--color-gold)] motion-safe:transition-colors">
                            {news.title}
                          </a>
                        ) : news.title}
                      </h3>
                      {news.summary && (
                        <p className="text-[14px] sm:text-[16px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2" style={SERIF}>
                          {news.summary}
                        </p>
                      )}
                      {news.impactNote && (
                        <p className="text-[12px] text-[var(--color-gold)] mt-1.5" style={MONO}>
                          {news.impactNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            )}

            {/* ── Movers Table ── */}
            {allMovers.length > 0 && (
              <article>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  YOUR TOP MOVERS
                </h2>
                <div className="border border-white/[0.06] rounded overflow-hidden">
                  <div className="grid grid-cols-[50px_1fr_70px_80px] sm:grid-cols-[70px_1fr_90px_110px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Ticker</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Name</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] text-right" style={MONO}>Change</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] text-right" style={MONO}>Impact</span>
                  </div>
                  {allMovers.map((m) => (
                    <div key={m.ticker} className="grid grid-cols-[50px_1fr_70px_80px] sm:grid-cols-[70px_1fr_90px_110px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-3.5 border-t border-white/[0.04] hover:bg-white/[0.02] motion-safe:transition-colors">
                      <Link href={`/dashboard/analyze/${m.ticker}`} className="font-mono text-[13px] sm:text-[15px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] motion-safe:transition-colors">
                        {m.ticker}
                      </Link>
                      <span className="text-[13px] sm:text-[15px] text-[var(--color-text-muted)] truncate">{m.name}</span>
                      <span className={`text-[13px] sm:text-[15px] font-mono font-semibold text-right tabular-nums ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                        {fmtPct(m.changePct)}
                      </span>
                      <span className={`text-[13px] sm:text-[15px] font-mono text-right tabular-nums ${m.dollarImpact >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                        {m.dollarImpact >= 0 ? '+' : ''}{fmt(m.dollarImpact)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {/* ── General Market Headlines ── */}
            {data.generalNews.length > 0 && (
              <article>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  MARKET HEADLINES
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                  {data.generalNews.slice(0, 6).map((news) => (
                    <div key={news.id} className="group">
                      <div className="flex items-center gap-2 mb-1">
                        {news.ticker && (
                          <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)]">{news.ticker}</span>
                        )}
                        <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1" style={MONO}>
                          {news.sourceTier === 'tier1' && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" title="Tier 1 Source" />
                          )}
                          {news.sourceTier === 'tier2' && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" title="Tier 2 Source" />
                          )}
                          {news.source} · {timeAgo(news.publishedAt)}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-semibold leading-snug">
                        {news.url ? (
                          <a href={news.url} target="_blank" rel="noopener noreferrer" aria-label={`Read: ${news.title} (opens in new tab)`} className="group-hover:text-[var(--color-gold)] motion-safe:transition-colors">
                            {news.title}
                            <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-50 motion-safe:transition-opacity" />
                          </a>
                        ) : news.title}
                      </h3>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />

            {/* ── Earnings Schedule (inline table) ── */}
            {data.earningsThisWeek.length > 0 && (
              <article>
                <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  <Calendar className="w-3.5 h-3.5" />
                  EARNINGS THIS WEEK
                </h2>
                <div className="border border-white/[0.06] rounded overflow-hidden">
                  <div className="grid grid-cols-[60px_1fr_80px] sm:grid-cols-[80px_1fr_100px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Date</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]" style={MONO}>Ticker</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] text-right" style={MONO}>Exposure</span>
                  </div>
                  {data.earningsThisWeek.map(e => {
                    const dateObj = new Date(e.reportDate + 'T00:00:00');
                    const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
                    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateObj.getMonth()];
                    return (
                      <div key={e.ticker} className="grid grid-cols-[60px_1fr_80px] sm:grid-cols-[80px_1fr_100px] gap-2 sm:gap-3 items-center px-3 sm:px-4 py-3 border-t border-white/[0.04] hover:bg-white/[0.02] motion-safe:transition-colors">
                        <span className="text-[13px] text-[var(--color-text-muted)]" style={MONO}>
                          {dayAbbr} {monthAbbr} {dateObj.getDate()}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/analyze/${e.ticker}`} className="font-mono text-[15px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] motion-safe:transition-colors">
                            {e.ticker}
                          </Link>
                        </div>
                        <span className={`text-[13px] font-mono text-right tabular-nums ${e.portfolioWeight >= 5 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-muted)]'}`}>
                          {e.portfolioWeight.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-2 italic" style={SERIF}>
                  Earnings can move stocks 3-10%. Consider position sizing for high-exposure names.
                </p>
              </article>
            )}

            {/* ── Dividends This Week ── */}
            {data.dividendsThisWeek.length > 0 && (
              <article>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4" style={MONO}>
                  UPCOMING DIVIDENDS
                </h2>
                <div className="space-y-2">
                  {data.dividendsThisWeek.map(d => (
                    <div key={d.ticker} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] flex-wrap gap-2">
                      <Link href={`/dashboard/analyze/${d.ticker}`} className="font-mono text-[15px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)]">
                        {d.ticker}
                      </Link>
                      <div className="flex items-center gap-3 text-[13px] text-[var(--color-text-muted)]" style={MONO}>
                        {d.cashAmount && <span>${d.cashAmount.toFixed(2)}/share</span>}
                        <span>Ex-dividend: {d.exDate}</span>
                        {d.payDate && <span>Pays: {d.payDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {/* ── Tax-Loss Harvest CTA ── */}
            {showHarvestCTA && (
              <article className="border border-[var(--color-border-base)] rounded-lg p-6 bg-[var(--color-bg-surface)]">
                <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-gold)] mb-3" style={MONO}>
                  <Scissors className="w-3.5 h-3.5" />
                  TAX-LOSS HARVEST OPPORTUNITY
                </h2>
                <h3 className="text-xl font-bold mb-2">
                  {harvestCandidates.length} position{harvestCandidates.length > 1 ? 's' : ''} dropped more than 3% today
                </h3>
                <p className="text-[14px] sm:text-[16px] text-[var(--color-text-secondary)] leading-relaxed mb-4" style={SERIF}>
                  {harvestCandidates.slice(0, 3).map(h => h.ticker).join(', ')}
                  {harvestCandidates.length > 3 ? ` and ${harvestCandidates.length - 3} more` : ''}
                  {' '}had significant moves today. Check the Tax Center for a full harvest analysis with cost-basis and wash-sale data.
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  {harvestCandidates.slice(0, 4).map(h => (
                    <div key={h.ticker} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded border border-white/[0.06]">
                      <Link href={`/dashboard/analyze/${h.ticker}`} className="font-mono text-[13px] font-bold text-[var(--color-gold)]">
                        {h.ticker}
                      </Link>
                      <span className="text-[13px] font-mono text-[var(--color-negative)]">{fmtPct(h.changePct)}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/analyze"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-gold)]/10 text-[var(--color-gold)] text-[13px] font-semibold tracking-wider uppercase rounded hover:bg-[var(--color-gold)]/20 motion-safe:transition-colors"
                  style={MONO}
                >
                  Review positions
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </article>
            )}

          </main>

          {/* ══ SIDEBAR ══ */}
          <aside>
            <button
              className="lg:hidden w-full flex items-center justify-between py-3 text-sm text-[var(--color-text-muted)] border-b border-white/[0.06] mb-4"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Collapse sectors and holdings sidebar' : 'Expand sectors and holdings sidebar'}
              aria-expanded={sidebarOpen}
            >
              Sectors & Holdings
              <ChevronDown className={`w-4 h-4 motion-safe:transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block space-y-8`}>

              {/* ── Market Movers with reasoning ── */}
              {allMovers.length > 0 && (
                <div>
                  <h2 className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>
                    Market Movers
                  </h2>
                  {allMovers.slice(0, 5).map(m => (
                    <div key={m.ticker} className="py-3 border-b border-white/[0.04]">
                      <div className="flex justify-between items-baseline">
                        <Link href={`/dashboard/analyze/${m.ticker}`} className="font-mono text-[15px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] motion-safe:transition-colors">
                          {m.ticker}
                        </Link>
                        <span className={`text-[15px] font-mono font-bold tabular-nums ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                          {fmtPct(m.changePct)}
                        </span>
                      </div>
                      <div className="text-[13px] text-[var(--color-text-muted)] mt-0.5 leading-snug" style={SERIF}>
                        {moverReason(m)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Sector Heat ── */}
              {data.sectorHeat.length > 0 && (
                <div>
                  <h2 className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>
                    Sector Heat
                  </h2>
                  {[...data.sectorHeat].sort((a, b) => b.weight - a.weight).map(s => (
                    <div key={s.sector} className="py-3 border-b border-white/[0.06]">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[15px] font-medium">{s.sector}</span>
                        <span className={`text-[15px] font-mono font-bold ${s.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                          {fmtPct(s.changePct)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-gold)] rounded-full" style={{ width: `${s.weight}%` }} />
                        </div>
                        <span className="text-[13px] text-[var(--color-text-muted)] font-mono tabular-nums">{s.weight.toFixed(1)}%</span>
                      </div>
                      <div className="text-[12px] text-[var(--color-text-muted)] mt-1 font-mono">{s.tickers.join(', ')}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── All Holdings by impact ── */}
              {isPro && data.allHoldings.length > 0 && (
                <div>
                  <h2 className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4 pb-3 border-b border-[var(--color-gold)]/20" style={MONO}>
                    All Holdings
                  </h2>
                  {[...data.allHoldings].sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 15).map(h => (
                    <div key={h.ticker} className="py-3 border-b border-white/[0.04] flex justify-between items-baseline">
                      <div>
                        <Link href={`/dashboard/analyze/${h.ticker}`} className="font-mono text-[15px] font-bold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)]">
                          {h.ticker}
                        </Link>
                        <span className="text-[13px] text-[var(--color-text-muted)] ml-2">{h.name}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[15px] font-mono font-semibold ${h.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                          {fmtPct(h.changePct)}
                        </span>
                        <span className={`text-[13px] font-mono ${h.dollarImpact >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                          {h.dollarImpact >= 0 ? '+' : ''}{fmt(h.dollarImpact)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Day at a Glance ── */}
              {isPro && topGainers.length > 0 && topLosers.length > 0 && (
                <div className="bg-white/[0.02] rounded p-4 border border-white/[0.06]">
                  <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-muted)] mb-3" style={MONO}>
                    Day at a Glance
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[12px] text-[var(--color-positive)] uppercase tracking-wider" style={MONO}>Best Performer</div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-mono text-[15px] font-bold">{topGainers[0].ticker}</span>
                        <span className="font-mono text-[15px] font-bold text-[var(--color-positive)]">{fmtPct(topGainers[0].changePct)}</span>
                      </div>
                      <div className="text-[13px] text-[var(--color-text-muted)]">{topGainers[0].name}</div>
                    </div>
                    <div className="h-px bg-white/[0.06]" />
                    <div>
                      <div className="text-[12px] text-[var(--color-negative)] uppercase tracking-wider" style={MONO}>Worst Performer</div>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="font-mono text-[15px] font-bold">{topLosers[0].ticker}</span>
                        <span className="font-mono text-[15px] font-bold text-[var(--color-negative)]">{fmtPct(topLosers[0].changePct)}</span>
                      </div>
                      <div className="text-[13px] text-[var(--color-text-muted)]">{topLosers[0].name}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-white/[0.06] py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between text-[11px] text-[var(--color-text-muted)] uppercase tracking-[0.12em]" style={MONO}>
          <span>Sources: Finazon · SEC EDGAR · Market News</span>
          <span>helmterminal.dev</span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function SentimentBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  if (value > 0.2) return <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-positive)]" style={{ fontFamily: 'var(--font-mono)' }}><TrendingUp className="w-3 h-3" />Bullish</span>;
  if (value < -0.2) return <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-negative)]" style={{ fontFamily: 'var(--font-mono)' }}><TrendingDown className="w-3 h-3" />Bearish</span>;
  return <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}><Minus className="w-3 h-3" />Neutral</span>;
}
