// "Where you stand" — a deterministic, plain-English read of whether the user is
// okay, computed with no LLM call from data already fetched. The council's
// Outsider was blunt: people don't want 14 findings, they want "the one thing"
// and "am I okay". This is that layer. Every line is a fact, no advice.

import type { Finding } from './types';
import type { PortfolioBrief, ValueLedger } from './account';

export type CheckStatus = 'ok' | 'watch' | 'flag';

export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface Standing {
  /** The single most important thing, in plain English. */
  headline: string;
  checks: Check[];
}

const SEVERITY: Record<CheckStatus, number> = { flag: 2, watch: 1, ok: 0 };

export function computeStanding(
  brief: PortfolioBrief | null,
  findings: Finding[],
  ledger: ValueLedger,
): Standing {
  const checks: Check[] = [];

  // ── Concentration ──
  const top = brief?.holdings[0];
  const topSector = brief?.sectorAllocation.find((s) => s.sector !== 'Unclassified');
  if (top && top.pct >= 25) {
    checks.push({
      label: 'Concentration',
      status: 'flag',
      detail: `${top.ticker} is ${top.pct.toFixed(0)}% of your book — a large single-name bet.`,
    });
  } else if (topSector && topSector.pct >= 50) {
    checks.push({
      label: 'Concentration',
      status: 'flag',
      detail: `${topSector.sector} is ${topSector.pct.toFixed(0)}% of your book — if it dips, most of your money moves together.`,
    });
  } else if (topSector && topSector.pct >= 35) {
    checks.push({
      label: 'Concentration',
      status: 'watch',
      detail: `${topSector.sector} is ${topSector.pct.toFixed(0)}% of your book — leaning heavy, not extreme.`,
    });
  } else if (brief) {
    checks.push({ label: 'Concentration', status: 'ok', detail: 'No single name or sector dominates your book.' });
  }

  // ── Taxes ──
  const harvest = ledger.lines.find((l) => l.kind === 'tax_harvest');
  if (harvest && harvest.amount > 0) {
    checks.push({
      label: 'Taxes',
      status: 'watch',
      detail: `About $${harvest.amount.toLocaleString()} in potential tax savings is sitting in positions that are down.`,
    });
  } else if (brief) {
    checks.push({ label: 'Taxes', status: 'ok', detail: 'No harvestable losses to flag right now.' });
  }

  // ── Theses ──
  const challenged = findings.filter(
    (f) => f.kind === 'investigation' || (f.kind === 'catch' && f.verdict === 'contradicts'),
  );
  if (challenged.length > 0) {
    checks.push({
      label: 'Theses',
      status: challenged.some((f) => f.kind === 'investigation') ? 'flag' : 'watch',
      detail: `${challenged.length} finding${challenged.length > 1 ? 's' : ''} challenge the reasons you hold what you hold.`,
    });
  } else if (findings.length > 0) {
    checks.push({ label: 'Theses', status: 'ok', detail: 'Nothing is challenging your theses right now.' });
  }

  // ── Headline: the single highest-severity thing, plainly ──
  const ranked = [...checks].sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]);
  const worst = ranked[0];
  const headline =
    worst && worst.status !== 'ok'
      ? worst.detail
      : checks.length > 0
        ? 'Nothing needs your attention — your book looks steady.'
        : 'Connect an account and Helm will tell you where you stand.';

  return { headline, checks };
}
