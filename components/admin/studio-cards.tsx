'use client';

import { useState } from 'react';

export interface StudioPost {
  id: string;
  /** Format label, e.g. "What the agent caught (X)". */
  kind: string;
  /** Small context line, e.g. "NVDA · Jun 25". */
  meta?: string;
  /** ISO date for sorting newest-first. */
  date?: string;
  text: string;
}

export interface StudioGroup {
  title: string;
  blurb: string;
  posts: StudioPost[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked; user can select manually */
        }
      }}
      className="shrink-0 rounded-[5px] bg-[var(--color-gold)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-bg-base)] transition-all hover:brightness-110"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function PostCard({ p }: { p: StudioPost }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-base)] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          {p.kind}{p.meta ? ` · ${p.meta}` : ''}
        </span>
        <CopyButton text={p.text} />
      </div>
      <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{p.text}</pre>
    </div>
  );
}

export function StudioCards({ groups }: { groups: StudioGroup[] }) {
  // Default: open the first section (the fresh catches), collapse the rest.
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(groups.map((g, i) => [g.title, i === 0])),
  );

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const posts = [...g.posts].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
        const isOpen = open[g.title] ?? false;
        return (
          <section
            key={g.title}
            className="overflow-hidden rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-surface)]"
          >
            <button
              onClick={() => setOpen((o) => ({ ...o, [g.title]: !o[g.title] }))}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[17px] font-bold text-[var(--color-text-primary)]">{g.title}</h2>
                  <span className="rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--color-gold)]">
                    {posts.length}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-muted)]">{g.blurb}</p>
              </div>
              <svg
                className={`shrink-0 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isOpen && (
              <div className="border-t border-[var(--color-border-base)] px-5 py-4">
                {posts.length === 0 ? (
                  <p className="text-[14px] italic text-[var(--color-text-muted)]">Nothing here today.</p>
                ) : (
                  <div className="space-y-4">
                    {posts.map((p) => <PostCard key={p.id} p={p} />)}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
