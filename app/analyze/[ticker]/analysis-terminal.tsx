'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { StockAnalysis, AnalysisMetric } from '@/components/analysis/types';
import type { TickerData } from '@/lib/financial-data';
import { Search, Loader2, Link2, Check, ChevronRight, Menu, X } from 'lucide-react';
import { FinancialDisclaimer } from '@/components/financial-disclaimer';

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
}

// ── Constants ──

const FUNCTIONS: FunctionItem[] = [
  { key: 'overview', label: 'OVERVIEW' },
  { key: 'fundamentals', label: 'FUNDAMENTALS', children: ['Income', 'Balance', 'Cash Flow'] },
  { key: 'earnings', label: 'EARNINGS', children: ['History'] },
  { key: 'news', label: 'NEWS', children: ['Recent', 'Sentiment'] },
  { key: 'ai-analysis', label: 'AI ANALYSIS', children: ['Bull', 'Bear'] },
  { key: 'compare', label: 'COMPARE', badge: 'SOON' },
  { key: 'options', label: 'OPTIONS', badge: 'PRO' },
];

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];

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
  return n > 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]';
}

function sentimentDot(s: string): string {
  if (s === 'positive') return 'bg-[var(--color-positive)]';
  if (s === 'negative') return 'bg-[var(--color-negative)]';
  return 'bg-[var(--color-text-muted)]';
}

function verdictBg(v: string): string {
  if (v === 'bullish') return 'bg-[var(--color-positive)]/15 text-[var(--color-positive)] border-[var(--color-positive)]/30';
  if (v === 'bearish') return 'bg-[var(--color-negative)]/15 text-[var(--color-negative)] border-[var(--color-negative)]/30';
  return 'bg-[var(--color-gold)]/15 text-[var(--color-gold)] border-[var(--color-gold)]/30';
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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xs">
      <div className="flex-1 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-muted)]" aria-hidden="true" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Ticker"
          maxLength={5}
          disabled={loading}
          aria-label="Stock ticker symbol"
          className="w-full pl-7 pr-2 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors text-[12px] tracking-wider font-mono tabular-nums disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={!input.trim() || input.trim().toUpperCase() === currentTicker || loading}
        className="px-3 py-1.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-sm transition-colors text-[11px] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : 'GO'}
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
              className={`w-full text-left px-3 py-2 text-[11px] tracking-widest font-mono transition-colors flex items-center justify-between group border-l-2 ${
                isActive
                  ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/5'
                  : isDisabled
                    ? 'border-transparent text-[var(--color-text-muted)]/50 cursor-not-allowed'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]'
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
                <ChevronRight className={`w-3 h-3 transition-opacity ${isActive ? 'opacity-100 text-[var(--color-gold)]' : 'opacity-0 group-hover:opacity-50'}`} />
              )}
            </button>
            {isActive && fn.children && (
              <div className="ml-5 border-l border-[var(--color-border-subtle)] pl-3 py-1 space-y-0.5">
                {fn.children.map((child) => (
                  <div key={child} className="text-[10px] font-mono tracking-wider text-[var(--color-text-muted)] py-0.5">
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

// ── Metric Cell ──

function MetricCell({ label, value, context }: { label: string; value: string; context?: string }) {
  return (
    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-sm p-3 space-y-1">
      <div className="text-[10px] font-mono tracking-wider text-[var(--color-text-muted)] uppercase">{label}</div>
      <div className="text-[18px] font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">{value}</div>
      {context && <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{context}</div>}
    </div>
  );
}

// ── Center Pane Views ──

function OverviewView({ analysis, tickerData }: { analysis: StockAnalysis; tickerData: TickerData }) {
  const { quote, profile, financials } = tickerData;
  const m = financials?.metric || {};
  const verdictLabel = analysis.verdict.charAt(0).toUpperCase() + analysis.verdict.slice(1);

  return (
    <div className="space-y-6">
      {/* Company header */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[28px] font-mono font-bold text-[var(--color-gold)] tabular-nums tracking-tight">{analysis.ticker}</span>
          <span className="text-[16px] text-[var(--color-text-primary)] font-medium">{analysis.companyName}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono tracking-wider text-[var(--color-text-muted)]">
          {profile?.exchange && <span>{profile.exchange}</span>}
          {profile?.exchange && profile?.finnhubIndustry && <span className="text-[var(--color-border-strong)]">|</span>}
          {profile?.finnhubIndustry && <span>{profile.finnhubIndustry}</span>}
        </div>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCell label="Price" value={fmtPrice(quote?.c)} />
        <MetricCell label="Day Change" value={fmtPct(quote?.dp)} context={quote?.d != null ? `${quote.d >= 0 ? '+' : ''}${fmt(quote.d)}` : undefined} />
        <MetricCell label="Market Cap" value={profile?.marketCapitalization != null ? fmtCompact(profile.marketCapitalization * 1e6) : '--'} />
        <MetricCell label="P/E Ratio" value={m.peBasicExclExtraTTM != null ? fmt(m.peBasicExclExtraTTM) : '--'} />
        <MetricCell label="52W Range" value={m['52WeekLow'] != null && m['52WeekHigh'] != null ? `${fmt(m['52WeekLow'])} - ${fmt(m['52WeekHigh'])}` : '--'} />
      </div>

      {/* AI Verdict */}
      <div className="flex items-start gap-4">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-sm border text-[12px] font-mono font-bold tracking-wider ${verdictBg(analysis.verdict)}`}>
          {verdictLabel.toUpperCase()}
        </span>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed flex-1">{analysis.summary}</p>
      </div>

      {/* Recommendation box */}
      <div className="border-l-2 border-[var(--color-gold)] bg-[var(--color-gold)]/5 rounded-r-sm px-4 py-3">
        <div className="text-[10px] font-mono tracking-widest text-[var(--color-gold)] mb-1 uppercase">Recommendation</div>
        <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">{analysis.recommendation}</p>
      </div>
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

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Key Financial Metrics</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {cells.map((c) => (
          <MetricCell key={c.label} label={c.label} value={c.value} context={c.context} />
        ))}
      </div>
    </div>
  );
}

