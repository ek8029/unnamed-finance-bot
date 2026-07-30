'use client';

// Renders a grounded answer: the prose, with inline [id] citations rewritten to
// numbered refs, and the receipts underneath (the same FindingCard the feed
// uses). The citations ARE the point — the answer is only as trustworthy as the
// findings it stood on, so they are shown, not hidden.

import { useId, useState } from 'react';
import posthog from 'posthog-js';
import type { GroundedAnswer } from '@/lib/research/types';
import { FindingCard } from './finding-card';
import { withBold } from './rich-text';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

/**
 * Rewrite [catch:uuid] tokens in the prose to tappable [1], [2]… refs that
 * scroll to their receipt card — the cite-gate made visible.
 */
function renderProse(answer: string, refIndex: Map<string, number>, uid: string) {
  const parts = answer.split(/(\[[a-z_]+:[^\]]+\])/gi);
  return parts.map((part, i) => {
    const m = part.match(/^\[([a-z_]+:[^\]]+)\]$/i);
    if (!m) return <span key={i}>{withBold(part, i)}</span>;
    const n = refIndex.get(m[1].trim());
    if (!n) return null; // dropped, unvalidated citation
    return (
      <sup key={i}>
        <button
          type="button"
          title="view the source"
          onClick={() =>
            document.getElementById(`${uid}-ref-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          className="text-[10px] font-semibold text-[#E6B94D] hover:brightness-125 cursor-pointer"
          style={MONO}
        >
          [{n}]
        </button>
      </sup>
    );
  });
}

export function GroundedAnswerView({
  answer,
  onFollowUp,
  question,
}: {
  answer: GroundedAnswer;
  onFollowUp: (q: string) => void;
  /** The user question this answer replies to — enables "watch this". */
  question?: string;
}) {
  const uid = useId();
  const refIndex = new Map(answer.citations.map((f, i) => [f.id, i + 1]));
  const [watchState, setWatchState] = useState<'idle' | 'saving' | 'watching' | 'error'>('idle');

  const watch = async () => {
    if (!question || watchState === 'saving' || watchState === 'watching') return;
    setWatchState('saving');
    try {
      const res = await fetch('/api/research/standing-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error('save failed');
      setWatchState('watching');
      try {
        posthog.capture('research_question_watched');
      } catch {
        /* analytics only */
      }
    } catch {
      setWatchState('error');
    }
  };

  return (
    <div className="space-y-4">
      {answer.adviceFlag && (
        <div className="rounded-md border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] px-3 py-2 text-[12px] text-[#F87171]" style={MONO}>
          advice-language guard tripped — this answer drifted toward a recommendation
        </div>
      )}

      <div className="text-[15px] leading-[1.6] text-[#DADADA] whitespace-pre-wrap">
        {renderProse(answer.answer, refIndex, uid)}
      </div>

      {answer.citations.length > 0 && (
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] mb-2" style={MONO}>
            {answer.citations.length} {answer.citations.length === 1 ? 'source' : 'sources'} · what Helm found
          </div>
          <div className="space-y-2">
            {answer.citations.map((f, i) => (
              <div key={f.id} id={`${uid}-ref-${i + 1}`}>
                <FindingCard finding={f} index={i + 1} />
              </div>
            ))}
          </div>
        </div>
      )}

      {(answer.followUps.length > 0 || question) && (
        <div className="flex flex-wrap gap-2 pt-1 items-center">
          {answer.followUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="px-3 py-1.5 rounded-full border border-white/[0.1] text-[12px] text-[#B8B8B8] hover:border-[rgba(230,185,77,0.4)] hover:text-[#E6B94D] transition-colors text-left"
            >
              {q}
            </button>
          ))}
          {question && (
            <button
              type="button"
              onClick={watch}
              disabled={watchState === 'saving' || watchState === 'watching'}
              title="Helm re-checks this question as new evidence lands and reports the change in your weekly note"
              className={`px-3 py-1.5 rounded-full border text-[12px] transition-colors text-left ${
                watchState === 'watching'
                  ? 'border-[rgba(230,185,77,0.5)] text-[#E6B94D] cursor-default'
                  : 'border-white/[0.1] text-[#B8B8B8] hover:border-[rgba(230,185,77,0.4)] hover:text-[#E6B94D]'
              }`}
              style={MONO}
            >
              {watchState === 'watching' ? 'watching ✓' : watchState === 'saving' ? 'saving…' : watchState === 'error' ? 'watch failed — retry' : 'watch this'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
