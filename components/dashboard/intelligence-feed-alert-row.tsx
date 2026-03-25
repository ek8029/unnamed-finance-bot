'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  TrendingUp,
  Activity,
  Target,
  ArrowRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeedInsight } from './intelligence-feed';

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
    dotGlow: '0 0 8px rgba(230,185,77,0.4)',
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

export function AlertRow({
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
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="flex items-center gap-3 py-2.5 px-4 group cursor-pointer hover:bg-[var(--color-bg-overlay)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
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
