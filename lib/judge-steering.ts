// lib/judge-steering.ts
// E5 (spec 2026-07-16): per-thesis judge steering, built live from the holder's
// own recorded judgments — status overrides ("Keep intact, I disagree") and
// dismissed draft pillars. Deterministic templates, no model, no new tables:
// the training signal already lives in thesis_pillars columns.
//
// The block calibrates the judge's materiality/relevance instincts. It must
// never override facts, so the prompt frames it as context, not instruction.

export const STEERING_CHAR_CAP = 400;

export interface SteeringPillar {
  claim: string;
  status_override: string | null;
  status_changed_at: string | null;
}

export interface DismissedDraft {
  claim: string;
}

function short(claim: string, max = 70): string {
  const t = claim.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(' ');
  return `${cut.slice(0, sp > 30 ? sp : max).trimEnd()}…`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  return d ? ` (${d})` : '';
}

/**
 * Build the holder-context block for the judge prompt. Empty string when the
 * holder has never overridden or dismissed anything — most users, most days.
 * Hard-capped at STEERING_CHAR_CAP so prompt size cannot creep.
 */
export function buildJudgeSteering(pillars: SteeringPillar[], dismissed: DismissedDraft[]): string {
  const lines: string[] = [];
  for (const p of pillars) {
    if (!p.status_override) continue;
    lines.push(`Holder disagreed with our derived status and marked "${short(p.claim)}" as ${p.status_override}${fmtDate(p.status_changed_at)}.`);
  }
  for (const d of dismissed.slice(0, 3)) {
    lines.push(`Holder dismissed a drafted pillar as not their reasoning: "${short(d.claim)}".`);
  }
  if (lines.length === 0) return '';

  let block = '';
  for (const l of lines) {
    if (block.length + l.length + 1 > STEERING_CHAR_CAP) break;
    block += (block ? '\n' : '') + l;
  }
  return block;
}
