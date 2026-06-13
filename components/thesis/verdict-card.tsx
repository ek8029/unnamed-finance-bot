import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThesisIntelligenceItem {
  ticker: string;
  pillarClaim: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  what: string;
  why: string;
  whatItMeans: string;
  consider: string | null;
  isHistorical?: boolean;
  sourceTitle: string;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  statusChanged: boolean;
}

function spineColor(verdict: ThesisIntelligenceItem['verdict'], materiality: ThesisIntelligenceItem['materiality']): string {
  if (verdict === 'contradicts' && materiality === 'material') return '#F87171';
  if (verdict === 'contradicts' && materiality === 'context') return '#E6B94D';
  if (verdict === 'supports') return '#4ADE80';
  return '#6A6A6A';
}

function verdictLabel(verdict: ThesisIntelligenceItem['verdict']): string {
  if (verdict === 'supports') return 'SUPPORTS';
  if (verdict === 'contradicts') return 'CONTRADICTS';
  return 'NEUTRAL';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VerdictCard({ item }: { item: ThesisIntelligenceItem }) {
  const color = spineColor(item.verdict, item.materiality);

  return (
    <article className="flex overflow-hidden rounded-[4px] border border-white/[0.06] bg-[#131313]">
      {/* 3px colored left spine */}
      <div className="w-[3px] shrink-0" style={{ background: color, opacity: 0.85 }} />

      <div className="flex-1 p-[22px_24px]">
        {/* Header row */}
        <div className="flex items-center gap-[14px] mb-[18px] flex-wrap">
          {/* Verdict word */}
          <span
            className="font-mono text-[18px] font-semibold uppercase tracking-[0.04em]"
            style={{ color, fontFamily: "'Space Grotesk', monospace" }}
          >
            {verdictLabel(item.verdict)}
          </span>

          {/* Ticker chip */}
          <span
            className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] px-[8px] py-[3px] rounded-[3px] border border-white/[0.10] text-[#9A9A9A]"
            style={{ fontFamily: "'Space Grotesk', monospace" }}
          >
            {item.ticker}
          </span>

          {/* Materiality tag */}
          <span
            className={cn(
              'font-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-[7px] py-[3px] rounded-[2px] border',
              item.materiality === 'material'
                ? 'border-[rgba(248,113,113,0.25)] text-[#F87171] bg-[rgba(248,113,113,0.06)]'
                : 'border-white/[0.08] text-[#6A6A6A] bg-transparent'
            )}
            style={{ fontFamily: "'Space Grotesk', monospace" }}
          >
            {item.materiality}
          </span>

          {/* Status changed tag */}
          {item.statusChanged && (
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-[7px] py-[3px] rounded-[2px] border border-[rgba(230,185,77,0.25)] text-[#E6B94D] bg-[rgba(230,185,77,0.06)]"
              style={{ fontFamily: "'Space Grotesk', monospace" }}
            >
              Status changed
            </span>
          )}

          {/* Historical context tag: backfilled evidence, not a live confirmation */}
          {item.isHistorical && (
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] px-[7px] py-[3px] rounded-[2px] border border-white/[0.08] text-[#6A6A6A] bg-transparent"
              style={{ fontFamily: "'Space Grotesk', monospace" }}
            >
              Historical context
            </span>
          )}
        </div>

        {/* Pillar quote box */}
        <div className="px-[18px] py-[14px] bg-white/[0.02] border border-white/[0.04] rounded-[3px] mb-[18px]">
          <div
            className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A] mb-[8px]"
            style={{ fontFamily: "'Space Grotesk', monospace" }}
          >
            The reason you own {item.ticker}
          </div>
          <p className="text-[15.5px] font-semibold leading-[1.45] tracking-[-0.01em] text-[#FAFAFA] m-0">
            {item.pillarClaim}
          </p>
        </div>

        {/* What it means */}
        <p className="text-[16px] leading-[1.55] font-medium text-[#FAFAFA] m-0 mb-[18px]">
          {item.whatItMeans}
        </p>

        {/* Receipt inset */}
        <div className="flex gap-[14px] p-[16px_18px] bg-[#060606] border border-white/[0.06] rounded-[3px]">
          {/* File icon */}
          <svg
            width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="#6A6A6A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 mt-[2px]"
          >
            <path d="M14 3v5h5M7 3h8l4 4v14H7z" />
            <path d="M10 13h6M10 17h4" />
          </svg>

          <div className="flex-1">
            {/* Excerpt */}
            <p className="text-[13.5px] leading-[1.55] text-[#9A9A9A] m-0 mb-[8px]">
              {item.what}
            </p>

            {/* Citation footnote */}
            <div className="flex items-center gap-[6px] flex-wrap">
              <span className="text-[12px] text-[#6A6A6A]">{item.sourceTitle}</span>
              {item.sourcePublishedAt && (
                <>
                  <span className="text-[#4A4A4A] text-[12px]">·</span>
                  <span className="font-mono text-[11px] text-[#6A6A6A] tabular-nums" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                    {formatDate(item.sourcePublishedAt)}
                  </span>
                </>
              )}
              {item.sourceUrl && (
                <>
                  <span className="text-[#4A4A4A] text-[12px]">·</span>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-[3px] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors"
                  >
                    <ExternalLink size={11} />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Why (muted) */}
        <p className="text-[13.5px] leading-[1.6] text-[#6A6A6A] mt-[16px] mb-0">
          <span
            className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#4A4A4A] mr-[10px]"
            style={{ fontFamily: "'Space Grotesk', monospace" }}
          >
            Why
          </span>
          {item.why}
        </p>

        {/* Consider row (only when non-null) */}
        {item.consider && (
          <div className="flex items-start gap-[16px] mt-[18px] px-[18px] py-[13px] border border-[rgba(230,185,77,0.18)] bg-[rgba(230,185,77,0.06)] rounded-[3px]">
            <div className="flex-1">
              <span
                className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D] mr-[10px]"
                style={{ fontFamily: "'Space Grotesk', monospace" }}
              >
                Consider
              </span>
              <span className="text-[13.5px] leading-[1.5] text-[#E6B94D]">
                {item.consider}
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
