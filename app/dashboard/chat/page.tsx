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
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { useTier } from '@/hooks/use-tier';

// ── Types ──

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: Analysis;
  timestamp: Date;
}

// ── Suggested Queries ──

const SUGGESTED_QUERIES = [
  'Analyze NVDA',
  "What's my biggest risk?",
  'How much will I owe in taxes?',
  'TSLA bull vs bear case',
  'Should I harvest any tax losses?',
  'How diversified am I?',
  'Am I on track for retirement?',
  'How would a 20% crash affect me?',
];

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
          Ask about any stock, or ask Helm to analyze your portfolio with real dollar amounts from your connected accounts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-sm hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors duration-200"
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
                      <AnalysisCard analysis={message.analysis} onFollowUp={sendMessage} />
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
                <div className="w-full"><AnalysisSkeletonCard /></div>
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
              placeholder="Ask about your portfolio or analyze any stock..."
              rows={1}
              className="flex-1 bg-transparent text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] resize-none outline-none leading-normal"
              style={{ fontFamily: 'var(--font-sans)', minHeight: '20px' }}
              disabled={isLoading}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  aria-label="Clear conversation"
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
                  'w-8 h-8 rounded-sm flex items-center justify-center transition-colors duration-200',
                  input.trim() && !isLoading
                    ? 'bg-[var(--color-gold)] text-black hover:bg-[var(--color-gold-hi)]'
                    : 'text-[var(--color-text-muted)] cursor-not-allowed'
                )}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-1.5">
            <p className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              Powered by Finnhub + GPT-4o-mini. Not financial advice.
            </p>
            {!isPro && liveQuota && (
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border',
                  liveQuota.remaining > 0
                    ? 'text-[var(--color-text-muted)] border-[var(--color-border-base)]'
                    : 'text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5',
                )}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {liveQuota.remaining}/{liveQuota.limit} analyses left today
                {liveQuota.remaining === 0 && (
                  <> &middot; <Link href="/pricing" className="text-[var(--color-gold)] hover:underline">Upgrade</Link></>
                )}
              </span>
            )}
          </div>
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
