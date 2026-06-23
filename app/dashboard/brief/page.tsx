'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLivePrices } from '@/hooks/use-live-prices';
import { PriceFlash } from '@/components/price-flash';
import Link from 'next/link';
import {
  Loader2,
  Link2,
  Sparkles,
  Plus,
  X,
} from 'lucide-react';
import { usePreview } from '@/lib/preview-context';
import { VerdictCard, type ThesisIntelligenceItem } from '@/components/thesis/verdict-card';
import type { ThesisBriefData } from '@/lib/thesis-brief';
import { STATUS_META } from '@/lib/thesis-palette';
import { MacroStrip, type MacroItem } from '@/components/thesis/macro-strip';
import { QuietState, type PillarSummary } from '@/components/thesis/quiet-state';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Types                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

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
  pillarSummary: PillarSummary;
  thesisIntelligence: ThesisIntelligenceItem[];
  thesisBrief?: ThesisBriefData;
  thesisEnabled?: boolean;
  macroStrip: MacroItem[];
  digest: string | null;
  digestGeneratedAt: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Formatters                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SCREEN: React.CSSProperties = { padding: '26px 28px 60px', maxWidth: 1240 };
const CARD =
  'rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] shadow-[0_2px_12px_rgba(0,0,0,0.5)]';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Signal feed mapping                                                        */
/*  Reuses existing derived data (concentration, earnings, harvest, news) and  */
/*  renders each as a category-coded signal card matching the mockup.          */
/* ═══════════════════════════════════════════════════════════════════════════ */

type SignalCategory = 'Concentration' | 'Earnings' | 'Tax' | 'Holding news' | 'Conviction';

const CATEGORY_COLOR: Record<SignalCategory, string> = {
  Concentration: 'var(--color-negative-text)',
  Earnings: 'var(--color-warning-text)',
  Tax: 'var(--color-positive)',
  'Holding news': 'var(--color-info-text)',
  Conviction: 'var(--color-gold)',
};
const CATEGORY_PILL_BG: Record<SignalCategory, string> = {
  Concentration: 'rgba(248,113,113,0.1)',
  Earnings: 'rgba(251,191,36,0.1)',
  Tax: 'rgba(74,222,128,0.1)',
  'Holding news': 'rgba(96,165,250,0.1)',
  Conviction: 'rgba(230,185,77,0.1)',
};
const CATEGORY_PILL_BORDER: Record<SignalCategory, string> = {
  Concentration: 'rgba(248,113,113,0.2)',
  Earnings: 'rgba(251,191,36,0.2)',
  Tax: 'rgba(74,222,128,0.2)',
  'Holding news': 'rgba(96,165,250,0.2)',
  Conviction: 'rgba(230,185,77,0.2)',
};

interface Signal {
  category: SignalCategory;
  meta: string;
  metaColor?: string;
  headline: string;
  body: string;
  action?: { label: string; href: string };
  source?: string;
}

