'use client';

// The research tab, rebuilt as a grounded analyst. Two things coexist:
//   1. a visible feed of what the agent already found across the book, which the
//      user browses and clicks to ask about, and
//   2. a chat that answers any finance question, grounded in those same findings
//      plus the real book and live prices.
// Dev lab: pick the account by email. Every claim shows its receipt.

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Finding, GroundedAnswer, ValueLedger } from '@/lib/research/types';
import { GroundedAnswerView } from '@/components/research/grounded-answer';
import { FindingsFeed } from '@/components/research/findings-feed';
import { ValueLedgerCard } from '@/components/research/value-ledger-card';
import { StandingStrip } from '@/components/research/standing-strip';
import type { Standing } from '@/lib/research/standing';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const SUGGESTED = [
  'Any tax-loss harvesting opportunities?',
  'What has Helm flagged across my positions lately?',
  "What's my biggest risk right now?",
  'How concentrated am I?',
  'How would a 20% tech selloff hit me?',
];

interface Retrieval {
  tickers: string[];
  topics: string[];
  findingCount: number;
  findingKinds: string[];
  hasPortfolio: boolean;
  hasMarketData: boolean;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  answer?: GroundedAnswer;
  retrieval?: Retrieval;
}

function questionForFinding(f: Finding): string {
  const subject = f.ticker ? `my ${f.ticker} position` : 'my portfolio';
  return `About ${subject}: ${f.summary} — what does this mean and what should I understand about it?`;
}

