'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Insight, InsightType } from '@/types';
import { useState } from 'react';
import {
  Lightbulb,
  TrendingUp,
  ShoppingCart,
  FileText,
  CreditCard,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockHoldings } from '@/lib/mock-data';
import { PortfolioInsightDrawer } from '@/components/drawers/portfolio-insight-drawer';
import { MarketInsightDrawer } from '@/components/drawers/market-insight-drawer';
import { TaxInsightDrawer } from '@/components/drawers/tax-insight-drawer';

interface AIInsightsFeedProps {
  insights: Insight[];
}

const insightIcons: Record<InsightType, React.ElementType> = {
  spending: ShoppingCart,
  portfolio: TrendingUp,
  market: Lightbulb,
  tax: FileText,
  credit: CreditCard,
};

const insightColors: Record<InsightType, { bg: string; text: string; badge: 'default' | 'secondary' | 'success' | 'warning' | 'gold' }> = {
  spending: { bg: 'bg-[var(--color-bg-elevated)]', text: 'text-[var(--color-text-primary)]', badge: 'default' },
  portfolio: { bg: 'bg-[var(--color-gold-surface)]', text: 'text-[var(--color-gold)]', badge: 'gold' },
  market: { bg: 'bg-[var(--color-bg-elevated)]', text: 'text-[var(--color-warning)]', badge: 'warning' },
  tax: { bg: 'bg-[var(--color-bg-elevated)]', text: 'text-[var(--color-positive)]', badge: 'success' },
  credit: { bg: 'bg-[var(--color-bg-elevated)]', text: 'text-[var(--color-negative)]', badge: 'warning' },
};

export function AIInsightsFeed({ insights: initialInsights }: AIInsightsFeedProps) {
  const [insights, setInsights] = useState(initialInsights);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerInsight, setDrawerInsight] = useState<Insight | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const dismissInsight = (id: string) => {
    setInsights(insights.filter((insight) => insight.id !== id));
  };

  const openDrawer = (insight: Insight) => {
    setDrawerInsight(insight);
  };

  const closeDrawer = () => {
    setDrawerInsight(null);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)]">
      {/* Sidebar Header — aligned with dashboard content */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border-base)]">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--color-gold)]" />
          <h2 className="type-h3 text-[var(--color-text-primary)]">Intelligence Feed</h2>
        </div>
        <p className="type-eyebrow text-[var(--color-text-muted)] mt-1">{insights.length} active insights</p>
      </div>

      {/* Scrollable Insights List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-3 space-y-2">
          {insights.map((insight, index) => {
            const Icon = insightIcons[insight.type];
            const colors = insightColors[insight.type];
            const isExpanded = expandedId === insight.id;

            return (
              <div
                key={insight.id}
                className={cn(
                  "rounded-md border transition-all duration-200 cursor-pointer",
                  isExpanded
                    ? "border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                    : "border-[var(--color-border-base)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-overlay)] hover:border-[var(--color-border-strong)]"
                )}
                style={{ animationDelay: `${index * 60}ms` }}
                onClick={() => toggleExpand(insight.id)}
              >
                <div className="p-3">
                  {/* Header */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`rounded-md p-1.5 ${colors.bg} border border-[var(--color-border-base)] flex-shrink-0`}>
                      <Icon className={`h-3 w-3 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="type-label text-[var(--color-text-primary)] leading-tight">
                          {insight.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissInsight(insight.id);
                          }}
                          className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <Badge variant={colors.badge} className="capitalize text-[9px] px-1.5 py-0">
                        {insight.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Description */}
                  <p className={cn(
                    "type-body text-xs text-[var(--color-text-secondary)] leading-relaxed",
                    !isExpanded && "line-clamp-2"
                  )}>
                    {insight.description}
                  </p>

                  {/* Expanded Content */}
                  {isExpanded && insight.recommended_action && (
                    <>
                      <div className="mt-2.5 p-2.5 bg-[var(--color-bg-overlay)] rounded-md border border-[var(--color-border-base)]">
                        <div className="type-eyebrow text-[var(--color-gold)] mb-1">
                          Recommended Action
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                          {insight.recommended_action}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDrawer(insight);
                        }}
                      >
                        View Details
                        <ArrowRight className="h-3 w-3 ml-1.5" />
                      </Button>
                    </>
                  )}

                  {/* Timestamp */}
                  <div className="mt-2 type-eyebrow text-[var(--color-text-muted)]">
                    {new Date(insight.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {insights.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 text-[var(--color-text-muted)]" />
              <p className="type-body text-xs">No insights available</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {drawerInsight && (
        <Drawer
          isOpen={!!drawerInsight}
          onClose={closeDrawer}
          title={drawerInsight.title}
          size="lg"
        >
          {drawerInsight.type === 'portfolio' && (
            <PortfolioInsightDrawer
              holdings={mockHoldings}
              insightDescription={drawerInsight.description}
            />
          )}

          {drawerInsight.type === 'market' && (
            <MarketInsightDrawer
              insightTitle={drawerInsight.title}
              insightDescription={drawerInsight.description}
              recommendedAction={drawerInsight.recommended_action || ''}
              affectedHoldings={mockHoldings.filter((h) =>
                drawerInsight.description.toLowerCase().includes(h.ticker.toLowerCase())
              )}
            />
          )}

          {drawerInsight.type === 'tax' && (
            <TaxInsightDrawer
              insightDescription={drawerInsight.description}
              recommendedAction={drawerInsight.recommended_action || ''}
              potentialSavings={2400}
              holdings={mockHoldings}
            />
          )}

          {(drawerInsight.type === 'spending' || drawerInsight.type === 'credit') && (
            <div className="p-6">
              <div className="p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
                <p className="type-body text-[var(--color-text-secondary)]">
                  {drawerInsight.description}
                </p>
                {drawerInsight.recommended_action && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border-base)]">
                    <div className="type-eyebrow text-[var(--color-gold)] mb-1">Recommended Action</div>
                    <p className="type-body text-[var(--color-gold)]">{drawerInsight.recommended_action}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
