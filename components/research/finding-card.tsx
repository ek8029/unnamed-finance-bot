'use client';

// One agent finding, rendered the same way whether it is browsed in the feed
// (click to ask about it) or shown as a citation under an answer (numbered,
// with the source link). Keeping it one component means a catch looks identical
// wherever the user meets it.

import type { Finding } from '@/lib/research/types';
import { FINDING_KIND_LABEL } from '@/lib/research/types';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export const KIND_TONE: Record<Finding['kind'], string> = {
  catch: '#E6B94D',
  investigation: '#7CA9F2',
  cross_thesis: '#F87171',
  action: '#4ADE80',
  news: '#8A8A8A',
};

function Header({ finding: f, index }: { finding: Finding; index?: number }) {
  const tone = KIND_TONE[f.kind];
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      {index != null && <span className="text-[11px] font-semibold text-[#E6B94D]" style={MONO}>[{index}]</span>}
      <span
        className="text-[9.5px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ ...MONO, color: tone, background: `${tone}14` }}
      >
        {FINDING_KIND_LABEL[f.kind]}
      </span>
      {f.ticker && <span className="text-[11px] font-semibold text-[#FAFAFA]" style={MONO}>{f.ticker}</span>}
      {f.verdict && (
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#8A8A8A]" style={MONO}>{f.verdict}</span>
      )}
      <span className="ml-auto text-[10.5px] text-[#5F5F5F]" style={MONO}>{f.date ?? ''}</span>
    </div>
  );
}

export function FindingCard({
  finding: f,
  index,
  onAsk,
}: {
  finding: Finding;
  index?: number;
  onAsk?: (f: Finding) => void;
}) {
  const tone = KIND_TONE[f.kind];

  const body = (
    <>
      <Header finding={f} index={index} />
      <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[#C8C8C8] m-0">{f.summary}</p>
      {f.quote && (
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#8A8A8A] border-l-2 pl-2.5 m-0" style={{ borderColor: `${tone}55` }}>
          &ldquo;{f.quote}&rdquo;
        </p>
      )}
    </>
  );

  // Feed mode: the whole card asks about this finding. No inner <a> (nested
  // interactive), so the source shows as text plus an "ask" hint.
  if (onAsk) {
    return (
      <button
        type="button"
        onClick={() => onAsk(f)}
        className="group block w-full text-left rounded-md border border-white/[0.07] bg-[#0B0B0B] px-3.5 py-3 hover:border-[rgba(230,185,77,0.35)] hover:bg-white/[0.02] transition-colors"
      >
        {body}
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-[11px] text-[#6A6A6A]" style={MONO}>{f.source}</span>
          <span className="ml-auto text-[11px] text-[#6A6A6A] group-hover:text-[#E6B94D]" style={MONO}>ask about this →</span>
        </div>
      </button>
    );
  }

  // Citation mode: static, with the source link.
  return (
    <div className="rounded-md border border-white/[0.07] bg-[#0B0B0B] px-3.5 py-3">
      {body}
      <div className="mt-1.5 flex items-center gap-3">
        <span className="text-[11px] text-[#6A6A6A]" style={MONO}>{f.source}</span>
        {f.url && (
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#E6B94D] hover:brightness-110" style={MONO}>
            source ↗
          </a>
        )}
      </div>
    </div>
  );
}
