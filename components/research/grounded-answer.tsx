'use client';

// Renders a grounded answer: the prose, with inline [id] citations rewritten to
// numbered refs, and the receipts underneath (the same FindingCard the feed
// uses). The citations ARE the point — the answer is only as trustworthy as the
// findings it stood on, so they are shown, not hidden.

import type { GroundedAnswer } from '@/lib/research/types';
import { FindingCard } from './finding-card';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

/** Rewrite [catch:uuid] tokens in the prose to [1], [2]… against the cited set. */
function renderProse(answer: string, refIndex: Map<string, number>) {
  const parts = answer.split(/(\[[a-z_]+:[^\]]+\])/gi);
  return parts.map((part, i) => {
    const m = part.match(/^\[([a-z_]+:[^\]]+)\]$/i);
    if (!m) return <span key={i}>{part}</span>;
    const n = refIndex.get(m[1].trim());
    if (!n) return null; // dropped, unvalidated citation
    return (
      <sup key={i} className="text-[10px] font-semibold text-[#E6B94D]" style={MONO}>
        [{n}]
      </sup>
    );
  });
}

export function GroundedAnswerView({
  answer,
  onFollowUp,
}: {
  answer: GroundedAnswer;
  onFollowUp: (q: string) => void;
}) {
  const refIndex = new Map(answer.citations.map((f, i) => [f.id, i + 1]));

  return (
    <div className="space-y-4">
      {answer.adviceFlag && (
        <div className="rounded-md border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] px-3 py-2 text-[12px] text-[#F87171]" style={MONO}>
          advice-language guard tripped — this answer drifted toward a recommendation
        </div>
      )}

      <div className="text-[15px] leading-[1.6] text-[#DADADA] whitespace-pre-wrap">
        {renderProse(answer.answer, refIndex)}
      </div>

      {answer.citations.length > 0 && (
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] mb-2" style={MONO}>
            {answer.citations.length} {answer.citations.length === 1 ? 'source' : 'sources'} · what Helm found
          </div>
          <div className="space-y-2">
            {answer.citations.map((f, i) => (
              <FindingCard key={f.id} finding={f} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {answer.followUps.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
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
        </div>
      )}
    </div>
  );
}