export function ResearchLab({
  initialEmail,
  embedded = false,
}: {
  initialEmail: string;
  /** Inside the lab shell: chrome + account come from the shell, so the
   *  back-link, page header and account row are omitted. */
  embedded?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(true);

  const [ledger, setLedger] = useState<ValueLedger | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, loading]);

  const loadFeed = useCallback(async (em: string) => {
    const account = em.trim();
    if (!account) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      const res = await fetch(`/api/testing/research?email=${encodeURIComponent(account)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load findings');
      setFindings(data.findings ?? []);
      setLedger(data.ledger ?? null);
      setStanding(data.standing ?? null);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : 'Could not load findings');
      setFindings([]);
      setLedger(null);
      setStanding(null);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  // Auto-load once if an account was passed in the URL.
  useEffect(() => {
    if (initialEmail.trim()) loadFeed(initialEmail);
  }, [initialEmail, loadFeed]);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    if (!email.trim()) {
      setError('Enter an account email first.');
      return;
    }
    setError(null);
    setInput('');
    setFeedOpen(false); // give the conversation room once it starts
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    try {
      const res = await fetch('/api/testing/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), query, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer.answer, answer: data.answer, retrieval: data.retrieval },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? '' : 'min-h-dvh bg-[#060606] px-4 sm:px-6 py-10'}>
      <div className={embedded ? '' : 'max-w-3xl mx-auto'}>
        {!embedded && (
          <Link href="/testing" className="inline-flex items-center min-h-[44px] text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
            ← Testing
          </Link>
        )}

        <div className={embedded ? '' : 'mt-1'}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
            Research · grounded analyst
          </div>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight text-[#FAFAFA]">Ask Helm</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8A8A8A]">
            See what the agent found across your book, then ask about any of it — or ask any finance question. Every
            answer is grounded in real findings, the real book, and live prices, and shows its receipts.
          </p>
        </div>

        {/* account picker — the shell owns the account when embedded */}
        {!embedded && (
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>Account</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFeed(email)}
              placeholder="you@example.com"
              className="flex-1 min-w-[200px] bg-[#0B0B0B] border border-white/[0.1] rounded px-3 py-2 text-[13px] text-[#FAFAFA] outline-none focus:border-[rgba(230,185,77,0.4)]"
              style={MONO}
            />
            <button
              type="button"
              onClick={() => loadFeed(email)}
              disabled={feedLoading || !email.trim()}
              className="px-3 py-2 rounded border border-white/[0.14] text-[12px] text-[#B8B8B8] hover:text-[#FAFAFA] disabled:opacity-40"
              style={MONO}
            >
              {feedLoading ? 'Loading…' : 'Load'}
            </button>
          </div>
        )}

        {feedError && <p className="mt-3 text-[13px] text-[#F87171]" style={MONO}>{feedError}</p>}

        {/* where you stand — plain-English "the one thing / are you okay" */}
        {standing && (
          <div className="mt-6">
            <StandingStrip standing={standing} />
          </div>
        )}

        {/* value ledger — the dollars Helm surfaced (council centerpiece) */}
        {ledger && ledger.surfacedTotal > 0 && (
          <div className="mt-6">
            <ValueLedgerCard ledger={ledger} onAsk={ask} />
          </div>
        )}

        {/* findings feed — the visible agent work */}
        {findings.length > 0 && (
          <div className="mt-6 rounded-lg border border-white/[0.07] bg-[#0A0A0A] p-4 sm:p-5">
            {turns.length === 0 ? (
              <FindingsFeed findings={findings} onAsk={(f) => ask(questionForFinding(f))} />
            ) : (
              <details open={feedOpen} onToggle={(e) => setFeedOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="list-none cursor-pointer flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-[#FAFAFA]">What Helm found</span>
                  <span className="text-[11px] text-[#6A6A6A]" style={MONO}>{findings.length} findings</span>
                  <span className="ml-auto text-[11px] text-[#6A6A6A]" style={MONO}>{feedOpen ? 'hide' : 'show'}</span>
                </summary>
                <div className="mt-3">
                  <FindingsFeed findings={findings} onAsk={(f) => ask(questionForFinding(f))} />
                </div>
              </details>
            )}
          </div>
        )}

        {findings.length === 0 && !feedLoading && email.trim() && !feedError && (
          <p className="mt-6 text-[13px] text-[#7A7A7A]" style={MONO}>
            No findings surfaced for this account yet. You can still ask a question below.
          </p>
        )}

        {/* suggested prompts */}
        {turns.length === 0 && (
          <div className="mt-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A] mb-2" style={MONO}>Or ask</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="px-3 py-2 rounded-full border border-white/[0.1] text-[12.5px] text-[#B8B8B8] hover:border-[rgba(230,185,77,0.4)] hover:text-[#E6B94D] transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* transcript */}
        <div className="mt-6 space-y-6">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-[rgba(230,185,77,0.08)] border border-[rgba(230,185,77,0.2)] px-4 py-2.5 text-[14px] text-[#FAFAFA]">
                  {t.content}
                </div>
              </div>
            ) : (
              <div key={i} className="rounded-lg border border-white/[0.07] bg-[#0A0A0A] p-4 sm:p-5">
                {t.retrieval && (
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[#5F5F5F]" style={MONO}>
                    <span>retrieved:</span>
                    <span className="text-[#8A8A8A]">{t.retrieval.findingCount} findings</span>
                    {t.retrieval.findingKinds.length > 0 && <span>({[...new Set(t.retrieval.findingKinds)].join(', ')})</span>}
                    {t.retrieval.tickers.length > 0 && <span>· tickers {t.retrieval.tickers.join(', ')}</span>}
                    {t.retrieval.topics.length > 0 && <span>· topics {t.retrieval.topics.join(', ')}</span>}
                    {t.retrieval.hasPortfolio && <span>· book ✓</span>}
                    {t.retrieval.hasMarketData && <span>· prices ✓</span>}
                  </div>
                )}
                {t.answer && <GroundedAnswerView answer={t.answer} onFollowUp={ask} />}
              </div>
            ),
          )}
          {loading && (
            <div className="rounded-lg border border-white/[0.07] bg-[#0A0A0A] p-5 text-[13px] text-[#8A8A8A]" style={MONO}>
              retrieving findings and composing…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <p className="mt-4 text-[13px] text-[#F87171]" style={MONO}>{error}</p>}

        {/* input */}
        <div className="mt-6 sticky bottom-4">
          <div className="flex items-end gap-2 rounded-lg border border-white/[0.12] bg-[#0B0B0B] p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about a finding above, or anything about this account…"
              className="flex-1 bg-transparent resize-none outline-none px-2 py-2 text-[14px] text-[#FAFAFA] max-h-[140px]"
            />
            <button
              type="button"
              onClick={() => ask(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded bg-[#E6B94D] text-[#060606] text-[13px] font-semibold disabled:opacity-40"
              style={MONO}
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
