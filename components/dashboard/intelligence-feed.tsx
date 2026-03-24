'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  TrendingUp,
  Activity,
  Target,
  ArrowRight,
  ChevronDown,
  X,
  Eye,
  Zap,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──

export interface InsightMetric {
  label: string;
  value: string;
}

export interface FeedInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'info' | 'action';
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  detail: string;
  metrics: InsightMetric[];
  suggestedFollowUp: string;
  createdAt: string;
}

interface DismissedEntry {
  insight: FeedInsight;
  dismissedAt: number;
}

// ── Config ──

const DISMISSED_STORAGE_KEY = 'helm_dismissed_alerts';
const DISMISS_RETENTION_DAYS = 14;

const TYPE_CONFIG = {
  risk: { icon: Shield, label: 'Risk' },
  opportunity: { icon: TrendingUp, label: 'Opportunity' },
  info: { icon: Activity, label: 'Insight' },
  action: { icon: Target, label: 'Action' },
} as const;

const PRIORITY_CONFIG = {
  high: {
    dot: 'bg-[var(--color-negative)]',
    dotGlow: '0 0 8px rgba(248,113,113,0.4)',
    border: 'border-l-[var(--color-negative)]',
    label: 'HIGH',
    labelClass: 'text-[var(--color-negative)]',
  },
  medium: {
    dot: 'bg-[var(--color-gold)]',
    dotGlow: '0 0 8px rgba(184,145,74,0.4)',
    border: 'border-l-[var(--color-gold)]',
    label: 'MED',
    labelClass: 'text-[var(--color-gold)]',
  },
  low: {
    dot: 'bg-[var(--color-text-muted)]',
    dotGlow: undefined,
    border: 'border-l-[var(--color-border-strong)]',
    label: 'LOW',
    labelClass: 'text-[var(--color-text-muted)]',
  },
} as const;

// ── Dismissed storage helpers ──

function getDismissed(): DismissedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const entries: DismissedEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - DISMISS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return entries.filter((e) => e.dismissedAt > cutoff);
  } catch {
    return [];
  }
}

function saveDismissed(entries: DismissedEntry[]) {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable
  }
}

// ── Alert Row (expandable inline) ──

