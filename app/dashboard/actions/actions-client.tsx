'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  Lightbulb,
  Clock,
  Archive,
  X,
  Check,
  ChevronRight,
  Flame,
  PieChart,
  BarChart3,
  Receipt,
  Wallet,
  SlidersHorizontal,
  FileText,
  Sparkles,
  CircleDot,
  Inbox,
  ArrowLeft,
} from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { ProBlur } from '@/components/pro-blur';

/* ──────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────── */

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
  snoozed_until?: string | null;
  is_archived?: boolean;
  is_dismissed?: boolean;
  is_useful?: boolean;
}

type StatusTab = 'open' | 'snoozed' | 'done' | 'archived';
type CategoryFilter = 'all' | 'high' | 'concentration' | 'earnings' | 'tax' | 'cash' | 'drift' | 'filings';
type MobileView = 'list' | 'detail';

/* ──────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────── */

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: {
    label: 'HIGH',
    className: 'bg-[var(--color-negative-muted)] text-[var(--color-negative-text)] border-[var(--color-negative-border)]',
  },
  high: {
    label: 'HIGH',
    className: 'bg-[var(--color-negative-muted)] text-[var(--color-negative-text)] border-[var(--color-negative-border)]',
  },
  medium: {
    label: 'MED',
    className: 'bg-[var(--color-warning-muted)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  },
  low: {
    label: 'LOW',
    className: 'bg-[var(--color-info-muted)] text-[var(--color-info-text)] border-[var(--color-info-border)]',
  },
};

const categoryConfig: Record<CategoryFilter, { icon: typeof Inbox; label: string; types: string[] }> = {
  all:            { icon: Inbox,             label: 'All',            types: [] },
  high:           { icon: Flame,             label: 'High Priority',  types: [] },
  concentration:  { icon: PieChart,          label: 'Concentration',  types: ['concentration', 'portfolio'] },
  earnings:       { icon: BarChart3,         label: 'Earnings',       types: ['earnings', 'market'] },
  tax:            { icon: Receipt,           label: 'Tax',            types: ['tax'] },
  cash:           { icon: Wallet,            label: 'Cash',           types: ['cash', 'spending'] },
  drift:          { icon: SlidersHorizontal, label: 'Drift',          types: ['drift', 'rebalance'] },
  filings:        { icon: FileText,          label: 'Filings',        types: ['filings', 'credit'] },
};

const typeIcons: Record<string, typeof TrendingUp> = {
  spending: TrendingDown,
  portfolio: TrendingUp,
  tax: DollarSign,
  credit: CreditCard,
  market: AlertTriangle,
  concentration: PieChart,
  earnings: BarChart3,
  cash: Wallet,
  drift: SlidersHorizontal,
  filings: FileText,
};

const categoryLabels: Record<string, string> = {
  spending: 'Cash',
  portfolio: 'Concentration',
  tax: 'Tax',
  credit: 'Filings',
  market: 'Earnings',
  concentration: 'Concentration',
  earnings: 'Earnings',
  cash: 'Cash',
  drift: 'Drift',
  filings: 'Filings',
};

const statusTabs: { key: StatusTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'done', label: 'Done' },
  { key: 'archived', label: 'Archive' },
];

/* ──────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function actionIdShort(id: string): string {
  return `ACT-${id.slice(0, 6).toUpperCase()}`;
}

function matchesCategory(action: ActionItem, category: CategoryFilter): boolean {
  if (category === 'all') return true;
  if (category === 'high') return action.priority === 'critical' || action.priority === 'high';
  const cfg = categoryConfig[category];
  return cfg.types.includes(action.type);
}

/* ──────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────── */

