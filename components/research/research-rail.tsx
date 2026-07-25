'use client';

// The research rail (2026-07-24 direction): the chat column stays exactly the
// shipped chat, and the intelligence lives in a right-hand rail — where you
// stand, the TLH ledger, and the agent's ACTUAL findings (thesis catches with
// receipts, investigation memos, cross-thesis risk, tax actions). Every finding
// can seed a question into the chat. Spending/credit noise never reaches this
// pane (filtered at the source).
//
// Renders its own <aside>, xl+ screens only; returns null when locked or empty
// so the chat page is byte-identical for everyone else.

import { useCallback, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import type { Finding, ValueLedger } from '@/lib/research/types';
import type { Standing } from '@/lib/research/standing';
import { FINDING_KIND_LABEL } from '@/lib/research/types';
import { ValueLedgerCard } from './value-ledger-card';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const KIND_TONE: Record<Finding['kind'], string> = {
  catch: '#E6B94D',
  investigation: '#7CA9F2',
  cross_thesis: '#F87171',
  action: '#4ADE80',
};

const STATUS_TONE: Record<'ok' | 'watch' | 'flag', string> = {
  ok: 'var(--color-positive, #4ADE80)',
  watch: 'var(--color-gold, #E6B94D)',
  flag: 'var(--color-negative-text, #F87171)',
};

interface FeedResponse {
  locked: boolean;
  findings?: Finding[];
  ledger?: ValueLedger;
  standing?: Standing;
}

function questionForFinding(f: Finding): string {
  const subject = f.ticker ? `my ${f.ticker} position` : 'my portfolio';
  return `Helm flagged this on ${subject}: "${f.summary}" — what does it mean for me?`;
}

function FindingRow({ f, onAsk }: { f: Finding; onAsk: (q: string) => void }) {
  const tone = KIND_TONE[f.kind];
  return (
    <details className="group border-b border-[var(--color-border-subtle)] last:border-b-0">
      <summary className="list-none cursor-pointer px-3.5 py-3 hover:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone }} />
          {f.ticker && (
            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]" style={MONO}>{f.ticker}</span>
          )}
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]" style={MONO}>
            {FINDING_KIND_LABEL[f.kind]}
          </span>
          <span className="ml-auto text-[11px] text-[var(--color-text-muted)] shrink-0" style={MONO}>{f.date ?? ''}</span>
        </div>
        <p className="mt-1 text-[13.5px] leading-[1.45] text-[var(--color-text-secondary)] m-0 line-clamp-2">
          {f.summary}
        </p>
      </summary>
      <div className="px-3.5 pb-3 -mt-0.5">
        {f.quote && (
          <p className="text-[12.5px] leading-[1.5] text-[var(--color-text-muted)] border-l-2 pl-2.5 m-0 italic" style={{ borderColor: `${tone}55` }}>
            &ldquo;{f.quote.slice(0, 220)}&rdquo;
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[11.5px] text-[var(--color-text-muted)] min-w-0 truncate" style={MONO}>{f.source}</span>
          {f.url && (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-[var(--color-gold)] hover:brightness-110 shrink-0" style={MONO}>
              source ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => onAsk(questionForFinding(f))}
            className="ml-auto text-[11.5px] font-semibold text-[var(--color-gold)] hover:brightness-110 shrink-0"
            style={MONO}
          >
            ask →
          </button>
        </div>
      </div>
    </details>
  );
}

export function ResearchRail({ onAsk }: { onAsk: (question: string) => void }) {
  const [data, setData] = useState<FeedResponse | null>(null);

  const load = useCallback((firstLoad = false) => {
    fetch('/api/research/feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FeedResponse | null) => {
        if (!d) return;
        setData(d);
        if (firstLoad && !d.locked) {
          try {
            posthog.capture('research_rail_viewed', {
              findings: d.findings?.length ?? 0,
              surfaced: d.ledger?.surfacedTotal ?? 0,
            });
          } catch {
            /* analytics only */
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  if (!data || data.locked) return null;

  const findings = data.findings ?? [];
  const ledger = data.ledger;
  const standing = data.standing;
  const hasAnything =
    findings.length > 0 || (ledger?.surfacedTotal ?? 0) > 0 || (ledger?.realizedTotal ?? 0) > 0 || (standing?.checks.length ?? 0) > 0;
  if (!hasAnything) return null;

  return (
    <aside className="hidden xl:flex flex-col w-[340px] shrink-0 border-l border-[var(--color-border-subtle)] h-full overflow-y-auto custom-scrollbar">
      {/* where you stand */}
      {standing && standing.checks.length > 0 && (
        <div className="px-4 pt-5 pb-4 border-b border-[var(--color-border-subtle)]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2" style={MONO}>
            Where you stand
          </div>
          <p className="text-[14.5px] leading-[1.5] font-semibold text-[var(--color-text-primary)] m-0">
            {standing.headline}
          </p>
          <div className="mt-2.5 space-y-1.5">
            {standing.checks.map((c) => (
              <div key={c.label} className="flex items-baseline gap-2">
                <span className="mt-[1px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_TONE[c.status] }} />
                <span className="text-[12.5px] leading-[1.45] text-[var(--color-text-secondary)]">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* the TLH ledger — the deterministic dollar */}
      {ledger && (ledger.surfacedTotal > 0 || (ledger.realizedTotal ?? 0) > 0) && (
        <div className="px-4 py-4 border-b border-[var(--color-border-subtle)]">
          <ValueLedgerCard
            ledger={ledger}
            canRecord
            onRecorded={() => load()}
            onAsk={(q) => {
              try {
                posthog.capture('research_ledger_breakdown_clicked');
              } catch {
                /* analytics only */
              }
              onAsk(q);
            }}
          />
        </div>
      )}

      {/* the agent's actual findings */}
      {findings.length > 0 && (
        <div className="flex-1">
          <div className="px-4 pt-4 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>
            What Helm found · {findings.length}
          </div>
          <div>
            {findings.map((f) => (
              <FindingRow
                key={f.id}
                f={f}
                onAsk={(q) => {
                  try {
                    posthog.capture('research_finding_asked', { kind: f.kind });
                  } catch {
                    /* analytics only */
                  }
                  onAsk(q);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
