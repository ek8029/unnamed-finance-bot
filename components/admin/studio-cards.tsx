'use client';

import { useState } from 'react';

export interface StudioPost {
  id: string;
  /** Format label, e.g. "What the agent caught (X)". */
  kind: string;
  /** Small context line, e.g. "NVDA · Jun 25". */
  meta?: string;
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

export function StudioCards({ groups }: { groups: StudioGroup[] }) {
  return (
    <div className="space-y-12">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="text-[20px] font-bold text-[var(--color-text-primary)]">{g.title}</h2>
          <p className="mt-1 mb-5 text-[14px] text-[var(--color-text-muted)]">{g.blurb}</p>
          {g.posts.length === 0 ? (
            <p className="text-[14px] text-[var(--color-text-muted)] italic">Nothing here today.</p>
          ) : (
            <div className="space-y-4">
              {g.posts.map((p) => (
                <div key={p.id} className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      {p.kind}{p.meta ? ` · ${p.meta}` : ''}
                    </span>
                    <CopyButton text={p.text} />
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{p.text}</pre>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
