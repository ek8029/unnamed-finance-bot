'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Insight, InsightType } from '@/types';
import { useState } from 'react';
import {
  Lightbulb,
  TrendingUp,
  ShoppingCart,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronUp,
  X,
  ThumbsUp,
} from 'lucide-react';

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

const insightColors: Record<InsightType, { bg: string; text: string; badge: 'default' | 'secondary' | 'success' | 'warning' }> = {
  spending: { bg: 'bg-blue-50', text: 'text-blue-600', badge: 'default' },
  portfolio: { bg: 'bg-purple-50', text: 'text-purple-600', badge: 'secondary' },
  market: { bg: 'bg-yellow-50', text: 'text-yellow-600', badge: 'warning' },
  tax: { bg: 'bg-green-50', text: 'text-green-600', badge: 'success' },
  credit: { bg: 'bg-red-50', text: 'text-red-600', badge: 'warning' },
};

export function AIInsightsFeed({ insights: initialInsights }: AIInsightsFeedProps) {
  const [insights, setInsights] = useState(initialInsights);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedInsights(newExpanded);
  };

  const dismissInsight = (id: string) => {
    setInsights(insights.filter((insight) => insight.id !== id));
  };

  const markUseful = (id: string) => {
    setInsights(
      insights.map((insight) =>
        insight.id === id ? { ...insight, is_useful: true } : insight
      )
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight) => {
            const Icon = insightIcons[insight.type];
            const colors = insightColors[insight.type];
            const isExpanded = expandedInsights.has(insight.id);

            return (
              <div
                key={insight.id}
                className="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`rounded-full p-2 ${colors.bg}`}>
                      <Icon className={`h-4 w-4 ${colors.text}`} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                        <Badge variant={colors.badge} className="capitalize">
                          {insight.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{insight.description}</p>
                      {isExpanded && insight.recommended_action && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-1">
                            Recommended Action
                          </div>
                          <p className="text-sm text-gray-600">{insight.recommended_action}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleExpand(insight.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Show More
                            </>
                          )}
                        </Button>
                        {!insight.is_useful && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markUseful(insight.id)}
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Useful
                          </Button>
                        )}
                        {insight.is_useful && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            Marked as useful
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissInsight(insight.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {insights.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No insights available at the moment.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