function SignalCard({ signal }: { signal: Signal }) {
  const color = CATEGORY_COLOR[signal.category];
  return (
    <div
      className={`${CARD} px-5 py-[18px]`}
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className="rounded-[3px] px-[7px] py-[3px] text-[9px] font-bold uppercase tracking-[0.12em]"
          style={{
            ...MONO,
            color,
            background: CATEGORY_PILL_BG[signal.category],
            border: `1px solid ${CATEGORY_PILL_BORDER[signal.category]}`,
          }}
        >
          {signal.category}
        </span>
        <span className="flex-1" />
        <span
          className="text-[9px] uppercase tracking-[0.1em]"
          style={{ ...MONO, color: signal.metaColor ?? 'var(--color-text-muted)' }}
        >
          {signal.meta}
        </span>
      </div>
      <div className="mb-[7px] text-[16px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--color-text-primary)]">
        {signal.headline}
      </div>
      <p className="m-0 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
        {signal.body}
      </p>
      {(signal.action || signal.source) && (
        <div className="mt-3 flex items-center gap-3.5">
          {signal.action && (
            <Link
              href={signal.action.href}
              className="rounded-[4px] px-3 py-[7px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-gold)] transition-colors hover:bg-[rgba(230,185,77,0.14)]"
              style={{ ...MONO, background: 'rgba(230,185,77,0.08)', border: '1px solid rgba(230,185,77,0.18)' }}
            >
              {signal.action.label} →
            </Link>
          )}
          {signal.source && (
            <span className="text-[10px] text-[var(--color-text-muted)]" style={MONO}>
              {signal.source}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Section card shell for the right rail ─── */
function RailCard({ label, labelColor, children }: { label: string; labelColor?: string; children: React.ReactNode }) {
  return (
    <div className={`${CARD} px-5 py-[18px]`}>
      <div
        className="mb-3.5 text-[10px] uppercase tracking-[0.14em]"
        style={{ ...MONO, color: labelColor ?? 'var(--color-text-muted)' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/* ─── Generating overlay (mirrors the Analyze treatment per README_round2 §4) ─── */
function GeneratingOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-10 text-center"
      style={{ background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(3px)' }}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-[30px] w-[30px] animate-spin text-[var(--color-gold)]" strokeWidth={1.8} />
      <div className="text-[16px] font-semibold text-[var(--color-text-primary)]">
        Helm is writing your brief…
      </div>
      <div className="text-[11px] tracking-[0.04em] text-[var(--color-text-muted)]" style={MONO}>
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  BRIEF PAGE                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function BriefPage() {
  const { tier, dataState } = usePreview();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
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

  // Greeting name (mirrors the layout's profile fetch).
  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const full = d?.profile?.full_name || d?.profile?.email?.split('@')[0] || '';
        const first = String(full).trim().split(' ')[0];
        if (first) setFirstName(first);
      })
      .catch(() => {});
  }, []);

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
        pillarSummary: { intact: 0, weakening: 0, broken: 0, unverified: 0, positions: 0, lastScannedAt: null },
        thesisIntelligence: [],
        macroStrip: [],
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
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const briefDateLine = `${dayNames[now.getDay()]}, ${monthNamesShort[now.getMonth()]} ${now.getDate()}`;

  /* ─── Derived data (memoized) — before early returns to satisfy hook rules ─── */

  const topGainers = useMemo(() => data ? [...data.movers].filter(m => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5) : [], [data]);
  const topLosers = useMemo(() => data ? [...data.movers].filter(m => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5) : [], [data]);
  const allMovers = useMemo(() => [...topGainers, ...topLosers].sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact)).slice(0, 8), [topGainers, topLosers]);
  const portfolioUp = data ? data.portfolio.overnightChangePct >= 0 : true;
  const topSector = data && data.sectorHeat.length > 0 ? [...data.sectorHeat].sort((a, b) => b.weight - a.weight)[0] : null;
  const biggestMover = allMovers[0] || null;

  const harvestCandidates = useMemo(() => data ? data.allHoldings.filter(h => h.changePct < -3).sort((a, b) => a.changePct - b.changePct) : [], [data]);
  const showHarvestCTA = harvestCandidates.length > 0;

  const spyDir = data?.market.spy ? (data.market.spy.changePct >= 0 ? 'up' : 'down') : null;
  const qqqDir = data?.market.qqq ? (data.market.qqq.changePct >= 0 ? 'up' : 'down') : null;

  /* ─── Editorial hero paragraph: same narrative the old lead body built, now the
        gold-tinted hero per the spec. Reuses portfolio/market/mover/sector data. ─── */
  const heroParagraph = useMemo(() => {
    if (!data) return '';
    const parts: string[] = [];
    parts.push(
      portfolioUp
        ? `Your portfolio gained ${fmt(Math.abs(data.portfolio.overnightChange))} since yesterday's close, a ${fmtPct(data.portfolio.overnightChangePct)} move that puts your total at ${fmt(data.portfolio.totalValue)}.`
        : `A ${Math.abs(data.portfolio.overnightChangePct).toFixed(2)}% drawdown took ${fmt(Math.abs(data.portfolio.overnightChange))} off your portfolio since yesterday's close, leaving your total at ${fmt(data.portfolio.totalValue)}.`,
    );
    if (data.market.spy) {
      parts.push(
        `The broader market (SPY) was ${spyDir} ${fmtPct(data.market.spy.changePct)}${data.market.qqq ? ` while the Nasdaq moved ${qqqDir} ${fmtPct(data.market.qqq.changePct)}` : ''}.`,
      );
    }
    if (biggestMover) {
      parts.push(
        `${biggestMover.name} (${biggestMover.ticker}) was your biggest mover at ${fmtPct(biggestMover.changePct)}, ${biggestMover.changePct >= 0 ? 'adding' : 'costing'} ${fmt(Math.abs(biggestMover.dollarImpact))}.`,
      );
    }
    if (topSector) {
      parts.push(`${topSector.sector} remains your largest sector exposure at ${topSector.weight.toFixed(1)}%.`);
    }
    return parts.join(' ');
  }, [data, portfolioUp, spyDir, qqqDir, biggestMover, topSector]);

  /* ─── General market brief (free tier): non-tailored, market-wide only.
        Never references the user's book — that narrative is the Pro digest. ─── */
  const generalMarketBrief = useMemo(() => {
    if (!data) return '';
    const parts: string[] = [];
    if (data.market.spy) {
      parts.push(
        `The S&P 500 (SPY) is ${spyDir} ${fmtPct(data.market.spy.changePct)}${data.market.qqq ? ` and the Nasdaq (QQQ) is ${qqqDir} ${fmtPct(data.market.qqq.changePct)}` : ''} this morning.`,
      );
    }
    if (data.market.vix) {
      const lvl = data.market.vix.price;
      const regime = lvl < 15 ? 'a calm, low-volatility tape' : lvl < 20 ? 'moderate volatility' : lvl < 30 ? 'elevated volatility as risk gets repriced' : 'high volatility — markets are repricing risk fast';
      parts.push(`The VIX sits at ${lvl.toFixed(1)}, ${regime}.`);
    }
    if (data.market.treasury) {
      parts.push(
        `Long-dated Treasuries (TLT) are ${data.market.treasury.changePct >= 0 ? 'up' : 'down'} ${fmtPct(data.market.treasury.changePct)}, ${data.market.treasury.changePct >= 0 ? 'a bid for duration' : 'with yields ticking higher'}.`,
      );
    }
    if (parts.length === 0) parts.push('Markets are quiet this morning with no major index moves to flag.');
    return parts.join(' ');
  }, [data, spyDir, qqqDir]);

  /* ─── Market context strip cells (only real data; never fabricated) ─── */
  const marketCells = useMemo(() => {
    if (!data) return [] as { label: string; value: string; delta: string; pos: boolean }[];
    const cells: { label: string; value: string; delta: string; pos: boolean }[] = [];
    if (data.market.spy) cells.push({ label: 'S&P 500 (SPY)', value: `$${data.market.spy.price.toFixed(2)}`, delta: fmtPct(data.market.spy.changePct), pos: data.market.spy.changePct >= 0 });
    if (data.market.qqq) cells.push({ label: 'Nasdaq (QQQ)', value: `$${data.market.qqq.price.toFixed(2)}`, delta: fmtPct(data.market.qqq.changePct), pos: data.market.qqq.changePct >= 0 });
    if (data.market.vix) cells.push({ label: 'VIX', value: data.market.vix.price.toFixed(2), delta: data.market.vix.level.replace(/_/g, ' '), pos: data.market.vix.price < 20 });
    if (data.market.treasury) cells.push({ label: 'Bonds (TLT)', value: `$${data.market.treasury.price.toFixed(2)}`, delta: fmtPct(data.market.treasury.changePct), pos: data.market.treasury.changePct >= 0 });
    // BTC only if the user actually tracks it (real data, not invented).
    const btc = liveWatchlist.find(w => /^(BTC|BTC-USD|BTCUSD|X:BTCUSD)$/i.test(w.ticker) && w.price != null);
    if (btc) cells.push({ label: 'BTC', value: `$${Math.round(btc.price).toLocaleString()}`, delta: fmtPct(btc.changePct), pos: btc.changePct >= 0 });
    return cells;
  }, [data, liveWatchlist]);

  /* ─── Signal feed: maps existing intelligence into category-coded cards ─── */
  const signals = useMemo<Signal[]>(() => {
    if (!data) return [];
    const out: Signal[] = [];

    // Concentration: largest sector exposure when meaningfully heavy.
    if (topSector && topSector.weight >= 30) {
      out.push({
        category: 'Concentration',
        meta: 'High impact',
        metaColor: 'var(--color-negative-text)',
        headline: `${topSector.sector} is now ${topSector.weight.toFixed(0)}% of your portfolio`,
        body: `${topSector.tickers.slice(0, 4).join(', ')} share the same demand driver, so a single shock would hit them together. A position this size concentrates your outcome in one theme.`,
        action: { label: 'Model a trim', href: '/dashboard/portfolio/factors' },
        source: 'Source · Helm risk engine',
      });
    }

    // Earnings exposure this week.
    if (data.earningsThisWeek.length > 0) {
      const sorted = [...data.earningsThisWeek].sort((a, b) => b.portfolioWeight - a.portfolioWeight);
      const tickers = sorted.slice(0, 4).map(e => e.ticker).join(', ');
      const exposure = sorted.reduce((s, e) => s + e.portfolioWeight, 0);
      out.push({
        category: 'Earnings',
        meta: 'This week',
        metaColor: 'var(--color-warning-text)',
        headline: `${tickers} report${sorted.length === 1 ? 's' : ''} this week`,
        body: `${exposure.toFixed(0)}% of your book reports inside the next five trading days. Earnings can move a stock 3-10%, so size and exposure matter most going into the prints.`,
        action: { label: 'View exposure', href: '/dashboard/earnings' },
        source: 'Source · SEC EDGAR calendar',
      });
    }

    // Tax-loss harvest.
    if (showHarvestCTA) {
      const tickers = harvestCandidates.slice(0, 3).map(h => h.ticker).join(', ');
      out.push({
        category: 'Tax',
        meta: 'Actionable',
        headline: `${harvestCandidates.length} position${harvestCandidates.length > 1 ? 's' : ''} down more than 3% today`,
        body: `${tickers}${harvestCandidates.length > 3 ? ` and ${harvestCandidates.length - 3} more` : ''} carry potential harvestable losses. The Tax Center checks cost basis and wash-sale windows before you act.`,
        action: { label: 'Open harvester', href: '/dashboard/taxes' },
        source: 'Source · Helm tax engine',
      });
    }

    // Holding news (top item affecting a position).
    const topNews = data.positionNews[0];
    if (topNews) {
      const ago = (() => {
        const mins = Math.max(0, Math.round((Date.now() - new Date(topNews.publishedAt).getTime()) / 60000));
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.round(hrs / 24)}d ago`;
      })();
      out.push({
        category: 'Holding news',
        meta: ago,
        headline: topNews.ticker ? `${topNews.ticker}: ${topNews.title}` : topNews.title,
        body: topNews.impactNote || topNews.summary || 'Affects a position in your book.',
        action: topNews.url ? { label: 'Read source', href: topNews.url } : undefined,
        source: topNews.source ? `Source · ${topNews.source}` : undefined,
      });
    }

    return out;
  }, [data, topSector, showHarvestCTA, harvestCandidates]);

  /* ─── Driving your day: top movers by dollar impact ─── */
  const drivers = useMemo(() => allMovers.slice(0, 4), [allMovers]);

  /* ─── Watchlist signals: non-default watchlist names with a notable move ─── */
  const watchlistSignals = useMemo(() => liveWatchlist
    .filter(w => w.price != null && w.changePct != null && Math.abs(w.changePct) >= 1)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 3), [liveWatchlist]);

  /* ─── Thesis-led: lead with conviction when a tracked pillar broke or weakened ─── */
  const thesisLeads = !!(data?.thesisEnabled && data.thesisBrief && data.thesisBrief.trackedCount > 0 && (data.thesisBrief.counts.broken > 0 || data.thesisBrief.counts.weakening > 0));
  const leadStatus = data?.thesisBrief && data.thesisBrief.counts.broken > 0 ? 'broken' : 'weakening';

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  States: empty / connect prompt                                          */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const noData = (!loading && data && data.allHoldings.length === 0 && data.portfolio.totalValue === 0) || dataState === 'empty';

  if (noData) {
    return (
      <div className="mx-auto" style={SCREEN}>
        <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
          <div className={`${CARD} w-full max-w-[560px] px-8 py-10 text-center`}>
            <div
              className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(230,185,77,0.08)', border: '1px solid rgba(230,185,77,0.18)' }}
            >
              <Link2 size={20} className="text-[var(--color-gold)]" />
            </div>
            <h1 className="mb-3 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[var(--color-text-primary)]">
              Connect your brokerage
            </h1>
            <p className="mx-auto mb-6 max-w-[420px] text-[14px] leading-[1.65] text-[var(--color-text-muted)]">
              Helm reads your accounts over a read-only Plaid connection. It can never move money or
              place trades. Link an account to get a personalized brief on what moved your book and why.
            </p>
            <Link
              href="/dashboard/accounts"
              className="inline-flex items-center justify-center rounded-[5px] bg-[var(--color-gold)] px-9 py-3.5 text-[14px] font-bold text-[var(--color-bg-base)] transition-colors hover:bg-[var(--color-gold-hi)]"
            >
              Connect account
            </Link>
            <p className="mt-7 text-[11px] tracking-[0.06em] text-[#5a5a5a]" style={MONO}>
              12,000+ institutions · 256-bit encryption · via Plaid
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  States: loading skeleton                                                */
  /* ═══════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="mx-auto animate-pulse" style={SCREEN}>
        <div className="mb-[22px] flex items-end justify-between gap-6">
          <div>
            <div className="mb-2 h-3 w-44 rounded bg-[rgba(230,185,77,0.12)]" />
            <div className="h-7 w-64 rounded bg-white/[0.06]" />
          </div>
          <div className="h-8 w-32 rounded bg-white/[0.04]" />
        </div>
        <div className="mb-3.5 h-32 rounded-md bg-white/[0.04]" />
        <div className="mb-5 grid grid-cols-2 gap-px sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded bg-white/[0.04]" />)}
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-md bg-white/[0.04]" />)}
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-md bg-white/[0.04]" />)}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  States: error                                                           */
  /* ═══════════════════════════════════════════════════════════════════════ */

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] items-center justify-center" style={SCREEN}>
        <div className="text-[14px] text-[var(--color-negative-text)]">
          Failed to load brief.{' '}
          <Link href="/dashboard" className="text-[var(--color-gold)]">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  /* ─── Brief not generated yet (no digest, no signals) → generating treatment ─── */
  const notGenerated = tier !== 'free' && !data.digest && signals.length === 0 && !thesisLeads;

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                  */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="relative mx-auto" style={SCREEN}>
      {notGenerated && <GeneratingOverlay />}

      {/* ══ Greeting header ══ */}
      <div className="mb-[22px] flex items-end justify-between gap-6">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]" style={MONO}>
            ✦ Helm Brief · {briefDateLine}
          </div>
          <h1 className="text-[28px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)]">
            Good morning{firstName ? `, ${firstName}` : ''}.
          </h1>
        </div>
        <div className="text-right text-[10px] leading-[1.7] text-[var(--color-text-muted)]" style={MONO}>
          <div>
            Generated{' '}
            {data.digestGeneratedAt
              ? new Date(data.digestGeneratedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
              : '9:15 AM ET'}
          </div>
          <div>
            {data.allHoldings.length} positions · <span className="text-[var(--color-positive)]">● fresh</span>
          </div>
        </div>
      </div>

      {/* ══ Editorial hero (gold-tinted) ══
           Free → general market brief (non-tailored). Pro+ → tailored digest. */}
      <div
        className="mb-3.5 rounded-lg px-[26px] py-6"
        style={{
          border: '1px solid rgba(230,185,77,0.18)',
          background: 'rgba(230,185,77,0.025)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
          {tier === 'free' ? 'Market brief' : 'Your brief'}
        </div>
        {tier === 'free' ? (
          <p className="m-0 text-[16.5px] leading-[1.62] text-[var(--color-text-primary)] text-pretty">
            {generalMarketBrief}
          </p>
        ) : data.digest ? (
          data.digest.split('\n\n').map((para, i) => (
            <p
              key={i}
              className="m-0 mb-3 text-[16.5px] leading-[1.62] text-[var(--color-text-primary)] text-pretty last:mb-0"
            >
              {para}
            </p>
          ))
        ) : (
          <p className="m-0 text-[16.5px] leading-[1.62] text-[var(--color-text-primary)] text-pretty">
            {heroParagraph}
          </p>
        )}
      </div>

      {/* ══ Market context strip (5 cells, real data only) ══ */}
      {marketCells.length > 0 && (
        <div
          className="mb-5 grid grid-cols-2 overflow-hidden rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] sm:grid-cols-3 lg:grid-cols-5"
        >
          {marketCells.map((c, i) => (
            <div
              key={c.label}
              className="px-[18px] py-[13px]"
              style={{
                borderRight: i < marketCells.length - 1 ? '1px solid var(--color-border-subtle)' : undefined,
              }}
            >
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]" style={MONO}>
                {c.label}
              </div>
              <div className="text-[14px] font-bold tabular-nums" style={MONO}>{c.value}</div>
              <div
                className={`mt-[3px] text-[10px] ${c.pos ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}
                style={MONO}
              >
                {c.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Macro strip (existing thesis macro context, only what moves your book) ══ */}
      {data.macroStrip.length > 0 && <MacroStrip items={data.macroStrip} />}

      {/* ══ Two columns: signal feed + right rail ══ */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">

        {/* ── Signal feed ── */}
        <div className="flex flex-col gap-3">
          <div className="mb-0.5 text-[9px] uppercase tracking-[0.2em] text-[#5a5a5a]" style={MONO}>
            For your portfolio · {signals.length} signal{signals.length === 1 ? '' : 's'}
          </div>

          {/* Conviction alert leads when a tracked pillar broke or weakened (Pro) */}
          {tier !== 'free' && thesisLeads && data.thesisBrief && (
              <div
                className={`${CARD} px-5 py-[18px]`}
                style={{ borderLeft: `2px solid ${STATUS_META[leadStatus].color}` }}
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span
                    className="rounded-[3px] px-[7px] py-[3px] text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{
                      ...MONO,
                      color: STATUS_META[leadStatus].color,
                      background: `${STATUS_META[leadStatus].color}1A`,
                      border: `1px solid ${STATUS_META[leadStatus].color}33`,
                    }}
                  >
                    Conviction
                  </span>
                  <span className="flex-1" />
                  <span
                    className="text-[9px] uppercase tracking-[0.1em]"
                    style={{ ...MONO, color: STATUS_META[leadStatus].color }}
                  >
                    Needs attention
                  </span>
                </div>
                <div className="mb-[7px] text-[16px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--color-text-primary)]">
                  Your theses this morning
                </div>
                <p className="m-0 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {data.thesisBrief.headline}
                </p>
                {data.thesisBrief.moved.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {data.thesisBrief.moved.slice(0, 6).map((m, i) => (
                      <span
                        key={`${m.ticker}-${i}`}
                        className="rounded border px-2 py-[3px] text-[10.5px]"
                        style={{
                          ...MONO,
                          color: m.to === 'broken' ? 'var(--color-negative-text)' : 'var(--color-gold)',
                          borderColor: m.to === 'broken' ? 'rgba(248,113,113,0.3)' : 'rgba(230,185,77,0.3)',
                          background: m.to === 'broken' ? 'rgba(248,113,113,0.07)' : 'rgba(230,185,77,0.07)',
                        }}
                      >
                        {m.ticker} {m.from} → {m.to}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3.5">
                  <Link
                    href="/dashboard/theses"
                    className="rounded-[4px] px-3 py-[7px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-gold)] transition-colors hover:bg-[rgba(230,185,77,0.14)]"
                    style={{ ...MONO, background: 'rgba(230,185,77,0.08)', border: '1px solid rgba(230,185,77,0.18)' }}
                  >
                    Review your theses →
                  </Link>
                </div>
              </div>
          )}

          {/* Category-coded signal cards */}
          {signals.map((s, i) => <SignalCard key={`${s.category}-${i}`} signal={s} />)}

          {/* Thesis intelligence digest (Pro) */}
          {tier !== 'free' && data.thesisEnabled && data.thesisIntelligence.length > 0 && (
              <div className={`${CARD} px-5 py-[18px]`} style={{ borderLeft: '2px solid var(--color-gold)' }}>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
                    Thesis intelligence
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]" style={MONO}>
                    {data.thesisIntelligence.length} of 3 max today
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {data.thesisIntelligence.map((item, i) => (
                    <VerdictCard key={`${item.ticker}-${i}`} item={item} />
                  ))}
                </div>
              </div>
          )}

          {/* One light upgrade nudge for free users — mentions both the
              conviction-led brief and thesis tracking. Not a wall. */}
          {tier === 'free' && (
            <Link
              href="/pricing"
              className={`${CARD} group block px-5 py-[18px] transition-colors hover:border-[rgba(230,185,77,0.32)]`}
              style={{ borderLeft: '2px solid rgba(230,185,77,0.4)' }}
            >
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={13} className="text-[var(--color-gold)]" />
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
                  Pro · $20/mo
                </span>
              </div>
              <div className="mb-[6px] text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--color-text-primary)]">
                Make this brief yours
              </div>
              <p className="m-0 text-[13.5px] leading-[1.6] text-[var(--color-text-secondary)]">
                Pro turns the general brief above into a conviction-led read on what moved your book and why, and tracks the theses behind every position, leading your brief the morning a pillar cracks.
              </p>
              <span className="mt-3 inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-gold)]" style={MONO}>
                Upgrade to Pro →
              </span>
            </Link>
          )}

          {/* Quiet thesis state */}
          {data.thesisEnabled && data.thesisIntelligence.length === 0 && data.macroStrip.length === 0 && !thesisLeads && (
            <QuietState summary={data.pillarSummary} />
          )}

          {/* No signals fallback */}
          {signals.length === 0 && !thesisLeads && !(data.thesisEnabled && data.thesisIntelligence.length > 0) && (
            <div className={`${CARD} px-5 py-[18px]`}>
              <p className="m-0 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
                Nothing needs your attention this morning. No concentration flags, no earnings inside the
                window, and no harvestable losses across your book. Helm keeps watching.
              </p>
            </div>
          )}
        </div>

        {/* ── Right rail ── */}
        <div className="flex flex-col gap-3">

          {/* Driving your day */}
          {drivers.length > 0 && (
            <RailCard label="Driving your day">
              <div className="flex flex-col">
                {drivers.map((m, i) => (
                  <Link
                    key={m.ticker}
                    href={`/dashboard/analyze/${m.ticker}`}
                    className="flex items-center gap-2.5 py-[11px]"
                    style={i > 0 ? { borderTop: '1px solid var(--color-border-subtle)' } : undefined}
                  >
                    <span className="w-[46px] text-[12px] font-bold text-[var(--color-gold)]" style={MONO}>{m.ticker}</span>
                    <span className={`flex-1 text-[11px] ${m.dollarImpact >= 0 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-muted)]'}`}>
                      {m.dollarImpact >= 0 ? '+' : '−'}{fmt(Math.abs(m.dollarImpact))}
                    </span>
                    <span className={`text-[12px] font-semibold ${m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`} style={MONO}>
                      {fmtPct(m.changePct)}
                    </span>
                  </Link>
                ))}
              </div>
            </RailCard>
          )}

          {/* Watchlist signals */}
          <RailCard label="Watchlist signals">
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setShowWatchlistAdd(!showWatchlistAdd)}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--color-gold)] transition-colors hover:text-[var(--color-gold-hi)]"
                style={MONO}
                aria-label="Add ticker to watchlist"
              >
                <Plus size={11} /> Add
              </button>
              {showWatchlistAdd && (
                <form onSubmit={(e) => { e.preventDefault(); handleAddWatchlistTicker(); }} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={watchlistInput}
                    onChange={(e) => setWatchlistInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
                    placeholder="AAPL"
                    className="w-16 rounded border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    autoFocus
                    maxLength={5}
                  />
                  <button type="submit" disabled={watchlistLoading} className="rounded bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-semibold text-black disabled:opacity-50">
                    {watchlistLoading ? '…' : 'Add'}
                  </button>
                </form>
              )}
            </div>
            {watchlistSignals.length > 0 ? (
              <div className="flex flex-col gap-3">
                {watchlistSignals.map(w => (
                  <div key={w.ticker} className="group flex items-start gap-[11px]">
                    <span className="w-[46px] text-[12px] font-bold text-[var(--color-text-primary)]" style={MONO}>{w.ticker}</span>
                    <div className="flex-1">
                      <div className="text-[12px] leading-[1.4] text-[var(--color-text-secondary)]">
                        <PriceFlash value={w.price}>${w.price.toFixed(2)}</PriceFlash>
                        {' · '}
                        {w.changeAmt >= 0 ? '+' : '−'}{fmt(Math.abs(w.changeAmt))} today
                      </div>
                      <div
                        className={`mt-0.5 text-[10px] ${w.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}
                        style={MONO}
                      >
                        {fmtPct(w.changePct)}
                      </div>
                    </div>
                    {watchlist.length > 0 && (
                      <button
                        onClick={() => handleRemoveWatchlistTicker(w.ticker)}
                        className="text-[var(--color-text-muted)] opacity-0 transition-opacity hover:text-[var(--color-negative-text)] group-hover:opacity-100"
                        aria-label={`Remove ${w.ticker} from watchlist`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
                Quiet across your watchlist. Helm flags moves over 1% here.
              </p>
            )}
          </RailCard>

          {/* Ask Helm scenario card (gold) */}
          <div
            className="rounded-md px-5 py-[18px]"
            style={{
              border: '1px solid rgba(230,185,77,0.18)',
              background: 'rgba(230,185,77,0.025)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
              <Sparkles size={12} strokeWidth={1.6} />
              Ask Helm
            </div>
            <p className="m-0 mb-3 text-[12.5px] leading-[1.55] text-[var(--color-text-secondary)]">
              {biggestMover
                ? `"What happens to my portfolio if ${biggestMover.ticker} drops 20%?"`
                : '"What happens to my portfolio if the market drops 10%?"'}
            </p>
            <Link
              href="/dashboard/chat"
              className="block w-full rounded-[5px] py-[9px] text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#0A0A0A] transition-[filter] hover:brightness-110"
              style={{ ...MONO, background: 'var(--color-gold)' }}
            >
              Run scenario →
            </Link>
          </div>
        </div>
      </div>

      {/* ══ Footer ══ */}
      <footer className="mt-10 border-t border-white/[0.06] pt-4">
        <div className="flex flex-col justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] sm:flex-row" style={MONO}>
          <span>Sources: Finazon · SEC EDGAR · Market News</span>
          <span>AI-generated summary · Not financial advice</span>
        </div>
      </footer>
    </div>
  );
}
