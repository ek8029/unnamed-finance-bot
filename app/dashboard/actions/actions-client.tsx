'use client';

import { useState, useCallback } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CreditCard,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  RefreshCw,
  Lightbulb,
  ArrowRight,
  Clock,
  Archive,
  ThumbsDown,
  Filter,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';

export interface ActionItem {
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

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const priorityColors: Record<string, string> = {
  critical: 'bg-[var(--color-negative-muted)] text-[var(--color-negative-text)] border-[var(--color-negative-border)]',
  high: 'bg-[var(--color-warning-muted)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  medium: 'bg-[var(--color-warning-muted)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  low: 'bg-[var(--color-info-muted)] text-[var(--color-info-text)] border-[var(--color-info-border)]',
};

const typeIcons: Record<string, typeof TrendingUp> = {
  spending: TrendingDown,
  portfolio: TrendingUp,
  tax: DollarSign,
  credit: CreditCard,
  market: AlertTriangle,
};

const typeLabels: Record<string, string> = {
  spending: 'Spending',
  portfolio: 'Portfolio',
  tax: 'Tax',
  credit: 'Credit',
  market: 'Market',
};

export function ActionsClient({ initialActions }: { initialActions: ActionItem[] }) {
  const { formatCurrency } = useFormat();
  const [actions, setActions] = useState<ActionItem[]>(
    [...initialActions].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
  );
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [snoozing, setSnoozing] = useState<Set<string>>(new Set());

  // Filters
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const fetchFiltered = useCallback(async (type: string | null, priority: string | null, archived: boolean) => {
    try {
      setFilterLoading(true);
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (priority) params.set('priority', priority);
      if (archived) params.set('archived', 'true');

      const res = await fetch(`/api/insights?${params}`);
      if (res.ok) {
        const data = await res.json();
        setActions(
          (data.insights || []).sort(
            (a: ActionItem, b: ActionItem) =>
              (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
          )
        );
      }
    } catch (err) {
      console.error('Failed to fetch actions:', err);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  const handleFilterType = (type: string | null) => {
    setFilterType(type);
    fetchFiltered(type, filterPriority, showArchived);
  };

  const handleFilterPriority = (priority: string | null) => {
    setFilterPriority(priority);
    fetchFiltered(filterType, priority, showArchived);
  };

  const handleToggleArchived = () => {
    const next = !showArchived;
    setShowArchived(next);
    setFilterType(null);
    setFilterPriority(null);
    fetchFiltered(null, null, next);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch('/api/insights/generate', { method: 'POST' });
      await fetchFiltered(filterType, filterPriority, showArchived);
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    if (action === 'dismiss' || action === 'archive' || action === 'not_useful') {
      setDismissing(prev => new Set(prev).add(id));
    }
    if (action === 'snooze') {
      setSnoozing(prev => new Set(prev).add(id));
    }

    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });

      if (action === 'dismiss' || action === 'archive' || action === 'snooze' || action === 'not_useful') {
        setActions(prev => prev.filter(a => a.id !== id));
      }
      if (action === 'unarchive') {
        setActions(prev => prev.filter(a => a.id !== id));
      }
    } finally {
      setDismissing(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSnoozing(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setShowSnoozeMenu(null);
    }
  };

  const totalImpact = actions.reduce((s, a) => s + (a.estimated_impact || 0), 0);
  const criticalCount = actions.filter(a => a.priority === 'critical' || a.priority === 'high').length;
  const hasFilters = filterType || filterPriority;

  return (
    <div className="container mx-auto card-padding max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="type-h1">Actions Inbox</h1>
          <p className="type-body text-[var(--color-text-secondary)]">
            {showArchived ? 'Archived actions' : 'Prioritized actions based on your financial data'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleArchived}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showArchived
                ? 'bg-[var(--color-gold-surface)] border-[var(--color-gold-border)] text-[var(--color-gold)]'
                : 'bg-[var(--color-bg-surface)] border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
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
      {!showArchived && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Active Actions</p>
            <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-tabular">{actions.length}</p>
            {criticalCount > 0 && (
              <p className="text-xs text-[var(--color-warning-text)] mt-1">{criticalCount} high priority</p>
            )}
          </div>
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Potential Impact</p>
            <p className="text-2xl font-semibold text-[var(--color-positive)] font-tabular">
              {totalImpact > 0 ? formatCurrency(totalImpact) : '--'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">estimated savings</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        <button
          onClick={() => handleFilterType(null)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            !filterType
              ? 'bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-transparent'
          }`}
        >
          All Types
        </button>
        {['spending', 'portfolio', 'tax', 'credit', 'market'].map(type => (
          <button
            key={type}
            onClick={() => handleFilterType(filterType === type ? null : type)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterType === type
                ? 'bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-transparent'
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}

        <div className="w-px h-4 bg-[var(--color-border-base)] mx-1" />

        {['critical', 'high', 'medium', 'low'].map(p => (
          <button
            key={p}
            onClick={() => handleFilterPriority(filterPriority === p ? null : p)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase transition-colors border ${
              filterPriority === p
                ? priorityColors[p]
                : 'text-[var(--color-text-muted)] border-transparent hover:border-[var(--color-border-base)]'
            }`}
          >
            {p}
          </button>
        ))}

        {hasFilters && (
          <button
            onClick={() => { handleFilterType(null); setFilterPriority(null); fetchFiltered(null, null, showArchived); }}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ml-1"
          >
            Clear
          </button>
        )}

        {filterLoading && <Loader2 className="w-3 h-3 animate-spin text-[var(--color-text-muted)] ml-1" />}
      </div>

      {/* Actions List */}
      {actions.length === 0 ? (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-12 text-center">
          <Lightbulb className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            {showArchived ? 'No archived actions' : hasFilters ? 'No matching actions' : 'No actions yet'}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            {showArchived
              ? 'Archived actions will appear here.'
              : hasFilters
              ? 'Try adjusting your filters or click "Analyze Now" to generate new insights.'
              : 'Click "Analyze Now" to scan your financial data for actionable insights.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const Icon = typeIcons[action.type] || Lightbulb;
            const isExpanded = expandedId === action.id;
            const isDismissing = dismissing.has(action.id);
            const isSnoozing = snoozing.has(action.id);
            const showSnooze = showSnoozeMenu === action.id;

            return (
              <div
                key={action.id}
                className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl overflow-hidden transition-colors"
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{action.recommended_action || action.description}</p>
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
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {showArchived ? (
                        <button
                          onClick={() => handleAction(action.id, 'unarchive')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-gold)] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-lg hover:brightness-110 transition-colors"
                        >
                          <Archive className="w-3 h-3" /> Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(action.id, 'useful')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-positive)] bg-emerald-500/5 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors"
                          >
                            <Check className="w-3 h-3" /> Useful
                          </button>
                          <button
                            onClick={() => handleAction(action.id, 'not_useful')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors"
                          >
                            <ThumbsDown className="w-3 h-3" /> Not Useful
                          </button>

                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowSnoozeMenu(showSnooze ? null : action.id); }}
                              disabled={isSnoozing}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors disabled:opacity-50"
                            >
                              {isSnoozing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                              Snooze
                            </button>
                            {showSnooze && (
                              <div className="absolute bottom-full left-0 mb-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                                {[
                                  { label: '1 day', days: 1 },
                                  { label: '3 days', days: 3 },
                                  { label: '1 week', days: 7 },
                                  { label: '2 weeks', days: 14 },
                                  { label: '1 month', days: 30 },
                                ].map(opt => (
                                  <button
                                    key={opt.days}
                                    onClick={() => handleAction(action.id, 'snooze', { snooze_days: opt.days })}
                                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleAction(action.id, 'archive')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors"
                          >
                            <Archive className="w-3 h-3" /> Archive
                          </button>

                          <button
                            onClick={() => handleAction(action.id, 'dismiss')}
                            disabled={isDismissing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors disabled:opacity-50"
                          >
                            {isDismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            Dismiss
                          </button>
                        </>
                      )}

                      <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                        {action.source === 'rule_based' ? 'Rule-based' : action.source} &middot; {new Date(action.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
