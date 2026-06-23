'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useResearch, type ResearchMessage } from '@/contexts/research-context';
import {
  AnalysisCard,
  AnalysisSkeletonCard,
} from '@/components/analysis/analysis-cards';
import type { Analysis } from '@/components/analysis/types';
import {
  Send,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useTier } from '@/hooks/use-tier';
import { FinancialDisclaimer } from '@/components/financial-disclaimer';

// ── Types ──

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: Analysis;
  timestamp: Date;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

// ── Suggested Queries ──

const SUGGESTED_QUERIES = [
  'Analyze NVDA',
  "What's my biggest risk?",
  'How much will I owe in taxes?',
  'TSLA bull vs bear case',
  'What positions are at an unrealized loss?',
  'How diversified am I?',
  'Am I on track for retirement?',
  'How would a 20% crash affect me?',
];

// ── Helm assistant label ──

function HelmLabel() {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Sparkles className="w-3.5 h-3.5 text-[var(--color-gold)]" strokeWidth={1.6} />
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]"
        style={MONO}
      >
        Helm
      </span>
    </div>
  );
}

// ── Main Page ──

function ResearchChatContent() {
  const searchParams = useSearchParams();
  const { messages: storedMessages, addMessage, clearMessages } = useResearch();
  const { tier, quota, isPro, loading: tierLoading } = useTier();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveQuota, setLiveQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQueryRef = useRef(searchParams.get('q'));
  const hasAutoQuery = useRef(!!searchParams.get('q'));

  // Initialize live quota from tier data
  useEffect(() => {
    if (quota && quota.limit != null) {
      setLiveQuota({ used: quota.used, limit: quota.limit, remaining: quota.remaining ?? 0 });
    }
  }, [quota]);

  // Hydrate from session storage on mount — skip if we have a ?q= auto-query
  useEffect(() => {
    if (hasAutoQuery.current) return;
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
        if (err.code === 'QUOTA_EXCEEDED' && err.quota) {
          setLiveQuota({ used: err.quota.used, limit: err.quota.limit, remaining: 0 });
        }
        throw new Error(err.error || 'Analysis failed');
      }

      const data = await res.json();

      // Update live quota from response
      if (data.quota) {
        setLiveQuota({ used: data.quota.used, limit: data.quota.limit, remaining: data.quota.remaining });
      }

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

  // ── Auto-send from intelligence feed follow-up (?q=...) ──

  useEffect(() => {
    if (!initialQueryRef.current) return;
    const q = initialQueryRef.current;
    initialQueryRef.current = null;

    // Clean URL immediately
    window.history.replaceState({}, '', '/dashboard/chat');

    // Add user message to state synchronously so it renders immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
      timestamp: new Date(),
    };
    setMessages([userMessage]);
    persistMessage(userMessage);
    setIsLoading(true);

    // Perform the analysis fetch
    fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, conversationHistory: [] }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Analysis failed');
        }
        return res.json();
      })
      .then((data) => {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.analysis?.summary || 'Analysis complete.',
          analysis: data.analysis,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        persistMessage(assistantMessage);
      })
      .catch((error) => {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        persistMessage(errorMessage);
      })
      .finally(() => {
        setIsLoading(false);
        hasAutoQuery.current = false;
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quota derivation ──

  const showQuota = !isPro && !tierLoading && liveQuota != null;
  const quotaExceeded = showQuota && liveQuota!.remaining <= 0;
  const inputDisabled = isLoading || quotaExceeded;

  // ── Quota Indicator (header, right-aligned) ──

  const QuotaIndicator = () => {
    if (!showQuota) return null;
    return (
      <div className="text-right shrink-0">
        <div className="text-[10px] tracking-[0.06em] text-[var(--color-text-muted)] mb-1" style={MONO}>
          Daily questions
        </div>
        <div
          className={cn(
            'text-[14px] font-semibold tabular-nums',
            quotaExceeded ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-gold)]',
          )}
          style={MONO}
        >
          {liveQuota!.used}{' '}
          <span className="text-[var(--color-text-muted)]">/ {liveQuota!.limit} used</span>
        </div>
      </div>
    );
  };

  // ── Empty State ──

  const EmptyState = () => (
    <div className="flex-1 flex items-center justify-center px-6 min-h-0">
      <div className="text-center max-w-xl mx-auto">
        <div
          className="w-12 h-12 rounded-lg mx-auto mb-5 flex items-center justify-center"
          style={{ background: 'var(--color-gold-surface)', border: '1px solid var(--color-gold-border)' }}
        >
          <Sparkles className="w-5 h-5 text-[var(--color-gold)]" strokeWidth={1.6} />
        </div>
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] mb-2">
          Your portfolio, in plain language
        </h2>
        <p className="text-[15px] text-[var(--color-text-secondary)] mb-7 leading-relaxed">
          Ask about any stock, or ask Helm to analyze your portfolio with real dollar amounts from your connected accounts. Every answer is sourced.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={inputDisabled}
              className="px-4 py-3 text-left text-[14px] text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg hover:border-[var(--color-gold-border)] hover:text-[var(--color-text-primary)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full max-w-[860px] w-full mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-end justify-between gap-5 px-4 sm:px-7 pt-5 pb-3.5 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1.5" style={MONO}>
            Ask Helm
          </div>
          <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Your portfolio, in plain language
          </div>
        </div>
        <QuotaIndicator />
      </div>

      {/* Messages Area */}
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="px-4 sm:px-7 py-6 flex flex-col gap-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex flex-col',
                  message.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                {message.role === 'user' ? (
                  <div className="max-w-[85vw] sm:max-w-[75%]">
                    <div
                      className="px-4 py-3 text-[14.5px] leading-[1.55] text-[var(--color-text-primary)]"
                      style={{
                        background: 'var(--color-gold-surface)',
                        border: '1px solid var(--color-gold-border)',
                        borderRadius: '12px 12px 2px 12px',
                      }}
                    >
                      {message.content}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 text-right" style={MONO}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="w-full sm:max-w-[88%]">
                    {message.analysis ? (
                      <AnalysisCard analysis={message.analysis} onFollowUp={sendMessage} />
                    ) : (
                      <div>
                        <HelmLabel />
                        <div
                          className="px-4 py-3.5 text-[14.5px] leading-[1.62] text-[var(--color-text-secondary)]"
                          style={{
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-base)',
                            borderRadius: '12px 12px 12px 2px',
                          }}
                        >
                          {message.content}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5" style={MONO}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="w-full sm:max-w-[88%]">
                  <HelmLabel />
                  <AnalysisSkeletonCard />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 px-4 sm:px-7 pt-4 pb-5">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-[10px] pl-4 pr-1.5 py-1.5 transition-colors',
            quotaExceeded
              ? 'border border-[var(--color-warning-border)] bg-[var(--color-bg-surface)]'
              : 'border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] focus-within:border-[var(--color-gold-border)]',
          )}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={quotaExceeded ? 'Daily limit reached. Upgrade for unlimited questions.' : 'Ask about your portfolio or analyze any stock...'}
            rows={1}
            aria-label="Ask Helm a question"
            className="flex-1 bg-transparent text-[14.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none outline-none leading-normal disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-sans)', minHeight: '24px' }}
            disabled={inputDisabled}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                aria-label="Clear conversation"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || inputDisabled}
              aria-label="Send message"
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200',
                input.trim() && !inputDisabled
                  ? 'bg-[var(--color-gold)] text-black hover:bg-[var(--color-gold-hi)]'
                  : 'text-[var(--color-text-muted)] cursor-not-allowed',
              )}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quota line + upsell */}
        {showQuota && (
          <div className="text-[10px] text-center mt-2.5" style={MONO}>
            {quotaExceeded ? (
              <span className="text-[var(--color-warning-text)]">
                Daily limit reached.{' '}
                <Link href="/pricing" className="text-[var(--color-gold)] hover:underline">
                  Upgrade to Pro for unlimited &rarr;
                </Link>
              </span>
            ) : (
              <span className="text-[var(--color-text-muted)]">
                {liveQuota!.remaining} free question{liveQuota!.remaining === 1 ? '' : 's'} left today &middot;{' '}
                <Link href="/pricing" className="text-[var(--color-gold)] hover:underline">
                  Upgrade to Pro for unlimited &rarr;
                </Link>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-1.5">
          <FinancialDisclaimer />
        </div>
      </div>
    </div>
  );
}

export default function ResearchChatPage() {
  return (
    <Suspense>
      <ResearchChatContent />
    </Suspense>
  );
}
