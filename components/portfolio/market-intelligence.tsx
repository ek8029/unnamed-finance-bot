'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
  Newspaper,
  Calendar,
  DollarSign,
  Building2,
  Globe,
  ChevronRight,
  ExternalLink,
  Loader2,
  Zap,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Holding } from '@/types';
import { useFormat } from '@/hooks/use-format';

interface MarketNewsItem {
  id: string;
  type: 'news';
  title: string;
  description: string;
  source: string;
  url?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tickers: string[];
  /** Article's actual subject — computed server-side via detectPrimaryTicker.
   *  Use this (not tickers) for portfolio-relevance checks to avoid matching
   *  on tangentially-mentioned tickers from Polygon's full tag array. */
  primaryTicker?: string | null;
  sectors: string[];
  publishedAt: string;
  relevance: string;
}

interface MarketEventItem {
  id: string;
  type: 'earnings' | 'dividend' | 'split' | 'merger' | 'ipo' | 'macro' | 'fed_announcement';
  title: string;
  description: string;
  ticker?: string;
  eventDate: string;
  impactLevel: 'high' | 'medium' | 'low';
  metadata: Record<string, unknown>;
  relevance: string;
}

type MarketIntelligenceItem = (MarketNewsItem | MarketEventItem) & {
  category: 'news' | 'event';
};

interface MarketIntelligenceProps {
  holdings?: Holding[];
  className?: string;
}

const sentimentConfig = {
  positive: {
    icon: TrendingUp,
    iconColor: 'text-[var(--color-positive)]',
    bg: 'bg-[var(--color-positive)]/5',
    border: 'border-[var(--color-positive)]/20',
    badge: 'success' as const,
  },
  negative: {
    icon: TrendingDown,
    iconColor: 'text-[var(--color-negative)]',
    bg: 'bg-[var(--color-negative)]/5',
    border: 'border-[var(--color-negative)]/20',
    badge: 'warning' as const,
  },
  neutral: {
    icon: Activity,
    iconColor: 'text-[var(--color-text-secondary)]',
    bg: 'bg-[var(--color-bg-elevated)]',
    border: 'border-[var(--color-border-base)]',
    badge: 'default' as const,
  },
};

