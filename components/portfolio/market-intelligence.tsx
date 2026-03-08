'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Holding } from '@/types';

interface MarketNewsItem {
  id: string;
  type: 'news';
  title: string;
  description: string;
  source: string;
  url?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tickers: string[];
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

const impactColors = {
  high: 'text-[var(--color-negative)]',
  medium: 'text-[var(--color-warning)]',
  low: 'text-[var(--color-text-muted)]',
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
  const [intelligence, setIntelligence] = useState<MarketIntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-gold)]" />
            Market Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-gold)]" />
            Market Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-[var(--color-negative)] mb-2" />
            <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-gold)]" />
            <CardTitle>Market Intelligence</CardTitle>
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
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
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

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-md border transition-all duration-200 cursor-pointer",
                  isExpanded
                    ? "border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                    : cn(
                        "hover:border-[var(--color-border-strong)]",
                        isNews ? sentimentStyle.bg : "bg-[var(--color-bg-surface)]",
                        isNews ? sentimentStyle.border : "border-[var(--color-border-base)]"
                      )
                )}
                onClick={() => toggleExpand(item.id)}
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
                    <div className="mt-3 space-y-2">
                      {/* Tickers/Sectors for news */}
                      {isNews && (newsItem.tickers.length > 0 || newsItem.sectors.length > 0) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {newsItem.tickers.slice(0, 5).map(ticker => (
                            <Badge key={ticker} variant="outline" className="text-[9px]">
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

                      {/* Event metadata */}
                      {!isNews && Object.keys(eventItem.metadata).length > 0 && (
                        <div className="p-2 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(eventItem.metadata).slice(0, 4).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-[var(--color-text-muted)] capitalize">
                                  {key.replace(/_/g, ' ')}:
                                </span>{' '}
                                <span className="text-[var(--color-text-primary)]">
                                  {typeof value === 'number'
                                    ? value.toLocaleString()
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* View Source for news */}
                      {isNews && newsItem.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
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
      </CardContent>
    </Card>
  );
}
