'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle, Activity, Newspaper, ChevronDown, ChevronUp } from 'lucide-react';
import { useFormat } from '@/hooks/use-format';

interface MarketUpdate {
  id: string;
  type: 'news' | 'alert' | 'trend' | 'analysis';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  relevance: string; // Which holding/sector this affects
}

interface MarketIntelligenceProps {
  updates?: MarketUpdate[];
}

const mockMarketUpdates: MarketUpdate[] = [
  {
    id: '1',
    type: 'news',
    title: 'Tech Sector Rally Continues',
    description: 'Major technology stocks showing strength amid positive earnings reports and AI investment momentum.',
    impact: 'positive',
    timestamp: new Date('2024-03-08T10:30:00'),
    relevance: 'Technology Holdings',
  },
  {
    id: '2',
    type: 'alert',
    title: 'Federal Reserve Minutes Released',
    description: 'Fed signals potential rate stability, supporting growth stocks and reducing volatility concerns.',
    impact: 'positive',
    timestamp: new Date('2024-03-08T09:15:00'),
    relevance: 'Overall Portfolio',
  },
  {
    id: '3',
    type: 'trend',
    title: 'Cryptocurrency Market Consolidation',
    description: 'Bitcoin and Ethereum showing sideways movement as market awaits regulatory clarity.',
    impact: 'neutral',
    timestamp: new Date('2024-03-08T08:00:00'),
    relevance: 'Crypto Holdings',
  },
  {
    id: '4',
    type: 'analysis',
    title: 'S&P 500 Technical Levels',
    description: 'Index approaching key resistance at 5,200. Break above could trigger further upside momentum.',
    impact: 'positive',
    timestamp: new Date('2024-03-07T16:00:00'),
    relevance: 'Diversified ETF',
  },
];

const impactColors = {
  positive: {
    icon: TrendingUp,
    iconColor: 'text-[var(--color-positive)]',
    bg: 'bg-[var(--color-positive)]/10',
    border: 'border-[var(--color-positive)]/30',
    badge: 'success' as const,
  },
  negative: {
    icon: TrendingDown,
    iconColor: 'text-[var(--color-negative)]',
    bg: 'bg-[var(--color-negative)]/10',
    border: 'border-[var(--color-negative)]/30',
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

const typeIcons = {
  news: Newspaper,
  alert: AlertCircle,
  trend: Activity,
  analysis: TrendingUp,
};

export function MarketIntelligence({ updates = mockMarketUpdates }: MarketIntelligenceProps) {
  const { formatDate } = useFormat();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                Market Intelligence
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                )}
              </CardTitle>
              <CardDescription>Real-time insights affecting your portfolio</CardDescription>
            </div>
          </div>
          <Badge variant="gold" className="text-xs">
            {updates.length} Updates
          </Badge>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
        <div className="space-y-3">
          {updates.map((update) => {
            const impactStyle = impactColors[update.impact];
            const ImpactIcon = impactStyle.icon;
            const TypeIcon = typeIcons[update.type];

            return (
              <div
                key={update.id}
                className={`p-3 rounded-md border transition-all duration-200 hover:border-[var(--color-border-strong)] cursor-pointer ${impactStyle.bg} ${impactStyle.border}`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <TypeIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
                    </div>
                    <h4 className="type-h3 text-[var(--color-text-primary)] truncate">
                      {update.title}
                    </h4>
                  </div>
                  <ImpactIcon className={`h-4 w-4 flex-shrink-0 ${impactStyle.iconColor}`} />
                </div>

                {/* Description */}
                <p className="type-body text-xs text-[var(--color-text-secondary)] mb-2 leading-relaxed">
                  {update.description}
                </p>

                {/* Footer Row */}
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={impactStyle.badge} className="text-[9px] px-1.5 py-0">
                    {update.relevance}
                  </Badge>
                  <span className="type-eyebrow text-[var(--color-text-muted)]">
                    {formatDate(update.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        </CardContent>
      )}
    </Card>
  );
}
