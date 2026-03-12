'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useResearch, type ResearchMessage } from '@/contexts/research-context';
import {
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Target,
  Trash2,
} from 'lucide-react';

// ── Types ──

interface AnalysisMetric {
  label: string;
  value: string;
  change?: string | null;
  context?: string | null;
}

interface NewsHighlight {
  headline: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  date: string;
}

interface StockAnalysis {
  type: 'stock_analysis';
  ticker: string;
  companyName: string;
  verdict: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  metrics: AnalysisMetric[];
  bullCase: string;
  bearCase: string;
  recommendation: string;
  newsHighlights: NewsHighlight[];
}

interface PortfolioReview {
  type: 'portfolio_review';
  title: string;
  summary: string;
  metrics: AnalysisMetric[];
  strengths: string[];
  weaknesses: string[];
  recommendations: { action: string; rationale: string; priority: 'high' | 'medium' | 'low' }[];
  riskFactors: string[];
}

interface GeneralAnalysis {
  type: 'general';
  title: string;
  summary: string;
  keyPoints: { point: string; detail: string }[];
  metrics: AnalysisMetric[];
}

type Analysis = StockAnalysis | PortfolioReview | GeneralAnalysis;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: Analysis;
  timestamp: Date;
}

// ── Shared sub-components ──

