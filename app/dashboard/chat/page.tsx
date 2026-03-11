'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
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

interface AnalysisResponse {
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: AnalysisResponse;
  timestamp: Date;
}

// ── Sub-components ──

function VerdictBadge({ verdict }: { verdict: 'bullish' | 'bearish' | 'neutral' }) {
  const config = {
    bullish: { icon: TrendingUp, label: 'Bullish', color: 'var(--color-positive)', bg: 'rgba(56, 211, 159, 0.08)', border: 'rgba(56, 211, 159, 0.20)' },
    bearish: { icon: TrendingDown, label: 'Bearish', color: 'var(--color-negative)', bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.20)' },
    neutral: { icon: Minus, label: 'Neutral', color: 'var(--color-text-secondary)', bg: 'rgba(138, 148, 166, 0.08)', border: 'rgba(138, 148, 166, 0.20)' },
  }[verdict];

  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function MetricsGrid({ metrics }: { metrics: AnalysisMetric[] }) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[var(--color-border-subtle)] rounded-sm overflow-hidden">
      {metrics.map((metric, i) => (
        <div key={i} className="bg-[var(--color-bg-surface)] p-4">
          <div className="type-data-label mb-1.5">{metric.label}</div>
          <div className="type-data">{metric.value}</div>
          <div className="flex items-center gap-2 mt-1">
            {metric.change && (
              <span
                className="type-mono text-[11px] font-medium"
                style={{
                  color: metric.change.startsWith('+') ? 'var(--color-positive)'
                    : metric.change.startsWith('-') ? 'var(--color-negative)'
                    : 'var(--color-text-muted)',
                }}
              >
                {metric.change}
              </span>
            )}
            {metric.context && (
              <span className="type-mono text-[11px] text-[var(--color-text-muted)]">
                {metric.context}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsSection({ news }: { news: NewsHighlight[] }) {
  if (!news || news.length === 0) return null;

  const sentimentDot = {
    positive: 'var(--color-positive)',
    negative: 'var(--color-negative)',
    neutral: 'var(--color-text-muted)',
  };

  return (
    <div className="space-y-2">
      <div className="type-data-label">Recent Headlines</div>
      {news.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 py-1">
          <span
            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
            style={{ background: sentimentDot[item.sentiment] }}
          />
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-text-primary)] leading-snug line-clamp-2">
              {item.headline}
            </p>
            <p className="type-mono text-[10px] text-[var(--color-text-muted)] mt-0.5">
              {item.date}
            </p>
          </div>
        </div>
      ))}
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
        <span className="type-data-label group-hover:text-[var(--color-text-primary)] transition-colors">
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        )}
      </button>
      {open && (
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] pb-4 animate-fade-in">
          {content}
        </p>
      )}
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: AnalysisResponse }) {
  const verdictBorderColor = {
    bullish: 'rgba(56, 211, 159, 0.25)',
    bearish: 'rgba(248, 113, 113, 0.25)',
    neutral: 'rgba(184, 145, 74, 0.25)',
  }[analysis.verdict];

  return (
    <div
      className="rounded-sm overflow-hidden animate-fade-in-scale"
      style={{
        background: 'var(--color-bg-surface)',
        border: `1px solid ${verdictBorderColor}`,
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="type-h1 text-[20px]">{analysis.ticker}</span>
              <VerdictBadge verdict={analysis.verdict} />
            </div>
            <p className="type-label text-[var(--color-text-muted)] mt-1">
              {analysis.companyName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-gold)]" />
          <span className="type-eyebrow text-[var(--color-gold)]">Helm AI</span>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          {analysis.summary}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <MetricsGrid metrics={analysis.metrics} />
      </div>

      {/* Expandable Sections */}
      <div className="px-5">
        <ExpandableSection title="Bull Case" content={analysis.bullCase} />
        <ExpandableSection title="Bear Case" content={analysis.bearCase} />
      </div>

      {/* Recommendation */}
      {analysis.recommendation && (
        <div className="px-5 py-4 border-t border-[var(--color-border-subtle)]" style={{ background: 'rgba(184, 145, 74, 0.03)' }}>
          <div className="type-data-label text-[var(--color-gold)] mb-1.5">Recommendation</div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">
            {analysis.recommendation}
          </p>
        </div>
      )}

      {/* News Highlights */}
      {analysis.newsHighlights && analysis.newsHighlights.length > 0 && (
        <div className="px-5 py-4 border-t border-[var(--color-border-subtle)]">
          <NewsSection news={analysis.newsHighlights} />
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-sm overflow-hidden bg-[var(--color-bg-surface)] border border-[var(--color-border-base)]">
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
        <div className="skeleton h-6 w-20 rounded-sm" />
        <div className="skeleton h-6 w-24 rounded-sm" />
      </div>
      <div className="px-5 py-4 space-y-2.5 border-b border-[var(--color-border-subtle)]">
        <div className="skeleton h-4 w-full rounded-sm" />
        <div className="skeleton h-4 w-4/5 rounded-sm" />
        <div className="skeleton h-4 w-3/5 rounded-sm" />
      </div>
      <div className="px-5 py-4">
        <div className="grid grid-cols-3 gap-px bg-[var(--color-border-subtle)] rounded-sm overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-[var(--color-bg-surface)] p-4 space-y-2">
              <div className="skeleton h-2.5 w-14 rounded-sm" />
              <div className="skeleton h-5 w-20 rounded-sm" />
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

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
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  // ── Empty State ──

  const EmptyState = () => (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-lg mx-auto">
        <div
          className="w-14 h-14 rounded-sm mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'var(--color-gold-surface)', border: '1px solid var(--color-gold-border)' }}
        >
          <MessageSquare className="w-6 h-6 text-[var(--color-gold)]" />
        </div>
        <h2 className="type-h1 text-[20px] mb-2">Research Terminal</h2>
        <p className="type-body text-[var(--color-text-secondary)] mb-8">
          AI-powered equity analysis. Ask about any ticker, compare stocks, or get a portfolio review.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="px-4 py-3 text-left text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-sm hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-all duration-200"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Messages Area */}
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'user' ? (
                  <div className="max-w-lg">
                    <div
                      className="px-5 py-3 rounded-sm text-sm text-[var(--color-text-primary)]"
                      style={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-base)',
                      }}
                    >
                      {message.content}
                    </div>
                    <p className="type-mono text-[10px] text-[var(--color-text-muted)] mt-1.5 text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="w-full">
                    {message.analysis ? (
                      <AnalysisCard analysis={message.analysis} />
                    ) : (
                      <div
                        className="px-5 py-4 rounded-sm text-sm text-[var(--color-text-secondary)] leading-relaxed"
                        style={{
                          background: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border-base)',
                        }}
                      >
                        {message.content}
                      </div>
                    )}
                    <p className="type-mono text-[10px] text-[var(--color-text-muted)] mt-1.5">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Loading skeleton */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-full">
                  <SkeletonCard />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area — always pinned to bottom */}
      <div className="shrink-0 border-t border-[var(--color-border-base)] bg-[var(--color-bg-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div
            className="flex items-end gap-3 rounded-sm px-4 py-3"
            style={{
              background: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Analyze a ticker, ask about your portfolio, or compare stocks..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none outline-none leading-normal py-0.5"
              style={{ fontFamily: 'var(--font-sans)' }}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className={cn(
                'shrink-0 w-9 h-9 rounded-sm flex items-center justify-center transition-all duration-200',
                input.trim() && !isLoading
                  ? 'bg-[var(--color-gold)] text-[var(--color-text-inverse)] hover:bg-[var(--color-gold-hi)]'
                  : 'text-[var(--color-text-muted)] cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="type-mono text-[10px] text-[var(--color-text-muted)] mt-2 text-center">
            Powered by Finnhub + GPT-4o-mini. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
