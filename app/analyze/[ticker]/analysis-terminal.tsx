'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { StockAnalysis, AnalysisMetric } from '@/components/analysis/types';
import type { TickerData, ReportedFinancials } from '@/lib/financial-data';
import { Search, Loader2, Link2, Check, ChevronRight, Menu, X, Calendar } from 'lucide-react';
import { FinancialDisclaimer } from '@/components/financial-disclaimer';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

// ── Types ──

type FunctionKey = 'overview' | 'fundamentals' | 'earnings' | 'news' | 'ai-analysis' | 'compare' | 'options';

interface FunctionItem {
  key: FunctionKey;
  label: string;
  children?: string[];
  badge?: string;
  disabled?: boolean;
}

interface AnalysisTerminalProps {
  analysis: StockAnalysis;
  tickerData: TickerData;
  ticker: string;
  computedAt: string;
  dataSources: string[];
  methodologyVersion: string;
  /** "public" = standalone SEO page with CTA. "dashboard" = inside sidebar shell, no CTA. */
  variant?: 'public' | 'dashboard';
}

// ── Constants ──

const FUNCTIONS: FunctionItem[] = [
  { key: 'overview', label: 'OVERVIEW' },
  { key: 'fundamentals', label: 'FUNDAMENTALS', children: ['Income', 'Balance', 'Cash Flow'] },
  { key: 'earnings', label: 'EARNINGS', children: ['History'] },
  { key: 'news', label: 'NEWS', children: ['Recent', 'Sentiment'] },
  { key: 'ai-analysis', label: 'AI ANALYSIS', children: ['Bull', 'Bear'] },
  { key: 'compare', label: 'COMPARE', children: ['Side-by-Side'] },
  { key: 'options', label: 'OPTIONS', badge: 'PRO' },
];

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];

// Sovereign Architect card chrome — surface bg, hairline border, soft drop shadow.
const CARD = 'border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.5)]';
const SECTION_LABEL = 'font-mono text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-text-muted)]';

// ── Helpers ──

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  return `$${fmt(n)}`;
}

function changeColor(n: number | null | undefined): string {
  if (n == null || n === 0) return 'text-[var(--color-text-secondary)]';
  return n > 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]';
}

function sentimentDot(s: string): string {
  if (s === 'positive') return 'bg-[var(--color-positive)]';
  if (s === 'negative') return 'bg-[var(--color-negative-text)]';
  return 'bg-[var(--color-text-muted)]';
}

function verdictBg(v: string): string {
  if (v === 'bullish') return 'bg-[var(--color-positive)]/15 text-[var(--color-positive)] border-[var(--color-positive)]/30';
  if (v === 'bearish') return 'bg-[var(--color-negative)]/15 text-[var(--color-negative-text)] border-[var(--color-negative)]/30';
  return 'bg-[var(--color-gold)]/15 text-[var(--color-gold)] border-[var(--color-gold)]/30';
}

// Hex for the verdict sentiment dot — used in inline SVG / style props.
function verdictColor(v: string): string {
  if (v === 'bullish') return 'var(--color-positive)';
  if (v === 'bearish') return 'var(--color-negative-text)';
  return 'var(--color-gold)';
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts * 1000;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

// ── Inline Search ──

function InlineSearch({ currentTicker, basePath = '/analyze' }: { currentTicker: string; basePath?: string }) {
  const router = useRouter();
  const [input, setInput] = useState(currentTicker);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const clean = input.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (clean && clean.length <= 5 && clean !== currentTicker) {
        setLoading(true);
        router.push(`${basePath}/${clean}`);
      }
    },
    [input, currentTicker, router],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xs">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Ticker"
          maxLength={5}
          disabled={loading}
          aria-label="Stock ticker symbol"
          className="w-full pl-8 pr-2 py-2.5 sm:py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border-base)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-[13px] tracking-wider font-mono tabular-nums disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={!input.trim() || input.trim().toUpperCase() === currentTicker || loading}
        className="px-3.5 py-2.5 sm:py-2 bg-[var(--color-gold)] hover:brightness-[1.08] text-[var(--color-text-inverse)] font-semibold rounded-md transition-all text-[12px] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : 'GO'}
      </button>
    </form>
  );
}

// ── Left Pane: Function Tree ──

