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
  spending: { bg: 'bg-helm-elevated', text: 'text-helm-platinum', badge: 'default' },
  portfolio: { bg: 'bg-helm-gold-surface', text: 'text-helm-gold', badge: 'gold' },
  market: { bg: 'bg-helm-elevated', text: 'text-helm-warning', badge: 'warning' },
  tax: { bg: 'bg-helm-elevated', text: 'text-helm-positive', badge: 'success' },
  credit: { bg: 'bg-helm-elevated', text: 'text-helm-negative', badge: 'warning' },
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
    <div className="h-full flex flex-col bg-helm-surface border-l border-helm-border-base">
      {/* Sidebar Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-helm-border-base">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-helm-gold" />
          <h2 className="type-h3 text-helm-platinum">Intelligence Feed</h2>
        </div>
        <p className="type-caption text-helm-secondary mt-0.5">AI-powered insights</p>
      </div>

      {/* Scrollable Insights List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-3 space-y-2">
          {insights.map((insight) => {
            const Icon = insightIcons[insight.type];
            const colors = insightColors[insight.type];
            const isExpanded = expandedId === insight.id;

            return (
              <div
                key={insight.id}
                className={cn(
                  "rounded-md border transition-all cursor-pointer",
                  isExpanded
                    ? "border-helm-border-strong bg-helm-elevated"
                    : "border-helm-border-base bg-helm-surface hover:bg-helm-overlay hover:border-helm-border-strong"
                )}
                onClick={() => toggleExpand(insight.id)}
              >
                <div className="p-3">
                  {/* Header */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`rounded p-1 ${colors.bg} border border-helm-border-subtle flex-shrink-0`}>
                      <Icon className={`h-3 w-3 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="type-label text-xs text-helm-platinum leading-tight truncate">
                          {insight.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissInsight(insight.id);
                          }}
                          className="flex-shrink-0 text-helm-muted hover:text-helm-platinum transition-colors"
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
                    "text-xs text-helm-secondary leading-relaxed",
                    !isExpanded && "line-clamp-2"
                  )}>
                    {insight.description}
                  </p>

                  {/* Expanded Content */}
                  {isExpanded && insight.recommended_action && (
                    <>
                      <div className="mt-2 p-2 bg-helm-overlay rounded border border-helm-border-subtle">
                        <div className="type-caption text-helm-gold mb-1">
                          Recommended Action
                        </div>
                        <p className="text-xs text-helm-secondary leading-relaxed">
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
                  <div className="mt-2 type-caption text-helm-muted">
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
            <div className="text-center py-12 text-helm-secondary">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 text-helm-muted" />
              <p className="text-xs">No insights available</p>
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
              <div className="p-4 bg-helm-elevated rounded border border-helm-border-subtle">
                <p className="text-sm text-helm-secondary">
                  {drawerInsight.description}
                </p>
                {drawerInsight.recommended_action && (
                  <div className="mt-3 pt-3 border-t border-helm-border-subtle">
                    <div className="type-caption text-helm-gold mb-1">Recommended Action</div>
                    <p className="text-sm text-helm-gold">{drawerInsight.recommended_action}</p>
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