const DEMO_ACTIONS: ActionItem[] = [
  { id: 'da-1', type: 'tax_loss_harvest', priority: 'high', title: 'Tax-loss harvesting opportunity: AMZN', description: 'AMZN is down 12% from your cost basis. Harvesting this $1,793 unrealized loss could save ~$580 in taxes this year. Consider replacing with VTI to maintain broad market exposure without triggering a wash sale.', recommended_action: 'Sell AMZN, buy VTI as a replacement', estimated_impact: 580, source: 'portfolio', created_at: new Date().toISOString() },
  { id: 'da-2', type: 'concentration_risk', priority: 'medium', title: 'Technology sector concentration at 43%', description: 'Technology stocks (AAPL, MSFT, NVDA, GOOGL) make up 43% of your portfolio. A sector-specific downturn could significantly impact your returns. Consider rebalancing into healthcare, energy, or international exposure.', recommended_action: 'Diversify 5-10% into non-tech sectors', source: 'portfolio', created_at: new Date().toISOString() },
  { id: 'da-3', type: 'earnings_exposure', priority: 'medium', title: 'NVDA earnings report in 3 days', description: 'NVIDIA reports earnings this week and represents 12.5% of your portfolio ($23,120). High concentration in a single stock heading into earnings creates binary risk. Your position is large enough that a 10% post-earnings move would shift your portfolio by 1.25%.', recommended_action: 'Review position size before earnings', source: 'portfolio', created_at: new Date().toISOString() },
  { id: 'da-4', type: 'savings_positive', priority: 'low', title: 'Strong savings rate: 24% this month', description: 'You saved $3,420 this month, beating your 6-month average of $2,950 by 16%. Consistent savings at this rate compounds significantly over time.', source: 'cash_flow', created_at: new Date().toISOString() },
];

