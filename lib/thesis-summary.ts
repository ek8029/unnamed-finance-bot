// Aggregates a thesis's pillars for the portfolio column and Theses page meters.
import type { PillarStatus } from '@/lib/thesis-status';

export interface SummaryPillar {
  confirmed: boolean;
  status: PillarStatus;
  status_override: PillarStatus | null;
  lifecycle: string;
}

export interface ThesisSummary {
  confirmedCount: number;
  draftCount: number;
  statusCounts: Record<PillarStatus, number>;
  /** Severity-ranked worst effective status among confirmed pillars; null when none. */
  worst: PillarStatus | null;
}

const SEVERITY: PillarStatus[] = ['broken', 'weakening', 'unverified', 'intact'];

export function effectiveStatus(p: Pick<SummaryPillar, 'status' | 'status_override'>): PillarStatus {
  return p.status_override ?? p.status;
}

export function summarizePillars(pillars: SummaryPillar[]): ThesisSummary {
  const statusCounts: Record<PillarStatus, number> = { unverified: 0, intact: 0, weakening: 0, broken: 0 };
  let confirmedCount = 0;
  let draftCount = 0;
  for (const p of pillars) {
    if (p.lifecycle === 'dismissed') continue;
    if (!p.confirmed) { draftCount++; continue; }
    confirmedCount++;
    statusCounts[effectiveStatus(p)]++;
  }
  const worst = SEVERITY.find((s) => statusCounts[s] > 0) ?? null;
  return { confirmedCount, draftCount, statusCounts, worst };
}
