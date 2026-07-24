'use client';

// The research panel grafted into the dashboard: where you stand, the value
// Helm has surfaced, and the feed of what the agent found — all read-only.
//
// Deliberately no LLM call and no "ask" affordance yet: the council's sequencing
// is to prove people pull on the feed before spending on grounded Q&A. Renders
// nothing when the user is below Max or has no findings, so it never adds noise.

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import type { Finding, ValueLedger } from '@/lib/research/types';
import type { Standing } from '@/lib/research/standing';
import { StandingStrip } from './standing-strip';
import { ValueLedgerCard } from './value-ledger-card';
import { FindingsFeed } from './findings-feed';

interface FeedResponse {
  locked: boolean;
  findings?: Finding[];
  ledger?: ValueLedger;
  standing?: Standing;
}

export function ResearchPanel() {
  const [data, setData] = useState<FeedResponse | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/research/feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FeedResponse | null) => {
        if (!alive || !d) return;
        setData(d);
        if (!d.locked) {
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
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.locked) return null;

  const hasAnything =
    (data.findings?.length ?? 0) > 0 ||
    (data.ledger?.surfacedTotal ?? 0) > 0 ||
    (data.standing?.checks.length ?? 0) > 0;
  if (!hasAnything) return null;

  return (
    <div className="space-y-4 mt-5 mb-6">
      {data.standing && data.standing.checks.length > 0 && <StandingStrip standing={data.standing} />}
      {data.ledger && data.ledger.surfacedTotal > 0 && (
        <ValueLedgerCard
          ledger={data.ledger}
          onAsk={() => {
            try {
              posthog.capture('research_ledger_breakdown_clicked');
            } catch {
              /* analytics only */
            }
          }}
        />
      )}
      {data.findings && data.findings.length > 0 && (
        <div className="rounded-lg border border-white/[0.07] bg-[#0A0A0A] p-4 sm:p-5">
          {/* read-only: no onAsk, so cards render static with their source links */}
          <FindingsFeed findings={data.findings} />
        </div>
      )}
    </div>
  );
}
