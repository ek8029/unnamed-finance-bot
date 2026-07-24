'use client';

// The research layer inside /dashboard/chat, A-shape (2026-07-24): the chat is
// the surface. This adds three quiet things above it — a plain-English standing
// line, the value ledger, and the agent's findings as clickable chips that seed
// questions. No feed, no wall of cards.
//
// Read-only + deterministic on view (no LLM cost). Renders nothing below Max or
// when there is nothing to show, so the page is unchanged for everyone else.

import { useCallback, useEffect, useState } from 'react';
import posthog from 'posthog-js';
import type { Finding, ValueLedger } from '@/lib/research/types';
import type { Standing } from '@/lib/research/standing';
import { ValueLedgerCard } from './value-ledger-card';
import { FindingChips } from './finding-chips';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

interface FeedResponse {
  locked: boolean;
  findings?: Finding[];
  ledger?: ValueLedger;
  standing?: Standing;
}

export function ResearchPanel({ onAsk }: { onAsk: (question: string) => void }) {
  const [data, setData] = useState<FeedResponse | null>(null);

  const load = useCallback((firstLoad = false) => {
    fetch('/api/research/feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FeedResponse | null) => {
        if (!d) return;
        setData(d);
        if (firstLoad && !d.locked) {
          try {
            posthog.capture('research_panel_viewed', {
              findings: d.findings?.length ?? 0,
              surfaced: d.ledger?.surfacedTotal ?? 0,
              headline: d.standing?.headline ? 'yes' : 'no',
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

  const standing = data.standing;
  const ledger = data.ledger;
  const findings = data.findings ?? [];
  const hasAnything =
    findings.length > 0 ||
    (ledger?.surfacedTotal ?? 0) > 0 ||
    (ledger?.realizedTotal ?? 0) > 0 ||
    !!standing?.headline;
  if (!hasAnything) return null;

  return (
    <div className="space-y-4 mt-5 mb-2">
      {/* the one thing, in plain English */}
      {standing?.headline && (
        <p className="text-[15px] leading-[1.5] text-[var(--color-text-primary)] m-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)] mr-2" style={MONO}>
            Where you stand
          </span>
          {standing.headline}
        </p>
      )}

      {ledger && (ledger.surfacedTotal > 0 || (ledger.realizedTotal ?? 0) > 0) && (
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
      )}

      {findings.length > 0 && (
        <FindingChips
          findings={findings}
          onAsk={(q) => {
            try {
              posthog.capture('research_finding_chip_clicked');
            } catch {
              /* analytics only */
            }
            onAsk(q);
          }}
        />
      )}
    </div>
  );
}
