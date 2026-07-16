// lib/thesis-verdict.ts
// Holding-level "on balance" verdict: one chip + one sentence per thesis.
// Pure templates over pillar statuses. Never call an LLM here — same discipline
// as thesis-status.ts. Sentences describe state, never prescribe action.

import type { PillarStatus } from '@/lib/thesis-status';

export type ThesisVerdict = 'supported' | 'challenged' | 'mixed' | 'watching';

export const VERDICT_META: Record<ThesisVerdict, { label: string; color: string }> = {
  supported: { label: 'Supported', color: '#4ADE80' },
  challenged: { label: 'Challenged', color: '#F87171' },
  mixed: { label: 'Mixed', color: '#E6B94D' },
  watching: { label: 'Watching', color: '#6A6A6A' },
};

export interface VerdictPillar {
  claim: string;
  /** Effective status (override ?? status) of a CONFIRMED pillar. */
  status: PillarStatus;
}

/**
 * Derive the thesis-level verdict from confirmed-pillar status counts
 * (the same shape ThesisSummary.statusCounts produces).
 * A broken pillar dominates: intact neighbors don't soften it to "mixed".
 */
export function deriveThesisVerdict(counts: Record<PillarStatus, number>): ThesisVerdict {
  const negative = counts.broken + counts.weakening;
  const positive = counts.intact;
  if (positive === 0 && negative === 0) return 'watching';
  if (negative === 0) return 'supported';
  if (counts.broken > 0 || positive === 0) return 'challenged';
  return 'mixed';
}

/** Word-boundary truncation so pillar claims fit inside one sentence. */
export function shortClaim(claim: string, max = 52): string {
  const trimmed = claim.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : max).trimEnd()}…`;
}

const q = (claim: string) => `"${shortClaim(claim)}"`;

/**
 * One auto-synthesized sentence summarizing where the thesis stands.
 * Deterministic templates over the confirmed pillars; no model, no advice verbs.
 */
export function verdictSentence(pillars: VerdictPillar[]): string {
  const counts: Record<PillarStatus, number> = { unverified: 0, intact: 0, weakening: 0, broken: 0 };
  for (const p of pillars) counts[p.status]++;
  const verdict = deriveThesisVerdict(counts);

  const intact = pillars.filter((p) => p.status === 'intact');
  const weakening = pillars.filter((p) => p.status === 'weakening');
  const broken = pillars.filter((p) => p.status === 'broken');

  if (pillars.length === 0) return 'No confirmed pillars yet; Helm starts watching once you confirm one.';

  if (verdict === 'watching') {
    return 'On balance: no evidence has landed yet; Helm is watching for the first filings and news.';
  }

  if (verdict === 'supported') {
    if (intact.length === 1 && counts.unverified === 0) {
      return `On balance: ${q(intact[0].claim)} is holding.`;
    }
    const tail = counts.unverified > 0 ? `; ${counts.unverified} awaiting evidence` : '';
    return `On balance: all ${intact.length} verified pillar${intact.length === 1 ? '' : 's'} ${intact.length === 1 ? 'is' : 'are'} holding${tail}.`;
  }

  if (verdict === 'mixed') {
    const weakPart = `${q(weakening[0].claim)} is being tested`;
    const holdPart = intact.length === 1 ? `${q(intact[0].claim)} holds` : `${intact.length} pillars hold`;
    return `On balance: ${weakPart} while ${holdPart}.`;
  }

  // challenged
  if (broken.length > 0) {
    const others = intact.length > 0 ? `; ${intact.length} other pillar${intact.length === 1 ? '' : 's'} holding` : '';
    return `On balance: ${q(broken[0].claim)} has broken${others}.`;
  }
  if (weakening.length === 1) {
    return `On balance: ${q(weakening[0].claim)} is being tested.`;
  }
  return `On balance: ${weakening.length} pillars are being tested.`;
}
