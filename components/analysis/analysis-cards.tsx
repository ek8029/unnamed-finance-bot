'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Target,
} from 'lucide-react';
import type {
  Analysis,
  AnalysisMetric,
  StockAnalysis,
  PortfolioReview,
  GeneralAnalysis,
  PortfolioQA,
} from './types';

// ── Shared sub-components ──

export function MetricsGrid({ metrics }: { metrics: AnalysisMetric[] }) {
  if (!metrics?.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[var(--color-border-subtle)] rounded-sm overflow-hidden">
      {metrics.map((metric, i) => (
        <div key={i} className="bg-[var(--color-bg-surface)] px-4 py-3">
          <div className="type-caption text-[var(--color-text-muted)] mb-1">{metric.label}</div>
          <div className="text-[17px] font-bold tracking-tight text-[var(--color-text-primary)] font-tabular">{metric.value}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {metric.change && (
              <span
                className="text-[11px] font-medium font-tabular"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: metric.change.startsWith('+') ? 'var(--color-positive)'
                    : metric.change.startsWith('-') ? 'var(--color-negative)'
                    : 'var(--color-text-muted)',
                }}
              >
                {metric.change}
              </span>
            )}
            {metric.context && (
              <span className="text-[11px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {metric.context}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardHeader({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
      {left}
      {right || (
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-gold)]" />
          <span className="type-eyebrow text-[var(--color-gold)]">Helm AI</span>
        </div>
      )}
    </div>
  );
}

function ExpandableSection({ title, content, defaultOpen = false }: { title: string; content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;

  return (
    <div className="border-t border-[var(--color-border-subtle)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 text-left group"
      >
        <span className="type-caption text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
          {title}
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          : <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        }
      </button>
      {open && (
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-secondary)] pb-3.5 animate-fade-in">
          {content}
        </p>
      )}
    </div>
  );
}

// ── Watermark (for public pages) ──

export function AnalysisWatermark() {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 opacity-50">
      <Sparkles className="w-3 h-3 text-[var(--color-gold)]" />
      <span className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
        Powered by Helm Terminal — helmterminal.dev
      </span>
    </div>
  );
}

// ── Stock Analysis Card ──