const eventTypeConfig = {
  earnings: { icon: Building2, label: 'Earnings', color: 'text-[var(--color-gold)]' },
  dividend: { icon: DollarSign, label: 'Dividend', color: 'text-[var(--color-positive)]' },
  split: { icon: Activity, label: 'Split', color: 'text-[var(--color-warning)]' },
  merger: { icon: Building2, label: 'M&A', color: 'text-[var(--color-warning)]' },
  ipo: { icon: TrendingUp, label: 'IPO', color: 'text-[var(--color-gold)]' },
  macro: { icon: Globe, label: 'Macro', color: 'text-[var(--color-text-secondary)]' },
  fed_announcement: { icon: AlertCircle, label: 'Fed', color: 'text-[var(--color-warning)]' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MarketIntelligence({ holdings = [], className }: MarketIntelligenceProps) {
  const { formatCurrencyDetailed, formatNumber } = useFormat();
  const [intelligence, setIntelligence] = useState<MarketIntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Build a ticker → holding lookup for fast linkage
  const holdingsMap = useMemo(() => {
    const map = new Map<string, Holding>();
    for (const h of holdings) {
      map.set(h.ticker.toUpperCase(), h);
    }
    return map;
  }, [holdings]);

  const totalPortfolioValue = useMemo(
    () => holdings.reduce((sum, h) => sum + h.total_value, 0),
    [holdings],
  );

  const fetchIntelligence = async () => {
    try {
      const tickers = holdings.map(h => h.ticker).join(',');
      const url = tickers
        ? `/api/market/intelligence?tickers=${encodeURIComponent(tickers)}`
        : '/api/market/intelligence';

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch market intelligence');

      const data = await res.json();
      setIntelligence(data.intelligence || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching market intelligence:', err);
      setError('Failed to load market intelligence');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [holdings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIntelligence();
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // ── Expanded-content helpers ──

  /** For news: find which of the user's holdings are mentioned */
  function getAffectedHoldings(tickers: string[]): Holding[] {
    return tickers
      .map(t => holdingsMap.get(t.toUpperCase()))
      .filter((h): h is Holding => !!h);
  }

  /** For events: find the user's holding for the event ticker */
  function getEventHolding(ticker?: string): Holding | undefined {
    if (!ticker) return undefined;
    return holdingsMap.get(ticker.toUpperCase());
  }

  // ── Render helpers ──

  function renderNewsExposure(newsItem: MarketNewsItem) {
    const affected = getAffectedHoldings(newsItem.tickers);
    if (affected.length === 0) return null;

    const totalExposure = affected.reduce((sum, h) => sum + h.total_value, 0);
    const exposurePct = totalPortfolioValue > 0 ? (totalExposure / totalPortfolioValue) * 100 : 0;

    return (
      <div className="mt-3 p-2.5 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Wallet className="h-3 w-3 text-[var(--color-gold)]" />
          <span className="type-eyebrow text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            Portfolio Exposure
          </span>
        </div>
        <div className="space-y-1.5">
          {affected.map(h => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="type-mono font-semibold text-[var(--color-text-primary)]">
                  {h.ticker}
                </span>
                <span className="text-[var(--color-text-muted)] truncate text-[11px]">
                  {h.asset_name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="type-mono text-[var(--color-text-primary)]">
                  {formatCurrencyDetailed(h.total_value)}
                </span>
                <span className="type-mono text-[10px] text-[var(--color-text-muted)]">
                  {h.portfolio_allocation.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Total Exposure</span>
          <div className="flex items-center gap-2">
            <span className="type-mono font-medium text-[var(--color-text-primary)]">
              {formatCurrencyDetailed(totalExposure)}
            </span>
            <span className="type-mono text-[10px] text-[var(--color-gold)]">
              {exposurePct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderDividendDetails(eventItem: MarketEventItem) {
    const holding = getEventHolding(eventItem.ticker);
    const cashAmount = eventItem.metadata?.cash_amount as number | undefined;
    const payDate = eventItem.metadata?.pay_date as string | undefined;
    const frequency = eventItem.metadata?.frequency as number | undefined;

    const freqLabel = (f?: number) => {
      if (f === 4) return 'Quarterly';
      if (f === 12) return 'Monthly';
      if (f === 2) return 'Semi-Annual';
      if (f === 1) return 'Annual';
      return '';
    };

    const estimatedPayout = holding && cashAmount ? holding.shares * cashAmount : null;
    const annualizedIncome = estimatedPayout && frequency ? estimatedPayout * frequency : null;

    return (
      <div className="mt-3 p-2.5 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
        <div className="flex items-center gap-1.5 mb-2">
          <DollarSign className="h-3 w-3 text-[var(--color-positive)]" />
          <span className="type-eyebrow text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            Dividend Details
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {cashAmount != null && (
            <div>
              <span className="text-[var(--color-text-muted)] block text-[10px]">Per Share</span>
              <span className="type-mono text-[var(--color-text-primary)]">
                ${cashAmount.toFixed(4)}
              </span>
            </div>
          )}
          {frequency != null && (
            <div>
              <span className="text-[var(--color-text-muted)] block text-[10px]">Frequency</span>
              <span className="type-mono text-[var(--color-text-primary)]">
                {freqLabel(frequency)}
              </span>
            </div>
          )}
          <div>
            <span className="text-[var(--color-text-muted)] block text-[10px]">Ex-Dividend</span>
            <span className="type-mono text-[var(--color-text-primary)]">
              {new Date(eventItem.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {payDate && (
            <div>
              <span className="text-[var(--color-text-muted)] block text-[10px]">Pay Date</span>
              <span className="type-mono text-[var(--color-text-primary)]">
                {new Date(payDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
        </div>

        {holding && (
          <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-3 w-3 text-[var(--color-gold)]" />
              <span className="type-eyebrow text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Your Position
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-[var(--color-text-muted)] block text-[10px]">Shares Held</span>
                <span className="type-mono text-[var(--color-text-primary)]">
                  {formatNumber(holding.shares)}
                </span>
              </div>
              {estimatedPayout != null && (
                <div>
                  <span className="text-[var(--color-text-muted)] block text-[10px]">Est. Payout</span>
                  <span className="type-mono font-medium text-[var(--color-positive)]">
                    {formatCurrencyDetailed(estimatedPayout)}
                  </span>
                </div>
              )}
            </div>
            {annualizedIncome != null && (
              <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                Annualized income: <span className="type-mono text-[var(--color-positive)]">{formatCurrencyDetailed(annualizedIncome)}</span>/yr
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderSplitDetails(eventItem: MarketEventItem) {
    const holding = getEventHolding(eventItem.ticker);
    const splitFrom = eventItem.metadata?.split_from as number | undefined;
    const splitTo = eventItem.metadata?.split_to as number | undefined;
    const ratio = splitFrom && splitTo ? splitTo / splitFrom : null;

    return (
      <div className="mt-3 p-2.5 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3 w-3 text-[var(--color-warning)]" />
          <span className="type-eyebrow text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            Split Details
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {ratio != null && (
            <div>
              <span className="text-[var(--color-text-muted)] block text-[10px]">Ratio</span>
              <span className="type-mono text-[var(--color-text-primary)]">
                {splitTo}-for-{splitFrom}
              </span>
            </div>
          )}
          <div>
            <span className="text-[var(--color-text-muted)] block text-[10px]">Execution</span>
            <span className="type-mono text-[var(--color-text-primary)]">
              {new Date(eventItem.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {holding && ratio != null && (
          <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-3 w-3 text-[var(--color-gold)]" />
              <span className="type-eyebrow text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Your Position
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-[var(--color-text-muted)] block text-[10px]">Current Shares</span>
                <span className="type-mono text-[var(--color-text-primary)]">
                  {formatNumber(holding.shares)}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] block text-[10px]">After Split</span>
                <span className="type-mono font-medium text-[var(--color-text-primary)]">
                  {formatNumber(holding.shares * ratio)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderGenericEventMeta(eventItem: MarketEventItem) {
    const holding = getEventHolding(eventItem.ticker);
    const metaEntries = Object.entries(eventItem.metadata).filter(
      ([k]) => !['cash_amount', 'currency', 'pay_date', 'record_date', 'declaration_date', 'frequency', 'dividend_type', 'split_from', 'split_to', 'ratio'].includes(k)
    );

    return (
      <>
        {metaEntries.length > 0 && (
          <div className="mt-3 p-2 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {metaEntries.slice(0, 4).map(([key, value]) => (
                <div key={key}>
                  <span className="text-[var(--color-text-muted)] capitalize text-[10px]">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="type-mono text-[var(--color-text-primary)] block">
                    {typeof value === 'number'
                      ? value.toLocaleString()
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {holding && (
          <div className="mt-2 p-2 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-3 w-3 text-[var(--color-gold)]" />
              <span className="type-eyebrow text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                Your Position
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="type-mono font-semibold text-[var(--color-text-primary)]">{holding.ticker}</span>
                <span className="text-[var(--color-text-muted)] text-[11px]">{holding.asset_name}</span>
              </div>
              <span className="type-mono text-[var(--color-text-primary)]">{formatCurrencyDetailed(holding.total_value)}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  if (loading) {
    return (
      <div className={cn("bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg overflow-hidden", className)}>
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border-base)]">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-gold)]" />
            <h2 className="type-h3 text-[var(--color-text-primary)]">Market Intelligence</h2>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg overflow-hidden", className)}>
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border-base)]">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-gold)]" />
            <h2 className="type-h3 text-[var(--color-text-primary)]">Market Intelligence</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-[var(--color-negative)] mb-2" />
          <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border-base)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-gold)]" />
            <h2 className="type-h3 text-[var(--color-text-primary)]">Market Intelligence</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gold" className="text-xs">
              {intelligence.length} Updates
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
        <p className="type-eyebrow text-[var(--color-text-muted)] mt-1">Real-time news & events linked to your positions</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-3 space-y-2">
          {intelligence.map((item) => {
            const isExpanded = expandedId === item.id;
            const isNews = item.category === 'news';
            const newsItem = item as MarketNewsItem;
            const eventItem = item as MarketEventItem;

            // Get styling based on type
            const sentimentStyle = isNews
              ? sentimentConfig[newsItem.sentiment] || sentimentConfig.neutral
              : sentimentConfig.neutral;

            const eventConfig = !isNews
              ? eventTypeConfig[eventItem.type] || eventTypeConfig.macro
              : null;

            const Icon = isNews ? Newspaper : (eventConfig?.icon || Calendar);
            const iconColor = isNews
              ? sentimentStyle.iconColor
              : eventConfig?.color || 'text-[var(--color-text-muted)]';

            // Check if this item affects any of our holdings. For news, use
            // primaryTicker (the article's actual subject) — NOT the full
            // tickers array, which would match tangentially-tagged articles
            // like "Is Spotify a buy?" to AAPL holders.
            const hasPortfolioLink = isNews
              ? !!(newsItem.primaryTicker && holdingsMap.has(newsItem.primaryTicker.toUpperCase()))
              : !!holdingsMap.get(eventItem.ticker?.toUpperCase() ?? '');

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                className={cn(
                  "rounded-md border transition-colors duration-200 cursor-pointer",
                  isExpanded
                    ? "border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                    : cn(
                        "hover:border-[var(--color-border-strong)]",
                        isNews ? sentimentStyle.bg : "bg-[var(--color-bg-surface)]",
                        isNews ? sentimentStyle.border : "border-[var(--color-border-base)]"
                      )
                )}
                onClick={() => toggleExpand(item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(item.id); } }}
              >
                <div className="p-3">
                  {/* Header Row */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={cn(
                      "rounded-md p-1.5 flex-shrink-0 border",
                      isNews
                        ? cn(sentimentStyle.bg, sentimentStyle.border)
                        : "bg-[var(--color-bg-elevated)] border-[var(--color-border-base)]"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className={cn(
                          "type-label text-[var(--color-text-primary)] leading-tight",
                          !isExpanded && "line-clamp-2"
                        )}>
                          {item.title}
                        </h4>
                        <ChevronRight className={cn(
                          "h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)] transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isNews ? (
                          <>
                            <Badge variant={sentimentStyle.badge} className="text-[9px] px-1.5 py-0 capitalize">
                              {newsItem.sentiment}
                            </Badge>
                            <span className="type-eyebrow text-[var(--color-text-muted)]">
                              {newsItem.source}
                            </span>
                            {hasPortfolioLink && (
                              <Badge variant="gold" className="text-[9px] px-1.5 py-0">
                                In Portfolio
                              </Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <Badge
                              variant={eventItem.impactLevel === 'high' ? 'warning' : 'default'}
                              className="text-[9px] px-1.5 py-0"
                            >
                              {eventConfig?.label || eventItem.type}
                            </Badge>
                            {eventItem.ticker && (
                              <Badge variant="gold" className="text-[9px] px-1.5 py-0">
                                {eventItem.ticker}
                              </Badge>
                            )}
                            {hasPortfolioLink && !eventItem.ticker && (
                              <Badge variant="gold" className="text-[9px] px-1.5 py-0">
                                In Portfolio
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className={cn(
                    "type-body text-xs text-[var(--color-text-secondary)] leading-relaxed",
                    !isExpanded && "line-clamp-2"
                  )}>
                    {item.description}
                  </p>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="space-y-0">
                      {/* Portfolio linkage - the key enhancement */}
                      {isNews && renderNewsExposure(newsItem)}

                      {!isNews && eventItem.type === 'dividend' && renderDividendDetails(eventItem)}

                      {!isNews && eventItem.type === 'split' && renderSplitDetails(eventItem)}

                      {!isNews && eventItem.type !== 'dividend' && eventItem.type !== 'split' && renderGenericEventMeta(eventItem)}

                      {/* Remaining tickers/sectors badges for news */}
                      {isNews && (newsItem.tickers.length > 0 || newsItem.sectors.length > 0) && (
                        <div className="flex items-center gap-2 flex-wrap mt-3">
                          {newsItem.tickers.slice(0, 5).map(ticker => (
                            <Badge
                              key={ticker}
                              variant={holdingsMap.has(ticker.toUpperCase()) ? 'gold' : 'outline'}
                              className="text-[9px]"
                            >
                              {ticker}
                            </Badge>
                          ))}
                          {newsItem.sectors.slice(0, 2).map(sector => (
                            <Badge key={sector} variant="secondary" className="text-[9px]">
                              {sector}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* View Source for news */}
                      {isNews && newsItem.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(newsItem.url, '_blank');
                          }}
                        >
                          Read Full Article
                          <ExternalLink className="h-3 w-3 ml-1.5" />
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Footer: Timestamp/Date & Relevance */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <Badge
                      variant={item.relevance === 'Your Holdings' ? 'gold' : 'secondary'}
                      className="text-[9px] px-1.5 py-0"
                    >
                      {item.relevance}
                    </Badge>
                    <span className="type-eyebrow text-[var(--color-text-muted)]">
                      {isNews
                        ? formatRelativeTime(newsItem.publishedAt)
                        : formatEventDate(eventItem.eventDate)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {intelligence.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <Newspaper className="h-8 w-8 mx-auto mb-2 text-[var(--color-text-muted)]" />
              <p className="type-body text-xs">No market intelligence available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