function MetricsGrid({ metrics }: { metrics: AnalysisMetric[] }) {
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

// ── Stock Analysis Card ──

function StockAnalysisCard({ analysis }: { analysis: StockAnalysis }) {
  const verdictConfig = {
    bullish: { icon: TrendingUp, label: 'Bullish', color: 'var(--color-positive)', border: 'rgba(56, 211, 159, 0.25)', bg: 'rgba(56, 211, 159, 0.06)' },
    bearish: { icon: TrendingDown, label: 'Bearish', color: 'var(--color-negative)', border: 'rgba(248, 113, 113, 0.25)', bg: 'rgba(248, 113, 113, 0.06)' },
    neutral: { icon: Minus, label: 'Neutral', color: 'var(--color-text-secondary)', border: 'rgba(184, 145, 74, 0.25)', bg: 'rgba(138, 148, 166, 0.06)' },
  }[analysis.verdict];

  const VerdictIcon = verdictConfig.icon;

  return (
    <div
      className="rounded-sm overflow-hidden animate-fade-in-scale"
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

      {/* Summary */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)]">{analysis.summary}</p>
      </div>

      {/* Metrics */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <MetricsGrid metrics={analysis.metrics} />
      </div>

      {/* Bull / Bear */}
      <div className="px-5">
        <ExpandableSection title="Bull Case" content={analysis.bullCase} />
        <ExpandableSection title="Bear Case" content={analysis.bearCase} />
      </div>

      {/* Recommendation */}
      {analysis.recommendation && (
        <div className="px-5 py-3.5 border-t border-[var(--color-border-subtle)]" style={{ background: 'rgba(184, 145, 74, 0.03)' }}>
          <div className="type-caption text-[var(--color-gold)] mb-1">Recommendation</div>
          <p className="text-[13px] font-medium leading-[1.5] text-[var(--color-text-primary)]">{analysis.recommendation}</p>
        </div>
      )}

      {/* News */}
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
  );
}

// ── Portfolio Review Card ──

function PortfolioReviewCard({ analysis }: { analysis: PortfolioReview }) {
  const priorityColor = { high: 'var(--color-negative)', medium: 'var(--color-warning)', low: 'var(--color-text-secondary)' };

  return (
    <div
      className="rounded-sm overflow-hidden animate-fade-in-scale"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-gold-border)' }}
    >
      <CardHeader
        left={
          <div>
            <span className="text-base font-semibold text-[var(--color-text-primary)]">{analysis.title}</span>
          </div>
        }
      />

      {/* Summary */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)]">{analysis.summary}</p>
      </div>

      {/* Metrics */}
      {analysis.metrics?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <MetricsGrid metrics={analysis.metrics} />
        </div>
      )}

      {/* Strengths */}
      {analysis.strengths?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-positive)]" />
            <span className="type-caption text-[var(--color-positive)]">Strengths</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="text-[13px] leading-[1.5] text-[var(--color-text-secondary)] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--color-positive)] before:opacity-40">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {analysis.weaknesses?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
            <span className="type-caption text-[var(--color-warning)]">Weaknesses</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="text-[13px] leading-[1.5] text-[var(--color-text-secondary)] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--color-warning)] before:opacity-40">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-[var(--color-gold)]" />
            <span className="type-caption text-[var(--color-gold)]">Recommendations</span>
          </div>
          <div className="space-y-2.5">
            {analysis.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className="shrink-0 mt-0.5 px-1.5 py-px rounded-sm text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    color: priorityColor[rec.priority],
                    background: `color-mix(in srgb, ${priorityColor[rec.priority]} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${priorityColor[rec.priority]} 20%, transparent)`,
                  }}
                >
                  {rec.priority}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] leading-snug">{rec.action}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)] leading-snug mt-0.5">{rec.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {analysis.riskFactors?.length > 0 && (
        <div className="px-5 py-3.5">
          <div className="type-caption text-[var(--color-text-muted)] mb-2">Risk Factors</div>
          <ul className="space-y-1.5">
            {analysis.riskFactors.map((r, i) => (
              <li key={i} className="text-[12px] leading-[1.5] text-[var(--color-text-muted)] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[8px] before:w-1 before:h-1 before:rounded-full before:bg-[var(--color-text-muted)]">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── General Analysis Card ──

function GeneralAnalysisCard({ analysis }: { analysis: GeneralAnalysis }) {
  return (
    <div
      className="rounded-sm overflow-hidden animate-fade-in-scale"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
    >
      <CardHeader
        left={<span className="text-base font-semibold text-[var(--color-text-primary)]">{analysis.title}</span>}
      />

      {/* Summary */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
        <p className="text-[13px] leading-[1.65] text-[var(--color-text-primary)] whitespace-pre-line">{analysis.summary}</p>
      </div>

      {/* Metrics */}
      {analysis.metrics?.length > 0 && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
          <MetricsGrid metrics={analysis.metrics} />
        </div>
      )}

      {/* Key Points */}
      {analysis.keyPoints?.length > 0 && (
        <div className="px-5 py-3.5">
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
    </div>
  );
}

// ── Analysis Card Router ──

function AnalysisCard({ analysis }: { analysis: Analysis }) {
  switch (analysis.type) {
    case 'stock_analysis':
      return <StockAnalysisCard analysis={analysis as StockAnalysis} />;
    case 'portfolio_review':
      return <PortfolioReviewCard analysis={analysis as PortfolioReview} />;
    case 'general':
      return <GeneralAnalysisCard analysis={analysis as GeneralAnalysis} />;
    default:
      // Fallback: try to render as stock analysis if it has verdict, otherwise general
      if ('verdict' in analysis) return <StockAnalysisCard analysis={analysis as StockAnalysis} />;
      return <GeneralAnalysisCard analysis={analysis as GeneralAnalysis} />;
  }
}

// ── Skeleton ──

function SkeletonCard() {
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

// ── Suggested Queries ──

const SUGGESTED_QUERIES = [
  'Analyze NVDA',
  'Is AAPL overvalued?',
  'Review my portfolio',
  'TSLA bull vs bear case',
  'Find weakspots in my holdings',
  'Compare MSFT vs GOOG',
];

// ── Main Page ──

export default function ResearchChatPage() {
  const { messages: storedMessages, addMessage, clearMessages } = useResearch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from session storage on mount
  useEffect(() => {
    if (storedMessages.length > 0 && messages.length === 0) {
      setMessages(storedMessages.map(m => ({
        ...m,
        analysis: m.analysis as Analysis | undefined,
        timestamp: new Date(m.timestamp),
      })));
    }
  }, [storedMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const persistMessage = useCallback((msg: Message) => {
    const serializable: ResearchMessage = {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      analysis: msg.analysis as Record<string, unknown> | undefined,
      timestamp: msg.timestamp.toISOString(),
    };
    addMessage(serializable);
  }, [addMessage]);

  const sendMessage = async (queryOverride?: string) => {
    const query = queryOverride || input.trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    persistMessage(userMessage);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.analysis ? JSON.stringify(m.analysis) : m.content,
      }));

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, conversationHistory }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.analysis?.summary || 'Analysis complete.',
        analysis: data.analysis,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      persistMessage(assistantMessage);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      persistMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClear = () => {
    setMessages([]);
    clearMessages();
  };

  // ── Empty State ──

  const EmptyState = () => (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-lg mx-auto">
        <div
          className="w-12 h-12 rounded-sm mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--color-gold-surface)', border: '1px solid var(--color-gold-border)' }}
        >
          <MessageSquare className="w-5 h-5 text-[var(--color-gold)]" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] mb-1">Research Terminal</h2>
        <p className="text-[13px] text-[var(--color-text-secondary)] mb-6 leading-relaxed">
          AI-powered analysis. Ask about any ticker, review your portfolio, or explore market trends.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-sm hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-all duration-200"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'user' ? (
                  <div className="max-w-md">
                    <div
                      className="px-4 py-2.5 rounded-sm text-[13px] leading-relaxed text-[var(--color-text-primary)]"
                      style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-base)' }}
                    >
                      {message.content}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="w-full">
                    {message.analysis ? (
                      <AnalysisCard analysis={message.analysis} />
                    ) : (
                      <div
                        className="px-5 py-3.5 rounded-sm text-[13px] leading-[1.65] text-[var(--color-text-secondary)]"
                        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
                      >
                        {message.content}
                      </div>
                    )}
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="w-full"><SkeletonCard /></div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 border-t border-[var(--color-border-base)] bg-[var(--color-bg-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-3">
          <div
            className="flex items-center gap-3 rounded-sm px-4 py-2.5"
            style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border-base)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Analyze a ticker, review your portfolio, or ask a market question..."
              rows={1}
              className="flex-1 bg-transparent text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none outline-none leading-normal"
              style={{ fontFamily: 'var(--font-sans)', minHeight: '20px' }}
              disabled={isLoading}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="w-8 h-8 rounded-sm flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'w-8 h-8 rounded-sm flex items-center justify-center transition-all duration-200',
                  input.trim() && !isLoading
                    ? 'bg-[var(--color-gold)] text-[var(--color-text-inverse)] hover:bg-[var(--color-gold-hi)]'
                    : 'text-[var(--color-text-muted)] cursor-not-allowed'
                )}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 text-center" style={{ fontFamily: 'var(--font-mono)' }}>
            Powered by Finnhub + GPT-4o-mini. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
