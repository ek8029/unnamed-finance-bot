'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CreditCard,
  DollarSign,
  Repeat,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  RefreshCw,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';

interface ActionItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action?: string;
  estimated_impact?: number;
  source: string;
  created_at: string;
}

interface RecurringItem {
  id: string;
  merchant: string;
  amount: number;
  frequency: string;
  category: string | null;
  lastDate: string;
  nextExpected: string;
  occurrences: number;
}

interface RecurringSummary {
  count: number;
  monthlyTotal: number;
  annualTotal: number;
}

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const priorityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const typeIcons: Record<string, typeof TrendingUp> = {
  spending: TrendingDown,
  portfolio: TrendingUp,
  tax: DollarSign,
  credit: CreditCard,
  market: AlertTriangle,
};

export default function ActionsPage() {
  const { formatCurrency } = useFormat();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [recurringSummary, setRecurringSummary] = useState<RecurringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [detectingRecurring, setDetectingRecurring] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [insightsRes, recurringRes] = await Promise.all([
        fetch('/api/insights'),
        fetch('/api/recurring'),
      ]);

      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setActions(
          (data.insights || []).sort(
            (a: ActionItem, b: ActionItem) =>
              (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
          )
        );
      }

      if (recurringRes.ok) {
        const data = await recurringRes.json();
        setRecurring(data.recurring || []);
        setRecurringSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch actions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch('/api/insights/generate', { method: 'POST' });
      await fetchData();
    } finally {
      setGenerating(false);
    }
  };

  const handleDetectRecurring = async () => {
    setDetectingRecurring(true);
    try {
      await fetch('/api/recurring', { method: 'POST' });
      await fetchData();
    } finally {
      setDetectingRecurring(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setDismissing(prev => new Set(prev).add(id));
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'dismiss' }),
      });
      setActions(prev => prev.filter(a => a.id !== id));
    } finally {
      setDismissing(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleUseful = async (id: string, useful: boolean) => {
    await fetch('/api/insights', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: useful ? 'useful' : 'not_useful' }),
    });
  };

  const totalImpact = actions.reduce((s, a) => s + (a.estimated_impact || 0), 0);
  const criticalCount = actions.filter(a => a.priority === 'critical' || a.priority === 'high').length;

  if (loading) {
    return (
      <div className="container mx-auto card-padding max-w-[1200px]">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-neutral-800 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-neutral-800 rounded-xl" />)}
          </div>
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-neutral-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto card-padding max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="type-h1">Actions Inbox</h1>
          <p className="type-body text-[var(--color-text-secondary)]">
            Prioritized actions based on your financial data
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDetectRecurring}
            disabled={detectingRecurring}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors disabled:opacity-50"
          >
            {detectingRecurring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
            Detect Subscriptions
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-gold)] hover:brightness-110 text-black rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Analyze Now
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Active Actions</p>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-tabular">{actions.length}</p>
          {criticalCount > 0 && (
            <p className="text-xs text-orange-400 mt-1">{criticalCount} high priority</p>
          )}
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Potential Impact</p>
          <p className="text-2xl font-semibold text-[var(--color-positive)] font-tabular">
            {totalImpact > 0 ? formatCurrency(totalImpact) : '--'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">estimated savings</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Recurring Charges</p>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-tabular">
            {recurringSummary ? formatCurrency(recurringSummary.monthlyTotal) : '--'}
            <span className="text-sm text-[var(--color-text-muted)] font-normal">/mo</span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {recurringSummary ? `${recurringSummary.count} subscriptions detected` : 'Run detection to see'}
          </p>
        </div>
      </div>

      {/* Actions List */}
      {actions.length === 0 && recurring.length === 0 ? (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-12 text-center">
          <Lightbulb className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No actions yet</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-6">
            Click &quot;Analyze Now&quot; to scan your financial data for actionable insights, or &quot;Detect Subscriptions&quot; to find recurring charges.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Action Items */}
          {actions.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Insights & Actions
              </h2>
              {actions.map(action => {
                const Icon = typeIcons[action.type] || Lightbulb;
                const isExpanded = expandedId === action.id;
                const isDismissing = dismissing.has(action.id);

                return (
                  <div
                    key={action.id}
                    className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : action.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--color-bg-overlay)] transition-colors"
                    >
                      <div className={`p-2 rounded-lg border ${priorityColors[action.priority] || priorityColors.medium}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{action.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase ${priorityColors[action.priority]}`}>
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{action.description}</p>
                      </div>
                      {action.estimated_impact && action.estimated_impact > 0 && (
                        <span className="text-sm font-semibold text-[var(--color-positive)] font-tabular whitespace-nowrap">
                          {formatCurrency(action.estimated_impact)}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[var(--color-border-base)] p-4 bg-[var(--color-bg-overlay)]">
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">{action.description}</p>
                        {action.recommended_action && (
                          <div className="flex items-start gap-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-3 mb-3">
                            <ArrowRight className="w-4 h-4 text-[var(--color-gold)] mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-[var(--color-text-primary)]">{action.recommended_action}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => handleUseful(action.id, true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-positive)] bg-emerald-500/5 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors"
                          >
                            <Check className="w-3 h-3" /> Useful
                          </button>
                          <button
                            onClick={() => handleDismiss(action.id)}
                            disabled={isDismissing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors disabled:opacity-50"
                          >
                            {isDismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            Dismiss
                          </button>
                          <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                            {action.source === 'rule_based' ? 'Rule-based' : action.source} &middot; {new Date(action.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Recurring Transactions */}
          {recurring.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mt-8 mb-2">
                Detected Subscriptions & Recurring
              </h2>
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border-base)]">
                      <th className="text-left text-xs font-medium text-[var(--color-text-muted)] p-3">Merchant</th>
                      <th className="text-left text-xs font-medium text-[var(--color-text-muted)] p-3">Frequency</th>
                      <th className="text-left text-xs font-medium text-[var(--color-text-muted)] p-3">Category</th>
                      <th className="text-right text-xs font-medium text-[var(--color-text-muted)] p-3">Amount</th>
                      <th className="text-right text-xs font-medium text-[var(--color-text-muted)] p-3">Monthly Cost</th>
                      <th className="text-right text-xs font-medium text-[var(--color-text-muted)] p-3">Next Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map(r => (
                      <tr key={r.id} className="border-b border-[var(--color-border-base)] last:border-0 hover:bg-[var(--color-bg-overlay)] transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Repeat className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                            <span className="text-sm text-[var(--color-text-primary)]">{r.merchant}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-[var(--color-text-muted)] capitalize">{r.frequency}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-[var(--color-text-muted)]">{formatCategory(r.category)}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-sm text-[var(--color-text-primary)] font-tabular">
                            {formatCurrency(r.amount)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-sm text-[var(--color-text-secondary)] font-tabular">
                            {formatCurrency(toMonthly(r.amount, r.frequency))}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {new Date(r.nextExpected).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recurringSummary && (
                <div className="text-right text-xs text-[var(--color-text-muted)] mt-2">
                  Total: {formatCurrency(recurringSummary.monthlyTotal)}/month &middot; {formatCurrency(recurringSummary.annualTotal)}/year
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatCategory(raw: string | null): string {
  if (!raw) return '--';
  return raw
    .replace(/_/g, ' ')
    .replace(/AND/g, '&')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount * 4.33;
    case 'biweekly': return amount * 2.17;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'annual': return amount / 12;
    default: return amount;
  }
}
