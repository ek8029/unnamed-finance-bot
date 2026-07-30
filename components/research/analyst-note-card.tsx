'use client';

// The weekly analyst note in the rail: collapsed to its title until opened,
// then the full memo with inline [id] citations rewritten to numbered refs and
// a compact source list underneath. Same citation grammar as GroundedAnswerView,
// rendered tighter because the rail is narrow.

import type { AnalystNote } from '@/lib/research/types';
import { withBold } from './rich-text';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

function renderProse(body: string, refIndex: Map<string, number>) {
  const parts = body.split(/(\[[a-z_]+:[^\]]+\])/gi);
  return parts.map((part, i) => {
    const m = part.match(/^\[([a-z_]+:[^\]]+)\]$/i);
    if (!m) return <span key={i}>{withBold(part, i)}</span>;
    const n = refIndex.get(m[1].trim());
    if (!n) return null; // dropped, unvalidated citation
    return (
      <sup key={i} className="text-[9.5px] font-semibold text-[var(--color-gold)]" style={MONO}>
        [{n}]
      </sup>
    );
  });
}

export function AnalystNoteCard({ note, onOpen }: { note: AnalystNote; onOpen?: () => void }) {
  const refIndex = new Map(note.citations.map((f, i) => [f.id, i + 1]));
  const weekLabel = note.weekStart.slice(5).replace('-', '/');

  return (
    <details
      className="group"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) onOpen?.();
      }}
    >
      <summary className="list-none cursor-pointer px-4 pt-5 pb-4 hover:bg-white/[0.02]">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-1.5" style={MONO}>
          This week&rsquo;s note · wk {weekLabel}
        </div>
        <p className="text-[14.5px] leading-[1.45] font-semibold text-[var(--color-text-primary)] m-0">
          {note.title}
        </p>
        <span className="mt-1 inline-block text-[11.5px] text-[var(--color-text-muted)] group-open:hidden" style={MONO}>
          read →
        </span>
      </summary>
      <div className="px-4 pb-4">
        <div className="text-[13.5px] leading-[1.6] text-[var(--color-text-secondary)] whitespace-pre-wrap">
          {renderProse(note.body, refIndex)}
        </div>
        {note.citations.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {note.citations.map((f, i) => (
              <div key={f.id} className="flex items-baseline gap-2 text-[11.5px] leading-[1.45]">
                <span className="shrink-0 font-semibold text-[var(--color-gold)]" style={MONO}>[{i + 1}]</span>
                <span className="min-w-0 text-[var(--color-text-muted)]">
                  {f.date && <span style={MONO}>{f.date} · </span>}
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-gold)] transition-colors">
                      {f.source}
                    </a>
                  ) : (
                    f.source
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