function AlertRow({
  insight,
  onDismiss,
}: {
  insight: FeedInsight;
  onDismiss: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[insight.priority];
  const typeConfig = TYPE_CONFIG[insight.type];
  const Icon = typeConfig.icon;

  return (
    <div>
      {/* Summary row */}
      <div
        className="flex items-center gap-3 py-2.5 px-4 group cursor-pointer hover:bg-[var(--color-bg-overlay)] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown
          className={cn(
            'w-3 h-3 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityConfig.dot)} style={priorityConfig.dotGlow ? { boxShadow: priorityConfig.dotGlow } : undefined} />
        <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />
        <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">
          {insight.title}
        </span>
        <span className={cn('type-eyebrow shrink-0', priorityConfig.labelClass)}>
          {priorityConfig.label}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(insight.id);
          }}
          className="shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Dismiss ${insight.title}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-1 ml-[26px] border-l-2 border-[var(--color-border-base)] mr-4 space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {insight.summary}
          </p>

          {insight.metrics.length > 0 && (
            <div className="flex gap-6">
              {insight.metrics.map((m, i) => (
                <div key={i}>
                  <p className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">{m.label}</p>
                  <p className="type-data text-[var(--color-text-primary)]">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {insight.detail && (
            <p className="type-caption text-[var(--color-text-muted)] leading-relaxed">
              {insight.detail}
            </p>
          )}

          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/chat?q=${encodeURIComponent(insight.suggestedFollowUp)}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
            >
              Ask Helm about this
              <ArrowRight className="w-3 h-3" />
            </Link>
            <button
              onClick={() => onDismiss(insight.id)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expanded Insight Card ──

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: FeedInsight;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = TYPE_CONFIG[insight.type];
  const priorityConfig = PRIORITY_CONFIG[insight.priority];
  const Icon = typeConfig.icon;

  return (
    <div
      className={cn(
        'glass-panel rounded-lg',
        'border-l-[3px]',
        priorityConfig.border,
        'transition-all duration-200 hover:border-[var(--color-border-strong)]',
      )}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', priorityConfig.dot)} style={priorityConfig.dotGlow ? { boxShadow: priorityConfig.dotGlow } : undefined} />
              <span className={cn('type-eyebrow', priorityConfig.labelClass)}>
                {priorityConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <Icon className="w-3.5 h-3.5" />
              <span className="type-caption">{typeConfig.label}</span>
            </div>
          </div>
          <button
            onClick={() => onDismiss(insight.id)}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            aria-label={`Dismiss ${insight.title}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)] mb-2 leading-snug">
          {insight.title}
        </h3>

        <p className="type-body text-[var(--color-text-secondary)] mb-4 leading-relaxed">
          {insight.summary}
        </p>

        {insight.metrics.length > 0 && (
          <div className="flex gap-6 mb-4">
            {insight.metrics.map((m, i) => (
              <div key={i}>
                <p className="type-eyebrow text-[var(--color-text-muted)] mb-0.5">{m.label}</p>
                <p className="type-data text-[var(--color-text-primary)]">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {insight.detail && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors mb-3"
          >
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform duration-200', expanded && 'rotate-180')}
            />
            {expanded ? 'Less detail' : 'More detail'}
          </button>
        )}

        {expanded && (
          <p className="type-caption text-[var(--color-text-secondary)] mb-4 pl-4 border-l-2 border-[var(--color-border-base)] leading-relaxed">
            {insight.detail}
          </p>
        )}

        <Link
          href={`/dashboard/chat?q=${encodeURIComponent(insight.suggestedFollowUp)}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
        >
          Ask Helm about this
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Main Collapsible Feed ──

export function IntelligenceFeed({
  insights,
  loading,
  error,
}: {
  insights: FeedInsight[];
  loading: boolean;
  error: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedEntries, setDismissedEntries] = useState<DismissedEntry[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load dismissed state on mount
  useEffect(() => {
    const entries = getDismissed();
    setDismissedEntries(entries);
    setDismissedIds(new Set(entries.map((e) => e.insight.id)));
  }, []);

  const handleDismiss = useCallback(
    (id: string) => {
      const insight = insights.find((i) => i.id === id);
      if (!insight) return;

      const newEntry: DismissedEntry = { insight, dismissedAt: Date.now() };
      const updated = [...dismissedEntries, newEntry];
      setDismissedEntries(updated);
      setDismissedIds((prev) => new Set([...prev, id]));
      saveDismissed(updated);
    },
    [insights, dismissedEntries],
  );

  const handleRestore = useCallback(
    (id: string) => {
      const updated = dismissedEntries.filter((e) => e.insight.id !== id);
      setDismissedEntries(updated);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      saveDismissed(updated);
    },
    [dismissedEntries],
  );

  const activeInsights = insights.filter((i) => !dismissedIds.has(i.id));
  const activeCount = activeInsights.length;

  // Loading state — single shimmer bar
  if (loading) {
    return (
      <div className="glass-panel rounded-lg">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <Loader2 className="w-4 h-4 text-[var(--color-gold)] animate-spin" />
          <span className="text-sm text-[var(--color-text-muted)]">Loading alerts…</span>
        </div>
      </div>
    );
  }

  // Error or no insights at all
  if (error || insights.length === 0) {
    return (
      <div className="glass-panel rounded-lg">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <Zap className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-muted)]">
            No alerts right now. Helm is monitoring your portfolio.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg overflow-hidden">
      {/* Collapsed header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-bg-overlay)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-[var(--color-gold)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {activeCount > 0
              ? `${activeCount} alert${activeCount !== 1 ? 's' : ''}`
              : 'All alerts dismissed'}
          </span>
          {activeCount > 0 && (
            <span className="type-eyebrow text-[var(--color-text-muted)]">
              {activeInsights.filter((i) => i.priority === 'high').length > 0 &&
                `${activeInsights.filter((i) => i.priority === 'high').length} high priority`}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--color-border-base)]">
          {/* Active alerts */}
          {activeCount > 0 ? (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {activeInsights.map((insight) => (
                <AlertRow key={insight.id} insight={insight} onDismiss={handleDismiss} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-[var(--color-text-muted)]">
              All caught up. No active alerts.
            </div>
          )}

          {/* Dismissed section toggle */}
          {dismissedEntries.length > 0 && (
            <div className="border-t border-[var(--color-border-base)]">
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                className="w-full flex items-center gap-2 px-5 py-2.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {showDismissed ? 'Hide' : 'View'} dismissed ({dismissedEntries.length})
              </button>

              {showDismissed && (
                <div className="divide-y divide-[var(--color-border-subtle)] opacity-60">
                  {dismissedEntries.map((entry) => (
                    <div
                      key={entry.insight.id}
                      className="flex items-center gap-3 py-2.5 px-4 group"
                    >
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-text-muted)]" />
                      <span className="text-sm text-[var(--color-text-secondary)] truncate flex-1 line-through">
                        {entry.insight.title}
                      </span>
                      <span className="type-eyebrow text-[var(--color-text-muted)] shrink-0">
                        {formatDismissedAge(entry.dismissedAt)}
                      </span>
                      <button
                        onClick={() => handleRestore(entry.insight.id)}
                        className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-gold)] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Full expanded feed (used if linked from elsewhere) ──

export function IntelligenceFeedExpanded({
  insights,
  loading,
  error,
}: {
  insights: FeedInsight[];
  loading: boolean;
  error: string | null;
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [dismissedEntries, setDismissedEntries] = useState<DismissedEntry[]>([]);

  useEffect(() => {
    const entries = getDismissed();
    setDismissedEntries(entries);
    setDismissedIds(new Set(entries.map((e) => e.insight.id)));
  }, []);

  const handleDismiss = useCallback(
    (id: string) => {
      const insight = insights.find((i) => i.id === id);
      if (!insight) return;
      const newEntry: DismissedEntry = { insight, dismissedAt: Date.now() };
      const updated = [...dismissedEntries, newEntry];
      setDismissedEntries(updated);
      setDismissedIds((prev) => new Set([...prev, id]));
      saveDismissed(updated);
    },
    [insights, dismissedEntries],
  );

  const activeInsights = insights.filter((i) => !dismissedIds.has(i.id));

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse glass-panel rounded-lg p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-neutral-700" />
              <div className="h-3 w-12 bg-neutral-700 rounded" />
            </div>
            <div className="h-5 w-3/4 bg-neutral-700 rounded mb-2" />
            <div className="h-4 w-full bg-neutral-700 rounded mb-1" />
            <div className="h-4 w-2/3 bg-neutral-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || activeInsights.length === 0) {
    return (
      <div className="glass-panel rounded-lg p-10 text-center">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mx-auto mb-3">
          <Activity className="w-5 h-5 text-[var(--color-gold)]" />
        </div>
        <p className="type-body text-[var(--color-text-secondary)]">
          No active alerts. Helm is monitoring your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {activeInsights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

// ── Helpers ──

function formatDismissedAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
