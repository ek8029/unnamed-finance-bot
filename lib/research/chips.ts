// Opening-question chips derived from the agent's real findings — the fix for
// the blank chat box. Deterministic and client-safe: plain-language questions
// a person would actually tap, seeded by what Helm has genuinely surfaced so
// the first answer lands on substance.

import type { Finding, ValueLedger } from './types';

export function chipsFromFindings(findings: Finding[], ledger?: ValueLedger | null): string[] {
  const chips: string[] = [];

  const challenged = [
    ...new Set(
      findings
        .filter((f) => f.ticker && (f.verdict === 'contradicts' || f.kind === 'action'))
        .map((f) => f.ticker as string),
    ),
  ];
  if (challenged.length > 0) chips.push('Which positions are challenged right now?');
  if (challenged[0]) chips.push(`What's going on with my ${challenged[0]}?`);
  if (ledger && ledger.surfacedTotal > 0) chips.push('How much could I harvest in tax losses?');
  chips.push('What is Helm seeing in my portfolio right now?');
  chips.push('What did Helm find this week?');

  return [...new Set(chips)].slice(0, 5);
}