function FunctionTree({ active, onSelect }: { active: FunctionKey; onSelect: (k: FunctionKey) => void }) {
  return (
    <nav className="space-y-0.5" aria-label="Analysis sections">
      {FUNCTIONS.map((fn) => {
        const isActive = active === fn.key;
        const isDisabled = fn.disabled || !!fn.badge;
        return (
          <div key={fn.key}>
            <button
              onClick={() => !isDisabled && onSelect(fn.key)}
              disabled={isDisabled}
              className={`w-full text-left px-3 py-2.5 text-[14px] tracking-[0.14em] font-mono transition-colors flex items-center justify-between group border-l-2 ${
                isActive
                  ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/5'
                  : isDisabled
                    ? 'border-transparent text-[var(--color-text-muted)]/50 cursor-not-allowed'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span>{fn.label}</span>
              {fn.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-semibold tracking-wider ${
                  fn.badge === 'PRO'
                    ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                }`}>
                  {fn.badge}
                </span>
              )}
              {!fn.badge && !isDisabled && (
                <ChevronRight className={`w-3.5 h-3.5 transition-opacity ${isActive ? 'opacity-100 text-[var(--color-gold)]' : 'opacity-0 group-hover:opacity-50'}`} />
              )}
            </button>
            {isActive && fn.children && (
              <div className="ml-5 border-l border-[var(--color-border-subtle)] pl-3 py-1 space-y-0.5">
                {fn.children.map((child) => (
                  <div key={child} className="text-[11px] font-mono tracking-wider text-[var(--color-text-muted)] py-0.5">
                    {child}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Metric Cell (8-col strip style) ──

function MetricCell({ label, value, context }: { label: string; value: string; context?: string }) {
  return (
    <div className="px-3.5 py-3 border-r border-b border-[var(--color-border-subtle)] min-w-0">
      <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--color-text-muted)] mb-1.5">{label}</div>
      <div className="font-mono text-[16px] sm:text-[17px] font-bold tabular-nums text-[var(--color-text-primary)] truncate" title={value}>{value}</div>
      {context && <div className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{context}</div>}
    </div>
  );
}

// ── Range pills (presentational — chart shows trailing window) ──

function RangePills() {
  const ranges = ['1D', '5D', '1M', '6M', 'YTD', '1Y'];
  const active = '6M';
  return (
    <div className="flex gap-1.5 font-mono text-[11px] tracking-[0.1em] uppercase">
      {ranges.map((r) => (
        <span
          key={r}
          className={`px-2.5 py-1.5 rounded ${
            r === active ? 'bg-[var(--color-gold)]/[0.08] text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

// ── Price Chart ──

function PriceChart({ ticker }: { ticker: string }) {
  const [prices, setPrices] = useState<{ price_date: string; close: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/market/history?ticker=${ticker}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.prices) setPrices(data.prices); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="h-[200px] flex items-center justify-center text-[13px] font-mono text-[var(--color-text-muted)]">Loading chart...</div>;
  if (prices.length < 2) return null;

  const min = Math.min(...prices.map(p => p.close));
  const max = Math.max(...prices.map(p => p.close));
  const first = prices[0].close;
  const last = prices[prices.length - 1].close;
  const isUp = last >= first;
  const color = isUp ? 'var(--color-positive)' : 'var(--color-negative-text)';

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={prices} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="price_date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} tickFormatter={(v: string) => { const d = new Date(v + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
          <YAxis domain={[min * 0.995, max * 1.005]} tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} axisLine={false} tickLine={false} width={50} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-[var(--color-bg-overlay)] border border-[var(--color-border-strong)] rounded-md px-3 py-2 text-[12px] font-mono shadow-lg">
                <div className="text-[var(--color-text-muted)]">{d.price_date}</div>
                <div className="text-[var(--color-text-primary)] font-semibold">${d.close.toFixed(2)}</div>
              </div>
            );
          }} />
          <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.6} fill={`url(#gradient-${ticker})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── EPS Chart (from earnings history) ──

function EPSChart({ earnings }: { earnings: TickerData['earnings'] }) {
  const data = useMemo(() => {
    if (!earnings) return [];
    return [...earnings]
      .filter(e => e.actual != null)
      .reverse()
      .slice(-8)
      .map(e => ({
        quarter: `Q${e.quarter} ${e.year}`,
        actual: e.actual!,
        estimate: e.estimate,
        beat: e.actual != null && e.estimate != null ? e.actual > e.estimate : null,
      }));
  }, [earnings]);

  if (data.length < 2) return null;

  return (
    <div className="space-y-2.5">
      <div className={SECTION_LABEL}>EPS History (Actual vs Estimate)</div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
            <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-[var(--color-bg-overlay)] border border-[var(--color-border-strong)] rounded-md px-3 py-2 text-[12px] font-mono shadow-lg">
                  <div className="text-[var(--color-text-muted)]">{d.quarter}</div>
                  <div className={`font-semibold ${d.beat ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}>Actual: ${d.actual.toFixed(2)}</div>
                  {d.estimate != null && <div className="text-[var(--color-text-muted)]">Est: ${d.estimate.toFixed(2)}</div>}
                </div>
              );
            }} />
            <Bar dataKey="estimate" fill="var(--color-text-muted)" radius={[2, 2, 0, 0]} opacity={0.3} />
            <Bar dataKey="actual" fill="var(--color-positive)" radius={[2, 2, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Verdict Card (gold-tinted, Sovereign Architect) ──

function VerdictCard({ analysis }: { analysis: StockAnalysis }) {
  const verdictLabel = analysis.verdict.toUpperCase();
  return (
    <div className="border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.025] rounded-lg px-6 py-5">
      <div className="flex items-center gap-3 mb-3.5">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-gold)]">✦ Helm Verdict</span>
        <span className="flex-1 h-px bg-[var(--color-gold)]/[0.12]" />
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase flex items-center gap-1.5" style={{ color: verdictColor(analysis.verdict) }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdictColor(analysis.verdict) }} />
          {verdictLabel}
        </span>
      </div>
      <p className="text-[15.5px] leading-[1.62] text-[var(--color-text-primary)] m-0 text-pretty">{analysis.recommendation}</p>
    </div>
  );
}

// ── Bull / Bear two-column cards ──

function BullBearCards({ analysis }: { analysis: StockAnalysis }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div className="border border-[var(--color-positive)]/15 bg-[var(--color-positive)]/[0.03] rounded-lg px-5 py-5">
        <div className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--color-positive)] mb-3.5">▲ Bull Case</div>
        <p className="text-[14px] leading-[1.6] text-[var(--color-text-secondary)] m-0">{analysis.bullCase}</p>
      </div>
      <div className="border border-[var(--color-negative)]/15 bg-[var(--color-negative)]/[0.03] rounded-lg px-5 py-5">
        <div className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--color-negative-text)] mb-3.5">▼ Bear Case</div>
        <p className="text-[14px] leading-[1.6] text-[var(--color-text-secondary)] m-0">{analysis.bearCase}</p>
      </div>
    </div>
  );
}

// ── Sources strip ("No black boxes") ──

function SourcesStrip({ dataSources, computedAt, methodologyVersion }: { dataSources: string[]; computedAt: string; methodologyVersion: string }) {
  return (
    <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-inset)] rounded-lg px-5 py-4 flex items-center gap-5 flex-wrap">
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--color-text-muted)]">Sources</div>
      {dataSources.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
          <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{s}</span>
        </div>
      ))}
      <div className="w-full font-mono text-[11px] text-[var(--color-text-muted)]">
        Methodology v{methodologyVersion} · {new Date(computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · No black boxes. Every figure is sourced and timestamped.
      </div>
    </div>
  );
}

// ── Center Pane Views ──

function OverviewView({ analysis, tickerData, computedAt, dataSources, methodologyVersion }: { analysis: StockAnalysis; tickerData: TickerData; computedAt: string; dataSources: string[]; methodologyVersion: string }) {
  const { quote, profile, financials, earnings } = tickerData;
  const m = financials?.metric || {};

  // Next earnings date
  const nextEarnings = useMemo(() => {
    if (!earnings) return null;
    const now = new Date();
    const future = earnings.find(e => new Date(e.period) > now);
    if (future) return future;
    return earnings[0]; // most recent
  }, [earnings]);

  return (
    <div className="space-y-3.5">
      {/* Price header */}
      <div className="flex items-end justify-between gap-8 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3.5 mb-1 flex-wrap">
            <span className="font-mono text-[22px] font-bold text-[var(--color-gold)] tabular-nums tracking-[0.02em]">{analysis.ticker}</span>
            <span className="text-[16px] text-[var(--color-text-muted)] font-medium">{analysis.companyName}</span>
          </div>
          <div className="flex items-baseline gap-3.5 flex-wrap">
            <span className="text-[42px] font-bold tabular-nums tracking-[-0.025em] leading-none text-[var(--color-text-primary)]">{fmtPrice(quote?.c)}</span>
            <span className={`font-mono text-[15px] font-semibold ${changeColor(quote?.dp)}`}>
              {quote?.d != null ? `${quote.d >= 0 ? '+' : ''}${fmt(quote.d)} · ` : ''}{fmtPct(quote?.dp)}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-[0.1em] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] animate-pulse" /> LIVE
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[12px] font-mono tracking-wider text-[var(--color-text-muted)]">
            {profile?.exchange && <span>{profile.exchange}</span>}
            {profile?.exchange && profile?.industry && <span className="text-[var(--color-border-strong)]">|</span>}
            {profile?.industry && <span>{profile.industry}</span>}
          </div>
        </div>
        <RangePills />
      </div>

      {/* Price chart card */}
      <div className={`${CARD} px-5 py-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className={SECTION_LABEL}>Price — 45 Day</div>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-[18px] font-semibold text-[var(--color-text-primary)]">{fmtPrice(quote?.c)}</span>
            <span className={`text-[13px] ${changeColor(quote?.dp)}`}>{fmtPct(quote?.dp)}</span>
          </div>
        </div>
        <PriceChart ticker={analysis.ticker} />
      </div>

      {/* Helm verdict */}
      <VerdictCard analysis={analysis} />

      {/* 8-col metrics strip */}
      <div className={`${CARD} overflow-hidden grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 [&>*:nth-child(-n+8)]:border-b-0`}>
        <MetricCell label="Price" value={fmtPrice(quote?.c)} />
        <MetricCell label="Day Chg" value={fmtPct(quote?.dp)} />
        <MetricCell label="Mkt Cap" value={profile?.marketCapitalization != null ? fmtCompact(profile.marketCapitalization * 1e6) : '--'} />
        <MetricCell label="P/E" value={m.peBasicExclExtraTTM != null ? fmt(m.peBasicExclExtraTTM) : '--'} />
        <MetricCell label="EPS" value={m.epsBasicExclExtraTTM != null ? fmtPrice(m.epsBasicExclExtraTTM) : '--'} />
        <MetricCell label="Beta" value={m.beta != null ? fmt(m.beta) : '--'} />
        <MetricCell label="52W High" value={m['52WeekHigh'] != null ? fmtPrice(m['52WeekHigh']) : '--'} />
        <MetricCell label="52W Low" value={m['52WeekLow'] != null ? fmtPrice(m['52WeekLow']) : '--'} />
      </div>

      {/* Company overview */}
      <div className={`${CARD} px-5 py-4`}>
        <div className={`${SECTION_LABEL} mb-2`}>Company Overview</div>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-[1.6] m-0">{analysis.summary}</p>
      </div>

      {/* Bull / Bear */}
      <BullBearCards analysis={analysis} />

      {/* Revenue chart + Earnings date side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3.5">
        <div className={`${CARD} px-5 py-4`}>
          <EPSChart earnings={earnings} />
        </div>
        {nextEarnings && (
          <div className={`${CARD} px-5 py-4 flex flex-col items-center justify-center min-w-[160px]`}>
            <Calendar className="w-5 h-5 text-[var(--color-gold)] mb-2" />
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] mb-1">Earnings</div>
            <div className="text-[16px] font-mono font-semibold text-[var(--color-text-primary)]">
              {new Date(nextEarnings.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">Q{nextEarnings.quarter} {nextEarnings.year}</div>
          </div>
        )}
      </div>

      {/* Sources strip */}
      <SourcesStrip dataSources={dataSources} computedAt={computedAt} methodologyVersion={methodologyVersion} />
    </div>
  );
}

function FundamentalsView({ tickerData, profile }: { tickerData: TickerData; profile: TickerData['profile'] }) {
  const m = tickerData.financials?.metric || {};

  const cells: { label: string; value: string; context?: string }[] = [
    { label: 'P/E Ratio', value: m.peBasicExclExtraTTM != null ? fmt(m.peBasicExclExtraTTM) : '--', context: 'TTM' },
    { label: 'EPS', value: m.epsBasicExclExtraTTM != null ? fmtPrice(m.epsBasicExclExtraTTM) : '--', context: 'Basic excl. extra' },
    { label: 'Revenue / Share', value: m.revenuePerShareTTM != null ? fmtPrice(m.revenuePerShareTTM) : '--', context: 'TTM' },
    { label: 'Market Cap', value: profile?.marketCapitalization != null ? fmtCompact(profile.marketCapitalization * 1e6) : '--' },
    { label: 'Gross Margin', value: m.grossMarginTTM != null ? `${fmt(m.grossMarginTTM)}%` : '--', context: 'TTM' },
    { label: 'Operating Margin', value: m.operatingMarginTTM != null ? `${fmt(m.operatingMarginTTM)}%` : '--', context: 'TTM' },
    { label: 'Net Margin', value: m.netProfitMarginTTM != null ? `${fmt(m.netProfitMarginTTM)}%` : '--', context: 'TTM' },
    { label: 'ROE', value: m.roeTTM != null ? `${fmt(m.roeTTM)}%` : '--', context: 'TTM' },
    { label: 'Debt / Equity', value: m.totalDebtToEquityQuarterly != null ? fmt(m.totalDebtToEquityQuarterly) : (m['totalDebt/totalEquityQuarterly'] != null ? fmt(m['totalDebt/totalEquityQuarterly']) : '--'), context: 'Quarterly' },
    { label: 'Current Ratio', value: m.currentRatioQuarterly != null ? fmt(m.currentRatioQuarterly) : '--', context: 'Quarterly' },
    { label: 'Dividend Yield', value: m.dividendYieldIndicatedAnnual != null ? `${fmt(m.dividendYieldIndicatedAnnual)}%` : '--', context: 'Indicated annual' },
    { label: 'Beta', value: m.beta != null ? fmt(m.beta) : '--' },
    { label: '52W High', value: m['52WeekHigh'] != null ? fmtPrice(m['52WeekHigh']) : '--' },
    { label: '52W Low', value: m['52WeekLow'] != null ? fmtPrice(m['52WeekLow']) : '--' },
    { label: 'Book Value / Share', value: m.bookValuePerShareQuarterly != null ? fmtPrice(m.bookValuePerShareQuarterly) : '--', context: 'Quarterly' },
    { label: 'FCF / Share', value: m.fcfPerShareTTM != null ? fmtPrice(m.fcfPerShareTTM) : '--', context: 'TTM' },
  ];

  const [tab, setTab] = useState<'metrics' | 'ic' | 'bs' | 'cf'>('metrics');

  const tabs: [typeof tab, string][] = [
    ['metrics', 'Key Metrics'],
    ['ic', 'Income'],
    ['bs', 'Balance Sheet'],
    ['cf', 'Cash Flow'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-[var(--color-border-subtle)] overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-2.5 text-[13px] font-mono tracking-wider uppercase whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'metrics' ? (
        <div className={`${CARD} overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`}>
          {cells.map((c) => (
            <MetricCell key={c.label} label={c.label} value={c.value} context={c.context} />
          ))}
        </div>
      ) : (
        <StatementView symbol={tickerData.symbol} statement={tab} />
      )}
    </div>
  );
}

// ── Financial Statements (as reported, via /api/market/financials) ──

function fmtStatementValue(value: number, unit: string): string {
  // Finnhub unit strings vary by filer: "usd" vs "u_usd", "usd/share" vs
  // "u_unitedstatesofamericadollarsshare", "shares" vs "u_shares".
  const u = unit.toLowerCase().replace(/^u_/, '');
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  // Per-share dollar amounts (EPS, dividends per share)
  if (u.includes('/share') || u.includes('dollarsshare') || u.includes('pershare')) {
    return `${sign}$${abs.toFixed(2)}`;
  }
  // USD totals
  if (u.startsWith('usd') || u.includes('dollar')) {
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  }
  // Share counts
  if (u.includes('share')) {
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
  }
  return value.toLocaleString();
}

function StatementView({ symbol, statement }: { symbol: string; statement: 'ic' | 'bs' | 'cf' }) {
  const [reports, setReports] = useState<ReportedFinancials[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market/financials?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setReports(data.reports || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (error) {
    return (
      <div className="text-[14px] text-[var(--color-text-muted)] font-mono py-8 text-center">
        Failed to load financial statements.
      </div>
    );
  }

  if (reports === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[var(--color-text-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[14px] font-mono">Loading statements...</span>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-[14px] text-[var(--color-text-muted)] font-mono py-8 text-center">
        No annual filings available for {symbol}.
      </div>
    );
  }

  // Newest report defines row order; match older years by concept + label.
  const newest = reports[0];
  const rows = newest[statement];

  if (rows.length === 0) {
    return (
      <div className="text-[14px] text-[var(--color-text-muted)] font-mono py-8 text-center">
        No data for this statement.
      </div>
    );
  }

  const titles = { ic: 'Income Statement', bs: 'Balance Sheet', cf: 'Cash Flow Statement' };

  return (
    <div className="space-y-3">
      <div className={SECTION_LABEL}>
        {titles[statement]} — Annual (10-K)
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-[13px] font-mono">
          <thead>
            <tr className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
              <th className="text-left px-3.5 py-2.5 text-[11px] tracking-wider uppercase text-[var(--color-text-muted)] font-medium min-w-[200px]">
                Line Item
              </th>
              {reports.map((r) => (
                <th
                  key={r.year}
                  className="text-right px-3.5 py-2.5 text-[11px] tracking-wider uppercase text-[var(--color-text-muted)] font-medium whitespace-nowrap"
                >
                  FY{r.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.concept}-${i}`}
                className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/50"
              >
                <td className="px-3.5 py-2 text-[var(--color-text-secondary)]">{row.label}</td>
                {reports.map((r) => {
                  const match = r[statement].find(
                    (item) => item.concept === row.concept && item.label === row.label,
                  );
                  return (
                    <td
                      key={r.year}
                      className="px-3.5 py-2 text-right tabular-nums text-[var(--color-text-primary)] whitespace-nowrap"
                    >
                      {match != null ? fmtStatementValue(match.value, match.unit) : '--'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
        Source: SEC EDGAR filings. Values as reported.
      </div>
    </div>
  );
}

function EarningsView({ earnings }: { earnings: TickerData['earnings'] }) {
  const rows = (earnings || []).slice(0, 12);

  if (rows.length === 0) {
    return (
      <div className="text-[14px] text-[var(--color-text-muted)] font-mono py-8 text-center">
        No earnings data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={SECTION_LABEL}>Earnings History</div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-[14px] font-mono tabular-nums">
          <thead>
            <tr className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
              <th className="text-left py-2.5 px-3.5 text-[11px] tracking-widest text-[var(--color-text-muted)] uppercase font-medium">Quarter</th>
              <th className="text-right py-2.5 px-3.5 text-[11px] tracking-widest text-[var(--color-text-muted)] uppercase font-medium">EPS Est.</th>
              <th className="text-right py-2.5 px-3.5 text-[11px] tracking-widest text-[var(--color-text-muted)] uppercase font-medium">EPS Actual</th>
              <th className="text-right py-2.5 px-3.5 text-[11px] tracking-widest text-[var(--color-text-muted)] uppercase font-medium">Surprise %</th>
              <th className="text-right py-2.5 px-3.5 text-[11px] tracking-widest text-[var(--color-text-muted)] uppercase font-medium">Period</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const beat = e.surprisePercent != null ? e.surprisePercent > 0 : null;
              return (
                <tr key={i} className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <td className="py-2.5 px-3.5 text-[var(--color-text-primary)]">Q{e.quarter} {e.year}</td>
                  <td className="py-2.5 px-3.5 text-right text-[var(--color-text-secondary)]">{e.estimate != null ? fmtPrice(e.estimate) : '--'}</td>
                  <td className={`py-2.5 px-3.5 text-right font-semibold ${beat === true ? 'text-[var(--color-positive)]' : beat === false ? 'text-[var(--color-negative-text)]' : 'text-[var(--color-text-primary)]'}`}>
                    {e.actual != null ? fmtPrice(e.actual) : '--'}
                  </td>
                  <td className={`py-2.5 px-3.5 text-right ${beat === true ? 'text-[var(--color-positive)]' : beat === false ? 'text-[var(--color-negative-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {e.surprisePercent != null ? fmtPct(e.surprisePercent) : '--'}
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-[var(--color-text-muted)]">{e.period}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewsView({ news, analysisNews }: { news: TickerData['news']; analysisNews: StockAnalysis['newsHighlights'] }) {
  const items = news || [];
  const highlights = analysisNews || [];

  return (
    <div className="space-y-6">
      {/* AI-flagged headlines */}
      {highlights.length > 0 && (
        <div className="space-y-3">
          <div className={SECTION_LABEL}>AI-Flagged Headlines</div>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-[var(--color-border-subtle)]">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sentimentDot(h.sentiment)}`} />
                <div className="flex-1 min-w-0">
                  {h.url ? (
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-[15px] text-[var(--color-text-primary)] hover:text-[var(--color-gold)] transition-colors leading-snug">
                      {h.headline}
                    </a>
                  ) : (
                    <span className="text-[15px] text-[var(--color-text-primary)] leading-snug">{h.headline}</span>
                  )}
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">{h.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full news feed */}
      <div className="space-y-3">
        <div className={SECTION_LABEL}>Recent News</div>
        {items.length === 0 ? (
          <div className="text-[14px] text-[var(--color-text-muted)] font-mono py-4 text-center">No recent news.</div>
        ) : (
          <div className="space-y-1">
            {items.slice(0, 20).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)] transition-colors rounded-md px-2 -mx-2 group"
              >
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[var(--color-text-muted)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors leading-snug">{item.headline}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[var(--color-text-muted)]">
                    <span>{item.source}</span>
                    <span className="text-[var(--color-border-strong)]">|</span>
                    <span>{relativeTime(item.datetime)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AIAnalysisView({ analysis }: { analysis: StockAnalysis }) {
  return (
    <div className="space-y-6">
      {/* Bull case */}
      <div className="border border-[var(--color-positive)]/30 rounded-lg overflow-hidden">
        <div className="bg-[var(--color-positive)]/10 px-5 py-2.5 border-b border-[var(--color-positive)]/20">
          <span className="font-mono text-[12px] tracking-[0.14em] text-[var(--color-positive)] uppercase font-bold">▲ Bull Case</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed m-0">{analysis.bullCase}</p>
        </div>
      </div>

      {/* Bear case */}
      <div className="border border-[var(--color-negative)]/30 rounded-lg overflow-hidden">
        <div className="bg-[var(--color-negative)]/10 px-5 py-2.5 border-b border-[var(--color-negative)]/20">
          <span className="font-mono text-[12px] tracking-[0.14em] text-[var(--color-negative-text)] uppercase font-bold">▼ Bear Case</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed m-0">{analysis.bearCase}</p>
        </div>
      </div>

      {/* AI Metrics grid */}
      {analysis.metrics.length > 0 && (
        <div className="space-y-3">
          <div className={SECTION_LABEL}>AI-Extracted Metrics</div>
          <div className={`${CARD} overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`}>
            {analysis.metrics.map((m: AnalysisMetric, i: number) => (
              <div key={i} className="px-3.5 py-3 border-r border-b border-[var(--color-border-subtle)]">
                <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--color-text-muted)] mb-1.5">{m.label}</div>
                <div className="font-mono text-[16px] tabular-nums font-bold text-[var(--color-text-primary)]">{m.value}</div>
                {m.change && (
                  <div className={`font-mono text-[11px] mt-0.5 ${m.change.startsWith('-') ? 'text-[var(--color-negative-text)]' : 'text-[var(--color-positive)]'}`}>{m.change}</div>
                )}
                {m.context && <div className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{m.context}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compare View ──

function CompareView({ currentTicker, currentData, currentAnalysis, basePath }: {
  currentTicker: string;
  currentData: TickerData;
  currentAnalysis: StockAnalysis;
  basePath: string;
}) {
  const [compareTicker, setCompareTicker] = useState('');
  const [compareData, setCompareData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCompare = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = compareTicker.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!symbol || symbol === currentTicker) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/market/ticker-data?symbol=${symbol}`);
      if (!res.ok) { setError(res.status === 404 ? `${symbol} not found` : 'Failed to load'); return; }
      setCompareData(await res.json());
    } catch { setError('Network error'); } finally { setLoading(false); }
  }, [compareTicker, currentTicker]);

  const SUGGESTIONS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'].filter(t => t !== currentTicker);

  // Metric row helper
  const row = (label: string, aVal: string, bVal: string, highlight?: 'higher' | 'lower') => {
    const aNum = parseFloat(aVal.replace(/[^0-9.\-]/g, ''));
    const bNum = parseFloat(bVal.replace(/[^0-9.\-]/g, ''));
    const aWins = highlight === 'higher' ? aNum > bNum : highlight === 'lower' ? aNum < bNum : false;
    const bWins = highlight === 'higher' ? bNum > aNum : highlight === 'lower' ? bNum < aNum : false;
    return (
      <tr key={label} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)] transition-colors">
        <td className="py-2.5 px-3.5 text-[13px] font-mono text-[var(--color-text-muted)]">{label}</td>
        <td className={`py-2.5 px-3.5 text-right text-[14px] font-mono tabular-nums font-semibold ${aWins ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-primary)]'}`}>{aVal}</td>
        <td className={`py-2.5 px-3.5 text-right text-[14px] font-mono tabular-nums font-semibold ${bWins ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-primary)]'}`}>{bVal}</td>
      </tr>
    );
  };

  if (!compareData) {
    return (
      <div className="space-y-5">
        <div className={SECTION_LABEL}>Compare {currentTicker} against</div>
        <form onSubmit={handleCompare} className="flex gap-2 max-w-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text" value={compareTicker} onChange={(e) => setCompareTicker(e.target.value.toUpperCase())}
              placeholder="Enter ticker" maxLength={5} disabled={loading}
              className="w-full pl-8 pr-2 py-2.5 bg-[var(--color-bg-inset)] border border-[var(--color-border-base)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-[13px] tracking-wider font-mono tabular-nums"
            />
          </div>
          <button type="submit" disabled={!compareTicker.trim() || loading}
            className="px-4 py-2.5 bg-[var(--color-gold)] hover:brightness-[1.08] text-[var(--color-text-inverse)] font-semibold rounded-md transition-all text-[12px] disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Compare'}
          </button>
        </form>
        {error && <div className="text-[13px] text-[var(--color-negative-text)] font-mono">{error}</div>}
        <div className="flex flex-wrap gap-2 pt-2">
          {SUGGESTIONS.slice(0, 6).map(t => (
            <button key={t} onClick={() => { setCompareTicker(t); }}
              className="px-3 py-2.5 sm:py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-md text-[11px] font-mono font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold-border)] transition-colors">
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Side-by-side comparison
  const a = currentData;
  const b = compareData;
  const am = a.financials?.metric || {} as Record<string, number>;
  const bm = b.financials?.metric || {} as Record<string, number>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className={SECTION_LABEL}>
          {currentTicker} vs {compareData.symbol}
        </div>
        <button onClick={() => { setCompareData(null); setCompareTicker(''); }}
          className="text-[12px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors">
          Change ticker
        </button>
      </div>

      {/* Company cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
        <div className={`${CARD} p-3.5 sm:p-4`}>
          <div className="text-[16px] sm:text-[18px] font-mono font-bold text-[var(--color-gold)] tabular-nums">{currentTicker}</div>
          <div className="text-[12px] sm:text-[13px] text-[var(--color-text-secondary)] mt-0.5 truncate">{currentAnalysis.companyName}</div>
          <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1 truncate">{a.profile?.industry || '--'}</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-2">
            <span className="text-[16px] sm:text-[20px] font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">{fmtPrice(a.quote?.c)}</span>
            <span className={`text-[11px] sm:text-[13px] font-mono tabular-nums ${changeColor(a.quote?.dp)}`}>{fmtPct(a.quote?.dp)}</span>
          </div>
        </div>
        <div className={`${CARD} p-3.5 sm:p-4`}>
          <div className="text-[16px] sm:text-[18px] font-mono font-bold text-[var(--color-text-primary)] tabular-nums">{b.symbol}</div>
          <div className="text-[12px] sm:text-[13px] text-[var(--color-text-secondary)] mt-0.5 truncate">{b.profile?.name || b.symbol}</div>
          <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1 truncate">{b.profile?.industry || '--'}</div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-2">
            <span className="text-[16px] sm:text-[20px] font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">{fmtPrice(b.quote?.c)}</span>
            <span className={`text-[11px] sm:text-[13px] font-mono tabular-nums ${changeColor(b.quote?.dp)}`}>{fmtPct(b.quote?.dp)}</span>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
              <th className="text-left py-2.5 px-3.5 text-[11px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase font-medium w-1/3">Metric</th>
              <th className="text-right py-2.5 px-3.5 text-[11px] font-mono tracking-widest text-[var(--color-gold)] uppercase font-semibold w-1/3">{currentTicker}</th>
              <th className="text-right py-2.5 px-3.5 text-[11px] font-mono tracking-widest text-[var(--color-text-secondary)] uppercase font-semibold w-1/3">{b.symbol}</th>
            </tr>
          </thead>
          <tbody>
            {row('Market Cap', a.profile?.marketCapitalization != null ? fmtCompact(a.profile.marketCapitalization * 1e6) : '--', b.profile?.marketCapitalization != null ? fmtCompact(b.profile.marketCapitalization * 1e6) : '--', 'higher')}
            {row('P/E Ratio', am.peBasicExclExtraTTM != null ? fmt(am.peBasicExclExtraTTM) : '--', bm.peBasicExclExtraTTM != null ? fmt(bm.peBasicExclExtraTTM) : '--', 'lower')}
            {row('EPS (TTM)', am.epsBasicExclExtraTTM != null ? fmtPrice(am.epsBasicExclExtraTTM) : '--', bm.epsBasicExclExtraTTM != null ? fmtPrice(bm.epsBasicExclExtraTTM) : '--', 'higher')}
            {row('Revenue/Share', am.revenuePerShareTTM != null ? fmtPrice(am.revenuePerShareTTM) : '--', bm.revenuePerShareTTM != null ? fmtPrice(bm.revenuePerShareTTM) : '--', 'higher')}
            {row('Gross Margin', am.grossMarginTTM != null ? `${fmt(am.grossMarginTTM)}%` : '--', bm.grossMarginTTM != null ? `${fmt(bm.grossMarginTTM)}%` : '--', 'higher')}
            {row('Operating Margin', am.operatingMarginTTM != null ? `${fmt(am.operatingMarginTTM)}%` : '--', bm.operatingMarginTTM != null ? `${fmt(bm.operatingMarginTTM)}%` : '--', 'higher')}
            {row('Net Margin', am.netProfitMarginTTM != null ? `${fmt(am.netProfitMarginTTM)}%` : '--', bm.netProfitMarginTTM != null ? `${fmt(bm.netProfitMarginTTM)}%` : '--', 'higher')}
            {row('ROE', am.roeTTM != null ? `${fmt(am.roeTTM)}%` : '--', bm.roeTTM != null ? `${fmt(bm.roeTTM)}%` : '--', 'higher')}
            {row('Debt/Equity', am.totalDebtToEquityQuarterly != null ? fmt(am.totalDebtToEquityQuarterly) : (am['totalDebt/totalEquityQuarterly'] != null ? fmt(am['totalDebt/totalEquityQuarterly']) : '--'), bm.totalDebtToEquityQuarterly != null ? fmt(bm.totalDebtToEquityQuarterly) : (bm['totalDebt/totalEquityQuarterly'] != null ? fmt(bm['totalDebt/totalEquityQuarterly']) : '--'), 'lower')}
            {row('Current Ratio', am.currentRatioQuarterly != null ? fmt(am.currentRatioQuarterly) : '--', bm.currentRatioQuarterly != null ? fmt(bm.currentRatioQuarterly) : '--', 'higher')}
            {row('Dividend Yield', am.dividendYieldIndicatedAnnual != null ? `${fmt(am.dividendYieldIndicatedAnnual)}%` : '--', bm.dividendYieldIndicatedAnnual != null ? `${fmt(bm.dividendYieldIndicatedAnnual)}%` : '--', 'higher')}
            {row('Beta', am.beta != null ? fmt(am.beta) : '--', bm.beta != null ? fmt(bm.beta) : '--')}
            {row('52W High', am['52WeekHigh'] != null ? fmtPrice(am['52WeekHigh']) : '--', bm['52WeekHigh'] != null ? fmtPrice(bm['52WeekHigh']) : '--')}
            {row('52W Low', am['52WeekLow'] != null ? fmtPrice(am['52WeekLow']) : '--', bm['52WeekLow'] != null ? fmtPrice(bm['52WeekLow']) : '--')}
            {row('Day Change', fmtPct(a.quote?.dp), fmtPct(b.quote?.dp), 'higher')}
          </tbody>
        </table>
      </div>

      {/* Analyst consensus side by side */}
      {(a.recommendations?.[0] || b.recommendations?.[0]) && (
        <div className="space-y-3">
          <div className={SECTION_LABEL}>Analyst Consensus</div>
          <div className="grid grid-cols-2 gap-3.5">
            {[{ ticker: currentTicker, rec: a.recommendations?.[0] }, { ticker: b.symbol, rec: b.recommendations?.[0] }].map(({ ticker: t, rec }) => {
              if (!rec) return <div key={t} className="text-[13px] text-[var(--color-text-muted)] font-mono py-4 text-center">No data</div>;
              const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
              if (total === 0) return null;
              return (
                <div key={t} className={`${CARD} p-3.5 space-y-2`}>
                  <div className="text-[12px] font-mono tracking-wider text-[var(--color-text-muted)]">{t}</div>
                  <div className="flex h-3 rounded-sm overflow-hidden bg-[var(--color-bg-inset)]">
                    {rec.strongBuy > 0 && <div style={{ width: `${(rec.strongBuy / total) * 100}%`, backgroundColor: 'var(--color-positive)' }} />}
                    {rec.buy > 0 && <div style={{ width: `${(rec.buy / total) * 100}%`, backgroundColor: 'var(--color-positive)', opacity: 0.6 }} />}
                    {rec.hold > 0 && <div style={{ width: `${(rec.hold / total) * 100}%`, backgroundColor: 'var(--color-text-muted)', opacity: 0.4 }} />}
                    {rec.sell > 0 && <div style={{ width: `${(rec.sell / total) * 100}%`, backgroundColor: 'var(--color-negative-text)', opacity: 0.6 }} />}
                    {rec.strongSell > 0 && <div style={{ width: `${(rec.strongSell / total) * 100}%`, backgroundColor: 'var(--color-negative-text)' }} />}
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-positive)]">Buy {rec.strongBuy + rec.buy}</span>
                    <span>Hold {rec.hold}</span>
                    <span className="text-[var(--color-negative-text)]">Sell {rec.sell + rec.strongSell}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Right Pane: Sidebar ──

function RightSidebar({
  analysis,
  tickerData,
  computedAt,
  dataSources,
  methodologyVersion,
  isDashboard = false,
}: {
  analysis: StockAnalysis;
  tickerData: TickerData;
  computedAt: string;
  dataSources: string[];
  methodologyVersion: string;
  isDashboard?: boolean;
}) {
  const { recommendations } = tickerData;
  const verdictLabel = analysis.verdict.toUpperCase();
  const latestRec = recommendations?.[0];

  // Analyst ratings bar
  const totalRatings = latestRec ? latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell : 0;

  return (
    <div className="space-y-5">
      {/* AI Verdict */}
      <div className="border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.025] rounded-lg px-4 py-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-gold)]">✦ Helm Verdict</span>
          <span className="flex-1 h-px bg-[var(--color-gold)]/[0.12]" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-sm border text-[13px] font-mono font-bold tracking-wider ${verdictBg(analysis.verdict)}`}>
            {verdictLabel}
          </span>
        </div>
        <p className="text-[14.5px] text-[var(--color-text-primary)] leading-[1.55] m-0">{analysis.recommendation}</p>
      </div>

      {/* Quick metrics */}
      {analysis.metrics.length > 0 && (
        <div className="space-y-2">
          <div className={SECTION_LABEL}>Quick Metrics</div>
          <div className="space-y-1.5">
            {analysis.metrics.slice(0, isDashboard ? 6 : 4).map((m: AnalysisMetric, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                <span className="text-[13px] font-mono text-[var(--color-text-muted)]">{m.label}</span>
                <span className="text-[15px] font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyst Ratings */}
      {latestRec && totalRatings > 0 && (
        <div className="space-y-2">
          <div className={SECTION_LABEL}>Analyst Consensus</div>
          <div className="space-y-2">
            {/* Stacked bar */}
            <div className="flex h-4 rounded-sm overflow-hidden bg-[var(--color-bg-inset)]">
              {latestRec.strongBuy > 0 && <div style={{ width: `${(latestRec.strongBuy / totalRatings) * 100}%`, backgroundColor: 'var(--color-positive)' }} />}
              {latestRec.buy > 0 && <div style={{ width: `${(latestRec.buy / totalRatings) * 100}%`, backgroundColor: 'var(--color-positive)', opacity: 0.6 }} />}
              {latestRec.hold > 0 && <div style={{ width: `${(latestRec.hold / totalRatings) * 100}%`, backgroundColor: 'var(--color-text-muted)', opacity: 0.4 }} />}
              {latestRec.sell > 0 && <div style={{ width: `${(latestRec.sell / totalRatings) * 100}%`, backgroundColor: 'var(--color-negative-text)', opacity: 0.6 }} />}
              {latestRec.strongSell > 0 && <div style={{ width: `${(latestRec.strongSell / totalRatings) * 100}%`, backgroundColor: 'var(--color-negative-text)' }} />}
            </div>
            {/* Labels */}
            <div className="flex justify-between text-[13px] font-mono text-[var(--color-text-muted)]">
              <span className="text-[var(--color-positive)]">Buy {latestRec.strongBuy + latestRec.buy}</span>
              <span>Hold {latestRec.hold}</span>
              <span className="text-[var(--color-negative-text)]">Sell {latestRec.sell + latestRec.strongSell}</span>
            </div>
          </div>
        </div>
      )}

      {/* Earnings date */}
      {(() => {
        const now = new Date();
        const upcoming = tickerData.earnings?.find(e => new Date(e.period) > now);
        const entry = upcoming || tickerData.earnings?.[0];
        if (!entry) return null;
        const isFuture = new Date(entry.period) > now;
        return (
          <div className="space-y-2">
            <div className={SECTION_LABEL}>{isFuture ? 'Next Earnings' : 'Last Earnings'}</div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-gold)]" />
              <span className="text-[15px] font-mono font-semibold text-[var(--color-text-primary)]">
                {new Date(entry.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Data provenance — "No black boxes" */}
      <div className="space-y-1.5 pt-3 border-t border-[var(--color-border-subtle)]">
        <div className={SECTION_LABEL}>Data Sources</div>
        <div className="space-y-1 pt-0.5">
          {dataSources.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] shrink-0" />
              <span className="text-[12px] font-mono text-[var(--color-text-secondary)]">{s}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-text-muted)] pt-1.5">
          <span>v{methodologyVersion}</span>
          <span>{new Date(computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div className="text-[11px] font-mono text-[var(--color-text-muted)] leading-relaxed pt-0.5">
          No black boxes. Every figure is sourced and timestamped.
        </div>
      </div>
    </div>
  );
}

// ── Share Bar ──

function ShareBar({ ticker, analysis }: { ticker: string; analysis: StockAnalysis }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = `https://helmterminal.dev/analyze/${ticker}`;
  const utmUrl = (medium: string) => `${baseUrl}?utm_source=${medium}&utm_medium=social&utm_campaign=analysis_share&utm_content=${ticker}`;
  const shareText = `$${ticker} (${analysis.companyName})\n\n${analysis.summary}\n\nFull AI analysis:`;

  const shareOnX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(utmUrl('twitter'))}`, '_blank');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`$${ticker} ${analysis.companyName}\n\n${analysis.summary}\n\n${baseUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const btnClass = "flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-md text-[11px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button onClick={shareOnX} className={btnClass} aria-label={`Share ${ticker} analysis on X`}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className="hidden sm:inline">Share</span>
      </button>
      <button onClick={copyLink} className={btnClass} aria-label="Copy analysis link">
        {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-positive)]" /> : <Link2 className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}

// ── Main Export ──

export function AnalysisTerminal({ analysis, tickerData, ticker, computedAt, dataSources, methodologyVersion, variant = 'public' }: AnalysisTerminalProps) {
  const isDashboard = variant === 'dashboard';
  const analyzePath = isDashboard ? '/dashboard/analyze' : '/analyze';
  const [activeFunction, setActiveFunction] = useState<FunctionKey>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { quote } = tickerData;

  const handleFunctionSelect = useCallback((key: FunctionKey) => {
    setActiveFunction(key);
    setMobileMenuOpen(false);
  }, []);

  const centerContent = useMemo(() => {
    switch (activeFunction) {
      case 'overview':
        return <OverviewView analysis={analysis} tickerData={tickerData} computedAt={computedAt} dataSources={dataSources} methodologyVersion={methodologyVersion} />;
      case 'fundamentals':
        return <FundamentalsView tickerData={tickerData} profile={tickerData.profile} />;
      case 'earnings':
        return <EarningsView earnings={tickerData.earnings} />;
      case 'news':
        return <NewsView news={tickerData.news} analysisNews={analysis.newsHighlights} />;
      case 'ai-analysis':
        return <AIAnalysisView analysis={analysis} />;
      case 'compare':
        return <CompareView currentTicker={ticker} currentData={tickerData} currentAnalysis={analysis} basePath={analyzePath} />;
      default:
        return <OverviewView analysis={analysis} tickerData={tickerData} computedAt={computedAt} dataSources={dataSources} methodologyVersion={methodologyVersion} />;
    }
  }, [activeFunction, analysis, tickerData, computedAt, dataSources, methodologyVersion, analyzePath, ticker]);

  return (
    <div className="space-y-0 animate-fade-in text-[15px]">
      {/* Command bar */}
      <div className="flex items-center justify-between py-3 px-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-t-lg">
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 -ml-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[20px] font-mono font-bold text-[var(--color-gold)] tabular-nums tracking-tight">{ticker}</span>
            <span className="text-[15px] text-[var(--color-text-secondary)] hidden sm:inline">{analysis.companyName}</span>
          </div>
          <div className="hidden sm:block">
            <InlineSearch currentTicker={ticker} basePath={analyzePath} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ShareBar ticker={ticker} analysis={analysis} />
          <div className="flex items-center gap-1.5 sm:gap-3 font-mono tabular-nums text-[14px] sm:text-[16px]">
            <span className="text-[var(--color-text-primary)] font-semibold">{fmtPrice(quote?.c)}</span>
            <span className={`hidden sm:inline ${changeColor(quote?.dp)}`}>{fmtPct(quote?.dp)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-text-muted)] tracking-[0.1em]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] animate-pulse" />
            <span className="hidden sm:inline">LIVE</span>
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="sm:hidden px-4 py-2 bg-[var(--color-bg-surface)] border-x border-[var(--color-border-base)]">
        <InlineSearch currentTicker={ticker} basePath={analyzePath} />
      </div>

      {/* 3-pane grid */}
      <div className={`grid grid-cols-1 border border-t-0 border-[var(--color-border-base)] rounded-b-lg overflow-hidden lg:min-h-[600px] ${isDashboard ? 'lg:grid-cols-[240px_1fr_300px]' : 'lg:grid-cols-[260px_1fr_340px]'}`}>
        {/* LEFT PANE */}
        {/* Desktop: always visible. Mobile: toggle */}
        <aside className={`bg-[var(--color-bg-base)] border-r border-[var(--color-border-subtle)] py-3 ${mobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="sticky top-0">
            <div className="px-3 pb-2 mb-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-[9px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Functions</span>
            </div>
            <FunctionTree active={activeFunction} onSelect={handleFunctionSelect} />

            {/* Related tickers */}
            <div className="px-3 pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
              <div className="text-[9px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase mb-2">Quick Access</div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_TICKERS.filter((t) => t !== ticker).slice(0, 6).map((t) => (
                  <a
                    key={t}
                    href={`${analyzePath}/${t}`}
                    className="px-3 py-2 sm:px-2 sm:py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-[11px] sm:text-[10px] font-mono font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold-border)] transition-colors"
                  >
                    {t}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANE */}
        <main className="bg-[var(--color-bg-base)] p-3.5 sm:p-6 overflow-y-auto">
          {centerContent}

          {/* CTA — public only */}
          {!isDashboard && (
            <div className="mt-8 border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.025] rounded-lg p-6 text-center space-y-2.5">
              <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                Want AI analysis of your entire portfolio?
              </p>
              <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
                Helm Terminal connects to your brokerage, analyzes every holding, and delivers actionable intelligence weekly. Free to start. Pro unlocks the full terminal at $20/mo.
              </p>
              <a
                href="/signup"
                className="inline-block px-6 py-2.5 bg-[var(--color-gold)] hover:brightness-[1.08] text-[var(--color-text-inverse)] text-[14px] font-semibold rounded-md transition-all"
              >
                Get started free
              </a>
            </div>
          )}

          {/* Headlines in center pane — both variants */}
          {tickerData.news && tickerData.news.length > 0 && (
            <div className="mt-8 space-y-4">
              <div className={SECTION_LABEL}>Recent Headlines</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {tickerData.news.slice(0, 8).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 py-3 px-3.5 border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-gold)]/20 transition-colors group"
                  >
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[var(--color-text-muted)]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors leading-snug line-clamp-2">{item.headline}</div>
                      <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1">{item.source} · {relativeTime(item.datetime)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <FinancialDisclaimer />
          </div>
        </main>

        {/* RIGHT PANE — hidden on mobile, data already in center OverviewView */}
        <aside className="hidden lg:block bg-[var(--color-bg-base)] border-l border-[var(--color-border-subtle)] p-4 overflow-y-auto">
          <div className="sticky top-0">
            <RightSidebar
              analysis={analysis}
              tickerData={tickerData}
              computedAt={computedAt}
              dataSources={dataSources}
              methodologyVersion={methodologyVersion}
              isDashboard={isDashboard}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
