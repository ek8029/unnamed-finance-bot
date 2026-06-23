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

export function InsightCard({
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
        'sovereign-card rounded',
        'border-l-[3px]',
        priorityConfig.border,
        'transition-[border-color,background-color] duration-200 hover:border-[var(--color-border-strong)]',
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
            aria-expanded={expanded}
            className="flex items-center gap-1 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors mb-3"
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
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
        >
          Ask Helm about this
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