function EarningsView({ earnings }: { earnings: TickerData['earnings'] }) {
  const rows = (earnings || []).slice(0, 12);

  if (rows.length === 0) {
    return (
      <div className="text-[13px] text-[var(--color-text-muted)] font-mono py-8 text-center">
        No earnings data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Earnings History</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] font-mono tabular-nums">
          <thead>
            <tr className="border-b border-[var(--color-border-strong)]">
              <th className="text-left py-2 px-2 text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase font-normal">Quarter</th>
              <th className="text-right py-2 px-2 text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase font-normal">EPS Est.</th>
              <th className="text-right py-2 px-2 text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase font-normal">EPS Actual</th>
              <th className="text-right py-2 px-2 text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase font-normal">Surprise %</th>
              <th className="text-right py-2 px-2 text-[10px] tracking-widest text-[var(--color-text-muted)] uppercase font-normal">Period</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const beat = e.surprisePercent != null ? e.surprisePercent > 0 : null;
              return (
                <tr key={i} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <td className="py-2 px-2 text-[var(--color-text-primary)]">Q{e.quarter} {e.year}</td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">{e.estimate != null ? fmtPrice(e.estimate) : '--'}</td>
                  <td className={`py-2 px-2 text-right font-semibold ${beat === true ? 'text-[var(--color-positive)]' : beat === false ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-primary)]'}`}>
                    {e.actual != null ? fmtPrice(e.actual) : '--'}
                  </td>
                  <td className={`py-2 px-2 text-right ${beat === true ? 'text-[var(--color-positive)]' : beat === false ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {e.surprisePercent != null ? fmtPct(e.surprisePercent) : '--'}
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-muted)]">{e.period}</td>
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
          <div className="text-[11px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">AI-Flagged Headlines</div>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[var(--color-border-subtle)]">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sentimentDot(h.sentiment)}`} />
                <div className="flex-1 min-w-0">
                  {h.url ? (
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-gold)] transition-colors leading-snug">
                      {h.headline}
                    </a>
                  ) : (
                    <span className="text-[13px] text-[var(--color-text-primary)] leading-snug">{h.headline}</span>
                  )}
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">{h.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full news feed */}
      <div className="space-y-3">
        <div className="text-[11px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Recent News</div>
        {items.length === 0 ? (
          <div className="text-[13px] text-[var(--color-text-muted)] font-mono py-4 text-center">No recent news.</div>
        ) : (
          <div className="space-y-1">
            {items.slice(0, 20).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 py-2.5 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)] transition-colors rounded-sm px-2 -mx-2 group"
              >
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-[var(--color-text-muted)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors leading-snug">{item.headline}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-[var(--color-text-muted)]">
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
      <div className="border border-[var(--color-positive)]/30 rounded-sm overflow-hidden">
        <div className="bg-[var(--color-positive)]/10 px-4 py-2 border-b border-[var(--color-positive)]/20">
          <span className="text-[11px] font-mono tracking-widest text-[var(--color-positive)] uppercase font-semibold">Bull Case</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{analysis.bullCase}</p>
        </div>
      </div>

      {/* Bear case */}
      <div className="border border-[var(--color-negative)]/30 rounded-sm overflow-hidden">
        <div className="bg-[var(--color-negative)]/10 px-4 py-2 border-b border-[var(--color-negative)]/20">
          <span className="text-[11px] font-mono tracking-widest text-[var(--color-negative)] uppercase font-semibold">Bear Case</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{analysis.bearCase}</p>
        </div>
      </div>

      {/* AI Metrics grid */}
      {analysis.metrics.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">AI-Extracted Metrics</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {analysis.metrics.map((m: AnalysisMetric, i: number) => (
              <div key={i} className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-sm p-3 space-y-1">
                <div className="text-[10px] font-mono tracking-wider text-[var(--color-text-muted)] uppercase">{m.label}</div>
                <div className="text-[16px] font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">{m.value}</div>
                {m.change && (
                  <div className={`text-[10px] font-mono ${m.change.startsWith('-') ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive)]'}`}>{m.change}</div>
                )}
                {m.context && <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{m.context}</div>}
              </div>
            ))}
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
}: {
  analysis: StockAnalysis;
  tickerData: TickerData;
  computedAt: string;
  dataSources: string[];
  methodologyVersion: string;
}) {
  const { quote, recommendations, news } = tickerData;
  const verdictLabel = analysis.verdict.charAt(0).toUpperCase() + analysis.verdict.slice(1);
  const latestRec = recommendations?.[0];

  // Analyst ratings bar
  const totalRatings = latestRec ? latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell : 0;

  return (
    <div className="space-y-5">
      {/* AI Verdict */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">AI Verdict</div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-sm border text-[11px] font-mono font-bold tracking-wider ${verdictBg(analysis.verdict)}`}>
            {verdictLabel.toUpperCase()}
          </span>
        </div>
        <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">{analysis.recommendation}</p>
      </div>

      {/* Quick metrics */}
      {analysis.metrics.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Quick Metrics</div>
          <div className="space-y-1.5">
            {analysis.metrics.slice(0, 4).map((m: AnalysisMetric, i: number) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-[var(--color-border-subtle)]">
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{m.label}</span>
                <span className="text-[12px] font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyst Ratings */}
      {latestRec && totalRatings > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Analyst Consensus</div>
          <div className="space-y-2">
            {/* Stacked bar */}
            <div className="flex h-3 rounded-sm overflow-hidden bg-[var(--color-bg-elevated)]">
              {latestRec.strongBuy > 0 && <div className="bg-[var(--color-positive)]" style={{ width: `${(latestRec.strongBuy / totalRatings) * 100}%` }} />}
              {latestRec.buy > 0 && <div className="bg-[var(--color-positive)]/60" style={{ width: `${(latestRec.buy / totalRatings) * 100}%` }} />}
              {latestRec.hold > 0 && <div className="bg-[var(--color-text-muted)]/40" style={{ width: `${(latestRec.hold / totalRatings) * 100}%` }} />}
              {latestRec.sell > 0 && <div className="bg-[var(--color-negative)]/60" style={{ width: `${(latestRec.sell / totalRatings) * 100}%` }} />}
              {latestRec.strongSell > 0 && <div className="bg-[var(--color-negative)]" style={{ width: `${(latestRec.strongSell / totalRatings) * 100}%` }} />}
            </div>
            {/* Labels */}
            <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-muted)]">
              <span className="text-[var(--color-positive)]">Buy {latestRec.strongBuy + latestRec.buy}</span>
              <span>Hold {latestRec.hold}</span>
              <span className="text-[var(--color-negative)]">Sell {latestRec.sell + latestRec.strongSell}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent news */}
      {news && news.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Recent Headlines</div>
          <div className="space-y-1.5">
            {news.slice(0, 4).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 py-1.5 group"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-text-muted)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-gold)] transition-colors leading-snug line-clamp-2">{item.headline}</div>
                  <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-0.5">{item.source} {relativeTime(item.datetime)}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Data provenance */}
      <div className="space-y-1.5 pt-3 border-t border-[var(--color-border-subtle)]">
        <div className="text-[10px] font-mono tracking-widest text-[var(--color-text-muted)] uppercase">Data Sources</div>
        <div className="text-[10px] font-mono text-[var(--color-text-muted)] space-y-0.5">
          {dataSources.map((s, i) => <div key={i}>{s}</div>)}
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono text-[var(--color-text-muted)] pt-1">
          <span>v{methodologyVersion}</span>
          <span>{new Date(computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
  const verdictLabel = analysis.verdict.charAt(0).toUpperCase() + analysis.verdict.slice(1);
  const shareText = `$${ticker} (${analysis.companyName}) — ${verdictLabel}\n\n${analysis.recommendation}\n\nFull AI analysis:`;

  const shareOnX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(utmUrl('twitter'))}`, '_blank');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`$${ticker} — ${analysis.companyName}\nVerdict: ${verdictLabel}\n\n${analysis.summary}\n\n${baseUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const btnClass = "flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button onClick={shareOnX} className={btnClass} aria-label={`Share ${ticker} analysis on X`}>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share
      </button>
      <button onClick={copyLink} className={btnClass} aria-label="Copy analysis link">
        {copied ? <Check className="w-3 h-3 text-[var(--color-positive)]" /> : <Link2 className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ── Main Export ──

export function AnalysisTerminal({ analysis, tickerData, ticker, computedAt, dataSources, methodologyVersion }: AnalysisTerminalProps) {
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
        return <OverviewView analysis={analysis} tickerData={tickerData} />;
      case 'fundamentals':
        return <FundamentalsView tickerData={tickerData} profile={tickerData.profile} />;
      case 'earnings':
        return <EarningsView earnings={tickerData.earnings} />;
      case 'news':
        return <NewsView news={tickerData.news} analysisNews={analysis.newsHighlights} />;
      case 'ai-analysis':
        return <AIAnalysisView analysis={analysis} />;
      default:
        return <OverviewView analysis={analysis} tickerData={tickerData} />;
    }
  }, [activeFunction, analysis, tickerData]);

  return (
    <div className="space-y-0 animate-fade-in" style={{ zoom: 1.12 }}>
      {/* Command bar */}
      <div className="flex items-center justify-between py-3 px-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-t-sm">
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[16px] font-mono font-bold text-[var(--color-gold)] tabular-nums tracking-tight">{ticker}</span>
            <span className="text-[12px] text-[var(--color-text-secondary)] hidden sm:inline">{analysis.companyName}</span>
          </div>
          <div className="hidden sm:block">
            <InlineSearch currentTicker={ticker} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ShareBar ticker={ticker} analysis={analysis} />
          <div className="hidden sm:flex items-center gap-3 font-mono tabular-nums text-[12px]">
            <span className="text-[var(--color-text-primary)] font-semibold">{fmtPrice(quote?.c)}</span>
            <span className={changeColor(quote?.dp)}>{fmtPct(quote?.dp)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-text-muted)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] animate-pulse" />
            <span className="hidden sm:inline">LIVE</span>
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="sm:hidden px-4 py-2 bg-[var(--color-bg-elevated)] border-x border-[var(--color-border-base)]">
        <InlineSearch currentTicker={ticker} />
      </div>

      {/* 3-pane grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] border border-t-0 border-[var(--color-border-base)] rounded-b-sm overflow-hidden min-h-[600px]">
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
                    href={`/analyze/${t}`}
                    className="px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-sm text-[10px] font-mono font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold-border)] transition-colors"
                  >
                    {t}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANE */}
        <main className="bg-[var(--color-bg-base)] p-5 sm:p-6 overflow-y-auto">
          {centerContent}

          {/* CTA */}
          <div className="mt-8 border border-[var(--color-border-base)] rounded-sm p-5 text-center space-y-2.5 bg-[var(--color-bg-elevated)]">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              Want AI analysis of your entire portfolio?
            </p>
            <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
              Helm Terminal connects to your brokerage, analyzes every holding, and delivers actionable intelligence weekly.
            </p>
            <a
              href="/signup"
              className="inline-block px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[12px] font-semibold rounded-sm transition-colors"
            >
              Get started free
            </a>
          </div>

          <div className="mt-4">
            <FinancialDisclaimer />
          </div>
        </main>

        {/* RIGHT PANE */}
        <aside className="bg-[var(--color-bg-base)] border-l border-[var(--color-border-subtle)] p-4 overflow-y-auto">
          <div className="sticky top-0">
            <RightSidebar
              analysis={analysis}
              tickerData={tickerData}
              computedAt={computedAt}
              dataSources={dataSources}
              methodologyVersion={methodologyVersion}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
