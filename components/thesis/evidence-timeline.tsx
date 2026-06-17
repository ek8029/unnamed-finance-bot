'use client';

// Per-thesis evidence timeline: the honest chronology of what landed against the
// thesis, newest first, each node linked to the pillar it bears on and the real
// source. This is the "show your work" surface — a chat can't reproduce a watched,
// dated, sourced audit trail. Grounded only in stored evidence (no fabrication).

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export interface TimelineEvidence {
  date: string | null; // source_published_at (honest), created_at fallback
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  excerpt: string;
  source_title: string;
  source_url: string | null;
  pillarClaim: string;
}

const SOURCE_LABEL: Record<TimelineEvidence['source_type'], string> = {
  filing: 'FILING',
  form4: 'FORM 4',
  xbrl: 'XBRL',
  news: 'NEWS',
  price_move: 'PRICE',
};

const VERDICT = {
  supports: { color: '#4ADE80', label: 'Supports' },
  contradicts: { color: '#F87171', label: 'Contradicts' },
  neutral: { color: '#6A6A6A', label: 'Neutral' },
} as const;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = iso.split('T')[0];
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
}

const when = (e: TimelineEvidence) => e.date ?? '';

export function EvidenceTimeline({ evidence, defaultOpen = false }: { evidence: TimelineEvidence[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (evidence.length === 0) return null;

  const ordered = [...evidence].sort((a, b) => when(b).localeCompare(when(a)));

  return (
    <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
          Timeline
        </span>
        <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
          {ordered.length} event{ordered.length === 1 ? '' : 's'}, newest first
        </span>
        <ChevronDown size={15} className={`ml-auto text-[#6A6A6A] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          <ol className="relative ml-1 border-l border-white/[0.10]">
            {ordered.map((e, i) => {
              const v = VERDICT[e.verdict];
              return (
                <li key={i} className="relative pl-5 pb-4 last:pb-0">
                  <span
                    className="absolute -left-[5px] top-[3px] w-[9px] h-[9px] rounded-full"
                    style={{ background: v.color, boxShadow: e.materiality === 'material' ? `0 0 8px ${v.color}66` : 'none' }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] text-[#9A9A9A]" style={MONO}>
                      {fmtDate(e.date)}
                    </span>
                    <span
                      className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] px-1.5 py-[2px] rounded border border-white/[0.10] text-[#8A8A8A]"
                      style={MONO}
                    >
                      {SOURCE_LABEL[e.source_type]}
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.10em]" style={{ ...MONO, color: v.color }}>
                      {v.label}
                    </span>
                    {e.materiality === 'material' && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6A6A6A]" style={MONO}>
                        material
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] leading-[1.55] text-[#E4E4E4] mt-1.5 mb-0">&ldquo;{e.excerpt}&rdquo;</p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] text-[#6A6A6A]">
                    {e.source_url ? (
                      <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#E6B94D] transition-colors truncate max-w-[280px]">
                        {e.source_title}
                      </a>
                    ) : (
                      <span className="truncate max-w-[280px]">{e.source_title}</span>
                    )}
                  </div>
                  <div className="text-[12px] text-[#5A5A5A] mt-1 truncate">on: {e.pillarClaim}</div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