export function StockAnalysisCard({ analysis, showWatermark = false }: { analysis: StockAnalysis; showWatermark?: boolean }) {
  const verdictOptions = {
    bullish: { icon: TrendingUp, label: 'Bullish', color: 'var(--color-positive)', border: 'rgba(56, 211, 159, 0.25)', bg: 'rgba(56, 211, 159, 0.06)' },
    bearish: { icon: TrendingDown, label: 'Bearish', color: 'var(--color-negative)', border: 'rgba(248, 113, 113, 0.25)', bg: 'rgba(248, 113, 113, 0.06)' },
    neutral: { icon: Minus, label: 'Neutral', color: 'var(--color-text-secondary)', border: 'rgba(184, 145, 74, 0.25)', bg: 'rgba(138, 148, 166, 0.06)' },
  };
  const verdictConfig = verdictOptions[analysis.verdict as keyof typeof verdictOptions] || verdictOptions.neutral;

  const VerdictIcon = verdictConfig.icon;

  return (
    <div>
      <div
        className="rounded-sm overflow-hidden"
        style={{ background: 'var(--color-bg-surface)', border: `1px solid ${verdictConfig.border}` }}
      >
        <CardHeader
          left={
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{analysis.ticker}</span>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: verdictConfig.color, background: verdictConfig.bg, border: `1px solid ${verdictConfig.border}` }}
                >
                  <VerdictIcon className="w-3 h-3" />
                  {verdictConfig.label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                {analysis.companyName}
              </p>
            </div>
          }
        />

        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)]">{analysis.summary}</p>
        </div>

        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <MetricsGrid metrics={analysis.metrics} />
        </div>

        <div className="px-5">
          <ExpandableSection title="Bull Case" content={analysis.bullCase} />
          <ExpandableSection title="Bear Case" content={analysis.bearCase} />
        </div>

        {analysis.recommendation && (
          <div className="px-5 py-3.5 border-t border-[var(--color-border-subtle)]" style={{ background: 'rgba(184, 145, 74, 0.03)' }}>
            <div className="type-caption text-[var(--color-gold)] mb-1">Recommendation</div>
            <p className="text-[13px] font-medium leading-[1.5] text-[var(--color-text-primary)]">{analysis.recommendation}</p>
          </div>
        )}

        {analysis.newsHighlights?.length > 0 && (
          <div className="px-5 py-3.5 border-t border-[var(--color-border-subtle)]">
            <div className="type-caption text-[var(--color-text-muted)] mb-2">Recent Headlines</div>
            <div className="space-y-1.5">
              {analysis.newsHighlights.map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                    style={{
                      background: item.sentiment === 'positive' ? 'var(--color-positive)'
                        : item.sentiment === 'negative' ? 'var(--color-negative)'
                        : 'var(--color-text-muted)',
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] text-[var(--color-text-secondary)] leading-snug">{item.headline}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showWatermark && <AnalysisWatermark />}
    </div>
  );
}

// ── Portfolio Review Card ──

export function PortfolioReviewCard({ analysis }: { analysis: PortfolioReview }) {
  const priorityColor = { high: 'var(--color-negative)', medium: 'var(--color-warning)', low: 'var(--color-text-secondary)' };

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-gold-border)' }}
    >
      <CardHeader left={<span className="text-base font-semibold text-[var(--color-text-primary)]">{analysis.title}</span>} />

      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)]">{analysis.summary}</p>
      </div>

      {analysis.metrics?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <MetricsGrid metrics={analysis.metrics} />
        </div>
      )}

      {analysis.strengths?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-positive)]" />
            <span className="type-caption text-[var(--color-positive)]">Strengths</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="text-[13px] leading-[1.5] text-[var(--color-text-secondary)] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--color-positive)] before:opacity-40">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.weaknesses?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
            <span className="type-caption text-[var(--color-warning)]">Weaknesses</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="text-[13px] leading-[1.5] text-[var(--color-text-secondary)] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--color-warning)] before:opacity-40">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.recommendations?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-[var(--color-gold)]" />
            <span className="type-caption text-[var(--color-gold)]">Recommendations</span>
          </div>
          <div className="space-y-2.5">
            {analysis.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 mt-0.5 px-1.5 py-px rounded-sm text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    color: priorityColor[rec.priority],
                    background: `color-mix(in srgb, ${priorityColor[rec.priority]} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${priorityColor[rec.priority]} 20%, transparent)`,
                  }}
                >{rec.priority}</span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] leading-snug">{rec.action}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)] leading-snug mt-0.5">{rec.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.riskFactors?.length > 0 && (
        <div className="px-5 py-3.5">
          <div className="type-caption text-[var(--color-text-muted)] mb-2">Risk Factors</div>
          <ul className="space-y-1.5">
            {analysis.riskFactors.map((r, i) => (
              <li key={i} className="text-[12px] leading-[1.5] text-[var(--color-text-muted)] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[8px] before:w-1 before:h-1 before:rounded-full before:bg-[var(--color-text-muted)]">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── General Analysis Card ──

export function GeneralAnalysisCard({
  analysis,
  onFollowUp,
}: {
  analysis: GeneralAnalysis;
  onFollowUp?: (question: string) => void;
}) {
  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
    >
      <CardHeader left={<span className="text-base font-semibold text-[var(--color-text-primary)]">{analysis.title}</span>} />

      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)] whitespace-pre-line">{analysis.summary}</p>
      </div>

      {analysis.metrics?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <MetricsGrid metrics={analysis.metrics} />
        </div>
      )}

      {analysis.keyPoints?.length > 0 && (
        <div className={`px-5 py-3.5${analysis.followUpQuestions?.length ? ' border-b border-[var(--color-border-subtle)]' : ''}`}>
          <div className="type-caption text-[var(--color-text-muted)] mb-2.5">Key Points</div>
          <div className="space-y-3">
            {analysis.keyPoints.map((kp, i) => (
              <div key={i}>
                <p className="text-[13px] font-medium text-[var(--color-text-primary)] leading-snug">{kp.point}</p>
                <p className="text-[12px] text-[var(--color-text-muted)] leading-[1.5] mt-0.5">{kp.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.followUpQuestions?.length ? (
        <div className="px-5 py-3.5">
          <div className="type-caption text-[var(--color-text-muted)] mb-2">Follow up</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.followUpQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Portfolio Q&A Card ──

const SENTIMENT_CONFIG = {
  positive: { color: 'var(--color-positive)', bg: 'rgba(56, 211, 159, 0.06)', border: 'rgba(56, 211, 159, 0.20)' },
  negative: { color: 'var(--color-negative)', bg: 'rgba(248, 113, 113, 0.06)', border: 'rgba(248, 113, 113, 0.20)' },
  warning:  { color: 'var(--color-warning)',  bg: 'rgba(212, 169, 78, 0.06)',  border: 'rgba(212, 169, 78, 0.20)' },
  neutral:  { color: 'var(--color-text-secondary)', bg: 'rgba(138, 148, 166, 0.06)', border: 'rgba(138, 148, 166, 0.15)' },
};

export function PortfolioQACard({
  analysis,
  onFollowUp,
}: {
  analysis: PortfolioQA;
  onFollowUp?: (question: string) => void;
}) {
  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-gold-border)' }}
    >
      <CardHeader
        left={
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--color-gold)]" />
            <span className="text-base font-semibold text-[var(--color-text-primary)]">{analysis.title}</span>
          </div>
        }
      />

      {/* Summary */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)]">{analysis.summary}</p>
      </div>

      {/* Highlights — the centerpiece */}
      {analysis.highlights?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)] space-y-2">
          {analysis.highlights.map((h, i) => {
            const cfg = SENTIMENT_CONFIG[h.sentiment] || SENTIMENT_CONFIG.neutral;
            return (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3 rounded-sm"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <div className="shrink-0 mt-0.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: cfg.color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="text-[18px] font-bold tracking-tight font-tabular"
                      style={{ color: cfg.color }}
                    >
                      {h.value}
                    </span>
                    <span className="text-[12px] text-[var(--color-text-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {h.label}
                    </span>
                  </div>
                  {h.detail && (
                    <p className="text-[12px] leading-[1.5] text-[var(--color-text-muted)] mt-0.5">
                      {h.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendation */}
      {analysis.recommendation && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]" style={{ background: 'rgba(184, 145, 74, 0.03)' }}>
          <div className="type-caption text-[var(--color-gold)] mb-1">Recommendation</div>
          <p className="text-[13px] font-medium leading-[1.5] text-[var(--color-text-primary)]">{analysis.recommendation}</p>
        </div>
      )}

      {/* Follow-up questions */}
      {analysis.followUpQuestions?.length > 0 && (
        <div className="px-5 py-3.5">
          <div className="type-caption text-[var(--color-text-muted)] mb-2">Follow up</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.followUpQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Router ──

export function AnalysisCard({
  analysis,
  showWatermark = false,
  onFollowUp,
}: {
  analysis: Analysis;
  showWatermark?: boolean;
  onFollowUp?: (question: string) => void;
}) {
  switch (analysis.type) {
    case 'stock_analysis':
      return <StockAnalysisCard analysis={analysis} showWatermark={showWatermark} />;
    case 'portfolio_review':
      return <PortfolioReviewCard analysis={analysis} />;
    case 'portfolio_qa':
      return <PortfolioQACard analysis={analysis} onFollowUp={onFollowUp} />;
    case 'general':
      return <GeneralAnalysisCard analysis={analysis} onFollowUp={onFollowUp} />;
    default:
      if ('verdict' in analysis) return <StockAnalysisCard analysis={analysis as StockAnalysis} showWatermark={showWatermark} />;
      if ('highlights' in analysis) return <PortfolioQACard analysis={analysis as PortfolioQA} onFollowUp={onFollowUp} />;
      return <GeneralAnalysisCard analysis={analysis as GeneralAnalysis} onFollowUp={onFollowUp} />;
  }
}

// ── Skeleton ──

export function AnalysisSkeletonCard() {
  return (
    <div className="rounded-sm overflow-hidden bg-[var(--color-bg-surface)] border border-[var(--color-border-base)]">
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
        <div className="skeleton h-5 w-24 rounded-sm" />
        <div className="skeleton h-5 w-16 rounded-sm" />
      </div>
      <div className="px-5 py-3.5 space-y-2 border-b border-[var(--color-border-subtle)]">
        <div className="skeleton h-3.5 w-full rounded-sm" />
        <div className="skeleton h-3.5 w-[90%] rounded-sm" />
        <div className="skeleton h-3.5 w-[70%] rounded-sm" />
      </div>
      <div className="px-5 py-3.5">
        <div className="grid grid-cols-3 gap-px bg-[var(--color-border-subtle)] rounded-sm overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-[var(--color-bg-surface)] px-4 py-3 space-y-1.5">
              <div className="skeleton h-2 w-12 rounded-sm" />
              <div className="skeleton h-4 w-16 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
