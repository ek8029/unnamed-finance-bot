// lib/judge-escalation.ts
// E2 (spec 2026-07-16): two-speed judge. gpt-4o-mini does bulk reads; rows it
// grades MATERIAL (or self-reports low confidence) are re-reviewed by a stronger
// model before they can touch status math. The frontier model acts as a senior
// analyst reviewing a junior's finding: confirm, downgrade to context, or reject.
// On any escalation failure the original verdict is kept — an API blip must
// never lose evidence.

import type OpenAI from 'openai';
import { fence, INJECTION_GUARD } from '@/lib/prompt-safety';
import { recordUsage, usageFromOpenAI, type UsageLedger } from '@/lib/ai/pricing';

export const ESCALATION_MODEL = 'gpt-4o';
/** Hard per-run cap: escalation exists to sharpen the few rows that matter. */
export const ESCALATION_CAP = 20;

export type EscalationAction = 'keep' | 'downgrade' | 'reject';

export interface EscalationInput {
  pillarClaim: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  excerpt: string;
  why: string;
  /**
   * The pillar's own kill criterion. Optional because it was null for every
   * user-authored pillar until 2026-09-03; without it the reviewer is asked to
   * grade a contradicts verdict with no falsification criterion in front of it.
   */
  breaksIf?: string | null;
  /** filing | form4 | xbrl | news | price_move. A 10-K is not a headline. */
  sourceType?: string | null;
  /** Publication date (YYYY-MM-DD). Stale news reads differently from a filing today. */
  publishedAt?: string | null;
}

/** Pure: does this row's verdict warrant a second, stronger read? */
export function needsEscalation(row: { materiality: string; confidence?: string | null }): boolean {
  return row.materiality === 'material' || row.confidence === 'low';
}

const REVIEW_PROMPT = `You are a senior equity analyst reviewing a junior analyst's evidence findings before they reach a client.
Each finding links a verbatim source excerpt to a thesis pillar with a verdict and materiality grade.
For each finding decide ONE action:
- "keep": the connection is direct and the materiality grade is right.
- "downgrade": genuinely relevant, but graded material when it is only informative background; demote to context.
- "reject": the connection is indirect, hedged, thematic, or the excerpt does not actually bear on the pillar's causal claim.
When a finding lists "Pillar breaks if", that is the holder's own falsification criterion: a contradicts verdict whose excerpt meets it is material, and one that does not meet it is at most context.
A "Source" line gives the document type and date. A company filing states facts about itself; news reports or argues. Weigh the excerpt accordingly.
Judge only what is in front of you. Do not invent facts. No em dashes.
Respond with JSON exactly: { "reviews": [ { "index": <1-based finding number>, "action": "keep" | "downgrade" | "reject", "reason": "<one sentence>" } ] }`;

/**
 * Review a batch of escalation candidates in one call.
 * Returns one action per input row (aligned by index) plus `reviewed`: whether
 * the senior model actually ran. On API/parse failure `reviewed` is false and
 * all actions are "keep" (evidence is never lost) — the caller must NOT attribute
 * those rows to the escalation model when reviewed is false.
 */
export async function reviewEscalations(
  openai: OpenAI,
  rows: EscalationInput[],
  log: string[],
  model: string = ESCALATION_MODEL,
  /** Where this call's tokens and cost are recorded, when the caller keeps a ledger. */
  ledger?: UsageLedger,
): Promise<{ actions: EscalationAction[]; reviewed: boolean }> {
  const actions: EscalationAction[] = rows.map(() => 'keep');
  if (rows.length === 0) return { actions, reviewed: true };
  let reviewed = true;

  const findings = rows
    .map((r, i) => {
      const lines = [`Finding ${i + 1}`, `Pillar: ${r.pillarClaim}`];
      if (r.breaksIf) lines.push(`Pillar breaks if: ${r.breaksIf}`);
      lines.push(`Verdict: ${r.verdict} (${r.materiality})`);
      const provenance = [r.sourceType, r.publishedAt].filter(Boolean).join(', ');
      if (provenance) lines.push(`Source: ${provenance}`);
      lines.push(`Excerpt: "${r.excerpt}"`, `Junior analyst's reasoning: ${r.why}`);
      return lines.join('\n');
    })
    .join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${INJECTION_GUARD}\n${REVIEW_PROMPT}` },
        { role: 'user', content: fence(findings, 'FINDINGS') },
      ],
    });
    if (ledger) recordUsage(ledger, model, usageFromOpenAI(response.usage));
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
      reviews?: { index?: number; action?: string; reason?: string }[];
    };
    for (const r of parsed.reviews ?? []) {
      const i = (r.index ?? 0) - 1;
      if (i < 0 || i >= rows.length) continue;
      if (r.action === 'keep' || r.action === 'downgrade' || r.action === 'reject') {
        actions[i] = r.action;
        if (r.action !== 'keep') log.push(`[escalation] ${r.action}: ${r.reason ?? 'no reason'}`);
      }
    }
  } catch (err) {
    reviewed = false;
    log.push(`[escalation] review failed, keeping original verdicts: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { actions, reviewed };
}