export function ActionsClient({ initialActions, isPro }: { initialActions: ActionItem[]; isPro: boolean }) {
  const { formatCurrency, formatDate } = useFormat();

  // Demo mode
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
  const effectiveActions = isDemo && initialActions.length === 0 ? DEMO_ACTIONS : initialActions;

  // State
  const [actions, setActions] = useState<ActionItem[]>(
    [...effectiveActions].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
  );
  const [activeTab, setActiveTab] = useState<StatusTab>('open');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');

  // Filtered actions
  const filteredActions = useMemo(() => {
    return actions.filter(a => matchesCategory(a, activeCategory));
  }, [actions, activeCategory]);

  // Selected action
  const selectedAction = useMemo(() => {
    if (!selectedId) return filteredActions[0] || null;
    return filteredActions.find(a => a.id === selectedId) || filteredActions[0] || null;
  }, [filteredActions, selectedId]);

  // Auto-select first item when filter changes
  useEffect(() => {
    if (filteredActions.length > 0 && !filteredActions.find(a => a.id === selectedId)) {
      setSelectedId(filteredActions[0].id);
    }
  }, [filteredActions, selectedId]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: actions.length,
      high: actions.filter(a => a.priority === 'critical' || a.priority === 'high').length,
      concentration: 0,
      earnings: 0,
      tax: 0,
      cash: 0,
      drift: 0,
      filings: 0,
    };
    for (const a of actions) {
      for (const [cat, cfg] of Object.entries(categoryConfig)) {
        if (cat !== 'all' && cat !== 'high' && cfg.types.includes(a.type)) {
          counts[cat as CategoryFilter]++;
        }
      }
    }
    return counts;
  }, [actions]);

  // Fetch actions by status tab
  const fetchByStatus = useCallback(async (status: StatusTab) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'open') params.set('status', status);
      const res = await fetch(`/api/insights?${params}`);
      if (res.ok) {
        const data = await res.json();
        setActions(
          (data.insights || []).sort(
            (a: ActionItem, b: ActionItem) =>
              (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
          )
        );
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Failed to fetch actions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = (tab: StatusTab) => {
    setActiveTab(tab);
    setActiveCategory('all');
    fetchByStatus(tab);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch('/api/insights/generate', { method: 'POST' });
      await fetchByStatus(activeTab);
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    setActionLoading(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      if (res.ok) {
        // Remove from current list for dismiss/archive/snooze/not_useful/unarchive/useful(done)
        if (['dismiss', 'archive', 'snooze', 'not_useful', 'unarchive', 'useful'].includes(action)) {
          setActions(prev => prev.filter(a => a.id !== id));
          if (selectedId === id) setSelectedId(null);
        }
      }
    } finally {
      setActionLoading(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setShowSnoozeMenu(false);
    }
  };

  const handleSelectAction = (id: string) => {
    setSelectedId(id);
    setMobileView('detail');
  };

  const handleMobileBack = () => {
    setMobileView('list');
  };

  // Context grid data for detail pane
  const getContextPairs = (action: ActionItem) => {
    const pairs: { label: string; value: string }[] = [];
    if (action.estimated_impact && action.estimated_impact > 0) {
      pairs.push({ label: 'Est. Impact', value: formatCurrency(action.estimated_impact) });
    }
    pairs.push({ label: 'Category', value: categoryLabels[action.type] || action.type });
    pairs.push({ label: 'Source', value: action.source === 'rule_based' ? 'Rule Engine' : action.source });
    pairs.push({ label: 'Created', value: formatDate(action.created_at) });
    if (action.snoozed_until) {
      pairs.push({ label: 'Snoozed Until', value: formatDate(action.snoozed_until) });
    }
    return pairs;
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] pb-16 md:pb-0">
      {/* Top Bar: Title + Status Tabs + Generate */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[var(--color-border-base)]">
        <div className="flex items-center justify-between mb-2 md:mb-0">
          <h1 className="text-[17px] md:text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Actions Inbox
          </h1>
          <button
            onClick={handleGenerate}
            disabled={generating}
            aria-label="Analyze now - refresh actions"
            className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 text-[12px] md:text-[14px] font-medium bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black rounded-md md:rounded-lg motion-safe:transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Analyze Now</span>
          </button>
        </div>
        {/* Status Tabs */}
        <div
          className="flex items-center gap-1 bg-[var(--color-bg-surface)] rounded-lg p-0.5 border border-[var(--color-border-subtle)] w-fit"
          role="tablist"
          aria-label="Action status"
        >
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`px-2.5 md:px-3 py-1 md:py-1.5 text-[12px] md:text-[14px] font-medium rounded-md motion-safe:transition-all motion-safe:duration-150 ${
                activeTab === tab.key
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: Horizontal Category Pills */}
      <div className="md:hidden border-b border-[var(--color-border-base)] bg-[var(--color-bg-base)]">
        <nav aria-label="Action categories" className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto">
          {(Object.keys(categoryConfig) as CategoryFilter[]).map(cat => {
            const cfg = categoryConfig[cat];
            const Icon = cfg.icon;
            const count = categoryCounts[cat];
            const isActive = activeCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-label={`Filter by ${cfg.label}`}
                aria-current={isActive ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-full whitespace-nowrap flex-shrink-0 motion-safe:transition-colors ${
                  isActive
                    ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)] border border-[var(--color-gold-border)]'
                    : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{cfg.label}</span>
                {count > 0 && (
                  <span className={`text-[11px] font-mono min-w-[16px] text-center rounded-full px-1 ${
                    isActive
                      ? 'text-[var(--color-gold)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3-Pane Layout */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* -- Left Rail: Category Filters (desktop only) -- */}
        <nav
          aria-label="Action categories"
          className="hidden md:block w-[200px] flex-shrink-0 border-r border-[var(--color-border-base)] bg-[var(--color-bg-base)] py-3 overflow-y-auto"
        >
          <div className="px-3 mb-2">
            <h2 className="type-eyebrow">Categories</h2>
          </div>
          {(Object.keys(categoryConfig) as CategoryFilter[]).map(cat => {
            const cfg = categoryConfig[cat];
            const Icon = cfg.icon;
            const count = categoryCounts[cat];
            const isActive = activeCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-label={`Filter by ${cfg.label}`}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left motion-safe:transition-colors ${
                  isActive
                    ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)] border-r-2 border-[var(--color-gold)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-[14px] font-medium flex-1 truncate">{cfg.label}</span>
                {count > 0 && (
                  <span className={`text-[12px] font-mono min-w-[20px] text-center rounded-full px-1.5 py-0.5 ${
                    isActive
                      ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                      : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* -- Middle Column: Action List -- */}
        <section
          aria-label="Action items"
          className={`${
            mobileView === 'detail' ? 'hidden' : 'flex'
          } md:flex w-full md:w-[440px] flex-shrink-0 border-r border-[var(--color-border-base)] bg-[var(--color-bg-base)] flex-col min-h-0`}
        >
          {/* List Header */}
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <h2 className="text-[13px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
              {filteredActions.length} {filteredActions.length === 1 ? 'action' : 'actions'}
            </h2>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-text-muted)]" />}
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto">
            {filteredActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <Lightbulb className="w-8 h-8 text-[var(--color-text-muted)] mb-3 opacity-40" />
                <p className="text-[14px] text-[var(--color-text-muted)]">
                  {activeTab === 'open' ? 'No open actions' : `No ${activeTab} actions`}
                </p>
                {activeTab === 'open' && (
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-1 opacity-60">
                    Click Analyze Now to scan your data
                  </p>
                )}
              </div>
            ) : (
              filteredActions.map(action => {
                const isSelected = selectedAction?.id === action.id;
                const pCfg = priorityConfig[action.priority] || priorityConfig.medium;

                return (
                  <button
                    key={action.id}
                    onClick={() => handleSelectAction(action.id)}
                    className={`w-full text-left px-5 py-4 border-b border-[var(--color-border-subtle)] motion-safe:transition-all motion-safe:duration-100 relative ${
                      isSelected
                        ? 'bg-[var(--color-gold-surface)]'
                        : 'hover:bg-[var(--color-bg-surface)]'
                    }`}
                  >
                    {/* Gold left accent for selected */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-gold)] rounded-r-full" />
                    )}

                    {/* Row 1: Priority badge + Category + Timestamp */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[12px] font-bold px-2 py-[2px] rounded border uppercase tracking-wide ${pCfg.className}`}>
                        {pCfg.label}
                      </span>
                      <span className="text-[13px] font-mono text-[var(--color-text-muted)]">
                        {categoryLabels[action.type] || action.type}
                      </span>
                      <span className="text-[13px] text-[var(--color-text-muted)] ml-auto">
                        {relativeTime(action.created_at)}
                      </span>
                    </div>

                    {/* Row 2: Title */}
                    <h3 className="text-[14px] sm:text-[16px] font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2">
                      {action.title}
                    </h3>

                    {/* Row 3: Summary + Impact */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[13px] sm:text-[14px] text-[var(--color-text-muted)] truncate flex-1 leading-relaxed">
                        {action.description}
                      </p>
                      {action.estimated_impact && action.estimated_impact > 0 && (
                        <span className="text-[13px] sm:text-[15px] font-semibold text-[var(--color-positive)] font-tabular whitespace-nowrap">
                          {formatCurrency(action.estimated_impact)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* -- Detail Pane -- */}
        <main
          aria-label="Action details"
          className={`${
            mobileView === 'list' ? 'hidden' : 'flex'
          } md:flex flex-1 min-h-0 overflow-y-auto bg-[var(--color-bg-base)] flex-col`}
        >
          {selectedAction ? (
            <DetailPane
              action={selectedAction}
              contextPairs={getContextPairs(selectedAction)}
              activeTab={activeTab}
              actionLoading={actionLoading}
              showSnoozeMenu={showSnoozeMenu}
              setShowSnoozeMenu={setShowSnoozeMenu}
              onAction={handleAction}
              formatCurrency={formatCurrency}
              onMobileBack={handleMobileBack}
              isPro={isPro}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Inbox className="w-12 h-12 text-[var(--color-text-muted)] mb-4 opacity-30" />
              <p className="text-[15px] text-[var(--color-text-muted)]">
                Select an action to view details
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Detail Pane Sub-component
   ────────────────────────────────────────────────── */

interface DetailPaneProps {
  action: ActionItem;
  contextPairs: { label: string; value: string }[];
  activeTab: StatusTab;
  actionLoading: Set<string>;
  showSnoozeMenu: boolean;
  setShowSnoozeMenu: (show: boolean) => void;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => void;
  formatCurrency: (amount: number) => string;
  onMobileBack: () => void;
  isPro: boolean;
}

function DetailPane({
  action,
  contextPairs,
  activeTab,
  actionLoading,
  showSnoozeMenu,
  setShowSnoozeMenu,
  onAction,
  formatCurrency,
  onMobileBack,
  isPro,
}: DetailPaneProps) {
  const isLoading = actionLoading.has(action.id);
  const pCfg = priorityConfig[action.priority] || priorityConfig.medium;
  const Icon = typeIcons[action.type] || Lightbulb;

  return (
    <div className="max-w-[740px] mx-auto px-4 sm:px-5 md:px-8 py-4 sm:py-6 md:py-8">
      {/* Mobile back button */}
      <button
        onClick={onMobileBack}
        aria-label="Back to action list"
        className="md:hidden flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 motion-safe:transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header: Priority + Category + ID */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-[12px] font-bold px-2 py-[2px] rounded border uppercase tracking-wide ${pCfg.className}`}>
          {pCfg.label}
        </span>
        <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
          <Icon className="w-3.5 h-3.5" />
          <span className="font-mono">{categoryLabels[action.type] || action.type}</span>
        </div>
        <span className="text-[12px] font-mono text-[var(--color-text-muted)] ml-auto">
          {actionIdShort(action.id)}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-[20px] sm:text-[28px] md:text-[36px] font-bold tracking-tight leading-[1.1] text-[var(--color-text-primary)] mb-4">
        {action.title}
      </h2>

      {/* Summary */}
      <p className="text-[14px] sm:text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-6 sm:mb-8">
        {action.description}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
        {activeTab === 'archived' ? (
          <button
            onClick={() => onAction(action.id, 'unarchive')}
            disabled={isLoading}
            aria-label="Restore this action from archive"
            className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black rounded-lg motion-safe:transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Restore Action
          </button>
        ) : (
          <>
            {/* Primary CTA */}
            <button
              onClick={() => onAction(action.id, 'useful')}
              disabled={isLoading}
              aria-label="Mark this action as complete"
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black rounded-lg motion-safe:transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Mark Complete
            </button>

            {/* Snooze */}
            <div className="relative">
              <button
                onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                disabled={isLoading}
                aria-label="Snooze this action"
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] motion-safe:transition-colors disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                Snooze 7d
              </button>
              {showSnoozeMenu && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg shadow-[var(--shadow-elevated)] z-20 py-1 min-w-[140px]">
                  {[
                    { label: '1 day', days: 1 },
                    { label: '3 days', days: 3 },
                    { label: '1 week', days: 7 },
                    { label: '2 weeks', days: 14 },
                    { label: '1 month', days: 30 },
                  ].map(opt => (
                    <button
                      key={opt.days}
                      onClick={() => onAction(action.id, 'snooze', { snooze_days: opt.days })}
                      className="w-full text-left px-4 py-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] motion-safe:transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={() => onAction(action.id, 'dismiss')}
              disabled={isLoading}
              aria-label="Dismiss this action"
              className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] motion-safe:transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Dismiss
            </button>
          </>
        )}
      </div>

      {/* Context Grid */}
      <div className="mb-6 sm:mb-8">
        <h3 className="type-eyebrow mb-3">Context</h3>
        <div className="border border-[var(--color-border-base)] rounded-lg overflow-hidden">
          {contextPairs.map((pair, i) => (
            <div
              key={pair.label}
              className={`flex flex-col sm:flex-row sm:items-center px-4 py-3 ${
                i < contextPairs.length - 1 ? 'border-b border-[var(--color-border-subtle)]' : ''
              }`}
            >
              <span className="text-[13px] font-mono text-[var(--color-text-muted)] sm:w-[140px] flex-shrink-0">
                {pair.label}
              </span>
              <span className="text-[14px] text-[var(--color-text-primary)] font-medium">
                {pair.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Helm Reasoning */}
      {action.recommended_action && (
        <div className="mb-6 sm:mb-8">
          <h3 className="type-eyebrow mb-3">Helm Reasoning</h3>
          {isPro ? (
            <div className="border border-[var(--color-gold-border)] rounded-lg p-5 bg-[var(--color-gold-surface)]">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[var(--color-gold)] mt-0.5 flex-shrink-0" />
                <p className="text-[14px] leading-relaxed text-[var(--color-text-primary)]">
                  {action.recommended_action}
                </p>
              </div>
            </div>
          ) : (
            <ProBlur
              label="Unlock recommendations"
              description="See specific action steps and reasoning for this insight."
              minHeight="80px"
            >
              <div className="border border-[var(--color-gold-border)] rounded-lg p-5 bg-[var(--color-gold-surface)]">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[var(--color-gold)] mt-0.5 flex-shrink-0" />
                  <p className="text-[14px] leading-relaxed text-[var(--color-text-primary)]">
                    Upgrade to Pro to see specific recommendations and reasoning for this insight.
                  </p>
                </div>
              </div>
            </ProBlur>
          )}
        </div>
      )}

      {/* Activity Timeline */}
      <div>
        <h3 className="type-eyebrow mb-3">Activity</h3>
        <div className="relative pl-6">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border-base)]" />

          {/* Created event */}
          <div className="relative mb-4">
            <div className="absolute left-[-19px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-base)]" />
            <div>
              <p className="text-[14px] text-[var(--color-text-primary)]">Action created</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                {new Date(action.created_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Snoozed event if applicable */}
          {action.snoozed_until && (
            <div className="relative mb-4">
              <div className="absolute left-[-19px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-[var(--color-warning-border)] bg-[var(--color-warning-muted)]" />
              <div>
                <p className="text-[14px] text-[var(--color-text-primary)]">Snoozed</p>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                  Until {new Date(action.snoozed_until).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Current state */}
          <div className="relative">
            <div className="absolute left-[-19px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]" />
            <div>
              <p className="text-[14px] text-[var(--color-gold)]">
                {activeTab === 'done' ? 'Completed' : activeTab === 'archived' ? 'Archived' : 'Awaiting action'}
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">Now</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
