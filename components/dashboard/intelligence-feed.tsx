'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ChevronDown,
  Eye,
  Zap,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertRow } from './intelligence-feed-alert-row';
import { InsightCard } from './intelligence-feed-insight-card';

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
      <div className="sovereign-card rounded">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <Loader2 className="w-4 h-4 text-[var(--color-gold)] animate-spin" />
          <span className="text-[15px] text-[var(--color-text-muted)]">Loading alerts…</span>
        </div>
      </div>
    );
  }

  // Error or no insights at all
  if (error || insights.length === 0) {
    return (
      <div className="sovereign-card rounded">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <Zap className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-[15px] text-[var(--color-text-muted)]">
            No alerts right now. Helm is monitoring your portfolio.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="sovereign-card rounded overflow-hidden">
      {/* Collapsed header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-bg-overlay)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-[var(--color-gold)]" />
          <span className="text-[15px] font-medium text-[var(--color-text-primary)]">
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
            <div className="px-5 py-4 text-[15px] text-[var(--color-text-muted)]">
              All caught up. No active alerts.
            </div>
          )}

          {/* Dismissed section toggle */}
          {dismissedEntries.length > 0 && (
            <div className="border-t border-[var(--color-border-base)]">
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                aria-expanded={showDismissed}
                className="w-full flex items-center gap-2 px-5 py-2.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
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
                      <span className="text-[15px] text-[var(--color-text-secondary)] truncate flex-1 line-through">
                        {entry.insight.title}
                      </span>
                      <span className="type-eyebrow text-[var(--color-text-muted)] shrink-0">
                        {formatDismissedAge(entry.dismissedAt)}
                      </span>
                      <button
                        onClick={() => handleRestore(entry.insight.id)}
                        className="shrink-0 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="animate-pulse sovereign-card rounded p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-bg-elevated)]" />
              <div className="h-3 w-12 bg-[var(--color-bg-elevated)] rounded" />
            </div>
            <div className="h-5 w-3/4 bg-[var(--color-bg-elevated)] rounded mb-2" />
            <div className="h-4 w-full bg-[var(--color-bg-elevated)] rounded mb-1" />
            <div className="h-4 w-2/3 bg-[var(--color-bg-elevated)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || activeInsights.length === 0) {
    return (
      <div className="sovereign-card rounded p-10 text-center">
        <div className="w-10 h-10 rounded bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mx-auto mb-3">
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
